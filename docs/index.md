---
layout: home
hero:
  name: "Guide Tools"
  text: "Word 转 Markdown + OSS 发布桌面工具"
  tagline: 面向操作手册、知识库和交付文档的本地编辑、预览、上传与发布方案
  actions:
    - theme: brand
      text: 下载桌面版
      link: https://github.com/lingin0000/guide-tools/releases/latest
    - theme: alt
      text: 查看安装说明
      link: /quick-start
    - theme: alt
      text: 部署托管
      link: /deployment

features:
  - title: Word 转 Markdown
    details: 支持导入 .doc / .docx，调用 Pandoc 进行转换，并保留本地图片引用，适合把现有操作手册快速转为 Markdown。
  - title: 编辑与预览一体化
    details: 桌面端内置 Markdown 编辑器与预览区，支持代码高亮、表格、任务列表与图片内容查看，减少切换工具的成本。
  - title: OSS 发布工作流
    details: 支持把 Markdown 与图片上传到阿里云 OSS，并区分 dev / release 环境，适合先预发再正式发布。
  - title: OSS 文件浏览
    details: 内置 OSS 文件树浏览、预览与下载能力，便于查看远端内容是否发布正确。
  - title: 缓存与草稿保存
    details: 支持本地缓存目录、Markdown 文件夹接入与草稿保存，降低转换和编辑过程中的内容丢失风险。
  - title: 桌面端自动更新
    details: 项目已接入 Tauri Updater，可配合 GitHub Release 分发安装包并在应用内检查更新。
---

## 立即下载

::: danger 先下载再阅读
如果你是第一次访问，建议优先进入下载页获取安装包：

- [下载 Guide Tools 桌面版](https://github.com/lingin0000/guide-tools/releases/latest)
- [下载 Pandoc](https://github.com/jgm/pandoc/releases)
:::

## 项目定位

`Guide Tools` 是一个基于 `Tauri + React + Pandoc + 阿里云 OSS` 的桌面工具，目标是把原本零散的文档处理动作收敛到一个流程里：

1. 从 Word 或本地 Markdown 工程导入内容。
2. 在桌面端完成编辑与预览。
3. 自动处理图片上传和链接替换。
4. 将文档发布到 OSS 的 `dev` / `release` 环境。
5. 在应用内直接检查远端目录和文件内容。

## 适用场景

- 需要把 `Word` 交付文档转换为 `Markdown` 的团队
- 需要把图片统一上传到 `OSS` 的运维或实施团队
- 需要区分预发与正式目录的文档发布流程
- 需要可离线准备 `NSIS` 工具链的 Windows 打包场景

## 核心能力

### 内容导入

- 支持导入 `doc` / `docx`
- 支持接入本地 Markdown 文件夹
- 支持读取当前文档目录，处理相对图片路径

### 内容处理

- Markdown 实时编辑与预览
- 图片路径解析、上传、链接替换
- 草稿保存到本地缓存目录

### 远端协作

- 上传当前 Markdown 到 OSS
- 共享图片目录，避免 `release` 复用 `dev` 时重复上传图片
- 一键将 `dev` 内容覆盖复制到 `release`
- 浏览远端 OSS 目录并下载文件

## 阅读顺序

- 想直接安装使用：先点页面顶部“下载桌面版”
- 第一次使用：先看 [快速开始](./quick-start)
- 想了解完整操作：看 [使用指南](./usage)
- 想上线文档站：看 [部署托管](./deployment)
- 需要离线打包：看 [NSIS 离线准备](./nsis-offline)
