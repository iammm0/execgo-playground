# AGENT 协作说明

本文件约束在本仓库工作的 AI Agent / 开发者协作行为，目标是保证三语言编排实现的一致性，并持续跟进 ExecGo 上游能力演进。

## 1. 项目目标

- 保持 Go / Python / TypeScript 三套 Orchestrator 的语义一致
- 保持输入/输出契约稳定（`shared/spec`）
- 通过 `scenarios/*` 保障行为可回归
- 主动跟进 ExecGo 上游能力变化

## 2. 启动前强制检查（必须执行）

每次进入本项目并准备开始开发、调试、回归前，先执行：

```powershell
pwsh ./scripts/check-execgo-version.ps1
```

执行规则：

1. 如果输出 `new upstream update detected`，必须提醒使用者评估并尝试接入最新 ExecGo 特性。
2. 在未完成评估前，不要把上游更新提示静默忽略。
3. 当确认新版本能力已完成评估/接入后，执行：
   - `pwsh ./scripts/check-execgo-version.ps1 -UpdateLock`
4. 将锁文件变更（`shared/execgo.version.lock.json`）与相关文档一并提交。

## 3. 代码变更约束

1. 变更优先保持三语言语义对齐，避免单语言漂移。
2. 涉及契约字段变更时，先更新 `shared/spec`，再改实现与场景。
3. 涉及执行流程变更时，至少更新一个场景验证（`scenarios/*`）。
4. 回归前使用：
   - `pwsh ./scripts/run-all.ps1`

## 4. 文档维护约束

1. 任一流程变化需同步更新：
   - `README.md`
   - `docs/getting-started.md`
   - `docs/version-policy.md`（若涉及版本跟进策略）
2. 文档应包含可直接执行的命令，避免仅描述不落地。

## 5. 推荐执行顺序

1. 运行启动前检查脚本
2. 阅读 `docs/architecture.md` 与 `docs/scenarios.md`
3. 实现/修改对应 Orchestrator
4. 执行 `pwsh ./scripts/run-all.ps1`
5. 更新文档与锁文件（如涉及上游版本变更）
