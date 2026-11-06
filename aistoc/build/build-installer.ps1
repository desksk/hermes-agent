<#
.SYNOPSIS
  Build the AISTOC Agent NSIS installer for this checkout.
.DESCRIPTION
  Stages the bundled Python payload, applies brand copy, builds the Electron
  renderer, then packages a per-machine NSIS installer whose install directory
  is the invoking user's LOCALAPPDATA.
#>
[CmdletBinding()]
param(
  [string]$Python = 'C:\Python314\python.exe',
  [switch]$SkipPayload
)

$ErrorActionPreference = 'Stop'
$Repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Desktop = Join-Path $Repo 'apps\desktop'
$Icons = Join-Path $Repo 'aistoc\branding\icons'
$Cache = Join-Path $Repo 'aistoc\.build-cache\assets'
$PayloadDir = Join-Path $Desktop 'build\agent-payload'

# GitHub is unreachable on this machine; fetch Electron from the mirror for
# both the workspace install (electron's postinstall) and electron-builder.
$env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'

# AISTOC ships an offline desktop agent, not a local-inference or automation
# workstation: keep the core tools and common Python capabilities, drop the
# heavy optional stacks. Chromium stays — browser automation is a primary
# workflow and the installer still fits the NSIS limit with it. Unset
# (upstream builds) still stages everything.
$env:AISTOC_PAYLOAD_SKIP_TOOLS = @(
  'llamacpp-cuda', 'llamacpp-hip', 'llamacpp-vulkan', 'llamacpp-cpu',
  'ffmpeg', 'cua-driver', 'gh', 'bws'
) -join ','
$env:AISTOC_PAYLOAD_EXTRAS = @(
  'acp', 'anthropic', 'cron', 'mcp', 'keychain', 'pty', 'vision',
  'documents', 'documents-pdf', 'doc-extract', 'web', 'ddgs'
) -join ','

function Step($Message) { Write-Host "==> $Message" -ForegroundColor Cyan }

# $ErrorActionPreference does not cover native exit codes in PowerShell 7, so
# every external command below is checked explicitly.
function Assert-ExitCode([string]$What) {
  if ($LASTEXITCODE -ne 0) { throw "$What failed with exit code $LASTEXITCODE" }
}

function Backup-Asset($Relative) {
  $Source = Join-Path $Desktop $Relative
  $Target = Join-Path $Cache $Relative
  New-Item -ItemType Directory -Force (Split-Path $Target) | Out-Null
  Copy-Item $Source $Target -Force
}

function Restore-Asset($Relative) {
  $Source = Join-Path $Cache $Relative
  if (Test-Path $Source) {
    Copy-Item $Source (Join-Path $Desktop $Relative) -Force
  }
}

$Assets = @('assets\icon.ico', 'assets\icon.png', 'public\nous-girl.png', 'public\nous-girl-dark.png', 'public\apple-touch-icon.png')

Push-Location $Repo
try {
  Step 'Check Python 3.14'
  & $Python --version
  Assert-ExitCode 'python --version'

  Step 'Install JS workspaces when missing'
  # The repo's .npmrc sets engine-strict=true and package.json only allows
  # npm <11.10.0 || >=11.17.0, so the ambient npm (11.12.1 here) is rejected.
  # Every npm invocation goes through the pinned npm instead.
  if (-not (Test-Path (Join-Path $Repo 'node_modules'))) {
    npx --yes npm@11.21.1 ci
    Assert-ExitCode 'npm ci'
  }

  Step 'Back up upstream brand assets'
  New-Item -ItemType Directory -Force $Cache | Out-Null
  foreach ($asset in $Assets) { Backup-Asset $asset }

  Step 'Generate brand icons'
  & $Python (Join-Path $Repo 'aistoc\branding\make_icons.py')
  Assert-ExitCode 'make_icons.py'
  Copy-Item (Join-Path $Icons 'icon.ico') (Join-Path $Desktop 'assets\icon.ico') -Force
  Copy-Item (Join-Path $Icons 'icon.png') (Join-Path $Desktop 'assets\icon.png') -Force
  Copy-Item (Join-Path $Icons 'icon.png') (Join-Path $Desktop 'public\nous-girl.png') -Force
  Copy-Item (Join-Path $Icons 'icon.png') (Join-Path $Desktop 'public\nous-girl-dark.png') -Force
  # Window icon, favicon and the onboarding provider row all read this file.
  Copy-Item (Join-Path $Icons 'icon.png') (Join-Path $Desktop 'public\apple-touch-icon.png') -Force

  Step 'Cache catalog snapshots'
  node (Join-Path $Repo 'aistoc\build\fetch-catalog-snapshots.mjs')
  Assert-ExitCode 'fetch-catalog-snapshots.mjs'

  Step 'Apply brand copy'
  node (Join-Path $Repo 'aistoc\build\apply-brand.mjs')
  Assert-ExitCode 'apply-brand.mjs'

  try {
    $env:HERMES_PYTHON = $Python

    if (-not $SkipPayload) {
      Step 'Stage bundled Python payload'
      # The embedded Python distribution marks staged files read-only; a
      # re-stage would then fail. Clear the attribute recursively, but never
      # delete the directory (it holds the payload from the previous run).
      if (Test-Path $PayloadDir) {
        Get-ChildItem -LiteralPath $PayloadDir -Recurse -Force |
          Where-Object { -not $_.PSIsContainer } |
          ForEach-Object { $_.IsReadOnly = $false }
      }
      Push-Location $Desktop
      try {
        $env:HERMES_DESKTOP_VARIANT = 'bundled'
        npx --yes npm@11.21.1 run payload
        Assert-ExitCode 'npm run payload'
      } finally { Pop-Location }
    }

    Step 'Build renderer'
    Push-Location $Desktop
    try {
      $env:VITE_AISTOC_BRAND = '1'
      $env:AISTOC_BRAND = '1'
      # Packaging rejects a renderer built for the bootstrap variant, so the
      # renderer build must use the same variant as the staged payload.
      $env:HERMES_DESKTOP_VARIANT = 'bundled'
      npx --yes npm@11.21.1 run build
      Assert-ExitCode 'npm run build'
    } finally { Pop-Location }

    Step 'Package NSIS installer'
    Push-Location $Desktop
    try {
      # run-electron-builder.mjs already appends the no-publish flag itself.
      # Passing it here as well makes yargs parse ["never", "never"],
      # isPublish becomes true, and the build fails at the end with
      # "GH_TOKEN is not set".
      $env:AISTOC_NSIS = '1'
      $env:AISTOC_BRAND = '1'
      $env:HERMES_DESKTOP_VARIANT = 'bundled'
      $env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
      npx --yes npm@11.21.1 run builder -- --win nsis
      Assert-ExitCode 'npm run builder'
    } finally { Pop-Location }
  } finally {
    Step 'Restore upstream source and assets'
    try {
      node (Join-Path $Repo 'aistoc\build\apply-brand.mjs') restore
      Assert-ExitCode 'apply-brand.mjs restore'
    } finally {
      foreach ($asset in $Assets) { Restore-Asset $asset }
      Remove-Item (Join-Path $Desktop 'public\aistoc-catalog') -Recurse -Force -ErrorAction SilentlyContinue
    }
  }

  Step 'Verify artifacts'
  & (Join-Path $PSScriptRoot 'verify-installer.ps1')

  Step 'Installer ready'
  Get-ChildItem (Join-Path $Desktop 'release') -Filter 'AISTOC-Setup-*.exe' |
    Select-Object Name, Length, LastWriteTime
} finally {
  Pop-Location
}
