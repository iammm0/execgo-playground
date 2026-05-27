import { normalizeStandardPlan, type PlanContext, type StandardPlan } from "./models.js";

export type PlanningProvider = {
  generatePlan(context: PlanContext): Promise<[StandardPlan, Record<string, unknown>]>;
};

export class MockPlanningProvider implements PlanningProvider {
  async generatePlan(context: PlanContext): Promise<[StandardPlan, Record<string, unknown>]> {
    const plan = normalizeStandardPlan(context.scenario_input.reference_plan, {
      framework: context.framework,
      mode: context.mode,
    });
    return [
      plan,
      {
        provider: "mock",
        model: context.model_profile.model,
        source: "scenario.reference_plan",
      },
    ];
  }
}

export class OpenAICompatiblePlanningProvider implements PlanningProvider {
  async generatePlan(context: PlanContext): Promise<[StandardPlan, Record<string, unknown>]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required for openai-compatible live planning");
    }
    const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com").replace(/\/+$/, "");
    const body = {
      model: context.model_profile.model,
      messages: [
        { role: "system", content: context.prompt_pack.system_prompt },
        {
          role: "user",
          content: [
            context.prompt_pack.user_prompt,
            context.prompt_pack.constraints_prompt,
            "Return only JSON matching the StandardPlan schema. Do not wrap it in Markdown.",
            `Scenario input: ${JSON.stringify(context.scenario_input)}`,
          ].join("\n\n"),
        },
      ],
      temperature: context.model_profile.temperature,
      max_tokens: context.model_profile.max_tokens,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), context.model_profile.timeout_ms);
    try {
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`planning provider failed: ${response.status} ${await response.text()}`);
      }
      const payload = (await response.json()) as Record<string, unknown>;
      const choices = payload.choices as Array<{ message: { content: string } }>;
      const plan = normalizeStandardPlan(JSON.parse(choices[0].message.content), {
        framework: context.framework,
        mode: context.mode,
      });
      return [
        plan,
        {
          provider: "openai-compatible",
          base_url: baseUrl,
          model: context.model_profile.model,
          response_id: payload.id,
          usage: payload.usage ?? {},
        },
      ];
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function getProvider(providerName: string): PlanningProvider {
  const normalized = providerName.toLowerCase().replaceAll("_", "-");
  if (normalized === "mock") {
    return new MockPlanningProvider();
  }
  if (normalized === "openai" || normalized === "openai-compatible") {
    return new OpenAICompatiblePlanningProvider();
  }
  throw new Error(`unknown planning provider: ${providerName}`);
}
