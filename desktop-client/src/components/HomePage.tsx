import type { Page } from "../App";
import type { WorkspaceSnapshot } from "../types";
import { formatFrameworkName, formatModeName, formatChaosName } from "../lib/display";

type Props = {
  snapshot: WorkspaceSnapshot | null;
  busy: boolean;
  onRunCommand: (args: string[]) => void;
  onRunBenchmark: () => void;
  onRefresh: () => void;
  onNavigate: (page: Page) => void;
};

const quickActions = [
  { label: "启动执行环境", args: ["harness", "up", "--build"] },
  { label: "停止执行环境", args: ["harness", "down"] },
  { label: "烟雾验证", args: ["run", "--framework", "langgraph", "--scenario", "codegen_exec", "--mode", "replay", "--chaos", "none"] },
  { label: "刷新契约", args: ["schema", "export", "--out", "shared/spec"] },
];

export function HomePage({ snapshot, busy, onRunCommand, onRunBenchmark, onRefresh, onNavigate }: Props) {
  const runs = snapshot?.runs ?? [];
  const passRate = runs.length
    ? Math.round((runs.filter((r) => r.verdict_passed).length / runs.length) * 100)
    : 0;
  const recentRuns = runs.slice(0, 5);

  return (
    <div className="home-page">
      <header className="hero">
        <div>
          <h1>训练场控制台</h1>
          <p className="hero-copy">AI 编排可靠性训练场 · 本地桌面端</p>
        </div>
        <div className="hero-stats">
          <span>{snapshot?.frameworks.length ?? 0} 个框架</span>
          <span>{snapshot?.scenarios.length ?? 0} 个场景</span>
          <span>通过率 {passRate}%</span>
        </div>
      </header>

      <section className="home-section">
        <h2>快捷操作</h2>
        <div className="quick-actions">
          {quickActions.map((action) => (
            <button
              key={action.label}
              className="action-card"
              disabled={busy}
              onClick={() => onRunCommand(action.args)}
            >
              {action.label}
            </button>
          ))}
          <button className="action-card accent" disabled={busy} onClick={onRunBenchmark}>
            快速测评
          </button>
          <button className="action-card" disabled={busy} onClick={onRefresh}>
            刷新结果
          </button>
        </div>
      </section>

      <section className="home-section">
        <div className="section-header">
          <h2>最近运行</h2>
          {runs.length > 5 && (
            <button className="ghost-button" onClick={() => onNavigate("results")}>
              查看全部
            </button>
          )}
        </div>
        {recentRuns.length === 0 && <p className="empty-state">还没有运行记录。</p>}
        <div className="recent-runs">
          {recentRuns.map((run) => (
            <div key={run.run_id} className="recent-run-card">
              <span className={run.verdict_passed ? "status-dot pass" : "status-dot fail"} />
              <strong>{formatFrameworkName(run.framework)}</strong>
              <span>{formatModeName(run.mode)} / {formatChaosName(run.chaos_profile)}</span>
              <span>{run.wall_time_ms}ms</span>
            </div>
          ))}
        </div>
      </section>

      <section className="home-section">
        <h2>工作区</h2>
        <div className="workspace-info">
          <div>
            <span>训练场目录</span>
            <code>{snapshot?.playground_root ?? "加载中..."}</code>
          </div>
          <div>
            <span>Node CLI</span>
            <code>{snapshot?.node_bin ?? "npm"}</code>
          </div>
        </div>
      </section>
    </div>
  );
}
