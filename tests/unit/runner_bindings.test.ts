import assert from "node:assert/strict";
import test from "node:test";
import { DockerHarness } from "../../src/execgo_playground/harness/index.js";
import { normalizePlanStage } from "../../src/execgo_playground/models.js";
import { ExperimentRunner } from "../../src/execgo_playground/runner.js";
import { loadScenario } from "../../src/execgo_playground/scenarios/index.js";

test("runner resolves binding into env string", async () => {
  const runner = new ExperimentRunner(new DockerHarness());
  const scenario = await loadScenario("multi_step_agent");
  const plan = scenario.input.reference_plan as { stages: unknown[] };
  const secondStage = normalizePlanStage(plan.stages[1] as Record<string, unknown>);
  const lookup = {
    "collect-evidence": {
      compiled_id: "compiled-1",
      task: {
        runtime: {
          output: {
            output: {
              items: [{ kind: "observation", value: "ok" }],
            },
          },
        },
      },
    },
  };

  const resolved = runner.resolveStage(secondStage, lookup);
  const input = resolved.task_graph.tasks[0].input as { execution: { env: { EVIDENCE_JSON: string } } };
  const payload = JSON.parse(input.execution.env.EVIDENCE_JSON) as { items: Array<{ value: string }> };
  assert.equal(payload.items[0].value, "ok");
});
