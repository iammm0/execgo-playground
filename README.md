# ExecGo Orchestration Playground

该仓库是围绕 [execgo](https://github.com/iammm0/execgo.git) 的编排层训练场，目标是用三种 LangGraph 技术栈实现同一套编排逻辑并做横向对照：

- Go: `langgraphgo`
- Python: `langgraph`
- TypeScript: `langgraphjs`

## 训练场目标

- 统一输入契约：将训练请求映射为 ExecGo `TaskGraph`
- 统一执行流程：提交任务、轮询结果、失败分析、输出报告
- 统一输出结构：跨语言得到一致的 `TrainingResult`
- 统一场景验证：基础 DAG、重试超时、HITL 三类训练关卡

## 目录结构

- `docs`: 架构说明、场景说明、上手文档、版本策略
- `shared/spec`: 共享 JSON Schema（输入/输出契约）
- `shared/contracts`: 与 ExecGo 交互约束（幂等、轮询、错误处理）
- `shared/execgo.version.lock.json`: 当前项目已对齐的 ExecGo 基线版本锁
- `orchestrators/go`: Go + langgraphgo 参考实现
- `orchestrators/python`: Python + langgraph 参考实现
- `orchestrators/ts`: TypeScript + langgraphjs 参考实现
- `scenarios`: 训练场景输入与预期输出
- `scripts`: 启动、验证、回归脚本
- `AGENT.md`: 人类/AI 协作者执行规范（含启动前强制检查）

## 启动前必做

每次项目启动前，都要先执行一次 ExecGo 上游版本检查：

```powershell
pwsh ./scripts/check-execgo-version.ps1
```

如果脚本提示发现新版本（`new upstream update detected`），请优先评估并尝试接入最新特性，再继续功能开发或回归测试。

详细策略见：`docs/version-policy.md`。

## 快速开始

1. 阅读 `docs/architecture.md`
2. 执行启动前检查：`pwsh ./scripts/check-execgo-version.ps1`
3. 选择一个语言实现（建议从 `orchestrators/go` 开始）
4. 按 `docs/scenarios.md` 运行场景并校验输出
5. 使用 `scripts/run-all.ps1` 执行统一回归（脚本会自动执行版本预检查）

## 参考项目

- [execgo](https://github.com/iammm0/execgo.git)
- [langgraphgo](https://github.com/tmc/langgraphgo.git)
- [langgraph](https://github.com/langchain-ai/langgraph.git)
- [langgraphjs](https://github.com/langchain-ai/langgraphjs.git)
