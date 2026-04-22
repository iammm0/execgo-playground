import { invoke } from "@tauri-apps/api/core";
import type { BenchmarkInput, CommandRun, WorkspaceSnapshot } from "../types";

export function loadWorkspaceSnapshot() {
  return invoke<WorkspaceSnapshot>("load_workspace_snapshot");
}

export function runPlaygroundCommand(args: string[]) {
  return invoke<CommandRun>("run_playground_command", { args });
}

export function runBenchmark(input: BenchmarkInput) {
  return invoke<CommandRun>("run_benchmark", { input });
}
