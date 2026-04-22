from __future__ import annotations

import json

from execgo_playground.observability.timeline import TimelineRecorder


def test_timeline_flushes_jsonl(tmp_path) -> None:
    path = tmp_path / "timeline.jsonl"
    recorder = TimelineRecorder(path)
    recorder.record(
        run_id="run-1",
        framework="langgraph",
        scenario_id="codegen_exec",
        phase="plan",
        event_type="run_started",
        status="started",
    )
    recorder.flush()
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]
    assert rows[0]["run_id"] == "run-1"
    assert rows[0]["event_type"] == "run_started"
