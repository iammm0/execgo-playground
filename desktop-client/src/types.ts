export type WorkspaceSnapshot = {
  desktop_root: string;
  playground_root: string;
  python_bin: string;
  frameworks: string[];
  scenarios: string[];
  chaos_profiles: string[];
  runs: RunSummary[];
};

export type RunSummary = {
  run_id: string;
  framework: string;
  scenario_id: string;
  mode: string;
  chaos_profile: string;
  verdict_passed: boolean;
  reasons: string[];
  wall_time_ms: number;
  task_count: number;
  stage_count: number;
  runtime_failure_count: number;
  submit_accept_rate: number;
  artifact_hash_match: number;
  run_dir: string;
  result_path: string;
  summary_path: string;
  timeline_path: string;
};

export type CommandRun = {
  command: string[];
  cwd: string;
  exit_code: number | null;
  stdout: string;
  stderr: string;
  snapshot: WorkspaceSnapshot;
};

export type BenchmarkInput = {
  frameworks: string[];
  scenarios: string[];
  chaos_profiles: string[];
  mode: "live" | "replay";
  repetitions: number;
  provider: string;
  model: string;
  temperature: number;
  max_tokens: number;
  timeout_ms: number;
  seed: number;
};
