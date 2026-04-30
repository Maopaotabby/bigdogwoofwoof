const APP_BUILD_VERSION = "20260428-v1.390A-combat-core-rationalization-pass";
const ONLINE_RULES_PATH = "./data/online-room-rules-v0.1-candidate.json";
const ROOM_STORAGE_PREFIX = "jjk-online-room-alpha:";
const PLAYER_ID_STORAGE_KEY = "jjk-online-player-id-alpha";
const ACTIVE_ROOM_STORAGE_KEY = "jjk-online-active-room-alpha";
const ONLINE_BACKEND_MODE_STORAGE_KEY = "jjk-online-backend-mode-alpha";
const ONLINE_CUSTOM_ENDPOINT_STORAGE_KEY = "jjk-online-custom-endpoint-alpha";
const OFFICIAL_ENDPOINT_PLACEHOLDER = "https://YOUR_OFFICIAL_WORKER_URL/online-room";
const OFFICIAL_ENDPOINT_MAINLAND_HINT = "官方联机服务器当前网络不可达。国内网络可能无法访问 workers.dev 线路；请稍后重试，或在高级后端设置中切换到国内可访问的自定义 Endpoint。站长也可以在 online-room-rules 的 mainlandMirrorUrls 中配置国内镜像。";
const ROOM_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ONLINE_PROTOCOL = "jjk_online_room_alpha";
const ONLINE_ROOM_STATUS_FLOW = ["waiting", "ready", "battle", "ended"];
const ONLINE_ROOM_STATUS_SET = new Set(ONLINE_ROOM_STATUS_FLOW);

const DEFAULT_RULES = {
  version: "0.1.0",
  status: "CANDIDATE",
  mode: "turn_sync_alpha",
  backend: {
    defaultMode: "official_endpoint",
    supportedModes: ["official_endpoint", "local_mock_backend", "custom_endpoint"],
    officialEndpoint: {
      enabled: true,
      label: "官方联机服务器",
      url: OFFICIAL_ENDPOINT_PLACEHOLDER,
      fallbackUrls: [],
      mainlandMirrorUrls: [],
      requiresUserConfig: false
    },
    localMock: {
      enabled: true,
      label: "本地 mock（开发/双标签测试）"
    },
    customEndpoint: {
      enabled: true,
      label: "自定义 Endpoint（高级）"
    },
    customEndpointProtocol: {
      method: "POST",
      body: "{ protocol, operation, roomId, playerId, side, payload, siteVersion }",
      response: "{ ok, room, side, error }"
    }
  },
  room: {
    roomIdLength: 6,
    maxPlayers: 2,
    allowSpectator: false,
    expireMinutes: 120
  },
  sync: {
    pollIntervalMs: 2000,
    requireBothLocked: true,
    hideOpponentActionsUntilBothLocked: true
  },
  security: {
    uploadApiKeys: false,
    uploadAiSettings: false,
    uploadLocalStorage: false,
    redactSecrets: true
  }
};

const localMemoryRooms = new Map();
let cachedRules = null;
let activePollingStop = null;
const autoResolveInFlight = new Set();
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

function getBrowserStorage() {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch (error) {
    return null;
  }
  return null;
}

function getSessionStorage() {
  try {
    if (typeof sessionStorage !== "undefined") return sessionStorage;
  } catch (error) {
    return null;
  }
  return null;
}

function nowMs() {
  return Date.now();
}

