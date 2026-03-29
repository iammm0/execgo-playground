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

- `docs`: 架构说明、场景说明、上手文档
- `shared/spec`: 共享 JSON Schema（输入/输出契约）
- `shared/contracts`: 与 ExecGo 交互约束（幂等、轮询、错误处理）
- `orchestrators/go`: Go + langgraphgo 参考实现
- `orchestrators/python`: Python + langgraph 参考实现
- `orchestrators/ts`: TypeScript + langgraphjs 参考实现
- `scenarios`: 训练场景输入与预期输出
- `scripts`: 启动、验证、回归脚本

## 快速开始

1. 先阅读 `docs/architecture.md`
2. 选择一个语言实现（建议从 `orchestrators/go` 开始）
3. 按 `docs/scenarios.md` 运行场景并校验输出
4. 使用 `scripts/run-all.ps1` 执行统一回归

## 参考项目

- [execgo](https://github.com/iammm0/execgo.git)
- [langgraphgo](https://github.com/tmc/langgraphgo.git)
- [langgraph](https://github.com/langchain-ai/langgraph.git)
- [langgraphjs](https://github.com/langchain-ai/langgraphjs.git)
