param(
  [string]$HostName = "119.91.224.223",
  [string]$User = "ubuntu",
  [string]$RemoteDir = "/opt/bigdogwoofwoof",
  [string]$KeyFile = "",
  [switch]$SkipNginx
)

$ErrorActionPreference = "Stop"

function Assert-LastExitCode {
  param([string]$Action)
  if ($LASTEXITCODE -ne 0) {
    throw "$Action failed with exit code $LASTEXITCODE"
  }
}

function Get-SshArgs {
  $args = @(
    "-4",
    "-o", "BatchMode=yes",
    "-o", "StrictHostKeyChecking=accept-new",
    "-o", "ConnectTimeout=45",
    "-o", "ServerAliveInterval=20",
    "-o", "ServerAliveCountMax=3"
  )
  if ($KeyFile) {
    $args += @("-i", $KeyFile)
  }
  return $args
}

function Invoke-Remote {
  param([string]$Command)
  $target = "${User}@${HostName}"
  $oldPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    ssh @(Get-SshArgs) $target $Command
  } finally {
    $ErrorActionPreference = $oldPreference
  }
  Assert-LastExitCode "Remote command"
}

function Invoke-RemoteScript {
  param([string]$Name, [string]$Script)
  Write-Output "==> $Name"
  $target = "${User}@${HostName}"
  $oldPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $Script | ssh @(Get-SshArgs) $target "tr -d '\r' | bash -s"
  } finally {
    $ErrorActionPreference = $oldPreference
  }
  Assert-LastExitCode $Name
}

function Copy-ArchiveToRemote {
  param([string]$ArchivePath, [string]$TargetPath)
  $scpArgs = Get-SshArgs
  $scpArgs += @($ArchivePath, $TargetPath)
  $oldPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    scp @scpArgs
  } finally {
    $ErrorActionPreference = $oldPreference
  }
  Assert-LastExitCode "SCP upload"
}

function Install-RemotePrerequisites {
  $script = @'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a
if ! command -v apt-get >/dev/null 2>&1; then
  echo "This deploy script expects Ubuntu/Debian with apt-get." >&2
  exit 1
fi
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg tar gzip
node_major=""
if command -v node >/dev/null 2>&1; then
  node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || true)"
fi
if [ -z "$node_major" ] || [ "$node_major" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
if ! id www-data >/dev/null 2>&1; then
  sudo useradd --system --home /var/www --shell /usr/sbin/nologin www-data
fi
node --version
npm --version || true
'@
  Invoke-RemoteScript "Install-RemotePrerequisites" $script
}

function Publish-RemoteRelease {
  $script = @'
set -euo pipefail
remote_dir="__REMOTE_DIR__"
archive="/tmp/bigdogwoofwoof-lighthouse.tar.gz"
staging="/tmp/bigdogwoofwoof-release"
sudo rm -rf "$staging"
sudo mkdir -p "$staging" "$remote_dir"
sudo tar -xzf "$archive" -C "$staging"
if [ -f "$remote_dir/.env" ]; then
  sudo cp "$remote_dir/.env" /tmp/bigdogwoofwoof.env.keep
fi
if [ -d "$remote_dir/server-data" ]; then
  sudo rm -rf /tmp/bigdogwoofwoof-server-data.keep
  sudo cp -a "$remote_dir/server-data" /tmp/bigdogwoofwoof-server-data.keep
fi
sudo find "$remote_dir" -mindepth 1 -maxdepth 1 ! -name ".env" ! -name "server-data" -exec rm -rf {} +
sudo cp -a "$staging"/. "$remote_dir"/
if [ -f /tmp/bigdogwoofwoof.env.keep ]; then
  sudo mv /tmp/bigdogwoofwoof.env.keep "$remote_dir/.env"
elif [ ! -f "$remote_dir/.env" ]; then
  sudo cp "$remote_dir/server/lighthouse.env.example" "$remote_dir/.env"
fi
if [ -d /tmp/bigdogwoofwoof-server-data.keep ]; then
  sudo rm -rf "$remote_dir/server-data"
  sudo mv /tmp/bigdogwoofwoof-server-data.keep "$remote_dir/server-data"
else
  sudo mkdir -p "$remote_dir/server-data"
fi
cd "$remote_dir"
sudo npm ci --omit=dev
sudo chown -R www-data:www-data "$remote_dir"
sudo chmod 750 "$remote_dir/server-data"
sudo chmod 600 "$remote_dir/.env"
'@
  $script = $script.Replace("__REMOTE_DIR__", $RemoteDir)
  Invoke-RemoteScript "Publish-RemoteRelease" $script
}

