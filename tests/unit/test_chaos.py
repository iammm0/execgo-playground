from __future__ import annotations

from execgo_playground.chaos import load_chaos_profile
from execgo_playground.chaos.engine import ChaosEngine
from execgo_playground.observability.timeline import TimelineRecorder
from execgo_playground.scenarios import load_scenario
from execgo_playground.models import StandardPlan


class DummyHarness:
    def restart_service(self, _service: str) -> None:
        return

    def kill_service(self, _service: str) -> None:
        return

    def update_service_resources(self, _service: str, **_kwargs) -> None:
        return

    def configure_fixture_mode(self, **_kwargs) -> None:
        return

    def reset_fixture_mode(self) -> None:
        return


def test_invalid_tool_profile_mutates_first_task(tmp_path) -> None:
    scenario = load_scenario("codegen_exec")
    plan = StandardPlan.model_validate(scenario.input["reference_plan"])
    engine = ChaosEngine(DummyHarness(), TimelineRecorder(tmp_path / "timeline.jsonl"), "run-1", "langgraph", scenario.id)
    mutated = engine.apply_plan_phase(plan, load_chaos_profile("invalid_tool"))
    assert mutated.stages[0].task_graph.tasks[0].type == "hallucinated-tool"
