import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const packageJson = JSON.parse(await read("package.json"));
const updateTencent = await read("update-tencent-server.ps1");
const updateCloudflare = await read("update-cloudflare-server.ps1");
const deployLighthouse = await read("deploy-lighthouse.ps1");
const takeoverCheck = await read("takeover-check.ps1");
const updateAll = await read("update-all.ps1");

assert.equal(packageJson.devDependencies?.wrangler, "^4.44.0", "wrangler should be pinned for stable Cloudflare deploys");
assert.equal(packageJson.dependencies?.zod, "^4.4.2", "zod should be pinned to satisfy the OpenAI SDK peer dependency during npm ci");
assert.match(updateTencent, /ZSHZJJXXiivv\.pem/, "Tencent deploy should default to the newly bound SSH private key");
assert.match(updateCloudflare, /CLOUDFLARE_API_TOKEN/, "Cloudflare deploy should require CLOUDFLARE_API_TOKEN");
assert.match(updateCloudflare, /node_modules\\\.bin\\wrangler\.cmd|node_modules\/\.bin\/wrangler/, "Cloudflare deploy should use local wrangler");
assert.match(deployLighthouse, /Assert-LastExitCode/, "Tencent deploy should fail fast when ssh or scp fails");
assert.match(deployLighthouse, /StrictHostKeyChecking=accept-new/, "Tencent deploy should handle first-use SSH host trust");
assert.match(deployLighthouse, /Install-RemotePrerequisites/, "Tencent deploy should explicitly install Ubuntu prerequisites on a fresh server");
assert.match(deployLighthouse, /Restart-RemoteService/, "Tencent deploy should restart and verify the systemd service");
assert.match(deployLighthouse, /curl -fsS http:\/\/127\.0\.0\.1:8787\/health/, "Tencent deploy should verify backend health locally before returning");
assert.match(deployLighthouse, /journalctl -u bigdogwoofwoof-online\.service/, "Tencent deploy should print service logs when health checks fail");
assert.match(deployLighthouse, /apt-get update/, "Tencent deploy should support a fresh Ubuntu reinstall");
assert.match(takeoverCheck, /Test-TencentTakeover/, "takeover check should include Tencent checks");
assert.match(takeoverCheck, /Test-CloudflareTakeover/, "takeover check should include Cloudflare checks");
assert.match(takeoverCheck, /ssh-keyscan/, "takeover check should be able to prime known_hosts");
assert.match(takeoverCheck, /Where-Object\s+\{\s*\$_\s+-match\s+['"]\^\\\|/, "ssh-keyscan stderr banners should be filtered before writing known_hosts");
assert.match(takeoverCheck, /StrictHostKeyChecking=accept-new/, "takeover check should fall back to accept-new when ssh-keyscan cannot scan this host");
assert.match(takeoverCheck, /ssh\s+-i[\s\S]+2>&1[\s\S]+\$ErrorActionPreference = \$oldPreference/, "SSH takeover check should capture stderr without PowerShell stopping on first-use warnings");
assert.match(takeoverCheck, /\/health/, "takeover check should verify Tencent health");
assert.match(takeoverCheck, /monitor-worker\.ps1/, "takeover check should verify Cloudflare Worker");
assert.doesNotMatch(takeoverCheck, /\$home\s*=/i, "takeover check should not assign PowerShell's read-only HOME variable");
assert.match(updateAll, /takeover-check\.ps1/, "update-all should run takeover checks first");
assert.match(updateAll, /update-tencent-server\.ps1/, "update-all should update Tencent");
assert.match(updateAll, /update-cloudflare-server\.ps1/, "update-all should update Cloudflare");
