# Go Orchestrator (langgraphgo)

该目录提供 Go 版本编排层最小闭环模板，覆盖以下节点：

- `buildPlan`
- `validatePlan`
- `submitToExecgo`
- `pollUntilDone`
- `analyzeFailure`
- `finalizeReport`

## 运行说明

1. 安装依赖（按需）：
   - `go get github.com/tmc/langgraphgo`
2. 运行：
   - `go run ./cmd/orchestrator -request ../../scenarios/basic/request.json`

## 注意

- 该模板优先保证结构清晰，便于训练与扩展。
- 真实生产接入时请补充认证、限流、熔断与观测埋点。
