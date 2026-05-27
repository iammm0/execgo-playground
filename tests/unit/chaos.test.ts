import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { ChaosEngine, loadChaosProfile } from "../../src/execgo_playground/chaos/index.js";
import { normalizeStandardPlan } from "../../src/execgo_playground/models.js";
import { TimelineRecorder } from "../../src/execgo_playground/observability/index.js";
import { loadScenario } from "../../src/execgo_playground/scenarios/index.js";

const dummyHarness = {
  restartService() {},
  killService() {},
  updateServiceResources() {},
  configureFixtureMode() {},
  resetFixtureMode() {},
};

test("invalid tool profile mutates first task", async () => {
  const scenario = await loadScenario("codegen_exec");
  const plan = normalizeStandardPlan(scenario.input.reference_plan);
  const engine = new ChaosEngine(
    dummyHarness,
    new TimelineRecorder(path.join(tmpdir(), "timeline.jsonl")),
    "run-1",
    "langgraph",
    scenario.id,
  );
  const mutated = engine.applyPlanPhase(plan, await loadChaosProfile("invalid_tool"));
  assert.equal(mutated.stages[0].task_graph.tasks[0].type, "hallucinated-tool");
});
