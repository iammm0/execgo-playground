import { normalizeStandardPlan, type AdapterCapabilities, type PlanContext, type StandardPlan } from "../models.js";
import { BaseAdapter, fallbackCapabilities } from "./base.js";

export class AutoGenAdapter extends BaseAdapter {
  framework = "autogen";

  capabilities(): AdapterCapabilities {
    return fallbackCapabilities(this.framework, [
      "Uses a normalized AutoGen-style conversation trace.",
      "Native package probing removed in the TypeScript control plane; using platform fallback planner.",
    ]);
  }

  plan(context: PlanContext): Promise<StandardPlan> {
    return this.planFromProvider(context, {
      agents: ["planner", "reviewer", "executor"],
      conversation: [
        { speaker: "planner", intent: "draft_standard_plan" },
        { speaker: "reviewer", intent: "check_execgo_constraints" },
        { speaker: "executor", intent: "emit_standard_plan" },
      ],
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
