param(
  [string]$HostName = "119.91.224.223",
  [string]$User = "ubuntu",
  [string]$KeyFile = (Join-Path $PSScriptRoot "..\ZSHZJJXXiivv.pem"),
  [string]$TencentHealthUrl = "http://119.91.224.223/health",
  [string]$TencentOnlineUrl = "http://119.91.224.223/online-room",
  [string]$PagesUrl = "https://bigdogwoofwoof.pages.dev",
  [string]$WorkerEndpoint = "https://jjk-online-battle.maopaotabby-jjk-life.workers.dev",
  [switch]$SkipSsh,
  [switch]$SkipCloudflareAuth
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Output "[takeover] $Message"
}

function Add-KnownHost {
  param([string]$TargetHost)
  $sshDir = Join-Path $env:USERPROFILE ".ssh"
  $knownHosts = Join-Path $sshDir "known_hosts"
  if (-not (Test-Path -LiteralPath $sshDir)) {
    New-Item -ItemType Directory -Path $sshDir | Out-Null
  }
  $existing = if (Test-Path -LiteralPath $knownHosts) { Get-Content -LiteralPath $knownHosts -Raw } else { "" }
  if ($existing -match [regex]::Escape($TargetHost)) { return }
  $oldPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $scan = & ssh-keyscan -H $TargetHost 2>&1 | Where-Object { $_ -match '^\|' }
  } finally {
    $ErrorActionPreference = $oldPreference
  }
  if (-not $scan) {
    Write-Step "ssh-keyscan did not return host keys; SSH will use StrictHostKeyChecking=accept-new"
    return
  }
  Add-Content -LiteralPath $knownHosts -Value $scan
}

function Invoke-JsonPost {
  param([string]$Uri)
  $body = @{
    protocol = "jjk_online_battle_v1"
    operation = "ping"
    requestId = "takeover_check_$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
    sentAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  } | ConvertTo-Json -Depth 5
  Invoke-RestMethod -Method Post -Uri $Uri -ContentType "application/json" -Body $body -TimeoutSec 30
}

function Test-TencentTakeover {
  if (-not (Test-Path -LiteralPath $KeyFile)) {
    throw "Tencent SSH private key not found: $KeyFile"
  }
  Write-Step "Tencent SSH key present: $KeyFile"
  if (-not $SkipSsh) {
    Add-KnownHost -TargetHost $HostName
    $target = "${User}@${HostName}"
    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
      $sshResult = & ssh -i $KeyFile -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 $target "echo takeover-ok && systemctl is-active bigdogwoofwoof-online.service" 2>&1
    } finally {
      $ErrorActionPreference = $oldPreference
    }
    if ($LASTEXITCODE -ne 0 -or ($sshResult -join "`n") -notmatch "takeover-ok") {
      throw "Tencent SSH takeover check failed: $sshResult"
    }
    Write-Step "Tencent SSH and systemd check OK"
  }
  $health = Invoke-RestMethod -Method Get -Uri $TencentHealthUrl -TimeoutSec 20
  if (-not $health.ok) { throw "Tencent /health failed" }
  $online = Invoke-JsonPost -Uri $TencentOnlineUrl
  if (-not $online.ok) { throw "Tencent /online-room ping failed" }
  Write-Step "Tencent HTTP health and online-room ping OK"
}

function Test-CloudflareTakeover {
  if (-not $SkipCloudflareAuth -and [string]::IsNullOrWhiteSpace($env:CLOUDFLARE_API_TOKEN)) {
    throw "CLOUDFLARE_API_TOKEN is required for Cloudflare takeover."
  }
  $wranglerCmd = Join-Path $PSScriptRoot "node_modules\.bin\wrangler.cmd"
  if (-not (Test-Path -LiteralPath $wranglerCmd)) {
    throw "Local wrangler not found. Run npm ci first."
  }
  if (-not $SkipCloudflareAuth) {
    & $wranglerCmd whoami | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "wrangler whoami failed" }
  }
  $pagesHome = Invoke-WebRequest -Uri ($PagesUrl.TrimEnd("/") + "/") -UseBasicParsing -TimeoutSec 30
  if ([int]$pagesHome.StatusCode -ne 200) { throw "Cloudflare Pages home failed: HTTP $($pagesHome.StatusCode)" }
  powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "monitor-worker.ps1") -Endpoint $WorkerEndpoint
  Write-Step "Cloudflare Pages and Worker checks OK"
}

Test-TencentTakeover
Test-CloudflareTakeover
Write-Step "takeover checks finished"
