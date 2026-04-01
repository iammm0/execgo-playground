# 场景与验收

## 场景目录

- `scenarios/basic`: 最小 DAG 正常流
- `scenarios/retry_timeout`: 包含重试与超时的失败流
- `scenarios/hitl`: 人在环审批流（可选）

每个场景至少包含：

- `request.json`: 训练输入
- `expected.result.json`: 期望输出关键字段
- `notes.md`: 业务意图、判分点与常见错误

## 验收规则

1. 三语言对同一场景输出一致的 `result_version`
2. `summary.status_count` 统计一致
3. 失败任务均带有 `failure_reason`
4. `repro.execgo_endpoint` 与 `repro.request_hash` 字段存在
5. 报告可追溯到具体 task id

## 推荐执行顺序

1. 启动前先执行 `pwsh ./scripts/check-execgo-version.ps1`
2. `basic`
3. `retry_timeout`
4. `hitl`