function normalizeOnlineRoomId(roomId) {
  return String(roomId || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

function generateOnlineRoomId(length = DEFAULT_RULES.room.roomIdLength) {
  let roomId = "";
  const cryptoApi = globalThis.crypto;
  for (let index = 0; index < length; index += 1) {
    let randomIndex = Math.floor(Math.random() * ROOM_ID_ALPHABET.length);
    if (cryptoApi?.getRandomValues) {
      const values = new Uint32Array(1);
      cryptoApi.getRandomValues(values);
      randomIndex = values[0] % ROOM_ID_ALPHABET.length;
    }
    roomId += ROOM_ID_ALPHABET[randomIndex];
  }
  return roomId;
}

function getRoomStorageKey(roomId) {
  return `${ROOM_STORAGE_PREFIX}${normalizeOnlineRoomId(roomId)}`;
}

function readStoredRoom(roomId) {
  const normalized = normalizeOnlineRoomId(roomId);
  const storage = getBrowserStorage();
  let room = null;
  if (storage) {
    const raw = storage.getItem(getRoomStorageKey(normalized));
    room = raw ? JSON.parse(raw) : null;
  } else {
    room = localMemoryRooms.get(normalized) || null;
  }
  return room ? normalizeOnlineRoomLifecycle(room) : null;
}

function writeStoredRoom(room) {
  normalizeOnlineRoomLifecycle(room);
  const normalized = normalizeOnlineRoomId(room?.roomId);
  if (!normalized) throw new Error("房间码无效。");
  const payload = JSON.stringify(redactOnlineSecrets(room));
  const storage = getBrowserStorage();
  if (storage) storage.setItem(getRoomStorageKey(normalized), payload);
  localMemoryRooms.set(normalized, JSON.parse(payload));
  return readStoredRoom(normalized);
}

function removeStoredRoom(roomId) {
  const normalized = normalizeOnlineRoomId(roomId);
  const storage = getBrowserStorage();
  if (storage) storage.removeItem(getRoomStorageKey(normalized));
  localMemoryRooms.delete(normalized);
}

function createEmptyPlayer(side) {
  return {
    side,
    playerId: "",
    displayName: "",
    characterId: "",
    connected: false,
    locked: false,
    lastSeenAt: 0
  };
}

function createOnlinePlayer(side, options = {}) {
  return {
    side,
    playerId: options.playerId || getOrCreateOnlinePlayerId(),
    displayName: String(options.displayName || (side === "left" ? "玩家 A" : "玩家 B")).slice(0, 40),
    characterId: String(options.characterId || "").slice(0, 80),
    connected: true,
    locked: false,
    lastSeenAt: nowMs()
  };
}

function normalizeOnlineRoomStatus(status) {
  const value = String(status || "").trim();
  if (ONLINE_ROOM_STATUS_SET.has(value)) return value;
  if (["selecting", "locked", "resolving"].includes(value)) return "battle";
  if (value === "abandoned") return "ended";
  return "waiting";
}

function hasOnlinePlayer(room, side) {
  return Boolean(room?.players?.[normalizeOnlineSide(side)]?.playerId);
}

function hasBothOnlinePlayers(room) {
  return hasOnlinePlayer(room, "left") && hasOnlinePlayer(room, "right");
}

function hasOnlineCharacter(room, side) {
  return Boolean(String(room?.players?.[normalizeOnlineSide(side)]?.characterId || "").trim());
}

function hasBothOnlineCharacters(room) {
  return hasBothOnlinePlayers(room) && hasOnlineCharacter(room, "left") && hasOnlineCharacter(room, "right");
}

function ensureOnlineRoomShape(room) {
  if (!room || typeof room !== "object") return room;
  room.players = {
    left: { ...createEmptyPlayer("left"), ...(room.players?.left || {}) },
    right: { ...createEmptyPlayer("right"), ...(room.players?.right || {}) }
  };
  room.pendingActions = {
    left: normalizeOnlineActionList(room.pendingActions?.left),
    right: normalizeOnlineActionList(room.pendingActions?.right)
  };
  room.publicLocks = {
    left: Boolean(room.publicLocks?.left || room.players.left.locked),
    right: Boolean(room.publicLocks?.right || room.players.right.locked)
  };
  room.players.left.locked = Boolean(room.publicLocks.left);
  room.players.right.locked = Boolean(room.publicLocks.right);
  room.turn = Math.max(1, Number(room.turn) || 1);
  room.lastResolvedTurn = Math.max(0, Number(room.lastResolvedTurn) || 0);
  room.logs = Array.isArray(room.logs) ? room.logs : [];
  room.status = normalizeOnlineRoomStatus(room.status);
  return room;
}

function createInitialOnlineBattleState(room) {
  const timestamp = nowMs();
  const existing = cloneJson(room?.battleState || {});
  return redactOnlineSecrets({
    ...existing,
    protocol: existing.protocol || ONLINE_PROTOCOL,
    schema: existing.schema || "jjk-online-battle-state",
    version: existing.version || 1,
    roomId: room.roomId,
    battleSeed: room.battleSeed || existing.battleSeed || `online-${room.roomId}-${timestamp.toString(36)}`,
    status: "battle",
    turn: Math.max(1, Number(room.turn) || Number(existing.turn) || Number(existing.round) || 1),
    initializedAt: existing.initializedAt || timestamp,
    lastResolvedTurn: Math.max(0, Number(room.lastResolvedTurn) || 0),
    players: {
      left: {
        side: "left",
        playerId: room.players.left.playerId || "",
        characterId: room.players.left.characterId || "",
        displayName: room.players.left.displayName || ""
      },
      right: {
        side: "right",
        playerId: room.players.right.playerId || "",
        characterId: room.players.right.characterId || "",
        displayName: room.players.right.displayName || ""
      }
    },
    publicLocks: {
      left: Boolean(room.publicLocks?.left),
      right: Boolean(room.publicLocks?.right)
    },
    pendingActionCounts: {
      left: room.pendingActions?.left?.length || 0,
      right: room.pendingActions?.right?.length || 0
    }
  });
}

function startOnlineBattle(room) {
  ensureOnlineRoomShape(room);
  if (!room) return room;
  if (room.status === "ended") return room;
  if (!hasBothOnlineCharacters(room)) {
    room.status = hasBothOnlinePlayers(room) ? "ready" : "waiting";
    return room;
  }
  const wasBattle = room.status === "battle" &&
    room.battleState?.status === "battle" &&
    room.battleState?.roomId === room.roomId;
  room.status = "battle";
  room.battleState = createInitialOnlineBattleState(room);
  room.updatedAt = nowMs();
  const hasStartLog = room.logs?.some?.((entry) => entry?.type === "battle_started");
  if (!wasBattle && !hasStartLog) {
    room.logs = (room.logs || []).concat({
      at: room.updatedAt,
      type: "battle_started",
      message: "双方角色已确定，联机战斗已开始。"
    }).slice(-80);
  }
  return room;
}

function normalizeOnlineRoomLifecycle(room) {
  ensureOnlineRoomShape(room);
  if (!room) return room;
  if (room.status === "ended") return room;
  if (hasBothOnlineCharacters(room)) return startOnlineBattle(room);
  room.status = hasBothOnlinePlayers(room) ? "ready" : "waiting";
  return room;
}

function getOrCreateOnlinePlayerId() {
  if (uiState.playerId) return uiState.playerId;
  const storage = getSessionStorage() || getBrowserStorage();
  const existing = storage?.getItem?.(PLAYER_ID_STORAGE_KEY);
  if (existing) {
    uiState.playerId = existing;
    return existing;
  }
  const playerId = `p_${generateOnlineRoomId(10).toLowerCase()}_${nowMs().toString(36)}`;
  storage?.setItem?.(PLAYER_ID_STORAGE_KEY, playerId);
  uiState.playerId = playerId;
  return playerId;
}

function normalizeOnlineSide(side) {
  return side === "right" ? "right" : "left";
}

function normalizeOnlineBackendMode(mode) {
  if (mode === "local_mock_backend") return "local_mock_backend";
  if (mode === "custom_endpoint") return "custom_endpoint";
  return "official_endpoint";
}

function normalizeOnlineEndpoint(endpoint) {
  const raw = String(endpoint || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (!/^https?:$/.test(url.protocol)) return "";
    url.hash = "";
    return url.href;
  } catch (error) {
    return "";
  }
}

function getOnlineBackendSettings(options = {}) {
  const storage = getBrowserStorage();
  const mode = normalizeOnlineBackendMode(
    options.backendMode ||
    storage?.getItem?.(ONLINE_BACKEND_MODE_STORAGE_KEY) ||
    uiState.backendMode ||
    DEFAULT_RULES.backend.defaultMode
  );
  const endpoint = normalizeOnlineEndpoint(
    options.customEndpoint ||
    options.endpoint ||
    storage?.getItem?.(ONLINE_CUSTOM_ENDPOINT_STORAGE_KEY) ||
    uiState.endpoint ||
    ""
  );
  return { backendMode: mode, endpoint };
}

function saveOnlineBackendSettings(settings = {}) {
  const storage = getBrowserStorage();
  const backendMode = normalizeOnlineBackendMode(settings.backendMode);
  const endpoint = normalizeOnlineEndpoint(settings.customEndpoint || settings.endpoint || "");
  storage?.setItem?.(ONLINE_BACKEND_MODE_STORAGE_KEY, backendMode);
  if (endpoint) storage?.setItem?.(ONLINE_CUSTOM_ENDPOINT_STORAGE_KEY, endpoint);
  else storage?.removeItem?.(ONLINE_CUSTOM_ENDPOINT_STORAGE_KEY);
  uiState = { ...uiState, backendMode, endpoint };
  return { backendMode, endpoint };
}

function clearOnlineBackendSettings() {
  const storage = getBrowserStorage();
  storage?.removeItem?.(ONLINE_BACKEND_MODE_STORAGE_KEY);
  storage?.removeItem?.(ONLINE_CUSTOM_ENDPOINT_STORAGE_KEY);
  uiState = { ...uiState, backendMode: "official_endpoint", endpoint: "" };
  return { backendMode: "official_endpoint", endpoint: "" };
}

function getActiveOnlineBackendMode(options = {}) {
  return getOnlineBackendSettings(options).backendMode;
}

function shouldUseCustomEndpoint(options = {}) {
  return getOnlineBackendSettings(options).backendMode === "custom_endpoint";
}

function shouldUseRemoteEndpoint(options = {}) {
  return getOnlineBackendSettings(options).backendMode !== "local_mock_backend";
}

function isOfficialEndpointConfigured(endpoint) {
  const normalized = normalizeOnlineEndpoint(endpoint);
  return Boolean(normalized && normalized !== normalizeOnlineEndpoint(OFFICIAL_ENDPOINT_PLACEHOLDER) && !/your[_-]?official[_-]?worker[_-]?url/i.test(normalized));
}

function uniqueOnlineEndpoints(urls) {
  const seen = new Set();
  const output = [];
  for (const url of urls || []) {
    const normalized = normalizeOnlineEndpoint(url);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
}

async function getOfficialOnlineEndpoints(options = {}) {
  const rules = await getOnlineRules(options);
  const official = rules?.backend?.officialEndpoint || {};
  const configured = [
    options.officialEndpoint,
    options.officialEndpointUrl,
    ...(Array.isArray(options.officialEndpoints) ? options.officialEndpoints : []),
    official.url,
    ...(Array.isArray(official.mainlandMirrorUrls) ? official.mainlandMirrorUrls : []),
    ...(Array.isArray(official.fallbackUrls) ? official.fallbackUrls : []),
    DEFAULT_RULES.backend.officialEndpoint.url
  ];
  return uniqueOnlineEndpoints(configured).filter(isOfficialEndpointConfigured);
}

async function getOfficialOnlineEndpoint(options = {}) {
  return (await getOfficialOnlineEndpoints(options))[0] || "";
}

function getOnlineOpponentSide(side) {
  return normalizeOnlineSide(side) === "left" ? "right" : "left";
}

function ensureRoomExists(roomId) {
  const room = normalizeOnlineRoomLifecycle(readStoredRoom(roomId));
  if (!room) throw new Error("房间不存在。");
  return room;
}

function getOnlinePlayerSide(room, playerId) {
  if (!room || !playerId) return "";
  if (room.players?.left?.playerId === playerId) return "left";
  if (room.players?.right?.playerId === playerId) return "right";
  return "";
}

function normalizeOnlineActionSummary(action, index = 0) {
  const source = action || {};
  const actionId = source.actionId || source.id || source.sourceActionId || source.cardId || `action_${index + 1}`;
  return {
    actionId: String(actionId).slice(0, 120),
    sourceActionId: String(source.sourceActionId || source.actionId || source.id || actionId).slice(0, 120),
    cardId: source.cardId ? String(source.cardId).slice(0, 120) : "",
    displayName: String(source.displayName || source.name || source.label || source.title || actionId).slice(0, 80),
    apCost: Number.isFinite(Number(source.apCost)) ? Number(source.apCost) : 0,
    ceCost: Number.isFinite(Number(source.ceCost)) ? Number(source.ceCost) : 0,
    cardType: String(source.cardType || source.type || "").slice(0, 40),
    tags: Array.isArray(source.tags) ? source.tags.slice(0, 8).map((tag) => String(tag).slice(0, 30)) : []
  };
}

function normalizeOnlineActionList(actions) {
  if (!Array.isArray(actions)) return [];
  return actions.slice(0, 8).map(normalizeOnlineActionSummary);
}

function isSecretKey(key) {
  return /api.?key|authorization|secret|token|proxy.?endpoint|ai.*settings|byok|localstorage|raw.?ai|rawproviderresponse/i.test(String(key));
}

function redactOnlineSecrets(value, seen = new WeakSet()) {
  if (value == null || typeof value !== "object") return value;
  if (seen.has(value)) return undefined;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => redactOnlineSecrets(item, seen)).filter((item) => item !== undefined);
  }
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (isSecretKey(key)) continue;
    const redacted = redactOnlineSecrets(item, seen);
    if (redacted !== undefined) output[key] = redacted;
  }
  return output;
}

async function getOnlineRules(options = {}) {
  if (cachedRules && !options.forceReload) return cachedRules;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl === "function") {
    try {
      const response = await fetchImpl(ONLINE_RULES_PATH);
      if (response?.ok) {
        cachedRules = { ...DEFAULT_RULES, ...(await response.json()) };
        return cachedRules;
      }
    } catch (error) {
      // Static file loading can fail in Node tests; fallback rules keep module deterministic.
    }
  }
  cachedRules = cloneJson(DEFAULT_RULES);
  return cachedRules;
}

