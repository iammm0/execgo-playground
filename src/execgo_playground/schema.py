from __future__ import annotations

from pathlib import Path

from .models import (
    BenchmarkResult,
    BenchmarkRunRequest,
    ChaosProfile,
    ScenarioSpec,
    StandardPlan,
    TimelineEvent,
)
from .utils import ensure_dir, write_json


SCHEMA_MODELS = {
    "benchmark-result.schema.json": BenchmarkResult,
    "benchmark-run-request.schema.json": BenchmarkRunRequest,
    "chaos-profile.schema.json": ChaosProfile,
    "scenario.schema.json": ScenarioSpec,
    "standard-plan.schema.json": StandardPlan,
    "timeline-event.schema.json": TimelineEvent,
}


def export_schemas(output_dir: str | Path) -> list[Path]:
    out = ensure_dir(output_dir)
    written: list[Path] = []
    for filename, model in SCHEMA_MODELS.items():
        path = out / filename
        write_json(path, model.model_json_schema())
        written.append(path)
    return written
