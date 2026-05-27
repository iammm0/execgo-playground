import { randomInt } from "node:crypto";
import { type ChaosProfile, type PlanStage, type StandardPlan, normalizePlanStage, normalizeStandardPlan } from "../models.js";
import { TimelineRecorder } from "../observability/timeline.js";
import { deepSet } from "../utils.js";

type HarnessLike = {
  restartService(service: string): void;
  killService(service: string): void;
  updateServiceResources(service: string, options: { cpus?: string; memory?: string }): void;
  configureFixtureMode(payload: { latency_ms?: number; fail_mode?: string }): Promise<void> | void;
  resetFixtureMode(): Promise<void> | void;
};

export class ChaosEngine {
  private fixtureDirty = false;
  private runtimeDirty = false;

  constructor(
    private readonly harness: HarnessLike,
    private readonly timeline: TimelineRecorder,
    private readonly runId: string,
    private readonly framework: string,
    private readonly scenarioId: string,
  ) {}

  applyPlanPhase(plan: StandardPlan, profile: ChaosProfile): StandardPlan {
    if (profile.target_phase !== "plan" || !this.shouldFire(profile)) {
      return plan;
    }
    const mutated = normalizeStandardPlan(structuredClone(plan));
    for (const action of profile.actions) {
      if (action.kind === "inject_invalid_action" && mutated.stages[0]?.task_graph.tasks[0]) {
        mutated.stages[0].task_graph.tasks[0].type = String(action.params.type ?? "ghost-tool");
      }
      if (action.kind === "inject_bad_dependency" && mutated.stages[0]?.task_graph.tasks[0]) {
        mutated.stages[0].task_graph.tasks[0].depends_on.push(String(action.params.dependency ?? "missing-task"));
      }
    }
    this.record("plan", profile.id, "applied");
    return mutated;
  }

  applySubmitPhase(stage: PlanStage, profile: ChaosProfile): PlanStage {
    if (profile.target_phase !== "submit" || !this.shouldFire(profile)) {
      return stage;
    }
    const mutated = normalizePlanStage(structuredClone(stage) as Record<string, unknown>);
    for (const action of profile.actions) {
      if (action.kind === "drop_required_binding" && mutated.bindings.length > 0) {
        mutated.bindings.shift();
      }
      if (action.kind === "force_timeout_budget" && mutated.task_graph.tasks[0]) {
        mutated.task_graph.tasks[0].timeout = Number(action.params.timeout_ms ?? 1);
      }
    }
    this.record("submit", profile.id, "applied", stage.stage_id);
    return mutated;
  }

  async applyRuntimePhase(profile: ChaosProfile): Promise<void> {
    if (!["runtime", "poll"].includes(profile.target_phase) || !this.shouldFire(profile)) {
      return;
    }
    for (const action of profile.actions) {
      if (action.kind === "restart_service") {
        this.harness.restartService(String(action.params.service));
        this.runtimeDirty = true;
      } else if (action.kind === "kill_service") {
        this.harness.killService(String(action.params.service));
        this.runtimeDirty = true;
      } else if (action.kind === "resource_pressure") {
        this.harness.updateServiceResources(String(action.params.service), {
          cpus: action.params.cpus === undefined ? undefined : String(action.params.cpus),
          memory: action.params.memory === undefined ? undefined : String(action.params.memory),
        });
        this.runtimeDirty = true;
      } else if (action.kind === "fixture_mode") {
        await this.harness.configureFixtureMode({
          latency_ms: Number(action.params.latency_ms ?? 0),
          fail_mode: String(action.params.fail_mode ?? "none"),
        });
        this.fixtureDirty = true;
      }
    }
    this.record(profile.target_phase, profile.id, "applied");
  }

  applyVerifyPhase(profile: ChaosProfile, verificationPayload: Record<string, unknown>): Record<string, unknown> {
    if (profile.target_phase !== "verify" || !this.shouldFire(profile)) {
      return verificationPayload;
    }
    const mutated = structuredClone(verificationPayload);
    for (const action of profile.actions) {
      if (action.kind === "drop_verification_field") {
        deepSet(mutated, String(action.params.path), null);
      }
    }
    this.record("verify", profile.id, "applied");
    return mutated;
  }

  async cleanup(): Promise<void> {
    if (this.fixtureDirty) {
      await this.harness.resetFixtureMode();
    }
    try {
      if (this.runtimeDirty) {
        this.harness.restartService("runtime");
        this.harness.restartService("execgo");
      }
    } catch {
      // Cleanup is best effort so the run result can still be inspected.
    }
  }

  private record(phase: string, profileId: string, status: string, stageId?: string): void {
    this.timeline.record({
      run_id: this.runId,
      framework: this.framework,
      scenario_id: this.scenarioId,
      phase,
      stage_id: stageId,
      event_type: "chaos",
      status,
      metadata: { profile: profileId },
    });
  }

  private shouldFire(profile: ChaosProfile): boolean {
    if (profile.probability <= 0) {
      return false;
    }
    if (profile.probability >= 1) {
      return true;
    }
    const seed = profile.seed || 0;
    const value = ((seed * 9301 + 49297 + randomInt(0, 1)) % 233280) / 233280;
    return value <= profile.probability;
  }
}