async function sendOnlineEndpointRequest(operation, request = {}, options = {}) {
  const settings = getOnlineBackendSettings(options);
  const endpoints = settings.backendMode === "official_endpoint"
    ? await getOfficialOnlineEndpoints(options)
    : uniqueOnlineEndpoints([options.customEndpoint || options.endpoint || settings.endpoint]);
  if (settings.backendMode === "official_endpoint" && !endpoints.length) {
    throw new Error("官方服务器未配置。请站长部署 Worker 后填写官方 Endpoint，或切换到本地 mock / 自定义 Endpoint。");
  }
  if (!endpoints.length) {
    throw new Error(settings.backendMode === "custom_endpoint"
      ? "请先填写自定义 Endpoint。双方必须使用同一个 Endpoint。"
      : "联机后端 Endpoint 未配置。");
  }
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("当前环境不支持网络请求。");
  const roomId = normalizeOnlineRoomId(request.roomId || options.roomId);
  const side = request.side ? normalizeOnlineSide(request.side) : "";
  const playerId = String(request.playerId || options.playerId || uiState.playerId || "").slice(0, 120);
  const body = redactOnlineSecrets({
    protocol: ONLINE_PROTOCOL,
    operation,
    roomId,
    playerId,
    side,
    payload: request.payload || {},
    siteVersion: APP_BUILD_VERSION,
    sentAt: nowMs()
  });
  let lastNetworkError = null;
  for (let index = 0; index < endpoints.length; index += 1) {
    const endpoint = endpoints[index];
    let response = null;
    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    } catch (error) {
      lastNetworkError = error;
      if (settings.backendMode === "official_endpoint" && index < endpoints.length - 1) continue;
      throw new Error(settings.backendMode === "official_endpoint"
        ? OFFICIAL_ENDPOINT_MAINLAND_HINT
        : "自定义 Endpoint 连接失败。请确认双方使用同一个 HTTPS Endpoint，并且后端已开启 CORS。");
    }
    let result = null;
    try {
      result = await response.json();
    } catch (error) {
      result = null;
    }
    if (!response.ok || result?.ok === false) {
      throw new Error(result?.error || `${settings.backendMode === "official_endpoint" ? "官方服务器" : "自定义 Endpoint"}请求失败：${response.status || "unknown"}`);
    }
    return result || {};
  }
  throw new Error(lastNetworkError ? OFFICIAL_ENDPOINT_MAINLAND_HINT : "联机后端请求失败。");
}

function snapshotFromEndpointResult(result, viewerSide = "") {
  const room = result?.room || result?.snapshot || null;
  if (!room) return null;
  return buildOnlineRoomSnapshot(normalizeOnlineRoomLifecycle(room), result.side || viewerSide || uiState.side || "");
}

async function testOnlineBackendConnection(options = {}) {
  const settings = getOnlineBackendSettings(options);
  if (settings.backendMode === "local_mock_backend") {
    return { ok: true, backendMode: "local_mock_backend", message: "本地 mock 后端可用；跨设备不会共享房间。" };
  }
  const result = await sendOnlineEndpointRequest("ping", { payload: { client: "jjk-wheel" } }, options);
  return {
    ok: result.ok !== false,
    backendMode: settings.backendMode,
    message: result.message || (settings.backendMode === "official_endpoint" ? "官方联机服务器连接正常。" : "自定义 Endpoint 连接正常。")
  };
}

function createInitialOnlineRoom(roomId, options = {}) {
  const timestamp = nowMs();
  const leftPlayer = createOnlinePlayer("left", options);
  return {
    roomId,
    version: APP_BUILD_VERSION,
    status: "waiting",
    backendMode: options.backendMode || "local_mock_backend",
    battleSeed: options.battleSeed || `online-${roomId}-${timestamp.toString(36)}`,
    ownerPlayerId: options.ownerPlayerId || leftPlayer.playerId,
    turn: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    players: {
      left: leftPlayer,
      right: createEmptyPlayer("right")
    },
    battleState: cloneJson(options.battleState || {}),
    pendingActions: {
      left: [],
      right: []
    },
    publicLocks: {
      left: false,
      right: false
    },
    lastResolvedTurn: 0,
    logs: [
      {
        at: timestamp,
        type: "room_created",
        message: `房间 ${roomId} 已创建，等待第二名玩家加入。`
      }
    ]
  };
}

async function createOnlineRoom(options = {}) {
  const rules = await getOnlineRules(options);
  const settings = getOnlineBackendSettings(options);
  let roomId = normalizeOnlineRoomId(options.roomId);
  let attempts = 0;
  while (!roomId || (!shouldUseRemoteEndpoint(options) && readStoredRoom(roomId))) {
    roomId = generateOnlineRoomId(rules.room?.roomIdLength || DEFAULT_RULES.room.roomIdLength);
    attempts += 1;
    if (attempts > 20) throw new Error("无法生成可用房间码。");
  }
  const room = createInitialOnlineRoom(roomId, { ...options, backendMode: settings.backendMode });
  if (shouldUseRemoteEndpoint(options)) {
    const result = await sendOnlineEndpointRequest("createRoom", {
      roomId,
      playerId: room.players.left.playerId,
      side: "left",
      payload: { room }
    }, { ...options, ...settings });
    const snapshot = snapshotFromEndpointResult(result, "left") || buildOnlineRoomSnapshot(room, "left");
    rememberActiveRoom(snapshot.roomId, snapshot.players?.left?.playerId || room.players.left.playerId, "left", settings);
    return snapshot;
  }
  const saved = writeStoredRoom(room);
  rememberActiveRoom(saved.roomId, saved.players.left.playerId, "left", settings);
  return buildOnlineRoomSnapshot(saved, "left");
}

async function joinOnlineRoom(roomId, options = {}) {
  const settings = getOnlineBackendSettings(options);
  if (shouldUseRemoteEndpoint(options)) {
    const normalizedRoomId = normalizeOnlineRoomId(roomId);
    const playerId = options.playerId || getOrCreateOnlinePlayerId();
    const player = createOnlinePlayer("right", { ...options, playerId });
    const result = await sendOnlineEndpointRequest("joinRoom", {
      roomId: normalizedRoomId,
      playerId,
      payload: { player }
    }, { ...options, ...settings });
    const snapshot = snapshotFromEndpointResult(result, result.side || "right");
    if (!snapshot) throw new Error("共享后端没有返回房间状态。");
    const side = result.side || getOnlinePlayerSide(snapshot, playerId) || "right";
    rememberActiveRoom(snapshot.roomId, playerId, side, settings);
    return buildOnlineRoomSnapshot(snapshot, side);
  }
  const room = ensureRoomExists(roomId);
  const playerId = options.playerId || getOrCreateOnlinePlayerId();
  const existingSide = getOnlinePlayerSide(room, playerId);
  if (existingSide) {
    room.players[existingSide] = {
      ...room.players[existingSide],
      connected: true,
      lastSeenAt: nowMs()
    };
    room.updatedAt = nowMs();
    writeStoredRoom(room);
    rememberActiveRoom(room.roomId, playerId, existingSide, settings);
    return buildOnlineRoomSnapshot(room, existingSide);
  }
  if (room.players?.right?.playerId) {
    throw new Error("房间已满。");
  }
  room.players.right = createOnlinePlayer("right", { ...options, playerId });
  startOnlineBattle(room);
  room.updatedAt = nowMs();
  room.logs = (room.logs || []).concat({
    at: room.updatedAt,
    type: "player_joined",
    message: "第二名玩家已加入房间。"
  }).slice(-80);
  writeStoredRoom(room);
  rememberActiveRoom(room.roomId, playerId, "right", settings);
  return buildOnlineRoomSnapshot(room, "right");
}

function leaveOnlineRoom(roomId, sideOrOptions = {}) {
  const options = typeof sideOrOptions === "string" ? { side: sideOrOptions } : sideOrOptions;
  if (shouldUseRemoteEndpoint(options)) {
    const side = options.side || uiState.side || "";
    const playerId = options.playerId || uiState.playerId || "";
    return sendOnlineEndpointRequest("leaveRoom", {
      roomId,
      playerId,
      side,
      payload: { side }
    }, { ...getOnlineBackendSettings(options), ...options }).then((result) => {
      clearActiveRoom();
      stopOnlinePolling();
      return {};
    });
  }
  const room = ensureRoomExists(roomId);
  const side = getOnlinePlayerSide(room, options.playerId || uiState.playerId) || normalizeOnlineSide(options.side);
  if (room.players?.[side]) {
    room.players[side].connected = false;
    room.players[side].locked = false;
    room.players[side].lastSeenAt = nowMs();
  }
  room.publicLocks[side] = false;
  room.status = "ended";
  room.updatedAt = nowMs();
  room.logs = (room.logs || []).concat({
    at: room.updatedAt,
    type: "player_left",
    message: `${side === "left" ? "左方" : "右方"}已离开房间。`
  }).slice(-80);
  writeStoredRoom(room);
  clearActiveRoom();
  stopOnlinePolling();
  return {};
}

