# Chaos 指南

## 目标

Chaos 不是为了随机破坏，而是为了回答两个问题：

1. 计划在异常环境下是否还能被正确归因？
2. 系统在异常发生后是否能恢复、重试或明确失败？

## Profile 位置

所有 profile 都位于：

```text
chaos/profiles/*.json
```

## 已内建的 profile

- `none`
  - 不注入故障
- `invalid_tool`
  - 在 plan 阶段把任务类型改成不存在的工具
- `runtime_restart`
  - 在 runtime 阶段重启 runtime 容器
- `fixture_latency`
  - 让 fixture service 注入延迟
- `resource_pressure`
  - 对 runtime 容器施加 CPU / 内存限制

## Action 类型

- `inject_invalid_action`
- `inject_bad_dependency`
- `drop_required_binding`
- `force_timeout_budget`
- `restart_service`
- `kill_service`
- `resource_pressure`
- `fixture_mode`

## 设计约束

- 所有 chaos 行为必须记录到 `timeline.jsonl`
- 所有运行层 chaos 必须通过 harness 控制，而不是平台外手工操作
- profile 必须声明 `recovery_expectation`
