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
