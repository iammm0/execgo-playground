import path from "node:path";
import { getAdapter } from "./adapters/index.js";
import { computeMetrics } from "./benchmarks/metrics.js";
import { renderRunSummary } from "./benchmarks/report.js";
import { ChaosEngine, loadChaosProfile } from "./chaos/index.js";
import { ExecGoClient } from "./execgo_client.js";
import { DockerHarness } from "./harness/index.js";
import {
  defaultModelProfile,
  normalizePlanStage,
  type BenchmarkResult,
  type ModelProfile,
  type PlanContext,
  type PlanStage,
  type ScenarioSpec,
  type StageExecutionResult,
  type StandardPlan,
  type TaskSnapshot,
  type RunMode,
} from "./models.js";
import { ArtifactManager, TimelineRecorder } from "./observability/index.js";
import { loadScenario, loadVerifier } from "./scenarios/index.js";
import { copyTree, deepGet, deepSet, pathExists, sha256Text, writeJsonl } from "./utils.js";

type CompiledLookup = Record<string, { compiled_id: string; task: Record<string, unknown> }>;

export class ExperimentRunner {
  constructor(readonly harness: DockerHarness = new DockerHarness()) {}

  async run(input: {
    framework: string;
    scenarioId: string;
    mode: string;
    chaosProfileId: string;
    modelProfile?: ModelProfile;
    repetition?: number;
  }): Promise<BenchmarkResult> {
    await this.harness.init();
    this.harness.up(false);
    const scenario = await loadScenario(input.scenarioId);
    const adapter = getAdapter(input.framework);
    const profile = await loadChaosProfile(input.chaosProfileId);
    const model = input.modelProfile ?? defaultModelProfile();
    const runId = `${scenario.id}-${input.framework}-${input.mode}-${input.chaosProfileId}-r${input.repetition ?? 0}-${Math.floor(Date.now() / 1000)}`;
    const artifacts = await new ArtifactManager(this.harness.runRoot, runId).init();
    const timeline = new TimelineRecorder(artifacts.path("timeline"));
    const chaos = new ChaosEngine(this.harness, timeline, runId, input.framework, scenario.id);
    const start = Date.now();

    const hostWorkspaceDir = await this.prepareWorkspace(runId, scenario);
    const runtimeWorkspaceDir = path.posix.join("/workspace", runId);
    const context: PlanContext = {
      scenario_id: scenario.id,
      framework: input.framework,
      model_profile: model,
      prompt_pack: scenario.prompt_pack,
      seed: scenario.seed,
      capabilities: adapter.capabilities(),
      chaos_profile: profile,
      scenario_input: this.contextualizeScenarioInput(scenario, runtimeWorkspaceDir, hostWorkspaceDir, runId),
      workspace_dir: runtimeWorkspaceDir,
      mode: input.mode as RunMode,
    };
    timeline.record({
      run_id: runId,
      framework: input.framework,
      scenario_id: input.scenarioId,
      phase: "plan",
      event_type: "run_started",
      status: "started",
      metadata: {
        workspace_dir: runtimeWorkspaceDir,
        host_workspace_dir: hostWorkspaceDir,
        chaos: input.chaosProfileId,
      },
    });

    let plan: StandardPlan;
    if (input.mode === "replay") {
      const replayTrace = { plan: context.scenario_input.reference_plan, source: "scenario_reference" };
      plan = adapter.replay(replayTrace, context);
    } else {
      plan = await adapter.plan(context);
    }
    plan = chaos.applyPlanPhase(plan, profile);
    await artifacts.writeJson("plan", plan);
    await artifacts.writeJson("trace", adapter.lastTrace);
    const client = new ExecGoClient(this.harness.execgoUrl);

    const stageResults: StageExecutionResult[] = [];
    const compiledLookup: CompiledLookup = {};

    for (const rawStage of plan.stages) {
      let stage = this.resolveStage(rawStage, compiledLookup);
      stage = chaos.applySubmitPhase(stage, profile);
      timeline.record({
        run_id: runId,
        framework: input.framework,
        scenario_id: input.scenarioId,
        phase: "submit",
        stage_id: stage.stage_id,
        event_type: "stage_submit_started",
        status: "started",
        metadata: { task_count: stage.task_graph.tasks.length },
      });
      const [compiledStage, mapping, compiledTaskIds] = this.compileStage(stage, runId);
      let submission: Record<string, unknown> = {};
      let tasks: Record<string, unknown>[] = [];
      let snapshots: Record<string, unknown>[] = [];
      let error: string | undefined;
      try {
        submission = await client.submitTasks(compiledStage.task_graph as unknown as Record<string, unknown>);
        await chaos.applyRuntimePhase(profile);
        [tasks, snapshots] = await client.waitForTasks(compiledTaskIds, compiledStage.submit_policy);
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        timeline.record({
          run_id: runId,
          framework: input.framework,
          scenario_id: input.scenarioId,
          phase: "poll",
          stage_id: stage.stage_id,
          event_type: "stage_failed",
          status: "failed",
          error_code: err instanceof Error ? err.constructor.name : "Error",
          metadata: { message: error },
        });
      }

      const logicalTasks: TaskSnapshot[] = [];
      for (const [logicalId, compiledId] of Object.entries(mapping)) {
        const rawTask = tasks.find((task) => task.id === compiledId) ?? { id: compiledId, status: "failed", error };
        logicalTasks.push({
          task_id: compiledId,
          status: String(rawTask.status ?? "failed"),
          raw: rawTask,
        });
        compiledLookup[logicalId] = { compiled_id: compiledId, task: rawTask };
        timeline.record({
          run_id: runId,
          framework: input.framework,
          scenario_id: input.scenarioId,
          phase: "poll",
          stage_id: stage.stage_id,
          task_id: compiledId,
          event_type: "task_terminal",
          status: String(rawTask.status ?? "unknown"),
          metadata: { logical_id: logicalId },
        });
      }

      const stageResult: StageExecutionResult = {
        stage_id: stage.stage_id,
        submission,
        task_ids: compiledTaskIds,
        tasks: logicalTasks,
        metrics_snapshots: snapshots,
        success: error === undefined && logicalTasks.every((task) => task.status === "success"),
        error,
      };
      stageResults.push(stageResult);
      timeline.record({
        run_id: runId,
        framework: input.framework,
        scenario_id: input.scenarioId,
        phase: "submit",
        stage_id: stage.stage_id,
        event_type: "stage_submit_finished",
        status: stageResult.success ? "success" : "failed",
        metadata: { accepted: submission.accepted ?? 0, error },
      });
      if (stage.submit_policy.stop_on_failure && !stageResult.success) {
        break;
      }
    }

    await writeJsonl(
      artifacts.path("snapshots"),
      stageResults.flatMap((stage) => stage.metrics_snapshots),
    );

    let verificationContext = this.buildVerificationContext(stageResults, compiledLookup, hostWorkspaceDir);
    verificationContext = chaos.applyVerifyPhase(profile, verificationContext);
    const verdict = await loadVerifier(scenario.verifier_ref)(scenario, verificationContext);
    const wallTimeMs = Date.now() - start;
    const artifactHashMatch = this.artifactHashMatch(scenario, verificationContext);
    const result: BenchmarkResult = {
      run_id: runId,
      framework: input.framework,
      scenario_id: input.scenarioId,
      mode: input.mode as RunMode,
      chaos_profile: input.chaosProfileId,
      metrics: computeMetrics({
        plan,
        stageResults,
        verdict,
        wallTimeMs,
        artifactHashMatch,
        recoveryExpected: profile.recovery_expectation === "should_recover",
      }),
      verdict,
      artifact_manifest: artifacts.manifest(),
    };
    await artifacts.writeJson("result", {
      benchmark_result: result,
      stage_results: stageResults,
      verification_context: verificationContext,
    });
    await artifacts.writeText("summary", renderRunSummary(result));
    timeline.record({
      run_id: runId,
      framework: input.framework,
      scenario_id: input.scenarioId,
      phase: "verify",
      event_type: "run_finished",
      status: verdict.passed ? "success" : "failed",
      metadata: { wall_time_ms: wallTimeMs },
    });
    await timeline.flush();
    await chaos.cleanup();
    return result;
  }

