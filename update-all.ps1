param(
  [string]$HostName = "119.91.224.223",
  [string]$User = "ubuntu",
  [string]$KeyFile = (Join-Path $PSScriptRoot "..\ZSHZJJXXiivv.pem"),
  [switch]$SkipNginx,
  [switch]$SkipTencent,
  [switch]$SkipCloudflare,
  [switch]$SkipWorker,
  [switch]$SkipPages,
  [switch]$SkipMonitor
)

$ErrorActionPreference = "Stop"

if (-not $SkipCloudflare -and [string]::IsNullOrWhiteSpace($env:CLOUDFLARE_API_TOKEN)) {
  throw "CLOUDFLARE_API_TOKEN is required before update-all can deploy Cloudflare."
}

powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "takeover-check.ps1") `
  -HostName $HostName `
  -User $User `
  -KeyFile $KeyFile

if (-not $SkipTencent) {
  $tencentArgs = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", (Join-Path $PSScriptRoot "update-tencent-server.ps1"),
    "-HostName", $HostName,
    "-User", $User,
    "-KeyFile", $KeyFile
  )
  if ($SkipNginx) { $tencentArgs += "-SkipNginx" }
  powershell @tencentArgs
}

if (-not $SkipCloudflare) {
  $cloudflareArgs = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", (Join-Path $PSScriptRoot "update-cloudflare-server.ps1")
  )
  if ($SkipWorker) { $cloudflareArgs += "-SkipWorker" }
  if ($SkipPages) { $cloudflareArgs += "-SkipPages" }
  if ($SkipMonitor) { $cloudflareArgs += "-SkipMonitor" }
  powershell @cloudflareArgs
}

powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "takeover-check.ps1") `
  -HostName $HostName `
  -User $User `
  -KeyFile $KeyFile
