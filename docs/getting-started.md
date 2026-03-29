# 上手指南

## 1. 启动 ExecGo

先确保本地已启动 ExecGo 服务（默认 `http://localhost:8080`）。

## 2. 运行单语言样例

- Go:
  - `go run ./orchestrators/go/cmd/orchestrator -request ./scenarios/basic/request.json`
- Python:
  - `python -m orchestrators.python.src.main --request ./scenarios/basic/request.json`
- TypeScript:
  - `cd orchestrators/ts && npm install && npm run build && npm run start -- --request ../../scenarios/basic/request.json`

## 3. 一键回归

- PowerShell:
  - `pwsh ./scripts/run-all.ps1`

## 4. 验收结果

执行后会在 `out/` 下产生三语言结果文件，可用 `scripts/compare-results.ps1` 做字段级一致性校验。
