import { execFileSync } from "node:child_process";
import path from "node:path";
import { ensureDir, repoRoot } from "../utils.js";

export class DockerHarness {
  projectName: string;
  repoRoot: string;
  composeFile: string;
  workspaceDir: string;
  runRoot: string;
  execgoUrl = "http://127.0.0.1:18080";
  runtimeUrl = "http://127.0.0.1:18081";
  fixtureUrl = "http://127.0.0.1:18082";

  constructor(projectName = "execgo-playground") {
    this.projectName = projectName;
    this.repoRoot = repoRoot();
    this.composeFile = path.join(this.repoRoot, "harness", "docker-compose.yml");
    this.workspaceDir = path.join(this.repoRoot, "var", "workspace");
    this.runRoot = path.join(this.repoRoot, "var", "runs");
  }

  async init(): Promise<this> {
    await ensureDir(this.workspaceDir);
    await ensureDir(this.runRoot);
    return this;
  }

  up(build = false): void {
    const args = this.composeArgs("up", "-d");
    if (build) {
      args.push("--build");
    }
    this.run(args);
  }

  down(): void {
    this.run(this.composeArgs("down", "--remove-orphans", "--volumes"));
  }

  restartService(service: string): void {
    this.run(this.composeArgs("restart", service));
  }

  killService(service: string): void {
    this.run(this.composeArgs("kill", service));
  }

  updateServiceResources(service: string, options: { cpus?: string; memory?: string }): void {
    const containerId = this.run(this.composeArgs("ps", "-q", service), true).trim();
    if (!containerId) {
      throw new Error(`service ${service} is not running`);
    }
    const args = ["docker", "update"];
    if (options.cpus) {
      args.push("--cpus", options.cpus);
    }
    if (options.memory) {
      args.push("--memory", options.memory);
    }
    args.push(containerId);
    this.run(args);
  }

  async status(): Promise<Record<string, unknown>> {
    return {
      execgo: await this.getJson(`${this.execgoUrl}/health`),
      runtime: await this.getJson(`${this.runtimeUrl}/readyz`),
      fixtures: await this.getJson(`${this.fixtureUrl}/healthz`),
    };
  }

  resetFixtureMode(): Promise<void> {
    return this.configureFixtureMode({ latency_ms: 0, fail_mode: "none" });
  }

  async configureFixtureMode(payload: { latency_ms?: number; fail_mode?: string }): Promise<void> {
    await fetch(`${this.fixtureUrl}/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latency_ms: payload.latency_ms ?? 0, fail_mode: payload.fail_mode ?? "none" }),
    });
  }

  private composeArgs(...parts: string[]): string[] {
    return ["docker", "compose", "-p", this.projectName, "-f", this.composeFile, ...parts];
  }

  private run(args: string[], captureOutput = false): string {
    return execFileSync(args[0], args.slice(1), {
      cwd: this.repoRoot,
      encoding: "utf8",
      stdio: captureOutput ? ["ignore", "pipe", "pipe"] : "inherit",
    });
  }

  private async getJson(url: string): Promise<unknown> {
    const response = await fetch(url);
    return response.json();
  }
}
