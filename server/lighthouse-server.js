import http from "node:http";
import { mkdir, readFile, rename, writeFile, appendFile, unlink } from "node:fs/promises";
import path from "node:path";
import worker from "./online-battle-worker.js";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), "server-data");
const ROOMS_FILE = path.join(DATA_DIR, "online-rooms.json");
const AI_SECURITY_FILE = path.join(DATA_DIR, "ai-security.json");
const AI_REQUEST_LOG_FILE = path.join(DATA_DIR, "ai-request.log");
const AI_MAX_PROMPT_TOKENS = Math.max(1, Number(process.env.AI_MAX_PROMPT_TOKENS || 6000));
const AI_DAILY_CATEGORY_LIMIT = Math.max(1, Number(process.env.AI_DAILY_CATEGORY_LIMIT || 5));
const AI_LARGE_BODY_BYTES = Math.max(4096, Number(process.env.AI_LARGE_BODY_BYTES || 120000));
const AI_HIGH_FREQUENCY_WINDOW_MS = Math.max(1000, Number(process.env.AI_HIGH_FREQUENCY_WINDOW_MS || 60000));
const AI_HIGH_FREQUENCY_LIMIT = Math.max(1, Number(process.env.AI_HIGH_FREQUENCY_LIMIT || 3));
const AI_REQUEST_DEDUPE_TTL_MS = Math.max(5000, Number(process.env.AI_REQUEST_DEDUPE_TTL_MS || 15000));
const AI_REJECT_MESSAGE = "AI讨厌你，拒绝了连接。";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class FileRoomStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.cache = null;
    this.writeQueue = Promise.resolve();
  }

  async load() {
    if (this.cache) return this.cache;
    await mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const raw = await readFile(this.filePath, "utf8");
      this.cache = JSON.parse(raw || "{}");
    } catch {
      this.cache = {};
    }
    return this.cache;
  }

  async get(key) {
    const data = await this.load();
    const entry = data[key];
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      delete data[key];
      await this.flush();
      return null;
    }
    return entry.value || null;
  }

  async put(key, value, options = {}) {
    const data = await this.load();
    const ttlMs = Number(options.expirationTtl || 0) * 1000;
    data[key] = {
      value,
      updatedAt: Date.now(),
      expiresAt: ttlMs > 0 ? Date.now() + ttlMs : 0
    };
    await this.flush();
  }

  async flush() {
    this.writeQueue = this.writeQueue.then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const tmp = `${this.filePath}.${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}.tmp`;
      await writeFile(tmp, JSON.stringify(this.cache || {}, null, 2), "utf8");
      for (let attempt = 1; attempt <= 6; attempt += 1) {
        try {
          await rename(tmp, this.filePath);
          return;
        } catch (error) {
          if (!["EPERM", "EBUSY", "EACCES"].includes(error?.code) || attempt === 6) {
            await unlink(tmp).catch(() => {});
            throw error;
          }
          await sleep(60 * attempt);
        }
      }
    });
    return this.writeQueue;
  }
}

const roomStore = new FileRoomStore(ROOMS_FILE);
const aiSecurityStore = new FileRoomStore(AI_SECURITY_FILE);

function buildEnv() {
  return {
    JJK_ONLINE_ROOMS: roomStore,
    AI_PROVIDER: process.env.AI_PROVIDER || "openai_compatible",
    AI_BASE_URL: process.env.AI_BASE_URL || process.env.OPENAI_COMPATIBLE_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3",
    AI_MODEL: process.env.AI_MODEL || process.env.OPENAI_COMPATIBLE_MODEL || "doubao-seed-2-0-mini-260215",
    AI_MAX_TOKENS: process.env.AI_MAX_TOKENS || "700",
    AI_TEMPERATURE: process.env.AI_TEMPERATURE || "0.4",
    AI_TIMEOUT_MS: process.env.AI_TIMEOUT_MS || "30000",
    AI_API_KEY: process.env.AI_API_KEY || "",
    AI_MAX_PROMPT_TOKENS: process.env.AI_MAX_PROMPT_TOKENS || String(AI_MAX_PROMPT_TOKENS)
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(Object.assign(new Error("请求体过大。"), { status: 413 }));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(payload));
}

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || "";
}

