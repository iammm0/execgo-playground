import { normalizeStandardPlan, type AdapterCapabilities, type PlanContext, type StandardPlan } from "../models.js";
import { BaseAdapter, fallbackCapabilities } from "./base.js";

export class LangGraphAdapter extends BaseAdapter {
  framework = "langgraph";

  capabilities(): AdapterCapabilities {
    return fallbackCapabilities(this.framework, [
      "Uses a normalized LangGraph-style state trace.",
      "Native package probing removed in the TypeScript control plane; using platform fallback planner.",
    ]);
  }

  plan(context: PlanContext): Promise<StandardPlan> {
    return this.planFromProvider(context, {
      nodes: ["plan", "normalize", "emit"],
      edges: [["plan", "normalize"], ["normalize", "emit"]],
      state_keys: ["objective", "draft_plan", "normalized_plan"],
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
