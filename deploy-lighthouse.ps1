param(
  [string]$HostName = "119.91.224.223",
  [string]$User = "ubuntu",
  [string]$RemoteDir = "/opt/bigdogwoofwoof",
  [string]$KeyFile = "",
  [switch]$SkipNginx
)

$ErrorActionPreference = "Stop"

function Invoke-Remote {
  param([string]$Command)
  $target = "${User}@${HostName}"
  if ($KeyFile) {
    ssh -i $KeyFile $target $Command
  } else {
    ssh $target $Command
  }
}

$archive = Join-Path $env:TEMP "bigdogwoofwoof-lighthouse.tar.gz"
if (Test-Path $archive) { Remove-Item -LiteralPath $archive -Force }

tar `
  --exclude ".git" `
  --exclude "node_modules" `
  --exclude "HISTORY_VERSION" `
  --exclude "*.log" `
  -czf $archive .

$target = "${User}@${HostName}:/tmp/bigdogwoofwoof-lighthouse.tar.gz"
if ($KeyFile) {
  scp -i $KeyFile $archive $target
} else {
  scp $archive $target
}

Invoke-Remote "sudo mkdir -p $RemoteDir && sudo tar -xzf /tmp/bigdogwoofwoof-lighthouse.tar.gz -C $RemoteDir && sudo chown -R www-data:www-data $RemoteDir && sudo chmod u+rwX,g+rX,o+rX $RemoteDir && sudo find $RemoteDir -type d -exec chmod u+rwx,g+rx,o+rx {} \;"
Invoke-Remote "cd $RemoteDir && if ! command -v node >/dev/null 2>&1; then curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs; fi && sudo npm ci --omit=dev"
Invoke-Remote "cd $RemoteDir && if [ ! -f .env ]; then sudo cp server/lighthouse.env.example .env; fi && sudo mkdir -p server-data && sudo chown -R www-data:www-data server-data && sudo chmod 750 server-data && sudo chown www-data:www-data .env && sudo chmod 600 .env"
Invoke-Remote "sudo cp $RemoteDir/server/bigdogwoofwoof-online.service /etc/systemd/system/bigdogwoofwoof-online.service && sudo systemctl daemon-reload && sudo systemctl enable --now bigdogwoofwoof-online.service && sudo systemctl restart bigdogwoofwoof-online.service"

if (-not $SkipNginx) {
  Invoke-Remote "if ! command -v nginx >/dev/null 2>&1; then sudo apt-get update && sudo apt-get install -y nginx; fi && sudo cp $RemoteDir/server/nginx-bigdogwoofwoof-online.conf /etc/nginx/sites-available/bigdogwoofwoof-online && sudo ln -sf /etc/nginx/sites-available/bigdogwoofwoof-online /etc/nginx/sites-enabled/bigdogwoofwoof-online && sudo nginx -t && sudo systemctl reload nginx"
}

Invoke-Remote "systemctl --no-pager --full status bigdogwoofwoof-online.service | sed -n '1,18p'"
Write-Output "Backend health: http://$HostName/health"
Write-Output "Online endpoint: http://$HostName/online-room"
