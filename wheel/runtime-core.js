//--转盘运行时核心--//
﻿// This file is now a legacy compatibility bridge.
// Primary module ownership lives in modules/*.js.
// Do not add new feature logic here unless documented in APP_JS_REMAINING_OWNERSHIP.md.

const JJK_LEGACY_APP_ALREADY_BOOTED = globalThis.__JJK_LEGACY_APP_BOOTED__ === true;
globalThis.__JJK_LEGACY_APP_BOOTED__ = true;

const state = {
  wheels: null,
  flow: null,
  strength: null,
  characterCards: null,
  mechanisms: null,
  calibrationBattles: null,
  optionEffects: null,
  duelResourceRules: null,
  duelActionRules: null,
  techniqueHandRules: null,
  duelSpecialCards: null,
  duelCharacterCardRules: null,
  duelCardTemplateRules: null,
  duelCardCopyRules: null,
  duelMechanicRules: null,
  duelBetaCopy: null,
  duelDomainProfiles: null,
  duelTrialTargetRules: null,
  aiProviderRules: null,
  aiPromptTemplates: null,
  aiPromptAssets: null,
  lastAiPromptEstimate: null,
  optionEffectIndex: new Map(),
  wheelMap: new Map(),
  mainIndex: 0,
  taskQueue: [],
  currentTask: null,
  pendingResult: null,
  isSpinning: false,
  spinToken: 0,
  spinModeSnapshot: null,
  audioContext: null,
  spinSoundToken: 0,
  spinSoundGain: null,
  speechVoice: null,
  debugMode: false,
  debugSummoned: false,
  debugSummonBuffer: "",
  mobileDebugGesture: {
    restartCount: 0,
    feedbackCount: 0,
    lifeFileCount: 0,
    phase: "restart"
  },
  playMode: "random",
  aiFreeEnabled: false,
  records: [],
  recordSeq: 0,
  backtrackSnapshots: [],
  answers: {},
  duelBattle: null,
  duelModeState: {
    mode: "none",
    activeBattleId: "",
    activeRoomId: "",
    playerSide: null,
    localLocked: false
  },
  duelCpuDifficulty: "normal",
  duelSpinToken: 0,
  customDuelCards: [],
  customDuelSeq: 0,
  customDuelEditId: "",
  customDuelHandEditIndex: -1,
  pendingCustomDuelHandCards: [],
  pendingCustomDuelSpecialHandTags: [],
  pendingCustomDuelDomainScript: null,
  customDuelHandSeq: 0,
  duelSpecialTerms: [],
  duelSpecialTermSeq: 0,
  restoredLifeWheelDraft: null,
  mobileTopbarHidden: false,
  lastMobileScrollY: 0,
  usageStats: null,
  wheelSettings: null,
  duelVisualSettings: null,
  flowReviewZoom: 0.08,
  flowGraphViewportAnchor: null,
  flags: {
    dead: false,
    skipPeriods: new Set()
  }
};

