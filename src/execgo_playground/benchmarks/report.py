from __future__ import annotations

from collections import defaultdict

from ..models import BenchmarkResult


def render_run_summary(result: BenchmarkResult) -> str:
    metrics = result.metrics
    verdict = "PASS" if result.verdict.passed else "FAIL"
    return "\n".join(
        [
            f"# Run Summary: {result.run_id}",
            "",
            f"- Framework: `{result.framework}`",
            f"- Scenario: `{result.scenario_id}`",
            f"- Mode: `{result.mode}`",
            f"- Chaos: `{result.chaos_profile}`",
            f"- Verdict: `{verdict}`",
            f"- Wall time: `{metrics.wall_time_ms} ms`",
            f"- Tasks: `{metrics.task_count}` across `{metrics.stage_count}` stage(s)",
            f"- Runtime failures: `{metrics.runtime_failure_count}`",
            f"- Artifact hash match: `{metrics.artifact_hash_match}`",
        ]
    )


def render_benchmark_summary(results: list[BenchmarkResult]) -> str:
    grouped: dict[str, list[BenchmarkResult]] = defaultdict(list)
    for result in results:
        grouped[result.framework].append(result)

    lines = [
        "# Benchmark Summary",
        "",
        "| Framework | Runs | Pass Rate | Avg Wall Time (ms) |",
        "| --- | ---: | ---: | ---: |",
    ]
    for framework, framework_results in sorted(grouped.items()):
        total = len(framework_results)
        passes = sum(1 for item in framework_results if item.verdict.passed)
        avg = sum(item.metrics.wall_time_ms for item in framework_results) / max(total, 1)
        lines.append(f"| {framework} | {total} | {passes / max(total, 1):.2f} | {avg:.0f} |")
    return "\n".join(lines) + "\n"
