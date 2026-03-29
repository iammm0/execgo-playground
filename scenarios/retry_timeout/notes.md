# retry_timeout

## 目的

验证超时失败与依赖跳过语义是否一致。

## 判分点

- 上游 `delayed` 因超时失败
- 下游 `downstream` 自动变为 `skipped`
- 报告中出现依赖阻塞原因 `blocked_by_dependency`
