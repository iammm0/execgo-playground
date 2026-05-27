import type { RunMetrics, StageExecutionResult, StandardPlan, TaskSnapshot, VerifierResult } from "../models.js";

function runtimePayload(task: TaskSnapshot): Record<string, unknown> {
  const rawRuntime = task.raw.runtime;
  return rawRuntime && typeof rawRuntime === "object" && !Array.isArray(rawRuntime) ? (rawRuntime as Record<string, unknown>) : {};
}

export function computeMetrics(input: {
  plan: StandardPlan;
  stageResults: StageExecutionResult[];
  verdict: VerifierResult;
  wallTimeMs: number;
  artifactHashMatch: boolean;
  recoveryExpected: boolean;
}): RunMetrics {
  const allTasks = input.stageResults.flatMap((stage) => stage.tasks);
  const runtimeFailures = allTasks.filter((task) => task.status === "failed").length;
  let retries = 0;
  let timeouts = 0;
  for (const task of allTasks) {
    const runtime = runtimePayload(task);
    retries += Math.max(0, Number(runtime.attempt ?? 1) - 1);
    const error = runtime.error && typeof runtime.error === "object" ? (runtime.error as Record<string, unknown>) : {};
    if (error.code === "timeout") {
      timeouts += 1;
    }
  }

  const accepted = input.stageResults.reduce((sum, stage) => sum + Number(stage.submission.accepted ?? 0), 0);
  const expectedAccepts = input.stageResults.reduce((sum, stage) => sum + stage.task_ids.length, 0) || 1;
  let invalidActions = input.plan.normalization_warnings.length;
  if (input.stageResults.some((stage) => stage.error)) {
    invalidActions += 1;
  }

  return {
    plan_validity: 1,
    submit_accept_rate: accepted / expectedAccepts,
    scenario_success: input.verdict.passed ? 1 : 0,
    recovery_success: (input.verdict.passed && input.recoveryExpected) || !input.recoveryExpected ? 1 : 0,
    wall_time_ms: input.wallTimeMs,
    stage_count: input.plan.stages.length,
    task_count: allTasks.length,
    retry_count: retries,
    timeout_count: timeouts,
    runtime_failure_count: runtimeFailures,
    invalid_action_count: invalidActions,
    determinism_drift: 0,
    artifact_hash_match: input.artifactHashMatch ? 1 : 0,
  };
}
