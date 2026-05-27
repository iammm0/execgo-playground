use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    env, fs,
    path::{Path, PathBuf},
    process::Command,
    time::SystemTime,
};

#[derive(Debug, Serialize)]
pub struct WorkspaceSnapshot {
    pub desktop_root: String,
    pub playground_root: String,
    pub node_bin: String,
    pub frameworks: Vec<String>,
    pub scenarios: Vec<String>,
    pub chaos_profiles: Vec<String>,
    pub runs: Vec<RunSummary>,
}

#[derive(Debug, Serialize)]
pub struct CommandRun {
    pub command: Vec<String>,
    pub cwd: String,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub snapshot: WorkspaceSnapshot,
}

#[derive(Debug, Serialize)]
pub struct RunSummary {
    pub run_id: String,
    pub framework: String,
    pub scenario_id: String,
    pub mode: String,
    pub chaos_profile: String,
    pub verdict_passed: bool,
    pub reasons: Vec<String>,
    pub wall_time_ms: i64,
    pub task_count: i64,
    pub stage_count: i64,
    pub runtime_failure_count: i64,
    pub submit_accept_rate: f64,
    pub artifact_hash_match: f64,
    pub run_dir: String,
    pub result_path: String,
    pub summary_path: String,
    pub timeline_path: String,
}

#[derive(Debug, Deserialize)]
pub struct BenchmarkInput {
    pub frameworks: Vec<String>,
    pub scenarios: Vec<String>,
    pub chaos_profiles: Vec<String>,
    pub mode: String,
    pub repetitions: u32,
    pub provider: String,
    pub model: String,
    pub temperature: f64,
    pub max_tokens: u32,
    pub timeout_ms: u32,
    pub seed: u32,
}

#[tauri::command]
pub fn load_workspace_snapshot() -> Result<WorkspaceSnapshot, String> {
    workspace_snapshot()
}

#[tauri::command]
pub fn run_playground_command(args: Vec<String>) -> Result<CommandRun, String> {
    if args.is_empty() {
        return Err("请输入要传给 execgo-playground CLI 的参数".into());
    }
    run_cli(args)
}

#[tauri::command]
pub fn run_benchmark(input: BenchmarkInput) -> Result<CommandRun, String> {
    if input.frameworks.is_empty() {
        return Err("至少选择一个编排框架".into());
    }
    if input.scenarios.is_empty() {
        return Err("至少选择一个场景".into());
    }
    if input.chaos_profiles.is_empty() {
        return Err("至少选择一个 chaos profile".into());
    }

    let mut args = vec!["benchmark".to_string()];
    for framework in input.frameworks {
        args.push("--framework".into());
        args.push(framework);
    }
    for scenario in input.scenarios {
        args.push("--scenario".into());
        args.push(scenario);
    }
    for chaos_profile in input.chaos_profiles {
        args.push("--chaos".into());
        args.push(chaos_profile);
    }
    args.extend([
        "--mode".into(),
        input.mode,
        "--repetitions".into(),
        input.repetitions.to_string(),
        "--provider".into(),
        input.provider,
        "--model".into(),
        input.model,
        "--temperature".into(),
        input.temperature.to_string(),
        "--max-tokens".into(),
        input.max_tokens.to_string(),
        "--timeout-ms".into(),
        input.timeout_ms.to_string(),
        "--seed".into(),
        input.seed.to_string(),
    ]);
    run_cli(args)
}

fn run_cli(args: Vec<String>) -> Result<CommandRun, String> {
    let desktop_root = desktop_root()?;
    let playground_root = playground_root_from_desktop(&desktop_root)?;
    let node_bin = resolve_node_bin();
    let output = Command::new(&node_bin)
        .arg("run")
        .arg("--silent")
        .arg("cli")
        .arg("--")
        .args(&args)
        .current_dir(&playground_root)
        .output()
        .map_err(|err| format!("启动子进程失败: {err}"))?;

    let mut command = vec![node_bin.clone(), "run".into(), "--silent".into(), "cli".into(), "--".into()];
    command.extend(args);
    Ok(CommandRun {
        command,
        cwd: playground_root.to_string_lossy().to_string(),
        exit_code: output.status.code(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        snapshot: workspace_snapshot()?,
    })
}

fn workspace_snapshot() -> Result<WorkspaceSnapshot, String> {
    let desktop_root = desktop_root()?;
    let playground_root = playground_root_from_desktop(&desktop_root)?;
    Ok(WorkspaceSnapshot {
        desktop_root: desktop_root.to_string_lossy().to_string(),
        playground_root: playground_root.to_string_lossy().to_string(),
        node_bin: resolve_node_bin(),
        frameworks: vec!["langgraph".into(), "crewai".into(), "autogen".into()],
        scenarios: list_dirs_with_file(&playground_root.join("scenarios"), "scenario.json")?,
        chaos_profiles: list_json_stems(&playground_root.join("chaos").join("profiles"))?,
        runs: list_runs(&playground_root.join("var").join("runs"))?,
    })
}

fn desktop_root() -> Result<PathBuf, String> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    if manifest_dir.ends_with("src-tauri") {
        if let Some(parent) = manifest_dir.parent() {
            return Ok(parent.to_path_buf());
        }
    }

    let cwd = env::current_dir().map_err(|err| format!("无法读取当前目录: {err}"))?;
    if cwd.ends_with("src-tauri") {
        return cwd.parent().map(Path::to_path_buf).ok_or("无法定位 desktop-client 根目录".into());
    }
    if cwd.file_name().and_then(|name| name.to_str()) == Some("desktop-client") {
        return Ok(cwd);
    }
    let candidate = cwd.join("desktop-client");
    if candidate.join("src-tauri").exists() {
        return Ok(candidate);
    }
    Err(format!("无法从 {} 定位 desktop-client 根目录", cwd.display()))
}

