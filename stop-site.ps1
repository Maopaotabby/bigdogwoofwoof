$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $root "server.pid"

if (-not (Test-Path -LiteralPath $pidFile)) {
  Write-Output "No server.pid found."
  exit 0
}

$serverPid = [int](Get-Content -LiteralPath $pidFile -Raw)
$process = Get-Process -Id $serverPid -ErrorAction SilentlyContinue
if ($process) {
  Stop-Process -Id $serverPid
  Write-Output "Stopped local site server PID $serverPid."
} else {
  Write-Output "No running process found for PID $serverPid."
}
