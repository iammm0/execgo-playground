from __future__ import annotations

from importlib.util import find_spec

from ..models import AdapterCapabilities, PlanContext, StandardPlan
from .base import BaseAdapter


class AutoGenAdapter(BaseAdapter):
    framework = "autogen"

    def capabilities(self) -> AdapterCapabilities:
        native = find_spec("autogen") is not None or find_spec("pyautogen") is not None
        notes = ["Uses a normalized AutoGen-style conversation trace."]
        if not native:
            notes.append("autogen package not installed; using platform fallback planner.")
        return AdapterCapabilities(framework=self.framework, native_available=native, notes=notes)

    def plan(self, context: PlanContext) -> StandardPlan:
        return self._plan_from_provider(
            context,
            {
                "agents": ["planner", "reviewer", "executor"],
                "conversation": [
                    {"speaker": "planner", "intent": "draft_standard_plan"},
                    {"speaker": "reviewer", "intent": "check_execgo_constraints"},
                    {"speaker": "executor", "intent": "emit_standard_plan"},
                ],
            },
        )

    def replay(self, trace: dict, context: PlanContext) -> StandardPlan:
        self._last_trace = trace
        if "plan" in trace:
            return StandardPlan.model_validate(trace["plan"]).model_copy(update={"framework": self.framework, "mode": "replay"})
        return self._load_reference_plan(context).model_copy(update={"framework": self.framework, "mode": "replay"})
