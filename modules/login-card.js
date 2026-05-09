const LOGIN_CARD_SCHEMA = "jjk-login-card";
const LOGIN_CARD_VERSION = 1;
const LOGIN_CARD_TEXT_KEYWORD = "jjk-login-card";
const LOGIN_CARD_SESSION_KEY = "jjk-login-card-session-v1";
const LOGIN_CARD_MAX_CHARACTERS = 15;
const ADMIN_LOGIN_PASSWORD = "VOCALOIDKagamineMegurineLukaHatsuneMiku0831";
const AI_LOCK_MESSAGE = "获取登录卡后才能用哦";
const PNG_SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder("utf-8");
const ASCII_DECODER = new TextDecoder("ascii");
const LOGIN_CARD_CHARACTER_HAND_FIELD_KEYS = Object.freeze([
  "specialHands",
  "specialHandCards",
  "specialHandTags",
  "specialhandTags",
  "特殊手札",
  "customHandCards",
  "handCards",
  "duelHandCards"
]);

let crcTable = null;
let initialized = false;
let runtimeReady = false;
let pendingAppEntry = false;
let session = {
  mode: "login",
  payload: null,
  pngBytes: null,
  fileName: "",
  gateDismissed: false
};
let tutorialIndex = 0;
let managerEditingCharacterId = "";
let managerEditingCardDraft = null;

const els = {};

function queryElements() {
  Object.assign(els, {
    gate: document.querySelector("#loginCardGate"),
    gateActions: document.querySelector("#loginCardGateActions"),
    status: document.querySelector("#loginCardStatus"),
    useBtn: document.querySelector("#loginCardUseBtn"),
    tutorialBtn: document.querySelector("#loginCardTutorialBtn"),
    guestBtn: document.querySelector("#loginCardGuestBtn"),
    fileInput: document.querySelector("#loginCardFileInput"),
    welcome: document.querySelector("#loginCardWelcome"),
    welcomeTitle: document.querySelector("#loginCardWelcomeTitle"),
    welcomeMeta: document.querySelector("#loginCardWelcomeMeta"),
    enterBtn: document.querySelector("#loginCardEnterBtn"),
    switchBtn: document.querySelector("#loginCardSwitchBtn"),
    returnBtn: document.querySelector("#loginCardReturnBtn"),
    tutorialPanel: document.querySelector("#loginTutorialPanel"),
    tutorialBody: document.querySelector("#loginTutorialBody"),
    tutorialStep: document.querySelector("#loginTutorialStep"),
    tutorialTitle: document.querySelector("#loginTutorialTitle"),
    tutorialSkipBtn: document.querySelector("#loginTutorialSkipBtn"),
    tutorialCollapseBtn: document.querySelector("#loginTutorialCollapseBtn"),
    tutorialPrevBtn: document.querySelector("#loginTutorialPrevBtn"),
    tutorialNextBtn: document.querySelector("#loginTutorialNextBtn"),
    manager: document.querySelector("#loginCardManager"),
    managerStatus: document.querySelector("#loginCardManagerStatus"),
    managerFileInput: document.querySelector("#loginCardManagerFileInput"),
    managerFaceInput: document.querySelector("#loginCardFaceInput"),
    managerNicknameInput: document.querySelector("#loginCardNicknameInput"),
    managerExportBtn: document.querySelector("#loginCardExportBtn"),
    managerCreateBlankBtn: document.querySelector("#loginCardCreateBlankBtn"),
    managerList: document.querySelector("#loginCardCharacterList"),
    managerDeleteSelectedBtn: document.querySelector("#loginCardDeleteSelectedBtn"),
    managerSelectAllBtn: document.querySelector("#loginCardSelectAllBtn"),
    managerStoredCount: document.querySelector("#loginCardStoredCount"),
    characterEditor: document.querySelector("#loginCardCharacterEditor"),
    characterEditorTitle: document.querySelector("#loginCardCharacterEditorTitle"),
    characterEditorStatus: document.querySelector("#loginCardCharacterEditorStatus"),
    characterEditDisplayName: document.querySelector("#loginCardEditDisplayName"),
    characterEditVisibleGrade: document.querySelector("#loginCardEditVisibleGrade"),
    characterEditStage: document.querySelector("#loginCardEditStage"),
    characterEditTechniquePower: document.querySelector("#loginCardEditTechniquePower"),
    characterEditTechniqueText: document.querySelector("#loginCardEditTechniqueText"),
    characterEditDomainProfile: document.querySelector("#loginCardEditDomainProfile"),
    characterEditLoadout: document.querySelector("#loginCardEditLoadout"),
    characterEditTraits: document.querySelector("#loginCardEditTraits"),
    characterEditJson: document.querySelector("#loginCardEditJson"),
    characterHandEditorList: document.querySelector("#loginCardHandEditorList"),
    characterApplyJsonBtn: document.querySelector("#loginCardApplyJsonBtn"),
    characterRefreshJsonBtn: document.querySelector("#loginCardRefreshJsonBtn"),
    characterSaveBtn: document.querySelector("#loginCardSaveCharacterBtn"),
    characterCancelEditBtn: document.querySelector("#loginCardCancelCharacterEditBtn")
  });
}

function setStatus(message, isError = false, isLoading = false) {
  if (els.status) {
    els.status.textContent = message || "";
    els.status.classList.toggle("error-text", Boolean(isError));
    els.status.classList.toggle("login-card-status-loading", Boolean(isLoading));
  }
}

