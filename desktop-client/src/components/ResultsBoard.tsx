import type { RunSummary } from "../types";
import { formatChaosName, formatFrameworkName, formatModeName, formatScenarioName } from "../lib/display";

type Props = {
  runs: RunSummary[];
  selectedRunId: string | null;
  onSelect: (runId: string) => void;
};

export function ResultsBoard({ runs, selectedRunId, onSelect }: Props) {
  const selected = runs.find((run) => run.run_id === selectedRunId) ?? runs[0] ?? null;
  const grouped = runs.reduce<Record<string, RunSummary[]>>((acc, run) => {
    const key = run.scenario_id || "未识别场景";
    acc[key] = acc[key] ?? [];
    acc[key].push(run);
    return acc;
  }, {});

  return (
    <section className="results-layout">
      <div className="panel result-list">
        <div className="panel-heading compact">
          <div>
            <p className="eyebrow">运行记录</p>
            <h2>测评结果</h2>
          </div>
          <span className="count-pill">{runs.length} 组</span>
        </div>

        {runs.length === 0 && <div className="empty-state">还没有结果。先运行一次命令或发起一次测评。</div>}

        {Object.entries(grouped).map(([scenario, scenarioRuns]) => (
          <div className="run-group" key={scenario}>
            <h3>{formatScenarioName(scenario)}</h3>
            <div className="run-cards">
              {scenarioRuns.map((run) => (
                <button
                  key={run.run_id}
                  className={run.run_id === selectedRunId ? "run-card active" : "run-card"}
                  onClick={() => onSelect(run.run_id)}
                >
                  <span className={run.verdict_passed ? "status-dot pass" : "status-dot fail"} />
                  <strong>{formatFrameworkName(run.framework)}</strong>
                  <span>{formatModeName(run.mode)} / {formatChaosName(run.chaos_profile)}</span>
                  <span>{run.wall_time_ms}ms</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="panel result-detail">
        {selected ? (
          <>
            <div className="detail-header">
              <div>
                <p className="eyebrow">当前结果</p>
                <h2>{formatFrameworkName(selected.framework)} · {formatScenarioName(selected.scenario_id)}</h2>
              </div>
              <span className={selected.verdict_passed ? "verdict pass" : "verdict fail"}>
                {selected.verdict_passed ? "通过" : "失败"}
              </span>
            </div>

            <div className="metric-grid">
              <Metric label="耗时" value={`${selected.wall_time_ms} ms`} />
              <Metric label="任务数" value={`${selected.task_count}`} />
              <Metric label="阶段数" value={`${selected.stage_count}`} />
              <Metric label="运行时失败数" value={`${selected.runtime_failure_count}`} />
            </div>

            <div className="score-row">
              <Score label="提交接受率" value={selected.submit_accept_rate} />
              <Score label="产物匹配率" value={selected.artifact_hash_match} />
            </div>

            {selected.reasons.length > 0 && (
              <div className="reason-box">
                <strong>失败原因</strong>
                {selected.reasons.map((reason) => (
                  <p key={reason}>{reason}</p>
                ))}
              </div>
            )}

            <div className="path-list">
              <PathLine label="运行目录" value={selected.run_dir} />
              <PathLine label="结果文件" value={selected.result_path} />
              <PathLine label="摘要文件" value={selected.summary_path} />
              <PathLine label="时间线文件" value={selected.timeline_path} />
            </div>
          </>
        ) : (
          <div className="empty-state">选择一组结果查看详情。</div>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  const percent = Math.round(value * 100);
  return (
    <div className="score-card">
      <div>
        <span>{label}</span>
        <strong>{percent}%</strong>
      </div>
      <div className="score-track">
        <span style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
      </div>
    </div>
  );
}

function PathLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="path-line">
      <span>{label}</span>
      <code title={value}>{value}</code>
    </div>
  );
}
