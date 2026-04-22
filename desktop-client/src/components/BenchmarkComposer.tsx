import type { BenchmarkInput, WorkspaceSnapshot } from "../types";
import { formatChaosName, formatFrameworkName, formatScenarioName } from "../lib/display";

type Props = {
  snapshot: WorkspaceSnapshot | null;
  value: BenchmarkInput;
  busy: boolean;
  onChange: (value: BenchmarkInput) => void;
  onRun: () => void;
};

export function BenchmarkComposer({ snapshot, value, busy, onChange, onRun }: Props) {
  const update = <Key extends keyof BenchmarkInput>(key: Key, next: BenchmarkInput[Key]) => {
    onChange({ ...value, [key]: next });
  };

  const toggleListValue = (key: "frameworks" | "scenarios" | "chaos_profiles", item: string) => {
    const current = value[key];
    update(
      key,
      current.includes(item) ? current.filter((entry) => entry !== item) : [...current, item],
    );
  };

  return (
    <section className="panel benchmark-panel">
      <div className="panel-heading compact">
        <div>
          <p className="eyebrow">测评矩阵</p>
          <h2>配置测评任务</h2>
        </div>
        <button className="primary-button" disabled={busy} onClick={onRun}>
          {busy ? "执行中..." : "运行测评"}
        </button>
      </div>

      <fieldset>
        <legend>frameworks / 编排框架</legend>
        <div className="chip-grid">
          {(snapshot?.frameworks ?? []).map((framework) => (
            <label key={framework} className={value.frameworks.includes(framework) ? "chip selected" : "chip"}>
              <input
                type="checkbox"
                checked={value.frameworks.includes(framework)}
                onChange={() => toggleListValue("frameworks", framework)}
              />
              {formatFrameworkName(framework)} / {framework}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>scenarios / 测试场景</legend>
        <div className="chip-grid">
          {(snapshot?.scenarios ?? []).map((scenario) => (
            <label key={scenario} className={value.scenarios.includes(scenario) ? "chip selected" : "chip"}>
              <input
                type="checkbox"
                checked={value.scenarios.includes(scenario)}
                onChange={() => toggleListValue("scenarios", scenario)}
              />
              {formatScenarioName(scenario)} / {scenario}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>chaos profiles / 故障注入配置</legend>
        <div className="chip-grid">
          {(snapshot?.chaos_profiles ?? []).map((profile) => (
            <label key={profile} className={value.chaos_profiles.includes(profile) ? "chip selected" : "chip"}>
              <input
                type="checkbox"
                checked={value.chaos_profiles.includes(profile)}
                onChange={() => toggleListValue("chaos_profiles", profile)}
              />
              {formatChaosName(profile)} / {profile}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="form-grid">
        <label>
          mode / 运行模式
          <select value={value.mode} onChange={(event) => update("mode", event.currentTarget.value as "live" | "replay")}>
            <option value="replay">replay / 回放</option>
            <option value="live">live / 实时</option>
          </select>
        </label>
        <label>
          repetitions / 重复次数
          <input type="number" min={1} value={value.repetitions} onChange={(event) => update("repetitions", Number(event.currentTarget.value))} />
        </label>
        <label>
          provider / 模型提供方
          <input value={value.provider} onChange={(event) => update("provider", event.currentTarget.value)} />
        </label>
        <label>
          model / 模型名称
          <input value={value.model} onChange={(event) => update("model", event.currentTarget.value)} />
        </label>
        <label>
          temperature / 温度
          <input type="number" step="0.1" value={value.temperature} onChange={(event) => update("temperature", Number(event.currentTarget.value))} />
        </label>
        <label>
          seed / 随机种子
          <input type="number" value={value.seed} onChange={(event) => update("seed", Number(event.currentTarget.value))} />
        </label>
      </div>
    </section>
  );
}
