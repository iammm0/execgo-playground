import type { CommandRun } from "../types";
import { parseArgs } from "../lib/args";

type Props = {
  value: string;
  busy: boolean;
  lastRun: CommandRun | null;
  onChange: (value: string) => void;
  onRun: (args: string[]) => void;
};

const presets = [
  { label: "刷新契约", value: "schema export --out shared/spec" },
  { label: "启动执行环境", value: "harness up --build" },
  { label: "停止执行环境", value: "harness down" },
  { label: "烟雾验证", value: "run --framework langgraph --scenario codegen_exec --mode replay --chaos none" },
];

export function CommandPanel({ value, busy, lastRun, onChange, onRun }: Props) {
  return (
    <section className="panel command-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">本地子进程</p>
          <h2>手动调用训练场命令</h2>
        </div>
        <button className="primary-button" disabled={busy} onClick={() => onRun(parseArgs(value))}>
          {busy ? "运行中..." : "运行命令"}
        </button>
      </div>

      <div className="preset-row">
        {presets.map((preset) => (
          <button key={preset.label} className="ghost-button" disabled={busy} onClick={() => onChange(preset.value)}>
            {preset.label}
          </button>
        ))}
      </div>

      <label className="field-label" htmlFor="manual-command">
        npm run cli --
      </label>
      <textarea
        id="manual-command"
        value={value}
        spellCheck={false}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder="benchmark --framework langgraph --scenario codegen_exec --chaos none --mode replay"
      />

      {lastRun && (
        <div className="terminal-card">
          <div className="terminal-meta">
            <span>退出码：{lastRun.exit_code ?? "信号终止"}</span>
            <span>{lastRun.command.join(" ")}</span>
          </div>
          <pre>{lastRun.stdout || lastRun.stderr || "命令没有输出。"}</pre>
          {lastRun.stderr && <pre className="stderr">{lastRun.stderr}</pre>}
        </div>
      )}
    </section>
  );
}
