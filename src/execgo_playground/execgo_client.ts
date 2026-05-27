import { setTimeout as sleep } from "node:timers/promises";
import type { SubmitPolicy } from "./models.js";

export class ExecGoClient {
  baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  adapterCapabilities(): Promise<Record<string, unknown>> {
    return this.request("GET", "/adapters/capabilities");
  }

  adapterTools(): Promise<Record<string, unknown>> {
    return this.request("GET", "/adapters/tools");
  }

  adapterTranslate(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request("POST", "/adapters/translate", payload);
  }

  adapterActions(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request("POST", "/adapters/actions", payload);
  }

  submitTasks(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request("POST", "/tasks", payload);
  }

  getTask(taskId: string): Promise<Record<string, unknown>> {
    return this.request("GET", `/tasks/${taskId}`);
  }

  metrics(): Promise<Record<string, unknown>> {
    return this.request("GET", "/metrics");
  }

  health(): Promise<Record<string, unknown>> {
    return this.request("GET", "/health");
  }

  async listTasks(): Promise<Record<string, unknown>[]> {
    const data = await this.requestRaw("GET", "/tasks");
    return Array.isArray(data) ? data.filter((row): row is Record<string, unknown> => !!row && typeof row === "object" && !Array.isArray(row)) : [];
  }

  async deleteTask(taskId: string): Promise<void> {
    await fetch(`${this.baseUrl}/tasks/${taskId}`, { method: "DELETE" });
  }

  mcpTools(): Promise<Record<string, unknown>> {
    return this.request("GET", "/mcp/tools");
  }

  mcpCall(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request("POST", "/mcp/call", payload);
  }

  mcpGetTask(taskId: string): Promise<Record<string, unknown>> {
    return this.request("GET", `/mcp/tasks/${taskId}`);
  }

  async waitForTasks(taskIds: string[], policy: SubmitPolicy): Promise<[Record<string, unknown>[], Record<string, unknown>[]]> {
    const snapshots: Record<string, unknown>[] = [];
    const terminal = new Set(["success", "failed", "skipped"]);
    let tasks: Record<string, unknown>[] = [];
    for (let attempt = 0; attempt < policy.max_attempts; attempt += 1) {
      tasks = [];
      for (const taskId of taskIds) {
        try {
          tasks.push(await this.getTask(taskId));
        } catch (error) {
          if (error instanceof HttpError && error.status === 404) {
            tasks.push({ id: taskId, status: "pending", error: "not yet visible" });
          } else {
            throw error;
          }
        }
      }
      snapshots.push({
        tasks,
        metrics: await this.metrics(),
        timestamp_ms: Date.now(),
      });
      if (tasks.length > 0 && tasks.every((task) => terminal.has(String(task.status)))) {
        return [tasks, snapshots];
      }
      await sleep(policy.poll_interval_ms);
    }
    return [tasks, snapshots];
  }

  private async requestRaw(method: string, route: string, payload?: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${route}`, {
      method,
      headers: payload === undefined ? undefined : { "Content-Type": "application/json" },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new HttpError(response.status, text || response.statusText);
    }
    return text ? JSON.parse(text) : undefined;
  }

  private async request(method: string, route: string, payload?: Record<string, unknown>): Promise<Record<string, unknown>> {
    const data = await this.requestRaw(method, route, payload);
    if (data === undefined || data === null) {
      return {};
    }
    if (typeof data === "object" && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
    throw new Error(`expected JSON object from ${route}, got ${Array.isArray(data) ? "array" : typeof data}`);
  }
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
