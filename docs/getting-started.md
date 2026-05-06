# 上手指南

## 1. 安装依赖

```bash
python3 -m pip install -e ".[dev]"
```

## 2. 导出 schema

```bash
python3 -m execgo_playground schema export --out shared/spec
```

## 3. 启动 Docker harness

```bash
python3 -m execgo_playground harness up --build
python3 -m execgo_playground harness status
```

预期返回三个健康对象：

- `execgo`
- `runtime`
- `fixtures`

## 4. 运行最小 smoke

```bash
python3 -m execgo_playground run \
  --framework langgraph \
  --scenario codegen_exec \
  --mode replay \
  --chaos none
```

成功后可在 `var/runs/` 看到一组新的 artifacts。

## 5. 运行多框架对比

```bash
python3 -m execgo_playground benchmark \
  --framework langgraph \
  --framework crewai \
  --framework autogen \
  --scenario codegen_exec \
  --scenario vuln_scan \
  --chaos none \
  --chaos runtime_restart \
  --mode replay
```

## 6. 运行 live 模式

默认测试建议使用 `mock` provider。若需要真实模型：

```bash
export OPENAI_API_KEY=...
export OPENAI_BASE_URL=https://api.openai.com

python3 -m execgo_playground run \
  --framework crewai \
  --scenario multi_step_agent \
  --mode live \
  --provider openai \
  --model gpt-4.1-mini \
  --chaos none
```

## 7. 清理环境

```bash
python3 -m execgo_playground harness down
```

## 8. 启动桌面客户端

桌面客户端位于 `desktop-client`，作为训练场内部子项目存在。

```bash
cd desktop-client
npm install
npm run dev
```

桌面端后端只通过子进程调用训练场：

```bash
python3 -m execgo_playground ...
```

它不会通过 HTTP 调用训练场 Python 控制面；HTTP 端口仍只属于 ExecGo / Runtime / Fixtures 运行环境。

## 9. 与上游 ExecGo 控制面的关系

本仓库的 harness 会构建兄弟目录中的 ExecGo（见 `harness/docker-compose.yml`）。当前主线 / `feat-add-adapter` 等分支上，控制面除 `POST /tasks` 与 `GET /tasks/{id}` 外，还可能暴露：

- **成熟 Agent 适配器**：`GET /adapters/capabilities`、`GET /adapters/tools`、`POST /adapters/translate`、`POST /adapters/actions`
- **MCP HTTP**：`GET /mcp/tools`、`POST /mcp/call`、`GET /mcp/tasks/{id}`
- **execgocli**：见 ExecGo 仓库 `cmd/execgocli`，子命令封装上述 HTTP 与轮询

Docker 环境中 ExecGo 进程可通过 **`EXECGO_RUNTIME_URL`** 将 `type: runtime` 任务提交到本 harness 的 runtime stub；若在进程外再设置 **`EXECGO_RUNTIME_TENANT` / `EXECGO_RUNTIME_OWNER`**，runtime executor 会把它们并入提交体的 `control_context`（并在取消时携带 `X-Execgo-Owner`）。训练场默认 compose 未设置这两项，行为与未配置时一致。

详细契约以 ExecGo 中文文档为准：`docs/zh/integration/agent-adapter.md`、`docs/zh/reference/execgo-cli-contract.md`、`docs/zh/overview/execgo-and-runtime.md`。