function east8DateKey(date = new Date()) {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function estimateTokensFromText(value) {
  return Math.ceil(String(value || "").length / 2);
}

function estimatePromptTokens(body = {}) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length) return estimateTokensFromText(JSON.stringify(body || {}));
  return messages.reduce((sum, message) => sum + estimateTokensFromText(message?.content || ""), 0);
}

function getAiHeader(req, name) {
  return String(req.headers[name.toLowerCase()] || "").trim();
}

function getAiIdentity(req) {
  const clientIp = getClientIp(req);
  const loginCardIp = getAiHeader(req, "x-jjk-login-card-ip") || clientIp;
  const nickname = getAiHeader(req, "x-jjk-login-card-nickname") || "未命名登录卡";
  const ownerId = getAiHeader(req, "x-jjk-login-card-owner") || "anonymous";
  const characterId = getAiHeader(req, "x-jjk-character-id") || "default-character";
  const usageKind = getAiHeader(req, "x-jjk-ai-usage-kind") || getAiHeader(req, "x-jjk-ai-kind") || "unknown";
  const requestKey = getAiHeader(req, "x-jjk-ai-request-key");
  const isAdmin = ["1", "true", "yes", "admin"].includes(getAiHeader(req, "x-jjk-login-card-admin").toLowerCase());
  return { clientIp, loginCardIp, nickname, ownerId, characterId, usageKind, requestKey, isAdmin };
}

function isAdminLoginCard(identity) {
  return Boolean(identity?.isAdmin);
}

async function readAiSecurity() {
  const stored = await aiSecurityStore.get("state");
  if (stored && typeof stored === "object") return normalizeAiSecurityState(stored);
  if (typeof stored === "string") {
    try { return normalizeAiSecurityState(JSON.parse(stored)); } catch {}
  }
  return normalizeAiSecurityState({});
}

async function writeAiSecurity(state) {
  pruneAiRequestKeys(state);
  await aiSecurityStore.put("state", state, { expirationTtl: 366 * 24 * 60 * 60 });
}

function normalizeAiSecurityState(rawState) {
  const state = rawState && typeof rawState === "object" ? rawState : {};
  state.blockedAiIps ||= {};
  state.quotas ||= {};
  state.recent ||= {};
  state.requestKeys ||= {};
  pruneAiRequestKeys(state);
  return state;
}

function pruneAiRequestKeys(state, now = Date.now()) {
  state.requestKeys ||= {};
  for (const [key, entry] of Object.entries(state.requestKeys)) {
    const at = Number(entry?.at || 0);
    if (!at || now - at > AI_REQUEST_DEDUPE_TTL_MS) delete state.requestKeys[key];
  }
}

function isAiIdentityBlocked(state, identity) {
  return Boolean(state.blockedAiIps?.[identity.loginCardIp] || state.blockedAiIps?.[identity.clientIp]);
}

function quotaKey(identity) {
  return [east8DateKey(), identity.ownerId, identity.characterId, identity.usageKind].join("|");
}

function assertAiQuotaAvailable(state, identity) {
  if (!["character_generation", "life_narrative", "battle_summary"].includes(identity.usageKind)) return;
  const key = quotaKey(identity);
  const quota = state.quotas[key] || { count: 0 };
  if (quota.count >= AI_DAILY_CATEGORY_LIMIT) {
    const error = Object.assign(new Error("AI daily quota exceeded."), { status: 429, reasonCode: "daily-quota-exceeded" });
    throw error;
  }
  state.quotas[key] = { count: quota.count + 1, updatedAt: Date.now() };
}

