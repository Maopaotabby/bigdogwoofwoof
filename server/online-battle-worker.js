const PROTOCOL = "jjk_online_battle_v1";
const WORKER_BUILD_VERSION = "20260430-online-pass-turn-v1";
const MAX_LOGS = 120;
const ROOM_TTL_SECONDS = 7200;
const DEFAULT_AI_TIMEOUT_MS = 30000;
const MAX_AI_TIMEOUT_MS = 150000;
const DEFAULT_ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
const DEFAULT_ARK_CHAT_COMPLETIONS_URL = `${DEFAULT_ARK_BASE_URL}/chat/completions`;
const DEFAULT_ARK_MODEL = "doubao-seed-2-0-lite-260215";
const DEFAULT_AI_ALLOWED_ORIGINS = "https://bigdogwoofwoof.pages.dev";
const PHASES = new Set(["preparing", "battle_starting", "turn_selecting", "turn_resolving", "reviewing", "ended"]);
const PASS_TURN_ACTION_ID = "online_pass_turn";
const memoryRooms = new Map();

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

function getRequestHeader(request, name) {
  return String(request?.headers?.get(name) || "").trim();
}

function requestOrigin(request) {
  const origin = getRequestHeader(request, "origin");
  if (origin) return origin.replace(/\/+$/, "");
  const referer = getRequestHeader(request, "referer");
  if (!referer) return "";
  try {
    return new URL(referer).origin.replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function getClientIpFromRequest(request) {
  return String(
    getRequestHeader(request, "cf-connecting-ip") ||
    getRequestHeader(request, "x-forwarded-for").split(",")[0].trim() ||
    "unknown"
  ).replace(/^::ffff:/, "");
}

function utf8Bytes(value) {
  return new TextEncoder().encode(String(value || "")).length;
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function splitCsv(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function isAiOriginAllowed(request, env) {
  const origin = requestOrigin(request);
  if (!origin) return env.AI_ALLOW_NO_ORIGIN === "true";
  const allowed = new Set(splitCsv(env.AI_ALLOWED_ORIGINS || DEFAULT_AI_ALLOWED_ORIGINS).map((item) => item.replace(/\/+$/, "")));
  return allowed.has(origin);
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
  return /河南|henan|cn-ha|^ha$/i.test(String(value || "").trim());
}

function getHenanAccessClassification(request, env, ip) {
  const headerNames = splitCsv(env.AI_HENAN_REGION_HEADERS || "x-province,x-client-province,x-ip-region,x-real-region,x-forwarded-region,cf-region,cf-ipregion,cloudfront-viewer-country-region");
  const regionHeaders = Object.fromEntries(headerNames.map((name) => [name, getRequestHeader(request, name)]).filter((entry) => entry[1]));
  const matchedHeader = Object.entries(regionHeaders).find(([, value]) => isHenanRegionText(value));
  if (matchedHeader) return { henanIp: true, method: "region_header", header: matchedHeader[0], value: matchedHeader[1], exemptionEnabled: env.AI_HENAN_EXEMPT_RATE_LIMIT !== "false", regionHeaders };
  const matchedCidr = splitCsv(env.AI_HENAN_IP_CIDRS || "").find((cidr) => ipv4InCidr(ip, cidr));
  if (matchedCidr) return { henanIp: true, method: "configured_cidr", cidr: matchedCidr, exemptionEnabled: env.AI_HENAN_EXEMPT_RATE_LIMIT !== "false", regionHeaders };
  return { henanIp: false, method: "", exemptionEnabled: env.AI_HENAN_EXEMPT_RATE_LIMIT !== "false", regionHeaders };
}

function extractUploadedText(body) {
  const direct = body?.clientRequest?.uploadedText ?? body?.uploadedText;
  if (direct != null) return String(direct || "");
  const context = body?.payload?.metadata?.context || body?.payload?.context || {};
  return String(context.description || context.text || context.prompt || "");
}

function isAdminRequest(env, body) {
  const auth = body?.adminAuth || {};
  const adminId = String(env.AI_ADMIN_ID || "ADMIN");
  const adminPassword = String(env.AI_ADMIN_PASSWORD || "VOCALOIDKagamineMegurineLukaHatsuneMiku0831");
  return Boolean(adminPassword) && String(auth.id || "").trim() === adminId && String(auth.password || "") === adminPassword;
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

function normalizeRoomId(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

function normalizeSide(value) {
  return value === "right" ? "right" : "left";
}

function otherSide(side) {
  return normalizeSide(side) === "left" ? "right" : "left";
}

function normalizePhase(value) {
  const text = String(value || "").trim();
  return PHASES.has(text) ? text : "preparing";
}

function nowMs() {
  return Date.now();
}

function clampNumber(value, fallback, min, max) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

function withTimeout(promise, timeoutMs, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(message), { code: "AI_TIMEOUT", timeoutMs })), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function isTimeoutError(error) {
  return error?.code === "AI_TIMEOUT" || /超时|timeout/i.test(String(error?.message || error || ""));
}

function requestIdFrom(body = {}) {
  return String(body.requestId || "").replace(/[^a-zA-Z0-9_.:-]/g, "").slice(0, 80);
}

function roomDebug(room, extra = {}) {
  return redactSecrets({
    workerBuildVersion: WORKER_BUILD_VERSION,
    roomId: room?.roomId || "",
    phase: room?.phase || "",
    round: room?.round || 0,
    locks: room?.turnState?.locks || {},
    leftHasPlayer: Boolean(room?.players?.left?.playerId),
    rightHasPlayer: Boolean(room?.players?.right?.playerId),
    lastAiDebug: room?.reviewState?.lastAiDebug || null,
    ...extra
  });
}

function emptyPlayer(side) {
  return {
    side,
    role: side === "left" ? "owner" : "guest",
    playerId: "",
    displayName: "",
    connected: false,
    lastSeenAt: 0,
    characterId: "",
    characterSnapshot: null,
    characterLocked: false,
    actionLocked: false
  };
}

function isSecretKey(key) {
  return /api.?key|authorization|secret|token|proxy.?endpoint|byok|localstorage|raw.?ai|provider.?settings/i.test(String(key));
}

function redactSecrets(value, seen = new WeakSet()) {
  if (value == null || typeof value !== "object") return value;
  if (seen.has(value)) return undefined;
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item, seen)).filter((item) => item !== undefined);
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (isSecretKey(key)) continue;
    const redacted = redactSecrets(item, seen);
    if (redacted !== undefined) out[key] = redacted;
  }
  return out;
}

function roomKey(roomId) {
  return `battle:${normalizeRoomId(roomId)}`;
}

function hasPlayer(room, side) {
  return Boolean(room?.players?.[normalizeSide(side)]?.playerId);
}

function hasBothPlayers(room) {
  return hasPlayer(room, "left") && hasPlayer(room, "right");
}

function hasBothLockedCharacters(room) {
  return hasBothPlayers(room) && Boolean(room.players.left.characterId) && Boolean(room.players.right.characterId) &&
    Boolean(room.players.left.characterLocked) && Boolean(room.players.right.characterLocked);
}

function hasBothLockedActions(room) {
  return Boolean(room?.turnState?.locks?.left && room?.turnState?.locks?.right);
}

function normalizeActions(actions = []) {
  return (Array.isArray(actions) ? actions : []).slice(0, 8).map((action, index) => ({
    actionId: String(action?.actionId || action?.id || `action_${index + 1}`).slice(0, 120),
    displayName: String(action?.displayName || action?.label || action?.name || `手札 ${index + 1}`).slice(0, 80),
    cardType: String(action?.cardType || action?.type || "").slice(0, 40),
    apCost: Number(action?.apCost || 0),
    ceCost: Number(action?.ceCost || action?.baseCeCost || 0),
    action: redactSecrets(action?.action || action?.actionSnapshot || null),
    source: "player_locked_action"
  }));
}

function createPassTurnAction() {
  return {
    actionId: PASS_TURN_ACTION_ID,
    displayName: "本回合待机",
    cardType: "pass",
    apCost: 0,
    ceCost: 0,
    selectedRound: 0,
    action: {
      id: PASS_TURN_ACTION_ID,
      label: "本回合待机",
      name: "本回合待机",
      type: "pass",
      cardType: "pass",
      risk: "low",
      costCe: 0,
      ceCost: 0,
      baseCeCost: 0,
      apCost: 0,
      effects: {},
      description: "无法或不选择手札时，保守待机并推进联机回合。"
    },
    source: "player_pass_turn"
  };
}

function normalizeActionsOrPass(actions = []) {
  const normalized = normalizeActions(actions);
  return normalized.length ? normalized : [createPassTurnAction()];
}

function appendLog(room, type, message, patch = {}) {
  room.logs = (Array.isArray(room.logs) ? room.logs : []).concat({ at: nowMs(), type, message, ...patch }).slice(-MAX_LOGS);
}

function actionNames(actions = []) {
  return (Array.isArray(actions) ? actions : [])
    .map((action) => String(action?.displayName || action?.actionId || "").trim())
    .filter(Boolean)
    .slice(0, 4)
    .join("、") || "未记录行动";
}

function buildLocalTurnFallback(room, reason = "") {
  const leftActions = room.turnState?.actions?.left || [];
  const rightActions = room.turnState?.actions?.right || [];
  const leftText = actionNames(leftActions);
  const rightText = actionNames(rightActions);
  const reasonText = reason ? `原因：${String(reason).slice(0, 120)}。` : "";
  return {
    source: "local_fallback",
    summary: `第 ${room.round} 回合 AI 未能完成结算，已按本地模式保留双方锁定行动并生成占位结算。左方：${leftText}；右方：${rightText}。${reasonText}`,
    leftEffect: `本地记录左方行动：${leftText}`,
    rightEffect: `本地记录右方行动：${rightText}`,
    winnerHint: "undecided",
    actions: redactSecrets(room.turnState.actions)
  };
}

function createBattleSeedState(room) {
  return {
    schema: "jjk-online-battle-state-v1",
    battleId: `online_${room.roomId}_${nowMs().toString(36)}`,
    battleSeed: `online-${room.roomId}-${nowMs().toString(36)}`,
    round: room.round,
    players: {
      left: { characterId: room.players.left.characterId, characterSnapshot: room.players.left.characterSnapshot },
      right: { characterId: room.players.right.characterId, characterSnapshot: room.players.right.characterSnapshot }
    }
  };
}

function createFreshTurnState(round = 1) {
  return { turnId: `turn_${Math.max(1, Number(round) || 1)}`, phase: "selecting", actions: { left: [], right: [] }, locks: { left: false, right: false }, result: null, aiStatus: "" };
}

function createFreshReviewState() {
  return { winnerSide: "", summary: "", rematchVotes: {}, resetVotes: {} };
}

function clearPlayerBattleSelection(player) {
  if (!player) return;
  player.characterId = "";
  player.characterSnapshot = null;
  player.characterLocked = false;
  player.actionLocked = false;
}

function resetRoomToPreparingForNewGame(room) {
  room.round = 1;
  room.phase = "preparing";
  room.battleState = null;
  room.turnState = createFreshTurnState(1);
  room.reviewState = createFreshReviewState();
  room.readyState = { leftCharacterLocked: false, rightCharacterLocked: false };
  clearPlayerBattleSelection(room.players?.left);
  clearPlayerBattleSelection(room.players?.right);
  return room;
}

function normalizeRoom(room) {
  if (!room || typeof room !== "object") return null;
  const normalized = {
    protocol: PROTOCOL,
    roomId: normalizeRoomId(room.roomId || room.roomCode),
    roomCode: normalizeRoomId(room.roomCode || room.roomId),
    phase: normalizePhase(room.phase),
    createdAt: Number(room.createdAt) || nowMs(),
    updatedAt: Number(room.updatedAt) || nowMs(),
    revision: Math.max(1, Number(room.revision) || 1),
    ownerPlayerId: String(room.ownerPlayerId || room.players?.left?.playerId || "").slice(0, 120),
    round: Math.max(1, Number(room.round) || 1),
    players: {
      left: { ...emptyPlayer("left"), ...(room.players?.left || {}), side: "left", role: "owner" },
      right: { ...emptyPlayer("right"), ...(room.players?.right || {}), side: "right", role: "guest" }
    },
    readyState: {
      leftCharacterLocked: Boolean(room.readyState?.leftCharacterLocked || room.players?.left?.characterLocked),
      rightCharacterLocked: Boolean(room.readyState?.rightCharacterLocked || room.players?.right?.characterLocked)
    },
    battleState: room.battleState || null,
    turnState: {
      turnId: String(room.turnState?.turnId || `turn_${Math.max(1, Number(room.round) || 1)}`),
      phase: String(room.turnState?.phase || "selecting"),
      actions: {
        left: normalizeActions(room.turnState?.actions?.left),
        right: normalizeActions(room.turnState?.actions?.right)
      },
      locks: {
        left: Boolean(room.turnState?.locks?.left),
        right: Boolean(room.turnState?.locks?.right)
      },
      result: room.turnState?.result || null,
      aiStatus: String(room.turnState?.aiStatus || "")
    },
    reviewState: {
      winnerSide: String(room.reviewState?.winnerSide || ""),
      summary: String(room.reviewState?.summary || ""),
      rematchVotes: room.reviewState?.rematchVotes || {},
      resetVotes: room.reviewState?.resetVotes || {},
      lastAiDebug: redactSecrets(room.reviewState?.lastAiDebug || null),
      lastResolvedTurn: redactSecrets(room.reviewState?.lastResolvedTurn || null)
    },
    logs: Array.isArray(room.logs) ? room.logs.slice(-MAX_LOGS) : []
  };
  normalized.players.left.characterLocked = normalized.readyState.leftCharacterLocked;
  normalized.players.right.characterLocked = normalized.readyState.rightCharacterLocked;
  normalized.players.left.actionLocked = normalized.turnState.locks.left;
  normalized.players.right.actionLocked = normalized.turnState.locks.right;
  if (!normalized.roomCode) normalized.roomCode = normalized.roomId;
  return normalized;
}

function getPlayerSide(room, playerId) {
  if (!room || !playerId) return "";
  if (room.players.left.playerId === playerId) return "left";
  if (room.players.right.playerId === playerId) return "right";
  return "";
}

function authorize(room, playerId, side) {
  const actual = getPlayerSide(room, playerId) || normalizeSide(side);
  if (!room.players[actual]?.playerId || room.players[actual].playerId !== playerId) {
    throw Object.assign(new Error("当前玩家不在房间内。"), { status: 403 });
  }
  return actual;
}

function applyPhaseTransition(room) {
  if (!room || room.phase === "ended" || room.phase === "reviewing" || room.phase === "turn_resolving") return room;
  if (!hasBothLockedCharacters(room)) {
    room.phase = "preparing";
    return room;
  }
  if (room.phase === "preparing" || room.phase === "battle_starting") {
    room.phase = "turn_selecting";
    room.battleState ||= createBattleSeedState(room);
    if (!room.logs.some((entry) => entry.type === "battle_started")) appendLog(room, "battle_started", "双方角色已锁定，进入对战阶段。");
  }
  if (hasBothLockedActions(room)) room.phase = "turn_resolving";
  return room;
}

async function readRoom(env, roomId) {
  const key = roomKey(roomId);
  let room = null;
  if (env.JJK_ONLINE_ROOMS) {
    const raw = await env.JJK_ONLINE_ROOMS.get(key);
    room = raw ? JSON.parse(raw) : null;
  } else {
    room = memoryRooms.get(key) || null;
  }
  return room ? normalizeRoom(room) : null;
}

async function appendAiAuditLog(env, entry) {
  if (!env.JJK_ONLINE_ROOMS) return;
  const key = `ai_audit:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
  await env.JJK_ONLINE_ROOMS.put(key, JSON.stringify(entry), { expirationTtl: 60 * 60 * 24 * 30 });
}

async function enforceAiAssistRateLimit(env, ip, isAdmin, henanExempt) {
  if (isAdmin) return { limited: false, remaining: "admin" };
  if (henanExempt) return { limited: false, remaining: "henan_exempt", exemptReason: "henan_ip_policy" };
  const limit = Math.max(1, Number(env.AI_ASSIST_DAILY_LIMIT || 5));
  const now = nowMs();
  const windowMs = 24 * 60 * 60 * 1000;
  const key = `ai_rate:${ip || "unknown"}`;
  const raw = env.JJK_ONLINE_ROOMS ? await env.JJK_ONLINE_ROOMS.get(key) : null;
  const timestamps = raw ? JSON.parse(raw).filter((time) => now - Number(time || 0) < windowMs) : [];
  if (timestamps.length >= limit) {
    if (env.JJK_ONLINE_ROOMS) await env.JJK_ONLINE_ROOMS.put(key, JSON.stringify(timestamps), { expirationTtl: 60 * 60 * 25 });
    return { limited: true, remaining: 0, resetAt: new Date(Math.min(...timestamps) + windowMs).toISOString() };
  }
  timestamps.push(now);
  if (env.JJK_ONLINE_ROOMS) await env.JJK_ONLINE_ROOMS.put(key, JSON.stringify(timestamps), { expirationTtl: 60 * 60 * 25 });
  return { limited: false, remaining: Math.max(0, limit - timestamps.length) };
}

function mergePreservedRoomState(base, current, options = {}) {
  if (!current) return base;
  if (options.preservePlayers) {
    for (const side of ["left", "right"]) {
      if (!base.players[side]?.playerId && current.players[side]?.playerId) {
        base.players[side] = { ...current.players[side] };
      }
    }
  }
  if (options.preserveCharacterLocks) {
    for (const side of ["left", "right"]) {
      if (current.players[side]?.characterLocked || current.readyState?.[`${side}CharacterLocked`]) {
        base.players[side].characterLocked = true;
        base.readyState[`${side}CharacterLocked`] = true;
      }
    }
    applyPhaseTransition(base);
  }
  if (options.preserveTurnLocks) {
    for (const side of ["left", "right"]) {
      if (current.turnState?.locks?.[side] && !base.turnState?.locks?.[side]) {
        base.turnState.actions[side] = current.turnState.actions?.[side] || [];
        base.turnState.locks[side] = true;
        base.players[side].actionLocked = true;
      }
    }
    applyPhaseTransition(base);
  }
  return base;
}

async function writeRoom(env, room, options = {}) {
  const safe = redactSecrets(normalizeRoom(room));
  if (options.preservePlayers || options.preserveCharacterLocks || options.preserveTurnLocks) {
    mergePreservedRoomState(safe, await readRoom(env, safe.roomId), options);
  }
  safe.revision += 1;
  safe.updatedAt = nowMs();
  const payload = JSON.stringify(safe);
  if (env.JJK_ONLINE_ROOMS) await env.JJK_ONLINE_ROOMS.put(roomKey(safe.roomId), payload, { expirationTtl: ROOM_TTL_SECONDS });
  memoryRooms.set(roomKey(safe.roomId), safe);
  return safe;
}

function snapshot(room, viewerSide = "") {
  const copy = redactSecrets(normalizeRoom(room));
  copy.viewerSide = viewerSide || "";
  if (copy.phase === "turn_selecting" && viewerSide && !hasBothLockedActions(copy)) {
    copy.turnState.actions[otherSide(viewerSide)] = [];
  }
  return copy;
}

function buildAiPrompt(room) {
  const left = room.players.left;
  const right = room.players.right;
  return [
    { role: "system", content: "你是咒术对战联机服务器的回合裁判。只基于提供的角色快照和双方锁定手札输出简短结算，不要要求额外信息，不要改写房间协议。必须返回 JSON object。" },
    {
      role: "user",
      content: JSON.stringify({
        task: "resolve_online_turn",
        round: room.round,
        left: {
          character: left.characterSnapshot || { characterId: left.characterId },
          actions: room.turnState.actions.left
        },
        right: {
          character: right.characterSnapshot || { characterId: right.characterId },
          actions: room.turnState.actions.right
        },
        outputFormat: {
          summary: "中文，120字以内",
          leftEffect: "中文短句",
          rightEffect: "中文短句",
          winnerHint: "left/right/draw/undecided"
        }
      })
    }
  ];
}

function compactAiMessages(messages = []) {
  return (Array.isArray(messages) ? messages : []).map((message) => ({
    role: String(message?.role || ""),
    content: String(message?.content || "").slice(0, 3000)
  }));
}

function parseAiText(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return {
      summary: String(parsed.summary || text).slice(0, 600),
      leftEffect: String(parsed.leftEffect || "").slice(0, 240),
      rightEffect: String(parsed.rightEffect || "").slice(0, 240),
      winnerHint: ["left", "right", "draw", "undecided"].includes(parsed.winnerHint) ? parsed.winnerHint : "undecided"
    };
  } catch {
    return { summary: text.slice(0, 600), leftEffect: "", rightEffect: "", winnerHint: "undecided" };
  }
}

function normalizeServerAiEndpoint(value) {
  const text = String(value || "").trim().replace(/\/+$/, "");
  if (!text) return "";
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function getServerAiChatCompletionsUrl(env) {
  const explicit = normalizeServerAiEndpoint(env.AI_CHAT_COMPLETIONS_URL || env.AI_API_URL || "");
  if (explicit) return explicit;
  const base = normalizeServerAiEndpoint(env.AI_BASE_URL || "").replace(/\/responses$/i, "");
  if (!base) return DEFAULT_ARK_CHAT_COMPLETIONS_URL;
  if (/\/chat\/completions$/i.test(base)) return base;
  return `${base}/chat/completions`;
}

function extractAiResponseText(data) {
  if (!data) return "";
  if (typeof data === "string") return data;
  if (typeof data.text === "string") return data.text;
  if (typeof data.markdown === "string") return data.markdown;
  if (typeof data.output_text === "string") return data.output_text;
  if (Array.isArray(data.choices)) {
    return data.choices.map((choice) => choice?.message?.content || choice?.text || "").join("");
  }
  if (Array.isArray(data.output)) {
    return data.output.map((item) => {
      if (typeof item?.content === "string") return item.content;
      if (Array.isArray(item?.content)) {
        return item.content.map((content) => content?.text || content?.content || content?.value || "").join("");
      }
      return "";
    }).join("");
  }
  return "";
}

function normalizeResponsesInput(input) {
  const list = Array.isArray(input) ? input : [{ role: "user", content: input || "" }];
  return list.map((message) => {
    const next = { ...(message || {}) };
    const role = next.role === "system" || next.role === "developer" || next.role === "assistant" ? next.role : "user";
    const content = next.content && typeof next.content === "object" ? JSON.stringify(next.content) : String(next.content || "");
    return { role, content };
  }).filter((message) => message.content);
}

function buildServerChatCompletionsPayload(env, payload = {}) {
  const maxOutputTokens = Math.max(64, Math.min(4000, Number(payload.max_tokens || payload.max_output_tokens || env.AI_MAX_TOKENS || 700)));
  const temperature = Number.isFinite(Number(payload.temperature ?? env.AI_TEMPERATURE))
    ? Math.max(0, Math.min(2, Number(payload.temperature ?? env.AI_TEMPERATURE)))
    : 0.4;
  const input = normalizeResponsesInput(payload.input || payload.messages || payload.prompt || "");
  return {
    model: String(env.AI_MODEL || payload.model || DEFAULT_ARK_MODEL).trim(),
    messages: input.length ? input : [{ role: "user", content: String(payload.text || "你好") }],
    max_tokens: maxOutputTokens,
    temperature
  };
}

async function handleAiProxy(env, body = {}, request = null, rawBody = "") {
  const ip = request ? getClientIpFromRequest(request) : "unknown";
  const origin = request ? requestOrigin(request) : "";
  const promptTemplateId = String(body.promptTemplateId || body.payload?.metadata?.templateId || "").slice(0, 80);
  const isCharacterAssist = promptTemplateId === "duel_character_assist";
  const uploadedText = extractUploadedText(body);
  const uploadedTextBytes = utf8Bytes(uploadedText);
  const accessClass = request ? getHenanAccessClassification(request, env, ip) : { henanIp: false, exemptionEnabled: true };
  const henanExempt = Boolean(accessClass.henanIp && accessClass.exemptionEnabled);
  const admin = isAdminRequest(env, body);
  const promptPayloadText = JSON.stringify(body.payload || {});
  let aiAssistRateLimit = null;
  const strictAudit = {
    strictAudit: Boolean(accessClass?.henanIp),
    accessClass,
    network: request ? {
      host: getRequestHeader(request, "host"),
      origin: getRequestHeader(request, "origin"),
      referer: getRequestHeader(request, "referer"),
      userAgent: getRequestHeader(request, "user-agent"),
      cfConnectingIp: getRequestHeader(request, "cf-connecting-ip"),
      forwardedFor: getRequestHeader(request, "x-forwarded-for")
    } : {},
    requestMeta: {
      method: request?.method || "POST",
      url: request?.url || "",
      rawBodyBytes: utf8Bytes(rawBody),
      rawBodySha256: await sha256(rawBody),
      promptPayloadBytes: utf8Bytes(promptPayloadText),
      promptPayloadSha256: await sha256(promptPayloadText),
      uploadedTextBytes,
      uploadedTextSha256: await sha256(uploadedText)
    }
  };
  if (request && !admin && !isAiOriginAllowed(request, env)) {
    await appendAiAuditLog(env, { time: new Date().toISOString(), ip, origin, promptTemplateId, ...strictAudit, rejected: true, reason: "origin_not_allowed", request: redactAdminAuth(body) });
    return json({ ok: false, error: "AI 生成必须从 Cloudflare Pages 正式来源发起，当前来源未被允许。" }, 403);
  }
  if (isCharacterAssist && uploadedTextBytes > Math.max(1, Number(env.AI_ASSIST_MAX_TEXT_BYTES || 1000)) && !admin && !henanExempt) {
    await appendAiAuditLog(env, { time: new Date().toISOString(), ip, origin, promptTemplateId, ...strictAudit, rejected: true, reason: "uploaded_text_too_large", uploadedTextBytes, request: redactAdminAuth(body) });
    return json({ ok: false, error: `AI辅助角色生成输入不能超过 ${env.AI_ASSIST_MAX_TEXT_BYTES || 1000} 字节。` }, 413);
  }
  if (isCharacterAssist) {
    const rate = await enforceAiAssistRateLimit(env, ip, admin, henanExempt);
    aiAssistRateLimit = rate;
    if (rate.limited) {
      await appendAiAuditLog(env, { time: new Date().toISOString(), ip, origin, promptTemplateId, ...strictAudit, rejected: true, reason: "ip_daily_limit", uploadedTextBytes, request: redactAdminAuth(body), rateLimit: rate });
      return json({ ok: false, error: "该 IP 24 小时内 AI辅助角色生成次数已达上限。", rateLimit: rate }, 429);
    }
  }
  const apiKey = String(env.AI_API_KEY || "").trim();
  const chatCompletionsUrl = getServerAiChatCompletionsUrl(env);
  const timeoutMs = clampNumber(env.AI_TIMEOUT_MS, DEFAULT_AI_TIMEOUT_MS, 3000, MAX_AI_TIMEOUT_MS);
  const safeBody = stripAdminAuth(body);
  const payload = buildServerChatCompletionsPayload(env, safeBody.payload || {});
  const startedAt = nowMs();

  if (!apiKey) return json({ ok: false, error: "服务器未配置 AI_API_KEY。" }, 503);
  if (!chatCompletionsUrl) return json({ ok: false, error: "服务器 AI Chat Completions URL 无效。" }, 500);
  const response = await withTimeout(fetch(chatCompletionsUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  }), timeoutMs, `AI 请求超时（${Math.round(timeoutMs / 1000)} 秒）`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || data?.error || `AI HTTP ${response.status}`;
    const errorResponse = { ok: false, error: String(message), status: response.status };
    await appendAiAuditLog(env, { time: new Date().toISOString(), ip, origin, promptTemplateId, ...strictAudit, admin: admin ? "yes" : "no", henanExempt: henanExempt ? "yes" : "no", limitPolicy: henanExempt ? "henan_ip_unlimited_strict_audit" : (admin ? "admin_unlimited" : "standard_ip_24h_limit"), providerId: String(body.providerId || ""), endpointType: String(body.endpointType || ""), siteVersion: String(body.siteVersion || ""), uploadedText, uploadedTextBytes, promptPayload: body.payload || null, usage: null, responseStatus: response.status, responseOk: false, error: String(message), request: redactAdminAuth(body) });
    return json(errorResponse, response.status);
  }
  const text = extractAiResponseText(data);
  const responsePayload = {
    ok: true,
    provider: env.AI_PROVIDER || "ark_ai",
    endpointType: "chat_completions",
    model: payload.model,
    text,
    markdown: text,
    usage: data.usage || null,
    rateLimit: aiAssistRateLimit,
    durationMs: nowMs() - startedAt,
    promptTemplateId,
    siteVersion: String(body.siteVersion || "").slice(0, 80)
  };
  await appendAiAuditLog(env, { time: new Date().toISOString(), ip, origin, promptTemplateId, ...strictAudit, admin: admin ? "yes" : "no", henanExempt: henanExempt ? "yes" : "no", limitPolicy: henanExempt ? "henan_ip_unlimited_strict_audit" : (admin ? "admin_unlimited" : "standard_ip_24h_limit"), providerId: String(body.providerId || ""), endpointType: String(body.endpointType || ""), siteVersion: String(body.siteVersion || ""), uploadedText, uploadedTextBytes, promptPayload: body.payload || null, usage: data.usage || null, responseStatus: 200, responseOk: true, error: "", request: redactAdminAuth(body) });
  return json(responsePayload);
}

async function resolveTurnWithAi(env, room) {
  const model = env.AI_MODEL || DEFAULT_ARK_MODEL;
  const chatCompletionsUrl = getServerAiChatCompletionsUrl(env);
  const timeoutMs = clampNumber(env.AI_TIMEOUT_MS, DEFAULT_AI_TIMEOUT_MS, 3000, MAX_AI_TIMEOUT_MS);
  const apiKey = String(env.AI_API_KEY || "").trim();
  const aiMessages = buildAiPrompt(room);
  const aiRequestPreview = {
    provider: env.AI_PROVIDER || "ark_ai",
    model,
    chatCompletionsUrl,
    timeoutMs,
    temperature: Number(env.AI_TEMPERATURE || 0.4),
    maxTokens: Math.max(64, Math.min(1200, Number(env.AI_MAX_TOKENS || 700))),
    messages: compactAiMessages(redactSecrets(aiMessages))
  };
  if (!apiKey) {
    return {
      source: "local_fallback",
      summary: `第 ${room.round} 回合已接收双方锁定行动；服务器未配置 AI_API_KEY，已使用占位结算。`,
      aiRequestPreview,
      actions: redactSecrets(room.turnState.actions)
    };
  }
  const payload = buildServerChatCompletionsPayload(env, {
    model,
    input: aiMessages,
    max_tokens: aiRequestPreview.maxTokens,
    temperature: aiRequestPreview.temperature
  });
  const startedAt = nowMs();
  const response = await withTimeout(fetch(chatCompletionsUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  }), timeoutMs, `AI 请求超时（${Math.round(timeoutMs / 1000)} 秒）`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || data?.error || `AI HTTP ${response.status}`);
  const text = extractAiResponseText(data);
  const parsed = parseAiText(text) || { summary: `第 ${room.round} 回合 AI 已返回，但内容为空。`, winnerHint: "undecided" };
  return {
    source: "server_ai",
    provider: env.AI_PROVIDER || "ark_ai",
    model,
    summary: parsed.summary,
    leftEffect: parsed.leftEffect,
    rightEffect: parsed.rightEffect,
    winnerHint: parsed.winnerHint,
    aiRequestPreview,
    responseTextPreview: String(text || "").slice(0, 1200),
    durationMs: nowMs() - startedAt,
    timeoutMs,
    usage: data.usage || null,
    actions: redactSecrets(room.turnState.actions)
  };
}

async function resolveTurnIfReady(env, room, viewerSide = "left") {
  if (!hasBothLockedActions(room)) return room;
  room.phase = "turn_resolving";
  room.turnState.aiStatus = "rules_engine_delay";
  const beforeRound = room.round;
  const lockedActions = redactSecrets({
    left: normalizeActions(room.turnState.actions.left),
    right: normalizeActions(room.turnState.actions.right)
  });
  const result = {
    source: "rules_engine",
    summary: `第 ${beforeRound} 回合双方行动已锁定，按本地规则引擎结算。`,
    leftEffect: "左方行动已进入本地规则结算。",
    rightEffect: "右方行动已进入本地规则结算。",
    winnerHint: "undecided",
    actions: lockedActions
  };
  room.turnState.result = result;
  room.turnState.aiStatus = result.source;
  room.reviewState.summary = result.summary;
  room.reviewState.lastAiDebug = {
    source: "disabled",
    reason: "online_turn_ai_judge_disabled",
    delayMs: 1000
  };
  room.reviewState.lastResolvedTurn = {
    turn: beforeRound,
    source: result.source,
    actions: lockedActions,
    result: redactSecrets(result)
  };
  appendLog(room, "turn_resolved", result.summary, { turn: beforeRound, source: result.source });
  await sleep(1000);
  room.round += 1;
  room.turnState = { turnId: `turn_${room.round}`, phase: "selecting", actions: { left: [], right: [] }, locks: { left: false, right: false }, result: null, aiStatus: "" };
  room.players.left.actionLocked = false;
  room.players.right.actionLocked = false;
  room.phase = "turn_selecting";
  return room;
}

async function handleOperation(env, body) {
  const requestId = requestIdFrom(body);
  if (body.protocol !== PROTOCOL) return json({ ok: false, error: "协议不匹配。", requestId }, 400);
  const operation = String(body.operation || "");
  const playerId = String(body.playerId || "").slice(0, 120);
  const payload = redactSecrets(body.payload || {});
  const roomId = normalizeRoomId(body.roomId || payload.room?.roomId);
  const requestedSide = body.side ? normalizeSide(body.side) : "";

  if (operation === "ping") return json({
    ok: true,
    protocol: PROTOCOL,
    workerBuildVersion: WORKER_BUILD_VERSION,
    requestId,
    message: "online battle endpoint ready",
    aiConfigured: Boolean(String(env.AI_API_KEY || "").trim()),
    aiProvider: env.AI_PROVIDER || "ark_ai",
    aiBaseURL: getServerAiChatCompletionsUrl(env),
    aiModel: env.AI_MODEL || DEFAULT_ARK_MODEL,
    aiTimeoutMs: clampNumber(env.AI_TIMEOUT_MS, DEFAULT_AI_TIMEOUT_MS, 3000, MAX_AI_TIMEOUT_MS),
    hasRoomKv: Boolean(env.JJK_ONLINE_ROOMS),
    serverTime: new Date().toISOString()
  });

  if (operation === "createRoom") {
    const room = normalizeRoom(payload.room || {});
    if (!room?.roomId) return json({ ok: false, error: "房间码无效。", requestId }, 400);
    if (await readRoom(env, room.roomId)) return json({ ok: false, error: "房间已存在。", requestId }, 409);
    room.ownerPlayerId = room.ownerPlayerId || room.players.left.playerId || playerId;
    room.players.left.playerId = room.players.left.playerId || playerId;
    room.players.left.connected = true;
    room.players.left.lastSeenAt = nowMs();
    appendLog(room, "room_created", "房间已创建。", { side: "left", playerId: room.players.left.playerId });
    const saved = await writeRoom(env, room);
    return json({ ok: true, requestId, debug: roomDebug(saved, { operation, side: "left" }), room: snapshot(saved, "left"), side: "left" });
  }

  const room = await readRoom(env, roomId);
  if (!room) return json({ ok: false, error: "房间不存在。", requestId, debug: { operation, roomId, requestedSide } }, 404);

  if (operation === "getRoom") {
    const side = getPlayerSide(room, playerId) || requestedSide;
    if (side && room.players[side]?.playerId === playerId) {
      return json({ ok: true, room: snapshot(room, side), side });
    }
    return json({ ok: true, room: snapshot(room, ""), side: "" });
  }

  if (operation === "joinRoom") {
    const existing = getPlayerSide(room, playerId);
    if (existing) {
      room.players[existing].connected = true;
      room.players[existing].lastSeenAt = nowMs();
      appendLog(room, "player_reconnected", `${existing === "left" ? "左方" : "右方"}玩家已重新连接。`, { side: existing, playerId });
      const saved = await writeRoom(env, room);
      return json({ ok: true, room: snapshot(saved, existing), side: existing });
    }
    if (room.players.right.playerId) return json({ ok: false, error: "房间已满。" }, 409);
    room.players.right = { ...emptyPlayer("right"), ...(payload.player || {}), side: "right", role: "guest", playerId, connected: true, lastSeenAt: nowMs() };
    room.phase = "preparing";
    appendLog(room, "player_joined", "右方玩家已加入房间。", { side: "right", playerId });
    const saved = await writeRoom(env, room);
    return json({ ok: true, room: snapshot(saved, "right"), side: "right" });
  }

  let side;
  try {
    side = authorize(room, playerId, requestedSide);
  } catch (error) {
    return json({ ok: false, error: error.message, requestId, debug: roomDebug(room, { operation, requestedSide }) }, error.status || 403);
  }

  if (operation === "selectCharacter") {
    if (room.phase !== "preparing") return json({ ok: false, error: "只有准备阶段可以更换角色。" }, 409);
    room.players[side].characterId = String(payload.characterId || "").slice(0, 120);
    room.players[side].characterSnapshot = redactSecrets(payload.characterSnapshot || null);
    room.players[side].characterLocked = false;
    room.readyState[`${side}CharacterLocked`] = false;
    appendLog(room, "character_selected", `${side === "left" ? "左方" : "右方"}已选择角色。`, { side });
    const saved = await writeRoom(env, room);
    return json({ ok: true, room: snapshot(saved, side), side });
  }

  if (operation === "lockCharacter") {
    if (room.phase !== "preparing") return json({ ok: false, error: "当前不是准备阶段。" }, 409);
    if (!room.players[side].characterId) return json({ ok: false, error: "请先选择角色。" }, 409);
    room.players[side].characterLocked = true;
    room.readyState[`${side}CharacterLocked`] = true;
    appendLog(room, "character_locked", `${side === "left" ? "左方" : "右方"}已锁定角色。`, { side });
    applyPhaseTransition(room);
    const saved = await writeRoom(env, room, { preservePlayers: true, preserveCharacterLocks: true });
    return json({ ok: true, room: snapshot(saved, side), side });
  }

  if (operation === "unlockCharacter") {
    if (room.phase !== "preparing") return json({ ok: false, error: "进入对战后不能取消角色锁定。" }, 409);
    room.players[side].characterLocked = false;
    room.readyState[`${side}CharacterLocked`] = false;
    const saved = await writeRoom(env, room);
    return json({ ok: true, room: snapshot(saved, side), side });
  }

  if (operation === "lockTurn") {
    const debugBefore = roomDebug(room, { operation, side, requestId });
    if (room.phase !== "turn_selecting") return json({ ok: false, error: "当前不能锁定行动。", requestId, debug: debugBefore }, 409);
    const actions = normalizeActionsOrPass(payload.actions);
    room.turnState.actions[side] = actions;
    room.turnState.locks[side] = true;
    room.players[side].actionLocked = true;
    appendLog(room, "turn_locked", `${side === "left" ? "左方" : "右方"}已锁定第 ${room.round} 回合行动。`, { side, turn: room.round });
    applyPhaseTransition(room);
    let saved = await writeRoom(env, room, { preservePlayers: true, preserveTurnLocks: true });
    const shouldResolve = hasBothLockedActions(saved);
    if (hasBothLockedActions(saved)) {
      await resolveTurnIfReady(env, saved, side);
      saved = await writeRoom(env, saved, { preservePlayers: true });
    }
    return json({
      ok: true,
      requestId,
      debug: roomDebug(saved, {
        operation,
        side,
        accepted: true,
        lockedSide: side,
        actionsCount: actions.length,
        bothLocked: shouldResolve,
        triggeredResolve: shouldResolve,
        aiStatus: saved.turnState?.aiStatus || "",
        aiError: saved.reviewState?.lastAiDebug?.error || "",
        phaseBefore: debugBefore.phase,
        roundBefore: debugBefore.round,
        roundAfter: saved.round,
        nextTurnId: saved.turnState?.turnId || ""
      }),
      room: snapshot(saved, side),
      side
    });
  }

  if (operation === "unlockTurn") {
    if (room.phase !== "turn_selecting") return json({ ok: false, error: "当前不能取消行动锁定。" }, 409);
    room.turnState.locks[side] = false;
    room.turnState.actions[side] = [];
    room.players[side].actionLocked = false;
    const saved = await writeRoom(env, room);
    return json({ ok: true, room: snapshot(saved, side), side });
  }

  if (operation === "resolveTurnIfReady") {
    await resolveTurnIfReady(env, room, side);
    const saved = await writeRoom(env, room);
    return json({ ok: true, room: snapshot(saved, side), side });
  }

  if (operation === "rematch") {
    if (!["reviewing", "turn_selecting"].includes(room.phase)) return json({ ok: false, error: "当前不能再来一把。" }, 409);
    resetRoomToPreparingForNewGame(room);
    appendLog(room, "rematch", "已清空上一局状态，回到准备阶段，请双方重新选人。", { side });
    const saved = await writeRoom(env, room);
    return json({ ok: true, room: snapshot(saved, side), side });
  }

  if (operation === "resetToPreparing") {
    if (side !== "left" && room.ownerPlayerId !== playerId) return json({ ok: false, error: "只有房主可以回到准备阶段。" }, 403);
    resetRoomToPreparingForNewGame(room);
    appendLog(room, "reset_prepare", "房主已清空上一局状态，回到准备阶段，请双方重新选人。");
    const saved = await writeRoom(env, room);
    return json({ ok: true, room: snapshot(saved, side), side });
  }

  if (operation === "kickPlayer") {
    if (side !== "left" && room.ownerPlayerId !== playerId) return json({ ok: false, error: "只有房主可以踢出玩家。" }, 403);
    if (!["preparing", "reviewing"].includes(room.phase)) return json({ ok: false, error: "只有准备阶段或复盘阶段可以踢出玩家。" }, 409);
    const target = normalizeSide(payload.targetSide || "right");
    if (target === "left") return json({ ok: false, error: "不能踢出房主。" }, 409);
    const targetPlayerId = room.players[target]?.playerId || "";
    if (!targetPlayerId) return json({ ok: false, error: "该位置当前没有可踢出的玩家。" }, 409);
    room.players[target] = emptyPlayer(target);
    room.readyState.rightCharacterLocked = false;
    room.turnState.actions.right = [];
    room.turnState.locks.right = false;
    appendLog(room, "player_kicked", "房主已踢出右方玩家。", { targetSide: target, targetPlayerId });
    const saved = await writeRoom(env, room);
    return json({ ok: true, room: snapshot(saved, side), side });
  }

  if (operation === "leaveRoom") {
    room.players[side].connected = false;
    room.players[side].lastSeenAt = nowMs();
    if (side === "left") {
      room.phase = "ended";
      appendLog(room, "room_ended", "房主已离开，房间结束。");
    } else {
      appendLog(room, "player_left", "右方玩家已离开房间。");
    }
    const saved = await writeRoom(env, room);
    return json({ ok: true, room: snapshot(saved, side), side });
  }

  return json({ ok: false, error: `未知操作：${operation}` }, 400);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return json({ ok: true });
    if (request.method !== "POST") return json({ ok: false, error: "Only POST is supported." }, 405);
    const pathname = new URL(request.url).pathname;
    let body;
    let rawBody = "";
    try {
      rawBody = await request.text();
      body = JSON.parse(rawBody || "{}");
    } catch {
      return json({ ok: false, error: "JSON 请求无效。" }, 400);
    }
    try {
      if (pathname === "/ai") return await handleAiProxy(env, body, request, rawBody);
      if (pathname !== "/online-room" && pathname !== "/") return json({ ok: false, error: "Unknown endpoint." }, 404);
      return await handleOperation(env, body);
    } catch (error) {
      return json({
        ok: false,
        requestId: requestIdFrom(body),
        error: String(error?.message || error || "服务器错误。"),
        debug: redactSecrets({
          operation: body?.operation || "",
          roomId: normalizeRoomId(body?.roomId || ""),
          side: body?.side || "",
          status: Number(error?.status || 500)
        })
      }, Number(error?.status || 500));
    }
  }
};
