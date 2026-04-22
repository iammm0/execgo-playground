import { useEffect, useState } from "react";
import { BenchmarkComposer } from "./components/BenchmarkComposer";
import { CommandPanel } from "./components/CommandPanel";
import { ResultsBoard } from "./components/ResultsBoard";
import { loadWorkspaceSnapshot, runBenchmark, runPlaygroundCommand } from "./lib/tauri";
import type { BenchmarkInput, CommandRun, WorkspaceSnapshot } from "./types";
import "./styles.css";

const defaultBenchmark: BenchmarkInput = {
  frameworks: ["langgraph"],
  scenarios: ["codegen_exec"],
  chaos_profiles: ["none"],
  mode: "replay",
  repetitions: 1,
  provider: "mock",
  model: "mock-reliability-planner",
  temperature: 0,
  max_tokens: 1200,
  timeout_ms: 60000,
  seed: 7,
};

function App() {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkInput>(defaultBenchmark);
  const [manualCommand, setManualCommand] = useState("run --framework langgraph --scenario codegen_exec --mode replay --chaos none");
  const [lastRun, setLastRun] = useState<CommandRun | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWorkspaceSnapshot()
      .then((next) => {
        setSnapshot(next);
        setSelectedRunId(next.runs[0]?.run_id ?? null);
        setBenchmark((current) => ({
          ...current,
          frameworks: current.frameworks.filter((framework) => next.frameworks.includes(framework)).length
            ? current.frameworks.filter((framework) => next.frameworks.includes(framework))
            : [next.frameworks[0]].filter(Boolean),
          scenarios: current.scenarios.filter((scenario) => next.scenarios.includes(scenario)).length
            ? current.scenarios.filter((scenario) => next.scenarios.includes(scenario))
            : [next.scenarios[0]].filter(Boolean),
          chaos_profiles: current.chaos_profiles.filter((profile) => next.chaos_profiles.includes(profile)).length
            ? current.chaos_profiles.filter((profile) => next.chaos_profiles.includes(profile))
            : ["none"].filter((profile) => next.chaos_profiles.includes(profile)),
        }));
      })
      .catch((err) => setError(String(err)));
  }, []);

  const passRate = snapshot?.runs.length
    ? Math.round((snapshot.runs.filter((run) => run.verdict_passed).length / snapshot.runs.length) * 100)
    : 0;

  async function runCommand(args: string[]) {
    setBusy(true);
    setError(null);
    try {
      const result = await runPlaygroundCommand(args);
      setLastRun(result);
      setSnapshot(result.snapshot);
      setSelectedRunId(result.snapshot.runs[0]?.run_id ?? null);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function executeBenchmark() {
    setBusy(true);
    setError(null);
    try {
      const result = await runBenchmark(benchmark);
      setLastRun(result);
      setSnapshot(result.snapshot);
      setSelectedRunId(result.snapshot.runs[0]?.run_id ?? null);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    setError(null);
    try {
      const next = await loadWorkspaceSnapshot();
      setSnapshot(next);
      setSelectedRunId((current) => current ?? next.runs[0]?.run_id ?? null);
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">训练场桌面端</p>
          <h1>AI 编排可靠性训练场控制台</h1>
          <p className="hero-copy">
            通过本地子进程调用训练场 CLI，配置测评矩阵，并查看每组运行结果的结构化证据链。
          </p>
        </div>
        <div className="hero-stats">
          <span>{snapshot?.frameworks.length ?? 0} 个编排框架</span>
          <span>{snapshot?.scenarios.length ?? 0} 个测试场景</span>
          <span>通过率 {passRate}%</span>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <strong>操作失败</strong>
          <span>{error}</span>
        </div>
      )}

      <section className="workspace-strip">
        <div>
          <span>训练场目录</span>
          <code>{snapshot?.playground_root ?? "加载中..."}</code>
        </div>
        <div>
          <span>Python 解释器</span>
          <code>{snapshot?.python_bin ?? "python3"}</code>
        </div>
        <button className="ghost-button" disabled={busy} onClick={refresh}>刷新结果</button>
      </section>

      <section className="top-grid">
        <CommandPanel
          value={manualCommand}
          busy={busy}
          lastRun={lastRun}
          onChange={setManualCommand}
          onRun={runCommand}
        />
        <BenchmarkComposer
          snapshot={snapshot}
          value={benchmark}
          busy={busy}
          onChange={setBenchmark}
          onRun={executeBenchmark}
        />
      </section>

      <ResultsBoard
        runs={snapshot?.runs ?? []}
        selectedRunId={selectedRunId}
        onSelect={setSelectedRunId}
      />
    </main>
  );
}

export default App;