function kickOnlinePlayer(roomId, targetSide = "right", options = {}) {
  const normalizedTarget = normalizeOnlineSide(targetSide);
  if (normalizedTarget === "left") throw new Error("不能踢出房主座位。");
  if (shouldUseRemoteEndpoint(options)) {
    return sendOnlineEndpointRequest("kickPlayer", {
      roomId,
      playerId: options.playerId || uiState.playerId,
      side: options.side || uiState.side || "left",
      payload: { targetSide: normalizedTarget }
    }, { ...options, ...getOnlineBackendSettings(options) }).then((result) => snapshotFromEndpointResult(result, options.side || uiState.side || "left"));
  }
  const room = ensureRoomExists(roomId);
  const requesterId = options.playerId || uiState.playerId;
  const requesterSide = getOnlinePlayerSide(room, requesterId) || normalizeOnlineSide(options.side);
  if (requesterSide !== "left" && room.ownerPlayerId !== requesterId) throw new Error("只有房主可以踢出玩家。");
  if (!room.players?.[normalizedTarget]?.playerId) throw new Error("该座位没有可踢出的玩家。");
  room.players[normalizedTarget] = createEmptyPlayer(normalizedTarget);
  room.pendingActions[normalizedTarget] = [];
  room.publicLocks[normalizedTarget] = false;
  room.battleState = {};
  room.status = "waiting";
  room.updatedAt = nowMs();
  room.logs = (room.logs || []).concat({
    at: room.updatedAt,
    type: "player_kicked",
    side: normalizedTarget,
    message: `${normalizedTarget === "right" ? "右方" : "左方"}玩家已被房主移出房间。`
  }).slice(-80);
  writeStoredRoom(room);
  return buildOnlineRoomSnapshot(room, requesterSide || "left");
}

function getOnlineRoomState(roomId, options = {}) {
  if (shouldUseRemoteEndpoint(options)) {
    const settings = getOnlineBackendSettings(options);
    return sendOnlineEndpointRequest("getRoom", {
      roomId,
      playerId: options.playerId || uiState.playerId,
      side: options.viewerSide || options.side || uiState.side
    }, { ...options, ...settings }).then((result) => {
      const viewerSide = result.side || options.viewerSide || options.side || uiState.side || "";
      const snapshot = snapshotFromEndpointResult(result, viewerSide);
      if (!snapshot) throw new Error("房间不存在。");
      return snapshot;
    });
  }
  const room = ensureRoomExists(roomId);
  const viewerSide = options.viewerSide || getOnlinePlayerSide(room, options.playerId || uiState.playerId) || options.side || "";
  return buildOnlineRoomSnapshot(room, viewerSide);
}

function submitOnlineHandActions(roomId, side, actions, options = {}) {
  if (shouldUseRemoteEndpoint(options)) {
    const normalizedSide = normalizeOnlineSide(side);
    return sendOnlineEndpointRequest("submitActions", {
      roomId,
      playerId: options.playerId || uiState.playerId,
      side: normalizedSide,
      payload: { actions: normalizeOnlineActionList(actions) }
    }, { ...options, ...getOnlineBackendSettings(options) }).then((result) => {
      return snapshotFromEndpointResult(result, normalizedSide);
    });
  }
  const room = ensureRoomExists(roomId);
  const normalizedSide = normalizeOnlineSide(side);
  if (room.status === "ended") throw new Error("房间已结束。");
  if (room.status !== "battle") throw new Error("双方角色尚未确定，不能选择手札。");
  if (!room.players?.[normalizedSide]?.playerId) throw new Error("当前座位没有玩家。");
  if (room.publicLocks?.[normalizedSide] && !options.allowLockedReplace) throw new Error("你已经锁定行动。");
  room.pendingActions[normalizedSide] = normalizeOnlineActionList(actions);
  room.updatedAt = nowMs();
  writeStoredRoom(room);
  return buildOnlineRoomSnapshot(room, normalizedSide);
}

function lockOnlineTurn(roomId, side, actions = null, options = {}) {
  if (shouldUseRemoteEndpoint(options)) {
    const normalizedSide = normalizeOnlineSide(side);
    return sendOnlineEndpointRequest("lockTurn", {
      roomId,
      playerId: options.playerId || uiState.playerId,
      side: normalizedSide,
      payload: { actions: actions ? normalizeOnlineActionList(actions) : null }
    }, { ...options, ...getOnlineBackendSettings(options) }).then((result) => {
      return snapshotFromEndpointResult(result, normalizedSide);
    });
  }
  const room = ensureRoomExists(roomId);
  const normalizedSide = normalizeOnlineSide(side);
  if (room.status === "ended") throw new Error("房间已结束。");
  if (room.status !== "battle") throw new Error("双方角色尚未确定，不能锁定行动。");
  if (!room.players?.[normalizedSide]?.playerId) throw new Error("当前座位没有玩家。");
  if (room.publicLocks?.[normalizedSide]) throw new Error("你已经锁定行动。");
  if (actions) room.pendingActions[normalizedSide] = normalizeOnlineActionList(actions);
  room.players[normalizedSide].locked = true;
  room.players[normalizedSide].lastSeenAt = nowMs();
  room.publicLocks[normalizedSide] = true;
  room.status = "battle";
  room.updatedAt = nowMs();
  room.logs = (room.logs || []).concat({
    at: room.updatedAt,
    type: "turn_locked",
    side: normalizedSide,
    message: `${normalizedSide === "left" ? "左方" : "右方"}已锁定第 ${room.turn} 回合行动。`
  }).slice(-80);
  writeStoredRoom(room);
  return buildOnlineRoomSnapshot(room, normalizedSide);
}

function unlockOnlineTurn(roomId, side, options = {}) {
  if (shouldUseRemoteEndpoint(options)) {
    const normalizedSide = normalizeOnlineSide(side);
    return sendOnlineEndpointRequest("unlockTurn", {
      roomId,
      playerId: options.playerId || uiState.playerId,
      side: normalizedSide
    }, { ...options, ...getOnlineBackendSettings(options) }).then((result) => snapshotFromEndpointResult(result, normalizedSide));
  }
  const room = ensureRoomExists(roomId);
  const normalizedSide = normalizeOnlineSide(side);
  if (room.status === "ended") throw new Error("房间已结束。");
  if (room.status !== "battle") throw new Error("双方角色尚未确定，不能取消锁定。");
  if (canResolveOnlineTurn(room)) throw new Error("双方已锁定，正在等待结算。");
  room.players[normalizedSide].locked = false;
  room.publicLocks[normalizedSide] = false;
  room.updatedAt = nowMs();
  room.status = "battle";
  writeStoredRoom(room);
  return buildOnlineRoomSnapshot(room, normalizedSide);
}

function canResolveOnlineTurn(roomOrId) {
  const room = typeof roomOrId === "string" ? readStoredRoom(roomOrId) : roomOrId;
  return Boolean(room?.status === "battle" && room?.publicLocks?.left && room?.publicLocks?.right && room?.players?.left?.playerId && room?.players?.right?.playerId);
}

function applyOnlineTurnActionsToBattleState(battleState, roomState, options = {}) {
  const adapter = options.fightAdapter ||
    options.adapter ||
    globalThis.JJKOnlineFightAdapter ||
    globalThis.JJKDuelOnlineAdapter;
  if (adapter && typeof adapter.applyOnlineTurnActionsToBattleState === "function") {
    return adapter.applyOnlineTurnActionsToBattleState(battleState, buildOnlineRoomSnapshot(roomState), options);
  }
  if (adapter && typeof adapter.resolveTurn === "function") {
    return adapter.resolveTurn(battleState, {
      left: normalizeOnlineActionList(roomState?.pendingActions?.left),
      right: normalizeOnlineActionList(roomState?.pendingActions?.right),
      turn: roomState?.turn
    });
  }
  return cloneJson(battleState || {});
}

function resolveOnlineTurnWithExistingFightEngine(roomState, options = {}) {
  const battleState = applyOnlineTurnActionsToBattleState(roomState?.battleState || {}, roomState, options);
  return {
    battleState: redactOnlineSecrets(battleState || {}),
    endReason: battleState?.endReason || battleState?.result?.endReason || "",
    battleEnded: Boolean(battleState?.ended || battleState?.battleEnded || battleState?.resolved)
  };
}