function setManagerStatus(message, isError = false) {
  if (els.managerStatus) {
    els.managerStatus.textContent = message || "";
    els.managerStatus.classList.toggle("error-text", Boolean(isError));
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clonePlain(value) {
  if (value == null) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(String(value || ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function jsonToTextPayload(payload) {
  return `base64:${bytesToBase64(TEXT_ENCODER.encode(JSON.stringify(payload)))}`;
}

function textPayloadToJson(text) {
  const raw = String(text || "").trim();
  const json = raw.startsWith("base64:")
    ? TEXT_DECODER.decode(base64ToBytes(raw.slice("base64:".length)))
    : raw;
  return JSON.parse(json);
}

function bytesToDataUrl(bytes) {
  return `data:image/png;base64,${bytesToBase64(bytes)}`;
}

function dataUrlToBytes(dataUrl) {
  const base64 = String(dataUrl || "").split(",")[1] || "";
  return base64 ? base64ToBytes(base64) : null;
}

function readUint32(bytes, offset) {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function writeUint32(target, offset, value) {
  target[offset] = (value >>> 24) & 255;
  target[offset + 1] = (value >>> 16) & 255;
  target[offset + 2] = (value >>> 8) & 255;
  target[offset + 3] = value & 255;
}

function assertPng(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 12) throw new Error("登录卡必须是 PNG 图片。");
  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (bytes[index] !== PNG_SIGNATURE[index]) throw new Error("登录卡必须是 PNG 图片。");
  }
}

function parsePngChunks(bytes) {
  assertPng(bytes);
  const chunks = [];
  let offset = PNG_SIGNATURE.length;
  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const typeOffset = offset + 4;
    const dataOffset = typeOffset + 4;
    const dataEnd = dataOffset + length;
    const crcOffset = dataEnd;
    const nextOffset = crcOffset + 4;
    if (nextOffset > bytes.length) throw new Error("PNG 数据不完整。");
    const type = ASCII_DECODER.decode(bytes.slice(typeOffset, typeOffset + 4));
    chunks.push({
      offset,
      nextOffset,
      length,
      type,
      data: bytes.slice(dataOffset, dataEnd),
      raw: bytes.slice(offset, nextOffset)
    });
    offset = nextOffset;
    if (type === "IEND") break;
  }
  return chunks;
}

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
}

function crc32(bytes) {
  if (!crcTable) crcTable = makeCrcTable();
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createTextChunk(keyword, text) {
  const keywordBytes = TEXT_ENCODER.encode(keyword);
  const textBytes = TEXT_ENCODER.encode(text);
  const data = new Uint8Array(keywordBytes.length + 1 + textBytes.length);
  data.set(keywordBytes, 0);
  data[keywordBytes.length] = 0;
  data.set(textBytes, keywordBytes.length + 1);
  const typeBytes = TEXT_ENCODER.encode("tEXt");
  const crcBytes = new Uint8Array(typeBytes.length + data.length);
  crcBytes.set(typeBytes, 0);
  crcBytes.set(data, typeBytes.length);
  const chunk = new Uint8Array(12 + data.length);
  writeUint32(chunk, 0, data.length);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  writeUint32(chunk, 8 + data.length, crc32(crcBytes));
  return chunk;
}

function getTextChunkKeyword(chunk) {
  const zeroIndex = chunk.data.indexOf(0);
  if (zeroIndex <= 0) return "";
  return TEXT_DECODER.decode(chunk.data.slice(0, zeroIndex));
}

function getTextChunkText(chunk) {
  const zeroIndex = chunk.data.indexOf(0);
  if (zeroIndex < 0) return "";
  return TEXT_DECODER.decode(chunk.data.slice(zeroIndex + 1));
}

function extractLoginPayloadFromPng(bytes) {
  const chunks = parsePngChunks(bytes);
  const textChunk = chunks.find((chunk) => chunk.type === "tEXt" && getTextChunkKeyword(chunk) === LOGIN_CARD_TEXT_KEYWORD);
  if (!textChunk) return null;
  return sanitizeLoginCardPayload(textPayloadToJson(getTextChunkText(textChunk)));
}

function embedLoginPayloadInPng(sourceBytes, payload) {
  const bytes = sourceBytes instanceof Uint8Array ? sourceBytes : new Uint8Array(sourceBytes || []);
  const chunks = parsePngChunks(bytes);
  const loginChunk = createTextChunk(LOGIN_CARD_TEXT_KEYWORD, jsonToTextPayload(buildEmbeddablePayload(payload)));
  const parts = [PNG_SIGNATURE];
  let inserted = false;
  for (const chunk of chunks) {
    if (chunk.type === "tEXt" && getTextChunkKeyword(chunk) === LOGIN_CARD_TEXT_KEYWORD) continue;
    if (chunk.type === "IEND" && !inserted) {
      parts.push(loginChunk);
      inserted = true;
    }
    parts.push(chunk.raw);
  }
  if (!inserted) parts.push(loginChunk);
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function sanitizeFilenamePart(value) {
  return String(value || "login-card")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "login-card";
}

function formatDateForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function formatLoginCardDownloadFilename(nickname) {
  return `泳者“${sanitizeFilenamePart(nickname || "未命名")}”的登录卡.png`;
}

function normalizeCharacterCard(card = {}, fallbackId = "") {
  const copy = clonePlain(card) || {};
  const characterId = String(copy.characterId || copy.id || fallbackId || `login_character_${Date.now().toString(36)}`).trim();
  const displayName = String(copy.displayName || copy.name || copy.nickname || "未命名角色").trim();
  return {
    ...copy,
    characterId,
    displayName,
    name: copy.name || displayName,
    customDuel: copy.customDuel !== false,
    source: copy.source || "login-card"
  };
}

function normalizeCharacterEntry(entry, index = 0) {
  const source = entry?.card || entry?.character || entry?.json || entry;
  if (!source || typeof source !== "object") return null;
  const fallbackId = entry?.characterId || entry?.id || `login_character_${index + 1}`;
  const card = normalizeCharacterCard(source, fallbackId);
  return {
    characterId: card.characterId,
    displayName: card.displayName || card.name || "未命名角色",
    updatedAt: entry?.updatedAt || new Date().toISOString(),
    card
  };
}

function buildLoginCardEditableCharacterPanel(card = {}) {
  const source = card && typeof card === "object" ? card : {};
  const panel = {};
  [
    "displayName",
    "name",
    "stage",
    "officialGrade",
    "powerTier",
    "techniquePower",
    "domainProfile",
    "technique",
    "techniqueName",
    "techniqueText",
    "techniqueDescription",
    "externalResource",
    "notes",
    "combatScore",
    "combatPowerUnit",
    "baseStats",
    "raw",
    "axes",
    "innateTraits",
    "advancedTechniques",
    "loadout",
    "selectedMechanisms",
    "selectedToolTags",
    "domainScript"
  ].forEach((key) => {
    if (source[key] !== undefined) panel[key] = clonePlain(source[key]);
  });
  if (!Object.keys(panel).length) {
    panel.displayName = source.displayName || source.name || "";
    panel.name = source.name || source.displayName || "";
    panel.notes = source.notes || "";
  }
  return panel;
}

function preserveLoginCardCharacterHands(originalCard, nextCard) {
  const original = originalCard && typeof originalCard === "object" ? originalCard : {};
  const next = nextCard && typeof nextCard === "object" ? nextCard : {};
  LOGIN_CARD_CHARACTER_HAND_FIELD_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(original, key)) {
      next[key] = clonePlain(original[key]);
    }
  });
  return next;
}

function splitLoginCardList(value) {
  return String(value || "")
    .split(/[\n,，、;；]+/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 24);
}

function normalizeLoginCardRank(value, fallback = "B") {
  const text = String(value || "").trim().toUpperCase();
  return /^(E-|E|D|C|B|A|S|SS|SSS|EX-|EX)$/.test(text) ? text : fallback;
}

function getLoginCardEditableHands(card = {}) {
  return [
    ...(Array.isArray(card.customHandCards) ? card.customHandCards : []),
    ...(Array.isArray(card.specialHandCards) ? card.specialHandCards : []),
    ...(Array.isArray(card.specialHands) ? card.specialHands : [])
  ].map((hand) => clonePlain(hand) || {}).filter((hand) => hand && typeof hand === "object");
}

function readLoginCardHandEditorRows() {
  if (!els.characterHandEditorList) return [];
  return Array.from(els.characterHandEditorList.querySelectorAll("[data-login-card-hand-row]")).map((row, index) => {
    const original = managerEditingCardDraft?.__editorHands?.[index] || {};
    const read = (name) => row.querySelector(`[data-login-card-hand="${name}"]`)?.value ?? "";
    const number = (name, fallback = 0) => {
      const value = Number(read(name));
      return Number.isFinite(value) ? value : fallback;
    };
    const stability = number("stability", Number(original.effects?.stabilityDelta || original.stabilityDelta || 0) * 100);
    const domainLoad = number("domainLoad", Number(original.baseDomainLoadDelta ?? original.effects?.domainLoadDelta ?? original.domainLoadDelta ?? 0));
    const next = {
      ...clonePlain(original),
      id: String(original.id || original.actionId || `login_card_hand_${index + 1}`),
      name: read("name").trim() || original.name || original.label || `手札 ${index + 1}`,
      label: read("name").trim() || original.label || original.name || `手札 ${index + 1}`,
      cardType: read("type").trim() || original.cardType || original.type || "technique",
      type: read("type").trim() || original.type || original.cardType || "technique",
      risk: ["low", "medium", "high", "critical"].includes(read("risk")) ? read("risk") : (original.risk || "medium"),
      ceCost: Math.max(0, Math.round(number("ce", Number(original.ceCost ?? original.baseCeCost ?? 0)))),
      baseCeCost: Math.max(0, Math.round(number("ce", Number(original.baseCeCost ?? original.ceCost ?? 0)))),
      baseDamage: Math.max(0, Math.round(number("damage", Number(original.baseDamage ?? original.damage ?? 0)))),
      damage: Math.max(0, Math.round(number("damage", Number(original.damage ?? original.baseDamage ?? 0)))),
      baseBlock: Math.max(0, Math.round(number("block", Number(original.baseBlock ?? original.block ?? 0)))),
      block: Math.max(0, Math.round(number("block", Number(original.block ?? original.baseBlock ?? 0)))),
      baseDomainLoadDelta: domainLoad,
      domainLoadDelta: domainLoad,
      effects: {
        ...(original.effects || {}),
        stabilityDelta: Number((stability / 100).toFixed(4)),
        domainLoadDelta: domainLoad
      },
      effectSummary: read("summary").trim() || original.effectSummary || original.summary || original.description || "",
      summary: read("summary").trim() || original.summary || original.effectSummary || original.description || ""
    };
    next.cost = { ...(original.cost || {}), flatCe: next.ceCost, minCe: next.ceCost };
    return next;
  });
}

function buildLoginCardEditorDraftFromGraphical() {
  const baseStats = {
    ...(managerEditingCardDraft?.baseStats || {})
  };
  document.querySelectorAll("[data-login-card-stat]").forEach((input) => {
    const key = input.dataset.loginCardStat;
    if (key) baseStats[key] = normalizeLoginCardRank(input.value, baseStats[key] || "B");
  });
  const displayName = String(els.characterEditDisplayName?.value || managerEditingCardDraft?.displayName || "").trim() || "未命名角色";
  const hands = readLoginCardHandEditorRows();
  const next = {
    ...(clonePlain(managerEditingCardDraft) || {}),
    displayName,
    name: displayName,
    visibleGrade: String(els.characterEditVisibleGrade?.value || managerEditingCardDraft?.visibleGrade || "").trim() || managerEditingCardDraft?.visibleGrade || "grade2",
    stage: String(els.characterEditStage?.value || managerEditingCardDraft?.stage || "").trim() || "custom",
    techniquePower: normalizeLoginCardRank(els.characterEditTechniquePower?.value || managerEditingCardDraft?.techniquePower || "B"),
    baseStats,
    techniqueText: String(els.characterEditTechniqueText?.value || "").trim(),
    techniqueName: String(els.characterEditTechniqueText?.value || "").trim() || managerEditingCardDraft?.techniqueName || "无",
    domainProfile: String(els.characterEditDomainProfile?.value || "").trim() || "无",
    loadout: splitLoginCardList(els.characterEditLoadout?.value || ""),
    innateTraits: splitLoginCardList(els.characterEditTraits?.value || ""),
    customHandCards: hands,
    specialHandCards: hands,
    specialHands: hands
  };
  delete next.__editorHands;
  return next;
}

function refreshLoginCardEditorJsonFromGraphical() {
  if (!els.characterEditJson || !managerEditingCardDraft) return;
  const next = buildLoginCardEditorDraftFromGraphical();
  els.characterEditJson.value = JSON.stringify(next, null, 2);
}

function renderLoginCardHandEditor(card = {}) {
  if (!els.characterHandEditorList) return;
  const hands = getLoginCardEditableHands(card);
  managerEditingCardDraft.__editorHands = hands.map((hand) => clonePlain(hand) || {});
  if (!hands.length) {
    els.characterHandEditorList.innerHTML = `<p class="muted">该角色暂无可编辑特殊手札。仍可通过自定义角色页新增后再存入登录卡。</p>`;
    return;
  }
  els.characterHandEditorList.innerHTML = hands.map((hand, index) => {
    const type = hand.cardType || hand.type || "technique";
    const risk = hand.risk || "medium";
    const ce = Number(hand.baseCeCost ?? hand.ceCost ?? 0);
    const damage = Number(hand.baseDamage ?? hand.damage ?? 0);
    const block = Number(hand.baseBlock ?? hand.block ?? 0);
    const stability = Math.round(Number(hand.effects?.stabilityDelta ?? hand.stabilityDelta ?? 0) * 100);
    const domainLoad = Number(hand.baseDomainLoadDelta ?? hand.effects?.domainLoadDelta ?? hand.domainLoadDelta ?? 0);
    return `
      <article class="login-card-hand-editor-row" data-login-card-hand-row>
        <strong>${escapeHtml(hand.name || hand.label || `手札 ${index + 1}`)}</strong>
        <label><span>名称</span><input data-login-card-hand="name" type="text" value="${escapeHtml(hand.name || hand.label || "")}"></label>
        <label><span>类型</span><input data-login-card-hand="type" type="text" value="${escapeHtml(type)}"></label>
        <label><span>风险</span><select data-login-card-hand="risk">
          ${["low", "medium", "high", "critical"].map((item) => `<option value="${item}" ${item === risk ? "selected" : ""}>${item}</option>`).join("")}
        </select></label>
        <label><span>CE</span><input data-login-card-hand="ce" type="number" step="1" value="${escapeHtml(ce)}"></label>
        <label><span>伤害</span><input data-login-card-hand="damage" type="number" step="1" value="${escapeHtml(damage)}"></label>
        <label><span>防御</span><input data-login-card-hand="block" type="number" step="1" value="${escapeHtml(block)}"></label>
        <label><span>稳定</span><input data-login-card-hand="stability" type="number" step="1" value="${escapeHtml(stability)}"></label>
        <label><span>领域负荷</span><input data-login-card-hand="domainLoad" type="number" step="1" value="${escapeHtml(domainLoad)}"></label>
        <label class="login-card-hand-summary"><span>说明</span><input data-login-card-hand="summary" type="text" value="${escapeHtml(hand.effectSummary || hand.summary || hand.description || "")}"></label>
      </article>
    `;
  }).join("");
}

function renderLoginCardCharacterEditor(card) {
  managerEditingCardDraft = clonePlain(card) || {};
  if (!managerEditingCardDraft.characterId) managerEditingCardDraft.characterId = managerEditingCharacterId;
  if (els.characterEditor) els.characterEditor.hidden = false;
  if (els.characterEditorTitle) els.characterEditorTitle.textContent = `图形化编辑：${managerEditingCardDraft.displayName || managerEditingCardDraft.name || "未命名角色"}`;
  if (els.characterEditorStatus) {
    els.characterEditorStatus.textContent = "修改后先保存角色修改，再点击“保存并下载登录卡”写入 PNG。";
    els.characterEditorStatus.classList.remove("error-text");
  }
  if (els.characterEditDisplayName) els.characterEditDisplayName.value = managerEditingCardDraft.displayName || managerEditingCardDraft.name || "";
  if (els.characterEditVisibleGrade) els.characterEditVisibleGrade.value = managerEditingCardDraft.visibleGrade || managerEditingCardDraft.officialGrade || "";
  if (els.characterEditStage) els.characterEditStage.value = managerEditingCardDraft.stage || "custom";
  if (els.characterEditTechniquePower) els.characterEditTechniquePower.value = managerEditingCardDraft.techniquePower || "B";
  if (els.characterEditTechniqueText) els.characterEditTechniqueText.value = managerEditingCardDraft.techniqueText || managerEditingCardDraft.techniqueName || managerEditingCardDraft.technique || "";
  if (els.characterEditDomainProfile) els.characterEditDomainProfile.value = managerEditingCardDraft.domainProfile || "";
  if (els.characterEditLoadout) els.characterEditLoadout.value = (managerEditingCardDraft.loadout || []).join("、");
  if (els.characterEditTraits) els.characterEditTraits.value = (managerEditingCardDraft.innateTraits || managerEditingCardDraft.traits || []).join("、");
  document.querySelectorAll("[data-login-card-stat]").forEach((input) => {
    const key = input.dataset.loginCardStat;
    input.value = managerEditingCardDraft.baseStats?.[key] || managerEditingCardDraft.raw?.[`${key}Rank`] || "B";
  });
  renderLoginCardHandEditor(managerEditingCardDraft);
  refreshLoginCardEditorJsonFromGraphical();
}

function closeLoginCardCharacterEditor() {
  managerEditingCharacterId = "";
  managerEditingCardDraft = null;
  if (els.characterEditor) els.characterEditor.hidden = true;
}

function sanitizeLoginCardPayload(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const entries = Array.isArray(source.characters)
    ? source.characters
    : Array.isArray(source.characterCardTable)
      ? source.characterCardTable
      : Array.isArray(source.characterCards)
        ? source.characterCards
        : [];
  const characters = entries
    .map((entry, index) => normalizeCharacterEntry(entry, index))
    .filter(Boolean)
    .slice(0, LOGIN_CARD_MAX_CHARACTERS);
  const nickname = String(source.ownerNickname || source.nickname || source.name || "未命名").trim() || "未命名";
  const now = new Date().toISOString();
  const payload = {
    schema: LOGIN_CARD_SCHEMA,
    version: Number(source.version || LOGIN_CARD_VERSION),
    createdAt: source.createdAt || now,
    updatedAt: source.updatedAt || now,
    creationIp: source.creationIp || source.creatorIp || "",
    creatorIp: source.creatorIp || source.creationIp || "",
    ipDerivedId: source.ipDerivedId || source.ownerId || "",
    ownerId: source.ownerId || source.ipDerivedId || "",
    ownerNickname: nickname,
    nickname,
    characters
  };
  if (source.admin === true || source.admin?.enabled === true) {
    payload.admin = true;
    payload.adminAt = source.adminAt || source.admin?.enabledAt || now;
  }
  payload.characterCardTable = payload.characters;
  payload.characterCards = payload.characters.map((entry) => entry.card);
  return payload;
}

function buildEmbeddablePayload(payload) {
  const normalized = sanitizeLoginCardPayload(payload);
  normalized.updatedAt = new Date().toISOString();
  normalized.characterCardTable = normalized.characters;
  normalized.characterCards = normalized.characters.map((entry) => entry.card);
  return normalized;
}

function getPayloadCharacterCards() {
  return (session.payload?.characters || []).map((entry) => ({
    ...clonePlain(entry.card),
    __loginCardCharacter: true,
    __loginCardOwnerId: session.payload?.ownerId || session.payload?.ipDerivedId || ""
  }));
}

function persistSession() {
  const stored = {
    mode: session.mode,
    payload: session.payload ? buildEmbeddablePayload(session.payload) : null,
    fileName: session.fileName || "",
    gateDismissed: Boolean(session.gateDismissed),
    pngDataUrl: session.pngBytes && session.pngBytes.length < 3_600_000 ? bytesToDataUrl(session.pngBytes) : ""
  };
  try {
    sessionStorage.setItem(LOGIN_CARD_SESSION_KEY, JSON.stringify(stored));
  } catch {
    try {
      stored.pngDataUrl = "";
      sessionStorage.setItem(LOGIN_CARD_SESSION_KEY, JSON.stringify(stored));
    } catch {
      // Storage can be unavailable in restricted browsers; current memory session still works.
    }
  }
}

function restoreSession() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(LOGIN_CARD_SESSION_KEY) || "null");
    if (!stored || typeof stored !== "object") return;
    session.mode = stored.mode || "login";
    session.payload = stored.payload ? sanitizeLoginCardPayload(stored.payload) : null;
    session.fileName = stored.fileName || "";
    session.gateDismissed = Boolean(stored.gateDismissed);
    session.pngBytes = stored.pngDataUrl ? dataUrlToBytes(stored.pngDataUrl) : null;
  } catch {
    session = { mode: "login", payload: null, pngBytes: null, fileName: "", gateDismissed: false };
  }
}

