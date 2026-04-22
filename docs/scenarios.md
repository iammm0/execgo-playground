# 场景说明

第一版内建 4 个标准场景，全部要求可复现、可校验、可 replay。

## `codegen_exec`

- 目标
  - 修复一个确定性 Python fixture，并通过测试验证
- 关键能力
  - 多阶段执行
  - binding 跨阶段传递补丁元数据
  - 文件哈希校验

## `vuln_scan`

- 目标
  - 扫描固定依赖清单，并对接 fixture advisory feed
- 关键能力
  - 结构化 findings
  - 外部 fixture 依赖
  - chaos 下的延迟与恢复

## `multi_step_agent`

- 目标
  - 收集证据、归一化证据、输出最终 summary
- 关键能力
  - 多阶段 binding
  - 结构化 agent-style 结果
  - 对 staged execution 的可靠性验证

## `long_chain_dag`

- 目标
  - 在真实 DAG 依赖下完成 fan-out / fan-in
- 关键能力
  - 依赖顺序
  - workspace side effects
  - 最终 join 校验

## 每个场景的固定组成

- `scenario.json`
  - 元数据、输入、reference plan、允许的 chaos
- `prompt_pack`
  - system / user / constraints
- `fixtures`
  - 工作目录或脚本
- `expected.json`
  - verifier 阈值
- `verifier`
  - Python 函数，返回 `VerifierResult`

## 设计原则

- replay 不依赖 LLM
- verifier 以结构化断言为准
- 场景路径必须能在 runtime 容器中稳定访问
- 如需新增场景，优先复用 `runtime` 任务而非引入平台外执行通道
