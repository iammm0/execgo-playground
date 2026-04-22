from __future__ import annotations

from pathlib import Path

from ..models import BenchmarkResult, BenchmarkRunRequest
from ..runner import ExperimentRunner
from ..utils import write_json, write_text
from .report import render_benchmark_summary


class BenchmarkRunner:
    def __init__(self, runner: ExperimentRunner) -> None:
        self.runner = runner

    def run(self, request: BenchmarkRunRequest) -> list[BenchmarkResult]:
        results: list[BenchmarkResult] = []
        for framework in request.frameworks:
            for scenario in request.scenarios:
                for chaos_profile in request.chaos_profiles:
                    for repetition in range(request.repetitions):
                        result = self.runner.run(
                            framework=framework,
                            scenario_id=scenario,
                            mode=request.mode,
                            chaos_profile_id=chaos_profile,
                            model_profile=request.model_profile,
                            repetition=repetition,
                        )
                        results.append(result)
        summary_path = Path(self.runner.harness.run_root) / "benchmark-summary.json"
        write_json(summary_path, [result.model_dump(mode="json") for result in results])
        write_text(summary_path.with_suffix(".md"), render_benchmark_summary(results))
        return results
