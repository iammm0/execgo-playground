from __future__ import annotations

from execgo_playground.adapters import get_adapter
from execgo_playground.chaos import load_chaos_profile
from execgo_playground.models import ModelProfile, PlanContext
from execgo_playground.scenarios import load_scenario


def build_context():
    scenario = load_scenario("multi_step_agent")
    adapter = get_adapter("langgraph")
    return adapter, PlanContext(
        scenario_id=scenario.id,
        framework="langgraph",
        model_profile=ModelProfile(provider="mock"),
        prompt_pack=scenario.prompt_pack,
        seed=scenario.seed,
        capabilities=adapter.capabilities(),
        chaos_profile=load_chaos_profile("none"),
        scenario_input=scenario.input,
        workspace_dir="/tmp/workspace",
        mode="live",
    )


def test_live_plan_uses_mock_provider_reference_plan() -> None:
    adapter, context = build_context()
    plan = adapter.plan(context)
    assert plan.framework == "langgraph"
    assert len(plan.stages) == 3
    assert adapter.last_trace["provider_trace"]["provider"] == "mock"


def test_replay_returns_standard_plan() -> None:
    adapter, context = build_context()
    plan = adapter.replay({"plan": context.scenario_input["reference_plan"]}, context)
    assert plan.mode == "replay"
    assert plan.stages[0].stage_id == "collect"
