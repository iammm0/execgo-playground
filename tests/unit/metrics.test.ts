import assert from "node:assert/strict";
import test from "node:test";
import { computeMetrics } from "../../src/execgo_playground/benchmarks/index.js";
import { normalizeStandardPlan, type StageExecutionResult, type VerifierResult } from "../../src/execgo_playground/models.js";
import { loadScenario } from "../../src/execgo_playground/scenarios/index.js";

test("compute metrics counts retries and failures", async () => {
  const plan = normalizeStandardPlan((await loadScenario("codegen_exec")).input.reference_plan);
  const stage: StageExecutionResult = {
    stage_id: "verify",
    submission: { accepted: 1 },
    task_ids: ["task-1"],
    tasks: [
      {
        task_id: "task-1",
        status: "failed",
        raw: { runtime: { attempt: 3, error: { code: "timeout" } } },
      },
    ],
    metrics_snapshots: [],
    success: false,
  };
  const verdict: VerifierResult = { passed: false, reasons: ["boom"], details: {} };
  const metrics = computeMetrics({
    plan,
    stageResults: [stage],
    verdict,
    wallTimeMs: 120,
    artifactHashMatch: false,
    recoveryExpected: true,
  });
  assert.equal(metrics.retry_count, 2);
  assert.equal(metrics.timeout_count, 1);
  assert.equal(metrics.runtime_failure_count, 1);
});