function Restart-RemoteService {
  $script = @'
set -euo pipefail
remote_dir="__REMOTE_DIR__"
sudo cp "$remote_dir/server/bigdogwoofwoof-online.service" /etc/systemd/system/bigdogwoofwoof-online.service
sudo systemctl daemon-reload
sudo systemctl enable bigdogwoofwoof-online.service
sudo systemctl restart bigdogwoofwoof-online.service
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8787/health >/tmp/bigdogwoofwoof-health.json; then
    cat /tmp/bigdogwoofwoof-health.json
    exit 0
  fi
  sleep 1
done
sudo systemctl --no-pager --full status bigdogwoofwoof-online.service || true
sudo journalctl -u bigdogwoofwoof-online.service -n 120 --no-pager || true
exit 1
'@
  $script = $script.Replace("__REMOTE_DIR__", $RemoteDir)
  Invoke-RemoteScript "Restart-RemoteService" $script
}

function Configure-RemoteNginx {
  if ($SkipNginx) {
    Write-Output "==> Skip nginx configuration"
    return
  }
  $script = @'
set -euo pipefail
remote_dir="__REMOTE_DIR__"
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a
sudo apt-get update
sudo apt-get install -y nginx
sudo cp "$remote_dir/server/nginx-bigdogwoofwoof-online.conf" /etc/nginx/sites-available/bigdogwoofwoof-online
sudo ln -sf /etc/nginx/sites-available/bigdogwoofwoof-online /etc/nginx/sites-enabled/bigdogwoofwoof-online
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx || sudo systemctl restart nginx
for i in $(seq 1 20); do
  if curl -fsS http://127.0.0.1/health; then
    exit 0
  fi
  sleep 1
done
sudo nginx -T | sed -n '1,220p' || true
sudo systemctl --no-pager --full status nginx || true
exit 1
'@
  $script = $script.Replace("__REMOTE_DIR__", $RemoteDir)
  Invoke-RemoteScript "Configure-RemoteNginx" $script
}

if ($KeyFile -and !(Test-Path -LiteralPath $KeyFile)) {
  throw "SSH key file not found: $KeyFile"
}

$archive = Join-Path $env:TEMP "bigdogwoofwoof-lighthouse.tar.gz"
if (Test-Path -LiteralPath $archive) {
  Remove-Item -LiteralPath $archive -Force
}

tar `
  --exclude ".git" `
  --exclude "node_modules" `
  --exclude "HISTORY_VERSION" `
  --exclude "server-data" `
  --exclude ".env" `
  --exclude "*.log" `
  -czf $archive .
Assert-LastExitCode "Create lighthouse archive"

Install-RemotePrerequisites

$target = "${User}@${HostName}:/tmp/bigdogwoofwoof-lighthouse.tar.gz"
Copy-ArchiveToRemote -ArchivePath $archive -TargetPath $target

Publish-RemoteRelease
Restart-RemoteService
Configure-RemoteNginx

Invoke-Remote "systemctl --no-pager --full status bigdogwoofwoof-online.service | sed -n '1,18p'"
Write-Output "Backend health: http://$HostName/health"
Write-Output "Online endpoint: http://$HostName/online-room"
