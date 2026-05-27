import assert from "node:assert/strict";
import test from "node:test";
import { getAdapter } from "../../src/execgo_playground/adapters/index.js";
import { loadChaosProfile } from "../../src/execgo_playground/chaos/index.js";
import { defaultModelProfile, type PlanContext } from "../../src/execgo_playground/models.js";
import { loadScenario } from "../../src/execgo_playground/scenarios/index.js";

async function buildContext(): Promise<[ReturnType<typeof getAdapter>, PlanContext]> {
  const scenario = await loadScenario("multi_step_agent");
  const adapter = getAdapter("langgraph");
  return [
    adapter,
    {
      scenario_id: scenario.id,
      framework: "langgraph",
      model_profile: defaultModelProfile({ provider: "mock" }),
      prompt_pack: scenario.prompt_pack,
      seed: scenario.seed,
      capabilities: adapter.capabilities(),
      chaos_profile: await loadChaosProfile("none"),
      scenario_input: scenario.input,
      workspace_dir: "/tmp/workspace",
      mode: "live",
    },
  ];
}

test("live plan uses mock provider reference plan", async () => {
  const [adapter, context] = await buildContext();
  const plan = await adapter.plan(context);
  assert.equal(plan.framework, "langgraph");
  assert.equal(plan.stages.length, 3);
  assert.equal((adapter.lastTrace.provider_trace as Record<string, unknown>).provider, "mock");
});

test("replay returns standard plan", async () => {
  const [adapter, context] = await buildContext();
  const plan = adapter.replay({ plan: context.scenario_input.reference_plan }, context);
  assert.equal(plan.mode, "replay");
  assert.equal(plan.stages[0].stage_id, "collect");
});
