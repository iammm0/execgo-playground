import { useEffect, useState } from "react";
import { BenchmarkComposer } from "./components/BenchmarkComposer";
import { CommandPanel } from "./components/CommandPanel";
import { HomePage } from "./components/HomePage";
import { Nav } from "./components/Nav";
import { ResultsBoard } from "./components/ResultsBoard";
import { loadWorkspaceSnapshot, runBenchmark, runPlaygroundCommand } from "./lib/tauri";
import type { BenchmarkInput, CommandRun, WorkspaceSnapshot } from "./types";
import "./styles.css";

export type Page = "home" | "benchmark" | "commands" | "results";

type SuccessNotice = {
  id: number;
  runId: string | null;
  runCount: number;
};

const defaultBenchmark: BenchmarkInput = {
  frameworks: ["langgraph"],
  scenarios: ["codegen_exec"],
  chaos_profiles: ["none"],
  mode: "replay",
  repetitions: 1,
  provider: "mock",
  model: "mock-reliability-planner",
  temperature: 0,
  max_tokens: 1200,
  timeout_ms: 60000,
  seed: 7,
};

function App() {
  const [page, setPage] = useState<Page>("home");
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkInput>(defaultBenchmark);
  const [manualCommand, setManualCommand] = useState("run --framework langgraph --scenario codegen_exec --mode replay --chaos none");
  const [lastRun, setLastRun] = useState<CommandRun | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<SuccessNotice | null>(null);

  useEffect(() => {
    loadWorkspaceSnapshot()
      .then((next) => {
        setSnapshot(next);
        setSelectedRunId(next.runs[0]?.run_id ?? null);
        setBenchmark((current) => ({
          ...current,
          frameworks: current.frameworks.filter((f) => next.frameworks.includes(f)).length
            ? current.frameworks.filter((f) => next.frameworks.includes(f))
            : [next.frameworks[0]].filter(Boolean),
          scenarios: current.scenarios.filter((s) => next.scenarios.includes(s)).length
            ? current.scenarios.filter((s) => next.scenarios.includes(s))
            : [next.scenarios[0]].filter(Boolean),
          chaos_profiles: current.chaos_profiles.filter((p) => next.chaos_profiles.includes(p)).length
            ? current.chaos_profiles.filter((p) => next.chaos_profiles.includes(p))
            : ["none"].filter((p) => next.chaos_profiles.includes(p)),
        }));
      })
      .catch((err) => setError(String(err)));
  }, []);

  useEffect(() => {
    if (!successNotice) {
      return;
    }

    const timeout = window.setTimeout(() => setSuccessNotice(null), 8000);
    return () => window.clearTimeout(timeout);
  }, [successNotice]);

  async function runCommand(args: string[]) {
    setBusy(true);
    setError(null);
    try {
      const result = await runPlaygroundCommand(args);
      setLastRun(result);
      setSnapshot(result.snapshot);
      setSelectedRunId(result.snapshot.runs[0]?.run_id ?? null);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function executeBenchmark() {
    setBusy(true);
    setError(null);
    setSuccessNotice(null);
    try {
      const result = await runBenchmark(benchmark);
      setLastRun(result);
      setSnapshot(result.snapshot);
      const latestRunId = result.snapshot.runs[0]?.run_id ?? null;
      setSelectedRunId(latestRunId);
      setSuccessNotice({
        id: Date.now(),
        runId: latestRunId,
        runCount: result.snapshot.runs.length,
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    setError(null);
    try {
      const next = await loadWorkspaceSnapshot();
      setSnapshot(next);
      setSelectedRunId((current) => current ?? next.runs[0]?.run_id ?? null);
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <main className="app-shell">
      <Nav current={page} onNavigate={setPage} />

      {error && (
        <div className="error-banner">
          <strong>操作失败</strong>
          <span>{error}</span>
        </div>
      )}

      {successNotice && (
        <div key={successNotice.id} className="success-notice" role="status" aria-live="polite">
          <span className="success-notice-mark" aria-hidden="true" />
          <span className="success-notice-copy">
            <strong>测评已完成</strong>
            <span>已生成最新测评结果，请前往测评结果查看。</span>
          </span>
          <span className="success-notice-count">{successNotice.runCount} 组结果</span>
          <button
            className="success-notice-action"
            onClick={() => {
              if (successNotice.runId) {
                setSelectedRunId(successNotice.runId);
              }
              setPage("results");
              setSuccessNotice(null);
            }}
          >
            查看结果
          </button>
        </div>
      )}

      {page === "home" && (
        <HomePage
          snapshot={snapshot}
          busy={busy}
          onRunCommand={runCommand}
          onRunBenchmark={executeBenchmark}
          onRefresh={refresh}
          onNavigate={setPage}
        />
      )}

      {page === "benchmark" && (
        <BenchmarkComposer
          snapshot={snapshot}
          value={benchmark}
          busy={busy}
          onChange={setBenchmark}
          onRun={executeBenchmark}
        />
      )}

      {page === "commands" && (
        <CommandPanel
          value={manualCommand}
          busy={busy}
          lastRun={lastRun}
          onChange={setManualCommand}
          onRun={runCommand}
        />
      )}

      {page === "results" && (
        <ResultsBoard
          runs={snapshot?.runs ?? []}
          selectedRunId={selectedRunId}
          onSelect={setSelectedRunId}
        />
      )}
    </main>
  );
}

export default App;
