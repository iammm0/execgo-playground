from __future__ import annotations

from pathlib import Path
from typing import Any

from ..models import ScenarioSpec, VerifierResult
from ..utils import deep_get, sha256_file


def _task_map(context: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {task["logical_id"]: task for task in context["tasks"]}


def verify_codegen_exec(spec: ScenarioSpec, context: dict[str, Any]) -> VerifierResult:
    task = _task_map(context)["collect-report"]
    payload = task["raw"]
    report = deep_get(payload, "runtime.output.output")
    workspace_file = Path(context["workspace_dir"]) / "template_project" / "math_ops.py"
    actual_hash = sha256_file(workspace_file)
    expected_hash = spec.expected.checks["math_ops_sha256"]
    passed = (
        actual_hash == expected_hash
        and report["tests"]["status"] == "passed"
        and report["tests"]["passed"] >= 2
    )
    return VerifierResult(
        passed=passed,
        reasons=[] if passed else ["codegen_exec verification failed"],
        details={"actual_hash": actual_hash, "expected_hash": expected_hash, "report": report},
    )


def verify_vuln_scan(spec: ScenarioSpec, context: dict[str, Any]) -> VerifierResult:
    task = _task_map(context)["scan-fixtures"]
    report = deep_get(task["raw"], "runtime.output.output")
    findings = report["findings"]
    expected_ids = sorted(spec.expected.checks["finding_ids"])
    actual_ids = sorted(item["id"] for item in findings)
    passed = expected_ids == actual_ids and report["summary"]["high"] == spec.expected.checks["high_count"]
    return VerifierResult(
        passed=passed,
        reasons=[] if passed else ["vulnerability findings do not match expected set"],
        details={"actual_ids": actual_ids, "expected_ids": expected_ids, "report": report},
    )


def verify_multi_step_agent(spec: ScenarioSpec, context: dict[str, Any]) -> VerifierResult:
    task = _task_map(context)["render-summary"]
    report = deep_get(task["raw"], "runtime.output.output")
    passed = (
        report["summary"]["status"] == "success"
        and report["summary"]["items"] == spec.expected.checks["summary_items"]
        and report["evidence_count"] >= spec.expected.checks["minimum_evidence_count"]
    )
    return VerifierResult(
        passed=passed,
        reasons=[] if passed else ["multi-step aggregation did not produce the expected report"],
        details=report,
    )


def verify_long_chain_dag(spec: ScenarioSpec, context: dict[str, Any]) -> VerifierResult:
    task = _task_map(context)["join-final"]
    report = deep_get(task["raw"], "runtime.output.output")
    expected_nodes = spec.expected.checks["expected_nodes"]
    passed = report["lineage"] == expected_nodes and report["summary"]["status"] == "success"
    return VerifierResult(
        passed=passed,
        reasons=[] if passed else ["long_chain_dag lineage did not match expected order"],
        details=report,
    )
