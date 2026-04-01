# 上手指南

## 0. 启动前版本预检查（必做）

每次启动项目前先执行：

- `pwsh ./scripts/check-execgo-version.ps1`

如果输出包含 `new upstream update detected`，说明上游有更新，请先评估新能力并尝试接入，再继续本轮开发或回归。

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

`run-all.ps1` 在执行三语言回归前，会自动先执行一次版本预检查。

## 4. 验收结果

执行后会在 `out/` 下产生三语言结果文件，可用 `scripts/compare-results.ps1` 做字段级一致性校验。

## 5. 对齐新版后更新锁文件

当你确认已经完成对上游新版本（release/tag/commit）的评估与接入后，执行：

- `pwsh ./scripts/check-execgo-version.ps1 -UpdateLock`

该命令会更新 `shared/execgo.version.lock.json`，作为项目新的对齐基线。
