import type { BenchmarkResult } from "../models.js";

export function renderRunSummary(result: BenchmarkResult): string {
  const metrics = result.metrics;
  const verdict = result.verdict.passed ? "PASS" : "FAIL";
  return [
    `# Run Summary: ${result.run_id}`,
    "",
    `- Framework: \`${result.framework}\``,
    `- Scenario: \`${result.scenario_id}\``,
    `- Mode: \`${result.mode}\``,
    `- Chaos: \`${result.chaos_profile}\``,
    `- Verdict: \`${verdict}\``,
    `- Wall time: \`${metrics.wall_time_ms} ms\``,
    `- Tasks: \`${metrics.task_count}\` across \`${metrics.stage_count}\` stage(s)`,
    `- Runtime failures: \`${metrics.runtime_failure_count}\``,
    `- Artifact hash match: \`${metrics.artifact_hash_match}\``,
  ].join("\n");
}

export function renderBenchmarkSummary(results: BenchmarkResult[]): string {
  const grouped = new Map<string, BenchmarkResult[]>();
  for (const result of results) {
    grouped.set(result.framework, [...(grouped.get(result.framework) ?? []), result]);
  }
  const lines = [
    "# Benchmark Summary",
    "",
    "| Framework | Runs | Pass Rate | Avg Wall Time (ms) |",
    "| --- | ---: | ---: | ---: |",
  ];
  for (const [framework, frameworkResults] of [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const total = frameworkResults.length;
    const passes = frameworkResults.filter((item) => item.verdict.passed).length;
    const avg = frameworkResults.reduce((sum, item) => sum + item.metrics.wall_time_ms, 0) / Math.max(total, 1);
    lines.push(`| ${framework} | ${total} | ${(passes / Math.max(total, 1)).toFixed(2)} | ${avg.toFixed(0)} |`);
  }
  return `${lines.join("\n")}\n`;
}
