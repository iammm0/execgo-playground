from __future__ import annotations

from execgo_playground.benchmarks.metrics import compute_metrics
from execgo_playground.models import RunMetrics, StageExecutionResult, StandardPlan, TaskSnapshot, VerifierResult
from execgo_playground.scenarios import load_scenario


def test_compute_metrics_counts_retries_and_failures() -> None:
    plan = StandardPlan.model_validate(load_scenario("codegen_exec").input["reference_plan"])
    stage = StageExecutionResult(
        stage_id="verify",
        submission={"accepted": 1},
        task_ids=["task-1"],
        tasks=[
            TaskSnapshot(
                task_id="task-1",
                status="failed",
                raw={"runtime": {"attempt": 3, "error": {"code": "timeout"}}},
            )
        ],
        metrics_snapshots=[],
        success=False,
    )
    metrics = compute_metrics(
        plan=plan,
        stage_results=[stage],
        verdict=VerifierResult(passed=False, reasons=["boom"]),
        wall_time_ms=120,
        artifact_hash_match=False,
        recovery_expected=True,
    )
    assert isinstance(metrics, RunMetrics)
    assert metrics.retry_count == 2
    assert metrics.timeout_count == 1
    assert metrics.runtime_failure_count == 1
