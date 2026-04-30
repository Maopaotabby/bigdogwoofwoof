const APP_BUILD_VERSION = "20260430-online-pass-turn-v1";
const ONLINE_RULES_PATH = "./data/online-room-rules-v0.1-candidate.json";
const ONLINE_PROTOCOL = "jjk_online_battle_v1";
const ROOM_STORAGE_PREFIX = "jjk-online-battle-v1:";
const PLAYER_ID_STORAGE_KEY = "jjk-online-battle-player-id-v1";
const ACTIVE_ROOM_STORAGE_KEY = "jjk-online-battle-active-room-v1";
const BACKEND_MODE_STORAGE_KEY = "jjk-online-battle-backend-mode-v1";
const CUSTOM_ENDPOINT_STORAGE_KEY = "jjk-online-battle-custom-endpoint-v1";
const DEBUG_LOG_STORAGE_KEY = "jjk-online-battle-debug-log-v1";
const ONLINE_HELP_SEEN_STORAGE_KEY = "jjk-online-battle-help-seen-v1";
const ROOM_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const REMOTE_OPERATION_TIMEOUT_MS = 35000;
const ONLINE_DEBUG_LIMIT = 60;
const PHASES = Object.freeze(["preparing", "battle_starting", "turn_selecting", "turn_resolving", "reviewing", "ended"]);
const LOCAL_DEFAULT_ENDPOINT = "https://jjk-online-battle.maopaotabby-jjk-life.workers.dev";
const PASS_TURN_ACTION_ID = "online_pass_turn";

const DEFAULT_RULES = Object.freeze({
  backend: {
    defaultMode: "official_endpoint",
    officialEndpoint: { url: LOCAL_DEFAULT_ENDPOINT },
    supportedModes: ["local_mock_backend", "official_endpoint", "custom_endpoint"]
  },
  room: { roomIdLength: 6 },
  sync: { pollIntervalMs: 1600 }
});

const memoryRooms = new Map();
let cachedRules = null;
let pollStop = null;
let removalNoticeShown = false;
const debugEvents = [];
let uiState = {
  roomId: "",
  playerId: "",
  side: "",
  backendMode: "",
  endpoint: ""
};

