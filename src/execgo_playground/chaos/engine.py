from __future__ import annotations

import copy
import random
from typing import Any

from ..models import ChaosProfile, PlanStage, StandardPlan
from ..observability.timeline import TimelineRecorder
from ..utils import deep_set


class ChaosEngine:
    def __init__(self, harness, timeline: TimelineRecorder, run_id: str, framework: str, scenario_id: str) -> None:
        self.harness = harness
        self.timeline = timeline
        self.run_id = run_id
        self.framework = framework
        self.scenario_id = scenario_id
        self._fixture_dirty = False
        self._runtime_dirty = False

    def apply_plan_phase(self, plan: StandardPlan, profile: ChaosProfile) -> StandardPlan:
        if profile.target_phase != "plan" or not self._should_fire(profile):
            return plan
        mutated = copy.deepcopy(plan)
        for action in profile.actions:
            if action.kind == "inject_invalid_action" and mutated.stages and mutated.stages[0].task_graph.tasks:
                mutated.stages[0].task_graph.tasks[0].type = action.params.get("type", "ghost-tool")
            if action.kind == "inject_bad_dependency" and mutated.stages and mutated.stages[0].task_graph.tasks:
                mutated.stages[0].task_graph.tasks[0].depends_on.append(action.params.get("dependency", "missing-task"))
        self._record("plan", profile.id, "applied")
        return mutated

    def apply_submit_phase(self, stage: PlanStage, profile: ChaosProfile) -> PlanStage:
        if profile.target_phase != "submit" or not self._should_fire(profile):
            return stage
        mutated = copy.deepcopy(stage)
        for action in profile.actions:
            if action.kind == "drop_required_binding" and mutated.bindings:
                mutated.bindings.pop(0)
            if action.kind == "force_timeout_budget" and mutated.task_graph.tasks:
                mutated.task_graph.tasks[0].timeout = int(action.params.get("timeout_ms", 1))
        self._record("submit", profile.id, "applied", stage_id=stage.stage_id)
        return mutated

    def apply_runtime_phase(self, profile: ChaosProfile) -> None:
        if profile.target_phase not in {"runtime", "poll"} or not self._should_fire(profile):
            return
        for action in profile.actions:
            if action.kind == "restart_service":
                self.harness.restart_service(action.params["service"])
                self._runtime_dirty = True
            elif action.kind == "kill_service":
                self.harness.kill_service(action.params["service"])
                self._runtime_dirty = True
            elif action.kind == "resource_pressure":
                self.harness.update_service_resources(
                    action.params["service"],
                    cpus=action.params.get("cpus"),
                    memory=action.params.get("memory"),
                )
                self._runtime_dirty = True
            elif action.kind == "fixture_mode":
                self.harness.configure_fixture_mode(
                    latency_ms=int(action.params.get("latency_ms", 0)),
                    fail_mode=action.params.get("fail_mode", "none"),
                )
                self._fixture_dirty = True
        self._record(profile.target_phase, profile.id, "applied")

    def apply_verify_phase(self, profile: ChaosProfile, verification_payload: dict[str, Any]) -> dict[str, Any]:
        if profile.target_phase != "verify" or not self._should_fire(profile):
            return verification_payload
        mutated = copy.deepcopy(verification_payload)
        for action in profile.actions:
            if action.kind == "drop_verification_field":
                deep_set(mutated, action.params["path"], None)
        self._record("verify", profile.id, "applied")
        return mutated

    def cleanup(self) -> None:
        if self._fixture_dirty:
            self.harness.reset_fixture_mode()
        try:
            if self._runtime_dirty:
                self.harness.restart_service("runtime")
                self.harness.restart_service("execgo")
        except Exception:
            pass

    def _record(self, phase: str, profile_id: str, status: str, stage_id: str | None = None) -> None:
        self.timeline.record(
            run_id=self.run_id,
            framework=self.framework,
            scenario_id=self.scenario_id,
            phase=phase,
            stage_id=stage_id,
            event_type="chaos",
            status=status,
            metadata={"profile": profile_id},
        )

    def _should_fire(self, profile: ChaosProfile) -> bool:
        rng = random.Random(profile.seed or 0)
        return rng.random() <= profile.probability