function resolveOnlineTurn(roomId, options = {}) {
  if (shouldUseRemoteEndpoint(options)) {
    const settings = getOnlineBackendSettings(options);
    return sendOnlineEndpointRequest("getRoom", {
      roomId,
      playerId: options.playerId || uiState.playerId,
      side: options.viewerSide || options.side || uiState.side
    }, { ...options, ...settings }).then((result) => {
      const room = result.room || result.snapshot;
      if (!room) throw new Error("房间不存在。");
      normalizeOnlineRoomLifecycle(room);
      if (!canResolveOnlineTurn(room)) throw new Error("双方尚未都锁定行动，不能结算。");
      const working = cloneJson(room);
      const resolved = resolveOnlineTurnWithExistingFightEngine(working, options);
      working.battleState = redactOnlineSecrets(resolved.battleState || working.battleState || {});
      working.lastResolvedTurn = working.turn;
      working.turn += 1;
      working.pendingActions = { left: [], right: [] };
      working.publicLocks = { left: false, right: false };
      if (working.players?.left) working.players.left.locked = false;
      if (working.players?.right) working.players.right.locked = false;
      working.status = resolved.battleEnded || options.endReason ? "ended" : "battle";
      working.updatedAt = nowMs();
      if (working.status === "battle") startOnlineBattle(working);
      working.logs = (working.logs || []).concat({
        at: working.updatedAt,
        type: "turn_resolved",
        turn: working.lastResolvedTurn,
        message: `第 ${working.lastResolvedTurn} 回合同步结算完成。`
      }).slice(-80);
      return sendOnlineEndpointRequest("resolveTurn", {
        roomId,
        playerId: options.playerId || uiState.playerId,
        side: options.viewerSide || options.side || uiState.side,
        payload: { room: working }
      }, { ...options, ...settings });
    }).then((result) => snapshotFromEndpointResult(result, options.viewerSide || uiState.side || "left"));
  }
  const room = ensureRoomExists(roomId);
  if (!canResolveOnlineTurn(room)) throw new Error("双方尚未都锁定行动，不能结算。");
  const resolved = resolveOnlineTurnWithExistingFightEngine(room, options);
  room.battleState = redactOnlineSecrets(resolved.battleState || room.battleState || {});
  room.lastResolvedTurn = room.turn;
  room.turn += 1;
  room.pendingActions = { left: [], right: [] };
  room.publicLocks = { left: false, right: false };
  room.players.left.locked = false;
  room.players.right.locked = false;
  room.status = resolved.battleEnded || options.endReason ? "ended" : "battle";
  room.updatedAt = nowMs();
  if (room.status === "battle") startOnlineBattle(room);
  room.logs = (room.logs || []).concat({
    at: room.updatedAt,
    type: "turn_resolved",
    turn: room.lastResolvedTurn,
    message: `第 ${room.lastResolvedTurn} 回合同步结算完成。`
  }).slice(-80);
  writeStoredRoom(room);
  return buildOnlineRoomSnapshot(room, options.viewerSide || uiState.side || "left");
}

function syncOnlineBattleState(roomId, battleState, options = {}) {
  if (shouldUseRemoteEndpoint(options)) {
    const side = options.viewerSide || options.side || uiState.side || "";
    return sendOnlineEndpointRequest("syncBattleState", {
      roomId,
      playerId: options.playerId || uiState.playerId,
      side,
      payload: { battleState: redactOnlineSecrets(battleState || {}) }
    }, { ...options, ...getOnlineBackendSettings(options) }).then((result) => snapshotFromEndpointResult(result, side));
  }
  const room = ensureRoomExists(roomId);
  room.battleState = redactOnlineSecrets(battleState || {});
  if (room.status !== "ended" && hasBothOnlineCharacters(room)) room.status = "battle";
  room.updatedAt = nowMs();
  writeStoredRoom(room);
  return buildOnlineRoomSnapshot(room, options.viewerSide || uiState.side || "left");
}

function buildOnlineRoomSnapshot(room, viewerSide = "") {
  const snapshot = redactOnlineSecrets(cloneJson(normalizeOnlineRoomLifecycle(room) || {}));
  const side = viewerSide ? normalizeOnlineSide(viewerSide) : "";
  const bothLocked = Boolean(snapshot?.publicLocks?.left && snapshot?.publicLocks?.right);
  if (snapshot?.pendingActions && side && !bothLocked) {
    const opponentSide = getOnlineOpponentSide(side);
    snapshot.pendingActions[opponentSide] = [];
    snapshot.pendingActionCounts = {
      left: room?.pendingActions?.left?.length || 0,
      right: room?.pendingActions?.right?.length || 0
    };
  }
  return snapshot;
}

function buildOnlineInviteLink(roomId, baseHref = "") {
  const normalized = normalizeOnlineRoomId(roomId);
  const href = baseHref || globalThis.location?.href || "http://localhost/index.html";
  const url = new URL(href, "http://localhost");
  url.searchParams.set("onlineRoom", normalized);
  url.searchParams.delete("onlineBackend");
  url.searchParams.delete("playerId");
  url.searchParams.delete("apiKey");
  url.searchParams.delete("api_key");
  url.searchParams.delete("authorization");
  url.searchParams.delete("token");
  url.searchParams.delete("secret");
  url.searchParams.delete("onlineEndpoint");
  url.searchParams.delete("endpoint");
  url.searchParams.delete("proxyEndpoint");
  return url.href;
}

function parseOnlineInviteLink(input = "") {
  const href = input || globalThis.location?.href || "";
  try {
    const url = new URL(href, globalThis.location?.origin || "http://localhost");
    const fromSearch = normalizeOnlineRoomId(url.searchParams.get("onlineRoom"));
    if (fromSearch) return fromSearch;
    const hashMatch = url.hash.match(/online=([A-Za-z0-9]+)/);
    return normalizeOnlineRoomId(hashMatch?.[1] || "");
  } catch (error) {
    const match = String(href).match(/(?:onlineRoom=|online=)([A-Za-z0-9]+)/);
    return normalizeOnlineRoomId(match?.[1] || "");
  }
}

function pollOnlineRoomState(roomId, options = {}) {
  const intervalMs = Math.max(500, Number(options.pollIntervalMs) || DEFAULT_RULES.sync.pollIntervalMs);
  let stopped = false;
  let timer = null;
  const tick = async () => {
    if (stopped) return;
    try {
      const snapshot = await getOnlineRoomState(roomId, options);
      options.onState?.(snapshot);
      if (snapshot.status === "ended") {
        stopped = true;
        return;
      }
    } catch (error) {
      options.onError?.(error);
    }
    const hidden = typeof document !== "undefined" && document.hidden;
    timer = setTimeout(tick, hidden ? intervalMs * 3 : intervalMs);
  };
  timer = setTimeout(tick, 0);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

function stopOnlinePolling() {
  if (activePollingStop) activePollingStop();
  activePollingStop = null;
}

function isOnlinePollingActive() {
  return Boolean(activePollingStop);
}

function getOnlineUiState() {
  return { ...uiState, onlineMode: Boolean(uiState.roomId) };
}

function rememberActiveRoom(roomId, playerId, side, settings = {}) {
  const backend = getOnlineBackendSettings(settings);
  uiState = { roomId, playerId, side, backendMode: backend.backendMode, endpoint: backend.endpoint };
  const storage = getSessionStorage();
  storage?.setItem?.(ACTIVE_ROOM_STORAGE_KEY, JSON.stringify(uiState));
}

function clearActiveRoom() {
  uiState = {
    roomId: "",
    playerId: uiState.playerId || "",
    side: "",
    backendMode: uiState.backendMode || "",
    endpoint: uiState.endpoint || ""
  };
  getSessionStorage()?.removeItem?.(ACTIVE_ROOM_STORAGE_KEY);
}

function restoreActiveRoom() {
  const storage = getSessionStorage();
  const raw = storage?.getItem?.(ACTIVE_ROOM_STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.roomId) uiState = { ...uiState, ...parsed };
  } catch (error) {
    storage?.removeItem?.(ACTIVE_ROOM_STORAGE_KEY);
  }
}

function getUiElements() {
  if (typeof document === "undefined") return null;
  return {
    panel: document.querySelector("#onlineAlphaPanel"),
    create: document.querySelector("#onlineCreateRoomBtn"),
    join: document.querySelector("#onlineJoinRoomBtn"),
    backendMode: document.querySelector("#onlineBackendMode"),
    modeLabel: document.querySelector("#onlineModeLabel"),
    officialStatus: document.querySelector("#onlineOfficialStatus"),
    officialTest: document.querySelector("#onlineOfficialTestBtn"),
    advancedSettings: document.querySelector("#onlineAdvancedBackendSettings"),
    endpoint: document.querySelector("#onlineEndpointInput"),
    endpointField: document.querySelector("#onlineEndpointField"),
    backendActions: document.querySelector("#onlineBackendActions"),
    saveBackend: document.querySelector("#onlineSaveBackendBtn"),
    testBackend: document.querySelector("#onlineTestBackendBtn"),
    clearBackend: document.querySelector("#onlineClearBackendBtn"),
    backendHint: document.querySelector("#onlineBackendHint"),
    joinRoomInput: document.querySelector("#onlineJoinRoomCodeInput"),
    roomCode: document.querySelector("#onlineRoomCode"),
    currentRoomCode: document.querySelector("#onlineCurrentRoomCode"),
    copyRoomCode: document.querySelector("#onlineCopyRoomCodeBtn"),
    inviteLink: document.querySelector("#onlineInviteLink"),
    copyInvite: document.querySelector("#onlineCopyInviteBtn"),
    createCharacter: document.querySelector("#onlineCreateCharacterSelect"),
    joinCharacter: document.querySelector("#onlineJoinCharacterSelect"),
    playerSide: document.querySelector("#onlinePlayerSide"),
    opponentStatus: document.querySelector("#onlineOpponentStatus"),
    turnLabel: document.querySelector("#onlineTurnLabel"),
    localLock: document.querySelector("#onlineLocalLockStatus"),
    opponentLock: document.querySelector("#onlineOpponentLockStatus"),
    leftPlayer: document.querySelector("#onlineLeftPlayerLabel"),
    rightPlayer: document.querySelector("#onlineRightPlayerLabel"),
    leftCharacter: document.querySelector("#onlineLeftCharacterLabel"),
    rightCharacter: document.querySelector("#onlineRightCharacterLabel"),
    leftResource: document.querySelector("#onlineLeftResourceLabel"),
    rightResource: document.querySelector("#onlineRightResourceLabel"),
    syncStatus: document.querySelector("#onlineSyncStatus"),
    nextStep: document.querySelector("#onlineNextStepHint"),
    lock: document.querySelector("#onlineLockTurnBtn"),
    unlock: document.querySelector("#onlineUnlockTurnBtn"),
    resolve: document.querySelector("#onlineResolveTurnBtn"),
    kickRight: document.querySelector("#onlineKickRightPlayerBtn"),
    leave: document.querySelector("#onlineLeaveRoomBtn")
  };
}

