import { readFile } from "node:fs/promises";

type AnyMap = Record<string, unknown>;

type TrainingRequest = {
  request_id: string;
  execgo_endpoint: string;
  poll?: { interval_ms?: number; max_attempts?: number };
  tasks: AnyMap[];
};

type TaskStatus = {
  id: string;
  status: string;
  failure_reason?: string;
  output_preview?: string;
};

type TrainingState = {
  request: TrainingRequest;
  taskGraph: AnyMap;
  submission: AnyMap;
  taskStates: TaskStatus[];
  diagnostics: string[];
  finalReport: AnyMap;
};

function parseArgs(): { requestPath: string } {
  const idx = process.argv.indexOf("--request");
  if (idx === -1 || !process.argv[idx + 1]) {
    throw new Error("missing --request");
  }
  return { requestPath: process.argv[idx + 1] };
}

function buildPlan(st: TrainingState): void {
  st.taskGraph = { tasks: st.request.tasks };
}

function validatePlan(st: TrainingState): void {
  if (!st.request.tasks?.length) {
    throw new Error("tasks is empty");
  }
}

async function submitToExecgo(st: TrainingState): Promise<void> {
  const endpoint = st.request.execgo_endpoint.replace(/\/$/, "");
  const resp = await fetch(`${endpoint}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tasks: st.request.tasks }),
  });
  if (!resp.ok) {
    throw new Error(`submit failed: ${resp.status}`);
  }
  st.submission = (await resp.json()) as AnyMap;
}

async function pollUntilDone(st: TrainingState): Promise<void> {
  const endpoint = st.request.execgo_endpoint.replace(/\/$/, "");
  const interval = st.request.poll?.interval_ms ?? 1000;
  const maxAttempts = st.request.poll?.max_attempts ?? 120;
  for (let i = 0; i < maxAttempts; i += 1) {
    const resp = await fetch(`${endpoint}/tasks`);
    if (!resp.ok) {
      st.diagnostics.push(`list failed: ${resp.status}`);
      await sleep(interval);
      continue;
    }
    const actual = (await resp.json()) as AnyMap[];
    st.taskStates = collectTaskStates(st.request.tasks, actual);
    if (isTerminal(st.taskStates)) {
      return;
    }
    await sleep(interval);
  }
  throw new Error("poll timeout");
}

function analyzeFailure(st: TrainingState): void {
  st.taskStates = st.taskStates.map((t) => {
    if (t.status === "failed" && !t.failure_reason) {
      return { ...t, failure_reason: "execgo_task_failed" };
    }
    if (t.status === "skipped" && !t.failure_reason) {
      return { ...t, failure_reason: "blocked_by_dependency" };
    }
    return t;
  });
}

function finalizeReport(st: TrainingState): void {
  const count: Record<string, number> = {
    pending: 0,
    running: 0,
    success: 0,
    failed: 0,
    skipped: 0,
  };
  for (const t of st.taskStates) {
    if (count[t.status] !== undefined) count[t.status] += 1;
  }
  let finalStatus = "success";
  if (count.failed > 0) finalStatus = "failed";
  else if (count.pending > 0 || count.running > 0) finalStatus = "partial_failure";

  st.finalReport = {
    result_version: "v1",
    request_id: st.request.request_id,
    summary: { final_status: finalStatus, status_count: count },
    tasks: st.taskStates,
    diagnostics: st.diagnostics,
    repro: {
      execgo_endpoint: st.request.execgo_endpoint,
      request_hash: st.request.request_id,
    },
  };
}

function collectTaskStates(expect: AnyMap[], actual: AnyMap[]): TaskStatus[] {
  const idx = new Map<string, AnyMap>();
  for (const row of actual) {
    const id = String(row.id ?? "");
    if (id) idx.set(id, row);
  }
  return expect.map((task) => {
    const id = String(task.id ?? "");
    const row = idx.get(id) ?? {};
    return {
      id,
      status: String(row.status ?? "pending"),
      failure_reason: row.error ? String(row.error) : "",
      output_preview: row.result ? String(row.result) : "",
    };
  });
}

function isTerminal(tasks: TaskStatus[]): boolean {
  return tasks.length > 0 && tasks.every((t) => t.status !== "pending" && t.status !== "running");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const { requestPath } = parseArgs();
  const raw = await readFile(requestPath, "utf-8");
  const req = JSON.parse(raw) as TrainingRequest;

  const st: TrainingState = {
    request: req,
    taskGraph: {},
    submission: {},
    taskStates: [],
    diagnostics: [],
    finalReport: {},
  };

  buildPlan(st);
  validatePlan(st);
  await submitToExecgo(st);
  try {
    await pollUntilDone(st);
  } catch (err) {
    st.diagnostics.push(String(err));
  }
  analyzeFailure(st);
  finalizeReport(st);
  process.stdout.write(`${JSON.stringify(st.finalReport, null, 2)}\n`);
}

main().catch((err) => {
  process.stderr.write(`${String(err)}\n`);
  process.exit(1);
});
