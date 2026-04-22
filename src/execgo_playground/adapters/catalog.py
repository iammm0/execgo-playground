from __future__ import annotations

from .autogen_adapter import AutoGenAdapter
from .crewai_adapter import CrewAIAdapter
from .langgraph_adapter import LangGraphAdapter


def list_adapters() -> dict[str, type]:
    return {
        "langgraph": LangGraphAdapter,
        "crewai": CrewAIAdapter,
        "autogen": AutoGenAdapter,
    }


def get_adapter(name: str):
    catalog = list_adapters()
    try:
        return catalog[name.lower()]()
    except KeyError as exc:
        raise ValueError(f"unknown adapter {name}") from exc