function getOnlineCharacterCards() {
  const characterApi = globalThis.JJKCharacter;
  if (typeof characterApi?.getDuelCharacterCards === "function") {
    try {
      return characterApi.getDuelCharacterCards() || [];
    } catch (error) {
      return [];
    }
  }
  if (typeof globalThis.getDuelCharacterCards === "function") {
    try {
      return globalThis.getDuelCharacterCards() || [];
    } catch (error) {
      return [];
    }
  }
  return [];
}

function getOnlineCharacterOptionLabel(card) {
  const name = String(card?.displayName || card?.name || card?.characterId || card?.id || "未命名角色").trim();
  const grade = String(card?.officialGrade || card?.visibleGrade || card?.powerTier || "").trim();
  const custom = card?.customDuel ? "自定义" : "官方";
  return [name, grade, custom].filter(Boolean).join(" · ");
}

function buildOnlineCharacterOptions(cards = []) {
  return cards
    .filter((card) => card?.characterId || card?.id)
    .map((card) => {
      const id = String(card.characterId || card.id || "").slice(0, 120);
      return `<option value="${escapeHtml(id)}">${escapeHtml(getOnlineCharacterOptionLabel(card))}</option>`;
    })
    .join("");
}

function getSelectedOnlineCharacterId(side) {
  if (typeof document === "undefined") return "";
  syncOnlineCharacterSelects();
  const onlineSelector = side === "right" ? "#onlineJoinCharacterSelect" : "#onlineCreateCharacterSelect";
  const onlineValue = String(document.querySelector(onlineSelector)?.value || "").slice(0, 80);
  if (onlineValue) return onlineValue;
  const selector = side === "right" ? "#duelRightSelect" : "#duelLeftSelect";
  return String(document.querySelector(selector)?.value || "").slice(0, 80);
}

function syncOnlineCharacterSelects(els = getUiElements()) {
  if (typeof document === "undefined") return;
  const cards = getOnlineCharacterCards();
  const options = buildOnlineCharacterOptions(cards);
  const leftFallback = String(document.querySelector("#duelLeftSelect")?.value || cards[0]?.characterId || cards[0]?.id || "");
  const rightFallback = String(document.querySelector("#duelRightSelect")?.value || cards[1]?.characterId || cards[1]?.id || leftFallback || "");
  const syncOne = (target, fallback) => {
    if (!target) return;
    const current = target.value || fallback || "";
    if (target.dataset.optionSignature !== options) {
      target.innerHTML = options || `<option value="">暂无可用角色</option>`;
      target.dataset.optionSignature = options;
    }
    if (current && [...target.options].some((option) => option.value === current)) {
      target.value = current;
    } else if (target.options.length) {
      target.value = target.options[0].value || "";
    }
  };
  syncOne(els?.createCharacter, leftFallback);
  syncOne(els?.joinCharacter, rightFallback);
}

function getOnlineCharacterName(characterId) {
  const id = String(characterId || "");
  const card = getOnlineCharacterCards().find((item) => item?.characterId === id || item?.id === id);
  if (card) return String(card.displayName || card.name || id);
  if (typeof document !== "undefined") {
    const option = [...document.querySelectorAll("#onlineCreateCharacterSelect option, #onlineJoinCharacterSelect option, #duelLeftSelect option, #duelRightSelect option")]
      .find((item) => item.value === id);
    if (option?.textContent?.trim()) return option.textContent.trim();
  }
  return id || "等待选择";
}

function getOnlineResourceText(snapshot, side) {
  const resource = side === "right"
    ? snapshot?.battleState?.resourceState?.p2
    : snapshot?.battleState?.resourceState?.p1;
  if (!resource) return "HP / CE / AP：等待战斗";
  const ap = resource.ap?.current ?? resource.ap ?? "-";
  return `HP ${Math.round(Number(resource.hp ?? 0))} / CE ${Math.round(Number(resource.ce ?? 0))} / AP ${ap}`;
}

function emitOnlineRoomState(snapshot) {
  if (typeof document === "undefined") return;
  document.dispatchEvent(new CustomEvent("jjk-online-room-state", {
    detail: {
      snapshot: snapshot || {},
      roomId: snapshot?.roomId || "",
      side: uiState.side || getOnlinePlayerSide(snapshot, uiState.playerId) || ""
    }
  }));
}

function setText(element, text) {
  if (element) element.textContent = text;
}

function setInputValue(element, value) {
  if (element) {
    element.value = value;
    element.setAttribute("value", value);
  }
}

function readSelectedHandActionSummariesFromDom() {
  if (typeof document === "undefined") return [];
  return [...document.querySelectorAll(".duel-hand-card.active .duel-action-choice[data-duel-action]")]
    .map((button, index) => normalizeOnlineActionSummary({
      actionId: button.getAttribute("data-duel-action"),
      displayName: button.querySelector(".duel-card-name")?.textContent ||
        button.querySelector("strong")?.textContent ||
        button.textContent?.trim()?.split(/\s+/).slice(0, 4).join(" ") ||
        `手札 ${index + 1}`
    }, index));
}

function getOnlineModeLabel(mode) {
  const normalized = normalizeOnlineBackendMode(mode);
  if (normalized === "local_mock_backend") return "本地 mock（开发/双标签测试）";
  if (normalized === "custom_endpoint") return "自定义 Endpoint（高级）";
  return "官方联机服务器";
}

async function getOnlineBackendHint(mode) {
  const normalized = normalizeOnlineBackendMode(mode);
  if (normalized === "custom_endpoint") {
    return "自定义 Endpoint：双方必须使用同一个 Endpoint，否则会显示房间不存在；请自行处理 CORS。";
  }
  if (normalized === "local_mock_backend") {
    return "本地 mock：只适合同一浏览器或双标签页测试。跨设备联机请使用官方联机服务器或自定义 Endpoint。";
  }
  const endpoint = await getOfficialOnlineEndpoint();
  return isOfficialEndpointConfigured(endpoint)
    ? "官方联机服务器：普通玩家不需要填写 Endpoint；当前主线路为 Cloudflare Workers，国内网络如出现 Failed to fetch，请使用高级设置里的国内可访问自定义 Endpoint，或等待站长配置国内镜像。"
    : "官方联机服务器尚未配置。请站长部署 Worker 后填写，或切换到本地 mock / 自定义 Endpoint。";
}

async function renderOnlineBackendControls(settings, els = getUiElements()) {
  if (!els?.panel) return;
  const mode = normalizeOnlineBackendMode(settings?.backendMode);
  setInputValue(els.backendMode, mode);
  setInputValue(els.endpoint, settings?.endpoint || "");
  setText(els.modeLabel, getOnlineModeLabel(mode));
  const isCustomEndpoint = mode === "custom_endpoint";
  const isOfficial = mode === "official_endpoint";
  if (els.endpointField) els.endpointField.hidden = !isCustomEndpoint;
  if (els.backendActions) els.backendActions.hidden = mode === "official_endpoint";
  setText(els.backendHint, await getOnlineBackendHint(mode));
  if (els.officialStatus) {
    if (!isOfficial) {
      setText(els.officialStatus, mode === "local_mock_backend"
        ? "当前使用本地 mock，不能跨设备。"
        : "当前使用自定义 Endpoint；双方必须配置同一个地址。");
    } else {
      const endpoint = await getOfficialOnlineEndpoint();
      setText(els.officialStatus, isOfficialEndpointConfigured(endpoint)
        ? "官方联机服务器：已配置，可测试连接；国内网络可能需要镜像线路。"
        : "官方联机服务器尚未配置。请站长部署后端，或在高级设置切换到本地 mock / 自定义 Endpoint。");
    }
  }
  if (els.officialTest) els.officialTest.hidden = !isOfficial;
}

function getOnlineOpponentStatus(snapshot, side) {
  if (!snapshot?.roomId) return "未加入";
  const opponentSide = getOnlineOpponentSide(side);
  const opponent = snapshot.players?.[opponentSide];
  if (!opponent?.playerId) return "未加入";
  if (!opponent.connected) return "离线";
  if (snapshot.publicLocks?.[opponentSide]) return "已锁定";
  return snapshot.pendingActionCounts?.[opponentSide] || snapshot.pendingActions?.[opponentSide]?.length ? "选择中" : "已加入";
}

