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
  techniqueFeatureHandCandidates: null,
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
  duelSpinToken: 0,
  customDuelCards: [],
  customDuelSeq: 0,
  customDuelEditId: "",
  pendingCustomDuelHandCards: [],
  pendingCustomDuelDomainScript: null,
  customDuelHandSeq: 0,
  duelSpecialTerms: [],
  duelSpecialTermSeq: 0,
  restoredLifeWheelDraft: null,
  mobileTopbarHidden: false,
  lastMobileScrollY: 0,
  usageStats: null,
  wheelSettings: null,
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
  duelAiOutput: document.querySelector("#duelAiOutput"),
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
  duelModeStatus: document.querySelector("#duelModeStatus")
};

const DEBUG_ACCESS_CODE = "258079";
const DEBUG_SUMMON_SEQUENCE = "258079";
const APP_BUILD_VERSION = "20260503-v2.15-ai-guardrail-ui";
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
const DUEL_AI_ASSIST_STORAGE_KEY = "jjk-duel-ai-assist-enabled-v1";
const WHEEL_SETTINGS_STORAGE_KEY = "jjk-wheel-player-settings-v1";
const LIFE_WHEEL_RUN_DRAFT_STORAGE_KEY = "jjk-life-wheel-run-draft-v1";
const LIFE_WHEEL_RUN_DRAFT_SCHEMA = "jjk-life-wheel-run-draft";
const DIRECT_SUKUNA_COMBAT_WHEEL_IDS = new Set([39, 129, 62, 40, 108, 41, 109, 131]);
const AI_REQUEST_TIMEOUT_MS = 150000;
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
  const specialHandTags = Array.from(new Set([]
    .concat(Array.isArray(raw?.specialHandTags) ? raw.specialHandTags : [])
    .concat(Array.isArray(raw?.["特殊手札"]) ? raw["特殊手札"] : [])
    .map((tag) => String(tag || "").trim())
    .filter((tag) => tag && tag !== "无")));
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
      }).then(normalizeCharacterRecord);
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
  const [wheels, flow, strength, characterCards, mechanisms, calibrationBattles, optionEffects, duelResourceRules, duelActionRules, handRulesCandidate, techniqueFeatureHandCandidates, duelCharacterCardRules, duelCardTemplateRules, duelCardCopyRules, duelMechanicRules, duelEndRules, duelBetaCopy, duelDomainProfiles, duelTrialTargetRules, aiProviderRules, aiPromptTemplates, cardPrompt] = await Promise.all([
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
    fetch(`./data/technique-feature-hand-drafts-v0.6-runtime-import-candidates.json?v=${APP_BUILD_VERSION}`).then((r) => r.json()),
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
  state.techniqueFeatureHandCandidates = techniqueFeatureHandCandidates;
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
  incrementUsageStat("pageLoads", { global: true });
  bindEvents();
  syncWheelSettingsControls();
  syncDebugMode();
  initializeDuelCustomPanel();
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
  els.duelLeftSelect?.addEventListener("change", () => {
    state.duelBattle = null;
    renderDuelMode();
  });
  els.duelRightSelect?.addEventListener("change", () => {
    state.duelBattle = null;
    renderDuelMode();
  });
  els.duelSwapBtn?.addEventListener("click", swapDuelCharacters);
  els.duelStartBtn?.addEventListener("click", () => startDuelBattle({ mode: "solo" }));
  document.addEventListener("jjk-battle-page-state", (event) => {
    const pageState = event.detail || {};
    state.duelModeState = {
      ...state.duelModeState,
      ...pageState
    };
    syncDuelModeIsolation();
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
