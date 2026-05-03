param(
  [switch]$SkipMonitor
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$wranglerCmd = Join-Path $root "node_modules\.bin\wrangler.cmd"
if ([string]::IsNullOrWhiteSpace($env:CLOUDFLARE_API_TOKEN)) {
  throw "CLOUDFLARE_API_TOKEN is required for Cloudflare Worker deploy."
}
Push-Location $root
try {
  if (-not (Test-Path ".\node_modules\openai") -or -not (Test-Path -LiteralPath $wranglerCmd)) {
    npm.cmd ci
  }
  if (-not (Test-Path -LiteralPath $wranglerCmd)) {
    throw "Local wrangler not found. Run npm ci before deploying Cloudflare."
  }

  & $wranglerCmd deploy --config ".\server\wrangler-online-battle.toml"

  if (-not $SkipMonitor) {
    powershell -NoProfile -ExecutionPolicy Bypass -File ".\monitor-worker.ps1"
  }
} finally {
  Pop-Location
}
