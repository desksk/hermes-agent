$ErrorActionPreference = 'Stop'
$Repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Release = Join-Path $Repo 'apps\desktop\release'
if (-not (Test-Path $Release)) { throw "Release directory not found: $Release" }

$Installer = Get-ChildItem $Release -Filter 'AISTOC-Setup-*.exe' |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $Installer) { throw "No AISTOC-Setup-*.exe found in $Release" }

$Hash = (Get-FileHash $Installer.FullName -Algorithm SHA256).Hash

$Commit = (git -C $Repo rev-parse HEAD) -join ''
if ($LASTEXITCODE -ne 0 -or -not $Commit) { throw "git rev-parse HEAD failed in $Repo" }
$PythonVersion = (& 'C:\Python314\python.exe' --version) -join ' '

# electron-builder writes latest.yml for the update feed. It is expected for an
# NSIS build, but its absence must not fail verification.
$LatestYml = Join-Path $Release 'latest.yml'

$Info = [ordered]@{
  artifact = $Installer.Name
  bytes = $Installer.Length
  sha256 = $Hash
  upstream_commit = $Commit
  built_at = (Get-Date).ToString('o')
  python = $PythonVersion
  latest_yml = (Test-Path $LatestYml)
}
$Info | ConvertTo-Json | Set-Content (Join-Path $Release 'build-info.json') -Encoding UTF8
"$Hash  $($Installer.Name)" | Set-Content (Join-Path $Release 'SHA256SUMS.txt') -Encoding ASCII
Write-Host "OK: $($Installer.Name) ($($Installer.Length) bytes)" -ForegroundColor Green

# NSIS is a 32-bit installer format and tops out near 2 GiB. Warn well before
# that ceiling; do not fail the verification on size alone.
$SizeLimit = 1.95GB
if ($Installer.Length -gt $SizeLimit) {
  Write-Warning ("Installer is {0:N3} GiB, above the {1:N2} GiB NSIS safety margin" -f
    ($Installer.Length / 1GB), 1.95)
}
