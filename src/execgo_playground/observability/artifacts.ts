import path from "node:path";
import type { ArtifactManifest } from "../models.js";
import { ensureDir, writeJson, writeText } from "../utils.js";

export class ArtifactManager {
  rootDir: string;
  runDir: string;

  constructor(rootDir: string, runId: string) {
    this.rootDir = rootDir;
    this.runDir = path.join(rootDir, runId);
  }

  async init(): Promise<this> {
    await ensureDir(this.rootDir);
    await ensureDir(this.runDir);
    return this;
  }

  path(name: string): string {
    const names: Record<string, string> = {
      plan: "plan.json",
      timeline: "timeline.jsonl",
      snapshots: "execgo_snapshots.jsonl",
      trace: "adapter_trace.json",
      result: "result.json",
      summary: "summary.md",
    };
    return path.join(this.runDir, names[name]);
  }

  writeJson(name: string, data: unknown): Promise<string> {
    return writeJson(this.path(name), data);
  }

  writeText(name: string, content: string): Promise<string> {
    return writeText(this.path(name), content);
  }

  manifest(): ArtifactManifest {
    return {
      run_dir: this.runDir,
      plan_path: this.path("plan"),
      timeline_path: this.path("timeline"),
      snapshot_path: this.path("snapshots"),
      adapter_trace_path: this.path("trace"),
      result_path: this.path("result"),
      summary_path: this.path("summary"),
    };
  }
}
