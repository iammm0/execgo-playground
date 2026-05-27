import assert from "node:assert/strict";
import test from "node:test";
import { loadScenario } from "../../src/execgo_playground/scenarios/index.js";
import { verifyLongChainDag } from "../../src/execgo_playground/scenarios/verifiers.js";

test("verify long_chain_dag prefers result output when runtime snapshot is stale", async () => {
  const spec = await loadScenario("long_chain_dag");
  const verdict = verifyLongChainDag(spec, {
    workspace_dir: "/tmp/workspace",
    stage_results: [],
    tasks: [
      {
        logical_id: "join-final",
        compiled_id: "compiled-join-final",
        raw: {
          result: {
            output: {
              lineage: ["branch-c", "branch-d", "branch-e", "seed-a", "seed-b"],
              summary: { status: "success" },
            },
          },
          runtime: {
            status: "running",
            output: {
              status: "running",
            },
          },
        },
      },
    ],
  });

  assert.equal(verdict.passed, true);
  assert.deepEqual(verdict.details.lineage, ["branch-c", "branch-d", "branch-e", "seed-a", "seed-b"]);
});
