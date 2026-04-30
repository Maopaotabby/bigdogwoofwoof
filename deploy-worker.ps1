param(
  [switch]$SkipMonitor
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $root
try {
  if (-not (Test-Path ".\node_modules\openai")) {
    npm.cmd ci
  }

  npx.cmd wrangler deploy --config ".\server\wrangler-online-battle.toml"

  if (-not $SkipMonitor) {
    powershell -NoProfile -ExecutionPolicy Bypass -File ".\monitor-worker.ps1"
  }
} finally {
  Pop-Location
}
