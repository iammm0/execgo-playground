import path from "node:path";
import type { ScenarioSpec, VerifierResult } from "../models.js";
import { deepGet, sha256File } from "../utils.js";

function taskMap(context: Record<string, unknown>): Record<string, Record<string, unknown>> {
  const tasks = context.tasks as Array<Record<string, unknown>>;
  return Object.fromEntries(tasks.map((task) => [String(task.logical_id), task]));
}

function reportFor(task: Record<string, unknown>): unknown {
  const raw = task.raw;
  for (const candidate of ["result.output", "runtime.output.output"]) {
    try {
      return deepGet(raw, candidate);
    } catch {
      // Try the next shape; ExecGo task snapshots can lag runtime result snapshots.
    }
  }
  throw new Error("result.output");
}

export async function verifyCodegenExec(spec: ScenarioSpec, context: Record<string, unknown>): Promise<VerifierResult> {
  const task = taskMap(context)["collect-report"];
  const report = reportFor(task) as {
    tests: { status: string; passed: number };
  };
  const workspaceFile = path.join(String(context.workspace_dir), "template_project", "math_ops.ts");
  const actualHash = await sha256File(workspaceFile);
  const expectedHash = String(spec.expected.checks.math_ops_sha256);
  const passed = actualHash === expectedHash && report.tests.status === "passed" && report.tests.passed >= 2;
  return {
    passed,
    reasons: passed ? [] : ["codegen_exec verification failed"],
    details: { actual_hash: actualHash, expected_hash: expectedHash, report: report as unknown as Record<string, unknown> },
  };
}

export function verifyVulnScan(spec: ScenarioSpec, context: Record<string, unknown>): VerifierResult {
  const task = taskMap(context)["scan-fixtures"];
  const report = reportFor(task) as {
    findings: Array<{ id: string }>;
    summary: { high: number };
  };
  const expectedIds = [...(spec.expected.checks.finding_ids as string[])].sort();
  const actualIds = report.findings.map((item) => item.id).sort();
  const passed = JSON.stringify(expectedIds) === JSON.stringify(actualIds) && report.summary.high === spec.expected.checks.high_count;
  return {
    passed,
    reasons: passed ? [] : ["vulnerability findings do not match expected set"],
    details: { actual_ids: actualIds, expected_ids: expectedIds, report: report as unknown as Record<string, unknown> },
  };
}

export function verifyMultiStepAgent(spec: ScenarioSpec, context: Record<string, unknown>): VerifierResult {
  const task = taskMap(context)["render-summary"];
  const report = reportFor(task) as {
    summary: { status: string; items: number };
    evidence_count: number;
  };
  const passed =
    report.summary.status === "success" &&
    report.summary.items === spec.expected.checks.summary_items &&
    report.evidence_count >= Number(spec.expected.checks.minimum_evidence_count);
  return {
    passed,
    reasons: passed ? [] : ["multi-step aggregation did not produce the expected report"],
    details: report as unknown as Record<string, unknown>,
  };
}

export function verifyLongChainDag(spec: ScenarioSpec, context: Record<string, unknown>): VerifierResult {
  const task = taskMap(context)["join-final"];
  const report = reportFor(task) as {
    lineage: string[];
    summary: { status: string };
  };
  const expectedNodes = spec.expected.checks.expected_nodes as string[];
  const passed = JSON.stringify(report.lineage) === JSON.stringify(expectedNodes) && report.summary.status === "success";
  return {
    passed,
    reasons: passed ? [] : ["long_chain_dag lineage did not match expected order"],
    details: report as unknown as Record<string, unknown>,
  };
}