function cloneJson(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function storage(kind = "local") {
  try {
    return kind === "session" ? globalThis.sessionStorage : globalThis.localStorage;
  } catch {
    return null;
  }
}

function nowMs() {
  return Date.now();
}

function sleep(ms) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function makeRequestId(operation = "op") {
  const random = Math.random().toString(36).slice(2, 8);
  return `${String(operation || "op").slice(0, 20)}_${nowMs().toString(36)}_${random}`;
}

function maskId(value) {
  const text = String(value || "");
  if (text.length <= 8) return text || "-";
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

function compactDebug(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.slice(0, 2000);
  try {
    return JSON.stringify(redactSecrets(value)).slice(0, 3000);
  } catch {
    return String(value).slice(0, 2000);
  }
}

function pushDebugEvent(event = {}) {
  if (event.operation === "getRoom" && ["send", "ok"].includes(event.level)) return;
  const entry = {
    time: new Date().toLocaleTimeString(),
    ...redactSecrets(event)
  };
  debugEvents.unshift(entry);
  if (debugEvents.length > ONLINE_DEBUG_LIMIT) debugEvents.length = ONLINE_DEBUG_LIMIT;
  try {
    storage("session")?.setItem?.(DEBUG_LOG_STORAGE_KEY, JSON.stringify(debugEvents));
  } catch {
    // Debug logging must never break online gameplay.
  }
  renderDebugLog();
}

function restoreDebugEvents() {
  if (debugEvents.length) return;
  try {
    const parsed = JSON.parse(storage("session")?.getItem?.(DEBUG_LOG_STORAGE_KEY) || "[]");
    if (Array.isArray(parsed)) debugEvents.push(...parsed.slice(0, ONLINE_DEBUG_LIMIT));
  } catch {
    debugEvents.length = 0;
  }
}

function renderDebugLog() {
  const node = typeof document === "undefined" ? null : document.querySelector("#onlineDebugLog");
  if (!node) return;
  restoreDebugEvents();
  node.textContent = debugEvents.length
    ? debugEvents.map((event) => `[${event.time}] ${event.level || "info"} ${event.operation || ""} ${event.message || ""} ${compactDebug(event.detail)}`).join("\n")
    : "暂无联机调试日志。";
}

function enrichError(error, detail = {}) {
  const message = error?.message || String(error || "联机操作失败。");
  const next = new Error(message);
  next.cause = error;
  next.debugDetail = redactSecrets(detail);
  return next;
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
  return PHASES.includes(text) ? text : "preparing";
}

function normalizeEndpoint(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (!/^https?:$/.test(url.protocol)) return "";
    url.hash = "";
    return url.href;
  } catch {
    return "";
  }
}

function normalizeBackendMode(value) {
  if (value === "official_endpoint") return "official_endpoint";
  if (value === "custom_endpoint") return "custom_endpoint";
  return "local_mock_backend";
}

function roomKey(roomId) {
  return `${ROOM_STORAGE_PREFIX}${normalizeRoomId(roomId)}`;
}

function generateRoomId(length = DEFAULT_RULES.room.roomIdLength) {
  let id = "";
  for (let index = 0; index < length; index += 1) {
    let pick = Math.floor(Math.random() * ROOM_ID_ALPHABET.length);
    if (globalThis.crypto?.getRandomValues) {
      const values = new Uint32Array(1);
      globalThis.crypto.getRandomValues(values);
      pick = values[0] % ROOM_ID_ALPHABET.length;
    }
    id += ROOM_ID_ALPHABET[pick];
  }
  return id;
}

function getOrCreatePlayerId() {
  if (uiState.playerId) return uiState.playerId;
  const store = storage("session") || storage("local");
  const existing = store?.getItem?.(PLAYER_ID_STORAGE_KEY);
  if (existing) {
    uiState.playerId = existing;
    return existing;
  }
  const id = `p_${generateRoomId(10).toLowerCase()}_${nowMs().toString(36)}`;
  store?.setItem?.(PLAYER_ID_STORAGE_KEY, id);
  uiState.playerId = id;
  return id;
}

function getBackendSettings(options = {}) {
  const store = storage("local");
  const storedMode = store?.getItem?.(BACKEND_MODE_STORAGE_KEY);
  const storedEndpoint = store?.getItem?.(CUSTOM_ENDPOINT_STORAGE_KEY);
  const platformDefault = getPlatformDefaultBackendSettings();
  const hasExplicitMode = Object.prototype.hasOwnProperty.call(options, "backendMode");
  const sameOriginDefaultActive = platformDefault.backendMode === "custom_endpoint" && !hasExplicitMode;
  const rememberedMode = sameOriginDefaultActive && storedMode === "official_endpoint" ? "" : storedMode;
  const liveMode = sameOriginDefaultActive && uiState.backendMode === "official_endpoint" ? "" : uiState.backendMode;
  const backendMode = normalizeBackendMode(options.backendMode || rememberedMode || liveMode || platformDefault.backendMode);
  const endpoint = normalizeEndpoint(options.endpoint || options.customEndpoint || storedEndpoint || uiState.endpoint || platformDefault.endpoint || "");
  return { backendMode, endpoint };
}

function saveBackendSettings(settings = {}) {
  const backendMode = normalizeBackendMode(settings.backendMode);
  const endpoint = normalizeEndpoint(settings.endpoint || settings.customEndpoint || "");
  const store = storage("local");
  store?.setItem?.(BACKEND_MODE_STORAGE_KEY, backendMode);
  if (endpoint) store?.setItem?.(CUSTOM_ENDPOINT_STORAGE_KEY, endpoint);
  else store?.removeItem?.(CUSTOM_ENDPOINT_STORAGE_KEY);
  uiState = { ...uiState, backendMode, endpoint };
  return { backendMode, endpoint };
}

function clearBackendSettings() {
  const store = storage("local");
  store?.removeItem?.(BACKEND_MODE_STORAGE_KEY);
  store?.removeItem?.(CUSTOM_ENDPOINT_STORAGE_KEY);
  const platformDefault = getPlatformDefaultBackendSettings();
  uiState = { ...uiState, backendMode: platformDefault.backendMode, endpoint: platformDefault.endpoint };
  return getBackendSettings();
}

function shouldUseRemote(options = {}) {
  return getBackendSettings(options).backendMode !== "local_mock_backend";
}

function getPlatformDefaultBackendSettings() {
  const sameOriginEndpoint = getSameOriginOfficialEndpoint();
  if (sameOriginEndpoint) {
    return { backendMode: "custom_endpoint", endpoint: sameOriginEndpoint };
  }
  return { backendMode: DEFAULT_RULES.backend.defaultMode, endpoint: "" };
}

function getOnlineHelpText() {
  const sameOriginEndpoint = getSameOriginOfficialEndpoint();
  return [
    "联机模式使用说明",
    "",
    "基本网络配置：",
    sameOriginEndpoint
      ? `1. 当前页面运行在服务器环境，默认使用本机联机后端：${sameOriginEndpoint}`
      : "1. GitHub Pages 默认使用官方联机服务器，普通玩家不需要填写 Endpoint。",
    "2. 如果创建或加入失败，先点“测试官方服务器 / 后端连接”，确认当前网络能访问后端。",
    "3. 高级后端设置只给开发测试使用：本地 mock 只能同一浏览器或双标签测试，不能跨设备；自定义 Endpoint 必须兼容 jjk_online_battle_v1 的 POST 协议。",
    "",
    "对战操作流程：",
    "1. 房主选择角色后点击“创建新房间”，把房间码或邀请链接发给对手。",
    "2. 对手输入房间码或打开邀请链接，选择角色后加入房间。",
    "3. 双方都点击“锁定角色”后进入对战阶段。",
    "4. 在联机手札区选择手札后点击“锁定行动”；如果本回合咒力归零或没有可用手札，也可以直接锁定待机来跳过本回合。",
    "5. 双方都锁定后，服务器会短暂停留显示锁定状态，然后由本地规则引擎同步结算 HP、CE、AP 和战斗记录。",
    "6. 如果行动选错，可以在双方结算前点击“取消锁定”重新选择。",
    "7. 对局结束或需要重开时，可以使用“再来一把”或“回到准备阶段”。"
  ].join("\n");
}

function showOnlineHelpOnce(force = false) {
  const store = storage("local");
  if (!force && store?.getItem?.(ONLINE_HELP_SEEN_STORAGE_KEY) === "true") return;
  store?.setItem?.(ONLINE_HELP_SEEN_STORAGE_KEY, "true");
  globalThis.alert?.(getOnlineHelpText());
}

function handleBattlePageStateForHelp(event = {}) {
  const pageState = event.detail || globalThis.JJKBattlePage?.getBattlePageState?.() || {};
  if (pageState.activePage === "online") showOnlineHelpOnce();
}

function createEmptyPlayer(side) {
  return {
    side,
    playerId: "",
    displayName: "",
    connected: false,
    lastSeenAt: 0,
    role: side === "left" ? "owner" : "guest",
    characterId: "",
    characterSnapshot: null,
    characterLocked: false,
    actionLocked: false
  };
}

function getCharacterCards() {
  try {
    return globalThis.JJKCharacter?.getDuelCharacterCards?.() || globalThis.getDuelCharacterCards?.() || [];
  } catch {
    return [];
  }
}

function getCharacterById(characterId) {
  const id = String(characterId || "");
  return getCharacterCards().find((card) => card?.characterId === id || card?.id === id) || null;
}

function sanitizeCharacterSnapshot(card) {
  if (!card) return null;
  const copy = cloneJson(card);
  return redactSecrets({
    ...copy,
    characterId: String(copy.characterId || copy.id || ""),
    displayName: String(copy.displayName || copy.name || copy.characterId || "未命名角色")
  });
}

function characterOptionLabel(card) {
  return [
    card?.displayName || card?.name || card?.characterId || "未命名角色",
    card?.officialGrade || card?.visibleGrade || "",
    card?.customDuel ? "自定义" : "官方"
  ].filter(Boolean).join(" · ");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function syncCharacterSelects() {
  if (typeof document === "undefined") return;
  const cards = getCharacterCards();
  const options = cards.length
    ? cards.map((card) => `<option value="${escapeHtml(card.characterId || card.id)}">${escapeHtml(characterOptionLabel(card))}</option>`).join("")
    : `<option value="">暂无可用角色</option>`;
  [$("#onlineCreateCharacterSelect"), $("#onlineJoinCharacterSelect")].forEach((select, index) => {
    if (!select) return;
    const current = select.value || cards[index]?.characterId || cards[index]?.id || cards[0]?.characterId || cards[0]?.id || "";
    if (select.dataset.optionSignature !== options) {
      select.innerHTML = options;
      select.dataset.optionSignature = options;
    }
    if ([...select.options].some((option) => option.value === current)) select.value = current;
  });
}

function makePlayer(side, options = {}) {
  const card = getCharacterById(options.characterId);
  return {
    ...createEmptyPlayer(side),
    playerId: options.playerId || getOrCreatePlayerId(),
    displayName: String(options.displayName || (side === "left" ? "玩家 A" : "玩家 B")).slice(0, 40),
    connected: true,
    lastSeenAt: nowMs(),
    characterId: String(options.characterId || card?.characterId || card?.id || "").slice(0, 120),
    characterSnapshot: sanitizeCharacterSnapshot(card)
  };
}

function normalizeRoom(room) {
  if (!room || typeof room !== "object") return null;
  room.protocol = ONLINE_PROTOCOL;
  room.phase = normalizePhase(room.phase);
  room.players = {
    left: { ...createEmptyPlayer("left"), ...(room.players?.left || {}) },
    right: { ...createEmptyPlayer("right"), ...(room.players?.right || {}) }
  };
  room.readyState = {
    leftCharacterLocked: Boolean(room.readyState?.leftCharacterLocked || room.players.left.characterLocked),
    rightCharacterLocked: Boolean(room.readyState?.rightCharacterLocked || room.players.right.characterLocked)
  };
  room.players.left.characterLocked = room.readyState.leftCharacterLocked;
  room.players.right.characterLocked = room.readyState.rightCharacterLocked;
  room.turnState = {
    turnId: String(room.turnState?.turnId || `turn_${room.round || 1}`),
    phase: String(room.turnState?.phase || "selecting"),
    actions: {
      left: Array.isArray(room.turnState?.actions?.left) ? room.turnState.actions.left : [],
      right: Array.isArray(room.turnState?.actions?.right) ? room.turnState.actions.right : []
    },
    locks: {
      left: Boolean(room.turnState?.locks?.left || room.players.left.actionLocked),
      right: Boolean(room.turnState?.locks?.right || room.players.right.actionLocked)
    },
    result: room.turnState?.result || null,
    aiStatus: room.turnState?.aiStatus || ""
  };
  room.players.left.actionLocked = room.turnState.locks.left;
  room.players.right.actionLocked = room.turnState.locks.right;
  room.reviewState ||= { winnerSide: "", summary: "", rematchVotes: {}, resetVotes: {} };
  room.reviewState.lastAiDebug ||= null;
  room.reviewState.lastResolvedTurn ||= null;
  room.logs = Array.isArray(room.logs) ? room.logs.slice(-100) : [];
  room.round = Math.max(1, Number(room.round) || 1);
  room.revision = Math.max(1, Number(room.revision) || 1);
  room.updatedAt = Number(room.updatedAt) || nowMs();
  applyPhaseTransition(room);
  return room;
}

function hasBothPlayers(room) {
  return Boolean(room?.players?.left?.playerId && room?.players?.right?.playerId);
}

function hasBothLockedCharacters(room) {
  return Boolean(hasBothPlayers(room) && room.readyState?.leftCharacterLocked && room.readyState?.rightCharacterLocked);
}

function hasBothLockedActions(room) {
  return Boolean(room?.turnState?.locks?.left && room?.turnState?.locks?.right);
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
    appendLog(room, "battle_started", "双方角色已锁定，进入对战阶段。");
  }
  if (hasBothLockedActions(room)) room.phase = "turn_resolving";
  return room;
}

function createBattleSeedState(room) {
  return {
    schema: "jjk-online-battle-state-v1",
    battleId: `online_${room.roomId}_${nowMs().toString(36)}`,
    battleSeed: `online-${room.roomId}-${nowMs().toString(36)}`,
    round: room.round,
    players: {
      left: {
        characterId: room.players.left.characterId,
        characterSnapshot: room.players.left.characterSnapshot
      },
      right: {
        characterId: room.players.right.characterId,
        characterSnapshot: room.players.right.characterSnapshot
      }
    }
  };
}

function appendLog(room, type, message, patch = {}) {
  if (!room.logs?.some((entry) => entry.type === type && entry.message === message && entry.turn === patch.turn)) {
    room.logs = (room.logs || []).concat({ at: nowMs(), type, message, ...patch }).slice(-100);
  }
}

function touch(room) {
  room.revision = Math.max(1, Number(room.revision) || 1) + 1;
  room.updatedAt = nowMs();
  return room;
}

function readLocalRoom(roomId) {
  const id = normalizeRoomId(roomId);
  const raw = storage("local")?.getItem?.(roomKey(id));
  const room = raw ? JSON.parse(raw) : memoryRooms.get(id);
  return normalizeRoom(room);
}

function writeLocalRoom(room) {
  const normalized = normalizeRoom(touch(room));
  const id = normalizeRoomId(normalized.roomId);
  const payload = JSON.stringify(redactSecrets(normalized));
  storage("local")?.setItem?.(roomKey(id), payload);
  memoryRooms.set(id, JSON.parse(payload));
  return readLocalRoom(id);
}

function remember(roomId, playerId, side, settings = getBackendSettings()) {
  uiState = { ...uiState, roomId: normalizeRoomId(roomId), playerId, side: side || "", ...settings };
  storage("session")?.setItem?.(ACTIVE_ROOM_STORAGE_KEY, JSON.stringify(uiState));
}

function restoreRemembered() {
  try {
    const remembered = JSON.parse(storage("session")?.getItem?.(ACTIVE_ROOM_STORAGE_KEY) || "null");
    if (remembered?.roomId) uiState = { ...uiState, ...remembered };
  } catch {
    uiState = { ...uiState };
  }
  return { ...uiState };
}

function clearRemembered() {
  uiState = { roomId: "", playerId: uiState.playerId || "", side: "", backendMode: uiState.backendMode, endpoint: uiState.endpoint };
  storage("session")?.removeItem?.(ACTIVE_ROOM_STORAGE_KEY);
}

function getPlayerSide(room, playerId) {
  if (!room || !playerId) return "";
  if (room.players.left.playerId === playerId) return "left";
  if (room.players.right.playerId === playerId) return "right";
  return "";
}

function createRoom(options = {}) {
  const settings = getBackendSettings(options);
  if (shouldUseRemote(settings)) return remoteOperation("createRoom", { payload: { room: createRoomObject(options) } }, settings);
  let room = createRoomObject(options);
  while (readLocalRoom(room.roomId)) room = createRoomObject({ ...options, roomId: generateRoomId() });
  const saved = writeLocalRoom(room);
  remember(saved.roomId, saved.players.left.playerId, "left", settings);
  return Promise.resolve(snapshot(saved, "left"));
}

function createRoomObject(options = {}) {
  const roomId = normalizeRoomId(options.roomId) || generateRoomId();
  const left = makePlayer("left", { ...options, playerId: options.playerId || getOrCreatePlayerId() });
  const now = nowMs();
  return normalizeRoom({
    protocol: ONLINE_PROTOCOL,
    roomId,
    roomCode: roomId,
    phase: "preparing",
    createdAt: now,
    updatedAt: now,
    revision: 1,
    ownerPlayerId: left.playerId,
    players: { left, right: createEmptyPlayer("right") },
    readyState: { leftCharacterLocked: false, rightCharacterLocked: false },
    round: 1,
    turnState: { turnId: "turn_1", phase: "selecting", actions: { left: [], right: [] }, locks: { left: false, right: false } },
    reviewState: { winnerSide: "", summary: "", rematchVotes: {}, resetVotes: {} },
    logs: [{ at: now, type: "room_created", message: `房间 ${roomId} 已创建。` }]
  });
}

function joinRoom(roomId, options = {}) {
  const settings = getBackendSettings(options);
  if (shouldUseRemote(settings)) return remoteOperation("joinRoom", { roomId, payload: { player: makePlayer("right", options) } }, settings);
  const room = readLocalRoom(roomId);
  if (!room) return Promise.reject(new Error("房间不存在。"));
  const playerId = options.playerId || getOrCreatePlayerId();
  const existingSide = getPlayerSide(room, playerId);
  if (existingSide) {
    room.players[existingSide].connected = true;
    room.players[existingSide].lastSeenAt = nowMs();
    appendLog(room, "player_reconnected", `${existingSide === "left" ? "左方" : "右方"}玩家已重新连接。`, { side: existingSide, playerId });
    const saved = writeLocalRoom(room);
    remember(saved.roomId, playerId, existingSide, settings);
    return Promise.resolve(snapshot(saved, existingSide));
  }
  if (room.players.right.playerId) return Promise.reject(new Error("房间已满。"));
  room.players.right = makePlayer("right", { ...options, playerId });
  appendLog(room, "player_joined", "加入者已进入房间。", { side: "right", playerId });
  const saved = writeLocalRoom(room);
  remember(saved.roomId, playerId, "right", settings);
  return Promise.resolve(snapshot(saved, "right"));
}

function selectCharacter(roomId, side, characterId, options = {}) {
  const settings = getBackendSettings(options);
  if (shouldUseRemote(settings)) return remoteOperation("selectCharacter", { roomId, side, payload: { characterId, characterSnapshot: sanitizeCharacterSnapshot(getCharacterById(characterId)) } }, settings);
  const room = requireLocalRoom(roomId);
  const actorSide = authorizeSide(room, side, options);
  if (room.phase !== "preparing") throw new Error("只有准备阶段可以更换角色。");
  const card = getCharacterById(characterId);
  if (!card) throw new Error("角色不存在。");
  room.players[actorSide].characterId = card.characterId || card.id;
  room.players[actorSide].characterSnapshot = sanitizeCharacterSnapshot(card);
  room.players[actorSide].characterLocked = false;
  room.readyState[`${actorSide}CharacterLocked`] = false;
  appendLog(room, "character_selected", `${actorSide === "left" ? "左方" : "右方"}选择了角色。`, { side: actorSide });
  return Promise.resolve(snapshot(writeLocalRoom(room), actorSide));
}

function lockCharacter(roomId, side, options = {}) {
  const settings = getBackendSettings(options);
  if (shouldUseRemote(settings)) return remoteOperation("lockCharacter", { roomId, side }, settings);
  const room = requireLocalRoom(roomId);
  const actorSide = authorizeSide(room, side, options);
  if (room.phase !== "preparing") throw new Error("当前不是准备阶段。");
  if (!room.players[actorSide].characterId) throw new Error("请先选择角色。");
  room.readyState[`${actorSide}CharacterLocked`] = true;
  room.players[actorSide].characterLocked = true;
  appendLog(room, "character_locked", `${actorSide === "left" ? "左方" : "右方"}已锁定角色。`, { side: actorSide });
  applyPhaseTransition(room);
  const saved = writeLocalRoom(room);
  if (saved.phase === "turn_selecting") enterBattleView(saved, actorSide);
  return Promise.resolve(snapshot(saved, actorSide));
}

function unlockCharacter(roomId, side, options = {}) {
  const settings = getBackendSettings(options);
  if (shouldUseRemote(settings)) return remoteOperation("unlockCharacter", { roomId, side }, settings);
  const room = requireLocalRoom(roomId);
  const actorSide = authorizeSide(room, side, options);
  if (room.phase !== "preparing") throw new Error("进入对战后不能取消角色锁定。");
  room.readyState[`${actorSide}CharacterLocked`] = false;
  room.players[actorSide].characterLocked = false;
  appendLog(room, "character_unlocked", `${actorSide === "left" ? "左方" : "右方"}取消了角色锁定。`, { side: actorSide });
  return Promise.resolve(snapshot(writeLocalRoom(room), actorSide));
}

function lockTurn(roomId, side, actions = [], options = {}) {
  const settings = getBackendSettings(options);
  const normalized = normalizeActionsOrPass(actions);
  if (shouldUseRemote(settings)) return remoteOperation("lockTurn", { roomId, side, payload: { actions: normalized } }, settings);
  const room = requireLocalRoom(roomId);
  const actorSide = authorizeSide(room, side, options);
  if (room.phase !== "turn_selecting") throw new Error("当前不能锁定行动。");
  room.turnState.actions[actorSide] = normalized;
  room.turnState.locks[actorSide] = true;
  room.players[actorSide].actionLocked = true;
  appendLog(room, "turn_locked", `${actorSide === "left" ? "左方" : "右方"}已锁定第 ${room.round} 回合行动。`, { side: actorSide, turn: room.round });
  applyPhaseTransition(room);
  const saved = writeLocalRoom(room);
  if (saved.phase === "turn_resolving") return resolveTurn(saved.roomId, { ...settings, side: actorSide, playerId: options.playerId });
  return Promise.resolve(snapshot(saved, actorSide));
}

function unlockTurn(roomId, side, options = {}) {
  const settings = getBackendSettings(options);
  if (shouldUseRemote(settings)) return remoteOperation("unlockTurn", { roomId, side }, settings);
  const room = requireLocalRoom(roomId);
  const actorSide = authorizeSide(room, side, options);
  if (room.phase !== "turn_selecting") throw new Error("当前不能取消行动锁定。");
  room.turnState.locks[actorSide] = false;
  room.players[actorSide].actionLocked = false;
  return Promise.resolve(snapshot(writeLocalRoom(room), actorSide));
}

async function resolveTurn(roomId, options = {}) {
  const settings = getBackendSettings(options);
  if (shouldUseRemote(settings)) return remoteOperation("resolveTurnIfReady", { roomId, side: options.side }, settings);
  const room = requireLocalRoom(roomId);
  if (!hasBothLockedActions(room)) throw new Error("双方尚未都锁定行动。");
  room.phase = "turn_resolving";
  room.turnState.aiStatus = "rules_engine";
  const resolvedTurn = room.round;
  const lockedActions = {
    left: normalizeActions(room.turnState.actions.left),
    right: normalizeActions(room.turnState.actions.right)
  };
  room.turnState.result = {
    source: "rules_engine",
    summary: `第 ${room.round} 回合双方行动已锁定，按本地规则引擎结算。`,
    actions: cloneJson(lockedActions)
  };
  room.reviewState.lastResolvedTurn = {
    turn: resolvedTurn,
    source: room.turnState.result.source,
    actions: cloneJson(lockedActions),
    result: cloneJson(room.turnState.result)
  };
  appendLog(room, "turn_resolved", room.turnState.result.summary, { turn: room.round });
  await sleep(1000);
  room.round += 1;
  room.turnState = { turnId: `turn_${room.round}`, phase: "selecting", actions: { left: [], right: [] }, locks: { left: false, right: false }, result: null, aiStatus: "" };
  room.players.left.actionLocked = false;
  room.players.right.actionLocked = false;
  room.phase = "turn_selecting";
  return snapshot(writeLocalRoom(room), options.side || uiState.side || "left");
}

function rematch(roomId, options = {}) {
  const settings = getBackendSettings(options);
  if (shouldUseRemote(settings)) return remoteOperation("rematch", { roomId, side: options.side || uiState.side }, settings);
  const room = requireLocalRoom(roomId);
  const actorSide = authorizeSide(room, options.side || uiState.side, options);
  room.round = 1;
  room.phase = "turn_selecting";
  room.battleState = createBattleSeedState(room);
  room.turnState = { turnId: "turn_1", phase: "selecting", actions: { left: [], right: [] }, locks: { left: false, right: false }, result: null, aiStatus: "" };
  room.reviewState = { winnerSide: "", summary: "", rematchVotes: {}, resetVotes: {} };
  appendLog(room, "rematch", "双方保留角色，再来一把。");
  const saved = writeLocalRoom(room);
  enterBattleView(saved, actorSide);
  return Promise.resolve(snapshot(saved, actorSide));
}

function resetToPreparing(roomId, options = {}) {
  const settings = getBackendSettings(options);
  if (shouldUseRemote(settings)) return remoteOperation("resetToPreparing", { roomId, side: options.side || uiState.side }, settings);
  const room = requireLocalRoom(roomId);
  const actorSide = authorizeSide(room, options.side || uiState.side, options);
  if (actorSide !== "left" && room.ownerPlayerId !== (options.playerId || uiState.playerId)) throw new Error("只有房主可以重回准备阶段。");
  room.phase = "preparing";
  room.readyState = { leftCharacterLocked: false, rightCharacterLocked: false };
  room.players.left.characterLocked = false;
  room.players.right.characterLocked = false;
  room.players.left.actionLocked = false;
  room.players.right.actionLocked = false;
  room.turnState = { turnId: "turn_1", phase: "selecting", actions: { left: [], right: [] }, locks: { left: false, right: false }, result: null, aiStatus: "" };
  room.round = 1;
  room.battleState = null;
  appendLog(room, "reset_prepare", "房主将房间重置到准备阶段。");
  return Promise.resolve(snapshot(writeLocalRoom(room), actorSide));
}

function kickPlayer(roomId, targetSide = "right", options = {}) {
  const settings = getBackendSettings(options);
  if (shouldUseRemote(settings)) return remoteOperation("kickPlayer", { roomId, side: options.side || uiState.side, payload: { targetSide } }, settings);
  const room = requireLocalRoom(roomId);
  const requester = authorizeSide(room, options.side || uiState.side, options);
  if (requester !== "left" && room.ownerPlayerId !== (options.playerId || uiState.playerId)) throw new Error("只有房主可以踢出玩家。");
  if (!["preparing", "reviewing"].includes(room.phase)) throw new Error("只有准备阶段或复盘阶段可以踢出玩家。");
  const side = normalizeSide(targetSide);
  if (side === "left") throw new Error("不能踢出房主。");
  const targetPlayerId = room.players[side]?.playerId || "";
  if (!targetPlayerId) throw new Error("该位置当前没有可踢出的玩家。");
  room.players[side] = createEmptyPlayer(side);
  room.readyState.rightCharacterLocked = false;
  room.turnState.actions.right = [];
  room.turnState.locks.right = false;
  room.phase = "preparing";
  appendLog(room, "player_kicked", "右方玩家已被房主移出房间。", { targetSide: side, targetPlayerId });
  return Promise.resolve(snapshot(writeLocalRoom(room), requester));
}

function leaveRoom(roomId, options = {}) {
  const settings = getBackendSettings(options);
  if (shouldUseRemote(settings)) return remoteOperation("leaveRoom", { roomId, side: options.side || uiState.side }, settings).finally(clearRemembered);
  const room = readLocalRoom(roomId);
  if (room) {
    const side = getPlayerSide(room, options.playerId || uiState.playerId) || normalizeSide(options.side || uiState.side);
    room.players[side].connected = false;
    room.phase = "ended";
    appendLog(room, "room_ended", `${side === "left" ? "房主" : "加入者"}离开，房间结束。`);
    writeLocalRoom(room);
  }
  clearRemembered();
  stopPolling();
  return Promise.resolve({});
}

function requireLocalRoom(roomId) {
  const room = readLocalRoom(roomId);
  if (!room) throw new Error("房间不存在。");
  return room;
}

function authorizeSide(room, side, options = {}) {
  const playerId = options.playerId || uiState.playerId || getOrCreatePlayerId();
  const actual = getPlayerSide(room, playerId) || normalizeSide(side);
  if (!room.players[actual]?.playerId || room.players[actual].playerId !== playerId) throw new Error("当前玩家不在房间内。");
  return actual;
}

function normalizeActions(actions = []) {
  return (Array.isArray(actions) ? actions : []).slice(0, 8).map((action, index) => ({
    actionId: String(action?.actionId || action?.id || action?.sourceActionId || `action_${index + 1}`).slice(0, 120),
    displayName: String(action?.displayName || action?.label || action?.name || action?.actionId || `手札 ${index + 1}`).slice(0, 80),
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

function readSelectedActionsFromDom() {
  const runtimeActions = globalThis.JJKDuelRuntime?.getSelectedOnlineActionSnapshots?.(uiState.side || "left");
  if (Array.isArray(runtimeActions) && runtimeActions.length) return runtimeActions;
  const active = [...document.querySelectorAll(".duel-action-choice.active[data-duel-action]")];
  return active.map((button, index) => ({
    actionId: button.dataset.duelAction || `action_${index + 1}`,
    displayName: button.querySelector(".duel-action-title")?.textContent?.trim() || button.textContent.trim()
  }));
}

function lockSelectedTurnFromBattle() {
  if (!uiState.roomId) {
    const error = enrichError(new Error("当前没有联机房间，无法提交行动。"), { operation: "lockTurn", roomId: "", side: uiState.side || "" });
    showError(error);
    return Promise.reject(error);
  }
  if (!uiState.side) {
    const error = enrichError(new Error("当前玩家阵营未同步，无法提交行动。"), { operation: "lockTurn", roomId: uiState.roomId, side: "" });
    showError(error);
    return Promise.reject(error);
  }
  const actions = readSelectedActionsFromDom();
  pushDebugEvent({ level: "info", operation: "lockTurn", message: actions.length ? "已读取手札，准备提交锁定行动" : "未选择手札，按待机行动锁定本回合", detail: { roomId: uiState.roomId, side: uiState.side, actionsCount: actions.length } });
  setLocalLockPending(true);
  return lockTurn(uiState.roomId, uiState.side, actions, { playerId: uiState.playerId })
    .then((room) => {
      const localLocked = room.phase === "turn_selecting" && Boolean(room.turnState?.locks?.[room.viewerSide || uiState.side]);
      globalThis.JJKBattlePage?.setBattleMode?.("online", {
        activeRoomId: room.roomId || uiState.roomId,
        playerSide: room.viewerSide || uiState.side,
        activePage: "online",
        localLocked
      });
      globalThis.JJKDuelRuntime?.syncOnlineRoomState?.(room, room.viewerSide || uiState.side);
      render(room);
      return room;
    })
    .catch((error) => {
      setLocalLockPending(false);
      showError(error);
      throw error;
    });
}

function setLocalLockPending(locked) {
  if (!uiState.roomId || !uiState.side) return;
  setDisabled("#onlineLockTurnBtn", Boolean(locked));
  setDisabled("#onlineUnlockTurnBtn", Boolean(locked));
  globalThis.JJKBattlePage?.setBattleMode?.("online", {
    activeRoomId: uiState.roomId,
    playerSide: uiState.side,
    activePage: "online",
    localLocked: Boolean(locked)
  });
  const battle = globalThis.JJKDuelRuntime?.getDuelBattle?.();
  if (battle && battle.mode === "online" && battle.onlineRoomId === uiState.roomId) {
    battle.actionUiMessage = locked ? "行动已锁定，等待服务器同步。" : "";
    globalThis.JJKDuelRuntime?.renderDuelMode?.();
  }
}

function snapshot(room, viewerSide = "") {
  const copy = redactSecrets(cloneJson(normalizeRoom(room)));
  copy.viewerSide = viewerSide || getPlayerSide(copy, uiState.playerId) || "";
  if (copy.phase === "turn_selecting" && copy.viewerSide && !hasBothLockedActions(copy)) {
    copy.turnState.actions[otherSide(copy.viewerSide)] = [];
  }
  return copy;
}

function isSecretKey(key) {
  return /api.?key|authorization|secret|token|proxy.?endpoint|byok|localstorage|raw.?ai|provider/i.test(String(key));
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

async function getRules(options = {}) {
  if (cachedRules && !options.forceReload) return cachedRules;
  try {
    const response = await (options.fetchImpl || fetch)(ONLINE_RULES_PATH);
    if (response?.ok) {
      const data = await response.json();
      cachedRules = { ...DEFAULT_RULES, ...data };
      return cachedRules;
    }
  } catch {
    // Keep local fallback available when static JSON is unavailable.
  }
  cachedRules = cloneJson(DEFAULT_RULES);
  return cachedRules;
}

async function getOfficialEndpoint() {
  const sameOriginEndpoint = getSameOriginOfficialEndpoint();
  if (sameOriginEndpoint) return sameOriginEndpoint;
  const rules = await getRules();
  return normalizeEndpoint(rules?.backend?.officialEndpoint?.url || "");
}

function getSameOriginOfficialEndpoint() {
  const location = globalThis.location;
  const hostname = String(location?.hostname || "");
  if (!hostname) return "";
  if (["localhost", "127.0.0.1", "::1"].includes(hostname)) return "";
  if (hostname.endsWith("github.io")) return "";
  if (!/^https?:$/.test(String(location?.protocol || ""))) return "";
  try {
    return new URL("/online-room", location.href).href;
  } catch {
    return "";
  }
}

async function remoteOperation(operation, request = {}, options = {}) {
  const settings = getBackendSettings(options);
  const endpoint = settings.backendMode === "official_endpoint" ? await getOfficialEndpoint() : settings.endpoint;
  if (!endpoint) throw new Error("新版联机服务器尚未配置；请使用本地 mock 或填写新版自定义 Endpoint。");
  const requestId = makeRequestId(operation);
  const startedAt = nowMs();
  const body = redactSecrets({
    protocol: ONLINE_PROTOCOL,
    operation,
    requestId,
    roomId: normalizeRoomId(request.roomId || options.roomId),
    playerId: options.playerId || uiState.playerId || getOrCreatePlayerId(),
    side: request.side || options.side || uiState.side || "",
    payload: request.payload || {},
    siteVersion: APP_BUILD_VERSION,
    sentAt: nowMs()
  });
  const actionsCount = Array.isArray(body.payload?.actions) ? body.payload.actions.length : undefined;
  const debugBase = {
    requestId,
    operation,
    roomId: body.roomId || "-",
    side: body.side || "-",
    playerId: maskId(body.playerId),
    backendMode: settings.backendMode,
    actionsCount
  };
  pushDebugEvent({ level: "send", operation, message: "发送联机请求", detail: debugBase });
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeout = controller ? globalThis.setTimeout(() => controller.abort(), REMOTE_OPERATION_TIMEOUT_MS) : null;
  let response;
  let data;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller?.signal
    });
    data = await response.json().catch(() => null);
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    const message = timedOut
      ? `联机请求超时（${Math.round(REMOTE_OPERATION_TIMEOUT_MS / 1000)} 秒）：${operation}`
      : `联机请求发送失败：${error?.message || error}`;
    const detail = { ...debugBase, elapsedMs: nowMs() - startedAt, timedOut };
    pushDebugEvent({ level: "error", operation, message, detail });
    throw enrichError(new Error(message), detail);
  } finally {
    if (timeout) globalThis.clearTimeout(timeout);
  }
  const responseDebug = {
    ...debugBase,
    status: response.status,
    elapsedMs: nowMs() - startedAt,
    serverDebug: data?.debug || null,
    serverRequestId: data?.requestId || ""
  };
  if (!response.ok || data?.ok === false) {
    const message = data?.error || `联机服务器请求失败：${response.status}`;
    pushDebugEvent({ level: "error", operation, message, detail: responseDebug });
    throw enrichError(new Error(message), responseDebug);
  }
  pushDebugEvent({ level: "ok", operation, message: `请求完成 ${response.status}`, detail: responseDebug });
  const aiDebug = data?.debug?.lastAiDebug || null;
  if (aiDebug?.aiRequestPreview) {
    pushDebugEvent({
      level: "ai",
      operation,
      message: "AI 请求内容",
      detail: aiDebug.aiRequestPreview
    });
  } else if (operation === "lockTurn" && data?.debug?.triggeredResolve === false) {
    pushDebugEvent({
      level: "info",
      operation,
      message: "未发送 AI 请求：双方尚未都锁定行动",
      detail: {
        roomId: data?.debug?.roomId || body.roomId || "",
        round: data?.debug?.roundAfter || data?.debug?.roundBefore || "",
        locks: data?.debug?.locks || null
      }
    });
  }
  if (aiDebug?.responseTextPreview) {
    pushDebugEvent({
      level: "ai",
      operation,
      message: "AI 返回内容",
      detail: {
        source: aiDebug.source || "",
        model: aiDebug.model || "",
        durationMs: aiDebug.durationMs || 0,
        responseTextPreview: aiDebug.responseTextPreview
      }
    });
  } else if (aiDebug?.fallback || aiDebug?.timedOut) {
    pushDebugEvent({
      level: "warn",
      operation,
      message: aiDebug.timedOut ? "AI 超时，已使用本地处理" : "AI 失败，已使用本地处理",
      detail: aiDebug
    });
  }
  if (operation === "ping") return data || { ok: true };
  const room = normalizeRoom(data.room || data.snapshot);
  const actualSide = getPlayerSide(room, body.playerId);
  const side = data.side || actualSide || (operation === "getRoom" ? "" : body.side);
  if (room?.roomId && actualSide) remember(room.roomId, body.playerId, actualSide, settings);
  return snapshot(room, side);
}

function buildInviteLink(roomId) {
  const url = new URL(globalThis.location?.href || "http://localhost/index.html");
  url.searchParams.set("onlineRoom", normalizeRoomId(roomId));
  ["playerId", "apiKey", "api_key", "authorization", "token", "secret", "endpoint", "proxyEndpoint"].forEach((key) => url.searchParams.delete(key));
  return url.href;
}

function parseInviteLink() {
  try {
    return normalizeRoomId(new URLSearchParams(globalThis.location?.search || "").get("onlineRoom"));
  } catch {
    return "";
  }
}

function startPolling(roomId, side) {
  stopPolling();
  let stopped = false;
  let timer = null;
  pollStop = () => {
    stopped = true;
    if (timer) globalThis.clearTimeout(timer);
  };
  const tick = () => {
    if (stopped || !roomId) return;
    getRoomState(roomId, { side, viewerSide: side }).then(render).catch(showError);
    timer = globalThis.setTimeout(tick, DEFAULT_RULES.sync.pollIntervalMs);
  };
  tick();
}

function stopPolling() {
  if (typeof pollStop === "function") pollStop();
  else if (pollStop) globalThis.clearTimeout(pollStop);
  pollStop = null;
}

function getRoomState(roomId, options = {}) {
  const settings = getBackendSettings(options);
  if (shouldUseRemote(settings)) return remoteOperation("getRoom", { roomId, side: options.side || uiState.side }, settings);
  const room = readLocalRoom(roomId);
  if (!room) return Promise.reject(new Error("房间不存在。"));
  const side = options.viewerSide || getPlayerSide(room, uiState.playerId) || options.side || "";
  return Promise.resolve(snapshot(room, side));
}

function phaseLabel(phase) {
  return {
    preparing: "准备阶段",
    battle_starting: "进入对战",
    turn_selecting: "对战阶段",
    turn_resolving: "结算中",
    reviewing: "复盘阶段",
    ended: "已结束"
  }[phase] || "未开始";
}

function playerLabel(room, side, viewerSide) {
  const player = room?.players?.[side];
  if (!player?.playerId) return "等待玩家";
  const role = player.role === "owner" ? "房主" : "加入者";
  return `${viewerSide === side ? "你" : "对方"}（${role}）${player.connected ? "" : " 离线"}`;
}

function characterLabel(player) {
  if (!player?.characterId) return "角色：未选择";
  const name = player.characterSnapshot?.displayName || getCharacterById(player.characterId)?.displayName || getCharacterById(player.characterId)?.name || player.characterId;
  return `角色：${name}${player.characterLocked ? "（已锁定）" : "（未锁定）"}`;
}

function nextHint(room, side) {
  if (!room?.roomId) return "下一步：创建房间，或输入房间码加入。";
  if (room.phase === "preparing") {
    if (!hasBothPlayers(room)) return "等待对方加入；房主可以先选择并锁定角色。";
    if (!room.players[side]?.characterLocked) return "请选择角色并锁定。";
    return "等待对方锁定角色。";
  }
  if (room.phase === "turn_selecting") {
    if (room.turnState.locks[side]) return "已锁定行动，等待对方。";
    return "选择手札后锁定行动；无可用手札时可直接锁定待机。";
  }
  if (room.phase === "turn_resolving") return "服务器正在结算双方行动。";
  if (room.phase === "reviewing") return "可以再来一把、回到准备阶段或退出房间。";
  if (room.phase === "ended") return "房间已结束。";
  return "同步中。";
}

function render(room = {}) {
  syncCharacterSelects();
  const side = room.viewerSide || uiState.side || getPlayerSide(room, uiState.playerId) || "";
  if (handleRemovedFromRoom(room)) return;
  const opponent = side ? otherSide(side) : "right";
  const onlinePageActive = isOnlinePageActive();
  syncBattlePageLockState(room, side);
  syncDuelRuntimeRoomState(room, side);
  if (onlinePageActive) maybeEnterBattleView(room, side);
  setText("#onlineSyncStatus", room.roomId ? `${phaseLabel(room.phase)} · ${room.roomId}` : "未加入房间。");
  setText("#onlineRoomCode", room.roomId || "未创建");
  setText("#onlineCurrentRoomCode", room.roomId || "未创建");
  setText("#onlinePlayerSide", side === "left" ? "左方房主" : side === "right" ? "右方加入者" : "未加入");
  setText("#onlinePhaseLabel", room.roomId ? phaseLabel(room.phase) : "未开始");
  setText("#onlineOpponentStatus", room.players?.[opponent]?.playerId ? (room.players[opponent].connected ? "已加入" : "离线") : "未加入");
  setText("#onlineTurnLabel", room.round ? `第 ${room.round} 回合` : "未开始");
  setText("#onlineLocalLockStatus", room.phase === "preparing" ? (room.players?.[side]?.characterLocked ? "角色已锁定" : "角色未锁定") : (room.turnState?.locks?.[side] ? "行动已锁定" : "行动未锁定"));
  setText("#onlineOpponentLockStatus", room.phase === "preparing" ? (room.players?.[opponent]?.characterLocked ? "角色已锁定" : "角色未锁定") : (room.turnState?.locks?.[opponent] ? "行动已锁定" : "行动未锁定"));
  setText("#onlineLeftPlayerLabel", playerLabel(room, "left", side));
  setText("#onlineRightPlayerLabel", playerLabel(room, "right", side));
  setText("#onlineLeftCharacterLabel", characterLabel(room.players?.left));
  setText("#onlineRightCharacterLabel", characterLabel(room.players?.right));
  setText("#onlineLeftResourceLabel", resourceLabel(room, "left"));
  setText("#onlineRightResourceLabel", resourceLabel(room, "right"));
  setText("#onlineNextStepHint", nextHint(room, side || "left"));
  setValue("#onlineInviteLink", room.roomId ? buildInviteLink(room.roomId) : "");
  updateButtons(room, side);
  renderBackendControls();
  renderDebugLog();
}

function syncDuelRuntimeRoomState(room, side) {
  if (!room?.roomId || !side) return;
  globalThis.JJKDuelRuntime?.syncOnlineRoomState?.(room, side);
}

function handleRemovedFromRoom(room = {}) {
  if (!room?.roomId || !uiState.roomId || !uiState.playerId) return false;
  if (normalizeRoomId(room.roomId) !== normalizeRoomId(uiState.roomId)) return false;
  if (getPlayerSide(room, uiState.playerId)) return false;
  if (room.phase === "ended") return false;
  if (!wasCurrentPlayerKicked(room)) {
    clearRemembered();
    stopPolling();
    render({});
    return true;
  }
  if (removalNoticeShown) return true;
  removalNoticeShown = true;
  clearRemembered();
  stopPolling();
  globalThis.alert?.("你已被移出房间。页面将刷新并回到未加入状态。");
  globalThis.setTimeout?.(() => {
    try {
      globalThis.location?.reload?.();
    } catch {
      render({});
    }
  }, 80);
  return true;
}

function wasCurrentPlayerKicked(room = {}) {
  const logs = Array.isArray(room.logs) ? room.logs : [];
  for (let index = logs.length - 1; index >= 0; index -= 1) {
    const entry = logs[index];
    if (entry?.type === "player_kicked" && entry?.targetPlayerId === uiState.playerId) return true;
    if (["player_joined", "player_reconnected", "room_created"].includes(entry?.type) && entry?.playerId === uiState.playerId) return false;
  }
  return false;
}

function maybeEnterBattleView(room = {}, side = "") {
  if (!room?.roomId || !side) return;
  if (!["turn_selecting", "turn_resolving", "reviewing"].includes(room.phase)) return;
  if (!room.players?.left?.characterId || !room.players?.right?.characterId) return;
  enterBattleView(room, side);
}

function syncBattlePageLockState(room, side) {
  if (!globalThis.JJKBattlePage) return;
  if (!room?.roomId || !side) {
    if (globalThis.JJKBattlePage.getBattleMode?.() === "online") globalThis.JJKBattlePage.clearBattleMode?.("none");
    return;
  }
  if (typeof globalThis.JJKBattlePage.setBattleMode !== "function") return;
  const currentPage = globalThis.JJKBattlePage.getBattlePageState?.().activePage || "online";
  globalThis.JJKBattlePage.setBattleMode("online", {
    activeRoomId: room.roomId,
    playerSide: side,
    activePage: currentPage,
    localLocked: room.phase === "turn_selecting" && Boolean(room.turnState?.locks?.[side])
  });
}

function isOnlinePageActive() {
  return (globalThis.JJKBattlePage?.getBattlePageState?.().activePage || "") === "online";
}

function resourceLabel(room, side) {
  const resource = getOnlineResourceForDisplay(room, side);
  if (!resource) return "HP / CE / AP：等待战斗";
  return `HP ${Math.round(Number(resource.hp || 0))} / CE ${Math.round(Number(resource.ce || 0))} / AP ${resource.ap?.current ?? resource.ap ?? "-"}`;
}

function getOnlineResourceForDisplay(room, side) {
  const serverResource = side === "left" ? room?.battleState?.resourceState?.p1 : room?.battleState?.resourceState?.p2;
  if (serverResource) return serverResource;
  const battle = globalThis.JJKDuelRuntime?.getDuelBattle?.();
  if (!battle || battle.mode !== "online" || battle.onlineRoomId !== room?.roomId) return null;
  return side === "left" ? battle.resourceState?.p1 : battle.resourceState?.p2;
}

function updateButtons(room, side) {
  const hasRoom = Boolean(room?.roomId);
  const isOwner = side === "left" || room?.ownerPlayerId === uiState.playerId;
  setDisabled("#onlineCopyRoomCodeBtn", !hasRoom);
  setDisabled("#onlineCopyInviteBtn", !hasRoom);
  setDisabled("#onlineLockCharacterBtn", !hasRoom || room.phase !== "preparing" || !room.players?.[side]?.characterId || room.players?.[side]?.characterLocked);
  setDisabled("#onlineUnlockCharacterBtn", !hasRoom || room.phase !== "preparing" || !room.players?.[side]?.characterLocked);
  setDisabled("#onlineLockTurnBtn", !hasRoom || room.phase !== "turn_selecting" || room.turnState?.locks?.[side]);
  setDisabled("#onlineUnlockTurnBtn", !hasRoom || room.phase !== "turn_selecting" || !room.turnState?.locks?.[side] || hasBothLockedActions(room));
  setDisabled("#onlineResolveTurnBtn", true);
  setDisabled("#onlineRematchBtn", !hasRoom || !["reviewing", "turn_selecting"].includes(room.phase));
  setDisabled("#onlineResetPrepareBtn", !hasRoom || !isOwner || !["reviewing", "turn_selecting", "preparing"].includes(room.phase));
  setDisabled("#onlineKickRightPlayerBtn", !hasRoom || !isOwner || !room.players?.right?.playerId || !["preparing", "reviewing"].includes(room.phase));
  setDisabled("#onlineLeaveRoomBtn", !hasRoom);
  setText("#onlineLockTurnBtn", room.phase === "turn_selecting" ? "锁定行动" : "等待对战阶段");
  setText("#onlineResolveTurnBtn", room.phase === "turn_resolving" ? "结算中" : "双方锁定后自动结算");
}

async function renderBackendControls() {
  const settings = getBackendSettings();
  const sameOriginEndpoint = getSameOriginOfficialEndpoint();
  const usesSameOriginEndpoint = settings.backendMode === "custom_endpoint" && sameOriginEndpoint && normalizeEndpoint(settings.endpoint) === sameOriginEndpoint;
  setValue("#onlineBackendMode", settings.backendMode);
  setValue("#onlineEndpointInput", settings.endpoint);
  setText("#onlineModeLabel", settings.backendMode === "local_mock_backend" ? "本地 mock" : usesSameOriginEndpoint ? "本机联机后端" : settings.backendMode === "custom_endpoint" ? "自定义 Endpoint" : "官方联机服务器");
  const endpointField = $("#onlineEndpointField");
  if (endpointField) endpointField.hidden = settings.backendMode !== "custom_endpoint";
  setText("#onlineBackendHint", settings.backendMode === "local_mock_backend"
    ? "本地 mock 使用浏览器 localStorage，只适合同一浏览器或双标签测试。"
    : usesSameOriginEndpoint
      ? "当前使用本机 /online-room 后端，适合腾讯云一体化部署。"
    : "新版联机使用 POST operation 协议；服务器负责房间阶段、角色快照、行动锁定和后续 AI broker。");
  setText("#onlineOfficialStatus", usesSameOriginEndpoint
    ? "当前使用本机联机后端；国内访问无需跳转到 Cloudflare。"
    : settings.backendMode === "official_endpoint"
    ? "当前默认使用官方联机服务器；普通玩家无需填写 Endpoint。"
    : "当前未使用官方服务器。");
}

function enterBattleView(room, side) {
  const left = room.players.left.characterId;
  const right = room.players.right.characterId;
  const leftSelect = $("#duelLeftSelect");
  const rightSelect = $("#duelRightSelect");
  if (leftSelect && [...leftSelect.options].some((option) => option.value === left)) leftSelect.value = left;
  if (rightSelect && [...rightSelect.options].some((option) => option.value === right)) rightSelect.value = right;
  globalThis.JJKBattlePage?.setBattleMode?.("online", { activeRoomId: room.roomId, playerSide: side, activePage: "online", localLocked: false });
  const starter = globalThis.JJKDuelRuntime?.startDuelBattle || globalThis.startDuelBattle;
  const currentBattle = globalThis.JJKDuelRuntime?.getDuelBattle?.();
  const currentLeft = currentBattle?.left?.id || currentBattle?.left?.characterId || "";
  const currentRight = currentBattle?.right?.id || currentBattle?.right?.characterId || "";
  if (typeof starter === "function" && currentBattle?.onlineRoomId === room.roomId && currentLeft === left && currentRight === right) return;
  if (typeof starter === "function") {
    try {
      starter({ mode: "online", allowOnline: true, snapshot: { roomId: room.roomId, battleSeed: room.battleState?.battleSeed, players: room.players } });
    } catch {
      // The runtime may not be ready yet; the room state remains authoritative.
    }
  }
}

function $(selector) {
  return typeof document === "undefined" ? null : document.querySelector(selector);
}

function setText(selector, value) {
  const node = typeof selector === "string" ? $(selector) : selector;
  if (node) node.textContent = String(value ?? "");
}

function setValue(selector, value) {
  const node = typeof selector === "string" ? $(selector) : selector;
  if (node) node.value = String(value ?? "");
}

function setDisabled(selector, disabled) {
  const node = typeof selector === "string" ? $(selector) : selector;
  if (node) node.disabled = Boolean(disabled);
}

function showError(error) {
  const message = error?.message || String(error || "联机操作失败。");
  setText("#onlineSyncStatus", message);
  pushDebugEvent({ level: "error", operation: error?.debugDetail?.operation || "ui", message, detail: error?.debugDetail || null });
}

function bindUi() {
  const panel = $("#onlineAlphaPanel");
  if (!panel || panel.dataset.onlineRewriteBound === "true") return;
  panel.dataset.onlineRewriteBound = "true";
  restoreRemembered();
  const invited = parseInviteLink();
  if (invited) {
    if (uiState.roomId && normalizeRoomId(uiState.roomId) !== invited) {
      stopPolling();
      clearRemembered();
    }
    setValue("#onlineJoinRoomCodeInput", invited);
  }
  syncCharacterSelects();
  render({});
  globalThis.setTimeout(() => {
    syncCharacterSelects();
    if (!uiState.roomId) render({});
  }, 300);
  globalThis.setTimeout(() => {
    syncCharacterSelects();
    if (!uiState.roomId) render({});
  }, 1200);
  document.addEventListener("jjk-duel-character-pool-changed", syncCharacterSelects);
  document.addEventListener("jjk-battle-page-state", (event) => {
    syncCharacterSelects();
    handleBattlePageStateForHelp(event);
  });
  handleBattlePageStateForHelp();
  $("#onlineBackendMode")?.addEventListener("change", () => {
    saveBackendSettings({ backendMode: $("#onlineBackendMode")?.value, endpoint: $("#onlineEndpointInput")?.value });
    renderBackendControls();
  });
  $("#onlineSaveBackendBtn")?.addEventListener("click", () => {
    saveBackendSettings({ backendMode: $("#onlineBackendMode")?.value, endpoint: $("#onlineEndpointInput")?.value });
    renderBackendControls();
  });
  $("#onlineClearBackendBtn")?.addEventListener("click", () => {
    clearBackendSettings();
    renderBackendControls();
  });
  $("#onlineTestBackendBtn")?.addEventListener("click", () => testConnection().then((message) => setText("#onlineSyncStatus", message)).catch(showError));
  $("#onlineOfficialTestBtn")?.addEventListener("click", () => testConnection({ backendMode: "official_endpoint" }).then((message) => setText("#onlineOfficialStatus", message)).catch((error) => setText("#onlineOfficialStatus", error.message)));
  $("#onlineCreateRoomBtn")?.addEventListener("click", () => createRoom({ ...getBackendSettings(), characterId: $("#onlineCreateCharacterSelect")?.value }).then((room) => {
    render(room);
    startPolling(room.roomId, "left");
  }).catch(showError));
  $("#onlineJoinRoomBtn")?.addEventListener("click", () => joinRoom($("#onlineJoinRoomCodeInput")?.value, { ...getBackendSettings(), characterId: $("#onlineJoinCharacterSelect")?.value }).then((room) => {
    render(room);
    startPolling(room.roomId, "right");
  }).catch(showError));
  $("#onlineCreateCharacterSelect")?.addEventListener("change", () => {
    if (uiState.roomId && uiState.side === "left") selectCharacter(uiState.roomId, "left", $("#onlineCreateCharacterSelect")?.value, { playerId: uiState.playerId }).then(render).catch(showError);
  });
  $("#onlineJoinCharacterSelect")?.addEventListener("change", () => {
    if (uiState.roomId && uiState.side === "right") selectCharacter(uiState.roomId, "right", $("#onlineJoinCharacterSelect")?.value, { playerId: uiState.playerId }).then(render).catch(showError);
  });
  $("#onlineLockCharacterBtn")?.addEventListener("click", () => lockCharacter(uiState.roomId, uiState.side, { playerId: uiState.playerId }).then(render).catch(showError));
  $("#onlineUnlockCharacterBtn")?.addEventListener("click", () => unlockCharacter(uiState.roomId, uiState.side, { playerId: uiState.playerId }).then(render).catch(showError));
  $("#onlineLockTurnBtn")?.addEventListener("click", () => lockSelectedTurnFromBattle().catch(() => {}));
  $("#onlineUnlockTurnBtn")?.addEventListener("click", () => unlockTurn(uiState.roomId, uiState.side, { playerId: uiState.playerId }).then(render).catch(showError));
  $("#onlineRematchBtn")?.addEventListener("click", () => rematch(uiState.roomId, { playerId: uiState.playerId, side: uiState.side }).then(render).catch(showError));
  $("#onlineResetPrepareBtn")?.addEventListener("click", () => resetToPreparing(uiState.roomId, { playerId: uiState.playerId, side: uiState.side }).then(render).catch(showError));
  $("#onlineKickRightPlayerBtn")?.addEventListener("click", () => kickPlayer(uiState.roomId, "right", { playerId: uiState.playerId, side: uiState.side }).then(render).catch(showError));
  $("#onlineLeaveRoomBtn")?.addEventListener("click", () => leaveRoom(uiState.roomId, { playerId: uiState.playerId, side: uiState.side }).then(() => render({})).catch(showError));
  $("#onlineCopyRoomCodeBtn")?.addEventListener("click", () => navigator.clipboard?.writeText?.(uiState.roomId || ""));
  $("#onlineCopyInviteBtn")?.addEventListener("click", () => navigator.clipboard?.writeText?.($("#onlineInviteLink")?.value || ""));
  $("#onlineCopyDebugLogBtn")?.addEventListener("click", () => navigator.clipboard?.writeText?.($("#onlineDebugLog")?.textContent || ""));
  if (uiState.roomId) {
    getRoomState(uiState.roomId, { side: uiState.side, viewerSide: uiState.side }).then((room) => {
      render(room);
      startPolling(room.roomId, uiState.side);
    }).catch(() => clearRemembered());
  }
}

async function testConnection(options = {}) {
  const settings = getBackendSettings(options);
  if (settings.backendMode === "local_mock_backend") return "本地 mock 可用。";
  const result = await remoteOperation("ping", {}, settings);
  const aiLabel = result?.aiConfigured ? "AI Key 已配置" : "AI Key 未配置";
  const modelLabel = result?.aiModel ? `模型：${result.aiModel}` : "模型未知";
  return `服务器 ping 正常（不代表房间或结算一定成功）；${aiLabel}；${modelLabel}。`;
}

const OnlineModule = {
  namespace: "JJKOnline",
  version: APP_BUILD_VERSION,
  protocol: ONLINE_PROTOCOL,
  phases: PHASES,
  createRoom,
  joinRoom,
  selectCharacter,
  lockCharacter,
  unlockCharacter,
  lockTurn,
  lockSelectedTurnFromBattle,
  unlockTurn,
  resolveTurn,
  rematch,
  resetToPreparing,
  kickPlayer,
  leaveRoom,
  getRoomState,
  startPolling,
  stopPolling,
  getBackendSettings,
  saveBackendSettings,
  clearBackendSettings,
  buildInviteLink,
  parseInviteLink,
  bindUi,
  initializeOnlineUi: bindUi
};

globalThis.JJKOnline = OnlineModule;

if (typeof document !== "undefined") {
  queueMicrotask(bindUi);
}

export { OnlineModule };
export default OnlineModule;
