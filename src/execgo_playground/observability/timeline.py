from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..models import TimelineEvent
from ..utils import ensure_dir


class TimelineRecorder:
    def __init__(self, output_path: str | Path) -> None:
        self.output_path = Path(output_path)
        ensure_dir(self.output_path.parent)
        self._events: list[TimelineEvent] = []

    def record(
        self,
        *,
        run_id: str,
        framework: str,
        scenario_id: str,
        phase: str,
        event_type: str,
        status: str,
        stage_id: str | None = None,
        task_id: str | None = None,
        input_ref: str | None = None,
        output_ref: str | None = None,
        error_code: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        self._events.append(
            TimelineEvent(
                run_id=run_id,
                timestamp=datetime.now(timezone.utc),
                phase=phase,
                framework=framework,
                scenario_id=scenario_id,
                stage_id=stage_id,
                task_id=task_id,
                event_type=event_type,
                status=status,
                input_ref=input_ref,
                output_ref=output_ref,
                error_code=error_code,
                metadata=metadata or {},
            )
        )

    def flush(self) -> Path:
        with self.output_path.open("w", encoding="utf-8") as handle:
            for event in self._events:
                handle.write(event.model_dump_json() + "\n")
        return self.output_path

    @property
    def events(self) -> list[TimelineEvent]:
        return list(self._events)
