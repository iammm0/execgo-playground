from __future__ import annotations

from importlib.util import find_spec

from ..models import AdapterCapabilities, PlanContext, StandardPlan
from .base import BaseAdapter


class CrewAIAdapter(BaseAdapter):
    framework = "crewai"

    def capabilities(self) -> AdapterCapabilities:
        native = find_spec("crewai") is not None
        notes = ["Uses a normalized CrewAI-style crew/task trace."]
        if not native:
            notes.append("crewai package not installed; using platform fallback planner.")
        return AdapterCapabilities(framework=self.framework, native_available=native, notes=notes)

    def plan(self, context: PlanContext) -> StandardPlan:
        return self._plan_from_provider(
            context,
            {
                "crew": {"name": "execgo-reliability-bench", "process": "sequential"},
                "agents": ["planner", "normalizer", "submitter"],
                "tasks": ["draft execgo plan", "normalize stages", "emit standard plan"],
            },
        )

    def replay(self, trace: dict, context: PlanContext) -> StandardPlan:
        self._last_trace = trace
        if "plan" in trace:
            return StandardPlan.model_validate(trace["plan"]).model_copy(update={"framework": self.framework, "mode": "replay"})
        return self._load_reference_plan(context).model_copy(update={"framework": self.framework, "mode": "replay"})
