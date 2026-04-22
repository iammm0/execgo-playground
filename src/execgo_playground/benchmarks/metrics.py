from __future__ import annotations

from typing import Any

from ..models import RunMetrics, StandardPlan, StageExecutionResult, VerifierResult


def compute_metrics(
    *,
    plan: StandardPlan,
    stage_results: list[StageExecutionResult],
    verdict: VerifierResult,
    wall_time_ms: int,
    artifact_hash_match: bool,
    recovery_expected: bool,
) -> RunMetrics:
    all_tasks = [task for stage in stage_results for task in stage.tasks]
    runtime_failures = sum(1 for task in all_tasks if task.status == "failed")
    retries = 0
    timeouts = 0
    for task in all_tasks:
        runtime = task.raw.get("runtime") or {}
        retries += max(0, int(runtime.get("attempt", 1)) - 1)
        error = runtime.get("error") or {}
        if error.get("code") == "timeout":
            timeouts += 1

    accepted = sum(int(stage.submission.get("accepted", 0)) for stage in stage_results)
    expected_accepts = sum(len(stage.task_ids) for stage in stage_results) or 1
    invalid_actions = len(plan.normalization_warnings)
    if any(stage.error for stage in stage_results):
        invalid_actions += 1

    return RunMetrics(
        plan_validity=1.0,
        submit_accept_rate=accepted / expected_accepts,
        scenario_success=1.0 if verdict.passed else 0.0,
        recovery_success=1.0 if (verdict.passed and recovery_expected) or not recovery_expected else 0.0,
        wall_time_ms=wall_time_ms,
        stage_count=len(plan.stages),
        task_count=len(all_tasks),
        retry_count=retries,
        timeout_count=timeouts,
        runtime_failure_count=runtime_failures,
        invalid_action_count=invalid_actions,
        determinism_drift=0.0,
        artifact_hash_match=1.0 if artifact_hash_match else 0.0,
    )
