# ExecGo Playground Desktop Client

这是 `execgo-playground` 的 Tauri 2 桌面子项目，用于本地手动调用训练场 CLI、配置测评矩阵，并可视化每组测评结果。

## 连接方式

桌面端不通过网络连接训练场控制面。所有操作都由 Rust 后端启动本地子进程：

```bash
python3 -m execgo_playground ...
```

默认从 `desktop-client` 的父目录定位 `execgo-playground` 根目录，并在该目录下执行命令。

如需指定 Python，可设置：

```bash
export EXECGO_PLAYGROUND_PYTHON=/path/to/python3
```

## 开发

先在训练场根目录安装 Python 依赖：

```bash
cd ..
python3 -m pip install -e ".[dev]"
```

再进入桌面端：

```bash
cd desktop-client
npm install
npm run dev
```

## 构建前检查

```bash
npm run build
cd src-tauri
cargo check
```
