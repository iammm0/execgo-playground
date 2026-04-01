# ExecGo 版本跟进策略

## 目标

确保编排层训练场始终关注 ExecGo 的最新能力，避免长期滞后导致的接口偏差、调度语义漂移或能力遗漏。

## 启动前检查规则

- 每次项目启动前必须执行：`pwsh ./scripts/check-execgo-version.ps1`
- 统一回归脚本 `scripts/run-all.ps1` 已内置该检查
- 检查脚本会依次尝试：
  - GitHub Releases（`releases/latest`）
  - Git Tags（`tags`）
  - `main` 分支最新提交（`commits/main`）

## 如何判断“有新版本”

脚本会将上游最新版本信息与 `shared/execgo.version.lock.json` 对比。

- 一致：输出 `no newer upstream version detected`
- 不一致：输出 `new upstream update detected`，并提醒尝试接入最新特性

## 推荐执行动作

当检测到上游更新时，建议按以下顺序处理：

1. 阅读上游变更（Release Notes / PR / Commit）
2. 评估对当前训练场的影响（契约、重试、超时、状态字段、错误模型）
3. 选择至少一个可落地的新特性进行接入或验证
4. 更新相关文档与场景说明
5. 接入完成后执行：`pwsh ./scripts/check-execgo-version.ps1 -UpdateLock`

## 锁文件说明

`shared/execgo.version.lock.json` 记录当前项目已对齐的上游基线：

- `repo`: 上游仓库
- `channel`: 基线来源（`release` / `tag` / `commit`）
- `version`: 版本号或 commit SHA
- `source`: API 来源
- `observed_at_utc`: 最近一次写入锁文件时间
- `upstream_published`: 上游发布时间（如可获取）
- `upstream_release_url`: 参考链接

## 失败处理

- 若网络不可用或 API 调用失败，脚本默认只告警，不中断主流程
- 如需在 CI 中强制失败，可使用：`pwsh ./scripts/check-execgo-version.ps1 -FailOnCheckError`