function checkAiRequestRate(state, identity, bodyBytes) {
  const now = Date.now();
  const key = identity.loginCardIp || identity.clientIp || "unknown";
  state.recent ||= {};
  const recent = state.recent[key] || [];
  const next = recent.filter((item) => now - item.at <= AI_HIGH_FREQUENCY_WINDOW_MS);
  const totalBytes = next.reduce((sum, item) => sum + Number(item.bytes || 0), 0) + Number(bodyBytes || 0);
  state.recent[key] = next;
  if (next.length >= AI_HIGH_FREQUENCY_LIMIT) {
    const lastAt = Math.max(...next.map((item) => Number(item.at || 0)));
    return {
      ok: false,
      status: 429,
      reason: "ai-rate-limit",
      retryAfterMs: Math.max(1000, AI_HIGH_FREQUENCY_WINDOW_MS - (now - lastAt))
    };
  }
  if (totalBytes > AI_LARGE_BODY_BYTES * 3) {
    return {
      ok: false,
      status: 413,
      reason: "ai-request-body-too-large",
      retryAfterMs: 0
    };
  }
  next.push({ at: now, bytes: bodyBytes });
  state.recent[key] = next;
  return { ok: true, status: 200, reason: "" };
}

async function appendAiRequestLog(entry) {
  await mkdir(path.dirname(AI_REQUEST_LOG_FILE), { recursive: true });
  await appendFile(AI_REQUEST_LOG_FILE, JSON.stringify(entry) + "\n", "utf8");
}

async function forwardAiProviderRequest(body, env) {
  const base = String(env.AI_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3").replace(/\/+$/, "");
  const apiKey = String(env.AI_API_KEY || "").trim();
  if (!apiKey) return {
    provider: "server_proxy",
    choices: [{ message: { content: JSON.stringify({ summary: "服务器未配置 AI_API_KEY。", winnerHint: "undecided" }) } }],
    usage: { prompt_tokens: estimatePromptTokens(body), completion_tokens: 0, total_tokens: estimatePromptTokens(body) }
  };
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = Object.assign(new Error(data?.error?.message || data?.message || `AI HTTP ${response.status}`), { status: response.status });
    throw error;
  }
  return data;
}

