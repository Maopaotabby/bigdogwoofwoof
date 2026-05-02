import http from "node:http";
import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import worker from "./online-battle-worker.js";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), "server-data");
const ROOMS_FILE = path.join(DATA_DIR, "online-rooms.json");
const AI_AUDIT_LOG_FILE = process.env.AI_AUDIT_LOG_FILE || path.join(DATA_DIR, "ai-assist-requests.jsonl");
const AI_RATE_LIMIT_FILE = process.env.AI_RATE_LIMIT_FILE || path.join(DATA_DIR, "ai-assist-rate-limits.json");
const AI_ASSIST_DAILY_LIMIT = Math.max(1, Number(process.env.AI_ASSIST_DAILY_LIMIT || 5));
const AI_ASSIST_MAX_TEXT_BYTES = Math.max(1, Number(process.env.AI_ASSIST_MAX_TEXT_BYTES || 1000));
const AI_ADMIN_ID = process.env.AI_ADMIN_ID || "ADMIN";
const AI_ADMIN_PASSWORD = process.env.AI_ADMIN_PASSWORD || "VOCALOIDKagamineMegurineLukaHatsuneMiku0831";
const AI_DEFAULT_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
const AI_DEFAULT_MODEL = "doubao-seed-2-0-lite-260215";
const AI_FALLBACK_PROXY_URL = process.env.AI_FALLBACK_PROXY_URL || "";
const AI_FALLBACK_PROXY_ORIGIN = (process.env.AI_FALLBACK_PROXY_ORIGIN || "https://bigdogwoofwoof.pages.dev").replace(/\/+$/, "");
const AI_FALLBACK_PROXY_MODE = process.env.AI_FALLBACK_PROXY_MODE || "redirect";
const AI_HENAN_EXEMPT_RATE_LIMIT = process.env.AI_HENAN_EXEMPT_RATE_LIMIT !== "false";
const AI_HENAN_REGION_HEADERS = (process.env.AI_HENAN_REGION_HEADERS || "x-province,x-client-province,x-ip-region,x-real-region,x-forwarded-region,cf-region,cf-ipregion,cloudfront-viewer-country-region")
  .split(",")
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);
const AI_HENAN_IP_CIDRS = (process.env.AI_HENAN_IP_CIDRS || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

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
      const tmp = `${this.filePath}.tmp`;
      await writeFile(tmp, JSON.stringify(this.cache || {}, null, 2), "utf8");
      await rename(tmp, this.filePath);
    });
    return this.writeQueue;
  }
}

const roomStore = new FileRoomStore(ROOMS_FILE);

class FileJsonStore {
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

  async flush() {
    this.writeQueue = this.writeQueue.then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const tmp = `${this.filePath}.tmp`;
      await writeFile(tmp, JSON.stringify(this.cache || {}, null, 2), "utf8");
      await rename(tmp, this.filePath);
    });
    return this.writeQueue;
  }
}

const aiRateStore = new FileJsonStore(AI_RATE_LIMIT_FILE);

