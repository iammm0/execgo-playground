import { normalizeStandardPlan, type AdapterCapabilities, type PlanContext, type StandardPlan } from "../models.js";
import { BaseAdapter, fallbackCapabilities } from "./base.js";

export class CrewAIAdapter extends BaseAdapter {
  framework = "crewai";

  capabilities(): AdapterCapabilities {
    return fallbackCapabilities(this.framework, [
      "Uses a normalized CrewAI-style crew/task trace.",
      "Native package probing removed in the TypeScript control plane; using platform fallback planner.",
    ]);
  }

  plan(context: PlanContext): Promise<StandardPlan> {
    return this.planFromProvider(context, {
      crew: { name: "execgo-reliability-bench", process: "sequential" },
      agents: ["planner", "normalizer", "submitter"],
      tasks: ["draft execgo plan", "normalize stages", "emit standard plan"],
    });
  }

  replay(trace: Record<string, unknown>, context: PlanContext): StandardPlan {
    this.lastTraceValue = trace;
    if ("plan" in trace) {
      return normalizeStandardPlan(trace.plan, { framework: this.framework, mode: "replay" });
    }
    return normalizeStandardPlan(this.loadReferencePlan(context), { framework: this.framework, mode: "replay" });
  }
}
