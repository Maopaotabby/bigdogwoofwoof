import OpenAI from "openai";

const PROTOCOL = "jjk_online_battle_v1";
const WORKER_BUILD_VERSION = "V3.1.1-full-audit-20260508";
const MAX_LOGS = 120;
const ROOM_TTL_SECONDS = 7200;
const DEFAULT_AI_TIMEOUT_MS = 30000;
const MAX_SPECTATORS = 12;
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

function normalizeRoomId(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

function normalizeSide(value) {
  if (value === "spectator") return "spectator";
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
    allyCharacterId: "",
    allyCharacterSnapshot: null,
    characterLocked: false,
    actionLocked: false
  };
}

function normalizeSpectator(value = {}) {
  return {
    playerId: String(value.playerId || "").slice(0, 120),
    displayName: String(value.displayName || "观战者").slice(0, 40),
    connected: Boolean(value.connected ?? true),
    lastSeenAt: Number(value.lastSeenAt) || nowMs(),
    role: "spectator"
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

function playerHasRequiredCharacters(room, side) {
  const player = room?.players?.[side];
  if (!player?.characterId) return false;
  if (room?.mode === "2v2" && !player.allyCharacterId) return false;
  return true;
}

function hasBothLockedCharacters(room) {
  return hasBothPlayers(room) &&
    playerHasRequiredCharacters(room, "left") &&
    playerHasRequiredCharacters(room, "right") &&
    Boolean(room.players.left.characterLocked) &&
    Boolean(room.players.right.characterLocked);
}

function hasBothLockedActions(room) {
  return Boolean(room?.turnState?.locks?.left && room?.turnState?.locks?.right);
}

function normalizeStringArray(value, limit = 20) {
  return (Array.isArray(value) ? value : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeVisualSettingsSnapshot(value = {}) {
  if (!value || typeof value !== "object") return null;
  const cardSkin = ["classic", "v224", "custom", "champion-kashimo"].includes(value.cardSkin) ? value.cardSkin : "";
  const theme = value.theme === "dark" ? "dark" : value.theme === "original" ? "original" : "";
  const customSkin = value.customSkin && typeof value.customSkin === "object" ? redactSecrets(value.customSkin) : null;
  const compactCards = Boolean(value.compactCards);
  if (!cardSkin && !theme && !customSkin && !compactCards) return null;
  return { cardSkin, theme, compactCards, customSkin };
}

function normalizeActions(actions = []) {
  return (Array.isArray(actions) ? actions : []).slice(0, 8).map((entry, index) => {
    const action = entry?.action || entry?.actionSnapshot || entry || {};
    const visualSettings = normalizeVisualSettingsSnapshot(entry?.visualSettings || action?.visualSettings || {});
    return {
      actionId: String(entry?.actionId || entry?.id || action?.id || action?.sourceActionId || `action_${index + 1}`).slice(0, 120),
      displayName: String(entry?.displayName || entry?.label || action?.label || action?.name || `手札 ${index + 1}`).slice(0, 80),
      cardType: String(entry?.cardType || action?.cardType || action?.type || "").slice(0, 40),
      apCost: Number(entry?.apCost ?? action?.apCost ?? 0),
      ceCost: Number(entry?.ceCost ?? action?.ceCost ?? action?.baseCeCost ?? 0),
      selectedRound: Number(entry?.selectedRound || action?.selectedRound || 0),
      skinCategory: String(entry?.skinCategory || entry?.cardSkinCategory || action?.skinCategory || action?.cardSkinCategory || "").slice(0, 40),
      cardSkinCategory: String(entry?.cardSkinCategory || entry?.skinCategory || action?.cardSkinCategory || action?.skinCategory || "").slice(0, 40),
      cardSkin: String(entry?.cardSkin || entry?.visualCardSkin || action?.cardSkin || action?.visualCardSkin || visualSettings?.cardSkin || "").slice(0, 40),
      visualCardSkin: String(entry?.visualCardSkin || entry?.cardSkin || action?.visualCardSkin || action?.cardSkin || visualSettings?.cardSkin || "").slice(0, 40),
      visualSettings,
      tags: normalizeStringArray(entry?.tags || action?.tags),
      uiTags: normalizeStringArray(entry?.uiTags || action?.uiTags),
      specialHandTags: normalizeStringArray(entry?.specialHandTags || action?.specialHandTags),
      domainHand: Boolean(entry?.domainHand || action?.domainHand),
      domainSpecific: Boolean(entry?.domainSpecific || action?.domainSpecific),
      specialHandCard: Boolean(entry?.specialHandCard || action?.specialHandCard),
      techniqueFeatureHand: Boolean(entry?.techniqueFeatureHand || action?.techniqueFeatureHand),
      action: redactSecrets(action),
      source: "player_locked_action"
    };
  });
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
  const leftTeam = [
    { slot: "main", characterId: room.players.left.characterId, characterSnapshot: room.players.left.characterSnapshot },
    { slot: "ally", characterId: room.players.left.allyCharacterId, characterSnapshot: room.players.left.allyCharacterSnapshot }
  ].filter((entry) => entry.characterId);
  const rightTeam = [
    { slot: "main", characterId: room.players.right.characterId, characterSnapshot: room.players.right.characterSnapshot },
    { slot: "ally", characterId: room.players.right.allyCharacterId, characterSnapshot: room.players.right.allyCharacterSnapshot }
  ].filter((entry) => entry.characterId);
  return {
    schema: "jjk-online-battle-state-v1",
    battleId: `online_${room.roomId}_${nowMs().toString(36)}`,
    battleSeed: `online-${room.roomId}-${nowMs().toString(36)}`,
    round: room.round,
    mode: room.mode || "1v1",
    teamMode: room.teamMode || "1v1",
    players: {
      left: {
        characterId: room.players.left.characterId,
        characterSnapshot: room.players.left.characterSnapshot,
        allyCharacterId: room.players.left.allyCharacterId,
        allyCharacterSnapshot: room.players.left.allyCharacterSnapshot
      },
      right: {
        characterId: room.players.right.characterId,
        characterSnapshot: room.players.right.characterSnapshot,
        allyCharacterId: room.players.right.allyCharacterId,
        allyCharacterSnapshot: room.players.right.allyCharacterSnapshot
      }
    },
    teams: {
      left: leftTeam,
      right: rightTeam
    }
  };
}

function normalizeRoom(room) {
  if (!room || typeof room !== "object") return null;
  const normalized = {
    protocol: PROTOCOL,
    roomId: normalizeRoomId(room.roomId || room.roomCode),
    roomCode: normalizeRoomId(room.roomCode || room.roomId),
    phase: normalizePhase(room.phase),
    mode: room.mode === "2v2" || room.teamMode === "2v2_tag" ? "2v2" : "1v1",
    teamMode: room.mode === "2v2" || room.teamMode === "2v2_tag" ? "2v2_tag" : "1v1",
    createdAt: Number(room.createdAt) || nowMs(),
    updatedAt: Number(room.updatedAt) || nowMs(),
    revision: Math.max(1, Number(room.revision) || 1),
    ownerPlayerId: String(room.ownerPlayerId || room.players?.left?.playerId || "").slice(0, 120),
    round: Math.max(1, Number(room.round) || 1),
    players: {
      left: { ...emptyPlayer("left"), ...(room.players?.left || {}), side: "left", role: "owner" },
      right: { ...emptyPlayer("right"), ...(room.players?.right || {}), side: "right", role: "guest" }
    },
    spectators: Array.isArray(room.spectators) ? room.spectators.slice(0, MAX_SPECTATORS).map(normalizeSpectator).filter((item) => item.playerId) : [],
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
  if (normalized.mode !== "2v2") {
    for (const side of ["left", "right"]) {
      normalized.players[side].allyCharacterId = "";
      normalized.players[side].allyCharacterSnapshot = null;
    }
  }
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
  if ((room.spectators || []).some((spectator) => spectator.playerId === playerId)) return "spectator";
  return "";
}

function authorize(room, playerId, side) {
  const actual = getPlayerSide(room, playerId) || normalizeSide(side);
  if (actual === "spectator") throw Object.assign(new Error("观战者不能执行对战操作。"), { status: 403 });
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

function mergePreservedRoomState(base, current, options = {}) {
  if (!current) return base;
  if (options.preservePlayers) {
    for (const side of ["left", "right"]) {
      if (!base.players[side]?.playerId && current.players[side]?.playerId) {
        base.players[side] = { ...current.players[side] };
      }
    }
    const spectators = new Map();
    for (const spectator of [...(current.spectators || []), ...(base.spectators || [])]) {
      if (spectator?.playerId) spectators.set(spectator.playerId, normalizeSpectator(spectator));
    }
    base.spectators = [...spectators.values()].slice(-MAX_SPECTATORS);
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
  if (viewerSide !== "spectator" && copy.phase === "turn_selecting" && viewerSide && !hasBothLockedActions(copy)) {
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
        mode: room.mode || "1v1",
        teamMode: room.teamMode || "1v1",
        left: {
          character: left.characterSnapshot || { characterId: left.characterId },
          ally: left.allyCharacterSnapshot || (left.allyCharacterId ? { characterId: left.allyCharacterId } : null),
          actions: room.turnState.actions.left
        },
        right: {
          character: right.characterSnapshot || { characterId: right.characterId },
          ally: right.allyCharacterSnapshot || (right.allyCharacterId ? { characterId: right.allyCharacterId } : null),
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

async function resolveTurnWithAi(env, room) {
  const model = env.AI_MODEL || "doubao-seed-2-0-lite-260215";
  const baseURL = env.AI_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3";
  const timeoutMs = clampNumber(env.AI_TIMEOUT_MS, DEFAULT_AI_TIMEOUT_MS, 3000, 45000);
  const apiKey = String(env.AI_API_KEY || "").trim();
  const aiMessages = buildAiPrompt(room);
  const aiRequestPreview = {
    provider: "openai_compatible",
    model,
    baseURL,
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
  const client = new OpenAI({ apiKey, baseURL });
  const startedAt = nowMs();
  const completion = await withTimeout(client.chat.completions.create({
    model,
    messages: aiMessages,
    temperature: aiRequestPreview.temperature,
    max_tokens: aiRequestPreview.maxTokens,
    response_format: { type: "json_object" }
  }), timeoutMs, `AI 请求超时（${Math.round(timeoutMs / 1000)} 秒）`);
  const text = completion.choices?.[0]?.message?.content || "";
  const parsed = parseAiText(text) || { summary: `第 ${room.round} 回合 AI 已返回，但内容为空。`, winnerHint: "undecided" };
  return {
    source: "server_ai",
    provider: "openai_compatible",
    model,
    summary: parsed.summary,
    leftEffect: parsed.leftEffect,
    rightEffect: parsed.rightEffect,
    winnerHint: parsed.winnerHint,
    aiRequestPreview,
    responseTextPreview: String(text || "").slice(0, 1200),
    durationMs: nowMs() - startedAt,
    timeoutMs,
    usage: completion.usage || null,
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
    aiProvider: env.AI_PROVIDER || "openai_compatible",
    aiBaseURL: env.AI_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3",
    aiModel: env.AI_MODEL || "doubao-seed-2-0-lite-260215",
    aiTimeoutMs: clampNumber(env.AI_TIMEOUT_MS, DEFAULT_AI_TIMEOUT_MS, 3000, 45000),
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
    if (side === "spectator") {
      return json({ ok: true, room: snapshot(room, "spectator"), side: "spectator", viewerSide: "spectator" });
    }
    if (side && room.players[side]?.playerId === playerId) {
      return json({ ok: true, room: snapshot(room, side), side });
    }
    return json({ ok: true, room: snapshot(room, ""), side: "" });
  }

  if (operation === "joinRoom") {
    const existing = getPlayerSide(room, playerId);
    if (existing) {
      if (existing === "spectator") {
        room.spectators = (room.spectators || []).filter((spectator) => spectator.playerId !== playerId);
      } else {
        room.players[existing].connected = true;
        room.players[existing].lastSeenAt = nowMs();
        appendLog(room, "player_reconnected", `${existing === "left" ? "左方" : "右方"}玩家已重新连接。`, { side: existing, playerId });
        const saved = await writeRoom(env, room);
        return json({ ok: true, room: snapshot(saved, existing), side: existing });
      }
    }
    if (room.players.right.playerId) return json({ ok: false, error: "房间已满。" }, 409);
    room.players.right = { ...emptyPlayer("right"), ...(payload.player || {}), side: "right", role: "guest", playerId, connected: true, lastSeenAt: nowMs() };
    room.phase = "preparing";
    appendLog(room, "player_joined", "右方玩家已加入房间。", { side: "right", playerId });
    const saved = await writeRoom(env, room);
    return json({ ok: true, room: snapshot(saved, "right"), side: "right" });
  }

  if (operation === "watchRoom") {
    const existing = getPlayerSide(room, playerId);
    if (existing && existing !== "spectator") {
      return json({ ok: false, error: "当前身份已经是选手，请使用独立观战入口进入观战。", requestId, debug: roomDebug(room, { operation, existing }) }, 409);
    }
    room.spectators = (room.spectators || [])
      .filter((spectator) => spectator.playerId !== playerId)
      .slice(-(MAX_SPECTATORS - 1));
    room.spectators.push(normalizeSpectator({ ...(payload.spectator || {}), playerId, connected: true, lastSeenAt: nowMs() }));
    appendLog(room, "spectator_joined", "观战者已进入房间。", { playerId });
    const saved = await writeRoom(env, room, { preservePlayers: true });
    return json({ ok: true, room: snapshot(saved, "spectator"), side: "spectator", viewerSide: "spectator" });
  }

  if (operation === "leaveRoom" && getPlayerSide(room, playerId) === "spectator") {
    room.spectators = (room.spectators || []).filter((spectator) => spectator.playerId !== playerId);
    appendLog(room, "spectator_left", "观战者已退出观战。", { playerId });
    const saved = await writeRoom(env, room, { preservePlayers: true });
    return json({ ok: true, room: snapshot(saved, "spectator"), side: "spectator" });
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
    const lockedCharacterId = String(payload.characterId || room.players[side].characterId || "").slice(0, 120);
    const lockedSnapshot = redactSecrets(payload.characterSnapshot || room.players[side].characterSnapshot || null);
    const lockedAllyCharacterId = String(payload.allyCharacterId || room.players[side].allyCharacterId || "").slice(0, 120);
    const lockedAllySnapshot = redactSecrets(payload.allyCharacterSnapshot || room.players[side].allyCharacterSnapshot || null);
    if (lockedCharacterId) room.players[side].characterId = lockedCharacterId;
    if (lockedSnapshot) room.players[side].characterSnapshot = lockedSnapshot;
    if (lockedAllyCharacterId) room.players[side].allyCharacterId = lockedAllyCharacterId;
    if (lockedAllySnapshot) room.players[side].allyCharacterSnapshot = lockedAllySnapshot;
    if (room.phase !== "preparing") return json({ ok: false, error: "当前不是准备阶段。" }, 409);
    if (!room.players[side].characterId) return json({ ok: false, error: "请先选择角色。" }, 409);
    if (room.mode === "2v2" && !room.players[side].allyCharacterId) return json({ ok: false, error: "2V2 模式需要先选择队友角色。" }, 409);
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
    room.round = 1;
    room.phase = "turn_selecting";
    room.battleState = createBattleSeedState(room);
    room.turnState = { turnId: "turn_1", phase: "selecting", actions: { left: [], right: [] }, locks: { left: false, right: false }, result: null, aiStatus: "" };
    room.reviewState = { winnerSide: "", summary: "", rematchVotes: {}, resetVotes: {} };
    appendLog(room, "rematch", "双方保留角色，再来一把。");
    const saved = await writeRoom(env, room);
    return json({ ok: true, room: snapshot(saved, side), side });
  }

  if (operation === "resetToPreparing") {
    if (side !== "left" && room.ownerPlayerId !== playerId) return json({ ok: false, error: "只有房主可以回到准备阶段。" }, 403);
    room.phase = "preparing";
    room.round = 1;
    room.battleState = null;
    room.turnState = { turnId: "turn_1", phase: "selecting", actions: { left: [], right: [] }, locks: { left: false, right: false }, result: null, aiStatus: "" };
    room.reviewState = { winnerSide: "", summary: "", rematchVotes: {}, resetVotes: {} };
    room.players.left.characterLocked = false;
    room.players.right.characterLocked = false;
    room.readyState.leftCharacterLocked = false;
    room.readyState.rightCharacterLocked = false;
    appendLog(room, "reset_prepare", "房主已将房间重置到准备阶段。");
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
    if (side === "spectator") {
      room.spectators = (room.spectators || []).filter((spectator) => spectator.playerId !== playerId);
      appendLog(room, "spectator_left", "观战者已退出观战。", { playerId });
    } else {
      room.players[side].connected = false;
      room.players[side].lastSeenAt = nowMs();
    }
    if (side === "left") {
      room.phase = "ended";
      appendLog(room, "room_ended", "房主已离开，房间结束。");
    } else if (side === "right") {
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
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "JSON 请求无效。" }, 400);
    }
    try {
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
