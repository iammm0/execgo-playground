from __future__ import annotations

import json
from abc import ABC, abstractmethod
from typing import Any

from ..models import AdapterCapabilities, NormalizedAdapterError, PlanContext, StandardPlan
from ..providers import get_provider


class BaseAdapter(ABC):
    framework: str

    def __init__(self) -> None:
        self._last_trace: dict[str, Any] = {}

    @property
    def last_trace(self) -> dict[str, Any]:
        return self._last_trace

    @abstractmethod
    def capabilities(self) -> AdapterCapabilities:
        raise NotImplementedError

    @abstractmethod
    def plan(self, context: PlanContext) -> StandardPlan:
        raise NotImplementedError

    @abstractmethod
    def replay(self, trace: dict[str, Any], context: PlanContext) -> StandardPlan:
        raise NotImplementedError

    def normalize_error(self, exc: Exception) -> NormalizedAdapterError:
        return NormalizedAdapterError(
            framework=self.framework,
            error_type=exc.__class__.__name__,
            message=str(exc),
            retryable=False,
            raw={"repr": repr(exc)},
        )

    def _load_reference_plan(self, context: PlanContext) -> StandardPlan:
        return StandardPlan.model_validate(context.scenario_input["reference_plan"])

    def _plan_from_provider(self, context: PlanContext, structure: dict[str, Any]) -> StandardPlan:
        provider = get_provider(context.model_profile.provider)
        plan, provider_trace = provider.generate_plan(context)
        self._last_trace = {
            "framework": self.framework,
            "mode": context.mode,
            "scenario_id": context.scenario_id,
            "seed": context.seed,
            "structure": structure,
            "provider_trace": provider_trace,
            "normalized_plan": json.loads(plan.model_dump_json()),
        }
        return plan.model_copy(update={"framework": self.framework, "mode": context.mode})

    def _trace_blob(self, context: PlanContext, structure: dict[str, Any]) -> dict[str, Any]:
        trace = {
            "framework": self.framework,
            "mode": context.mode,
            "scenario_id": context.scenario_id,
            "seed": context.seed,
            "structure": structure,
            "normalized_plan": json.loads(self._load_reference_plan(context).model_dump_json()),
        }
        self._last_trace = trace
        return trace
