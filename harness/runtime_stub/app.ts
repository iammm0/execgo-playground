import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import http from "node:http";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import process from "node:process";
import { randomUUID } from "node:crypto";

type RuntimeExecution = Record<string, unknown>;

function utcNow(): string {
  return new Date().toISOString();
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

class RuntimeTask {
  taskId: string;
  handleId: string;
  execution: RuntimeExecution;
  status = "accepted";
  output: unknown;
  error?: Record<string, unknown>;
  startedAt?: string;
  finishedAt?: string;
  durationMs = 0;
  events: Record<string, unknown>[];
  process?: ChildProcessWithoutNullStreams;

  constructor(taskId: string, execution: RuntimeExecution) {
    this.taskId = taskId;
    this.handleId = `${taskId}-${randomUUID().slice(0, 8)}`;
    this.execution = execution;
    this.events = [{ type: "task_accepted", task_id: taskId, handle_id: this.handleId, timestamp: utcNow() }];
  }

  addEvent(type: string, message = "", data: Record<string, unknown> = {}): void {
    this.events.push({
      type,
      task_id: this.taskId,
      handle_id: this.handleId,
      timestamp: utcNow(),
      message,
      data,
    });
  }

  asDict(): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      task_id: this.taskId,
      handle_id: this.handleId,
      status: this.status,
      started_at: this.startedAt,
      finished_at: this.finishedAt,
      duration_ms: this.durationMs,
    };
    if (this.output !== undefined) {
      payload.output = this.output;
    }
    if (this.error) {
      payload.error = this.error;
    }
    return payload;
  }
}

class RuntimeStore {
  tasks = new Map<string, RuntimeTask>();
  handleToTask = new Map<string, string>();

  create(taskId: string, execution: RuntimeExecution): RuntimeTask {
    const task = new RuntimeTask(taskId, execution);
    this.tasks.set(taskId, task);
    this.handleToTask.set(task.handleId, taskId);
    return task;
  }

  get(ref: string): RuntimeTask | undefined {
    return this.tasks.get(this.handleToTask.get(ref) ?? ref);
  }
}

const store = new RuntimeStore();

async function runTask(task: RuntimeTask): Promise<void> {
  const started = Date.now();
  task.status = "running";
  task.startedAt = utcNow();
  task.addEvent("task_started");
  const kind = task.execution.kind;
  try {
    if (kind === "command") {
      await runCommand(task);
    } else if (kind === "emit") {
      await delay(Number(task.execution.delay_ms ?? 0));
      task.output = task.execution.payload ?? {};
      task.status = "success";
    } else if (kind === "sleep") {
      const duration = Number(task.execution.duration_ms ?? 0);
      await delay(duration);
      task.output = { slept_ms: duration };
      task.status = "success";
    } else if (kind === "fail") {
      await delay(Number(task.execution.delay_ms ?? 0));
      task.error = {
        code: task.execution.code ?? "external_failure",
        message: task.execution.message ?? "runtime requested failure",
      };
      task.status = "failed";
    } else {
      task.error = { code: "invalid_input", message: `unsupported execution kind: ${String(kind)}` };
      task.status = "failed";
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    task.error = { code: message.includes("timed out") ? "timeout" : "external_failure", message };
    task.status = "failed";
  } finally {
    task.durationMs = Date.now() - started;
    task.finishedAt = utcNow();
    task.addEvent(task.status === "success" ? "task_succeeded" : "task_failed", "", { duration_ms: task.durationMs });
  }
}

async function runCommand(task: RuntimeTask): Promise<void> {
  const program = String(task.execution.program);
  const args = Array.isArray(task.execution.args) ? task.execution.args.map(String) : [];
  const cwd = task.execution.cwd === undefined ? undefined : String(task.execution.cwd);
  const timeoutMs = Number(task.execution.timeout_ms ?? 15000);
  const env = {
    ...process.env,
    ...Object.fromEntries(
      Object.entries((task.execution.env ?? {}) as Record<string, unknown>).map(([key, value]) => [key, String(value)]),
    ),
  };
  await mkdir(cwd ?? "/workspace", { recursive: true });

  await new Promise<void>((resolve, reject) => {
    const child = spawn(program, args, { cwd, env });
    task.process = child;
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`command timed out after ${timeoutMs} ms`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      const parsed = stdout.trim() ? parseJson(stdout.trim()) : undefined;
      if (code !== 0) {
        task.error = {
          code: "exit_nonzero",
          message: stderr.trim() || `process exited with code ${code}`,
          details: { stdout, stderr, exit_code: code },
        };
        task.status = "failed";
        resolve();
        return;
      }
      task.output = parsed ?? { stdout, stderr, exit_code: code };
      task.status = "success";
      resolve();
    });
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function json(response: http.ServerResponse, payload: Record<string, unknown>, status = 200): void {
  const body = Buffer.from(JSON.stringify(payload));
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": body.length,
  });
  response.end(body);
}

async function readJson(request: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const route = url.pathname;

  if (request.method === "GET") {
    if (route === "/readyz") return json(response, { status: "ok" });
    if (route === "/api/v1/runtime/info") return json(response, { name: "runtime-stub", version: "0.1.0" });
    if (route === "/api/v1/runtime/capabilities") return json(response, { execution_kinds: ["command", "emit", "sleep", "fail"] });
    if (route === "/api/v1/runtime/resources") return json(response, { workspace: "/workspace", cpu_count: os.cpus().length });
    if (route === "/api/v1/runtime/config") return json(response, { read_only_mount: "/playground", workspace_mount: "/workspace" });
    if (route.startsWith("/api/v1/tasks/") && route.endsWith("/events")) {
      const ref = route.replace("/api/v1/tasks/", "").replace("/events", "");
      const task = store.get(ref);
      return task ? json(response, { events: task.events }) : json(response, { error: { code: "not_found", message: "task not found" } }, 404);
    }
    if (route.startsWith("/api/v1/tasks/")) {
      const task = store.get(route.replace("/api/v1/tasks/", ""));
      return task ? json(response, task.asDict()) : json(response, { error: { code: "not_found", message: "task not found" } }, 404);
    }
    return json(response, { error: { code: "not_found", message: "unknown route" } }, 404);
  }

  if (request.method === "POST") {
    if (route === "/api/v1/tasks") {
      const body = await readJson(request);
      const execution = body.execution;
      const taskId = body.task_id;
      if (!taskId || !execution || typeof execution !== "object" || Array.isArray(execution)) {
        return json(response, { error: { code: "invalid_input", message: "task_id and execution are required" } }, 400);
      }
      const task = store.create(String(taskId), execution as RuntimeExecution);
      void runTask(task);
      return json(response, { task_id: task.taskId, handle_id: task.handleId, status: task.status }, 202);
    }
    if (route === "/control/fail-fast") {
      process.kill(process.pid, "SIGTERM");
      return json(response, { status: "terminating" });
    }
    if (route.startsWith("/api/v1/tasks/") && route.endsWith("/kill")) {
      const ref = route.replace("/api/v1/tasks/", "").replace("/kill", "");
      const task = store.get(ref);
      if (!task) {
        return json(response, { error: { code: "not_found", message: "task not found" } }, 404);
      }
      if (task.process && !task.process.killed) {
        task.process.kill("SIGTERM");
      }
      task.status = "cancelled";
      task.finishedAt = utcNow();
      task.error = { code: "cancelled", message: "task cancelled" };
      task.addEvent("task_cancelled");
      return json(response, task.asDict());
    }
  }

  return json(response, { error: { code: "not_found", message: "unknown route" } }, 404);
});

server.listen(8080, "0.0.0.0");
