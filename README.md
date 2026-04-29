# Guide Tools

一个基于 Tauri 2.0 + React + Antd + Pandoc 的桌面端软件，用于将 Word 文档转换为 Markdown 格式，并支持图片上传到阿里云 OSS。

## 功能特性

### 1. Word 文档导入
- 支持 `.doc` 和 `.docx` 格式文件
- 使用 Pandoc 进行高质量转换
- 自动提取文档中的图片

### 2. Markdown 编辑与预览
- 实时编辑 Markdown 内容
- 实时预览渲染效果
- 支持语法高亮
- 支持表格、代码块、图片等元素

### 3. 图片上传到阿里云 OSS
- 一键提取 Markdown 中的本地图片
- 自动上传到阿里云 OSS
- 自动替换 Markdown 中的图片链接
- 支持批量处理

### 4. 文件保存
- 保存转换后的 Markdown 文件
- 支持自定义保存路径

## 技术栈

- **前端**: React 18 + TypeScript + Ant Design
- **桌面端**: Tauri 2.0
- **文档转换**: Pandoc
- **云存储**: 阿里云 OSS
- **构建工具**: Vite

## 系统要求

### 必需软件
1. **Node.js** (版本 18 或更高)
2. **Rust** (版本 1.70 或更高)
3. **Pandoc** (用于文档转换)

### Pandoc 安装

#### Windows
```bash
# 使用 Chocolatey
choco install pandoc

# 或下载安装包
# https://pandoc.org/installing.html
```

#### macOS
```bash
# 使用 Homebrew
brew install pandoc
```

#### Linux
```bash
# Ubuntu/Debian
sudo apt-get install pandoc

# CentOS/RHEL
sudo yum install pandoc
```

## 安装与运行

### 1. 克隆项目
```bash
git clone <repository-url>
cd guide_tools
```

### 2. 安装依赖
```bash
# 安装前端依赖
pnpm install

# 安装 Rust 依赖
cd src-tauri
cargo build
cd ..
```

### 3. 开发模式运行
```bash
pnpm tauri dev
```

### 4. 构建生产版本
```bash
pnpm tauri build
```

## 使用说明

### 1. 导入 Word 文档
1. 点击"导入Word文件"按钮
2. 选择要转换的 `.doc` 或 `.docx` 文件
3. 等待转换完成，Markdown 内容将显示在编辑器中

### 2. 编辑和预览
- 在"编辑"标签页中修改 Markdown 内容
- 在"预览"标签页中查看渲染效果
- 支持实时编辑和预览

### 3. 配置阿里云 OSS
在左侧面板中配置以下信息：
- **Access Key ID**: 阿里云访问密钥 ID
- **Access Key Secret**: 阿里云访问密钥 Secret
- **Bucket**: OSS 存储桶名称
- **地域**: OSS 存储桶所在地域（如：cn-hangzhou）
- **Endpoint**: 自定义端点（可选）

### 4. 上传图片到 OSS
1. 确保已配置阿里云 OSS 信息
2. 点击"上传图片到OSS"按钮
3. 系统将自动：
   - 提取 Markdown 中的本地图片路径
   - 上传图片到阿里云 OSS
   - 替换 Markdown 中的图片链接

### 5. 保存文件
1. 点击"保存Markdown"按钮
2. 选择保存路径和文件名
3. 文件将以 `.md` 格式保存

## 项目结构

```
guide_tools/
├── src/                    # React 前端代码
│   ├── components/         # React 组件
│   │   ├── MarkdownEditor.tsx
│   │   └── OSSConfig.tsx
│   ├── App.tsx            # 主应用组件
│   └── main.tsx           # 应用入口
├── src-tauri/             # Tauri 后端代码
│   ├── src/
│   │   └── lib.rs         # Rust 后端逻辑
│   ├── Cargo.toml         # Rust 依赖配置
│   └── tauri.conf.json    # Tauri 配置文件
├── public/                # 静态资源
├── package.json           # 前端依赖配置
└── README.md             # 项目文档
```

## 功能流程图

```
[用户上传 Word 文件]
          ↓
[调用 Pandoc 转换为 Markdown]
          ↓
[编辑器组件展示内容 + 实时预览]
          ↓
[提取 Markdown 中本地图片路径]
          ↓
[上传图片到 OSS，并返回 URL 映射表]
          ↓
[替换 Markdown 中的图片链接]
```

## 配置说明

### 阿里云 OSS 配置

1. **获取访问密钥**：
   - 登录阿里云控制台
   - 进入 RAM 访问控制
   - 创建 AccessKey ID 和 AccessKey Secret

2. **创建 OSS 存储桶**：
   - 进入对象存储 OSS
   - 创建新的存储桶
   - 记录存储桶名称和地域

3. **配置权限**：
   - 确保 AccessKey 有 OSS 读写权限
   - 配置存储桶的访问权限

### Tauri 配置

项目使用 Tauri 2.0 的新配置格式，主要配置项：

- **窗口设置**: 1200x800 可调整大小
- **插件权限**: 文件系统、网络、对话框等
- **安全策略**: 允许本地文件访问和 OSS 域名

## 开发指南

### 添加新功能

1. **前端功能**：
   - 在 `src/components/` 中创建新组件
   - 在 `src/App.tsx` 中集成

2. **后端功能**：
   - 在 `src-tauri/src/lib.rs` 中添加新的 Tauri 命令
   - 更新 `invoke_handler` 注册

### 调试

```bash
# 前端调试
pnpm dev

# 后端调试
cd src-tauri
cargo build --verbose

# 完整调试
pnpm tauri dev
```

## 常见问题

### Q: Pandoc 未找到
A: 确保已正确安装 Pandoc，并在系统 PATH 中可用

### Q: OSS 上传失败
A: 检查阿里云 OSS 配置是否正确，包括 AccessKey、Bucket 和地域信息

### Q: 图片路径无法识别
A: 确保图片路径格式为 `![alt](path)` 的标准 Markdown 格式

### Q: 转换后的格式不正确
A: 检查 Word 文档格式，复杂格式可能需要手动调整

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 更新日志

### v0.1.0
- 初始版本发布
- 支持 Word 到 Markdown 转换
- 支持图片上传到阿里云 OSS
- 支持 Markdown 编辑和预览