  async prepareWorkspace(runId: string, scenario: ScenarioSpec): Promise<string> {
    const runWorkspace = path.join(this.harness.workspaceDir, runId);
    if ((await pathExists(scenario.fixtures_dir))) {
      await copyTree(scenario.fixtures_dir, runWorkspace);
    }
    return runWorkspace;
  }

  contextualizeScenarioInput(scenario: ScenarioSpec, runtimeWorkspaceDir: string, hostWorkspaceDir: string, runId: string): Record<string, unknown> {
    const payload = structuredClone(scenario.input);
    const replacements: Record<string, string> = {
      __WORKSPACE_DIR__: runtimeWorkspaceDir.replaceAll("\\", "/"),
      __HOST_WORKSPACE_DIR__: hostWorkspaceDir.replaceAll("\\", "/"),
      __RUN_ID__: runId,
      __FIXTURE_URL__: this.harness.fixtureUrl,
    };
    const rewrite = (node: unknown): unknown => {
      if (Array.isArray(node)) {
        return node.map(rewrite);
      }
      if (node && typeof node === "object") {
        return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, rewrite(value)]));
      }
      if (typeof node === "string") {
        return Object.entries(replacements).reduce((value, [from, to]) => value.replaceAll(from, to), node);
      }
      return node;
    };
    return rewrite(payload) as Record<string, unknown>;
  }

  resolveStage(stage: PlanStage, compiledLookup: CompiledLookup): PlanStage {
    const resolved = normalizePlanStage(structuredClone(stage) as Record<string, unknown>);
    for (const binding of resolved.bindings) {
      const source = compiledLookup[binding.source_task_id];
      if (!source) {
        if (binding.required) {
          throw new Error(`missing binding source task: ${binding.source_task_id}`);
        }
        continue;
      }
      let value = deepGet(source.task, binding.source_path);
      if (binding.target_param_path.includes(".env.") && typeof value !== "string") {
        value = JSON.stringify(value);
      }
      const target = resolved.task_graph.tasks.find((task) => task.id === binding.target_task_id);
      if (!target) {
        throw new Error(`missing binding target task: ${binding.target_task_id}`);
      }
      const container = structuredClone(target) as Record<string, unknown>;
      deepSet(container, binding.target_param_path, value);
      target.params = (container.params as Record<string, unknown>) ?? {};
      target.input = container.input as Record<string, unknown> | undefined;
    }
    return resolved;
  }

  compileStage(stage: PlanStage, runId: string): [PlanStage, Record<string, string>, string[]] {
    const compiled = normalizePlanStage(structuredClone(stage) as Record<string, unknown>);
    const mapping: Record<string, string> = {};
    for (const task of compiled.task_graph.tasks) {
      const logicalId = task.id;
      const compiledId = `${runId}--${stage.stage_id}--${logicalId}`;
      mapping[logicalId] = compiledId;
      task.id = compiledId;
    }
    for (const task of compiled.task_graph.tasks) {
      task.depends_on = task.depends_on.map((dep) => mapping[dep] ?? dep);
    }
    return [compiled, mapping, Object.values(mapping)];
  }

  buildVerificationContext(
    stageResults: StageExecutionResult[],
    compiledLookup: CompiledLookup,
    workspaceDir: string,
  ): Record<string, unknown> {
    return {
      tasks: Object.entries(compiledLookup).map(([logicalId, info]) => ({
        logical_id: logicalId,
        compiled_id: info.compiled_id,
        raw: info.task,
      })),
      workspace_dir: workspaceDir,
      stage_results: stageResults,
    };
  }

  artifactHashMatch(scenario: ScenarioSpec, verificationContext: Record<string, unknown>): boolean {
    const expected = scenario.expected.checks.artifact_hash;
    if (!expected) {
      return true;
    }
    return sha256Text(String(verificationContext)) === expected;
  }
}
