# 使用指南

## 工作流总览

推荐按下面顺序使用 `Guide Tools`：

1. 配置 `Pandoc` 与 `OSS`
2. 导入 `Word` 或本地 `Markdown` 目录
3. 编辑并预览内容
4. 保存草稿
5. 上传到 `dev`
6. 验证无误后同步到 `release`

## 1. 准备连接配置

点击顶部栏中的“连接配置”，填写以下字段：

- `Access Key ID`
- `Access Key Secret`
- `Bucket`
- `地域`
- `Endpoint`，可选
- `文件路径`，建议填写业务前缀，例如 `manuals/product-a`

::: warning
`文件路径` 会作为 OSS 根前缀，应用上传时会在后面自动拼接 `dev`、`release` 和 `images` 目录，请不要手动重复追加这些环境名。
:::

## 2. 导入文档

### 导入 Word

- 点击“导入 Word 文件”
- 选择 `.doc` 或 `.docx`
- 应用会调用 `Pandoc` 转换为 Markdown

如果未安装 `Pandoc`，顶部栏会提示并提供下载入口。

### 导入 Markdown 文件夹

- 点击“导入 Markdown 文件夹”
- 选择本地已有文档目录
- 左侧文件树会展示目录中的 Markdown 与 Word 文件

这个模式适合接入已有知识库或交付目录。

## 3. 编辑与预览

- 左侧选择文件
- 中间编辑 Markdown
- 右侧预览渲染结果

应用支持：

- 表格
- 任务列表
- 代码高亮
- 图片预览
- 常见 Markdown 扩展

## 4. 保存草稿

点击“保存草稿”后，当前 Markdown 会保存到本地目录。

建议你：

- 先设置固定缓存目录
- 以文档主题命名 Markdown 文件
- 在上传前先保存一份本地版本，便于回滚

## 5. 上传到 OSS

点击“上传到 OSS”后，应用会自动执行以下动作：

1. 解析 Markdown 中的本地图片路径
2. 去重上传图片到共享 `images` 目录
3. 将 Markdown 中的图片链接替换成 OSS 地址
4. 将 Markdown 上传到指定环境目录

### 环境目录约定

假设你在配置里填写的根前缀是 `manuals/demo`，那么：

- Markdown `dev` 发布目录：`manuals/demo/dev`
- Markdown `release` 发布目录：`manuals/demo/release`
- 图片共享目录：`manuals/demo/images`

::: tip
图片放在共享目录的好处是：`release` 复用 `dev` 内容时，不需要重新复制整套图片资源。
:::

## 6. 从 dev 发布到 release

点击“dev 覆盖到 release”后，应用会把 `dev` 目录下的内容覆盖复制到 `release`。

推荐流程：

1. 先上传到 `dev`
2. 在 OSS 或业务系统里验证链接与内容
3. 再执行 `dev` 到 `release` 的同步

## 7. OSS 文件浏览模式

切换到“文件浏览”模式后，可以直接查看 OSS 目录内容：

- 懒加载目录树
- 预览 Markdown / 文本文件
- 下载远端文件
- 复制路径或做后续文件操作

这个页面适合做发布后的核对与抽查。

## 常见问题

### Pandoc 不可用

- 确认系统已安装 `Pandoc`
- 确认命令行执行 `pandoc --version` 正常
- 点击应用顶部“重新检测”

### 图片上传失败

- 检查本地图片路径是否真实存在
- 检查 `OSS` 权限是否具备上传能力
- 检查 `Bucket`、`地域`、`Endpoint` 是否匹配

### release 内容不正确

- 先确认 `dev` 目录内容是否正确
- 再执行一次“dev 覆盖到 release”
- 如有历史脏数据，先清理远端旧文件再重新上传
