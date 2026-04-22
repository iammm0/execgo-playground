# AGENT 协作说明

本仓库已经从“三语言 LangGraph 训练场”重构为一个 Python-first 的 AI 编排可靠性实验平台。协作者需要优先保证平台闭环真实可运行，而不是维护历史兼容入口。

## 1. 项目目标

- 围绕 `LLM 规划 -> ExecGo 调度 -> Runtime 执行 -> 结果反馈` 建立可复现实验闭环
- 在同一套 ExecGo + Runtime + Fixtures + Chaos 环境里公平比较不同编排框架
- 通过 `scenarios / adapters / benchmarks / chaos / observability` 五个解耦模块沉淀实验能力
- 所有输出保持结构化，可落盘为 JSON / Markdown artifacts

## 2. 默认工作流

每次进入本项目并准备修改前，先执行：

```bash
python3 -m pip install -e ".[dev]"
python3 -m execgo_playground schema export --out shared/spec
pytest
```

如需验证真实执行闭环，再执行：

```bash
python3 -m execgo_playground harness up --build
python3 -m execgo_playground run --framework langgraph --scenario codegen_exec --mode replay --chaos none
```

## 3. 代码变更约束

1. 优先维护 Python 控制面，不再要求 Go / TypeScript 编排入口对齐。
2. 变更公共契约时，必须同步更新 `src/execgo_playground/models.py` 与 `shared/spec/*.schema.json`。
3. 变更执行链路时，至少更新一个 `scenarios/*` 和一个测试。
4. 变更 harness / runtime / fixture 协议时，必须同步更新文档与 smoke 路径。
5. 不要重新引入旧的 `pwsh` 脚本作为主入口；统一使用 Python CLI。

## 4. 文档维护约束

任一流程变化需同步更新：

- `README.md`
- `docs/getting-started.md`
- `docs/architecture.md`
- 对应能力文档（`docs/scenarios.md` / `docs/benchmarks.md` / `docs/chaos.md` / `docs/observability.md`）

文档必须带可直接执行的命令，避免抽象描述。

## 5. 推荐执行顺序

1. 阅读 `README.md` 与 `docs/architecture.md`
2. 安装依赖并导出 schema
3. 修改 Python 平台代码与场景/chaos 配置
4. 运行 `pytest`
5. 如涉及真实闭环，启动 harness 并跑至少一个 replay 场景
