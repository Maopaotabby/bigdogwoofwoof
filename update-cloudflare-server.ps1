param(
  [string]$ProjectName = "bigdogwoofwoof",
  [string]$Branch = "main",
  [string]$PagesUrl = "https://bigdogwoofwoof.pages.dev",
  [string]$WorkerEndpoint = "https://jjk-online-battle.maopaotabby-jjk-life.workers.dev",
  [string]$WorkerConfig = ".\server\wrangler-online-battle.toml",
  [switch]$SkipWorker,
  [switch]$SkipPages,
  [switch]$SkipMonitor,
  [switch]$KeepStaging
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$parent = Split-Path -Parent $root
$staging = Join-Path $parent ("cf-pages-{0}-upload" -f $ProjectName)
$wranglerCmd = Join-Path $root "node_modules\.bin\wrangler.cmd"

if ([string]::IsNullOrWhiteSpace($env:CLOUDFLARE_API_TOKEN)) {
  throw "CLOUDFLARE_API_TOKEN is required for Cloudflare takeover and deploy."
}

function Remove-StagingDirectory {
  if ($KeepStaging) { return }
  $resolved = Resolve-Path -LiteralPath $staging -ErrorAction SilentlyContinue
  if ($resolved -and $resolved.Path.StartsWith($parent)) {
    Remove-Item -LiteralPath $resolved.Path -Recurse -Force
  }
}

function Invoke-RequiredCommand {
  param([scriptblock]$Command, [string]$Description)
  Write-Output $Description
  & $Command
}

function Test-PagesDeployment {
  param([string]$BaseUrl)
  $homeResponse = Invoke-WebRequest -Uri ($BaseUrl.TrimEnd("/") + "/") -UseBasicParsing -TimeoutSec 30
  if ([int]$homeResponse.StatusCode -ne 200) {
    throw "Cloudflare Pages home check failed: HTTP $($homeResponse.StatusCode)"
  }
  $rules = Invoke-WebRequest -Uri ($BaseUrl.TrimEnd("/") + "/data/ai-provider-rules-v0.1-candidate.json") -UseBasicParsing -TimeoutSec 30
  if ([int]$rules.StatusCode -ne 200) {
    throw "Cloudflare Pages AI rules check failed: HTTP $($rules.StatusCode)"
  }
  $rulesText = [string]$rules.Content
  if ($rulesText -notmatch "doubao-seed-2-0-lite-260215") {
    throw "Cloudflare Pages AI rules file does not contain the expected AI model default."
  }
  Write-Output ("Pages check OK: {0} bytes home, {1} bytes AI rules" -f ([string]$homeResponse.Content).Length, $rulesText.Length)
}

Push-Location $root
try {
  if (-not (Test-Path ".\node_modules\openai") -or -not (Test-Path -LiteralPath $wranglerCmd)) {
    Invoke-RequiredCommand -Description "Installing npm dependencies..." -Command { npm.cmd ci }
  }
  if (-not (Test-Path -LiteralPath $wranglerCmd)) {
    throw "Local wrangler not found. Run npm ci before deploying Cloudflare."
  }

  if (-not $SkipWorker) {
    Invoke-RequiredCommand -Description "Deploying Cloudflare Worker..." -Command {
      & $wranglerCmd deploy --config $WorkerConfig
    }
  }

  if (-not $SkipPages) {
    Remove-StagingDirectory
    New-Item -ItemType Directory -Path $staging | Out-Null
    $robocopyArgs = @(
      $root,
      $staging,
      "/E",
      "/XD",
      ".git",
      "node_modules",
      "server-data",
      "server-data-test",
      "HISTORY_VERSION",
      "/XF",
      "server.pid",
      "server.url",
      "server.out.log",
      "server.err.log",
      "*.zip"
    )
    Write-Output "Preparing Cloudflare Pages direct-upload staging directory..."
    $null = & robocopy @robocopyArgs
    if ($LASTEXITCODE -gt 7) {
      throw "robocopy failed with exit code $LASTEXITCODE"
    }
    Invoke-RequiredCommand -Description "Deploying Cloudflare Pages direct upload..." -Command {
      & $wranglerCmd pages deploy $staging --project-name $ProjectName --branch $Branch --commit-dirty=true
    }
    Test-PagesDeployment -BaseUrl $PagesUrl
  }

  if (-not $SkipMonitor) {
    Invoke-RequiredCommand -Description "Checking Cloudflare Worker..." -Command {
      powershell -NoProfile -ExecutionPolicy Bypass -File ".\monitor-worker.ps1" -Endpoint $WorkerEndpoint
    }
  }

  Write-Output "Cloudflare update finished."
  Write-Output "Pages: $PagesUrl"
  Write-Output "Worker: $WorkerEndpoint"
} finally {
  Pop-Location
  Remove-StagingDirectory
}
