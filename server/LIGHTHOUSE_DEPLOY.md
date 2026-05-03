# Tencent Lighthouse Handoff Manual

This document records the current Tencent Cloud Lighthouse takeover and deploy
flow. Cloudflare is intentionally out of scope for the default update path.

## Current State

Tencent host:

```text
119.91.224.223
```

Public endpoints:

```text
http://119.91.224.223/
http://119.91.224.223/health
http://119.91.224.223/online-room
http://119.91.224.223/ai
```

Last verified after redeploy:

```text
GET /health -> {"ok":true,"service":"jjk_online_battle_lighthouse","protocol":"jjk_online_battle_v1"}
bigdogwoofwoof-online.service -> active
nginx -> active
```

The server is Ubuntu 24.04 LTS and uses Node.js 20 from NodeSource.

## Access

SSH user:

```text
ubuntu
```

SSH private key relative to the current V2.4 project directory:

```text
..\server-key.pem
```

Current public key bound to `ubuntu`:

```text
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCfNNSnJrJg0uPi/PJpk2Mxrq1Qm5JwPI7W2QWRwZHN4HhEGKWZrKtWoqyPhKbPwmTdJzp9Kps3WFy5IYNyheoPSkSquwOo7dvV/l/BCVMEMQ7bj4QqONE8idPilcH0HMnW8fCW63P4HlMye6g66HOwiTlPdgKxg+pxGoSoCOOMxY5zsTb+eJIf3LHZ73IzxE0tfT0oPIaKLQCW5yj3vVsJD/QF4bmJVfRjH3lkCFXjWq9oVXn/INuqk30BZ4XOgIzXMxCMwkDhmeJ9FFSAh3WB9Ui8MQfW/imeGiSNtkPLHSDFN1Z5qNqcF4EF1ekJRcF06DqRvdvjxB8Ls3qiJ+vL
```

Do not commit account passwords, API keys, or `.env` contents into the project.
If the instance is reinstalled and the SSH host key changes, remove the old
local trust record first:

```powershell
ssh-keygen -R 119.91.224.223
```

Then reconnect with `StrictHostKeyChecking=accept-new`.

If the reinstalled instance does not yet accept the private key, sign in once
with the owner-provided password and append the public key above to:

```text
/home/ubuntu/.ssh/authorized_keys
```

## Server Layout

```text
/opt/bigdogwoofwoof
/opt/bigdogwoofwoof/.env
/opt/bigdogwoofwoof/server-data/online-rooms.json
/opt/bigdogwoofwoof/server-data/ai-assist-requests.jsonl
/etc/systemd/system/bigdogwoofwoof-online.service
/etc/nginx/sites-available/bigdogwoofwoof-online
/etc/nginx/sites-enabled/bigdogwoofwoof-online
```

`server-data` and `.env` are preserved by the deploy script. The archive upload
excludes local `node_modules`, `.env`, `server-data`, `HISTORY_VERSION`, and
logs.

## One-Command Tencent Deploy

Run from the current V2.4 project directory:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\update-tencent-server.ps1 -KeyFile "..\server-key.pem"
```

Default target:

```text
HostName = 119.91.224.223
User = ubuntu
RemoteDir = /opt/bigdogwoofwoof
```

To skip nginx reconfiguration and only update code plus the Node service:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\update-tencent-server.ps1 -KeyFile "..\server-key.pem" -SkipNginx
```

The deploy script now performs these steps:

1. Checks SSH and installs fresh Ubuntu prerequisites with `apt-get`.
2. Installs Node.js 20 if missing or older.
3. Uploads the current local project as `/tmp/bigdogwoofwoof-lighthouse.tar.gz`.
4. Publishes into `/opt/bigdogwoofwoof` while preserving `.env` and `server-data`.
5. Runs `npm ci --omit=dev`.
6. Installs and restarts `bigdogwoofwoof-online.service`.
7. Verifies `http://127.0.0.1:8787/health`.
8. Installs/configures nginx unless `-SkipNginx` is passed.
9. Verifies `http://127.0.0.1/health`.