async function handleAiProviderProxy(req, res, rawBody) {
  const env = buildEnv();
  const identity = getAiIdentity(req);
  const state = await readAiSecurity();
  const bodyBytes = Buffer.byteLength(rawBody || "", "utf8");
  let body = {};
  try {
    body = JSON.parse(rawBody || "{}");
  } catch {
    return sendJson(res, 400, { ok: false, error: "AI request body is not valid JSON." });
  }
  if (!isAdminLoginCard(identity) && isAiIdentityBlocked(state, identity)) {
    await appendAiRequestLog({ at: new Date().toISOString(), blocked: true, reason: "blacklist", identity, bodyBytes });
    return sendJson(res, 403, { ok: false, error: AI_REJECT_MESSAGE });
  }
  if (identity.requestKey && state.requestKeys[identity.requestKey]) {
    const duplicateAgeMs = Date.now() - Number(state.requestKeys[identity.requestKey]?.at || 0);
    const retryAfterMs = Math.max(1000, AI_REQUEST_DEDUPE_TTL_MS - duplicateAgeMs);
    await appendAiRequestLog({ at: new Date().toISOString(), duplicate: true, identity, bodyBytes, duplicateAgeMs, retryAfterMs });
    res.setHeader("Retry-After", String(Math.max(1, Math.ceil(retryAfterMs / 1000))));
    return sendJson(res, 409, { ok: false, error: "duplicate-ai-request", retryAfterMs });
  }
  const promptTokens = estimatePromptTokens(body);
  if (!isAdminLoginCard(identity) && promptTokens > AI_MAX_PROMPT_TOKENS) {
    await writeAiSecurity(state);
    await appendAiRequestLog({ at: new Date().toISOString(), rejected: true, reason: "oversized-ai-prompt", identity, promptTokens, bodyBytes });
    return sendJson(res, 413, { ok: false, error: "AI prompt too large." });
  }
  try {
    if (!isAdminLoginCard(identity)) {
      const rate = checkAiRequestRate(state, identity, bodyBytes);
      if (!rate.ok) {
        await writeAiSecurity(state);
        await appendAiRequestLog({ at: new Date().toISOString(), rejected: true, reason: rate.reason, identity, promptTokens, bodyBytes, retryAfterMs: rate.retryAfterMs });
        if (rate.status === 429) {
          res.setHeader("Retry-After", String(Math.max(1, Math.ceil(Number(rate.retryAfterMs || 0) / 1000))));
          return sendJson(res, 429, { ok: false, error: "AI request interval limit.", retryAfterMs: rate.retryAfterMs });
        }
        return sendJson(res, rate.status || 413, { ok: false, error: "AI request body too large." });
      }
      assertAiQuotaAvailable(state, identity);
    }
    if (identity.requestKey) state.requestKeys[identity.requestKey] = { at: Date.now() };
    await writeAiSecurity(state);
    const startedAt = Date.now();
    const data = await forwardAiProviderRequest(body, env);
    const usage = data.usage || { prompt_tokens: promptTokens, completion_tokens: 0, total_tokens: promptTokens };
    await appendAiRequestLog({
      at: new Date().toISOString(),
      identity,
      usageKind: identity.usageKind,
      promptTokens: usage.prompt_tokens ?? promptTokens,
      totalTokens: usage.total_tokens ?? promptTokens,
      bodyBytes,
      durationMs: Date.now() - startedAt,
      requestIntervalMs: state.recent?.[identity.loginCardIp]?.length > 1
        ? Date.now() - state.recent[identity.loginCardIp][state.recent[identity.loginCardIp].length - 2].at
        : null
    });
    if (identity.requestKey) state.requestKeys[identity.requestKey] = { at: Date.now(), status: "completed" };
    await writeAiSecurity(state);
    sendJson(res, 200, data);
  } catch (error) {
    if (identity.requestKey) delete state.requestKeys[identity.requestKey];
    await writeAiSecurity(state);
    await appendAiRequestLog({ at: new Date().toISOString(), failed: true, identity, bodyBytes, error: String(error?.message || error) });
    sendJson(res, Number(error?.status || 500), { ok: false, error: error?.reasonCode === "daily-quota-exceeded" ? "今日该角色卡此类 AI 次数已用完。" : String(error?.message || error) });
  }
}

async function sendWorkerResponse(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || "/", "http://localhost");
    if (req.method === "GET" && (requestUrl.pathname === "/" || requestUrl.pathname === "/health")) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({
        ok: true,
        service: "jjk_online_battle_lighthouse",
        protocol: "jjk_online_battle_v1",
        time: new Date().toISOString()
      }));
      return;
    }

    const body = req.method === "POST" ? await readBody(req) : "";
    if (req.method === "POST" && requestUrl.pathname === "/api/ai-provider/chat/completions") {
      await handleAiProviderProxy(req, res, body);
      return;
    }
    if (req.method === "GET" && requestUrl.pathname === "/api/ai-logs") {
      const limit = Math.min(5000, Math.max(1, Number(requestUrl.searchParams.get("limit") || 500)));
      const raw = await readFile(AI_REQUEST_LOG_FILE, "utf8").catch(() => "");
      sendJson(res, 200, { ok: true, lines: raw.trim().split(/\n/).filter(Boolean).slice(-limit) });
      return;
    }
    if (req.method === "GET" && requestUrl.pathname === "/api/ai-security") {
      const state = await readAiSecurity();
      sendJson(res, 200, {
        ok: true,
        blockedAiIps: state.blockedAiIps || {},
        quotas: state.quotas || {},
        recent: state.recent || {}
      });
      return;
    }
    const request = new Request(`http://localhost${req.url || "/"}`, {
      method: req.method,
      headers: req.headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : body
    });
    const response = await worker.fetch(request, buildEnv());
    await sendWorkerResponse(res, response);
  } catch (error) {
    res.statusCode = Number(error?.status || 500);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(JSON.stringify({ ok: false, error: String(error?.message || error || "服务器错误。") }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`JJK online battle backend listening on http://${HOST}:${PORT}`);
  console.log(`Room data file: ${ROOMS_FILE}`);
});
