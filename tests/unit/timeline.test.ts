import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { TimelineRecorder } from "../../src/execgo_playground/observability/index.js";

test("timeline flushes jsonl", async () => {
  const file = path.join(tmpdir(), `execgo-playground-${Date.now()}-timeline.jsonl`);
  const recorder = new TimelineRecorder(file);
  recorder.record({
    run_id: "run-1",
    framework: "langgraph",
    scenario_id: "codegen_exec",
    phase: "plan",
    event_type: "run_started",
    status: "started",
  });
  await recorder.flush();
  const rows = (await readFile(file, "utf8")).trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
  assert.equal(rows[0].run_id, "run-1");
  assert.equal(rows[0].event_type, "run_started");
});