function getOnlineNextStepHint(snapshot, side, selectedActionCount) {
  if (!snapshot?.roomId) return "下一步：创建房间，或输入房间码加入对局。";
  if (snapshot.status === "ended") return "战斗已结束。";
  const opponentSide = getOnlineOpponentSide(side);
  if (!snapshot.players?.[opponentSide]?.playerId) return "等待对手加入。";
  if (snapshot.status === "ready") return "双方已入座，等待角色确认。";
  if (snapshot.status !== "battle") return "等待进入联机战斗。";
  if (snapshot.publicLocks?.left && snapshot.publicLocks?.right) return "双方已锁定，正在自动结算本回合。";
  if (snapshot.publicLocks?.[side]) return "已锁定，等待对手。";
  if (!selectedActionCount) return "下一步：先在手札区选择本回合行动。";
  return "下一步：点击锁定行动。";
}

function renderOnlineRoomUi(snapshot) {
  const els = getUiElements();
  if (!els?.panel) return;
  syncOnlineCharacterSelects(els);
  const hasRoom = Boolean(snapshot?.roomId);
  const side = hasRoom ? (uiState.side || getOnlinePlayerSide(snapshot, uiState.playerId) || "left") : "";
  const opponentSide = getOnlineOpponentSide(side);
  const opponent = snapshot.players?.[opponentSide];
  const selectedActionCount = readSelectedHandActionSummariesFromDom().length;
  setText(els.roomCode, snapshot.roomId || "未创建");
  setText(els.currentRoomCode, snapshot.roomId || "未创建");
  setText(els.playerSide, side === "left" ? "左方" : side === "right" ? "右方" : "未加入");
  setText(els.opponentStatus, getOnlineOpponentStatus(snapshot, side || "left"));
  setText(els.turnLabel, snapshot.turn ? `第 ${snapshot.turn} 回合` : "未开始");
  setText(els.localLock, snapshot.publicLocks?.[side] ? "已锁定" : "未锁定");
  setText(els.opponentLock, snapshot.publicLocks?.[opponentSide] ? "已锁定" : "未锁定");
  setText(els.leftPlayer, snapshot.players?.left?.playerId ? (side === "left" ? "你（左方）" : "对手（左方）") : "等待玩家");
  setText(els.rightPlayer, snapshot.players?.right?.playerId ? (side === "right" ? "你（右方）" : "对手（右方）") : "等待玩家");
  setText(els.leftCharacter, `角色：${getOnlineCharacterName(snapshot.players?.left?.characterId)}`);
  setText(els.rightCharacter, `角色：${getOnlineCharacterName(snapshot.players?.right?.characterId)}`);
  setText(els.leftResource, getOnlineResourceText(snapshot, "left"));
  setText(els.rightResource, getOnlineResourceText(snapshot, "right"));
  els.leftPlayer?.closest?.("article")?.setAttribute("data-you", side === "left" ? "true" : "false");
  els.rightPlayer?.closest?.("article")?.setAttribute("data-you", side === "right" ? "true" : "false");
  setText(els.syncStatus, statusText(snapshot));
  setText(els.nextStep, getOnlineNextStepHint(snapshot, side || "left", selectedActionCount));
  const settings = getOnlineBackendSettings();
  renderOnlineBackendControls(settings, els);
  setInputValue(els.inviteLink, snapshot.roomId ? buildOnlineInviteLink(snapshot.roomId) : "");
  if (els.copyRoomCode) els.copyRoomCode.disabled = !snapshot.roomId;
  if (els.copyInvite) els.copyInvite.disabled = !snapshot.roomId;
  if (els.lock) {
    const opponentJoined = Boolean(snapshot.players?.[opponentSide]?.playerId);
    const battleReady = snapshot.status === "battle";
    els.lock.disabled = !snapshot.roomId || !opponentJoined || !battleReady || !selectedActionCount || snapshot.publicLocks?.[side] || snapshot.status === "ended";
    els.lock.textContent = !snapshot.roomId
      ? "请先创建或加入房间"
      : !opponentJoined
        ? "等待对手加入"
        : snapshot.status === "ended"
          ? "战斗已结束"
          : !battleReady
            ? "等待角色确认"
            : snapshot.publicLocks?.[side]
              ? "已锁定，等待对手"
              : !selectedActionCount
                ? "请先选择手札"
                : "锁定行动";
  }
  if (els.unlock) els.unlock.disabled = !snapshot.roomId || !snapshot.publicLocks?.[side] || canResolveOnlineTurn(snapshot);
  if (els.resolve) {
    const opponentJoined = Boolean(snapshot.players?.[opponentSide]?.playerId);
    const ready = canResolveOnlineTurn(snapshot);
    els.resolve.disabled = true;
    els.resolve.textContent = snapshot.status === "ended"
      ? "战斗已结束"
      : !snapshot.roomId
        ? "等待房间"
        : !opponentJoined
          ? "等待对手加入"
          : ready
            ? "双方锁定，自动结算中"
            : "等待双方锁定";
    els.resolve.classList.toggle("is-ready", ready);
  }
  if (els.kickRight) {
    const canKickRight = Boolean(snapshot.roomId && side === "left" && snapshot.players?.right?.playerId && snapshot.status !== "ended");
    els.kickRight.disabled = !canKickRight;
    els.kickRight.hidden = !snapshot.roomId || side !== "left";
  }
  if (els.leave) els.leave.disabled = !snapshot.roomId;
  emitOnlineRoomState(snapshot);
}

async function autoResolveOnlineTurnIfReady(snapshot, reason = "") {
  if (!canResolveOnlineTurn(snapshot)) return snapshot;
  const roomId = normalizeOnlineRoomId(snapshot.roomId);
  const key = `${roomId}:${snapshot.turn || 0}`;
  if (!roomId || autoResolveInFlight.has(key)) return snapshot;
  autoResolveInFlight.add(key);
  try {
    const resolved = await resolveOnlineTurn(roomId, { ...getOnlineBackendSettings(), viewerSide: uiState.side || "left", autoReason: reason });
    renderOnlineRoomUi(resolved);
    return resolved;
  } catch (error) {
    showOnlineError(error);
    return snapshot;
  } finally {
    autoResolveInFlight.delete(key);
  }
}

function handleOnlineSnapshot(snapshot, reason = "") {
  renderOnlineRoomUi(snapshot);
  autoResolveOnlineTurnIfReady(snapshot, reason);
}

function statusText(snapshot) {
  if (!snapshot?.roomId) return "未加入房间。";
  if (snapshot.status === "waiting") return "房间已创建，等待对手加入。";
  if (snapshot.status === "ready") return "双方已入座，等待角色确认。";
  if (snapshot.status === "battle") return snapshot.publicLocks?.left && snapshot.publicLocks?.right
    ? "双方已锁定，正在自动结算。"
    : "联机战斗进行中。";
  if (snapshot.status === "ended") return "房间已结束。";
  return "轮询同步中。";
}

function showOnlineError(message) {
  const els = getUiElements();
  setText(els?.syncStatus, message instanceof Error ? message.message : String(message));
}

function startOnlineUiPolling(roomId, side) {
  stopOnlinePolling();
  const settings = getOnlineBackendSettings();
  activePollingStop = pollOnlineRoomState(roomId, {
    ...settings,
    side,
    viewerSide: side,
    pollIntervalMs: DEFAULT_RULES.sync.pollIntervalMs,
    onState: (snapshot) => handleOnlineSnapshot(snapshot, "poll"),
    onError: showOnlineError
  });
}

function refreshOnlineUiFromState() {
  if (!uiState.roomId) {
    renderOnlineRoomUi({});
    return;
  }
  Promise.resolve(getOnlineRoomState(uiState.roomId, { ...getOnlineBackendSettings(), viewerSide: uiState.side }))
    .then(renderOnlineRoomUi)
    .catch(() => {});
}

