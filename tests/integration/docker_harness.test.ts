import assert from "node:assert/strict";
import test from "node:test";
import { defaultModelProfile } from "../../src/execgo_playground/models.js";
import { ExperimentRunner } from "../../src/execgo_playground/runner.js";
import { envFlag } from "../../src/execgo_playground/utils.js";

test("replay smoke with docker harness", { skip: !envFlag("EXECGO_PLAYGROUND_RUN_DOCKER_TESTS") }, async () => {
  const runner = new ExperimentRunner();
  const result = await runner.run({
    framework: "langgraph",
    scenarioId: "codegen_exec",
    mode: "replay",
    chaosProfileId: "none",
    modelProfile: defaultModelProfile({ provider: "mock" }),
  });
  assert.equal(result.verdict.passed, true);
});
