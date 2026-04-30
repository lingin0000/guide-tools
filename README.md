# Guide Tools

`Guide Tools` 是一个基于 `Tauri 2 + React + TypeScript + Pandoc + 阿里云 OSS` 的桌面应用，面向“操作手册、知识库、交付文档”的整理与发布场景。

它把 `Word 转 Markdown`、本地编辑预览、图片上传、`OSS dev/release` 发布、远端目录浏览这些动作串成了一条完整流程，减少手工搬运和重复操作。

## 下载入口

- 桌面应用下载：<https://github.com/lingin0000/guide-tools/releases/latest>
- Pandoc 下载：<https://github.com/jgm/pandoc/releases>
- 文档站入口：<https://lingin0000.github.io/guide-tools/>

## 核心能力

### 文档导入

- 支持导入 `.doc` / `.docx`
- 使用 `Pandoc` 转换为 Markdown
- 支持接入本地 Markdown 文件夹
- 支持读取当前文档目录，解析相对图片路径

### 编辑与预览

- 内置 Markdown 编辑器
- 实时预览渲染结果
- 支持代码高亮、表格、任务列表、图片等常见 Markdown 能力
- 支持将内容保存为本地草稿文件

### OSS 发布

- 解析 Markdown 中的本地图片
- 自动上传图片到 OSS 共享目录
- 自动替换 Markdown 中的图片链接
- 支持将 Markdown 发布到 `dev` 或 `release` 环境
- 支持一键将 `dev` 目录覆盖复制到 `release`

### OSS 浏览

- 浏览 OSS 目录树
- 懒加载子目录
- 预览远端 Markdown / 文本内容
- 下载远端文件
- 支持在 OSS 内复制文件或文件夹节点

### 版本更新

- 已接入 `Tauri Updater`
- 可通过 `GitHub Release` 分发安装包
- 应用内支持检查更新并下载安装

## 适用场景

- 把 Word 交付文档快速整理成 Markdown
- 将本地 Markdown 工程统一上传到阿里云 OSS
- 需要区分预发与正式目录的文档发布流程
- 需要一边编辑、一边查看 OSS 远端结果的团队

## 工作流

```text
导入 Word / Markdown 目录
        ↓
转换或加载 Markdown
        ↓
本地编辑与预览
        ↓
保存草稿
        ↓
上传图片到 OSS images 目录
        ↓
上传 Markdown 到 dev / release
        ↓
在 OSS 浏览页核对远端结果
```

## 运行环境

### 必需环境

- `Node.js 20+`
- `pnpm 10+`
- `Rust stable`
- `Pandoc 3.x`

### Pandoc 安装

#### Windows

```powershell
winget install --id JohnMacFarlane.Pandoc
```

也可以直接从发布页下载安装包：

- <https://github.com/jgm/pandoc/releases>

#### macOS

```bash
brew install pandoc
```

#### Linux

```bash
sudo apt-get update
sudo apt-get install -y pandoc
```

## 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/lingin0000/guide-tools.git
cd guide-tools
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 启动桌面应用

```bash
pnpm tauri dev
```

### 4. 启动文档站

```bash
pnpm docs:dev
```

## 常用命令

```bash
# 启动桌面应用开发模式
pnpm tauri dev

# 构建桌面安装包
pnpm tauri build

# 启动文档站
pnpm docs:dev

# 构建文档站
pnpm docs:build

# 预览文档站构建结果
pnpm docs:preview

# 准备 NSIS 依赖
pnpm tauri:tools:nsis
```

## 使用说明

### 1. 配置基础环境

首次启动后，建议先完成以下配置：

- 确认 `Pandoc` 可用
- 设置本地缓存目录
- 在“连接配置”中填写 OSS 参数

OSS 连接信息包括：

- `Access Key ID`
- `Access Key Secret`
- `Bucket`
- `Region`
- `Endpoint`，可选
- `文件路径`，作为业务根前缀

### 2. 导入内容

你可以选择两种入口：

- 导入 `Word` 文件，适合从交付文档开始整理
- 导入 `Markdown` 文件夹，适合接管已有知识库

### 3. 编辑和保存

- 在编辑区修改 Markdown
- 在预览区确认渲染结果
- 点击“保存草稿”保存到本地

### 4. 上传到 OSS

上传时应用会自动执行：

1. 解析本地图片路径
2. 按真实文件路径去重上传图片
3. 把图片统一上传到共享 `images` 目录
4. 替换 Markdown 中的图片链接
5. 把 Markdown 上传到 `dev` 或 `release`

### 5. 从 dev 发布到 release

如果你先发到 `dev` 验证，可以再点击“dev 覆盖到 release”，把 `dev` 目录内容同步到 `release`。

### 6. 浏览 OSS 远端结果

切换到文件浏览模式后，可以：

- 查看 OSS 目录树
- 预览远端文件内容
- 下载文件
- 复制并粘贴远端文件或文件夹

## OSS 目录约定

假设配置中的业务前缀是 `manuals/demo`，应用会按下面规则组织内容：

- `manuals/demo/dev`：预发 Markdown
- `manuals/demo/release`：正式 Markdown
- `manuals/demo/images`：共享图片目录

这样做的目的是让 `release` 复用 `dev` 内容时，不需要再次复制图片资源。

## 项目结构

```text
guide-tools/
├─ docs/                  # VitePress 文档站
├─ scripts/               # 辅助脚本
├─ src/                   # React 前端
├─ src-tauri/             # Tauri / Rust 后端
├─ .github/workflows/     # 发布与部署工作流
├─ package.json           # 前端脚本与依赖
└─ README.md              # 项目说明
```

## 发布

### 桌面应用发布

仓库已配置 `GitHub Actions` 自动发布流程。

推送版本标签后会触发桌面安装包构建：

```bash
git tag v1.0.0
git push origin v1.0.0
```

发布流程会：

- 构建 `NSIS` / `MSI` 安装包
- 生成 `latest.json`
- 为 `Tauri Updater` 提供更新元数据

### 文档站托管

文档站基于 `VitePress`，支持免费托管到：

- `GitHub Pages`
- `Cloudflare Pages`
- `Netlify`
- `Vercel`

当前仓库已包含 `GitHub Pages` 自动部署工作流。

## 常见问题

### Pandoc 检测失败

- 确认已安装 `Pandoc`
- 确认终端执行 `pandoc --version` 正常
- 回到应用点击“重新检测”

### OSS 上传失败

- 检查 `Access Key` 是否有效
- 检查 `Bucket`、`Region`、`Endpoint` 是否匹配
- 检查当前账号是否具备对象读写权限

### 图片没有正确替换

- 检查 Markdown 图片语法是否标准
- 检查图片文件是否存在于文档目录或可解析路径中

### NSIS 构建失败

如果打包时无法下载 NSIS 依赖，可先执行：

```bash
pnpm tauri:tools:nsis
```

如果网络受限，可查看 `docs/nsis-offline.md` 中的离线准备说明。

## 技术栈

- `Tauri 2`
- `React 19`
- `TypeScript`
- `Ant Design 6`
- `Vite 8`
- `VitePress 2`
- `Pandoc`
- `Rust`
- `阿里云 OSS`

## 许可证

MIT
