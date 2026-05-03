param(
  [string]$HostName = "119.91.224.223",
  [string]$User = "ubuntu",
  [string]$KeyFile = (Join-Path $PSScriptRoot "..\server-key.pem"),
  [switch]$SkipNginx
)

$ErrorActionPreference = "Stop"

if (!(Test-Path -LiteralPath $KeyFile)) {
  throw "SSH key file not found: $KeyFile"
}

$argsList = @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", "$PSScriptRoot\deploy-lighthouse.ps1",
  "-HostName", $HostName,
  "-User", $User,
  "-KeyFile", $KeyFile
)

if ($SkipNginx) {
  $argsList += "-SkipNginx"
}

powershell @argsList