async function initializeOnlineUi() {
  const els = getUiElements();
  if (!els?.panel || els.panel.dataset.onlineBound === "true") return false;
  els.panel.dataset.onlineBound = "true";
  restoreActiveRoom();
  const invitedRoom = parseOnlineInviteLink();
  if (invitedRoom && els.joinRoomInput) els.joinRoomInput.value = invitedRoom;
  if (globalThis.location?.search && new URLSearchParams(globalThis.location.search).get("onlineBackend") === "custom_endpoint") {
    saveOnlineBackendSettings({ ...getOnlineBackendSettings(), backendMode: "custom_endpoint" });
  }
  const initialSettings = getOnlineBackendSettings();
  renderOnlineBackendControls(initialSettings, els);
  syncOnlineCharacterSelects(els);
  setTimeout(() => syncOnlineCharacterSelects(els), 0);
  setTimeout(() => syncOnlineCharacterSelects(els), 1000);
  document.addEventListener("jjk-battle-page-state", () => syncOnlineCharacterSelects(els));
  document.addEventListener("jjk-duel-character-pool-changed", () => {
    syncOnlineCharacterSelects(els);
    refreshOnlineUiFromState();
  });
  [els.createCharacter, els.joinCharacter].forEach((select) => {
    select?.addEventListener("focus", () => syncOnlineCharacterSelects(els));
  });

  els.backendMode?.addEventListener("change", () => {
    const settings = saveOnlineBackendSettings({
      backendMode: els.backendMode?.value,
      endpoint: els.endpoint?.value
    });
    renderOnlineBackendControls(settings, els);
    setText(els.syncStatus, settings.backendMode === "custom_endpoint"
      ? "已切换到自定义 Endpoint；双方必须使用同一个地址。"
      : settings.backendMode === "local_mock_backend"
        ? "已切换到本地 mock；仅适合同一浏览器或双标签页测试。"
        : "已切换到官方联机服务器；普通玩家不需要填写 Endpoint。");
  });

  els.saveBackend?.addEventListener("click", () => {
    const settings = saveOnlineBackendSettings({
      backendMode: els.backendMode?.value,
      endpoint: els.endpoint?.value
    });
    setText(els.syncStatus, settings.backendMode === "custom_endpoint"
      ? "自定义 Endpoint 已保存。"
      : settings.backendMode === "local_mock_backend"
        ? "已切换到本地 mock 后端。"
        : "已切换到官方联机服务器。");
    renderOnlineRoomUi(uiState.roomId ? { roomId: uiState.roomId } : {});
  });

  els.clearBackend?.addEventListener("click", () => {
    clearOnlineBackendSettings();
    setInputValue(els.backendMode, "official_endpoint");
    setInputValue(els.endpoint, "");
    setText(els.syncStatus, "联机后端设置已清除，当前为官方联机服务器。");
    renderOnlineRoomUi(uiState.roomId ? { roomId: uiState.roomId } : {});
  });

  els.testBackend?.addEventListener("click", async () => {
    try {
      const settings = saveOnlineBackendSettings({
        backendMode: els.backendMode?.value,
        endpoint: els.endpoint?.value
      });
      const result = await testOnlineBackendConnection(settings);
      setText(els.syncStatus, result.message || "连接测试完成。");
    } catch (error) {
      showOnlineError(error);
    }
  });

  els.officialTest?.addEventListener("click", async () => {
    try {
      const settings = saveOnlineBackendSettings({
        backendMode: "official_endpoint",
        endpoint: els.endpoint?.value
      });
      renderOnlineBackendControls(settings, els);
      const result = await testOnlineBackendConnection(settings);
      setText(els.syncStatus, result.message || "官方联机服务器测试完成。");
      setText(els.officialStatus, result.message || "官方联机服务器连接正常。");
    } catch (error) {
      showOnlineError(error);
      setText(els.officialStatus, error instanceof Error ? error.message : String(error));
    }
  });

  els.create?.addEventListener("click", async () => {
    try {
      const settings = saveOnlineBackendSettings({
        backendMode: els.backendMode?.value,
        endpoint: els.endpoint?.value
      });
      syncOnlineCharacterSelects(els);
      const snapshot = await createOnlineRoom({ ...settings, displayName: "玩家 A", characterId: getSelectedOnlineCharacterId("left") });
      renderOnlineRoomUi(snapshot);
      startOnlineUiPolling(snapshot.roomId, "left");
    } catch (error) {
      showOnlineError(error);
    }
  });

  els.join?.addEventListener("click", async () => {
    try {
      const settings = saveOnlineBackendSettings({
        backendMode: els.backendMode?.value,
        endpoint: els.endpoint?.value
      });
      const roomId = normalizeOnlineRoomId(els.joinRoomInput?.value || parseOnlineInviteLink());
      syncOnlineCharacterSelects(els);
      const snapshot = await joinOnlineRoom(roomId, { ...settings, displayName: "玩家 B", characterId: getSelectedOnlineCharacterId("right") || getSelectedOnlineCharacterId("left") });
      renderOnlineRoomUi(snapshot);
      startOnlineUiPolling(snapshot.roomId, uiState.side || "right");
    } catch (error) {
      showOnlineError(error);
    }
  });

  els.copyRoomCode?.addEventListener("click", async () => {
    const roomId = normalizeOnlineRoomId(uiState.roomId || els.currentRoomCode?.textContent || "");
    if (!roomId) {
      setText(els.syncStatus, "当前没有可复制的房间码。");
      return;
    }
    try {
      await navigator.clipboard?.writeText?.(roomId);
      setText(els.syncStatus, "房间码已复制。");
    } catch (error) {
      setText(els.syncStatus, "当前浏览器未允许自动复制，请手动复制房间码。");
    }
  });

  els.copyInvite?.addEventListener("click", async () => {
    const link = els.inviteLink?.value || "";
    try {
      await navigator.clipboard?.writeText?.(link);
      setText(els.syncStatus, "邀请链接已复制。");
    } catch (error) {
      setText(els.syncStatus, "当前浏览器未允许自动复制，请手动复制链接。");
    }
  });

  els.lock?.addEventListener("click", async () => {
    try {
      if (!uiState.roomId || !uiState.side) throw new Error("请先创建或加入房间。");
      const actions = readSelectedHandActionSummariesFromDom();
      const snapshot = await lockOnlineTurn(uiState.roomId, uiState.side, actions, getOnlineBackendSettings());
      renderOnlineRoomUi(snapshot);
      autoResolveOnlineTurnIfReady(snapshot, "lock");
    } catch (error) {
      showOnlineError(error);
    }
  });

  els.unlock?.addEventListener("click", async () => {
    try {
      const snapshot = await unlockOnlineTurn(uiState.roomId, uiState.side, getOnlineBackendSettings());
      renderOnlineRoomUi(snapshot);
    } catch (error) {
      showOnlineError(error);
    }
  });

  els.resolve?.addEventListener("click", async () => {
    setText(els.syncStatus, "双方锁定后会自动结算，无需手动点击。");
  });

  els.kickRight?.addEventListener("click", async () => {
    try {
      const snapshot = await kickOnlinePlayer(uiState.roomId, "right", { ...getOnlineBackendSettings(), playerId: uiState.playerId, side: uiState.side });
      renderOnlineRoomUi(snapshot);
    } catch (error) {
      showOnlineError(error);
    }
  });

  els.leave?.addEventListener("click", async () => {
    try {
      const snapshot = await leaveOnlineRoom(uiState.roomId, { ...getOnlineBackendSettings(), playerId: uiState.playerId, side: uiState.side });
      handleOnlineSnapshot(snapshot, "restore");
    } catch (error) {
      showOnlineError(error);
    }
  });

  document.addEventListener("click", (event) => {
    if (event.target?.closest?.(".duel-action-choice")) {
      queueMicrotask(refreshOnlineUiFromState);
    }
  });

  if (uiState.roomId) {
    try {
      const snapshot = await getOnlineRoomState(uiState.roomId, { ...getOnlineBackendSettings(), viewerSide: uiState.side });
      renderOnlineRoomUi(snapshot);
      startOnlineUiPolling(uiState.roomId, uiState.side);
    } catch (error) {
      clearActiveRoom();
    }
  } else {
    renderOnlineRoomUi({});
  }
  return true;
}

function resetOnlineLocalMockBackend() {
  localMemoryRooms.clear();
  const storage = getBrowserStorage();
  if (storage) {
    const keys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(ROOM_STORAGE_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
  }
  clearActiveRoom();
  stopOnlinePolling();
}

const OnlineModule = {
  namespace: "JJKOnline",
  version: APP_BUILD_VERSION,
  status: "CANDIDATE",
  backendMode: "official_endpoint",
  getOnlineBackendSettings,
  saveOnlineBackendSettings,
  clearOnlineBackendSettings,
  getActiveOnlineBackendMode,
  isOfficialEndpointConfigured,
  getOfficialOnlineEndpoint,
  getOfficialOnlineEndpoints,
  sendOnlineEndpointRequest,
  testOnlineBackendConnection,
  getOnlineRules,
  roomStatusFlow: ONLINE_ROOM_STATUS_FLOW,
  normalizeOnlineRoomStatus,
  startOnlineBattle,
  createOnlineRoom,
  joinOnlineRoom,
  leaveOnlineRoom,
  kickOnlinePlayer,
  getOnlineRoomState,
  pollOnlineRoomState,
  startOnlineUiPolling,
  stopOnlinePolling,
  isOnlinePollingActive,
  getOnlineUiState,
  submitOnlineHandActions,
  lockOnlineTurn,
  unlockOnlineTurn,
  canResolveOnlineTurn,
  resolveOnlineTurn,
  syncOnlineBattleState,
  buildOnlineInviteLink,
  parseOnlineInviteLink,
  getOnlinePlayerSide,
  buildOnlineRoomSnapshot,
  redactOnlineSecrets,
  applyOnlineTurnActionsToBattleState,
  resolveOnlineTurnWithExistingFightEngine,
  initializeOnlineUi,
  resetOnlineLocalMockBackend,
  normalizeOnlineActionSummary,
  normalizeOnlineActionList
};

globalThis.JJKOnline = OnlineModule;

if (typeof document !== "undefined") {
  queueMicrotask(() => initializeOnlineUi());
}

export { OnlineModule };
export default OnlineModule;
