import path from "node:path";
import type { BenchmarkResult, BenchmarkRunRequest } from "../models.js";
import { ExperimentRunner } from "../runner.js";
import { writeJson, writeText } from "../utils.js";
import { renderBenchmarkSummary } from "./report.js";

export class BenchmarkRunner {
  constructor(private readonly runner: ExperimentRunner) {}

  async run(request: BenchmarkRunRequest): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];
    for (const framework of request.frameworks) {
      for (const scenario of request.scenarios) {
        for (const chaosProfile of request.chaos_profiles) {
          for (let repetition = 0; repetition < request.repetitions; repetition += 1) {
            const result = await this.runner.run({
              framework,
              scenarioId: scenario,
              mode: request.mode,
              chaosProfileId: chaosProfile,
              modelProfile: request.model_profile,
              repetition,
            });
            results.push(result);
          }
        }
      }
    }
    const summaryPath = path.join(this.runner.harness.runRoot, "benchmark-summary.json");
    await writeJson(summaryPath, results);
    await writeText(summaryPath.replace(/\.json$/, ".md"), renderBenchmarkSummary(results));
    return results;
  }
}
