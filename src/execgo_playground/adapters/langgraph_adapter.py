from __future__ import annotations

from importlib.util import find_spec

from ..models import AdapterCapabilities, PlanContext, StandardPlan
from .base import BaseAdapter


class LangGraphAdapter(BaseAdapter):
    framework = "langgraph"

    def capabilities(self) -> AdapterCapabilities:
        native = find_spec("langgraph") is not None
        notes = ["Uses a normalized LangGraph-style state trace."]
        if not native:
            notes.append("langgraph package not installed; using platform fallback planner.")
        return AdapterCapabilities(framework=self.framework, native_available=native, notes=notes)

    def plan(self, context: PlanContext) -> StandardPlan:
        return self._plan_from_provider(
            context,
            {
                "nodes": ["plan", "normalize", "emit"],
                "edges": [["plan", "normalize"], ["normalize", "emit"]],
                "state_keys": ["objective", "draft_plan", "normalized_plan"],
            },
        )

    def replay(self, trace: dict, context: PlanContext) -> StandardPlan:
        self._last_trace = trace
        if "plan" in trace:
            return StandardPlan.model_validate(trace["plan"]).model_copy(update={"framework": self.framework, "mode": "replay"})
        return self._load_reference_plan(context).model_copy(update={"framework": self.framework, "mode": "replay"})
