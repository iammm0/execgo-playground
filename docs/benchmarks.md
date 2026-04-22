# Benchmark 指南

## 运行矩阵

平台默认支持以下维度：

- `framework`
  - `langgraph`
  - `crewai`
  - `autogen`
- `scenario`
  - `codegen_exec`
  - `vuln_scan`
  - `multi_step_agent`
  - `long_chain_dag`
- `mode`
  - `live`
  - `replay`
- `chaos`
  - `none`
  - 以及 `chaos/profiles/*.json`

## 统一指标

- `plan_validity`
- `submit_accept_rate`
- `scenario_success`
- `recovery_success`
- `wall_time_ms`
- `stage_count`
- `task_count`
- `retry_count`
- `timeout_count`
- `runtime_failure_count`
- `invalid_action_count`
- `determinism_drift`
- `artifact_hash_match`

## 输出

每次 benchmark 会生成：

- `var/runs/<run_id>/...`
- `var/runs/benchmark-summary.json`
- `var/runs/benchmark-summary.md`

## 示例

```bash
python3 -m execgo_playground benchmark \
  --framework langgraph \
  --framework crewai \
  --framework autogen \
  --scenario codegen_exec \
  --scenario long_chain_dag \
  --chaos none \
  --chaos runtime_restart \
  --mode replay \
  --repetitions 2
```
