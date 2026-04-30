## NSIS 离线/镜像准备（用于 Tauri Windows 安装包 -setup.exe）

Tauri 在打 `nsis` 安装包时会自动下载 NSIS 相关工具。如果网络环境无法访问 GitHub，可以用离线/镜像方式把工具放到固定目录，让构建不再下载。

## 适用场景

下面这些情况建议提前准备：

- 公司网络限制访问 GitHub Release
- CI 或构建机无法稳定下载 NSIS 依赖
- 需要在内网环境重复打包
- 希望把依赖固定到本地，降低构建波动

### 方式 A：脚本自动准备（推荐）

1. 直连（网络可访问 GitHub）：

```powershell
pnpm tauri:tools:nsis
```

2. 镜像（网络不可直连 GitHub，可尝试）：

```powershell
pnpm tauri:tools:nsis:mirror
```

脚本会把 NSIS 工具准备到：

```text
%LOCALAPPDATA%\tauri\NSIS
```

脚本会自动完成以下动作：

- 下载 `nsis-3.11.zip`
- 下载 `NSIS-ApplicationID.zip`
- 下载 `nsis_tauri_utils.dll`
- 解压并复制到 Tauri 约定目录

### 方式 B：完全离线（手动下载 + 本地导入）

先在能上网的机器下载以下 3 个文件（拷贝到当前机器也可以）：

1. NSIS:
   - https://github.com/tauri-apps/binary-releases/releases/download/nsis-3.11/nsis-3.11.zip
2. ApplicationID 插件:
   - https://github.com/tauri-apps/binary-releases/releases/download/nsis-plugins-v0/NSIS-ApplicationID.zip
3. nsis_tauri_utils.dll:
   - https://github.com/tauri-apps/nsis-tauri-utils/releases/download/nsis_tauri_utils-v0.5.1/nsis_tauri_utils.dll

然后在离线机器执行（替换成你的本地文件路径）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup-tauri-nsis.ps1 `
  -NsisZipPath "D:\Downloads\nsis-3.11.zip" `
  -ApplicationIdZipPath "D:\Downloads\NSIS-ApplicationID.zip" `
  -NsisTauriUtilsDllPath "D:\Downloads\nsis_tauri_utils.dll"
```

### 构建

工具准备好后，直接构建：

```powershell
pnpm tauri build
```

构建产物会在：

```text
src-tauri\target\release\bundle\nsis\
```

## 建议流程

1. 在一台可联网机器先跑一次脚本，确认依赖版本无误。
2. 如果需要完全离线构建，再把三个依赖文件拷贝到内网机器。
3. 每次升级 Tauri 版本后，重新验证 NSIS 工具版本是否仍然兼容。

## 常见问题

### PowerShell 执行被拦截

请确认当前终端允许运行：

```powershell
Set-ExecutionPolicy -Scope Process Bypass
```

### 解压后找不到 `makensis.exe`

说明下载文件不完整，或者压缩包版本与脚本预期不一致，建议重新下载原始文件。
