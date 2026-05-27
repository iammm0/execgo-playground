import path from "node:path";
import { type ChaosProfile, objectValue } from "../models.js";
import { readJson, repoRoot } from "../utils.js";

export async function loadChaosProfile(profileId: string): Promise<ChaosProfile> {
  const target = path.join(repoRoot(), "chaos", "profiles", `${profileId}.json`);
  const raw = objectValue(await readJson(target));
  return {
    id: String(raw.id),
    target_phase: raw.target_phase as ChaosProfile["target_phase"],
    actions: Array.isArray(raw.actions)
      ? raw.actions.map((action) => {
          const item = objectValue(action);
          return { kind: String(item.kind), params: objectValue(item.params) };
        })
      : [],
    probability: raw.probability === undefined ? 1 : Number(raw.probability),
    seed: raw.seed === undefined ? 0 : Number(raw.seed),
    recovery_expectation: (raw.recovery_expectation ?? "not_applicable") as ChaosProfile["recovery_expectation"],
  };
}
