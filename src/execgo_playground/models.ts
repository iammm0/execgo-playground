export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };
export type RunMode = "live" | "replay";

export const STANDARD_PLAN_SCHEMA_VERSION = "0.1.0";

export type ExecGoTask = {
  id: string;
  type: string;
  params: Record<string, unknown>;
  input?: Record<string, unknown>;
  tool_name?: string;
  execution_category?: string;
  depends_on: string[];
  retry: number;
  timeout?: number;
  annotations: Record<string, string>;
};

export type ExecGoTaskGraph = {
  tasks: ExecGoTask[];
};

export type Binding = {
  source_task_id: string;
  source_path: string;
  target_task_id: string;
  target_param_path: string;
  required: boolean;
};

export type SubmitPolicy = {
  poll_interval_ms: number;
  max_attempts: number;
  stop_on_failure: boolean;
};

export type PlanStage = {
  stage_id: string;
  task_graph: ExecGoTaskGraph;
  bindings: Binding[];
  submit_policy: SubmitPolicy;
  expected_artifacts: string[];
  annotations: Record<string, string>;
};

export type PromptPack = {
  system_prompt: string;
  user_prompt: string;
  constraints_prompt: string;
};

export type ModelProfile = {
  provider: string;
  model: string;
  temperature: number;
  max_tokens: number;
  timeout_ms: number;
  seed: number;
};

export type AdapterCapabilities = {
  framework: string;
  live_supported: boolean;
  replay_supported: boolean;
  native_available: boolean;
  notes: string[];
};

export type NormalizedAdapterError = {
  framework: string;
  error_type: string;
  message: string;
  retryable: boolean;
  raw: Record<string, unknown>;
};

export type ChaosAction = {
  kind: string;
  params: Record<string, unknown>;
};

export type ChaosProfile = {
  id: string;
  target_phase: "plan" | "submit" | "runtime" | "poll" | "verify";
  actions: ChaosAction[];
  probability: number;
  seed: number;
  recovery_expectation: "not_applicable" | "should_recover" | "expected_failure";
};

export type PlanContext = {
  scenario_id: string;
  framework: string;
  model_profile: ModelProfile;
  prompt_pack: PromptPack;
  seed: number;
  capabilities: AdapterCapabilities;
  chaos_profile: ChaosProfile;
  scenario_input: Record<string, unknown>;
  workspace_dir: string;
  mode: RunMode;
};

export type StandardPlan = {
  plan_id: string;
  scenario_id: string;
  framework: string;
  mode: RunMode;
  stages: PlanStage[];
  schema_version: string;
  raw_trace_ref?: string;
  normalization_warnings: string[];
  annotations: Record<string, string>;
};

export type ScenarioExpected = {
  checks: Record<string, unknown>;
};

export type ScenarioSpec = {
  id: string;
  description: string;
  seed: number;
  input: Record<string, unknown>;
  prompt_pack: PromptPack;
  expected: ScenarioExpected;
  verifier_ref: string;
  allowed_chaos: string[];
  fixtures_dir: string;
  scenario_dir: string;
};

export type TimelineEvent = {
  run_id: string;
  timestamp: string;
  phase: string;
  framework: string;
  scenario_id: string;
  stage_id?: string;
  task_id?: string;
  event_type: string;
  status: string;
  input_ref?: string;
  output_ref?: string;
  error_code?: string;
  metadata: Record<string, unknown>;
};

export type TaskSnapshot = {
  task_id: string;
  status: string;
  raw: Record<string, unknown>;
};

export type StageExecutionResult = {
  stage_id: string;
  submission: Record<string, unknown>;
  task_ids: string[];
  tasks: TaskSnapshot[];
  metrics_snapshots: Record<string, unknown>[];
  success: boolean;
  error?: string;
};

export type VerifierResult = {
  passed: boolean;
  reasons: string[];
  details: Record<string, unknown>;
};

export type RunMetrics = {
  plan_validity: number;
  submit_accept_rate: number;
  scenario_success: number;
  recovery_success: number;
  wall_time_ms: number;
  stage_count: number;
  task_count: number;
  retry_count: number;
  timeout_count: number;
  runtime_failure_count: number;
  invalid_action_count: number;
  determinism_drift: number;
  artifact_hash_match: number;
};

export type ArtifactManifest = {
  run_dir: string;
  plan_path: string;
  timeline_path: string;
  snapshot_path: string;
  adapter_trace_path: string;
  result_path: string;
  summary_path: string;
};

export type BenchmarkResult = {
  run_id: string;
  framework: string;
  scenario_id: string;
  mode: RunMode;
  chaos_profile: string;
  metrics: RunMetrics;
  verdict: VerifierResult;
  artifact_manifest: ArtifactManifest;
};

export type BenchmarkRunRequest = {
  frameworks: string[];
  scenarios: string[];
  mode: RunMode;
  chaos_profiles: string[];
  model_profile: ModelProfile;
  repetitions: number;
};

