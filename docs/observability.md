# 可观测性说明

平台默认把每次实验的证据链落盘为 artifacts。

## 核心文件

- `plan.json`
  - 归一化后的 `StandardPlan`
- `adapter_trace.json`
  - 框架原始 trace 或 provider trace
- `timeline.jsonl`
  - 统一事件流
- `execgo_snapshots.jsonl`
  - 轮询期间的 `/tasks` 与 `/metrics` 快照
- `result.json`
  - verdict、metrics、stage results
- `summary.md`
  - 简短人类可读摘要

## TimelineEvent 字段

- `run_id`
- `timestamp`
- `phase`
- `framework`
- `scenario_id`
- `stage_id`
- `task_id`
- `event_type`
- `status`
- `input_ref`
- `output_ref`
- `error_code`
- `metadata`

## 使用方式

### 看一次 run 的完整链路

1. 先读 `summary.md`
2. 再看 `result.json`
3. 若需追根溯源，再查 `timeline.jsonl`
4. 若怀疑运行态问题，再结合 `execgo_snapshots.jsonl`

### 看框架间对比

优先使用 benchmark summary，再回到单 run artifacts 深挖差异。
