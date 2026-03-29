# ExecGo Client Contract

## 目标

约束各语言编排层与 ExecGo 的交互语义，避免同一场景在不同语言实现中出现行为漂移。

## API 约定

- 提交任务:
  - `POST /tasks`
  - Body: `{ "tasks": [...] }`
- 读取任务:
  - `GET /tasks/{id}`
- 列出任务:
  - `GET /tasks`
- 健康检查:
  - `GET /health`

## 幂等约定

- 编排层必须在提交前计算 `request_hash`（建议 `sha256(request.json)`）
- 相同 `request_hash` 在同一轮运行中只提交一次
- 重试提交时优先走读取接口判断是否已存在

## 轮询约定

- 默认 `interval_ms = 1000`
- 默认 `max_attempts = 120`
- 建议指数退避上限 `5000 ms`
- 达到上限后统一映射为 `timeout`

## 错误映射

- HTTP 4xx -> `failed`（请求构造问题，不自动重试）
- HTTP 5xx -> 可重试（受全局重试预算约束）
- 网络错误 -> 可重试（指数退避）
- 任务状态 `failed` -> 失败分析节点输出 `failure_reason`
- 下游因依赖失败变 `skipped` -> 标记 `blocked_by_dependency`

## 输出对齐

所有语言编排层最终输出必须满足 `shared/spec/training-result.schema.json`。