function buildEnv() {
  const configuredBaseUrl = String(process.env.AI_BASE_URL || AI_DEFAULT_BASE_URL).replace(/\/responses\/?$/i, "");
  return {
    JJK_ONLINE_ROOMS: roomStore,
    AI_PROVIDER: process.env.AI_PROVIDER || "ark_ai",
    AI_BASE_URL: configuredBaseUrl,
    AI_CHAT_COMPLETIONS_URL: process.env.AI_CHAT_COMPLETIONS_URL || process.env.AI_API_URL || "",
    AI_MODEL: process.env.AI_MODEL || AI_DEFAULT_MODEL,
    AI_MAX_TOKENS: process.env.AI_MAX_TOKENS || "700",
    AI_TEMPERATURE: process.env.AI_TEMPERATURE || "0.4",
    AI_TIMEOUT_MS: process.env.AI_TIMEOUT_MS || "30000",
    AI_API_KEY: process.env.AI_API_KEY || "",
    AI_ALLOWED_ORIGINS: process.env.AI_ALLOWED_ORIGINS || "",
    AI_ALLOW_LOCAL_ORIGIN: process.env.AI_ALLOW_LOCAL_ORIGIN || "",
    AI_ALLOW_NO_ORIGIN: process.env.AI_ALLOW_NO_ORIGIN || "",
    AI_ASSIST_DAILY_LIMIT: process.env.AI_ASSIST_DAILY_LIMIT || String(AI_ASSIST_DAILY_LIMIT),
    AI_ASSIST_MAX_TEXT_BYTES: process.env.AI_ASSIST_MAX_TEXT_BYTES || String(AI_ASSIST_MAX_TEXT_BYTES),
    AI_HENAN_EXEMPT_RATE_LIMIT: process.env.AI_HENAN_EXEMPT_RATE_LIMIT || String(AI_HENAN_EXEMPT_RATE_LIMIT),
    AI_HENAN_REGION_HEADERS: process.env.AI_HENAN_REGION_HEADERS || AI_HENAN_REGION_HEADERS.join(","),
    AI_HENAN_IP_CIDRS: process.env.AI_HENAN_IP_CIDRS || AI_HENAN_IP_CIDRS.join(","),
    AI_ADMIN_ID: process.env.AI_ADMIN_ID || AI_ADMIN_ID,
    AI_ADMIN_PASSWORD: process.env.AI_ADMIN_PASSWORD || AI_ADMIN_PASSWORD
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

function getHeader(req, name) {
  return String(req.headers[name.toLowerCase()] || "").trim();
}

function getClientIp(req) {
  const forwarded = getHeader(req, "x-forwarded-for").split(",")[0].trim();
  return normalizeClientIp(forwarded || getHeader(req, "x-real-ip") || req.socket?.remoteAddress || "unknown");
}

function normalizeClientIp(ip) {
  const text = String(ip || "").trim();
  if (text.startsWith("::ffff:")) return text.slice(7);
  return text;
}

function requestOrigin(req) {
  const origin = getHeader(req, "origin");
  if (origin) return origin.replace(/\/+$/, "");
  const referer = getHeader(req, "referer");
  if (!referer) return "";
  try {
    return new URL(referer).origin.replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function sameHostOrigin(req) {
  const host = getHeader(req, "x-forwarded-host") || getHeader(req, "host");
  const proto = getHeader(req, "x-forwarded-proto") || "http";
  return host ? `${proto}://${host}`.replace(/\/+$/, "") : "";
}

function isLocalOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(origin);
}

function isAiOriginAllowed(req) {
  const origin = requestOrigin(req);
  if (!origin) return process.env.AI_ALLOW_NO_ORIGIN === "true";
  const allowed = new Set(
    String(process.env.AI_ALLOWED_ORIGINS || "")
      .split(",")
      .map((item) => item.trim().replace(/\/+$/, ""))
      .filter(Boolean)
  );
  const sameOrigin = sameHostOrigin(req);
  if (sameOrigin) allowed.add(sameOrigin);
  if (process.env.AI_ALLOW_LOCAL_ORIGIN === "true" && isLocalOrigin(origin)) return true;
  return allowed.has(origin);
}

function parseJsonBody(body) {
  try {
    return JSON.parse(body || "{}");
  } catch {
    return null;
  }
}

function shouldFallbackAiProxy(response, responseJson) {
  if (!AI_FALLBACK_PROXY_URL || response?.status !== 401) return false;
  return /api key|authorization|unauthorized|鉴权|认证|密钥/i.test(String(responseJson?.error || ""));
}

async function requestFallbackAiProxy(req, forwardedBody, ip, origin) {
  const headers = new Headers();
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Origin", AI_FALLBACK_PROXY_ORIGIN);
  headers.set("Referer", `${AI_FALLBACK_PROXY_ORIGIN}/`);
  headers.set("User-Agent", sanitizeHeaderValue(getHeader(req, "user-agent")) || "bigdogwoofwoof-lighthouse-fallback");
  headers.set("X-Forwarded-For", [ip, sanitizeHeaderValue(getHeader(req, "x-forwarded-for"))].filter(Boolean).join(", "));
  headers.set("X-Original-Origin", sanitizeHeaderValue(origin));
  headers.set("X-Proxy-By", "bigdogwoofwoof-lighthouse");
  const fallbackResponse = await fetch(AI_FALLBACK_PROXY_URL, {
    method: "POST",
    headers,
    body: forwardedBody
  });
  const fallbackText = await fallbackResponse.text();
  return {
    response: fallbackResponse,
    responseText: fallbackText,
    responseJson: parseJsonBody(fallbackText) || {}
  };
}

function sha256(value) {
  return createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function sanitizeHeaderValue(value) {
  return String(value || "").slice(0, 800);
}

function buildHeaderAudit(req) {
  return {
    host: sanitizeHeaderValue(getHeader(req, "host")),
    origin: sanitizeHeaderValue(getHeader(req, "origin")),
    referer: sanitizeHeaderValue(getHeader(req, "referer")),
    userAgent: sanitizeHeaderValue(getHeader(req, "user-agent")),
    forwardedFor: sanitizeHeaderValue(getHeader(req, "x-forwarded-for")),
    realIp: sanitizeHeaderValue(getHeader(req, "x-real-ip")),
    forwardedProto: sanitizeHeaderValue(getHeader(req, "x-forwarded-proto")),
    forwardedHost: sanitizeHeaderValue(getHeader(req, "x-forwarded-host")),
    regionHeaders: Object.fromEntries(AI_HENAN_REGION_HEADERS.map((name) => [name, sanitizeHeaderValue(getHeader(req, name))]).filter((entry) => entry[1]))
  };
}

function parseIpv4ToInt(ip) {
  const parts = String(ip || "").split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const byte = Number(part);
    if (byte < 0 || byte > 255) return null;
    value = (value << 8) + byte;
  }
  return value >>> 0;
}

function ipv4InCidr(ip, cidr) {
  const [range, bitsText] = String(cidr || "").split("/");
  const bits = Number(bitsText);
  const ipInt = parseIpv4ToInt(ip);
  const rangeInt = parseIpv4ToInt(range);
  if (ipInt === null || rangeInt === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

function isHenanRegionText(value) {
  const text = String(value || "").trim();
  return /河南|henan|cn-ha|^ha$/i.test(text);
}

function getHenanAccessClassification(req, ip) {
  const regionHeaders = buildHeaderAudit(req).regionHeaders || {};
  const matchedHeader = Object.entries(regionHeaders).find(([, value]) => isHenanRegionText(value));
  if (matchedHeader) {
    return {
      henanIp: true,
      method: "region_header",
      header: matchedHeader[0],
      value: matchedHeader[1],
      exemptionEnabled: AI_HENAN_EXEMPT_RATE_LIMIT
    };
  }
  const matchedCidr = AI_HENAN_IP_CIDRS.find((cidr) => ipv4InCidr(ip, cidr));
  if (matchedCidr) {
    return {
      henanIp: true,
      method: "configured_cidr",
      cidr: matchedCidr,
      exemptionEnabled: AI_HENAN_EXEMPT_RATE_LIMIT
    };
  }
  return { henanIp: false, method: "", exemptionEnabled: AI_HENAN_EXEMPT_RATE_LIMIT };
}

function redactAdminAuth(value) {
  if (!value || typeof value !== "object") return value;
  const copy = { ...value };
  if (copy.adminAuth) copy.adminAuth = { id: String(copy.adminAuth.id || ""), password: "[redacted]" };
  return copy;
}

function stripAdminAuth(value) {
  if (!value || typeof value !== "object") return value;
  const copy = { ...value };
  delete copy.adminAuth;
  return copy;
}

function isAdminRequest(body) {
  const auth = body?.adminAuth || {};
  return String(auth.id || "").trim() === AI_ADMIN_ID && String(auth.password || "") === AI_ADMIN_PASSWORD;
}

function utf8Bytes(value) {
  return Buffer.byteLength(String(value || ""), "utf8");
}

function compactPromptPayload(payload) {
  if (!payload || typeof payload !== "object") return payload;
  return {
    metadata: payload.metadata || null,
    model: payload.model || "",
    input: payload.input || payload.messages || payload.prompt || "",
    max_output_tokens: payload.max_output_tokens,
    max_tokens: payload.max_tokens,
    temperature: payload.temperature
  };
}

function buildStrictAiAuditBase(req, body, rawBody, uploadedText, uploadedTextBytes, accessClass) {
  const payloadJson = JSON.stringify(body?.payload || {});
  return {
    strictAudit: Boolean(accessClass?.henanIp),
    accessClass,
    network: buildHeaderAudit(req),
    requestMeta: {
      method: req.method,
      url: req.url || "",
      rawBodyBytes: utf8Bytes(rawBody),
      rawBodySha256: sha256(rawBody),
      promptPayloadBytes: utf8Bytes(payloadJson),
      promptPayloadSha256: sha256(payloadJson),
      uploadedTextBytes,
      uploadedTextSha256: sha256(uploadedText)
    }
  };
}

function extractUploadedText(body) {
  const direct = body?.clientRequest?.uploadedText ?? body?.uploadedText;
  if (direct != null) return String(direct || "");
  const payload = body?.payload || {};
  const context = payload?.metadata?.context || payload?.context || {};
  return String(context.description || context.text || context.prompt || "");
}

function normalizeUsage(usage) {
  if (!usage || typeof usage !== "object") return null;
  const promptTokens = usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokens ?? usage.inputTokens ?? null;
  const completionTokens = usage.completion_tokens ?? usage.output_tokens ?? usage.completionTokens ?? usage.outputTokens ?? null;
  const totalTokens = usage.total_tokens ?? usage.totalTokens ?? (Number(promptTokens || 0) + Number(completionTokens || 0) || null);
  return { raw: usage, promptTokens, completionTokens, totalTokens };
}

async function appendAiAuditLog(entry) {
  await mkdir(path.dirname(AI_AUDIT_LOG_FILE), { recursive: true });
  await appendFile(AI_AUDIT_LOG_FILE, `${JSON.stringify(entry)}\n`, "utf8");
}

async function enforceAiAssistRateLimit(ip, isAdmin) {
  if (isAdmin) return { limited: false, remaining: "admin" };
  const data = await aiRateStore.load();
  const now = Date.now();
  const windowMs = 24 * 60 * 60 * 1000;
  const key = ip || "unknown";
  const timestamps = Array.isArray(data[key]) ? data[key].filter((time) => now - Number(time || 0) < windowMs) : [];
  if (timestamps.length >= AI_ASSIST_DAILY_LIMIT) {
    data[key] = timestamps;
    await aiRateStore.flush();
    return { limited: true, remaining: 0, resetAt: new Date(Math.min(...timestamps) + windowMs).toISOString() };
  }
  timestamps.push(now);
  data[key] = timestamps;
  await aiRateStore.flush();
  return { limited: false, remaining: Math.max(0, AI_ASSIST_DAILY_LIMIT - timestamps.length) };
}

async function handleAiRequest(req, res, rawBody) {
  const ip = getClientIp(req);
  const origin = requestOrigin(req);
  const body = parseJsonBody(rawBody);
  if (!body) return sendJson(res, 400, { ok: false, error: "JSON 请求无效。" });
  const promptTemplateId = String(body.promptTemplateId || body.payload?.metadata?.templateId || "").slice(0, 80);
  const isCharacterAssist = promptTemplateId === "duel_character_assist";
  const admin = isAdminRequest(body);
  const uploadedText = extractUploadedText(body);
  const uploadedTextBytes = utf8Bytes(uploadedText);
  const accessClass = getHenanAccessClassification(req, ip);
  const henanExempt = Boolean(accessClass.henanIp && accessClass.exemptionEnabled);
  const strictAudit = buildStrictAiAuditBase(req, body, rawBody, uploadedText, uploadedTextBytes, accessClass);

  if (!admin && !isAiOriginAllowed(req)) {
    await appendAiAuditLog({
      time: new Date().toISOString(),
      ip,
      origin,
      promptTemplateId,
      ...strictAudit,
      rejected: true,
      reason: "origin_not_allowed",
      request: redactAdminAuth(body)
    });
    return sendJson(res, 403, { ok: false, error: "AI 生成必须从服务器页面发起，当前来源未被允许。" });
  }
  if (isCharacterAssist && uploadedTextBytes > AI_ASSIST_MAX_TEXT_BYTES && !admin && !henanExempt) {
    await appendAiAuditLog({
      time: new Date().toISOString(),
      ip,
      origin,
      promptTemplateId,
      ...strictAudit,
      rejected: true,
      reason: "uploaded_text_too_large",
      uploadedTextBytes,
      limitBytes: AI_ASSIST_MAX_TEXT_BYTES,
      request: redactAdminAuth(body)
    });
    return sendJson(res, 413, { ok: false, error: `AI辅助角色生成输入不能超过 ${AI_ASSIST_MAX_TEXT_BYTES} 字节。` });
  }
  if (isCharacterAssist) {
    const rate = henanExempt
      ? { limited: false, remaining: "henan_exempt", exemptReason: "henan_ip_policy" }
      : await enforceAiAssistRateLimit(ip, admin);
    if (rate.limited) {
      await appendAiAuditLog({
        time: new Date().toISOString(),
        ip,
        origin,
        promptTemplateId,
        ...strictAudit,
        rejected: true,
        reason: "ip_daily_limit",
        uploadedTextBytes,
        request: redactAdminAuth(body),
        rateLimit: rate
      });
      return sendJson(res, 429, { ok: false, error: "该 IP 24 小时内 AI辅助角色生成次数已达上限。", rateLimit: rate });
    }
  }

  const forwardedBody = JSON.stringify(body);
  const request = new Request(`http://localhost${req.url || "/"}`, {
    method: req.method,
    headers: req.headers,
    body: forwardedBody
  });
  let response = await worker.fetch(request, buildEnv());
  let responseText = await response.text();
  let responseJson = parseJsonBody(responseText) || {};
  let fallbackProxy = null;
  if (shouldFallbackAiProxy(response, responseJson)) {
    fallbackProxy = {
      used: true,
      mode: AI_FALLBACK_PROXY_MODE,
      reason: "primary_ai_auth_failed",
      primaryStatus: response.status,
      primaryError: String(responseJson.error || "").slice(0, 240)
    };
    if (AI_FALLBACK_PROXY_MODE === "redirect") {
      await appendAiAuditLog({
        time: new Date().toISOString(),
        ip,
        origin,
        promptTemplateId,
        ...strictAudit,
        admin: admin ? "yes" : "no",
        henanExempt: henanExempt ? "yes" : "no",
        limitPolicy: henanExempt ? "henan_ip_unlimited_strict_audit" : (admin ? "admin_unlimited" : "standard_ip_24h_limit"),
        providerId: String(body.providerId || ""),
        endpointType: String(body.endpointType || ""),
        siteVersion: String(body.siteVersion || ""),
        uploadedText,
        uploadedTextBytes,
        promptPayload: compactPromptPayload(body.payload),
        fallbackProxy,
        usage: null,
        responseStatus: 307,
        responseOk: true,
        error: responseJson.error || "",
        request: redactAdminAuth(body)
      });
      res.statusCode = 307;
      res.setHeader("Location", AI_FALLBACK_PROXY_URL);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "no-store");
      res.end();
      return;
    }
    const fallbackResult = await requestFallbackAiProxy(req, forwardedBody, ip, origin);
    response = fallbackResult.response;
    responseText = fallbackResult.responseText;
    responseJson = fallbackResult.responseJson;
    fallbackProxy.fallbackStatus = response.status;
    fallbackProxy.fallbackOk = response.ok;
  }
  await appendAiAuditLog({
    time: new Date().toISOString(),
    ip,
    origin,
    promptTemplateId,
    ...strictAudit,
    admin: admin ? "yes" : "no",
    henanExempt: henanExempt ? "yes" : "no",
    limitPolicy: henanExempt ? "henan_ip_unlimited_strict_audit" : (admin ? "admin_unlimited" : "standard_ip_24h_limit"),
    providerId: String(body.providerId || ""),
    endpointType: String(body.endpointType || ""),
    siteVersion: String(body.siteVersion || ""),
    uploadedText,
    uploadedTextBytes,
    promptPayload: compactPromptPayload(body.payload),
    fallbackProxy,
    usage: normalizeUsage(responseJson.usage),
    responseStatus: response.status,
    responseOk: response.ok,
    error: responseJson.error || "",
    request: redactAdminAuth(body)
  });
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(responseText);
}

async function sendWorkerResponse(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && (req.url === "/" || req.url === "/health")) {
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
    if (req.method === "POST" && new URL(`http://localhost${req.url || "/"}`).pathname === "/ai") {
      await handleAiRequest(req, res, body);
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
