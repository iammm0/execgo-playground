# ExecGo Playground

`execgo-playground` 是一个 Python-first 的 AI 编排可靠性实验平台，用来回答一个核心问题：

**LLM 生成的计划，在真实执行系统中是否可靠、可控、可恢复。**

它不再是 Go / Python / TypeScript 的 demo 集合，而是围绕以下完整闭环设计：

1. LLM 或 replay 产出规划结果
2. adapter 将框架输出归一化为 `StandardPlan`
3. runner 将分阶段计划编译为 ExecGo `TaskGraph`
4. ExecGo 调度并把 `runtime` 任务交给 runtime stub
5. observability 记录 timeline、snapshots、trace 与结果
6. benchmark 汇总多框架、多场景、多 chaos profile 的量化数据

## 核心能力

- `scenarios`
  - 标准化、可复现、可验证的实验场景
- `adapters`
  - `langgraph` / `crewai` / `autogen` 统一适配层
- `benchmarks`
  - 矩阵式运行和结构化评分
- `chaos`
  - 逻辑层与 runtime 层故障注入
- `observability`
  - plan、trace、timeline、ExecGo snapshots、Markdown summary
- `harness`
  - Docker-first 管理 `ExecGo + Runtime + Fixtures`

## 目录结构

- `src/execgo_playground`
  - 平台核心实现
- `scenarios`
  - 四个标准场景及 fixture
- `chaos/profiles`
  - 声明式 chaos profile
- `harness`
  - Docker Compose、runtime stub、fixture service
- `desktop-client`
  - Tauri 2 桌面客户端，通过本地子进程调用训练场 CLI
- `shared/spec`
  - 由 Pydantic 导出的 JSON Schema
- `tests`
  - 单元测试与可选 Docker 集成测试

## 快速开始

### 1. 安装依赖

```bash
python3 -m pip install -e ".[dev]"
```

### 2. 导出 schema

```bash
python3 -m execgo_playground schema export --out shared/spec
```

### 3. 启动实验环境

```bash
python3 -m execgo_playground harness up --build
python3 -m execgo_playground harness status
```

默认端口：

- ExecGo: `http://127.0.0.1:18080`
- Runtime stub: `http://127.0.0.1:18081`
- Fixture service: `http://127.0.0.1:18082`

### 4. 运行单个实验

```bash
python3 -m execgo_playground run \
  --framework langgraph \
  --scenario codegen_exec \
  --mode replay \
  --chaos none
```

### 5. 运行 benchmark

```bash
python3 -m execgo_playground benchmark \
  --framework langgraph \
  --framework crewai \
  --framework autogen \
  --scenario codegen_exec \
  --scenario multi_step_agent \
  --chaos none \
  --chaos runtime_restart \
  --mode replay
```

## Live 与 Replay

- `replay`
  - 完全绕过 LLM，直接重放场景参考计划
  - 适合回归、基线校验、故障复现
- `live`
  - 通过 provider 生成计划，再归一化为 `StandardPlan`
  - 默认支持 `mock` provider；也支持 OpenAI-compatible Chat Completions

OpenAI-compatible live 运行示例：

```bash
export OPENAI_API_KEY=...
export OPENAI_BASE_URL=https://api.openai.com

python3 -m execgo_playground run \
  --framework autogen \
  --scenario vuln_scan \
  --mode live \
  --provider openai \
  --model gpt-4.1-mini \
  --chaos none
```

## 产物

每次 run 会在 `var/runs/<run_id>/` 下生成：

- `plan.json`
- `adapter_trace.json`
- `timeline.jsonl`
- `execgo_snapshots.jsonl`
- `result.json`
- `summary.md`

这些 artifacts 是后续调试、对比分析、回放与报告生成的唯一事实来源。

## 桌面客户端

训练场内置一个 Tauri 2 桌面子项目，用于手动调用命令、配置 benchmark 矩阵并可视化每组运行结果。

```bash
cd desktop-client
npm install
npm run dev
```

桌面端不会通过网络连接训练场控制面。Rust 后端只会在 `execgo-playground` 根目录下启动本地子进程：

```bash
python3 -m execgo_playground ...
```

如需指定 Python 解释器：

```bash
export EXECGO_PLAYGROUND_PYTHON=/path/to/python3
```

## 测试

```bash
pytest
```

如需执行 Docker 集成测试：

```bash
EXECGO_PLAYGROUND_RUN_DOCKER_TESTS=1 pytest tests/integration
```

## 参考

- 体系结构：[docs/architecture.md](docs/architecture.md)
- 场景规范：[docs/scenarios.md](docs/scenarios.md)
- Benchmark 指南：[docs/benchmarks.md](docs/benchmarks.md)
- Chaos 指南：[docs/chaos.md](docs/chaos.md)
- 可观测性：[docs/observability.md](docs/observability.md)
- 上手说明：[docs/getting-started.md](docs/getting-started.md)
