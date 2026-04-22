from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


RunMode = Literal["live", "replay"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class ExecGoTask(StrictModel):
    id: str
    type: str
    params: dict[str, Any] = Field(default_factory=dict)
    input: dict[str, Any] | None = None
    tool_name: str | None = None
    execution_category: str | None = None
    depends_on: list[str] = Field(default_factory=list)
    retry: int = 0
    timeout: int | None = None


class ExecGoTaskGraph(StrictModel):
    tasks: list[ExecGoTask]

    @model_validator(mode="after")
    def validate_graph(self) -> "ExecGoTaskGraph":
        if not self.tasks:
            raise ValueError("task graph is empty")
        ids = [task.id for task in self.tasks]
        if len(ids) != len(set(ids)):
            raise ValueError("task ids must be unique inside a stage")
        known = set(ids)
        for task in self.tasks:
            for dep in task.depends_on:
                if dep not in known:
                    raise ValueError(f"task {task.id} depends on unknown task {dep}")
                if dep == task.id:
                    raise ValueError(f"task {task.id} cannot depend on itself")
        return self


class Binding(StrictModel):
    source_task_id: str
    source_path: str
    target_task_id: str
    target_param_path: str
    required: bool = True


class SubmitPolicy(StrictModel):
    poll_interval_ms: int = 500
    max_attempts: int = 120
    stop_on_failure: bool = True


class PlanStage(StrictModel):
    stage_id: str
    task_graph: ExecGoTaskGraph
    bindings: list[Binding] = Field(default_factory=list)
    submit_policy: SubmitPolicy = Field(default_factory=SubmitPolicy)
    expected_artifacts: list[str] = Field(default_factory=list)


class PromptPack(StrictModel):
    system_prompt: str
    user_prompt: str
    constraints_prompt: str = ""


class ModelProfile(StrictModel):
    provider: str = "mock"
    model: str = "mock-reliability-planner"
    temperature: float = 0.0
    max_tokens: int = 1200
    timeout_ms: int = 60_000
    seed: int = 7


class AdapterCapabilities(StrictModel):
    framework: str
    live_supported: bool = True
    replay_supported: bool = True
    native_available: bool = False
    notes: list[str] = Field(default_factory=list)


class NormalizedAdapterError(StrictModel):
    framework: str
    error_type: str
    message: str
    retryable: bool = False
    raw: dict[str, Any] = Field(default_factory=dict)


class ChaosAction(StrictModel):
    kind: str
    params: dict[str, Any] = Field(default_factory=dict)


class ChaosProfile(StrictModel):
    id: str
    target_phase: Literal["plan", "submit", "runtime", "poll", "verify"]
    actions: list[ChaosAction] = Field(default_factory=list)
    probability: float = 1.0
    seed: int = 0
    recovery_expectation: Literal["not_applicable", "should_recover", "expected_failure"] = "not_applicable"


class PlanContext(StrictModel):
    scenario_id: str
    framework: str
    model_profile: ModelProfile
    prompt_pack: PromptPack
    seed: int
    capabilities: AdapterCapabilities
    chaos_profile: ChaosProfile
    scenario_input: dict[str, Any]
    workspace_dir: str
    mode: RunMode


class StandardPlan(StrictModel):
    plan_id: str
    scenario_id: str
    framework: str
    mode: RunMode
    stages: list[PlanStage]
    raw_trace_ref: str | None = None
    normalization_warnings: list[str] = Field(default_factory=list)


class ScenarioExpected(StrictModel):
    checks: dict[str, Any] = Field(default_factory=dict)


class ScenarioSpec(StrictModel):
    id: str
    description: str
    seed: int
    input: dict[str, Any]
    prompt_pack: PromptPack
    expected: ScenarioExpected
    verifier_ref: str
    allowed_chaos: list[str] = Field(default_factory=list)
    fixtures_dir: str
    scenario_dir: str


class TimelineEvent(StrictModel):
    run_id: str
    timestamp: datetime
    phase: str
    framework: str
    scenario_id: str
    stage_id: str | None = None
    task_id: str | None = None
    event_type: str
    status: str
    input_ref: str | None = None
    output_ref: str | None = None
    error_code: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class TaskSnapshot(StrictModel):
    task_id: str
    status: str
    raw: dict[str, Any] = Field(default_factory=dict)


class StageExecutionResult(StrictModel):
    stage_id: str
    submission: dict[str, Any] = Field(default_factory=dict)
    task_ids: list[str] = Field(default_factory=list)
    tasks: list[TaskSnapshot] = Field(default_factory=list)
    metrics_snapshots: list[dict[str, Any]] = Field(default_factory=list)
    success: bool = False
    error: str | None = None


class VerifierResult(StrictModel):
    passed: bool
    reasons: list[str] = Field(default_factory=list)
    details: dict[str, Any] = Field(default_factory=dict)


class RunMetrics(StrictModel):
    plan_validity: float = 0.0
    submit_accept_rate: float = 0.0
    scenario_success: float = 0.0
    recovery_success: float = 0.0
    wall_time_ms: int = 0
    stage_count: int = 0
    task_count: int = 0
    retry_count: int = 0
    timeout_count: int = 0
    runtime_failure_count: int = 0
    invalid_action_count: int = 0
    determinism_drift: float = 0.0
    artifact_hash_match: float = 0.0


class ArtifactManifest(StrictModel):
    run_dir: str
    plan_path: str
    timeline_path: str
    snapshot_path: str
    adapter_trace_path: str
    result_path: str
    summary_path: str


class BenchmarkResult(StrictModel):
    run_id: str
    framework: str
    scenario_id: str
    mode: RunMode
    chaos_profile: str
    metrics: RunMetrics
    verdict: VerifierResult
    artifact_manifest: ArtifactManifest


class BenchmarkRunRequest(StrictModel):
    frameworks: list[str]
    scenarios: list[str]
    mode: RunMode = "replay"
    chaos_profiles: list[str] = Field(default_factory=lambda: ["none"])
    model_profile: ModelProfile = Field(default_factory=ModelProfile)
    repetitions: int = 1
