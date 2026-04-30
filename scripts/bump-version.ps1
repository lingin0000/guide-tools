param(
  [Parameter(Position = 0)]
  [string]$Target = "patch",
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$packageJsonPath = Join-Path $projectRoot "package.json"
$cargoTomlPath = Join-Path $projectRoot "src-tauri\Cargo.toml"
$tauriConfigPath = Join-Path $projectRoot "src-tauri\tauri.conf.json"

function Get-MatchedValue {
  param(
    [string]$FilePath,
    [string]$Pattern,
    [string]$Description
  )

  $content = Get-Content -Path $FilePath -Raw -Encoding UTF8
  $match = [regex]::Match($content, $Pattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
  if (-not $match.Success) {
    throw "Failed to read$Description from $FilePath."
  }

  return $match.Groups[1].Value
}

function Get-NextVersion {
  param(
    [string]$CurrentVersion,
    [string]$VersionTarget
  )

  # Supports an explicit version or semantic bumps: major/minor/patch.
  if ($VersionTarget -match '^\d+\.\d+\.\d+$') {
    return $VersionTarget
  }

  $parts = $CurrentVersion.Split(".")
  if ($parts.Length -ne 3) {
    throw "Current version '$CurrentVersion' is not in x.y.z format."
  }

  $major = [int]$parts[0]
  $minor = [int]$parts[1]
  $patch = [int]$parts[2]

  switch ($VersionTarget.ToLowerInvariant()) {
    "major" { return "{0}.{1}.{2}" -f ($major + 1), 0, 0 }
    "minor" { return "{0}.{1}.{2}" -f $major, ($minor + 1), 0 }
    "patch" { return "{0}.{1}.{2}" -f $major, $minor, ($patch + 1) }
    default { throw "Unsupported target '$VersionTarget'. Use major/minor/patch or an explicit version." }
  }
}

function Update-VersionLine {
  param(
    [string]$FilePath,
    [string]$Pattern,
    [string]$Version
  )

  $content = Get-Content -Path $FilePath -Raw -Encoding UTF8
  $regex = [regex]::new($Pattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
  # Use a match evaluator to avoid "$11.0.0" style backreference ambiguity.
  $updated = $regex.Replace(
    $content,
    [System.Text.RegularExpressions.MatchEvaluator]{
      param($match)
      return $match.Groups[1].Value + $Version + $match.Groups[2].Value
    },
    1
  )
  if ($content -eq $updated) {
    throw "Failed to update version in $FilePath. Check whether the file format has changed."
  }

  [System.IO.File]::WriteAllText($FilePath, $updated, [System.Text.UTF8Encoding]::new($false))
}

$packageVersion = Get-MatchedValue -FilePath $packageJsonPath -Pattern '"version"\s*:\s*"([^"]+)"' -Description " package.json version"
$tauriVersion = Get-MatchedValue -FilePath $tauriConfigPath -Pattern '"version"\s*:\s*"([^"]+)"' -Description " tauri.conf.json version"
$cargoVersion = Get-MatchedValue -FilePath $cargoTomlPath -Pattern '^version\s*=\s*"([^"]+)"' -Description " Cargo.toml version"
$nextVersion = Get-NextVersion -CurrentVersion $packageVersion -VersionTarget $Target

if ($DryRun) {
  Write-Host "Dry run only. No files will be changed."
  Write-Host "package.json: $packageVersion -> $nextVersion"
  Write-Host "src-tauri/tauri.conf.json: $tauriVersion -> $nextVersion"
  Write-Host "src-tauri/Cargo.toml: $cargoVersion -> $nextVersion"
  exit 0
}

# Only replace the first match to avoid touching dependency versions.
Update-VersionLine -FilePath $packageJsonPath -Pattern '("version"\s*:\s*")[^"]+(")' -Version $nextVersion
Update-VersionLine -FilePath $tauriConfigPath -Pattern '("version"\s*:\s*")[^"]+(")' -Version $nextVersion
Update-VersionLine -FilePath $cargoTomlPath -Pattern '^(version\s*=\s*")[^"]+(")' -Version $nextVersion

Write-Host "Version synced to $nextVersion"
Write-Host "package.json: $packageVersion -> $nextVersion"
Write-Host "src-tauri/tauri.conf.json: $tauriVersion -> $nextVersion"
Write-Host "src-tauri/Cargo.toml: $cargoVersion -> $nextVersion"
