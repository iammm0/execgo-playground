from __future__ import annotations

import json

from execgo_playground.models import PlanStage
from execgo_playground.harness import DockerHarness
from execgo_playground.runner import ExperimentRunner
from execgo_playground.scenarios import load_scenario


def test_runner_resolves_binding_into_env_string() -> None:
    runner = ExperimentRunner(DockerHarness())
    scenario = load_scenario("multi_step_agent")
    plan = scenario.input["reference_plan"]
    second_stage = PlanStage.model_validate(plan["stages"][1])

    lookup = {
        "collect-evidence": {
            "compiled_id": "compiled-1",
            "task": {
                "runtime": {
                    "output": {
                        "output": {
                            "items": [
                                {"kind": "observation", "value": "ok"}
                            ]
                        }
                    }
                }
            },
        }
    }

    resolved = runner._resolve_stage(second_stage, lookup)
    env_value = resolved.task_graph.tasks[0].input["execution"]["env"]["EVIDENCE_JSON"]
    payload = json.loads(env_value)
    assert payload["items"][0]["value"] == "ok"
