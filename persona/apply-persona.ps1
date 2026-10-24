<#
  apply-persona.ps1 - install the gpt-niang persona into Coopanion's workspace.
  Pure ASCII on purpose: Windows PowerShell 5.1 misreads UTF-8 without BOM.

  What it does:
    1. backs up the current CONSTITUTION.md OUTSIDE the workspace git tree
    2. copies the persona file over CONSTITUTION.md
    3. verifies byte size, then commits in the workspace repo
  Run it while Coopanion is closed, or accept that the change lands on the
  next session (the persona file itself says so).
#>
param(
  [string]$Source = (Join-Path $PSScriptRoot 'CONSTITUTION.gpt-niang.md'),
  [string]$Workspace = (Join-Path $env:LOCALAPPDATA 'Programs\Coopanion\data\home\companion\workspace'),
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Source)) { throw "persona file not found: $Source" }
if (-not (Test-Path -LiteralPath $Workspace)) { throw "workspace not found: $Workspace (is Coopanion installed?)" }

$target = Join-Path $Workspace 'CONSTITUTION.md'
$srcBytes = (Get-Item -LiteralPath $Source).Length
$oldBytes = if (Test-Path -LiteralPath $target) { (Get-Item -LiteralPath $target).Length } else { 0 }

Write-Host "source : $Source ($srcBytes bytes)"
Write-Host "target : $target (current $oldBytes bytes)"

if ($DryRun) {
  Write-Host 'DryRun: nothing changed.'
  return
}

# 1. backup outside the workspace, so it never enters the workspace repo
$backupDir = Join-Path $env:LOCALAPPDATA 'Coopanion\persona-backups'
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$backup = Join-Path $backupDir ('CONSTITUTION.' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.md')
if (Test-Path -LiteralPath $target) { Copy-Item -LiteralPath $target -Destination $backup -Force }

# 2. install
Copy-Item -LiteralPath $Source -Destination $target -Force

# 3. verify
$newBytes = (Get-Item -LiteralPath $target).Length
if ($newBytes -ne $srcBytes) {
  Copy-Item -LiteralPath $backup -Destination $target -Force
  throw "size mismatch after copy (expected $srcBytes, got $newBytes); original restored"
}
Write-Host "OK: wrote $newBytes bytes"
Write-Host "backup: $backup"

# 4. commit inside the workspace repo, the way the WebUI edits are committed
if ((Test-Path -LiteralPath (Join-Path $Workspace '.git')) -and (Get-Command git -ErrorAction SilentlyContinue)) {
  Push-Location -LiteralPath $Workspace
  try {
    git -c safe.directory=* add CONSTITUTION.md
    git -c safe.directory=* -c user.name=operator -c user.email=operator@persona.local commit -m 'Operator replaced CONSTITUTION.md with the gpt-niang persona' | Out-Host
    git -c safe.directory=* log --oneline -3 | Out-Host
  } finally {
    Pop-Location
  }
} else {
  Write-Host 'note: no git in the workspace, files written but not committed'
}

Write-Host ''
Write-Host 'Next: open Coopanion, Settings -> system prompt, check the full preview, then start a new conversation.'
