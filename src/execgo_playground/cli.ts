#!/usr/bin/env node
import { BenchmarkRunner } from "./benchmarks/runner.js";
import { DockerHarness } from "./harness/index.js";
import { defaultModelProfile, type BenchmarkRunRequest, type ModelProfile, type RunMode } from "./models.js";
import { ExperimentRunner } from "./runner.js";
import { exportSchemas } from "./schema.js";

type ParsedArgs = {
  command?: string;
  rest: string[];
};

function parseEntrypoint(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  return { command, rest };
}

function takeOption(args: string[], name: string, fallback?: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  return args[index + 1];
}

function takeMultiOption(args: string[], name: string): string[] {
  const output: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === name && args[index + 1]) {
      output.push(args[index + 1]);
      index += 1;
    }
  }
  return output;
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function modelProfile(args: string[]): ModelProfile {
  return defaultModelProfile({
    provider: takeOption(args, "--provider", "mock"),
    model: takeOption(args, "--model", "mock-reliability-planner"),
    temperature: Number(takeOption(args, "--temperature", "0")),
    max_tokens: Number(takeOption(args, "--max-tokens", "1200")),
    timeout_ms: Number(takeOption(args, "--timeout-ms", "60000")),
    seed: Number(takeOption(args, "--seed", "7")),
  });
}

function requireOption(args: string[], name: string): string {
  const value = takeOption(args, name);
  if (!value) {
    throw new Error(`missing required option: ${name}`);
  }
  return value;
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const { command, rest } = parseEntrypoint(argv);
  const harness = await new DockerHarness().init();

  if (command === "harness") {
    const [harnessCommand] = rest;
    if (harnessCommand === "up") {
      harness.up(hasFlag(rest, "--build"));
      return 0;
    }
    if (harnessCommand === "down") {
      harness.down();
      return 0;
    }
    if (harnessCommand === "status") {
      console.log(JSON.stringify(await harness.status(), null, 2));
      return 0;
    }
    throw new Error("unsupported harness command");
  }

  if (command === "schema") {
    const outputDir = takeOption(rest, "--out", "shared/spec")!;
    console.log(JSON.stringify(await exportSchemas(outputDir), null, 2));
    return 0;
  }

  const runner = new ExperimentRunner(harness);
  if (command === "run") {
    const result = await runner.run({
      framework: requireOption(rest, "--framework"),
      scenarioId: requireOption(rest, "--scenario"),
      mode: takeOption(rest, "--mode", "replay")!,
      chaosProfileId: takeOption(rest, "--chaos", "none")!,
      modelProfile: modelProfile(rest),
    });
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }

  if (command === "benchmark") {
    const request: BenchmarkRunRequest = {
      frameworks: takeMultiOption(rest, "--framework"),
      scenarios: takeMultiOption(rest, "--scenario"),
      chaos_profiles: takeMultiOption(rest, "--chaos").length ? takeMultiOption(rest, "--chaos") : ["none"],
      mode: takeOption(rest, "--mode", "replay") as RunMode,
      repetitions: Number(takeOption(rest, "--repetitions", "1")),
      model_profile: modelProfile(rest),
    };
    if (request.frameworks.length === 0 || request.scenarios.length === 0) {
      throw new Error("benchmark requires at least one --framework and --scenario");
    }
    const results = await new BenchmarkRunner(runner).run(request);
    console.log(JSON.stringify(results, null, 2));
    return 0;
  }

  throw new Error(`unsupported command: ${command ?? "<empty>"}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    },
  );
}
