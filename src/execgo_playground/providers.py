from __future__ import annotations

import json
import os
import urllib.request
from typing import Any, Protocol

from .models import PlanContext, StandardPlan


class PlanningProvider(Protocol):
    def generate_plan(self, context: PlanContext) -> tuple[StandardPlan, dict[str, Any]]:
        ...


class MockPlanningProvider:
    def generate_plan(self, context: PlanContext) -> tuple[StandardPlan, dict[str, Any]]:
        plan = StandardPlan.model_validate(context.scenario_input["reference_plan"]).model_copy(
            update={"framework": context.framework, "mode": context.mode}
        )
        return plan, {
            "provider": "mock",
            "model": context.model_profile.model,
            "source": "scenario.reference_plan",
        }


class OpenAICompatiblePlanningProvider:
    def generate_plan(self, context: PlanContext) -> tuple[StandardPlan, dict[str, Any]]:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is required for openai-compatible live planning")
        base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com").rstrip("/")
        messages = [
            {"role": "system", "content": context.prompt_pack.system_prompt},
            {
                "role": "user",
                "content": "\n\n".join(
                    [
                        context.prompt_pack.user_prompt,
                        context.prompt_pack.constraints_prompt,
                        "Return only JSON matching the StandardPlan schema. Do not wrap it in Markdown.",
                        f"Scenario input: {json.dumps(context.scenario_input, ensure_ascii=False)}",
                    ]
                ),
            },
        ]
        body = {
            "model": context.model_profile.model,
            "messages": messages,
            "temperature": context.model_profile.temperature,
            "max_tokens": context.model_profile.max_tokens,
        }
        request = urllib.request.Request(
            f"{base_url}/v1/chat/completions",
            data=json.dumps(body).encode("utf-8"),
            method="POST",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
        )
        with urllib.request.urlopen(request, timeout=context.model_profile.timeout_ms / 1000) as response:
            payload = json.loads(response.read().decode("utf-8"))
        content = payload["choices"][0]["message"]["content"]
        plan = StandardPlan.model_validate(json.loads(content)).model_copy(
            update={"framework": context.framework, "mode": context.mode}
        )
        return plan, {
            "provider": "openai-compatible",
            "base_url": base_url,
            "model": context.model_profile.model,
            "response_id": payload.get("id"),
            "usage": payload.get("usage", {}),
        }


def get_provider(provider_name: str) -> PlanningProvider:
    normalized = provider_name.lower().replace("_", "-")
    if normalized == "mock":
        return MockPlanningProvider()
    if normalized in {"openai", "openai-compatible"}:
        return OpenAICompatiblePlanningProvider()
    raise ValueError(f"unknown planning provider: {provider_name}")
