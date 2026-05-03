param(
  [string]$Endpoint = "https://jjk-online-battle.maopaotabby-jjk-life.workers.dev",
  [string]$ExpectedBuild = "20260430-online-pass-turn-v1",
  [int]$ExpectedAiTimeoutMs = 30000,
  [int]$Count = 1,
  [int]$IntervalSeconds = 10
)

$ErrorActionPreference = "Stop"

function Invoke-WorkerPing {
  param([string]$Url)

  $requestId = "monitor_{0}_{1}" -f ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()), (Get-Random -Maximum 999999)
  $body = @{
    protocol = "jjk_online_battle_v1"
    operation = "ping"
    requestId = $requestId
    sentAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  } | ConvertTo-Json -Depth 5

  $watch = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $response = Invoke-RestMethod -Method Post -Uri $Url -ContentType "application/json" -Body $body -TimeoutSec 45
    $watch.Stop()
    return [pscustomobject]@{
      Ok = [bool]$response.ok
      LatencyMs = [int]$watch.ElapsedMilliseconds
      RequestId = $response.requestId
      WorkerBuildVersion = [string]$response.workerBuildVersion
      AiConfigured = [bool]$response.aiConfigured
      AiModel = [string]$response.aiModel
      AiTimeoutMs = [int]$response.aiTimeoutMs
      HasRoomKv = [bool]$response.hasRoomKv
      ServerTime = [string]$response.serverTime
      Error = ""
    }
  } catch {
    $watch.Stop()
    return [pscustomobject]@{
      Ok = $false
      LatencyMs = [int]$watch.ElapsedMilliseconds
      RequestId = $requestId
      WorkerBuildVersion = ""
      AiConfigured = $false
      AiModel = ""
      AiTimeoutMs = 0
      HasRoomKv = $false
      ServerTime = ""
      Error = $_.Exception.Message
    }
  }
}

for ($i = 1; $i -le [Math]::Max(1, $Count); $i += 1) {
  $result = Invoke-WorkerPing -Url $Endpoint
  $buildOk = $result.WorkerBuildVersion -eq $ExpectedBuild
  $timeoutOk = $result.AiTimeoutMs -eq $ExpectedAiTimeoutMs
  $status = if ($result.Ok -and $buildOk -and $timeoutOk) { "OK" } else { "WARN" }

  "{0} worker={1} latency={2}ms build={3} buildOk={4} aiTimeoutMs={5} timeoutOk={6} aiConfigured={7} kv={8} requestId={9} error={10}" -f `
    $status,
    $Endpoint,
    $result.LatencyMs,
    ($result.WorkerBuildVersion -replace "^$", "<missing>"),
    $buildOk,
    $result.AiTimeoutMs,
    $timeoutOk,
    $result.AiConfigured,
    $result.HasRoomKv,
    $result.RequestId,
    $result.Error

  if ($i -lt $Count) {
    Start-Sleep -Seconds ([Math]::Max(1, $IntervalSeconds))
  }
}
