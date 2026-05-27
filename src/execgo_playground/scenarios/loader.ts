import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  type PromptPack,
  type ScenarioSpec,
  type VerifierResult,
  objectValue,
} from "../models.js";
import { readJson, repoRoot } from "../utils.js";
import {
  verifyCodegenExec,
  verifyLongChainDag,
  verifyMultiStepAgent,
  verifyVulnScan,
} from "./verifiers.js";

export async function loadScenario(scenarioId: string): Promise<ScenarioSpec> {
  const base = path.join(repoRoot(), "scenarios", scenarioId);
  const raw = objectValue(await readJson(path.join(base, "scenario.json")));
  const expected = objectValue(await readJson(path.join(base, "expected.json")));
  const promptDir = path.join(base, "prompt_pack");
  const promptPack: PromptPack = {
    system_prompt: (await readFile(path.join(promptDir, "system.txt"), "utf8")).trim(),
    user_prompt: (await readFile(path.join(promptDir, "user.txt"), "utf8")).trim(),
    constraints_prompt: (await readFile(path.join(promptDir, "constraints.txt"), "utf8")).trim(),
  };
  return {
    id: String(raw.id),
    description: String(raw.description),
    seed: raw.seed === undefined ? 7 : Number(raw.seed),
    input: objectValue(raw.input),
    prompt_pack: promptPack,
    expected: { checks: expected },
    verifier_ref: String(raw.verifier_ref),
    allowed_chaos: Array.isArray(raw.allowed_chaos) ? raw.allowed_chaos.map(String) : [],
    fixtures_dir: path.join(base, "fixtures"),
    scenario_dir: base,
  };
}

export type Verifier = (spec: ScenarioSpec, context: Record<string, unknown>) => Promise<VerifierResult> | VerifierResult;

export function loadVerifier(ref: string): Verifier {
  const name = ref.includes(":") ? ref.split(":").at(-1)! : ref;
  const catalog: Record<string, Verifier> = {
    verify_codegen_exec: verifyCodegenExec,
    verify_vuln_scan: verifyVulnScan,
    verify_multi_step_agent: verifyMultiStepAgent,
    verify_long_chain_dag: verifyLongChainDag,
    verifyCodegenExec,
    verifyVulnScan,
    verifyMultiStepAgent,
    verifyLongChainDag,
  };
  const verifier = catalog[name];
  if (!verifier) {
    throw new Error(`unknown verifier: ${ref}`);
  }
  return verifier;
}