export function defaultSubmitPolicy(): SubmitPolicy {
  return { poll_interval_ms: 500, max_attempts: 120, stop_on_failure: true };
}

export function defaultModelProfile(overrides: Partial<ModelProfile> = {}): ModelProfile {
  return {
    provider: "mock",
    model: "mock-reliability-planner",
    temperature: 0,
    max_tokens: 1200,
    timeout_ms: 60000,
    seed: 7,
    ...overrides,
  };
}

export function defaultAdapterCapabilities(framework: string, overrides: Partial<AdapterCapabilities> = {}): AdapterCapabilities {
  return {
    framework,
    live_supported: true,
    replay_supported: true,
    native_available: false,
    notes: [],
    ...overrides,
  };
}

export function normalizeTask(raw: Record<string, unknown>): ExecGoTask {
  return {
    id: String(raw.id),
    type: String(raw.type),
    params: objectValue(raw.params),
    input: raw.input === undefined ? undefined : objectValue(raw.input),
    tool_name: raw.tool_name === undefined ? undefined : String(raw.tool_name),
    execution_category: raw.execution_category === undefined ? undefined : String(raw.execution_category),
    depends_on: arrayValue(raw.depends_on).map(String),
    retry: raw.retry === undefined ? 0 : Number(raw.retry),
    timeout: raw.timeout === undefined || raw.timeout === null ? undefined : Number(raw.timeout),
    annotations: stringRecord(raw.annotations),
  };
}

export function normalizeTaskGraph(raw: Record<string, unknown>): ExecGoTaskGraph {
  const tasks = arrayValue(raw.tasks).map((item) => normalizeTask(objectValue(item)));
  validateTaskGraph({ tasks });
  return { tasks };
}

export function validateTaskGraph(graph: ExecGoTaskGraph): void {
  if (graph.tasks.length === 0) {
    throw new Error("task graph is empty");
  }
  const ids = graph.tasks.map((task) => task.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("task ids must be unique inside a stage");
  }
  const known = new Set(ids);
  for (const task of graph.tasks) {
    for (const dep of task.depends_on) {
      if (!known.has(dep)) {
        throw new Error(`task ${task.id} depends on unknown task ${dep}`);
      }
      if (dep === task.id) {
        throw new Error(`task ${task.id} cannot depend on itself`);
      }
    }
  }
}

export function normalizePlanStage(raw: Record<string, unknown>): PlanStage {
  return {
    stage_id: String(raw.stage_id),
    task_graph: normalizeTaskGraph(objectValue(raw.task_graph)),
    bindings: arrayValue(raw.bindings).map((item) => {
      const binding = objectValue(item);
      return {
        source_task_id: String(binding.source_task_id),
        source_path: String(binding.source_path),
        target_task_id: String(binding.target_task_id),
        target_param_path: String(binding.target_param_path),
        required: binding.required === undefined ? true : Boolean(binding.required),
      };
    }),
    submit_policy: normalizeSubmitPolicy(raw.submit_policy),
    expected_artifacts: arrayValue(raw.expected_artifacts).map(String),
    annotations: stringRecord(raw.annotations),
  };
}

export function normalizeSubmitPolicy(raw: unknown): SubmitPolicy {
  const policy = objectValue(raw);
  return {
    poll_interval_ms: policy.poll_interval_ms === undefined ? 500 : Number(policy.poll_interval_ms),
    max_attempts: policy.max_attempts === undefined ? 120 : Number(policy.max_attempts),
    stop_on_failure: policy.stop_on_failure === undefined ? true : Boolean(policy.stop_on_failure),
  };
}

export function normalizeStandardPlan(raw: unknown, overrides: Partial<StandardPlan> = {}): StandardPlan {
  const payload = objectValue(raw);
  return {
    plan_id: String(payload.plan_id),
    scenario_id: String(payload.scenario_id),
    framework: String(payload.framework),
    mode: asRunMode(payload.mode),
    stages: arrayValue(payload.stages).map((item) => normalizePlanStage(objectValue(item))),
    schema_version: payload.schema_version === undefined ? STANDARD_PLAN_SCHEMA_VERSION : String(payload.schema_version),
    raw_trace_ref: payload.raw_trace_ref === undefined || payload.raw_trace_ref === null ? undefined : String(payload.raw_trace_ref),
    normalization_warnings: arrayValue(payload.normalization_warnings).map(String),
    annotations: stringRecord(payload.annotations),
    ...overrides,
  };
}

export function asRunMode(value: unknown): RunMode {
  if (value === "live" || value === "replay") {
    return value;
  }
  throw new Error(`invalid run mode: ${String(value)}`);
}

export function objectValue(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function stringRecord(value: unknown): Record<string, string> {
  const raw = objectValue(value);
  const output: Record<string, string> = {};
  for (const [key, item] of Object.entries(raw)) {
    output[key] = String(item);
  }
  return output;
}
