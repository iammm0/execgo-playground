from __future__ import annotations

from pathlib import Path
from typing import Any

from ..models import ArtifactManifest
from ..utils import ensure_dir, write_json, write_text


class ArtifactManager:
    def __init__(self, root_dir: str | Path, run_id: str) -> None:
        self.root_dir = ensure_dir(root_dir)
        self.run_dir = ensure_dir(Path(root_dir) / run_id)

    def path(self, name: str) -> Path:
        names = {
            "plan": "plan.json",
            "timeline": "timeline.jsonl",
            "snapshots": "execgo_snapshots.jsonl",
            "trace": "adapter_trace.json",
            "result": "result.json",
            "summary": "summary.md",
        }
        return self.run_dir / names[name]

    def write_json(self, name: str, data: Any) -> Path:
        return write_json(self.path(name), data)

    def write_text(self, name: str, content: str) -> Path:
        return write_text(self.path(name), content)

    def manifest(self) -> ArtifactManifest:
        return ArtifactManifest(
            run_dir=str(self.run_dir),
            plan_path=str(self.path("plan")),
            timeline_path=str(self.path("timeline")),
            snapshot_path=str(self.path("snapshots")),
            adapter_trace_path=str(self.path("trace")),
            result_path=str(self.path("result")),
            summary_path=str(self.path("summary")),
        )
