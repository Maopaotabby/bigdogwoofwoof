# Tencent Lighthouse online backend

This project can run the online battle endpoint on a Tencent Cloud Lighthouse
Ubuntu instance.

## Endpoint

Current deployed test endpoint:

```text
http://119.91.224.223/online-room
```

Health check:

```text
http://119.91.224.223/health
```

Static site:

```text
http://119.91.224.223/
```

## Server layout

```text
/opt/bigdogwoofwoof
/opt/bigdogwoofwoof/.env
/opt/bigdogwoofwoof/server-data/online-rooms.json
/etc/systemd/system/bigdogwoofwoof-online.service
/etc/nginx/sites-available/bigdogwoofwoof-online
```

## Commands

Check service:

```bash
sudo systemctl status bigdogwoofwoof-online.service
```

Restart service:

```bash
sudo systemctl restart bigdogwoofwoof-online.service
```

View logs:

```bash
journalctl -u bigdogwoofwoof-online.service -f
```

Edit environment:

```bash
sudo nano /opt/bigdogwoofwoof/.env
sudo systemctl restart bigdogwoofwoof-online.service
```

## AI key

`AI_API_KEY` is intentionally not committed. Configure it only on the server in
`/opt/bigdogwoofwoof/.env`.

## HTTPS note

GitHub Pages runs over HTTPS. Browsers may block calls from the HTTPS page to
`http://119.91.224.223/online-room`. The Lighthouse Nginx config also serves the
static site from `http://119.91.224.223/`, so the page can call `/online-room`
as same-origin HTTP. For public HTTPS use, bind a domain to the Lighthouse
instance and enable HTTPS, then set the online endpoint to the HTTPS URL.
