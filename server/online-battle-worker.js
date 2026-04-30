import OpenAI from "openai";

const PROTOCOL = "jjk_online_battle_v1";
const MAX_LOGS = 120;
const ROOM_TTL_SECONDS = 7200;
const PHASES = new Set(["preparing", "battle_starting", "turn_selecting", "turn_resolving", "reviewing", "ended"]);
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
  return Boolean(room?.turnState?.locks?.left && room?.turnState?.locks?.right &&
    room.turnState.actions?.left?.length && room.turnState.actions?.right?.length);
}

function normalizeActions(actions = []) {
  return (Array.isArray(actions) ? actions : []).slice(0, 8).map((action, index) => ({
    actionId: String(action?.actionId || action?.id || `action_${index + 1}`).slice(0, 120),
    displayName: String(action?.displayName || action?.label || action?.name || `手札 ${index + 1}`).slice(0, 80),
    cardType: String(action?.cardType || action?.type || "").slice(0, 40),
    apCost: Number(action?.apCost || 0),
    ceCost: Number(action?.ceCost || action?.baseCeCost || 0),
    source: "player_locked_action"
  }));
}

function appendLog(room, type, message, patch = {}) {
  room.logs = (Array.isArray(room.logs) ? room.logs : []).concat({ at: nowMs(), type, message, ...patch }).slice(-MAX_LOGS);
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
      resetVotes: room.reviewState?.resetVotes || {}
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

async function writeRoom(env, room) {
  const safe = redactSecrets(normalizeRoom(room));
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
  const model = env.AI_MODEL || "doubao-seed-2-0-mini-260215";
  const baseURL = env.AI_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3";
  const apiKey = String(env.AI_API_KEY || "").trim();
  if (!apiKey) {
    return {
      source: "local_fallback",
      summary: `第 ${room.round} 回合已接收双方锁定行动；服务器未配置 AI_API_KEY，已使用占位结算。`,
      actions: redactSecrets(room.turnState.actions)
    };
  }
  const client = new OpenAI({ apiKey, baseURL });
  const completion = await client.chat.completions.create({
    model,
    messages: buildAiPrompt(room),
    temperature: Number(env.AI_TEMPERATURE || 0.4),
    max_tokens: Math.max(64, Math.min(1200, Number(env.AI_MAX_TOKENS || 700))),
    response_format: { type: "json_object" }
  });
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
    usage: completion.usage || null,
    actions: redactSecrets(room.turnState.actions)
  };
}

async function resolveTurnIfReady(env, room, viewerSide = "left") {
  if (!hasBothLockedActions(room)) return room;
  room.phase = "turn_resolving";
  room.turnState.aiStatus = "resolving";
  const beforeRound = room.round;
  try {
    const result = await resolveTurnWithAi(env, room);
    room.turnState.result = result;
    room.turnState.aiStatus = result.source;
    room.reviewState.summary = result.summary || room.reviewState.summary || "";
    appendLog(room, "turn_resolved", result.summary || `第 ${beforeRound} 回合已结算。`, { turn: beforeRound, aiSource: result.source });
  } catch (error) {
    const summary = `第 ${beforeRound} 回合 AI 结算失败，已保留双方行动并进入下一回合。原因：${String(error?.message || error).slice(0, 160)}`;
    room.turnState.result = { source: "ai_error_fallback", summary, actions: redactSecrets(room.turnState.actions) };
    room.turnState.aiStatus = "ai_error_fallback";
    appendLog(room, "turn_resolved", summary, { turn: beforeRound });
  }
  room.round += 1;
  room.turnState = { turnId: `turn_${room.round}`, phase: "selecting", actions: { left: [], right: [] }, locks: { left: false, right: false }, result: null, aiStatus: "" };
  room.players.left.actionLocked = false;
  room.players.right.actionLocked = false;
  room.phase = "turn_selecting";
  return room;
}

async function handleOperation(env, body) {
  if (body.protocol !== PROTOCOL) return json({ ok: false, error: "协议不匹配。" }, 400);
  const operation = String(body.operation || "");
  const playerId = String(body.playerId || "").slice(0, 120);
  const payload = redactSecrets(body.payload || {});
  const roomId = normalizeRoomId(body.roomId || payload.room?.roomId);
  const requestedSide = body.side ? normalizeSide(body.side) : "";

  if (operation === "ping") return json({ ok: true, protocol: PROTOCOL, message: "online battle endpoint ready" });

  if (operation === "createRoom") {
    const room = normalizeRoom(payload.room || {});
    if (!room?.roomId) return json({ ok: false, error: "房间码无效。" }, 400);
    if (await readRoom(env, room.roomId)) return json({ ok: false, error: "房间已存在。" }, 409);
    room.ownerPlayerId = room.ownerPlayerId || room.players.left.playerId || playerId;
    room.players.left.playerId = room.players.left.playerId || playerId;
    room.players.left.connected = true;
    room.players.left.lastSeenAt = nowMs();
    appendLog(room, "room_created", "房间已创建。", { side: "left", playerId: room.players.left.playerId });
    const saved = await writeRoom(env, room);
    return json({ ok: true, room: snapshot(saved, "left"), side: "left" });
  }

  const room = await readRoom(env, roomId);
  if (!room) return json({ ok: false, error: "房间不存在。" }, 404);

  if (operation === "getRoom") {
    const side = getPlayerSide(room, playerId) || requestedSide;
    if (side && room.players[side]?.playerId === playerId) {
      room.players[side].connected = true;
      room.players[side].lastSeenAt = nowMs();
      const saved = await writeRoom(env, room);
      return json({ ok: true, room: snapshot(saved, side), side });
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
    return json({ ok: false, error: error.message }, error.status || 403);
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
    const saved = await writeRoom(env, room);
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
    if (room.phase !== "turn_selecting") return json({ ok: false, error: "当前不能锁定行动。" }, 409);
    const actions = normalizeActions(payload.actions);
    if (!actions.length) return json({ ok: false, error: "请先选择至少一张手札。" }, 409);
    room.turnState.actions[side] = actions;
    room.turnState.locks[side] = true;
    room.players[side].actionLocked = true;
    appendLog(room, "turn_locked", `${side === "left" ? "左方" : "右方"}已锁定第 ${room.round} 回合行动。`, { side, turn: room.round });
    applyPhaseTransition(room);
    if (room.phase === "turn_resolving") await resolveTurnIfReady(env, room, side);
    const saved = await writeRoom(env, room);
    return json({ ok: true, room: snapshot(saved, side), side });
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
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "JSON 请求无效。" }, 400);
    }
    try {
      return await handleOperation(env, body);
    } catch (error) {
      return json({ ok: false, error: String(error?.message || error || "服务器错误。") }, Number(error?.status || 500));
    }
  }
};