function hasLogin() {
  return Boolean(session.payload && session.mode === "login-card");
}

function getNickname() {
  return session.payload?.ownerNickname || session.payload?.nickname || "";
}

function updateBodyAuthClass() {
  document.body.classList.toggle("login-card-authenticated", hasLogin());
  document.body.classList.toggle("login-card-guest", session.mode === "guest");
}

function isUpdateNoticeReady() {
  const notice = globalThis.JJKUpdateNotice;
  if (!notice || typeof notice.isReady !== "function") return runtimeReady;
  return Boolean(notice.isReady());
}

function canDismissLoginGate() {
  return runtimeReady && isUpdateNoticeReady();
}

function canUseLoginGateControls() {
  return runtimeReady && isUpdateNoticeReady();
}

function setLoginGateWaitingState() {
  if (els.useBtn) els.useBtn.disabled = true;
  if (els.tutorialBtn) els.tutorialBtn.disabled = true;
  if (els.enterBtn) els.enterBtn.disabled = true;
  if (els.guestBtn) els.guestBtn.disabled = true;
  setStatus("正在加载网站资源和公告，请稍等。", false, true);
}

function clearLoginGateWaitingState() {
  if (els.useBtn) els.useBtn.disabled = false;
  if (els.tutorialBtn) els.tutorialBtn.disabled = false;
  if (els.enterBtn) els.enterBtn.disabled = false;
  if (els.guestBtn) els.guestBtn.disabled = false;
  if (els.status) {
    const wasLoading = els.status.classList.contains("login-card-status-loading");
    els.status.classList.remove("login-card-status-loading");
    if (wasLoading) els.status.textContent = "请选择登录方式。";
  }
}

