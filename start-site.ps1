$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if (-not (Test-Path -LiteralPath $python)) {
  $python = "python"
}

function Test-PortFree {
  param([int]$Port)
  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    if ($async.AsyncWaitHandle.WaitOne(200, $false)) {
      $client.EndConnect($async)
      $client.Close()
      return $false
    }
    $client.Close()
    return $true
  } catch {
    $client.Close()
    return $true
  }
}

$port = $null
foreach ($candidate in 4173..4180) {
  if (Test-PortFree -Port $candidate) {
    $port = $candidate
    break
  }
}
if (-not $port) {
  throw "No free local port in 4173..4180."
}

$out = Join-Path $root "server.out.log"
$err = Join-Path $root "server.err.log"
$pidFile = Join-Path $root "server.pid"
$urlFile = Join-Path $root "server.url"
Remove-Item -LiteralPath $out, $err, $pidFile, $urlFile -ErrorAction SilentlyContinue

$process = Start-Process -FilePath $python -ArgumentList @("-m", "http.server", [string]$port, "--bind", "127.0.0.1") -WorkingDirectory $root -PassThru -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err
Start-Sleep -Milliseconds 800
$url = "http://127.0.0.1:$port/"
Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 5 | Out-Null
Set-Content -LiteralPath $pidFile -Value $process.Id
Set-Content -LiteralPath $urlFile -Value $url
Write-Output $url