fn playground_root_from_desktop(desktop_root: &Path) -> Result<PathBuf, String> {
    desktop_root
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "无法定位 execgo-playground 根目录".into())
}

fn resolve_node_bin() -> String {
    if let Ok(candidate) = env::var("EXECGO_PLAYGROUND_NPM") {
        if !candidate.trim().is_empty() {
            return candidate;
        }
    }
    for candidate in ["npm"] {
        if Command::new(candidate).arg("--version").output().is_ok() {
            return candidate.to_string();
        }
    }
    "npm".into()
}

fn list_dirs_with_file(root: &Path, file_name: &str) -> Result<Vec<String>, String> {
    let mut values = vec![];
    if !root.exists() {
        return Ok(values);
    }
    for entry in fs::read_dir(root).map_err(|err| format!("读取 {} 失败: {err}", root.display()))? {
        let entry = entry.map_err(|err| err.to_string())?;
        let path = entry.path();
        if path.is_dir() && path.join(file_name).exists() {
            if let Some(name) = path.file_name().and_then(|name| name.to_str()) {
                values.push(name.to_string());
            }
        }
    }
    values.sort();
    Ok(values)
}

fn list_json_stems(root: &Path) -> Result<Vec<String>, String> {
    let mut values = vec![];
    if !root.exists() {
        return Ok(values);
    }
    for entry in fs::read_dir(root).map_err(|err| format!("读取 {} 失败: {err}", root.display()))? {
        let path = entry.map_err(|err| err.to_string())?.path();
        if path.extension().and_then(|ext| ext.to_str()) == Some("json") {
            if let Some(stem) = path.file_stem().and_then(|stem| stem.to_str()) {
                values.push(stem.to_string());
            }
        }
    }
    values.sort();
    Ok(values)
}

fn list_runs(root: &Path) -> Result<Vec<RunSummary>, String> {
    let mut entries = vec![];
    if !root.exists() {
        return Ok(entries);
    }

    let mut dirs: Vec<(SystemTime, PathBuf)> = fs::read_dir(root)
        .map_err(|err| format!("读取 {} 失败: {err}", root.display()))?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let path = entry.path();
            if !path.is_dir() {
                return None;
            }
            let modified = entry.metadata().and_then(|metadata| metadata.modified()).ok()?;
            Some((modified, path))
        })
        .collect();
    dirs.sort_by(|left, right| right.0.cmp(&left.0));

    for (_, dir) in dirs.into_iter().take(80) {
        let result_path = dir.join("result.json");
        if !result_path.exists() {
            continue;
        }
        if let Ok(summary) = parse_run_summary(&dir, &result_path) {
            entries.push(summary);
        }
    }
    Ok(entries)
}

fn parse_run_summary(run_dir: &Path, result_path: &Path) -> Result<RunSummary, String> {
    let raw = fs::read_to_string(result_path).map_err(|err| err.to_string())?;
    let value: Value = serde_json::from_str(&raw).map_err(|err| err.to_string())?;
    let result = value
        .get("benchmark_result")
        .unwrap_or(&value);
    let metrics = result.get("metrics").unwrap_or(&Value::Null);
    let verdict = result.get("verdict").unwrap_or(&Value::Null);
    let manifest = result.get("artifact_manifest").unwrap_or(&Value::Null);

    Ok(RunSummary {
        run_id: string_at(result, "run_id"),
        framework: string_at(result, "framework"),
        scenario_id: string_at(result, "scenario_id"),
        mode: string_at(result, "mode"),
        chaos_profile: string_at(result, "chaos_profile"),
        verdict_passed: verdict
            .get("passed")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        reasons: verdict
            .get("reasons")
            .and_then(Value::as_array)
            .map(|items| items.iter().filter_map(Value::as_str).map(str::to_string).collect())
            .unwrap_or_default(),
        wall_time_ms: integer_at(metrics, "wall_time_ms"),
        task_count: integer_at(metrics, "task_count"),
        stage_count: integer_at(metrics, "stage_count"),
        runtime_failure_count: integer_at(metrics, "runtime_failure_count"),
        submit_accept_rate: number_at(metrics, "submit_accept_rate"),
        artifact_hash_match: number_at(metrics, "artifact_hash_match"),
        run_dir: manifest
            .get("run_dir")
            .and_then(Value::as_str)
            .map(str::to_string)
            .unwrap_or_else(|| run_dir.to_string_lossy().to_string()),
        result_path: result_path.to_string_lossy().to_string(),
        summary_path: manifest
            .get("summary_path")
            .and_then(Value::as_str)
            .map(str::to_string)
            .unwrap_or_else(|| run_dir.join("summary.md").to_string_lossy().to_string()),
        timeline_path: manifest
            .get("timeline_path")
            .and_then(Value::as_str)
            .map(str::to_string)
            .unwrap_or_else(|| run_dir.join("timeline.jsonl").to_string_lossy().to_string()),
    })
}

fn string_at(value: &Value, key: &str) -> String {
    value
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string()
}

fn integer_at(value: &Value, key: &str) -> i64 {
    value.get(key).and_then(Value::as_i64).unwrap_or(0)
}

fn number_at(value: &Value, key: &str) -> f64 {
    value.get(key).and_then(Value::as_f64).unwrap_or(0.0)
}