function renderLoginGate() {
  updateBodyAuthClass();
  if (!els.gate) return;
  if ((session.mode === "guest" || session.gateDismissed) && canDismissLoginGate()) {
    els.gate.hidden = true;
    clearLoginGateWaitingState();
    return;
  }
  els.gate.hidden = false;
  if ((session.mode === "guest" || session.gateDismissed) && !canDismissLoginGate()) {
    setLoginGateWaitingState();
    return;
  }
  const loggedIn = hasLogin();
  if (els.gateActions) els.gateActions.hidden = loggedIn;
  if (els.welcome) els.welcome.hidden = !loggedIn;
  if (!canUseLoginGateControls()) {
    setLoginGateWaitingState();
    return;
  }
  clearLoginGateWaitingState();
  if (loggedIn) {
    const nickname = getNickname() || "未命名";
    const count = session.payload?.characters?.length || 0;
    if (els.welcomeTitle) els.welcomeTitle.textContent = `欢迎你，泳者「${nickname}」`;
    if (els.welcomeMeta) els.welcomeMeta.textContent = `卡内 ${count} 个角色已导入`;
    setStatus("登录卡读取完成。角色池会自动合并卡内角色。");
  }
}

function renderManager() {
  if (!els.manager) return;
  const loggedIn = hasLogin();
  const characters = session.payload?.characters || [];
  if (els.managerStoredCount) els.managerStoredCount.textContent = `${characters.length}/${LOGIN_CARD_MAX_CHARACTERS}`;
  if (els.managerNicknameInput) {
    els.managerNicknameInput.value = getNickname() || "";
    els.managerNicknameInput.disabled = !loggedIn;
  }
  if (els.managerExportBtn) els.managerExportBtn.disabled = !loggedIn;
  if (els.managerFaceInput) els.managerFaceInput.disabled = !loggedIn;
  if (els.managerDeleteSelectedBtn) els.managerDeleteSelectedBtn.disabled = !loggedIn || !characters.length;
  if (els.managerSelectAllBtn) els.managerSelectAllBtn.disabled = !loggedIn || !characters.length;
  if (!loggedIn) {
    setManagerStatus("未使用登录卡登录。可以先读取登录卡，或用空白黑卡创建第一张登录卡。", true);
    if (els.managerList) els.managerList.innerHTML = `<p class="muted">登录后可管理卡面图片和最多 ${LOGIN_CARD_MAX_CHARACTERS} 个角色。</p>`;
    return;
  }
  setManagerStatus(`当前登录卡：${getNickname() || "未命名"}；已存 ${characters.length} 个角色。`);
  if (!els.managerList) return;
  if (!characters.length) {
    els.managerList.innerHTML = `<p class="muted">这张登录卡还没有存储角色。导出自定义角色时会写入这里。</p>`;
    return;
  }
  els.managerList.innerHTML = characters.map((entry) => `
    <div class="login-card-character-row">
      <label class="login-card-character-main">
        <input type="checkbox" value="${escapeHtml(entry.characterId)}">
        <span>
          <strong>${escapeHtml(entry.displayName || entry.card?.displayName || entry.card?.name || "未命名角色")}</strong>
          <small>${escapeHtml(entry.characterId)} · ${escapeHtml((entry.card?.specialHandTags || entry.card?.["特殊手札"] || []).join("、") || "无特殊标签")}</small>
        </span>
      </label>
      <button class="secondary small" type="button" data-login-card-edit-character="${escapeHtml(entry.characterId)}">编辑面板</button>
    </div>
  `).join("");
}

function dispatchAuthChanged() {
  updateBodyAuthClass();
  document.dispatchEvent(new CustomEvent("jjk-login-card-auth-changed", {
    detail: {
      loggedIn: hasLogin(),
      mode: session.mode,
      nickname: getNickname(),
      ownerId: session.payload?.ownerId || session.payload?.ipDerivedId || "",
      characterCount: session.payload?.characters?.length || 0
    }
  }));
  if (typeof globalThis.updateAiProviderUi === "function") globalThis.updateAiProviderUi();
  if (typeof globalThis.syncDuelAiAssistPanel === "function") globalThis.syncDuelAiAssistPanel();
}

function dispatchCharactersImported() {
  document.dispatchEvent(new CustomEvent("jjk-login-card-characters-imported", {
    detail: {
      source: "login-card",
      ownerId: session.payload?.ownerId || session.payload?.ipDerivedId || "",
      characters: getPayloadCharacterCards()
    }
  }));
  globalThis.JJKDuelRuntime?.importLoginCardCharacters?.(getPayloadCharacterCards(), {
    source: "login-card",
    ownerId: session.payload?.ownerId || session.payload?.ipDerivedId || ""
  });
}

function dispatchCharactersRemoved(characterIds) {
  document.dispatchEvent(new CustomEvent("jjk-login-card-characters-removed", {
    detail: {
      source: "login-card",
      ownerId: session.payload?.ownerId || session.payload?.ipDerivedId || "",
      characterIds
    }
  }));
  globalThis.JJKDuelRuntime?.removeLoginCardCharactersFromPool?.(characterIds, {
    ownerId: session.payload?.ownerId || session.payload?.ipDerivedId || ""
  });
}

function syncRuntimeReady() {
  runtimeReady = true;
  if (hasLogin()) dispatchCharactersImported();
  dispatchAuthChanged();
  renderManager();
  renderLoginGate();
  flushPendingAppEntry();
}

async function readFileBytes(file) {
  return new Uint8Array(await file.arrayBuffer());
}

