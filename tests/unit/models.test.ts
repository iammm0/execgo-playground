import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTaskGraph } from "../../src/execgo_playground/models.js";

test("task graph rejects unknown dependency", () => {
  assert.throws(
    () =>
      normalizeTaskGraph({
        tasks: [
          { id: "a", type: "runtime" },
          { id: "b", type: "runtime", depends_on: ["missing"] },
        ],
      }),
    /depends on unknown task/,
  );
});

test("task graph accepts valid dag", () => {
  const graph = normalizeTaskGraph({
    tasks: [
      { id: "a", type: "runtime" },
      { id: "b", type: "runtime", depends_on: ["a"] },
    ],
  });
  assert.equal(graph.tasks.length, 2);
});
