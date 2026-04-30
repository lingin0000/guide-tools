# 部署托管

`Guide Tools` 的文档站基于 `VitePress`，构建产物是纯静态文件，因此可以部署到大多数免费静态托管平台。

## 常用地址

- 文档源码仓库：[guide-tools](https://github.com/lingin0000/guide-tools)
- 桌面应用下载页：[GitHub Releases](https://github.com/lingin0000/guide-tools/releases/latest)
- 预期文档地址：`https://<你的用户名>.github.io/<仓库名>/`

## 构建命令

```bash
pnpm install
pnpm docs:build
```

构建完成后，静态文件位于：

```text
docs/.vitepress/dist
```

## 方案一：GitHub Pages

这是最省事的免费方案，仓库内已经补好自动部署工作流。

### 1. 推送代码

把当前项目推送到 GitHub 仓库。

### 2. 启用 Pages

进入仓库：

`Settings -> Pages -> Build and deployment`

选择：

- `Source`: `GitHub Actions`

### 3. 自动发布

后续只要推送到 `main` 分支，工作流就会自动：

1. 安装依赖
2. 构建 VitePress
3. 发布到 GitHub Pages

### 4. 访问地址

项目仓库通常是：

```text
https://<你的用户名>.github.io/<仓库名>/
```

::: tip
当前文档配置支持通过环境变量 `DOCS_BASE` 覆盖 `base`，这样既能兼容 GitHub Pages，也能兼容根路径部署的平台。
:::

## 方案二：Cloudflare Pages

适合需要更快全球访问和更简单域名绑定的场景，免费额度通常也够个人或小团队使用。

### 构建配置

- `Framework preset`: `None`
- `Build command`: `pnpm docs:build`
- `Build output directory`: `docs/.vitepress/dist`

### 环境变量

如果你部署在根域名或 Pages 默认域名，一般不需要配置 `DOCS_BASE`。

如果你放在子路径下，可以额外设置：

```text
DOCS_BASE=/你的子路径/
```

## 方案三：Netlify

### 构建配置

- `Build command`: `pnpm docs:build`
- `Publish directory`: `docs/.vitepress/dist`

### 推荐补充

- Node 版本使用 `20`
- 包管理器使用 `pnpm`
- 根路径部署时无需设置 `DOCS_BASE`

## 方案四：Vercel

### 构建配置

- `Framework Preset`: `Other`
- `Install Command`: `pnpm install`
- `Build Command`: `pnpm docs:build`
- `Output Directory`: `docs/.vitepress/dist`

### 注意事项

`Vercel` 默认偏向根路径部署，所以通常不需要额外设置 `DOCS_BASE`。

## 多平台选择建议

### 推荐优先级

1. `GitHub Pages`：仓库同源、零额外费用、最适合项目文档
2. `Cloudflare Pages`：访问速度好，自定义域名体验好
3. `Netlify`：配置简单，适合快速试运行
4. `Vercel`：也可用，但更常用于前端应用而不是纯文档站

## 自定义域名

无论使用哪种平台，都建议：

- 先确认站点能正常构建
- 再绑定自定义域名
- 开启 `HTTPS`
- 最后检查静态资源路径是否正确

如果你准备使用 GitHub Pages 自定义域名，建议额外在部署工作流中保留 `CNAME` 文件。

## 本地验证

发布前可以先本地检查构建结果：

```bash
pnpm docs:build
pnpm docs:preview
```

## 与桌面发布的区别

这里的“部署托管”只针对 `docs` 文档站。

如果你要发布桌面安装包，请继续使用仓库中的：

- `GitHub Release`
- `Tauri updater`
- `release.yml`

文档站与桌面安装包可以分别维护、分别发布，互不影响。