async function handleLoginFile(file, options = {}) {
  if (!file) return;
  if (!canUseLoginGateControls()) {
    setLoginGateWaitingState();
    if (els.fileInput) els.fileInput.value = "";
    if (els.managerFileInput) els.managerFileInput.value = "";
    return;
  }
  try {
    const bytes = await readFileBytes(file);
    const payload = extractLoginPayloadFromPng(bytes);
    if (!payload || payload.schema !== LOGIN_CARD_SCHEMA) {
      throw new Error("这张 PNG 内没有本站登录卡数据。");
    }
    session = {
      mode: "login-card",
      payload,
      pngBytes: bytes,
      fileName: file.name || "",
      gateDismissed: options.showGate !== false ? false : true
    };
    persistSession();
    renderLoginGate();
    renderManager();
    dispatchCharactersImported();
    dispatchAuthChanged();
    if (options.manager) setManagerStatus(`已读取登录卡：${getNickname() || "未命名"}。`);
  } catch (error) {
    setStatus(error?.message || "登录卡读取失败。", true);
    if (options.manager) setManagerStatus(error?.message || "登录卡读取失败。", true);
  } finally {
    if (els.fileInput) els.fileInput.value = "";
    if (els.managerFileInput) els.managerFileInput.value = "";
  }
}

function enterGuestMode() {
  if (!canUseLoginGateControls()) {
    setLoginGateWaitingState();
    return;
  }
  session = {
    mode: "guest",
    payload: null,
    pngBytes: null,
    fileName: "",
    gateDismissed: true
  };
  persistSession();
  renderLoginGate();
  renderManager();
  dispatchAuthChanged();
  flushPendingAppEntry();
}

function showAppAfterLogin() {
  pendingAppEntry = true;
  if (!canUseLoginGateControls()) {
    setLoginGateWaitingState();
    return;
  }
  finishAppEntry();
}

function finishAppEntry() {
  pendingAppEntry = false;
  session.gateDismissed = true;
  persistSession();
  renderLoginGate();
}

function flushPendingAppEntry() {
  if (!pendingAppEntry) return;
  if (!canUseLoginGateControls()) {
    setLoginGateWaitingState();
    return;
  }
  finishAppEntry();
}

function handleEntryReadinessChanged() {
  renderLoginGate();
  flushPendingAppEntry();
}

function showLoginGate() {
  setTutorialVisible(false);
  if (session.mode === "guest") {
    session = {
      mode: "login",
      payload: null,
      pngBytes: null,
      fileName: "",
      gateDismissed: false
    };
  } else {
    session.gateDismissed = false;
  }
  persistSession();
  renderLoginGate();
  renderManager();
  dispatchAuthChanged();
}

function switchLoginCard() {
  session.gateDismissed = false;
  if (els.fileInput) els.fileInput.click();
}

