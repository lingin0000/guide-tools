param(
  [string]$MirrorPrefix = "",
  [string]$NsisZipPath = "",
  [string]$ApplicationIdZipPath = "",
  [string]$NsisTauriUtilsDllPath = ""
)

$ErrorActionPreference = "Stop"

function Resolve-Url([string]$Url, [string]$Prefix) {
  if ([string]::IsNullOrWhiteSpace($Prefix)) {
    return $Url
  }
  $trimmedPrefix = $Prefix.Trim()
  if (!$trimmedPrefix.EndsWith("/")) {
    $trimmedPrefix = "$trimmedPrefix/"
  }
  return "$trimmedPrefix$Url"
}

$localAppData = [Environment]::GetFolderPath("LocalApplicationData")
$tauriDir = Join-Path $localAppData "tauri"
$nsisDir = Join-Path $tauriDir "NSIS"
$pluginsDir = Join-Path $nsisDir "Plugins\x86-unicode"

New-Item -ItemType Directory -Force -Path $pluginsDir | Out-Null

$tempDir = Join-Path $env:TEMP "tauri-nsis-tools"
if (Test-Path $tempDir) {
  Remove-Item -Recurse -Force $tempDir
}
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

$nsisZip = if (![string]::IsNullOrWhiteSpace($NsisZipPath)) { $NsisZipPath } else { (Join-Path $tempDir "nsis.zip") }
if ([string]::IsNullOrWhiteSpace($NsisZipPath)) {
  $nsisUrl = Resolve-Url "https://github.com/tauri-apps/binary-releases/releases/download/nsis-3.11/nsis-3.11.zip" $MirrorPrefix
  Invoke-WebRequest -Uri $nsisUrl -OutFile $nsisZip -UseBasicParsing
}

$nsisExtractDir = Join-Path $tempDir "nsis"
Expand-Archive -Path $nsisZip -DestinationPath $nsisExtractDir -Force

$makensis = Get-ChildItem -Path $nsisExtractDir -Recurse -Filter "makensis.exe" | Select-Object -First 1
if ($null -eq $makensis) {
  throw "未在解压后的 NSIS 包中找到 makensis.exe"
}

$nsisRoot = $makensis.Directory.FullName
Copy-Item -Path (Join-Path $nsisRoot "*") -Destination $nsisDir -Recurse -Force

$appIdZip = if (![string]::IsNullOrWhiteSpace($ApplicationIdZipPath)) { $ApplicationIdZipPath } else { (Join-Path $tempDir "NSIS-ApplicationID.zip") }
if ([string]::IsNullOrWhiteSpace($ApplicationIdZipPath)) {
  $appIdUrl = Resolve-Url "https://github.com/tauri-apps/binary-releases/releases/download/nsis-plugins-v0/NSIS-ApplicationID.zip" $MirrorPrefix
  Invoke-WebRequest -Uri $appIdUrl -OutFile $appIdZip -UseBasicParsing
}

$appIdExtractDir = Join-Path $tempDir "appid"
Expand-Archive -Path $appIdZip -DestinationPath $appIdExtractDir -Force

$appIdDll = Get-ChildItem -Path $appIdExtractDir -Recurse -Filter "ApplicationID.dll" | Select-Object -First 1
if ($null -eq $appIdDll) {
  throw "未在 NSIS-ApplicationID.zip 中找到 ApplicationID.dll"
}
Copy-Item -Path $appIdDll.FullName -Destination (Join-Path $pluginsDir "ApplicationID.dll") -Force

$utilsDll = if (![string]::IsNullOrWhiteSpace($NsisTauriUtilsDllPath)) { $NsisTauriUtilsDllPath } else { (Join-Path $tempDir "nsis_tauri_utils.dll") }
if ([string]::IsNullOrWhiteSpace($NsisTauriUtilsDllPath)) {
  $utilsUrl = Resolve-Url "https://github.com/tauri-apps/nsis-tauri-utils/releases/download/nsis_tauri_utils-v0.5.1/nsis_tauri_utils.dll" $MirrorPrefix
  Invoke-WebRequest -Uri $utilsUrl -OutFile $utilsDll -UseBasicParsing
}
Copy-Item -Path $utilsDll -Destination (Join-Path $pluginsDir "nsis_tauri_utils.dll") -Force

Write-Host "NSIS 工具已准备完成：$nsisDir"
