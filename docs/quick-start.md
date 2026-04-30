# 快速开始

## 先下载

- 桌面应用下载：[GitHub Releases](https://github.com/lingin0000/guide-tools/releases/latest)
- Pandoc 下载：[Pandoc Releases](https://github.com/jgm/pandoc/releases)
- NSIS 工具说明：[NSIS 离线准备](./nsis-offline)

## 环境要求

在本地开发或构建桌面程序前，建议先准备以下环境：

- `Node.js 20+`
- `pnpm 10+`
- `Rust stable`
- `Pandoc 3.x`

::: tip
如果你只需要预览文档站，不需要打桌面包，至少准备 `Node.js` 和 `pnpm` 即可。
:::

## 安装依赖

在项目根目录执行：

```bash
pnpm install
```

## 本地运行

### 运行文档站

```bash
pnpm docs:dev
```

### 运行桌面应用

```bash
pnpm tauri dev
```

启动后可以在桌面应用中完成 Word 导入、Markdown 编辑和 OSS 发布。

## 关键目录

```text
guide-tools/
├─ docs/                 # VitePress 文档站
├─ scripts/              # 构建辅助脚本
├─ src/                  # React 前端
├─ src-tauri/            # Tauri / Rust 后端
├─ package.json          # 前端脚本
└─ README.md             # 项目说明
```

## 常用命令

```bash
# 启动文档站
pnpm docs:dev

# 构建文档站静态文件
pnpm docs:build

# 本地预览文档构建结果
pnpm docs:preview

# 启动桌面应用开发模式
pnpm tauri dev

# 构建桌面安装包
pnpm tauri build

# 准备 NSIS 依赖
pnpm tauri:tools:nsis
```

## Pandoc 安装

### Windows

可以直接下载安装包：

- [Pandoc Releases](https://github.com/jgm/pandoc/releases)

也可以通过包管理器安装：

```powershell
winget install --id JohnMacFarlane.Pandoc
```

### macOS

```bash
brew install pandoc
```

### Linux

```bash
sudo apt-get update
sudo apt-get install -y pandoc
```

## 首次使用建议

1. 先确认 `Pandoc` 已安装且应用内可检测到。
2. 打开“连接配置”，填好 `OSS` 访问参数。
3. 设置本地缓存目录，避免转换文件散落在系统临时目录。
4. 先用 `dev` 环境上传测试，再同步到 `release`。