If backend health fails, the script prints:

```bash
systemctl --no-pager --full status bigdogwoofwoof-online.service
journalctl -u bigdogwoofwoof-online.service -n 120 --no-pager
```

## Manual Operations

Check backend status:

```bash
sudo systemctl status bigdogwoofwoof-online.service
```

Restart backend:

```bash
sudo systemctl restart bigdogwoofwoof-online.service
```

View backend logs:

```bash
journalctl -u bigdogwoofwoof-online.service -f
```

Check nginx:

```bash
sudo nginx -t
sudo systemctl status nginx
```

Restart nginx:

```bash
sudo systemctl restart nginx
```

Edit environment:

```bash
sudo nano /opt/bigdogwoofwoof/.env
sudo systemctl restart bigdogwoofwoof-online.service
```

Verify from the server:

```bash
curl -fsS http://127.0.0.1:8787/health
curl -fsS http://127.0.0.1/health
```

Verify from local Windows:

```powershell
curl.exe -fsS --max-time 20 http://119.91.224.223/health
curl.exe -I --max-time 20 http://119.91.224.223/
```

## AI Configuration And Logs

`AI_API_KEY` is intentionally not committed. Configure it only on the server:

```text
/opt/bigdogwoofwoof/.env
```

AI request token usage is printed on every request:

```text
[AI token usage] {"promptTemplateId":"...","model":"...","promptTokens":...,"completionTokens":...,"totalTokens":...}
```

Where to inspect:

```bash
journalctl -u bigdogwoofwoof-online.service -f
```

The browser also prints `[AI token usage]` in the dev console for frontend AI
calls.

AI audit storage rules:

- Lighthouse writes compact audit records to `server-data/ai-assist-requests.jsonl`.
- Lighthouse does not store `ai_audit:` records inside `online-rooms.json`.
- Full prompt payloads and uploaded text are compacted/redacted in audit output.

This prevents the earlier failure mode where audit entries could bloat
`online-rooms.json` and cause Node heap/OOM or HTTP 504.

## Known Troubleshooting

### `REMOTE HOST IDENTIFICATION HAS CHANGED`

This is expected after a full Tencent reinstall. Confirm the IP is still the
owned Tencent instance, then run:

```powershell
ssh-keygen -R 119.91.224.223
```

Reconnect and accept the new host key.

### `Permission denied (publickey,password)`

The server does not have the current public key in `ubuntu`'s
`authorized_keys`. Log in once using the owner-provided password and append the
public key from this document to:

```text
/home/ubuntu/.ssh/authorized_keys
```

### Static page works but `/health` times out

Check the Node service first:

```bash
sudo systemctl status bigdogwoofwoof-online.service
sudo journalctl -u bigdogwoofwoof-online.service -n 120 --no-pager
curl -fsS http://127.0.0.1:8787/health
```

If local port `8787` works but public `/health` fails, check nginx:

```bash
sudo nginx -t
sudo systemctl restart nginx
curl -fsS http://127.0.0.1/health
```

### SSH port connects but banner stalls

This usually indicates high load, OOM pressure, or a wedged instance. Use the
Tencent console to reboot, then inspect:

```bash
free -h
df -h
journalctl -u bigdogwoofwoof-online.service -n 120 --no-pager
```

### Clean redeploy after reinstall

1. Rebind or reinstall the SSH public key.
2. Run the one-command Tencent deploy above.
3. Verify `/health`.
4. Configure `/opt/bigdogwoofwoof/.env` with production AI values.
5. Restart the backend service.

## Cloudflare Policy

Cloudflare deployment is paused and is not part of the default update flow.
Do not run `update-cloudflare-server.ps1` unless the owner explicitly requests
Cloudflare synchronization.

Tencent-only updates use:

```powershell
.\update-tencent-server.ps1
```
