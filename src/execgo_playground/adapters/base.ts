import {
  defaultAdapterCapabilities,
  normalizeStandardPlan,
  type AdapterCapabilities,
  type NormalizedAdapterError,
  type PlanContext,
  type StandardPlan,
} from "../models.js";
import { getProvider } from "../providers.js";

export abstract class BaseAdapter {
  abstract framework: string;
  protected lastTraceValue: Record<string, unknown> = {};

  get lastTrace(): Record<string, unknown> {
    return this.lastTraceValue;
  }

  abstract capabilities(): AdapterCapabilities;
  abstract plan(context: PlanContext): Promise<StandardPlan>;
  abstract replay(trace: Record<string, unknown>, context: PlanContext): StandardPlan;

  normalizeError(error: unknown): NormalizedAdapterError {
    const err = error instanceof Error ? error : new Error(String(error));
    return {
      framework: this.framework,
      error_type: err.constructor.name,
      message: err.message,
      retryable: false,
      raw: { repr: String(error) },
    };
  }

  protected loadReferencePlan(context: PlanContext): StandardPlan {
    return normalizeStandardPlan(context.scenario_input.reference_plan);
  }

  protected async planFromProvider(context: PlanContext, structure: Record<string, unknown>): Promise<StandardPlan> {
    const provider = getProvider(context.model_profile.provider);
    const [plan, providerTrace] = await provider.generatePlan(context);
    const normalized = normalizeStandardPlan(plan, { framework: this.framework, mode: context.mode });
    this.lastTraceValue = {
      framework: this.framework,
      mode: context.mode,
      scenario_id: context.scenario_id,
      seed: context.seed,
      structure,
      provider_trace: providerTrace,
      normalized_plan: normalized,
    };
    return normalized;
  }

  protected traceBlob(context: PlanContext, structure: Record<string, unknown>): Record<string, unknown> {
    const trace = {
      framework: this.framework,
      mode: context.mode,
      scenario_id: context.scenario_id,
      seed: context.seed,
      structure,
      normalized_plan: this.loadReferencePlan(context),
    };
    this.lastTraceValue = trace;
    return trace;
  }
}

export function fallbackCapabilities(framework: string, notes: string[]): AdapterCapabilities {
  return defaultAdapterCapabilities(framework, {
    native_available: false,
    notes,
  });
}
