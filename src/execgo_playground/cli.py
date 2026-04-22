from __future__ import annotations

import argparse
import json

from .benchmarks.runner import BenchmarkRunner
from .harness import DockerHarness
from .models import BenchmarkRunRequest, ModelProfile
from .runner import ExperimentRunner
from .schema import export_schemas


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="execgo-playground")
    sub = parser.add_subparsers(dest="command", required=True)

    harness = sub.add_parser("harness", help="Manage the Docker benchmark harness")
    harness_sub = harness.add_subparsers(dest="harness_command", required=True)
    harness_sub.add_parser("up").add_argument("--build", action="store_true")
    harness_sub.add_parser("down")
    harness_sub.add_parser("status")

    schema = sub.add_parser("schema", help="Export JSON schemas")
    schema.add_argument("export", nargs="?", default="export")
    schema.add_argument("--out", default="shared/spec")

    run = sub.add_parser("run", help="Run a single experiment")
    run.add_argument("--framework", required=True, choices=["langgraph", "crewai", "autogen"])
    run.add_argument("--scenario", required=True, choices=["codegen_exec", "vuln_scan", "multi_step_agent", "long_chain_dag"])
    run.add_argument("--mode", default="replay", choices=["live", "replay"])
    run.add_argument("--chaos", default="none")
    run.add_argument("--provider", default="mock")
    run.add_argument("--model", default="mock-reliability-planner")
    run.add_argument("--temperature", type=float, default=0.0)
    run.add_argument("--max-tokens", type=int, default=1200)
    run.add_argument("--timeout-ms", type=int, default=60000)
    run.add_argument("--seed", type=int, default=7)

    benchmark = sub.add_parser("benchmark", help="Run a benchmark matrix")
    benchmark.add_argument("--framework", action="append", dest="frameworks", required=True)
    benchmark.add_argument("--scenario", action="append", dest="scenarios", required=True)
    benchmark.add_argument("--chaos", action="append", dest="chaos_profiles", default=["none"])
    benchmark.add_argument("--mode", default="replay", choices=["live", "replay"])
    benchmark.add_argument("--repetitions", type=int, default=1)
    benchmark.add_argument("--provider", default="mock")
    benchmark.add_argument("--model", default="mock-reliability-planner")
    benchmark.add_argument("--temperature", type=float, default=0.0)
    benchmark.add_argument("--max-tokens", type=int, default=1200)
    benchmark.add_argument("--timeout-ms", type=int, default=60000)
    benchmark.add_argument("--seed", type=int, default=7)
    return parser


def _model_profile(args: argparse.Namespace) -> ModelProfile:
    return ModelProfile(
        provider=args.provider,
        model=args.model,
        temperature=args.temperature,
        max_tokens=args.max_tokens,
        timeout_ms=args.timeout_ms,
        seed=args.seed,
    )


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    harness = DockerHarness()

    if args.command == "harness":
        if args.harness_command == "up":
            harness.up(build=args.build)
            return 0
        if args.harness_command == "down":
            harness.down()
            return 0
        if args.harness_command == "status":
            print(json.dumps(harness.status(), ensure_ascii=False, indent=2))
            return 0

    if args.command == "schema":
        written = export_schemas(args.out)
        print(json.dumps([str(path) for path in written], ensure_ascii=False, indent=2))
        return 0

    runner = ExperimentRunner(harness)
    if args.command == "run":
        result = runner.run(
            framework=args.framework,
            scenario_id=args.scenario,
            mode=args.mode,
            chaos_profile_id=args.chaos,
            model_profile=_model_profile(args),
        )
        print(json.dumps(result.model_dump(mode="json"), ensure_ascii=False, indent=2))
        return 0

    if args.command == "benchmark":
        request = BenchmarkRunRequest(
            frameworks=args.frameworks,
            scenarios=args.scenarios,
            chaos_profiles=args.chaos_profiles,
            mode=args.mode,
            repetitions=args.repetitions,
            model_profile=_model_profile(args),
        )
        results = BenchmarkRunner(runner).run(request)
        print(json.dumps([result.model_dump(mode="json") for result in results], ensure_ascii=False, indent=2))
        return 0

    parser.error("unsupported command")
    return 2