async function detectClientIp() {
  if (typeof fetch !== "function") return "unknown";
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch("https://api.ipify.org?format=json", { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return String(data.ip || "unknown");
  } catch {
    return "unknown";
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function sha256Short(text) {
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", TEXT_ENCODER.encode(text));
    return Array.from(new Uint8Array(digest)).slice(0, 12).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  let hash = 2166136261;
  for (const char of String(text)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

async function createBlankPngBytes(width = 512, height = 768) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#000";
  context.fillRect(0, 0, width, height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("当前浏览器无法生成空白 PNG。");
  return new Uint8Array(await blob.arrayBuffer());
}

function downloadBytes(bytes, filename, type = "image/png") {
  const blob = new Blob([bytes], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function exportCurrentLoginCard(options = {}) {
  if (!session.payload) throw new Error("没有可导出的登录卡数据。");
  const nickname = els.managerNicknameInput?.value?.trim() || getNickname() || "未命名";
  session.payload.ownerNickname = nickname;
  session.payload.nickname = nickname;
  session.payload.updatedAt = new Date().toISOString();
  const sourceBytes = session.pngBytes || await createBlankPngBytes();
  session.pngBytes = embedLoginPayloadInPng(sourceBytes, session.payload);
  session.mode = "login-card";
  persistSession();
  renderLoginGate();
  renderManager();
  dispatchAuthChanged();
  const filename = formatLoginCardDownloadFilename(nickname);
  downloadBytes(session.pngBytes, filename);
  if (options.message !== false) setManagerStatus(`已生成更新后的登录卡 PNG：${nickname}。`);
  return { ok: true, filename, characterCount: session.payload.characters.length };
}

async function createLoginCard(options = {}) {
  const nickname = String(options.nickname || "").trim() || "未命名";
  const sourceBytes = options.imageFile ? await readFileBytes(options.imageFile) : await createBlankPngBytes();
  assertPng(sourceBytes);
  const createdAt = new Date().toISOString();
  const creationIp = await detectClientIp();
  const ownerId = await sha256Short(creationIp);
  const payload = sanitizeLoginCardPayload({
    schema: LOGIN_CARD_SCHEMA,
    version: LOGIN_CARD_VERSION,
    createdAt,
    updatedAt: createdAt,
    creationIp,
    creatorIp: creationIp,
    ipDerivedId: ownerId,
    ownerId,
    ownerNickname: nickname,
    nickname,
    characters: options.initialCharacters || []
  });
  const pngBytes = embedLoginPayloadInPng(sourceBytes, payload);
  session = {
    mode: "login-card",
    payload,
    pngBytes,
    fileName: "",
    gateDismissed: false
  };
  persistSession();
  renderLoginGate();
  renderManager();
  dispatchCharactersImported();
  dispatchAuthChanged();
  downloadBytes(pngBytes, formatLoginCardDownloadFilename(nickname));
  return payload;
}

function normalizeExportedCharacter(payload) {
  const card = payload?.character || payload?.card || payload?.json || payload;
  if (!card || typeof card !== "object") return null;
  return normalizeCharacterCard(card, card.characterId || "");
}

async function addCharacterExportPayload(payload) {
  if (!hasLogin()) {
    return { ok: false, reason: "login-required", message: "你没有使用卡面登录，无法写入登录卡。" };
  }
  const card = normalizeExportedCharacter(payload);
  if (!card) return { ok: false, reason: "invalid-character", message: "角色卡格式无效，无法写入登录卡。" };
  const characters = session.payload.characters || [];
  const existingIndex = characters.findIndex((entry) => entry.characterId === card.characterId);
  if (existingIndex < 0 && characters.length >= LOGIN_CARD_MAX_CHARACTERS) {
    return { ok: false, reason: "limit", message: `这张登录卡最多存 ${LOGIN_CARD_MAX_CHARACTERS} 个角色。请先在对战设置里删除旧角色。` };
  }
  const entry = {
    characterId: card.characterId,
    displayName: card.displayName || card.name || "未命名角色",
    updatedAt: new Date().toISOString(),
    card
  };
  if (existingIndex >= 0) characters[existingIndex] = entry;
  else characters.push(entry);
  session.payload.characters = characters.slice(0, LOGIN_CARD_MAX_CHARACTERS);
  session.payload.characterCardTable = session.payload.characters;
  session.payload.characterCards = session.payload.characters.map((item) => item.card);
  persistSession();
  renderManager();
  setManagerStatus(`已存入登录卡：${entry.displayName}。需要下载时请点击“保存并下载登录卡”。`);
  dispatchCharactersImported();
  return {
    ok: true,
    replaced: existingIndex >= 0,
    message: existingIndex >= 0
      ? `已更新登录卡内角色：${entry.displayName}。请到“对战设置 > 管理卡面角色”点击“保存并下载登录卡”统一导出。`
      : `已存入登录卡：${entry.displayName}。请到“对战设置 > 管理卡面角色”点击“保存并下载登录卡”统一导出。`
  };
}

function editLoginCardCharacterPanel(characterId) {
  if (!hasLogin()) {
    setManagerStatus("请先使用登录卡登录。", true);
    return;
  }
  const characters = session.payload?.characters || [];
  const index = characters.findIndex((entry) => entry.characterId === characterId);
  if (index < 0) {
    setManagerStatus("找不到要编辑的卡内角色。", true);
    return;
  }
  const entry = characters[index];
  managerEditingCharacterId = entry.characterId;
  renderLoginCardCharacterEditor(entry.card);
  setManagerStatus(`正在编辑：${entry.displayName || entry.card?.displayName || "未命名角色"}。`);
}

function applyLoginCardCharacterJsonToEditor() {
  if (!managerEditingCardDraft || !els.characterEditJson) return;
  let patch;
  try {
    patch = JSON.parse(els.characterEditJson.value || "{}");
  } catch (error) {
    if (els.characterEditorStatus) {
      els.characterEditorStatus.textContent = `角色 JSON 解析失败：${error?.message || "格式错误"}`;
      els.characterEditorStatus.classList.add("error-text");
    }
    return;
  }
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    if (els.characterEditorStatus) {
      els.characterEditorStatus.textContent = "角色 JSON 必须是对象。";
      els.characterEditorStatus.classList.add("error-text");
    }
    return;
  }
  managerEditingCardDraft = normalizeCharacterCard({
    ...managerEditingCardDraft,
    ...patch,
    characterId: managerEditingCardDraft.characterId || managerEditingCharacterId
  }, managerEditingCharacterId);
  renderLoginCardCharacterEditor(managerEditingCardDraft);
  if (els.characterEditorStatus) {
    els.characterEditorStatus.textContent = "已从 JSON 回填图形界面。";
    els.characterEditorStatus.classList.remove("error-text");
  }
}

function saveLoginCardCharacterEditor() {
  if (!hasLogin() || !managerEditingCharacterId || !managerEditingCardDraft) {
    setManagerStatus("没有正在编辑的角色。", true);
    return;
  }
  const characters = session.payload?.characters || [];
  const index = characters.findIndex((entry) => entry.characterId === managerEditingCharacterId);
  if (index < 0) {
    setManagerStatus("找不到要保存的卡内角色。", true);
    return;
  }
  const originalCard = clonePlain(characters[index].card) || {};
  let graphicalPatch;
  try {
    graphicalPatch = buildLoginCardEditorDraftFromGraphical();
  } catch (error) {
    setManagerStatus(error?.message || "图形化表单读取失败。", true);
    return;
  }
  const merged = normalizeCharacterCard({
    ...originalCard,
    ...graphicalPatch,
    characterId: originalCard.characterId || characters[index].characterId
  }, characters[index].characterId);
  const nextEntry = {
    characterId: merged.characterId,
    displayName: merged.displayName || merged.name || "未命名角色",
    updatedAt: new Date().toISOString(),
    card: merged
  };
  characters[index] = nextEntry;
  session.payload.characters = characters.slice(0, LOGIN_CARD_MAX_CHARACTERS);
  session.payload.characterCardTable = session.payload.characters;
  session.payload.characterCards = session.payload.characters.map((item) => item.card);
  persistSession();
  renderManager();
  dispatchCharactersImported();
  closeLoginCardCharacterEditor();
  setManagerStatus(`已更新角色：${nextEntry.displayName}。需要写入 PNG 请点击“保存并下载登录卡”。`);
}

function unlockAdminMode(password) {
  if (!hasLogin()) {
    return { ok: false, reason: "login-required", message: "请先用登录卡 PNG 登录，再开启管理员模式。" };
  }
  if (String(password || "") !== ADMIN_LOGIN_PASSWORD) {
    return { ok: false, reason: "bad-password", message: "管理员密码错误。" };
  }
  session.payload.admin = true;
  session.payload.adminAt = new Date().toISOString();
  persistSession();
  renderLoginGate();
  renderManager();
  dispatchAuthChanged();
  setManagerStatus("管理员模式已写入当前登录卡。请点击“保存并下载登录卡”，否则刷新后不会写入 PNG。");
  return { ok: true, admin: true, message: "管理员模式已写入当前登录卡。请记得导出登录卡。" };
}

async function handleManagerExport() {
  try {
    await exportCurrentLoginCard();
  } catch (error) {
    setManagerStatus(error?.message || "登录卡导出失败。", true);
  }
}

async function handleManagerFaceFile(file) {
  if (!file || !hasLogin()) return;
  try {
    const bytes = await readFileBytes(file);
    assertPng(bytes);
    session.pngBytes = bytes;
    await exportCurrentLoginCard({ message: false });
    setManagerStatus("卡面图片已更换，并已写入当前登录卡数据。");
  } catch (error) {
    setManagerStatus(error?.message || "卡面图片读取失败。", true);
  } finally {
    if (els.managerFaceInput) els.managerFaceInput.value = "";
  }
}

async function handleCreateBlankCard() {
  try {
    if (!hasLogin()) {
      const nickname = window.prompt("请输入登录卡昵称：", els.managerNicknameInput?.value || "") || "";
      if (!nickname.trim()) return;
      await createLoginCard({ nickname: nickname.trim() });
      setManagerStatus("已创建全黑空白登录卡。");
      return;
    }
    session.pngBytes = await createBlankPngBytes();
    await exportCurrentLoginCard({ message: false });
    setManagerStatus("已用全黑空白 PNG 重建卡面，并保留当前角色列表。");
  } catch (error) {
    setManagerStatus(error?.message || "创建空白登录卡失败。", true);
  }
}

async function deleteSelectedCharacters() {
  if (!hasLogin() || !els.managerList) return;
  const selectedIds = Array.from(els.managerList.querySelectorAll("input[type='checkbox']:checked"))
    .map((input) => input.value)
    .filter(Boolean);
  if (!selectedIds.length) {
    setManagerStatus("请先勾选要删除的角色。", true);
    return;
  }
  session.payload.characters = (session.payload.characters || []).filter((entry) => !selectedIds.includes(entry.characterId));
  session.payload.characterCardTable = session.payload.characters;
  session.payload.characterCards = session.payload.characters.map((entry) => entry.card);
  await exportCurrentLoginCard({ message: false });
  dispatchCharactersRemoved(selectedIds);
  setManagerStatus(`已从登录卡删除 ${selectedIds.length} 个角色，并生成更新后的 PNG。`);
}

function selectAllManagerCharacters() {
  if (!els.managerList) return;
  const boxes = Array.from(els.managerList.querySelectorAll("input[type='checkbox']"));
  const shouldCheck = boxes.some((box) => !box.checked);
  boxes.forEach((box) => {
    box.checked = shouldCheck;
  });
}

function setTutorialVisible(visible) {
  if (els.tutorialPanel) els.tutorialPanel.hidden = !visible;
  document.body?.classList.toggle("login-tutorial-active", Boolean(visible));
  if (!visible) setTutorialCollapsed(false);
}

function setTutorialCollapsed(collapsed) {
  document.body?.classList.toggle("login-tutorial-collapsed", Boolean(collapsed));
  if (els.tutorialCollapseBtn) {
    els.tutorialCollapseBtn.textContent = collapsed ? "展开教学" : "收起教学";
    els.tutorialCollapseBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
  }
}

function activateMainTab(tabId) {
  const tab = document.querySelector(`.tab[data-tab="${tabId}"]`);
  const panel = document.getElementById(tabId);
  if (!tab || !panel) return false;
  tab.click();
  document.querySelectorAll(".tab").forEach((item) => item.classList.toggle("active", item === tab));
  document.querySelectorAll(".tab-panel").forEach((item) => item.classList.toggle("active", item === panel));
  return true;
}

function activateBattleTutorialPage(pageId, mode = "") {
  if (globalThis.JJKBattlePage?.activateBattlePage) {
    globalThis.JJKBattlePage.activateBattlePage(pageId, { primeMode: mode || undefined });
    if (mode && globalThis.JJKBattlePage?.setBattleMode) {
      globalThis.JJKBattlePage.setBattleMode(mode, { activePage: pageId });
    }
    return true;
  }
  const tab = document.querySelector(`.jjk-battle-tab[data-jjk-battle-tab="${pageId}"]`);
  const panel = document.querySelector(`[data-jjk-battle-page-panel="${pageId}"]`);
  if (!tab || !panel) return false;
  tab.click();
  document.querySelectorAll("[data-jjk-battle-tab]").forEach((item) => {
    const active = item === tab;
    item.classList.toggle("active", active);
    item.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.querySelectorAll("[data-jjk-battle-page-panel]").forEach((item) => {
    const active = item === panel;
    item.classList.toggle("active", active);
    item.hidden = !active;
  });
  return true;
}

function scrollTutorialTarget(selector) {
  window.setTimeout(() => {
    const target = document.querySelector(selector);
    if (!target) return;
    document.querySelectorAll(".login-tutorial-highlight").forEach((node) => {
      node.classList.remove("login-tutorial-highlight");
    });
    target.classList.add("login-tutorial-highlight");
    target.scrollIntoView?.({ block: "center", behavior: "smooth" });
    window.setTimeout(() => target.classList.remove("login-tutorial-highlight"), 2600);
  }, 80);
}

function getTutorialPages() {
  return [
    {
      title: "转盘使用指导",
      route: "wheel",
      body: `
        <p>转盘页负责抽取出身、能力、阵营、剧情节点和最终记录。随机模式按权重自动抽取；半自定义允许你在关键节点手选结果。</p>
        <p>结果区会保留本轮记录，可以导出 Markdown、复制战力编码，也可以进入“对战 > 自定义角色”把结果整理成可对战角色。</p>
        <p>如果 AI 返回内容没被自动解析，可以展开醒目的“手动输入数据”，按页面给出的格式把 AI 或自己整理出的 JSON 粘回去，不需要重新跑整轮。</p>
        <div class="action-row compact"><button class="primary" type="button" data-login-tutorial-action="open-wheel">打开转盘页并高亮记录区</button></div>
      `
    },
    {
      title: "AI 与公告等待",
      route: "wheel",
      body: `
        <p>进入页面时会先加载公告和运行资源。加载完成前登录区按钮会暂时不可用，避免公告没回来就进入页面导致流程卡住。</p>
        <p>AI 自定义角色、人生故事和战斗总结默认走服务端代理；如果遇到模型没有返回可解析 JSON，可以查看控制台里的原始 AI 返回，再用“手动输入数据”补回结构化结果。</p>
        <p>联机和 AI 功能都可能受网络、Base URL、代理线路影响。普通玩家优先使用默认设置；开发调试再改 Provider、Base URL 或 Endpoint。</p>
      `
    },
    {
      title: "对战使用指导",
      route: "duel",
      body: `
        <p>对战页包含单人对战、联机对战、观战、自定义角色和对战设置。单人对战适合试玩手札；联机模式通过房间同步角色、手札和锁定动作；观战会读取房间内选手实际卡面。</p>
        <p>现在主要看三个区域：上方状态栏显示体势 HP、咒力 CE、领域负荷和特殊计数；中部显示式神区、领域区和战斗记录；下方手札区负责选牌、锁定和执行回合。</p>
        <p>卡面需要优先看 CE 消耗、伤害、防御和命中/闪避提示；普通手札是否能执行由咒力、角色状态、领域和特殊规则共同决定。</p>
        <p>本页会自动切到单人对战并预选五条悟与宿傩。点击下方按钮可以立即生成一次教学对局，用来观察角色选择、手札区、行动锁定、回合日志和领域区域。移动端觉得小窗挡路时，可以点右上角“收起教学”。</p>
        <div class="action-row compact"><button class="primary" type="button" data-login-tutorial-action="simulate-duel">用五条悟模拟对战宿傩</button></div>
      `
    },
    {
      title: "特殊手札与状态栏",
      route: "duel",
      body: `
        <p>带有 Special hand tags 的角色会获得对应特殊手札。特殊资源会显示在状态栏的特殊计数里，卡面伤害和消耗会尽量按当前体势 HP、咒力 CE、质量或帧率实时刷新。</p>
        <p>星之怒围绕“虚拟质量”运转：质量会隔回合自然成长，虚拟质量牌加质量，凰轮在式神区时每回合消耗质量，黑洞终局会消耗所有质量并扣自身 HP。</p>
        <p>赤血操术围绕“咒力化血 / 血铸咒力”循环：实际消耗的咒力会积累“穿”，实际消耗的体势会积累“血”并参与攻击牌伤害；赤鳞跃动的扣血只用于防御上限，不转伤害。</p>
        <p>投射术式围绕“帧率”运转：帧率跨回合累积，达到 24 会触发出框时刻，伤害提升并封锁对手一张手札，触发后有冷却。</p>
      `
    },
    {
      title: "登录卡获取指导",
      route: "login-card",
      body: `
        <p>登录卡是一张 PNG。图片内部写入昵称、 ID，以及最多 ${LOGIN_CARD_MAX_CHARACTERS} 个自定义角色卡 JSON。以后用这张 PNG 登录，就会自动把角色加入角色池。</p>
        <p>你可以上传一张 PNG 当卡面；如果还没选好卡面，就用全黑空白卡面。创建后，当前第一次转盘结果能读取时会写入登录卡；否则先写入一个空白教程角色，之后在自定义角色区点“存入登陆卡”增量写入。</p>
        <p>登录后可以在登录卡内修改角色面板，但不会清空角色已有手札；适合修正 HP、CE、基础能力和角色说明。</p>
        <div class="login-card-tutorial-form">
          <label class="field">
            <span>昵称</span>
            <input id="loginTutorialNicknameInput" type="text" maxlength="24" placeholder="输入登录卡昵称">
          </label>
          <label class="field">
            <span>PNG 卡面</span>
            <input id="loginTutorialFaceInput" type="file" accept="image/png,.png">
          </label>
          <div class="action-row compact">
            <button class="primary" type="button" data-login-tutorial-action="create-card">生成登录卡并写入当前结果</button>
            <button class="secondary" type="button" data-login-tutorial-action="create-blank-card">还没选好卡面，使用空白卡面</button>
          </div>
          <p id="loginTutorialCreateStatus" class="muted"></p>
        </div>
      `
    },
    {
      title: "角色存入与统一下载",
      route: "login-manager",
      body: `
        <p>自定义角色区的按钮现在只负责“存入登陆卡”，不会直接下载角色文件。这样可以连续存多个角色，避免移动端反复弹下载。</p>
        <p>完成存入后，进入“对战设置 > 管理卡面角色”。这里能读取登录卡 PNG、更换卡面、改昵称、删除卡内角色，最后点“保存并下载登录卡”统一导出最新 PNG。</p>
        <p>如果自定义角色来自 AI，建议先检查 specialHandTags、手札列表和领域/简易领域能力，再存入登录卡；缺字段时可回到自定义角色区修正。</p>
        <div class="action-row compact">
          <button class="primary" type="button" data-login-tutorial-action="open-custom-character">跳到自定义角色并高亮存入入口</button>
          <button class="secondary" type="button" data-login-tutorial-action="open-login-manager">跳到管理卡面角色并高亮下载入口</button>
        </div>
      `
    }
  ];
}

function syncTutorialRoute(page) {
  if (page?.route === "duel") {
    activateMainTab("duel");
    activateBattleTutorialPage("solo", "solo");
    window.setTimeout(() => primeTutorialDuelSelects({ start: false }), 120);
    return;
  }
  if (page?.route === "login-card") {
    activateMainTab("run");
    window.setTimeout(() => document.querySelector("#loginTutorialNicknameInput")?.focus(), 80);
    return;
  }
  if (page?.route === "login-manager") {
    activateMainTab("duel");
    activateBattleTutorialPage("settings");
    scrollTutorialTarget("#loginCardManager");
    return;
  }
  activateMainTab("run");
  scrollTutorialTarget("#run");
}

function renderTutorial() {
  const pages = getTutorialPages();
  tutorialIndex = Math.min(Math.max(0, tutorialIndex), pages.length - 1);
  const page = pages[tutorialIndex] || pages[0];
  if (els.tutorialStep) els.tutorialStep.textContent = `${tutorialIndex + 1}/${pages.length}`;
  if (els.tutorialTitle) els.tutorialTitle.textContent = page.title;
  if (els.tutorialBody) els.tutorialBody.innerHTML = page.body;
  if (els.tutorialPrevBtn) els.tutorialPrevBtn.disabled = tutorialIndex <= 0;
  if (els.tutorialNextBtn) els.tutorialNextBtn.textContent = tutorialIndex >= pages.length - 1 ? "完成教学" : "下一段";
  syncTutorialRoute(page);
}

function startTutorial() {
  session.gateDismissed = true;
  persistSession();
  renderLoginGate();
  tutorialIndex = 0;
  setTutorialCollapsed(false);
  setTutorialVisible(true);
  renderTutorial();
}

function closeTutorial() {
  setTutorialVisible(false);
  session.gateDismissed = hasLogin() || session.mode === "guest";
  persistSession();
  renderLoginGate();
}

function nextTutorialPage() {
  const lastIndex = getTutorialPages().length - 1;
  if (tutorialIndex >= lastIndex) {
    closeTutorial();
    return;
  }
  tutorialIndex += 1;
  renderTutorial();
}

function prevTutorialPage() {
  tutorialIndex = Math.max(0, tutorialIndex - 1);
  renderTutorial();
}

function chooseDuelSelectOption(select, matcher) {
  if (!select) return false;
  const option = Array.from(select.options).find((item) => matcher.test(item.textContent || item.value));
  if (!option) return false;
  select.value = option.value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function primeTutorialDuelSelects(options = {}) {
  const attempt = Number(options.attempt || 0);
  const leftReady = chooseDuelSelectOption(document.querySelector("#duelLeftSelect"), /五条|gojo|satoru/i);
  const rightReady = chooseDuelSelectOption(document.querySelector("#duelRightSelect"), /宿傩|宿儺|sukuna|两面|兩面/i);
  if ((!leftReady || !rightReady) && attempt < 12) {
    window.setTimeout(() => primeTutorialDuelSelects({ ...options, attempt: attempt + 1 }), 180);
    return;
  }
  if (options.start && leftReady && rightReady) {
    globalThis.startDuelBattle?.({ mode: "solo" });
    scrollTutorialTarget("#duelBattle");
    return;
  }
  scrollTutorialTarget("#duel");
}

function prepareTutorialDuel() {
  activateMainTab("duel");
  activateBattleTutorialPage("solo", "solo");
  window.setTimeout(() => primeTutorialDuelSelects({ start: true }), 120);
}

function buildTutorialStarterCharacter(nickname) {
  const id = `login_tutorial_${Date.now().toString(36)}`;
  return {
    characterId: id,
    displayName: `${nickname || "泳者"}的初始角色`,
    name: `${nickname || "泳者"}的初始角色`,
    customDuel: true,
    visibleGrade: "grade2",
    officialGrade: "2级",
    stage: "custom",
    hp: 3,
    mp: 3,
    baseStats: {
      cursedEnergy: "C",
      control: "C",
      efficiency: "C",
      body: "C",
      martial: "C",
      talent: "C"
    },
    "四轴": {
      cursedEnergyScore: 3,
      controlScore: 3,
      outputScore: 3,
      bodyScore: 3
    },
    techniqueText: "未填写",
    techniqueName: "未填写",
    techniquePower: "C",
    domainProfile: "无",
    loadout: [],
    innateTraits: [],
    specialHandTags: [`custom_character_${id}`],
    "特殊手札": [`custom_character_${id}`],
    customHandCards: [],
    notes: "登录卡教学生成的空白占位角色。"
  };
}

function readCurrentTutorialCharacter(nickname) {
  try {
    const strength = typeof globalThis.buildStrengthSnapshot === "function"
      ? globalThis.buildStrengthSnapshot()
      : null;
    if (!strength?.instantCombatProfile) return buildTutorialStarterCharacter(nickname);
    if (typeof globalThis.importCurrentWheelResultToCustomDuel === "function") {
      globalThis.importCurrentWheelResultToCustomDuel();
      if (typeof globalThis.addCustomDuelCharacter === "function") globalThis.addCustomDuelCharacter();
      const cards = globalThis.JJKDuelRuntime?.getCustomDuelCards?.() || [];
      const latest = cards[cards.length - 1];
      if (latest) return latest;
    }
  } catch {
    // The tutorial can still create a valid blank starter card.
  }
  return buildTutorialStarterCharacter(nickname);
}

async function createTutorialLoginCard(useBlankFace = false) {
  const nicknameInput = document.querySelector("#loginTutorialNicknameInput");
  const faceInput = document.querySelector("#loginTutorialFaceInput");
  const status = document.querySelector("#loginTutorialCreateStatus");
  const nickname = String(nicknameInput?.value || "").trim();
  if (!nickname) {
    if (status) {
      status.textContent = "请先输入昵称。";
      status.classList.add("error-text");
    }
    nicknameInput?.focus();
    return;
  }
  const imageFile = useBlankFace ? null : faceInput?.files?.[0] || null;
  const starter = readCurrentTutorialCharacter(nickname);
  try {
    await createLoginCard({
      nickname,
      imageFile,
      initialCharacters: [starter]
    });
    if (status) {
      status.textContent = `登录卡已生成，已写入角色：${starter.displayName || starter.name || "未命名角色"}。`;
      status.classList.remove("error-text");
    }
    dispatchCharactersImported();
  } catch (error) {
    if (status) {
      status.textContent = error?.message || "登录卡创建失败。";
      status.classList.add("error-text");
    }
  }
}

function handleTutorialAction(action) {
  if (action === "open-wheel") {
    activateMainTab("results");
    scrollTutorialTarget("#results");
  }
  if (action === "simulate-duel") prepareTutorialDuel();
  if (action === "create-card") createTutorialLoginCard(false);
  if (action === "create-blank-card") createTutorialLoginCard(true);
  if (action === "open-custom-character") {
    activateMainTab("duel");
    activateBattleTutorialPage("custom");
    scrollTutorialTarget("#customCharacterInterface");
  }
  if (action === "open-login-manager") {
    activateMainTab("duel");
    activateBattleTutorialPage("settings");
    scrollTutorialTarget("#loginCardExportBtn");
  }
}

function bindEvents() {
  els.useBtn?.addEventListener("click", () => {
    if (!canUseLoginGateControls()) {
      setLoginGateWaitingState();
      return;
    }
    els.fileInput?.click();
  });
  els.fileInput?.addEventListener("change", () => handleLoginFile(els.fileInput.files?.[0], { showGate: true }));
  els.tutorialBtn?.addEventListener("click", () => {
    if (!canUseLoginGateControls()) {
      setLoginGateWaitingState();
      return;
    }
    startTutorial();
  });
  els.guestBtn?.addEventListener("click", enterGuestMode);
  els.enterBtn?.addEventListener("click", showAppAfterLogin);
  els.switchBtn?.addEventListener("click", switchLoginCard);
  els.returnBtn?.addEventListener("click", showLoginGate);
  els.managerFileInput?.addEventListener("change", () => handleLoginFile(els.managerFileInput.files?.[0], { showGate: false, manager: true }));
  els.managerFaceInput?.addEventListener("change", () => handleManagerFaceFile(els.managerFaceInput.files?.[0]));
  els.managerExportBtn?.addEventListener("click", handleManagerExport);
  els.managerCreateBlankBtn?.addEventListener("click", handleCreateBlankCard);
  els.managerDeleteSelectedBtn?.addEventListener("click", () => deleteSelectedCharacters().catch((error) => {
    setManagerStatus(error?.message || "删除失败。", true);
  }));
  els.managerSelectAllBtn?.addEventListener("click", selectAllManagerCharacters);
  els.managerList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-login-card-edit-character]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    editLoginCardCharacterPanel(button.dataset.loginCardEditCharacter || "");
  });
  els.characterApplyJsonBtn?.addEventListener("click", applyLoginCardCharacterJsonToEditor);
  els.characterRefreshJsonBtn?.addEventListener("click", refreshLoginCardEditorJsonFromGraphical);
  els.characterSaveBtn?.addEventListener("click", saveLoginCardCharacterEditor);
  els.characterCancelEditBtn?.addEventListener("click", closeLoginCardCharacterEditor);
  els.tutorialSkipBtn?.addEventListener("click", nextTutorialPage);
  els.tutorialCollapseBtn?.addEventListener("click", () => {
    setTutorialCollapsed(!document.body?.classList.contains("login-tutorial-collapsed"));
  });
  els.tutorialPrevBtn?.addEventListener("click", prevTutorialPage);
  els.tutorialNextBtn?.addEventListener("click", nextTutorialPage);
  document.addEventListener("jjk-update-notice-ready", handleEntryReadinessChanged);
  document.addEventListener("jjk-runtime-ready", handleEntryReadinessChanged);
  els.tutorialBody?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-login-tutorial-action]");
    if (!button) return;
    handleTutorialAction(button.dataset.loginTutorialAction);
  });
}

function requireAiLogin(options = {}) {
  if (hasLogin()) return true;
  if (options.alert !== false) window.alert(AI_LOCK_MESSAGE);
  setStatus(AI_LOCK_MESSAGE, true);
  setManagerStatus(AI_LOCK_MESSAGE, true);
  return false;
}

function initialize() {
  if (initialized || typeof document === "undefined") return;
  initialized = true;
  queryElements();
  restoreSession();
  bindEvents();
  renderLoginGate();
  renderManager();
  dispatchAuthChanged();
  if (hasLogin()) dispatchCharactersImported();
}

export const LoginCardModule = {
  namespace: "JJKLoginCard",
  version: "V3.0",
  initialize,
  hasLogin,
  showLoginGate,
  requireAiLogin,
  getNickname,
  getPayload: () => session.payload ? buildEmbeddablePayload(session.payload) : null,
  getCharacterCards: getPayloadCharacterCards,
  addCharacterExportPayload,
  editLoginCardCharacterPanel,
  unlockAdminMode,
  createLoginCard,
  exportCurrentLoginCard,
  syncRuntimeReady,
  isRuntimeReady: () => runtimeReady,
  constants: {
    LOGIN_CARD_SCHEMA,
    LOGIN_CARD_MAX_CHARACTERS,
    AI_LOCK_MESSAGE
  }
};

globalThis.JJKLoginCard = LoginCardModule;

export default LoginCardModule;
