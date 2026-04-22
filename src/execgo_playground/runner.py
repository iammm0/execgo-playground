from __future__ import annotations

import copy
import json
import time
from pathlib import Path
from typing import Any

from .adapters import get_adapter
from .benchmarks.metrics import compute_metrics
from .benchmarks.report import render_run_summary
from .chaos import ChaosEngine, load_chaos_profile
from .execgo_client import ExecGoClient
from .harness import DockerHarness
from .models import (
    BenchmarkResult,
    ModelProfile,
    PlanContext,
    PlanStage,
    ScenarioSpec,
    StageExecutionResult,
    StandardPlan,
    TaskSnapshot,
)
from .observability import ArtifactManager, TimelineRecorder
from .scenarios import load_scenario, load_verifier
from .utils import copytree, deep_get, deep_set, sha256_text, write_jsonl


class ExperimentRunner:
    def __init__(self, harness: DockerHarness | None = None) -> None:
        self.harness = harness or DockerHarness()

    def run(
        self,
        *,
        framework: str,
        scenario_id: str,
        mode: str,
        chaos_profile_id: str,
        model_profile: ModelProfile | None = None,
        repetition: int = 0,
    ) -> BenchmarkResult:
        self.harness.up(build=False)
        scenario = load_scenario(scenario_id)
        adapter = get_adapter(framework)
        profile = load_chaos_profile(chaos_profile_id)
        model = model_profile or ModelProfile()
        run_id = f"{scenario_id}-{framework}-{mode}-{chaos_profile_id}-r{repetition}-{int(time.time())}"
        artifacts = ArtifactManager(self.harness.run_root, run_id)
        timeline = TimelineRecorder(artifacts.path("timeline"))
        chaos = ChaosEngine(self.harness, timeline, run_id, framework, scenario_id)
        start = time.time()

        host_workspace_dir = self._prepare_workspace(run_id, scenario)
        runtime_workspace_dir = Path("/workspace") / run_id
        context = PlanContext(
            scenario_id=scenario.id,
            framework=framework,
            model_profile=model,
            prompt_pack=scenario.prompt_pack,
            seed=scenario.seed,
            capabilities=adapter.capabilities(),
            chaos_profile=profile,
            scenario_input=self._contextualize_scenario_input(scenario, runtime_workspace_dir, host_workspace_dir, run_id),
            workspace_dir=str(runtime_workspace_dir),
            mode=mode,
        )
        timeline.record(
            run_id=run_id,
            framework=framework,
            scenario_id=scenario_id,
            phase="plan",
            event_type="run_started",
            status="started",
            metadata={"workspace_dir": str(runtime_workspace_dir), "host_workspace_dir": str(host_workspace_dir), "chaos": chaos_profile_id},
        )

        if mode == "replay":
            replay_trace = {"plan": context.scenario_input["reference_plan"], "source": "scenario_reference"}
            plan = adapter.replay(replay_trace, context)
        else:
            plan = adapter.plan(context)
        plan = chaos.apply_plan_phase(plan, profile)
        artifacts.write_json("plan", plan.model_dump(mode="json"))
        artifacts.write_json("trace", adapter.last_trace)
        client = ExecGoClient(self.harness.execgo_url)

        stage_results: list[StageExecutionResult] = []
        compiled_lookup: dict[str, dict[str, Any]] = {}

        for raw_stage in plan.stages:
            stage = self._resolve_stage(raw_stage, compiled_lookup)
            stage = chaos.apply_submit_phase(stage, profile)
            timeline.record(
                run_id=run_id,
                framework=framework,
                scenario_id=scenario_id,
                phase="submit",
                stage_id=stage.stage_id,
                event_type="stage_submit_started",
                status="started",
                metadata={"task_count": len(stage.task_graph.tasks)},
            )
            compiled_stage, mapping, compiled_task_ids = self._compile_stage(stage, run_id)
            submission = {}
            tasks: list[dict[str, Any]] = []
            snapshots: list[dict[str, Any]] = []
            error: str | None = None
            try:
                submission = client.submit_tasks(compiled_stage.task_graph.model_dump(mode="json"))
                chaos.apply_runtime_phase(profile)
                tasks, snapshots = client.wait_for_tasks(compiled_task_ids, compiled_stage.submit_policy)
            except Exception as exc:
                error = str(exc)
                timeline.record(
                    run_id=run_id,
                    framework=framework,
                    scenario_id=scenario_id,
                    phase="poll",
                    stage_id=stage.stage_id,
                    event_type="stage_failed",
                    status="failed",
                    error_code=exc.__class__.__name__,
                    metadata={"message": str(exc)},
                )

            logical_tasks = []
            for logical_id, compiled_id in mapping.items():
                raw_task = next((task for task in tasks if task.get("id") == compiled_id), {"id": compiled_id, "status": "failed", "error": error})
                logical_tasks.append(
                    TaskSnapshot(
                        task_id=compiled_id,
                        status=raw_task.get("status", "failed"),
                        raw=raw_task,
                    )
                )
                compiled_lookup[logical_id] = {"compiled_id": compiled_id, "task": raw_task}
                timeline.record(
                    run_id=run_id,
                    framework=framework,
                    scenario_id=scenario_id,
                    phase="poll",
                    stage_id=stage.stage_id,
                    task_id=compiled_id,
                    event_type="task_terminal",
                    status=raw_task.get("status", "unknown"),
                    metadata={"logical_id": logical_id},
                )
            stage_result = StageExecutionResult(
                stage_id=stage.stage_id,
                submission=submission,
                task_ids=compiled_task_ids,
                tasks=logical_tasks,
                metrics_snapshots=snapshots,
                success=error is None and all(task.status == "success" for task in logical_tasks),
                error=error,
            )
            stage_results.append(stage_result)
            timeline.record(
                run_id=run_id,
                framework=framework,
                scenario_id=scenario_id,
                phase="submit",
                stage_id=stage.stage_id,
                event_type="stage_submit_finished",
                status="success" if stage_result.success else "failed",
                metadata={"accepted": submission.get("accepted", 0), "error": error},
            )
            if stage.submit_policy.stop_on_failure and not stage_result.success:
                break

        snapshot_rows = []
        for stage_result in stage_results:
            for snapshot in stage_result.metrics_snapshots:
                snapshot_rows.append(snapshot)
        write_jsonl(artifacts.path("snapshots"), snapshot_rows)

        verification_context = self._build_verification_context(stage_results, compiled_lookup, host_workspace_dir)
        verification_context = chaos.apply_verify_phase(profile, verification_context)
        verdict = load_verifier(scenario.verifier_ref)(scenario, verification_context)
        wall_time_ms = int((time.time() - start) * 1000)
        artifact_hash_match = self._artifact_hash_match(scenario, verification_context)
        result = BenchmarkResult(
            run_id=run_id,
            framework=framework,
            scenario_id=scenario_id,
            mode=mode,
            chaos_profile=chaos_profile_id,
            metrics=compute_metrics(
                plan=plan,
                stage_results=stage_results,
                verdict=verdict,
                wall_time_ms=wall_time_ms,
                artifact_hash_match=artifact_hash_match,
                recovery_expected=profile.recovery_expectation == "should_recover",
            ),
            verdict=verdict,
            artifact_manifest=artifacts.manifest(),
        )
        artifacts.write_json(
            "result",
            {
                "benchmark_result": result.model_dump(mode="json"),
                "stage_results": [stage.model_dump(mode="json") for stage in stage_results],
                "verification_context": verification_context,
            },
        )
        artifacts.write_text("summary", render_run_summary(result))
        timeline.record(
            run_id=run_id,
            framework=framework,
            scenario_id=scenario_id,
            phase="verify",
            event_type="run_finished",
            status="success" if verdict.passed else "failed",
            metadata={"wall_time_ms": wall_time_ms},
        )
        timeline.flush()
        chaos.cleanup()
        return result

    def _prepare_workspace(self, run_id: str, scenario: ScenarioSpec) -> Path:
        run_workspace = Path(self.harness.workspace_dir) / run_id
        fixtures = Path(scenario.fixtures_dir)
        if fixtures.exists() and any(fixtures.iterdir()):
            copytree(fixtures, run_workspace)
        else:
            run_workspace.mkdir(parents=True, exist_ok=True)
        return run_workspace

    def _contextualize_scenario_input(
        self,
        scenario: ScenarioSpec,
        runtime_workspace_dir: Path,
        host_workspace_dir: Path,
        run_id: str,
    ) -> dict[str, Any]:
        payload = copy.deepcopy(scenario.input)
        runtime_workspace_text = str(runtime_workspace_dir).replace("\\", "/")
        host_workspace_text = str(host_workspace_dir).replace("\\", "/")
        replacements = {
            "__WORKSPACE_DIR__": runtime_workspace_text,
            "__HOST_WORKSPACE_DIR__": host_workspace_text,
            "__RUN_ID__": run_id,
            "__FIXTURE_URL__": self.harness.fixture_url,
        }

        def rewrite(node: Any) -> Any:
            if isinstance(node, dict):
                return {key: rewrite(value) for key, value in node.items()}
            if isinstance(node, list):
                return [rewrite(item) for item in node]
            if isinstance(node, str):
                value = node
                for old, new in replacements.items():
                    value = value.replace(old, new)
                return value
            return node

        return rewrite(payload)

    def _resolve_stage(self, stage: PlanStage, compiled_lookup: dict[str, dict[str, Any]]) -> PlanStage:
        resolved = copy.deepcopy(stage)
        for binding in resolved.bindings:
            source = compiled_lookup.get(binding.source_task_id)
            if source is None:
                if binding.required:
                    raise KeyError(f"missing binding source task: {binding.source_task_id}")
                continue
            value = deep_get(source["task"], binding.source_path)
            if ".env." in binding.target_param_path and not isinstance(value, str):
                value = json.dumps(value, ensure_ascii=False)
            target = next(task for task in resolved.task_graph.tasks if task.id == binding.target_task_id)
            container = target.model_dump(mode="json")
            deep_set(container, binding.target_param_path, value)
            target.params = container["params"]
            target.input = container.get("input")
        return resolved

    def _compile_stage(self, stage: PlanStage, run_id: str):
        compiled = copy.deepcopy(stage)
        mapping: dict[str, str] = {}
        for task in compiled.task_graph.tasks:
            logical_id = task.id
            compiled_id = f"{run_id}--{stage.stage_id}--{logical_id}"
            mapping[logical_id] = compiled_id
            task.id = compiled_id
        for task in compiled.task_graph.tasks:
            task.depends_on = [mapping.get(dep, dep) for dep in task.depends_on]
        return compiled, mapping, list(mapping.values())

    def _build_verification_context(
        self,
        stage_results: list[StageExecutionResult],
        compiled_lookup: dict[str, dict[str, Any]],
        workspace_dir: Path,
    ) -> dict[str, Any]:
        tasks = []
        for logical_id, info in compiled_lookup.items():
            tasks.append(
                {
                    "logical_id": logical_id,
                    "compiled_id": info["compiled_id"],
                    "raw": info["task"],
                }
            )
        return {
            "tasks": tasks,
            "workspace_dir": str(workspace_dir),
            "stage_results": [stage.model_dump(mode="json") for stage in stage_results],
        }

    def _artifact_hash_match(self, scenario: ScenarioSpec, verification_context: dict[str, Any]) -> bool:
        expected = scenario.expected.checks.get("artifact_hash")
        if not expected:
            return True
        actual = sha256_text(str(verification_context))
        return actual == expected