const els = {
  topbar: document.querySelector(".topbar"),
  tabs: document.querySelectorAll(".tab"),
  panels: document.querySelectorAll(".tab-panel"),
  restartBtn: document.querySelector("#restartBtn"),
  debugToggle: document.querySelector("#debugToggle"),
  playModeInputs: document.querySelectorAll('input[name="playMode"]'),
  aiFreeToggle: document.querySelector("#aiFreeToggle"),
  modeHint: document.querySelector("#modeHint"),
  feedbackContactBtn: document.querySelector("#feedbackContactBtn"),
  drawBtn: document.querySelector("#drawBtn"),
  runAllBtn: document.querySelector("#runAllBtn"),
  nextBtn: document.querySelector("#nextBtn"),
  currentTitle: document.querySelector("#currentTitle"),
  currentWhy: document.querySelector("#currentWhy"),
  stageBadge: document.querySelector("#stageBadge"),
  stepCounter: document.querySelector("#stepCounter"),
  wheelArea: document.querySelector("#wheelArea"),
  debugForcePanel: document.querySelector("#debugForcePanel"),
  debugForcedOptionSelect: document.querySelector("#debugForcedOptionSelect"),
  debugForcedOptionHint: document.querySelector("#debugForcedOptionHint"),
  debugEntryPanel: document.querySelector("#debugEntryPanel"),
  debugEntrySelect: document.querySelector("#debugEntrySelect"),
  debugEntryText: document.querySelector("#debugEntryText"),
  debugEntryWeight: document.querySelector("#debugEntryWeight"),
  debugEntryAddBtn: document.querySelector("#debugEntryAddBtn"),
  debugEntrySaveBtn: document.querySelector("#debugEntrySaveBtn"),
  debugEntryDeleteBtn: document.querySelector("#debugEntryDeleteBtn"),
  debugEntryStatus: document.querySelector("#debugEntryStatus"),
  wheelSettingInputs: document.querySelectorAll("[data-wheel-setting]"),
  wheelSettingsResetBtn: document.querySelector("#wheelSettingsResetBtn"),
  stateList: document.querySelector("#stateList"),
  strengthSummary: document.querySelector("#strengthSummary"),
  usageStats: document.querySelector("#usageStats"),
  flowTree: document.querySelector("#flowTree"),
  flowGraph: document.querySelector("#flowGraph"),
  wheelLibrary: document.querySelector("#wheelLibrary"),
  librarySummary: document.querySelector("#librarySummary"),
  resultLog: document.querySelector("#resultLog"),
  downloadMdBtn: document.querySelector("#downloadMdBtn"),
  combatExportBtn: document.querySelector("#combatExportBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  exportBox: document.querySelector("#exportBox"),
  templateName: document.querySelector("#templateName"),
  templateAttributeCount: document.querySelector("#templateAttributeCount"),
  templateGradeCount: document.querySelector("#templateGradeCount"),
  templateEventCount: document.querySelector("#templateEventCount"),
  templateDeathRate: document.querySelector("#templateDeathRate"),
  templateFactionMode: document.querySelector("#templateFactionMode"),
  templateHiddenWeightMode: document.querySelector("#templateHiddenWeightMode"),
  templateFinalEvaluation: document.querySelector("#templateFinalEvaluation"),
  generateTemplateBtn: document.querySelector("#generateTemplateBtn"),
  templatePreview: document.querySelector("#templatePreview"),
  globalSettingsBtn: document.querySelector("#globalSettingsBtn"),
  globalSettingsPanel: document.querySelector("#globalSettingsPanel"),
  globalSettingsCloseBtn: document.querySelector("#globalSettingsCloseBtn"),
  globalSettingsStatus: document.querySelector("#globalSettingsStatus"),
  aiProviderMode: document.querySelector("#aiProviderMode"),
  aiProviderIdInput: document.querySelector("#aiProviderIdInput"),
  aiBaseUrlInput: document.querySelector("#aiBaseUrlInput"),
  aiPathInput: document.querySelector("#aiPathInput"),
  aiByokKeyInput: document.querySelector("#aiByokKeyInput"),
  aiByokRevealToggle: document.querySelector("#aiByokRevealToggle"),
  aiByokPersistLocal: document.querySelector("#aiByokPersistLocal"),
  aiAdminPasswordInput: document.querySelector("#aiAdminPasswordInput"),
  aiAdminLoginBtn: document.querySelector("#aiAdminLoginBtn"),
  aiAdminStatus: document.querySelector("#aiAdminStatus"),
  aiModelInput: document.querySelector("#aiModelInput"),
  aiOutputTokenInput: document.querySelector("#aiOutputTokenInput"),
  aiProviderWarning: document.querySelector("#aiProviderWarning"),
  aiPromptEstimate: document.querySelector("#aiPromptEstimate"),
  aiCostNotice: document.querySelector("#aiCostNotice"),
  aiFallbackStatus: document.querySelector("#aiFallbackStatus"),
  clearAiKeyBtn: document.querySelector("#clearAiKeyBtn"),
  clearAiAllSettingsBtn: document.querySelector("#clearAiAllSettingsBtn"),
  testAiProviderBtn: document.querySelector("#testAiProviderBtn"),
  aiNarrativeKind: document.querySelector("#aiNarrativeKind"),
  generateAiNarrativeBtn: document.querySelector("#generateAiNarrativeBtn"),
  aiNarrativeStatus: document.querySelector("#aiNarrativeStatus"),
  aiNarrativeOutput: document.querySelector("#aiNarrativeOutput"),
  duelLeftSelect: document.querySelector("#duelLeftSelect"),
  duelRightSelect: document.querySelector("#duelRightSelect"),
  duelCpuDifficultySelect: document.querySelector("#duelCpuDifficultySelect"),
  duelSwapBtn: document.querySelector("#duelSwapBtn"),
  duelStartBtn: document.querySelector("#duelStartBtn"),
  duelCustomName: document.querySelector("#duelCustomName"),
  duelCustomGrade: document.querySelector("#duelCustomGrade"),
  duelCustomTechniquePower: document.querySelector("#duelCustomTechniquePower"),
  duelCustomStage: document.querySelector("#duelCustomStage"),
  duelCustomCombatScore: document.querySelector("#duelCustomCombatScore"),
  duelCustomCombatUnit: document.querySelector("#duelCustomCombatUnit"),
  duelAiAssistToggle: document.querySelector("#duelAiAssistToggle"),
  duelAiDescription: document.querySelector("#duelAiDescription"),
  duelAiAnalyzeBtn: document.querySelector("#duelAiAnalyzeBtn"),
  duelAiStatus: document.querySelector("#duelAiStatus"),
  duelAiProgress: document.querySelector("#duelAiProgress"),
  duelAiProgressBar: document.querySelector("#duelAiProgressBar"),
  duelAiOutput: document.querySelector("#duelAiOutput"),
  duelManualDataInput: document.querySelector("#duelManualDataInput"),
  duelManualDataApplyBtn: document.querySelector("#duelManualDataApplyBtn"),
  duelManualDataStatus: document.querySelector("#duelManualDataStatus"),
  duelCustomModeInputs: document.querySelectorAll('input[name="duelCustomMode"]'),
  duelCustomModePanels: document.querySelectorAll("[data-duel-custom-mode-panel]"),
  duelCustomTechniqueTags: document.querySelector("#duelCustomTechniqueTags"),
  duelCustomDomainTags: document.querySelector("#duelCustomDomainTags"),
  duelCustomAdvancedTags: document.querySelector("#duelCustomAdvancedTags"),
  duelCustomResourceTags: document.querySelector("#duelCustomResourceTags"),
  duelApplyLibraryBtn: document.querySelector("#duelApplyLibraryBtn"),
  duelLibraryStatus: document.querySelector("#duelLibraryStatus"),
  duelCustomTechnique: document.querySelector("#duelCustomTechnique"),
  duelCustomDomain: document.querySelector("#duelCustomDomain"),
  duelCustomTools: document.querySelector("#duelCustomTools"),
  duelCustomTraits: document.querySelector("#duelCustomTraits"),
  duelCustomMechanisms: document.querySelector("#duelCustomMechanisms"),
  duelCustomToolTags: document.querySelector("#duelCustomToolTags"),
  duelCustomResource: document.querySelector("#duelCustomResource"),
  duelCustomNotes: document.querySelector("#duelCustomNotes"),
  duelImportCode: document.querySelector("#duelImportCode"),
  duelImportCodeBtn: document.querySelector("#duelImportCodeBtn"),
  duelImportStatus: document.querySelector("#duelImportStatus"),
  customCharacterInterface: document.querySelector("#customCharacterInterface"),
  customCharacterEntryButtons: document.querySelectorAll("[data-custom-character-entry]"),
  duelCustomAccessStatus: document.querySelector("#duelCustomAccessStatus"),
  duelWheelImportData: document.querySelector("#duelWheelImportData"),
  duelWheelImportFile: document.querySelector("#duelWheelImportFile"),
  duelWheelImportBtn: document.querySelector("#duelWheelImportBtn"),
  duelWheelImportCurrentBtn: document.querySelector("#duelWheelImportCurrentBtn"),
  duelWheelImportStatus: document.querySelector("#duelWheelImportStatus"),
  duelCustomHandName: document.querySelector("#duelCustomHandName"),
  duelCustomHandType: document.querySelector("#duelCustomHandType"),
  duelCustomHandRisk: document.querySelector("#duelCustomHandRisk"),
  duelCustomHandApCost: document.querySelector("#duelCustomHandApCost"),
  duelCustomHandCeCost: document.querySelector("#duelCustomHandCeCost"),
  duelCustomHandDamage: document.querySelector("#duelCustomHandDamage"),
  duelCustomHandBlock: document.querySelector("#duelCustomHandBlock"),
  duelCustomHandStability: document.querySelector("#duelCustomHandStability"),
  duelCustomHandDomainLoad: document.querySelector("#duelCustomHandDomainLoad"),
  duelCustomHandSummary: document.querySelector("#duelCustomHandSummary"),
  duelCustomHandTags: document.querySelector("#duelCustomHandTags"),
  duelCustomHandAddBtn: document.querySelector("#duelCustomHandAddBtn"),
  duelCustomHandClearBtn: document.querySelector("#duelCustomHandClearBtn"),
  duelCustomHandStatus: document.querySelector("#duelCustomHandStatus"),
  duelCustomHandList: document.querySelector("#duelCustomHandList"),
  duelCustomAddBtn: document.querySelector("#duelCustomAddBtn"),
  duelCustomClearBtn: document.querySelector("#duelCustomClearBtn"),
  duelCustomList: document.querySelector("#duelCustomList"),
  duelCustomCount: document.querySelector("#duelCustomCount"),
  duelCustomRankSelects: document.querySelectorAll("[data-duel-custom-rank]"),
  duelSpecialTermName: document.querySelector("#duelSpecialTermName"),
  duelSpecialTermRounds: document.querySelector("#duelSpecialTermRounds"),
  duelSpecialTermDefinition: document.querySelector("#duelSpecialTermDefinition"),
  duelSpecialTermAddBtn: document.querySelector("#duelSpecialTermAddBtn"),
  duelSpecialTermClearBtn: document.querySelector("#duelSpecialTermClearBtn"),
  duelSpecialTermList: document.querySelector("#duelSpecialTermList"),
  duelSpecialTermCount: document.querySelector("#duelSpecialTermCount"),
  duelUiThemeSelect: document.querySelector("#duelUiThemeSelect"),
  duelCardSkinSelect: document.querySelector("#duelCardSkinSelect"),
  duelCompactCardToggle: document.querySelector("#duelCompactCardToggle"),
  duelSkinImportFile: document.querySelector("#duelSkinImportFile"),
  duelSkinDownloadSpecBtn: document.querySelector("#duelSkinDownloadSpecBtn"),
  duelVisualResetBtn: document.querySelector("#duelVisualResetBtn"),
  duelVisualSettingsStatus: document.querySelector("#duelVisualSettingsStatus"),
  duelDebugLeftScore: document.querySelector("#duelDebugLeftScore"),
  duelDebugLeftUnit: document.querySelector("#duelDebugLeftUnit"),
  duelDebugLeftRate: document.querySelector("#duelDebugLeftRate"),
  duelDebugRightScore: document.querySelector("#duelDebugRightScore"),
  duelDebugRightUnit: document.querySelector("#duelDebugRightUnit"),
  duelDebugRightRate: document.querySelector("#duelDebugRightRate"),
  duelDebugClearBtn: document.querySelector("#duelDebugClearBtn"),
  duelDebugStatus: document.querySelector("#duelDebugStatus"),
  duelSummary: document.querySelector("#duelSummary"),
  duelBattle: document.querySelector("#duelBattle"),
  duelCards: document.querySelector("#duelCards"),
  duelModeStatus: document.querySelector("#duelModeStatus"),
  v224UpdateModal: document.querySelector("#v224UpdateModal"),
  v224UpdateModalClose: document.querySelector("#v224UpdateModalClose")
};

const DEBUG_ACCESS_CODE = "258079";
const DEBUG_SUMMON_SEQUENCE = "258079";
const APP_BUILD_VERSION = "V3.1.5-tutorial-title-20260509";
const MOBILE_TOPBAR_QUERY = "(max-width: 640px)";
const MOBILE_TOPBAR_SCROLL_DELTA = 8;
const MOBILE_TOPBAR_MIN_HIDE_AFTER = 72;
const MOBILE_DEBUG_RESTART_TAPS = 3;
const MOBILE_DEBUG_FEEDBACK_TAPS = 8;
const MOBILE_DEBUG_LIFE_FILE_TAPS = 2;
const USAGE_STATS_KEY = "jjk-wheel-usage-stats-v1";
const AI_PROVIDER_MODE_STORAGE_KEY = "jjk-ai-provider-mode-v1";
const AI_PROVIDER_ID_STORAGE_KEY = "jjk-ai-provider-id-v1";
const AI_BASE_URL_STORAGE_KEY = "jjk-ai-base-url-v1";
const AI_PATH_STORAGE_KEY = "jjk-ai-path-v1";
const AI_MODEL_STORAGE_KEY = "jjk-ai-model-v1";
const AI_OUTPUT_TOKENS_STORAGE_KEY = "jjk-ai-output-tokens-v1";
const AI_BYOK_SESSION_KEY = "jjk-ai-byok-key-session-v1";
const AI_BYOK_LOCAL_KEY = "jjk-ai-byok-key-local-v1";
const AI_BYOK_PERSIST_LOCAL_STORAGE_KEY = "jjk-ai-byok-persist-local-v1";
const AI_DAILY_USAGE_STORAGE_KEY = "jjk-ai-daily-usage-v1";
const AI_DAILY_LIMIT = 2000;
const AI_DAILY_LIMIT_MESSAGE = "今日额度达到上限，请等待明日游玩，用东八区为换日基准。";
const DUEL_AI_ASSIST_STORAGE_KEY = "jjk-duel-ai-assist-enabled-v1";
const WHEEL_SETTINGS_STORAGE_KEY = "jjk-wheel-player-settings-v1";
const DUEL_VISUAL_SETTINGS_STORAGE_KEY = "jjk-duel-visual-settings-v2.24";
const DUEL_CPU_DIFFICULTY_STORAGE_KEY = "jjk-duel-cpu-difficulty-v1";
const V224_UPDATE_MODAL_SESSION_KEY = "jjk-v224-update-modal-seen";
let updateNoticeReady = false;
let updateNoticeEventsBound = false;
const DUEL_VISUAL_DEFAULT_SETTINGS = Object.freeze({
  theme: "original",
  cardSkin: "v224",
  compactCards: false,
  customSkin: null
});
const DUEL_SKIN_CATEGORIES = Object.freeze(["template", "special", "domain", "summon", "mahoraga", "trial"]);
const DUEL_SKIN_COLOR_FIELDS = Object.freeze(["background", "border", "accent", "text", "muted", "glow"]);
const LIFE_WHEEL_RUN_DRAFT_STORAGE_KEY = "jjk-life-wheel-run-draft-v1";
const LIFE_WHEEL_RUN_DRAFT_SCHEMA = "jjk-life-wheel-run-draft";

function normalizeDuelCpuDifficulty(value) {
  const key = String(value || "").trim().toLowerCase();
  return ["easy", "normal", "hard"].includes(key) ? key : "normal";
}

function readDuelCpuDifficulty() {
  try {
    return normalizeDuelCpuDifficulty(window.localStorage.getItem(DUEL_CPU_DIFFICULTY_STORAGE_KEY));
  } catch {
    return "normal";
  }
}

function saveDuelCpuDifficulty(value = state.duelCpuDifficulty) {
  const next = normalizeDuelCpuDifficulty(value);
  state.duelCpuDifficulty = next;
  try {
    window.localStorage.setItem(DUEL_CPU_DIFFICULTY_STORAGE_KEY, next);
  } catch {
    // Local storage may be unavailable; the current session value still works.
  }
  return next;
}

function syncDuelCpuDifficultyControls() {
  state.duelCpuDifficulty = normalizeDuelCpuDifficulty(state.duelCpuDifficulty);
  if (els.duelCpuDifficultySelect) els.duelCpuDifficultySelect.value = state.duelCpuDifficulty;
}

function updateDuelCpuDifficultyFromControls() {
  saveDuelCpuDifficulty(els.duelCpuDifficultySelect?.value || "normal");
  if (state.duelBattle && state.duelBattle.mode === "solo" && !state.duelBattle.resolved) {
    state.duelBattle.cpuDifficulty = state.duelCpuDifficulty;
    state.duelBattle.cpuDifficultyLabel = els.duelCpuDifficultySelect?.selectedOptions?.[0]?.textContent || "";
  }
  renderDuelMode();
}

function cloneDuelVisualDefaultSettings() {
  return {
    theme: DUEL_VISUAL_DEFAULT_SETTINGS.theme,
    cardSkin: DUEL_VISUAL_DEFAULT_SETTINGS.cardSkin,
    compactCards: DUEL_VISUAL_DEFAULT_SETTINGS.compactCards,
    customSkin: null
  };
}

function sanitizeDuelUiTheme(value) {
  return String(value || "") === "dark" ? "dark" : "original";
}

function sanitizeDuelCardSkin(value) {
  const key = String(value || "");
  return ["classic", "v224", "custom", "champion-kashimo"].includes(key) ? key : "v224";
}

function sanitizeDuelCssValue(value) {
  const text = String(value || "").trim().slice(0, 180);
  if (!text) return "";
  if (/[;{}]/.test(text) || /url\s*\(/i.test(text)) return "";
  if (!/^[#(),.%\w\s-]+$/i.test(text)) return "";
  return text;
}

function normalizeDuelSkinCategoryConfig(config) {
  if (!config || typeof config !== "object") return null;
  const normalized = {};
  DUEL_SKIN_COLOR_FIELDS.forEach((field) => {
    const value = sanitizeDuelCssValue(config[field]);
    if (value) normalized[field] = value;
  });
  return Object.keys(normalized).length ? normalized : null;
}

function normalizeDuelSkinConfig(source) {
  const payload = source?.skin && typeof source.skin === "object" ? source.skin : source;
  if (!payload || typeof payload !== "object") {
    throw new Error("皮肤文件必须是 JSON 对象。");
  }
  const schema = String(payload.schema || "").trim();
  if (schema && schema !== "jjk-duel-card-skin") {
    throw new Error("schema 必须为 jjk-duel-card-skin。");
  }
  const sourceCards = payload.cards || payload.cardSkins || payload.categories || {};
  const cards = {};
  DUEL_SKIN_CATEGORIES.forEach((category) => {
    const normalized = normalizeDuelSkinCategoryConfig(sourceCards[category]);
    if (normalized) cards[category] = normalized;
  });
  if (!Object.keys(cards).length) {
    throw new Error("皮肤文件至少要在 cards 内提供一个分类配置。");
  }
  return {
    schema: "jjk-duel-card-skin",
    version: String(payload.version || "1.0.0").slice(0, 24),
    name: String(payload.name || "自定义卡牌皮肤").trim().slice(0, 40) || "自定义卡牌皮肤",
    author: String(payload.author || "").trim().slice(0, 40),
    cards
  };
}

function normalizeDuelVisualSettings(settings) {
  const next = cloneDuelVisualDefaultSettings();
  if (settings && typeof settings === "object") {
    next.theme = sanitizeDuelUiTheme(settings.theme);
    next.cardSkin = sanitizeDuelCardSkin(settings.cardSkin);
    next.compactCards = Boolean(settings.compactCards);
    if (settings.customSkin) {
      try {
        next.customSkin = normalizeDuelSkinConfig(settings.customSkin);
      } catch {
        next.customSkin = null;
      }
    }
  }
  if (next.cardSkin === "custom" && !next.customSkin) {
    next.cardSkin = "v224";
  }
  return next;
}

function readDuelVisualSettings() {
  try {
    const raw = window.localStorage.getItem(DUEL_VISUAL_SETTINGS_STORAGE_KEY);
    return raw ? normalizeDuelVisualSettings(JSON.parse(raw)) : cloneDuelVisualDefaultSettings();
  } catch {
    return cloneDuelVisualDefaultSettings();
  }
}

function saveDuelVisualSettings() {
  try {
    window.localStorage.setItem(
      DUEL_VISUAL_SETTINGS_STORAGE_KEY,
      JSON.stringify(normalizeDuelVisualSettings(state.duelVisualSettings))
    );
  } catch {
    // Local storage may be unavailable in restricted browser modes.
  }
}

function setDuelVisualSettingsStatus(message, type = "info") {
  if (!els.duelVisualSettingsStatus) return;
  els.duelVisualSettingsStatus.textContent = message;
  els.duelVisualSettingsStatus.dataset.status = type;
}

function syncDuelVisualSettingsControls() {
  const settings = normalizeDuelVisualSettings(state.duelVisualSettings);
  state.duelVisualSettings = settings;
  if (els.duelUiThemeSelect) els.duelUiThemeSelect.value = settings.theme;
  if (els.duelCardSkinSelect) els.duelCardSkinSelect.value = settings.cardSkin;
  if (els.duelCompactCardToggle) els.duelCompactCardToggle.checked = Boolean(settings.compactCards);
}

function clearDuelCustomSkinCssVariables() {
  if (!document.body) return;
  const suffixMap = {
    background: "bg",
    border: "border",
    accent: "accent",
    text: "text",
    muted: "muted",
    glow: "glow"
  };
  DUEL_SKIN_CATEGORIES.forEach((category) => {
    Object.values(suffixMap).forEach((suffix) => {
      document.body.style.removeProperty(`--duel-skin-${category}-${suffix}`);
    });
  });
}

function applyDuelCustomSkinCssVariables(skin) {
  clearDuelCustomSkinCssVariables();
  if (!document.body || !skin?.cards) return;
  const suffixMap = {
    background: "bg",
    border: "border",
    accent: "accent",
    text: "text",
    muted: "muted",
    glow: "glow"
  };
  DUEL_SKIN_CATEGORIES.forEach((category) => {
    const config = skin.cards[category] || {};
    Object.entries(suffixMap).forEach(([field, suffix]) => {
      const value = sanitizeDuelCssValue(config[field]);
      if (value) document.body.style.setProperty(`--duel-skin-${category}-${suffix}`, value);
    });
  });
}

function getDuelVisualSkinLabel(settings) {
  if (settings.cardSkin === "classic") return "经典卡面";
  if (settings.cardSkin === "custom") return settings.customSkin?.name || "自定义卡面";
  if (settings.cardSkin === "champion-kashimo") return "第0届冠军卡面“鹿紫云依”";
  return "V2.24 新版分类卡面";
}

function refreshDuelRenderedCardSkinClasses(settings) {
  const mode = sanitizeDuelCardSkin(settings?.cardSkin);
  const modeClass = `duel-card-skin-${mode}`;
  document.querySelectorAll(".duel-hand-card").forEach((card) => {
    card.classList.remove(
      "duel-card-skin-classic",
      "duel-card-skin-v224",
      "duel-card-skin-custom",
      "duel-card-skin-champion-kashimo"
    );
    card.classList.add(modeClass);
    card.dataset.duelCardSkinMode = mode;
  });
}

function dispatchDuelVisualSettingsChanged(settings) {
  document.dispatchEvent(new CustomEvent("jjk-duel-visual-settings-changed", {
    detail: { settings }
  }));
}

function refreshDuelModeAfterVisualChange() {
  window.requestAnimationFrame(() => {
    if (typeof globalThis.renderDuelMode === "function") {
      globalThis.renderDuelMode();
    } else if (typeof renderDuelMode === "function") {
      renderDuelMode();
    }
  });
}

function applyDuelVisualSettings() {
  if (!document.body) return;
  const settings = normalizeDuelVisualSettings(state.duelVisualSettings);
  state.duelVisualSettings = settings;
  document.body.dataset.duelUiTheme = settings.theme;
  document.body.dataset.duelCardSkin = settings.cardSkin;
  document.body.classList.toggle("duel-theme-dark", settings.theme === "dark");
  document.body.classList.toggle("duel-card-skin-classic", settings.cardSkin === "classic");
  document.body.classList.toggle("duel-card-skin-v224", settings.cardSkin === "v224");
  document.body.classList.toggle("duel-card-skin-custom", settings.cardSkin === "custom");
  document.body.classList.toggle("duel-card-skin-champion-kashimo", settings.cardSkin === "champion-kashimo");
  document.body.classList.toggle("duel-compact-cards", Boolean(settings.compactCards));
  if (settings.cardSkin === "custom") {
    applyDuelCustomSkinCssVariables(settings.customSkin);
  } else {
    clearDuelCustomSkinCssVariables();
  }
  refreshDuelRenderedCardSkinClasses(settings);
  dispatchDuelVisualSettingsChanged(settings);
  syncDuelVisualSettingsControls();
  setDuelVisualSettingsStatus(`当前外观：${settings.theme === "dark" ? "黑夜模式" : "原色模式"} / ${getDuelVisualSkinLabel(settings)} / ${settings.compactCards ? "简洁卡面" : "完整卡面"}。`);
}

function updateDuelVisualSettingsFromControls() {
  const next = normalizeDuelVisualSettings({
    ...state.duelVisualSettings,
    theme: els.duelUiThemeSelect?.value,
    cardSkin: els.duelCardSkinSelect?.value,
    compactCards: Boolean(els.duelCompactCardToggle?.checked)
  });
  if (els.duelCardSkinSelect?.value === "custom" && !next.customSkin) {
    setDuelVisualSettingsStatus("尚未导入自定义皮肤，已保持 V2.24 新版分类卡面。", "warning");
  }
  state.duelVisualSettings = next;
  saveDuelVisualSettings();
  applyDuelVisualSettings();
  refreshDuelModeAfterVisualChange();
}

function resetDuelVisualSettings() {
  state.duelVisualSettings = cloneDuelVisualDefaultSettings();
  saveDuelVisualSettings();
  applyDuelVisualSettings();
  if (els.duelSkinImportFile) els.duelSkinImportFile.value = "";
  refreshDuelModeAfterVisualChange();
}

function downloadDuelTextFile(text, filename, type = "application/json;charset=utf-8") {
  if (typeof downloadTextFile === "function") {
    downloadTextFile(text, filename, type);
    return;
  }
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildDuelSkinSpecText() {
  return JSON.stringify({
    schema: "jjk-duel-card-skin",
    version: "1.0.0",
    name: "我的自制咒术对战卡面",
    author: "可选作者名",
    rules: [
      "cards 下可配置 template、special、domain、summon、mahoraga、trial 六个分类。",
      "每个分类支持 background、border、accent、text、muted、glow 字段。",
      "颜色可以使用 hex、rgb/rgba、hsl/hsla 或 linear-gradient；不要使用 url()、分号或 CSS 块。",
      "导入后只保存在当前浏览器 localStorage，不会上传到服务器。"
    ],
    cards: {
      template: {
        background: "linear-gradient(135deg, #fffdf7, #f4efe1)",
        border: "#c7b78c",
        accent: "#8a5a12",
        text: "#1f252b",
        muted: "#6b6255",
        glow: "rgba(138, 90, 18, 0.18)"
      },
      special: {
        background: "linear-gradient(135deg, #211514, #421916)",
        border: "#d16a55",
        accent: "#ffd166",
        text: "#fff7e6",
        muted: "#f4c7aa",
        glow: "rgba(225, 91, 79, 0.28)"
      },
      domain: {
        background: "linear-gradient(135deg, #171435, #3b236d)",
        border: "#9f7aea",
        accent: "#f6d365",
        text: "#f8f4ff",
        muted: "#d8c9ff",
        glow: "rgba(159, 122, 234, 0.28)"
      },
      summon: {
        background: "linear-gradient(135deg, #0f2f2c, #143c52)",
        border: "#2dd4bf",
        accent: "#99f6e4",
        text: "#ecfeff",
        muted: "#b7e8e2",
        glow: "rgba(45, 212, 191, 0.24)"
      },
      mahoraga: {
        background: "linear-gradient(135deg, #050505, #2f2610)",
        border: "#f6d365",
        accent: "#ffe8a3",
        text: "#fff7cc",
        muted: "#e9cf82",
        glow: "rgba(246, 211, 101, 0.34)"
      },
      trial: {
        background: "linear-gradient(135deg, #f9f5ee, #d8d0c2)",
        border: "#6b1f1a",
        accent: "#b42318",
        text: "#241c18",
        muted: "#6c5b4f",
        glow: "rgba(180, 35, 24, 0.18)"
      }
    }
  }, null, 2);
}

async function downloadDuelSkinSpec() {
  let text = buildDuelSkinSpecText();
  try {
    const response = await fetch(`./assets/duel-dynamics/card-skin-format.json?v=${APP_BUILD_VERSION}`);
    if (response.ok) text = await response.text();
  } catch {
    // The generated fallback above is enough for local file previews.
  }
  downloadDuelTextFile(text, "jjk-duel-card-skin-format.json", "application/json;charset=utf-8");
}

async function handleDuelSkinImportFile() {
  const file = els.duelSkinImportFile?.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const customSkin = normalizeDuelSkinConfig(parsed);
    state.duelVisualSettings = normalizeDuelVisualSettings({
      ...state.duelVisualSettings,
      cardSkin: "custom",
      customSkin
    });
    saveDuelVisualSettings();
    applyDuelVisualSettings();
    setDuelVisualSettingsStatus(`已导入自定义皮肤：${customSkin.name}。`);
    refreshDuelModeAfterVisualChange();
  } catch (error) {
    setDuelVisualSettingsStatus(`皮肤导入失败：${error?.message || error}`, "error");
  } finally {
    if (els.duelSkinImportFile) els.duelSkinImportFile.value = "";
  }
}

function closeV224UpdateModal() {
  if (!els.v224UpdateModal) return;
  els.v224UpdateModal.hidden = true;
  document.body?.classList.remove("update-modal-open");
  try {
    window.sessionStorage.setItem(V224_UPDATE_MODAL_SESSION_KEY, APP_BUILD_VERSION);
  } catch {
    // Session storage can be disabled; closing still works for this page load.
  }
}

function isV224UpdateModalSeen() {
  try {
    return window.sessionStorage.getItem(V224_UPDATE_MODAL_SESSION_KEY) === APP_BUILD_VERSION;
  } catch {
    return false;
  }
}

function dispatchUpdateNoticeReady() {
  document.dispatchEvent(new CustomEvent("jjk-update-notice-ready", {
    detail: {
      buildVersion: APP_BUILD_VERSION,
      ready: updateNoticeReady,
      seen: isV224UpdateModalSeen(),
      visible: Boolean(els.v224UpdateModal && !els.v224UpdateModal.hidden)
    }
  }));
}

function showV224UpdateModal() {
  updateNoticeReady = true;
  if (!els.v224UpdateModal) {
    dispatchUpdateNoticeReady();
    return false;
  }
  try {
    if (window.sessionStorage.getItem(V224_UPDATE_MODAL_SESSION_KEY) === APP_BUILD_VERSION) {
      dispatchUpdateNoticeReady();
      return false;
    }
  } catch {
    // Continue and show the notice.
  }
  els.v224UpdateModal.hidden = false;
  document.body?.classList.add("update-modal-open");
  dispatchUpdateNoticeReady();
  return true;
}

function bindUpdateNoticeEvents() {
  if (updateNoticeEventsBound) return;
  updateNoticeEventsBound = true;
  els.v224UpdateModalClose?.addEventListener("click", closeV224UpdateModal);
  els.v224UpdateModal?.querySelector("[data-v224-update-close]")?.addEventListener("click", closeV224UpdateModal);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && els.v224UpdateModal && !els.v224UpdateModal.hidden) closeV224UpdateModal();
  });
}

globalThis.JJKUpdateNotice = {
  show: showV224UpdateModal,
  close: closeV224UpdateModal,
  isReady: () => updateNoticeReady,
  isSeen: isV224UpdateModalSeen,
  buildVersion: APP_BUILD_VERSION
};

const DIRECT_SUKUNA_COMBAT_WHEEL_IDS = new Set([39, 129, 62, 40, 108, 41, 109, 131]);
const AI_REQUEST_TIMEOUT_MS = 150000;
const AI_PROVIDER_PREFLIGHT_TIMEOUT_MS = 20000;
const DUEL_AI_CHARACTER_TIMEOUT_MS = 420000;
const DUEL_AI_DESCRIPTION_MAX_CHARS = 800;
const AI_FREE_ANALYSIS_TIMEOUT_MS = 60000;
const AI_FREE_ANALYSIS_DEBOUNCE_MS = 700;
const DUEL_RANKS = ["E-", "E", "D", "C", "B", "A", "S", "SS", "SSS", "EX-", "EX"];
const DUEL_SPECIAL_TERM_MAX_ROUNDS = 30;
const DUEL_DEFAULT_CUSTOM_STATS = {
  cursedEnergy: "B",
  control: "B",
  efficiency: "B",
  body: "B",
  martial: "B",
  talent: "B"
};
const COMBAT_POWER_CODE_PREFIX = "JJKCP1";
const COMBAT_POWER_CODE_KEY = "site-1.386-combat-import-code-candidate";
const DUEL_SYSTEM_VERSION = "duel-system-v1.390A-ce-card-combat";
const DUEL_DOMAIN_RESPONSE_ACTION_IDS = getDuelDomainResponseActionIds();
const DUEL_DOMAIN_CLASS_LABELS = {
  rule_trial: "规则 / 审判",
  sure_hit_damage: "必中伤害",
  auto_attack: "自动攻击",
  control: "强控",
  environment_pressure: "环境压制",
  jackpot_rule: "规则 / 赌博",
  hybrid: "混合领域"
};
const DUEL_DOMAIN_BARRIER_LABELS = {
  closed_barrier: "封闭领域",
  open_barrier: "开放领域",
  incomplete_barrier: "未完成领域",
  rule_barrier: "规则型领域",
  hybrid_barrier: "混合领域",
  pseudo_domain: "类领域",
  unknown: "未知形态"
};
const DUEL_DOMAIN_COMPLETION_LABELS = {
  complete: "完成",
  incomplete: "未完成",
  unstable: "不稳定",
  conditional: "条件型",
  unknown: "未知"
};
const DUEL_DOMAIN_SWITCH_LABELS = {
  fixed: "固定",
  can_shift: "可切换",
  forced_by_context: "受环境影响",
  none: "不可切换",
  unknown: "未知"
};
const DUEL_LOG_CATEGORY_LABELS = {
  resource: "资源变化",
  hand: "术式手札",
  action: "手法选择",
  domain: "领域变化",
  response: "领域应对",
  subphase: "规则子阶段",
  trialTarget: "审判对象",
  verdict: "裁定结果",
  exorcismRuling: "祓除裁定",
  objectConfiscation: "对象没收",
  controllerRedirect: "操控链裁定",
  meltdown: "领域崩解 / 术式烧断",
  aiNarrative: "AI 叙事",
  system: "系统提示"
};
const DUEL_GRADE_OPTIONS = [
  { value: "support", label: "辅助人员" },
  { value: "grade4", label: "四级" },
  { value: "grade3", label: "三级" },
  { value: "grade2", label: "二级" },
  { value: "grade1", label: "一级" },
  { value: "specialGrade", label: "特级" }
];
const DUEL_STAGE_OPTIONS = [
  { value: "custom", label: "自定义/未锁定" },
  { value: "hiddenInventory", label: "怀玉" },
  { value: "volume0", label: "0卷" },
  { value: "shibuya", label: "涩谷" },
  { value: "cullingGame", label: "死灭回游" },
  { value: "shinjuku", label: "新宿决战" },
  { value: "heianToShinjuku", label: "平安/新宿基准" },
  { value: "after68", label: "68年后" }
];
const DEFAULT_WHEEL_SETTINGS = {
  preDelayMs: 0,
  spinDurationMs: 3400,
  resultHoldMs: 2000,
  choiceDelayMs: 350,
  animationEnabled: true,
  soundEnabled: true,
  speechEnabled: true
};
const WHEEL_SETTING_LIMITS = {
  preDelayMs: { min: 0, max: 5000, step: 100 },
  spinDurationMs: { min: 300, max: 10000, step: 100 },
  resultHoldMs: { min: 0, max: 10000, step: 100 },
  choiceDelayMs: { min: 0, max: 5000, step: 50 }
};
const DUEL_CURATED_DOMAIN_TAGS = [
  "领域展开",
  "无量空处",
  "伏魔御厨子",
  "坐杀搏徒",
  "自闭圆顿裹",
  "诛伏赐死",
  "三重疾苦",
  "神秘农家乐（虎杖悠仁领域变体）"
];
const DUEL_CURATED_EXTERNAL_RESOURCES = [
  "式神资源",
  "十影式神",
  "魔虚罗",
  "咒灵库存",
  "里香资源",
  "咒骸/傀儡军团",
  "僵尸军团",
  "尸体操控素材",
  "咒具库",
  "黑绳库存",
  "领域坐标/结界资源"
];
const GLOBAL_USAGE_COUNTER = {
  provider: "jujutsu-life-ai-worker",
  domain: "maopaotabby-bigdogwoofwoof-jjk-wheel",
  canonicalUrl: "https://bigdogwoofwoof.pages.dev/",
  endpoint: "https://jujutsu-life-ai.maopaotabby-jjk-life.workers.dev/api/usage-stats",
  fallbackProvider: "hitscounter.dev",
  fallbackEndpoint: "https://hitscounter.dev/api/hit",
  requestTimeoutMs: 12000,
  allowedHosts: ["bigdogwoofwoof.pages.dev", "119.91.224.223"],
  timezone: "Asia/Shanghai",
  utcOffsetMinutes: 480,
  label: "open"
};

const JJK_LORE_INDEX = [
  {
    id: "lore-cursed-energy",
    title: "咒力与残秽",
    summary: "咒力来自负面情绪；术师行动会留下可被追踪的咒力残秽，因此隐蔽行动、术师追查和任务后果应考虑残秽控制。",
    tags: ["cursedEnergy", "residue", "society"],
    confidence: "high"
  },
  {
    id: "lore-technique",
    title: "生得术式与术式公开",
    summary: "生得术式是角色战斗方式的核心；公开术式可能暴露情报，但也能通过风险交换强化效果，适合转化为叙事代价和战斗收益。",
    tags: ["innateTechnique", "binding", "combat"],
    confidence: "high"
  },
  {
    id: "lore-binding",
    title: "束缚",
    summary: "束缚是以限制、代价或承诺换取收益的咒术机制；高收益不应无代价出现，长期叙事中应记录束缚债或反噬风险。",
    tags: ["binding", "risk", "combat"],
    confidence: "high"
  },
  {
    id: "lore-rct-domain",
    title: "反转术式与领域",
    summary: "反转术式显著提高生存和支援价值；领域展开代表术式理解和咒力操作的高阶体现，但不应把辅助型术式自动写成高杀伤领域。",
    tags: ["rct", "domain", "advancedTechnique"],
    confidence: "high"
  },
  {
    id: "lore-ranking",
    title: "任务评级与术师等级",
    summary: "辅助、四级、三级、二级、一级、特别一级、特级是咒术社会判断任务和战力的粗粒度体系；一级以上会改变任务权限、名望和风险暴露。",
    tags: ["grade", "society", "mission"],
    confidence: "high"
  },
  {
    id: "lore-society",
    title: "高专、总监部、御三家与诅咒师",
    summary: "咒术社会并非纯战斗舞台，高专关系、总监部/高层、御三家、辅助监督、窗和诅咒师网络都会影响角色能接触的信息、任务和风险。",
    tags: ["society", "faction", "politics"],
    confidence: "high"
  },
  {
    id: "lore-curses",
    title: "咒灵与术师机制差异",
    summary: "咒灵、受肉体、人类术师和普通人的机制不同；反转术式正能量、咒具、领域和身份阵营都应按机制差异处理，而不是统一写成普通超能力。",
    tags: ["curse", "incarnated", "rct", "identity"],
    confidence: "high"
  }
];

const WHEEL_COLORS = [
  "#ff3b30",
  "#3a86ff",
  "#ffbe0b",
  "#8338ec",
  "#06d6a0",
  "#ff006e",
  "#00bbf9",
  "#fb5607",
  "#80ed99",
  "#7c3aed",
  "#f15bb5",
  "#00c2a8",
  "#fee440",
  "#536dfe",
  "#a3e635",
  "#ff7a00",
  "#2dd4bf",
  "#ffd166"
];

const EFFORT_ADVANCED_TECHNIQUE_CAP = 1;
const PLAY_MODE_VALUES = new Set(["random", "semi"]);
const AI_FREE_MAX_TEXT_LENGTH = 280;
const AI_FREE_BIAS_KEYS = [
  "highSchool",
  "sukuna",
  "kenjaku",
  "selfTeam",
  "training",
  "investigation",
  "survival",
  "aggression",
  "binding",
  "healing"
];
const AI_FREE_BOUNDARY_TEXT = "该行动不会直接改变当前结果，也不会直接改写角色生死、阵营或最终战胜负。";
const AI_FREE_BRIDGE_TASK_LIMIT = 2;
const AI_FREE_BRIDGE_BLOCKED_NODE_IDS = new Set([
  "identity",
  "startTime",
  "location",
  "age",
  "gender",
  "genderIdentity",
  "appearance",
  "occupation",
  "culture",
  "hobby",
  "assets",
  "personality",
  "luck",
  "cursedEnergy",
  "control",
  "martial",
  "body",
  "efficiency",
  "talent",
  "grade",
  "hasTechnique",
  "innateTechnique",
  "familyInnateTechnique",
  "advancedTechniqueCount",
  "advancedTechniques",
  "domainType",
  "domainEffectCount",
  "domainEffects",
  "hasTool",
  "toolCount",
  "tools",
  "effortLevel",
  "specialTalent",
  "heavenlyRestrictionType"
]);
const AI_FREE_PRESETS = [
  { id: "investigate", label: "调查", text: "先收集情报、观察咒力残秽和各方动向，再决定下一步行动。" },
  { id: "protect", label: "保护", text: "优先保护同伴和普通人，必要时协助高专方控制局面。" },
  { id: "train", label: "修炼", text: "把本段经历当成修炼契机，开发术式、反转术式、领域或战斗经验。" },
  { id: "survive", label: "保命", text: "不恋战，保留情报和体力，必要时撤退、隐藏或等待更好的机会。" },
  { id: "attack", label: "强攻", text: "主动出击，抢先压制关键敌人，用术式、咒具或束缚争取胜机。" }
];

let aiFreeAnalysisPreviewTimer = 0;
let aiFreeAnalysisRequestSeq = 0;

const HALF_CUSTOM_NODE_IDS = new Set([
  "startTime",
  "location",
  "age",
  "gender",
  "genderIdentity",
  "appearance",
  "occupation",
  "culture",
  "hobby",
  "assets",
  "personality",
  "luck"
]);

const HALF_CUSTOM_NOTES = {
  startTime: "会影响从哪段剧情开始。",
  location: "会影响是否能加入高专，以及日本相关剧情资格。",
  personality: "会轻微影响隐藏权重，但不直接覆盖强度或胜负。"
};


function assertRequiredSiteModule(namespace) {
  const api = globalThis[namespace];
  if (!api || typeof api !== "object") {
    throw new Error(`${namespace} must be loaded before app.js; check index.html script order.`);
  }
  return api;
}

function resolveSiteModuleImplementation(namespace, exportName) {
  const api = assertRequiredSiteModule(namespace);
  const directImplementation = api[exportName];
  if (typeof directImplementation === "function") return directImplementation;
  if (typeof api.getHelper === "function") {
    try {
      if (!api.hasHelper || api.hasHelper(exportName)) {
        const helperImplementation = api.getHelper(exportName);
        if (typeof helperImplementation === "function") return helperImplementation;
      }
    } catch {
      // Some registries only accept declared helper keys; continue to binding lookup.
    }
  }
  if (typeof api.get === "function" && api.hasBinding?.(exportName)) {
    const boundImplementation = api.get(exportName);
    if (typeof boundImplementation === "function") return boundImplementation;
  }
  if (typeof api.getBinding === "function" && api.hasBinding?.(exportName)) {
    const boundImplementation = api.getBinding(exportName);
    if (typeof boundImplementation === "function") return boundImplementation;
  }
  throw new Error(`${namespace}.${exportName} must be exposed as a function before app.js can call ${exportName}.`);
}

function callSiteModuleImplementation(namespace, exportName, args) {
  return resolveSiteModuleImplementation(namespace, exportName)(...args);
}

function registerSiteModuleBoundaries() {
  const characterModule = assertRequiredSiteModule("JJKCharacter");
  const lifeWheelModule = assertRequiredSiteModule("JJKLifeWheel");
  if (typeof characterModule.register === "function") {
    characterModule.register({
      getDuelCharacterCards,
      evaluateDuelCharacterCard,
      renderDuelCharacterCard,
      buildCustomDuelCard,
      readCustomDuelForm,
      addCustomDuelCharacter,
      editCustomDuelCharacter,
      removeCustomDuelCharacter,
      clearCustomDuelCharacters,
      importLoginCardCharacters,
      removeLoginCardCharactersFromPool,
      importCombatPowerCodeToDuel,
      applyCombatPowerImportToDuelForm
    });
  }
  if (typeof lifeWheelModule.register === "function") {
    lifeWheelModule.register({
      getWheel,
      getTaskWheel,
      taskFromNode,
      expandTask,
      selectDynamicWheel,
      renderCurrentTask,
      buildWheelMarkup,
      spinWheel,
      drawOne,
      drawMultiple,
      getWeightedOptions,
      getAdjustedWeight,
      applyOptionEffects,
      getAutoResultForTask,
      advanceToNextTask
    });
  }
  if (typeof globalThis.JJKMain?.initializeSite === "function") {
    globalThis.JJKMain.initializeSite({ silent: true });
  }
}

function assertRequiredDuelModule(namespace) {
  const api = globalThis[namespace];
  if (!api || typeof api !== "object") {
    throw new Error(`${namespace} must be loaded before app.js; check index.html script order.`);
  }
  return api;
}

function resolveDuelModuleImplementation(namespace, exportName) {
  const api = assertRequiredDuelModule(namespace);
  const directImplementation = api[exportName];
  if (typeof directImplementation === "function") return directImplementation;
  if (typeof api.get === "function") {
    const boundImplementation = api.get(exportName);
    if (typeof boundImplementation === "function") return boundImplementation;
  }
  if (typeof api.getBinding === "function") {
    const boundImplementation = api.getBinding(exportName);
    if (typeof boundImplementation === "function") return boundImplementation;
  }
  throw new Error(`${namespace}.${exportName} must be exposed as a function before app.js can call ${exportName}.`);
}

function callDuelModuleImplementation(namespace, exportName, args, directImplementation) {
  assertRequiredDuelModule(namespace);
  const implementation = typeof directImplementation === "function"
    ? directImplementation
    : resolveDuelModuleImplementation(namespace, exportName);
  return implementation(...args);
}

function callDuelResourceImplementation(exportName, args, directImplementation) {
  return callDuelModuleImplementation("JJKDuelResource", exportName, args, directImplementation);
}

function callDuelActionsImplementation(exportName, args, directImplementation) {
  return callDuelModuleImplementation("JJKDuelActions", exportName, args, directImplementation);
}

function callDuelHandImplementation(exportName, args, directImplementation) {
  return callDuelModuleImplementation("JJKDuelHand", exportName, args, directImplementation);
}

function callDuelFeedbackImplementation(exportName, args, directImplementation) {
  return callDuelModuleImplementation("JJKDuelFeedback", exportName, args, directImplementation);
}

function callDuelEndConditionImplementation(exportName, args, directImplementation) {
  return callDuelModuleImplementation("JJKDuelEndCondition", exportName, args, directImplementation);
}

function callDuelDomainResponseImplementation(exportName, args, directImplementation) {
  return callDuelModuleImplementation("JJKDuelDomainResponse", exportName, args, directImplementation);
}

function callDuelDomainProfileImplementation(exportName, args, directImplementation) {
  return callDuelModuleImplementation("JJKDuelDomainProfile", exportName, args, directImplementation);
}

function callDuelRuleSubphaseImplementation(exportName, args, directImplementation) {
  return callDuelModuleImplementation("JJKDuelRuleSubphase", exportName, args, directImplementation);
}

function getDuelDomainResponseActionIds() {
  const ids = globalThis.JJKDuelDomainResponse?.DUEL_DOMAIN_RESPONSE_ACTION_IDS;
  if (!ids || typeof ids.has !== "function") {
    throw new Error("JJKDuelDomainResponse.DUEL_DOMAIN_RESPONSE_ACTION_IDS must be loaded before app.js.");
  }
  return ids;
}

function registerDuelDomainResponseDependencies(domainResponseModule) {
  const dependencies = {
    getDuelBattle: () => state.duelBattle,
    getCurrentDuelBattle: () => state.duelBattle,
    normalizeDuelDomainBarrierProfile,
    getDuelDomainBarrierModifiers,
    clamp
  };
  if (typeof domainResponseModule.registerDependencies === "function") {
    domainResponseModule.registerDependencies(dependencies);
    return;
  }
  if (typeof domainResponseModule.configure === "function") {
    domainResponseModule.configure(dependencies);
  }
}

function registerDuelDomainProfileDependencies(domainProfileModule) {
  const dependencies = {
    state,
    getDuelDomainProfilesData: () => state.duelDomainProfiles,
    getDuelBattle: () => state.duelBattle,
    getCurrentDuelBattle: () => state.duelBattle,
    isDuelDomainActivationAction,
    getDuelDomainProfileResponseImpact,
    buildDuelDomainTrialContext,
    createDuelTrialSubPhase,
    createDuelJackpotSubPhase,
    appendDuelDomainProfileLog,
    recordDuelResourceChange,
    clampDuelResource,
    clamp
  };
  if (typeof domainProfileModule.registerDependencies === "function") {
    domainProfileModule.registerDependencies(dependencies);
    return;
  }
  if (typeof domainProfileModule.configure === "function") {
    domainProfileModule.configure(dependencies);
  }
}

function registerDuelModuleBoundaries() {
  const resourceModule = assertRequiredDuelModule("JJKDuelResource");
  const actionsModule = assertRequiredDuelModule("JJKDuelActions");
  const cardTemplateModule = assertRequiredDuelModule("JJKDuelCardTemplate");
  const handModule = assertRequiredDuelModule("JJKDuelHand");
  const feedbackModule = assertRequiredDuelModule("JJKDuelFeedback");
  const endConditionModule = assertRequiredDuelModule("JJKDuelEndCondition");
  const domainResponseModule = assertRequiredDuelModule("JJKDuelDomainResponse");
  const domainProfileModule = assertRequiredDuelModule("JJKDuelDomainProfile");
  const ruleSubphaseModule = assertRequiredDuelModule("JJKDuelRuleSubphase");
  if (typeof resourceModule.registerDependencies === "function") {
    resourceModule.registerDependencies({
      getDuelResourceRules,
      duelRankValue,
      hasDuelDomainAccess,
      getCurrentDuelBattle: () => state.duelBattle,
      getDuelDomainBarrierModifiers,
      applyDuelDomainProfileOnActivation,
      updateDuelDomainTrialContext,
      invalidateDuelActionChoices
    });
  }
  if (typeof actionsModule.registerDependencies === "function") {
    actionsModule.registerDependencies({
      getDuelActionRules,
      getDuelMechanicTemplateRules,
      state,
      getDuelBattle: () => state.duelBattle,
      getDuelActionCost,
      getDuelProfileForSide,
      getDuelDomainResponseProfile,
      isDuelOpponentDomainThreat,
      hasDuelDomainCounterAccess,
      hashDuelSeed,
      clamp,
      syncDuelTrialSubPhaseLifecycle,
      updateDuelDomainTrialContext,
      normalizeDuelDomainSpecificAction,
      applyDuelDomainSpecificAction,
      applyDuelTrialAction,
      applyDuelJackpotAction,
      getDuelTrialOwnerActionTemplates,
      getDuelTrialDefenderActionTemplates,
      getDuelResourcePair,
      clampDuelResource,
      getDuelStatusEffectValue,
      appendDuelActionLog,
      recordDuelResourceChange,
      getDuelResourceSideLabel,
      formatSignedDuelDelta,
      DUEL_DOMAIN_RESPONSE_ACTION_IDS
    });
  }
  if (typeof cardTemplateModule.registerDependencies === "function") {
    cardTemplateModule.registerDependencies({
      state,
      getDuelCardTemplateRules,
      getDuelCardCopyRules
    });
  }
  if (typeof handModule.registerDependencies === "function") {
    handModule.registerDependencies({
      state,
      getDuelHandRules,
      getDuelCharacterCardRules,
      getDuelBattle: () => state.duelBattle,
      buildDuelActionPool,
      pickDuelActionChoices,
      getDuelCpuAction,
      getDuelActionAvailability,
      getDuelCardTemplateForAction: cardTemplateModule.getDuelCardTemplateForAction,
      buildDuelCardViewModel: cardTemplateModule.buildDuelCardViewModel,
      applyDuelActionEffect,
      getDuelActionCost,
      getDuelResourcePair,
      clampDuelResource,
      appendDuelActionLog,
      recordDuelResourceChange
    });
  }
  if (typeof feedbackModule.registerDependencies === "function") {
    feedbackModule.registerDependencies({
      state,
      getAppBuildVersion: () => APP_BUILD_VERSION,
      getDuelBetaCopy,
      getDuelSelectedHandActions,
      getDuelApState,
      getDuelHandCardViewModel,
      getDuelCardTemplateForAction: cardTemplateModule.getDuelCardTemplateForAction,
      getDuelCardTemplateIndex: cardTemplateModule.getDuelCardTemplateIndex,
      getDuelCardTemplateFallbackStats: cardTemplateModule.getDuelCardTemplateFallbackStats,
      getDuelActionTemplateIndex: actionsModule.getDuelActionTemplateIndex,
      getDuelMechanicTemplateIndex: actionsModule.getDuelMechanicTemplateIndex
    });
  }
  if (!endConditionModule.metadata || endConditionModule.metadata.scriptType !== "classic") {
    throw new Error("JJKDuelEndCondition must be loaded as a classic script before app.js.");
  }
  registerDuelDomainProfileDependencies(domainProfileModule);
  registerDuelDomainResponseDependencies(domainResponseModule);
  if (typeof ruleSubphaseModule.registerDependencies === "function") {
    ruleSubphaseModule.registerDependencies({
      state,
      getDuelBattle: () => state.duelBattle,
      getCurrentDuelBattle: () => state.duelBattle,
      getDuelTrialTargetRulesData: () => state.duelTrialTargetRules,
      getDuelProfileForSide,
      getDuelResourcePair,
      getDuelStatusEffectValue,
      clampDuelResource,
      invalidateDuelActionChoices,
      appendDuelDomainProfileLog,
      formatNumber,
      formatSignedDuelDelta,
      clamp
    });
  }
}

function normalizeCharacterRecord(raw) {
  const name = raw?.name || raw?.displayName || raw?.characterId || "";
  const cleanRuntimeList = (value) => (Array.isArray(value) ? value : [])
    .map((item) => String(item || "").trim())
    .filter((item) => item && item !== "无");
  const specialTagEvidenceText = [
    raw?.name,
    raw?.displayName,
    raw?.technique,
    raw?.techniqueName,
    raw?.techniqueText,
    raw?.techniqueDescription,
    raw?.domainProfile,
    raw?.externalResource,
    raw?.notes
  ].concat(
    cleanRuntimeList(raw?.innateTraits),
    cleanRuntimeList(raw?.advancedTechniques),
    cleanRuntimeList(raw?.loadout),
    cleanRuntimeList(raw?.traits),
    cleanRuntimeList(raw?.selectedMechanisms),
    cleanRuntimeList(raw?.selectedToolTags)
  ).filter(Boolean).join(" ");
  const normalizeTagList = (value) => Array.from(new Set([]
    .concat(Array.isArray(value) ? value : [])
    .map((tag) => String(tag || "").trim())
    .filter((tag) => tag && tag !== "无")));
  const sanitizeTechniqueSpecialHandTags = (tags) => {
    const normalized = normalizeTagList(tags);
    const hasConstruction = /构筑术式|真球|液态金属|昆虫铠甲|三重疾苦|禅院真依|真依|yorozu|construction\s+sorcery/i.test(specialTagEvidenceText) ||
      /(^|[\s、，,;；|/／])万($|[\s、，,;；|/／])/i.test(specialTagEvidenceText);
    const hasBlood = /赤血操术|穿血|血刃|赤鳞跃动|超新星|苅祓|百敛|胀相|脹相|加茂宪纪|加茂憲紀|blood\s+manipulation/i.test(specialTagEvidenceText);
    const knownEvidence = {
      ten_shadows: /十种影法术|十种影|十影|嵌合暗翳庭|魔虚罗|魔須羅|魔须罗|mahoraga|ten[_\s-]?shadows/i,
      projection_sorcery: /投射术式|投射咒法|二十四帧|帧率|直哉|直毘人|projection\s+sorcery/i,
      star_rage: /星之怒|虚拟质量|凰轮|黑洞|九十九由基|star\s+rage/i,
      limitless: /无下限|无量空处|赫|苍|茈|六眼|limitless|infinity/i,
      shrine: /御厨子|伏魔御厨子|斩击|捌|解|sukuna|shrine|cleave|dismantle/i
    };
    return normalized.filter((tag) => {
      if (tag === "construction") return hasConstruction;
      if (tag === "blood_manipulation") return hasBlood;
      if (/^custom_duel_|^custom_hand_|^duel_ai_term_/.test(tag)) return true;
      if (knownEvidence[tag]) return knownEvidence[tag].test(specialTagEvidenceText);
      return true;
    });
  };
  const specialHandTags = sanitizeTechniqueSpecialHandTags([]
    .concat(Array.isArray(raw?.specialHandTags) ? raw.specialHandTags : [])
    .concat(Array.isArray(raw?.["特殊手札"]) ? raw["特殊手札"] : []));
  return {
    ...raw,
    name,
    displayName: raw?.displayName || name,
    innateTraits: cleanRuntimeList(raw?.innateTraits),
    advancedTechniques: cleanRuntimeList(raw?.advancedTechniques),
    loadout: cleanRuntimeList(raw?.loadout),
    selectedMechanisms: cleanRuntimeList(raw?.selectedMechanisms),
    selectedToolTags: cleanRuntimeList(raw?.selectedToolTags),
    specialHandTags,
    "特殊手札": specialHandTags
  };
}

function mergeCharacterManifestEntryRecord(entry, raw) {
  if (!entry || typeof entry === "string") return raw;
  const manifestSpecialHandTags = []
    .concat(Array.isArray(entry.specialHandTags) ? entry.specialHandTags : [])
    .concat(Array.isArray(entry["特殊手札"]) ? entry["特殊手札"] : []);
  if (!manifestSpecialHandTags.length) return raw;
  return {
    ...entry,
    ...raw,
    specialHandTags: []
      .concat(manifestSpecialHandTags)
      .concat(Array.isArray(raw?.specialHandTags) ? raw.specialHandTags : []),
    "特殊手札": []
      .concat(manifestSpecialHandTags)
      .concat(Array.isArray(raw?.["特殊手札"]) ? raw["特殊手札"] : [])
  };
}

async function loadCharacterCards() {
  try {
    const manifest = await fetch(`./character/manifest.json?v=${APP_BUILD_VERSION}`).then((r) => {
      if (!r.ok) throw new Error(`character manifest ${r.status}`);
      return r.json();
    });
    const entries = Array.isArray(manifest?.characters) ? manifest.characters : [];
    const cards = await Promise.all(entries.map((entry) => {
      const file = typeof entry === "string" ? entry : entry?.file;
      if (!file) return null;
      return fetch(`./character/${encodeURIComponent(file)}?v=${APP_BUILD_VERSION}`).then((r) => {
        if (!r.ok) throw new Error(`character file ${file} ${r.status}`);
        return r.json();
      }).then((raw) => normalizeCharacterRecord(mergeCharacterManifestEntryRecord(entry, raw)));
    }));
    return {
      schema: manifest.schema || "jjk-character-cards",
      version: manifest.version || "character-folder",
      status: manifest.status || "APPROVED_FOR_PROTOTYPE",
      approvedByUserAt: manifest.approvedByUserAt || "",
      scope: manifest.scope || "named-character calibration anchors for instant combat profile",
      notes: manifest.notes || [],
      cards: cards.filter(Boolean)
    };
  } catch (error) {
    console.warn("Character folder load failed; falling back to legacy character bundle.", error);
    return fetch(`./data/character-cards-v0.1.json?v=${APP_BUILD_VERSION}`).then((r) => r.json());
  }
}

//--启动与事件绑定--//
async function init() {
  bindUpdateNoticeEvents();
  showV224UpdateModal();
  const [wheels, flow, strength, characterCards, mechanisms, calibrationBattles, optionEffects, duelResourceRules, duelActionRules, handRulesCandidate, duelSpecialCards, duelCharacterCardRules, duelCardTemplateRules, duelCardCopyRules, duelMechanicRules, duelEndRules, duelBetaCopy, duelDomainProfiles, duelTrialTargetRules, aiProviderRules, aiPromptTemplates, cardPrompt] = await Promise.all([
    fetch(`./data/wheels.json?v=${APP_BUILD_VERSION}`).then((r) => r.json()),
    fetch(`./data/flow-v1-candidate.json?v=${APP_BUILD_VERSION}`).then((r) => r.json()),
    fetch(`./data/strength-v0.2-candidate.json?v=${APP_BUILD_VERSION}`).then((r) => r.json()),
    loadCharacterCards(),
    fetch(`./data/mechanism-cards-v0.1.json?v=${APP_BUILD_VERSION}`).then((r) => r.json()),
    fetch(`./data/calibration-battles-v0.1.json?v=${APP_BUILD_VERSION}`).then((r) => r.json()),
    fetch(`./data/option-effects-v0.1.json?v=${APP_BUILD_VERSION}`).then((r) => r.json()),
    fetch(`./data/duel-resource-rules-v0.1-candidate.json?v=${APP_BUILD_VERSION}`).then((r) => r.json()),
    fetch(`./data/duel-action-templates-v0.1-candidate.json?v=${APP_BUILD_VERSION}`).then((r) => r.json()),
    fetch(`./data/duel-hand-rules-v0.1-candidate.json?v=${APP_BUILD_VERSION}`).then((r) => r.json()),
    fetch(`./data/duel-special-card.json?v=${APP_BUILD_VERSION}`).then((r) => r.json()),
    fetch(`./data/duel-character-card-rules-v0.1-candidate.json?v=${APP_BUILD_VERSION}`).then((r) => r.json()),
    fetch(`./data/duel-card-templates-v0.1-candidate.json?v=${APP_BUILD_VERSION}`).then((r) => r.json()),
    fetch(`./data/duel-card-copy-v0.1-candidate.json?v=${APP_BUILD_VERSION}`).then((r) => r.json()),
    fetch(`./data/duel-mechanic-templates-v0.1-candidate.json?v=${APP_BUILD_VERSION}`).then((r) => r.json()),
    fetch(`./data/duel-end-rules-v0.1-candidate.json?v=${APP_BUILD_VERSION}`).then((r) => r.json()),
    fetch(`./data/duel-beta-copy-v0.1-candidate.json?v=${APP_BUILD_VERSION}`).then((r) => r.json()),
    fetch(`./data/duel-domain-profiles-v0.1-candidate.json?v=${APP_BUILD_VERSION}`).then((r) => r.json()),
    fetch(`./data/duel-trial-target-rules-v0.1-candidate.json?v=${APP_BUILD_VERSION}`).then((r) => r.json()),
    fetch(`./data/ai-provider-rules-v0.1-candidate.json?v=${APP_BUILD_VERSION}`).then((r) => r.json()),
    fetch(`./data/ai-prompt-templates-v0.1-candidate.json?v=${APP_BUILD_VERSION}`).then((r) => r.json()),
    fetch(`./data/card_prompt.json?v=${APP_BUILD_VERSION}`).then((r) => r.json())
  ]);

  state.wheels = wheels;
  state.flow = flow;
  state.strength = strength;
  state.characterCards = characterCards;
  state.mechanisms = mechanisms;
  state.calibrationBattles = calibrationBattles;
  state.optionEffects = optionEffects;
  state.duelResourceRules = duelResourceRules;
  state.duelActionRules = duelActionRules;
  state.techniqueHandRules = handRulesCandidate;
  state.duelSpecialCards = duelSpecialCards;
  state.duelCharacterCardRules = duelCharacterCardRules;
  state.duelCardTemplateRules = duelCardTemplateRules;
  state.duelCardCopyRules = duelCardCopyRules;
  state.duelMechanicRules = duelMechanicRules;
  state.duelEndRules = duelEndRules;
  state.duelBetaCopy = duelBetaCopy;
  state.duelDomainProfiles = duelDomainProfiles;
  state.duelTrialTargetRules = duelTrialTargetRules;
  state.aiProviderRules = aiProviderRules;
  state.aiPromptTemplates = aiPromptTemplates;
  state.cardPrompt = cardPrompt;
  state.aiPromptAssets = registerAiPromptAssets(aiProviderRules, aiPromptTemplates, cardPrompt);
  state.optionEffectIndex = buildOptionEffectIndex(optionEffects);
  state.wheelMap = new Map(wheels.wheels.map((wheel) => [String(wheel.dbId), wheel]));

  state.usageStats = readUsageStats();
  state.wheelSettings = readWheelSettings();
  state.duelVisualSettings = readDuelVisualSettings();
  state.duelCpuDifficulty = readDuelCpuDifficulty();
  applyDuelVisualSettings();
  incrementUsageStat("pageLoads", { global: true });
  bindEvents();
  syncWheelSettingsControls();
  syncDuelVisualSettingsControls();
  syncDuelCpuDifficultyControls();
  syncDebugMode();
  initializeDuelCustomPanel();
  globalThis.JJKLoginCard?.syncRuntimeReady?.();
  renderFlowTree();
  renderFlowGraph();
  renderWheelLibrary();
  renderCreatorTemplatePreview();
  getBattlePageModule()?.initialize?.();
  syncDuelModeIsolation();
  renderDuelMode();
  initializeAiNarrativePanel();
  if (!restoreLifeWheelRunDraft()) {
    restart();
  } else {
    renderAll();
  }
  document.dispatchEvent(new CustomEvent("jjk-runtime-ready", {
    detail: { buildVersion: APP_BUILD_VERSION, updateNoticeReady }
  }));
}

function bindEvents() {
  initializeMobileTopbarBehavior();

  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      if (tab.dataset.tab === "aiNarrative") trackMobileDebugGesture("lifeFile");
      els.tabs.forEach((item) => item.classList.remove("active"));
      els.panels.forEach((panel) => panel.classList.remove("active"));
      tab.classList.add("active");
      document.querySelector(`#${tab.dataset.tab}`).classList.add("active");
    });
  });

  els.restartBtn.addEventListener("click", handleRestartButtonClick);
  bindWheelSettingsControls();
  els.playModeInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (isDrawModeInteractionLocked()) {
        syncPlayMode();
        return;
      }
      if (!input.checked) return;
      state.playMode = PLAY_MODE_VALUES.has(input.value) ? input.value : "random";
      syncPlayMode();
      renderAll();
      saveLifeWheelRunDraft();
    });
  });
  els.aiFreeToggle?.addEventListener("change", () => {
    if (isDrawModeInteractionLocked()) {
      syncPlayMode();
      return;
    }
    state.aiFreeEnabled = Boolean(els.aiFreeToggle.checked);
    syncPlayMode();
    renderAll();
    saveLifeWheelRunDraft();
  });
  document.addEventListener("keydown", handleDebugSummonKeydown);
  els.feedbackContactBtn?.addEventListener("click", handleFeedbackContactClick);
  els.debugToggle.addEventListener("change", () => {
    if (els.debugToggle.checked) {
      const code = window.prompt("请输入调试模式执行代码");
      state.debugMode = code === DEBUG_ACCESS_CODE;
      if (!state.debugMode) {
        window.alert("执行代码错误，已保持普通模式。");
      }
    } else {
      state.debugMode = false;
    }
    syncDebugMode();
    renderFlowTree();
    renderFlowGraph();
    renderWheelLibrary();
    renderAll();
  });
  els.drawBtn.addEventListener("click", drawCurrent);
  els.runAllBtn.addEventListener("click", runAllDebug);
  els.nextBtn.hidden = true;
  els.downloadMdBtn.addEventListener("click", downloadMarkdown);
  els.combatExportBtn?.addEventListener("click", exportCombatPowerCode);
  els.exportBtn.addEventListener("click", toggleExport);
  els.generateTemplateBtn?.addEventListener("click", renderCreatorTemplatePreview);
  els.debugEntrySelect?.addEventListener("change", loadDebugEntryEditorSelection);
  els.debugEntryAddBtn?.addEventListener("click", addDebugEntry);
  els.debugEntrySaveBtn?.addEventListener("click", saveDebugEntry);
  els.debugEntryDeleteBtn?.addEventListener("click", deleteDebugEntry);
  els.aiProviderMode?.addEventListener("change", () => {
    syncAiProviderForMode(true);
    saveAiProviderSettings();
    updateAiProviderUi();
    updateAiNarrativeStatus(getAiEndpointModeHint());
  });
  els.aiProviderIdInput?.addEventListener("change", () => {
    syncAiModeForProvider();
    saveAiProviderSettings();
    updateAiProviderUi();
  });
  els.aiBaseUrlInput?.addEventListener("change", saveAiProviderSettings);
  els.aiPathInput?.addEventListener("change", saveAiProviderSettings);
  els.aiModelInput?.addEventListener("change", saveAiProviderSettings);
  els.aiOutputTokenInput?.addEventListener("change", saveAiProviderSettings);
  els.aiByokPersistLocal?.addEventListener("change", saveAiProviderSettings);
  els.aiByokKeyInput?.addEventListener("change", saveAiProviderSettings);
  els.aiByokRevealToggle?.addEventListener("click", toggleAiByokKeyVisibility);
  els.clearAiKeyBtn?.addEventListener("click", clearAiByokKey);
  els.clearAiAllSettingsBtn?.addEventListener("click", clearAllAiProviderSettings);
  els.testAiProviderBtn?.addEventListener("click", testAiProviderConnection);
  els.aiAdminLoginBtn?.addEventListener("click", loginAiAdminMode);
  els.globalSettingsBtn?.addEventListener("click", () => toggleGlobalSettingsPanel());
  els.globalSettingsCloseBtn?.addEventListener("click", () => toggleGlobalSettingsPanel(false));
  els.generateAiNarrativeBtn?.addEventListener("click", generateAiNarrative);
  els.duelAiAssistToggle?.addEventListener("change", () => {
    window.localStorage.setItem(DUEL_AI_ASSIST_STORAGE_KEY, els.duelAiAssistToggle.checked ? "yes" : "no");
    syncDuelAiAssistPanel();
  });
  els.duelCustomModeInputs?.forEach((input) => {
    input.addEventListener("change", syncDuelCustomMode);
  });
  els.duelApplyLibraryBtn?.addEventListener("click", applyDuelLibrarySelectionToFields);
  els.duelAiAnalyzeBtn?.addEventListener("click", analyzeCustomDuelWithAi);
  els.duelManualDataApplyBtn?.addEventListener("click", applyDuelManualDataInput);
  els.duelLeftSelect?.addEventListener("change", () => {
    state.duelBattle = null;
    renderDuelMode();
  });
  els.duelRightSelect?.addEventListener("change", () => {
    state.duelBattle = null;
    renderDuelMode();
  });
  els.duelCpuDifficultySelect?.addEventListener("change", updateDuelCpuDifficultyFromControls);
  els.duelSwapBtn?.addEventListener("click", swapDuelCharacters);
  els.duelStartBtn?.addEventListener("click", () => startDuelBattle({ mode: "solo" }));
  els.duelUiThemeSelect?.addEventListener("change", updateDuelVisualSettingsFromControls);
  els.duelCardSkinSelect?.addEventListener("change", updateDuelVisualSettingsFromControls);
  els.duelCompactCardToggle?.addEventListener("change", updateDuelVisualSettingsFromControls);
  els.duelSkinImportFile?.addEventListener("change", handleDuelSkinImportFile);
  els.duelSkinDownloadSpecBtn?.addEventListener("click", downloadDuelSkinSpec);
  els.duelVisualResetBtn?.addEventListener("click", resetDuelVisualSettings);
  bindUpdateNoticeEvents();
  document.addEventListener("jjk-battle-page-state", (event) => {
    const pageState = event.detail || {};
    state.duelModeState = {
      ...state.duelModeState,
      ...pageState
    };
    syncDuelModeIsolation();
  });
  document.addEventListener("jjk-login-card-characters-imported", (event) => {
    importLoginCardCharacters(event.detail?.characters || [], {
      source: event.detail?.source || "login-card",
      ownerId: event.detail?.ownerId || ""
    });
  });
  document.addEventListener("jjk-login-card-characters-removed", (event) => {
    removeLoginCardCharactersFromPool(event.detail?.characterIds || [], {
      ownerId: event.detail?.ownerId || ""
    });
  });
  document.addEventListener("jjk-login-card-auth-changed", () => {
    updateAiProviderUi();
    syncDuelAiAssistPanel();
    syncPlayMode();
  });
  els.duelCustomAddBtn?.addEventListener("click", addCustomDuelCharacter);
  els.duelImportCodeBtn?.addEventListener("click", importCombatPowerCodeToDuel);
  els.duelWheelImportBtn?.addEventListener("click", importWheelExportToCustomDuel);
  els.duelWheelImportCurrentBtn?.addEventListener("click", importCurrentWheelResultToCustomDuel);
  els.duelWheelImportFile?.addEventListener("change", readWheelImportFileToTextarea);
  els.duelCustomHandAddBtn?.addEventListener("click", addCustomDuelHandCard);
  els.duelCustomHandClearBtn?.addEventListener("click", clearPendingCustomDuelHandCards);
  els.customCharacterEntryButtons?.forEach((button) => {
    button.addEventListener("click", () => {
      window.setTimeout(() => els.customCharacterInterface?.scrollIntoView({ block: "start", behavior: "smooth" }), 80);
    });
  });
  els.duelCustomClearBtn?.addEventListener("click", clearCustomDuelCharacters);
  els.duelCustomList?.addEventListener("click", handleCustomDuelListClick);
  els.duelSpecialTermAddBtn?.addEventListener("click", addDuelSpecialTerm);
  els.duelSpecialTermClearBtn?.addEventListener("click", clearDuelSpecialTerms);
  els.duelSpecialTermList?.addEventListener("click", handleDuelSpecialTermListClick);
  [
    els.duelDebugLeftScore,
    els.duelDebugLeftUnit,
    els.duelDebugLeftRate,
    els.duelDebugRightScore,
    els.duelDebugRightUnit,
    els.duelDebugRightRate
  ].forEach((input) => {
    input?.addEventListener("input", () => {
      state.duelBattle = null;
      renderDuelMode();
    });
  });
  els.duelDebugClearBtn?.addEventListener("click", clearDuelDebugOverrides);
  els.resultLog.addEventListener("click", (event) => {
    const button = event.target.closest("[data-backtrack-id]");
    if (!button) return;
    backtrackToRecord(Number(button.dataset.backtrackId));
  });
}










