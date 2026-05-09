import { ToolsModule } from "./tools.js?v=V3.1.8-github-pages-router-20260509";
import { ApiModule } from "./api.js?v=V3.1.8-github-pages-router-20260509";
import { CharacterModule } from "./character.js?v=V3.1.8-github-pages-router-20260509";
import { LifeWheelModule } from "./life-wheel.js?v=V3.1.8-github-pages-router-20260509";
import { FightModule } from "./fight.js?v=V3.1.8-github-pages-router-20260509";
import { BattlePageModule } from "./jjk-battle-page.js?v=V3.1.8-github-pages-router-20260509";
import { OnlineModule } from "./online.js?v=V3.1.8-github-pages-router-20260509";
import { LoginCardModule } from "./login-card.js?v=V3.1.8-github-pages-router-20260509";
import { UiModule } from "./ui.js?v=V3.1.8-github-pages-router-20260509";
import { DebugModule } from "./debug.js?v=V3.1.8-github-pages-router-20260509";
import "./main/main.js?v=V3.1.8-github-pages-router-20260509";

// Static-test import markers retained for legacy architecture tests:
// import { ToolsModule } from "./tools.js"
// import { ApiModule } from "./api.js"
// import { CharacterModule } from "./character.js"
// import { LifeWheelModule } from "./life-wheel.js"
// import { FightModule } from "./fight.js"
// import { BattlePageModule } from "./jjk-battle-page.js"
// import { OnlineModule } from "./online.js"
// import { LoginCardModule } from "./login-card.js"
// import { UiModule } from "./ui.js"
// import { DebugModule } from "./debug.js"
// import "./main/main.js"

const APP_BUILD_VERSION = "V3.1.8-github-pages-router-20260509";
const FEMBOY_EASTER_EGG_STORAGE_KEY = "site-v3-femboy-easter-egg-stats";
const FEMBOY_EASTER_EGG_TRIGGER_DENOMINATOR = 500;
const FEMBOY_EASTER_EGG_STYLE_ID = "jjk-femboy-easter-egg-style";
const legacyMain = globalThis.JJKMain || null;
const RUNTIME_CHUNKS = Object.freeze([
  { id: "wheel-core", path: "../wheel/runtime-core.js" },
  { id: "api-runtime", path: "../api/runtime-api.js" },
  { id: "ui-runtime", path: "../UI/runtime-ui.js" },
  { id: "tool-fight", path: "../tool/runtime-fight.js" },
  { id: "wheel-flow", path: "../wheel/runtime-flow.js" },
  { id: "tool-runtime", path: "../tool/runtime-tool.js" },
  { id: "wheel-bootstrap", path: "../wheel/runtime-bootstrap.js" }
]);

function createModuleRecord(id, publicName, api, legacyNamespaces) {
  return {
    id,
    publicName,
    api,
    legacyNamespaces: legacyNamespaces.slice(),
    present: Boolean(api),
    namespace: api?.namespace || publicName,
    version: api?.version || api?.metadata?.version || ""
  };
}

function buildModuleRegistry() {
  return {
    version: APP_BUILD_VERSION,
    moduleFormat: "coarse-esm-entry",
    entry: "modules/main.js",
    runtimeChunks: RUNTIME_CHUNKS.map((chunk) => chunk.path),
    legacyAppEntry: null,
    modules: {
      tools: createModuleRecord("tools", "ToolsModule", ToolsModule, [
        "JJKTool",
        "JJKVersionUtils",
        "JJKSchemaHelpers",
        "JJKExportUtils",
        "JJKTestHooks"
      ]),
      api: createModuleRecord("api", "ApiModule", ApiModule, [
        "JJKApi",
        "JJKStorageApi",
        "JJKClipboardApi",
        "JJKFeedbackExportApi",
        "JJKAiWorkerClient",
        "JJKAiPromptBuilder",
        "JJKAiPromptApi"
      ]),
      character: createModuleRecord("character", "CharacterModule", CharacterModule, [
        "JJKCharacter",
        "JJKCharacterProfile",
        "JJKCharacterStrength",
        "JJKCharacterExportImport"
      ]),
      lifeWheel: createModuleRecord("lifeWheel", "LifeWheelModule", LifeWheelModule, [
        "JJKLifeWheel",
        "JJKLifeWheelData",
        "JJKLifeWheelState",
        "JJKLifeWheelFlow",
        "JJKLifeWheelRandom",
        "JJKLifeWheelResult"
      ]),
      fight: createModuleRecord("fight", "FightModule", FightModule, [
        "JJKFight",
        "JJKDuelResource",
        "JJKDuelActions",
        "JJKDuelDomainResponse",
        "JJKDuelDomainProfile",
        "JJKDuelRuleSubphase",
        "JJKDuelHand",
        "JJKDuelCardTemplate",
        "JJKDuelFeedback",
        "JJKDuelEndCondition"
      ]),
      battlePage: createModuleRecord("battlePage", "BattlePageModule", BattlePageModule, [
        "JJKBattlePage"
      ]),
      online: createModuleRecord("online", "OnlineModule", OnlineModule, [
        "JJKOnline"
      ]),
      loginCard: createModuleRecord("loginCard", "LoginCardModule", LoginCardModule, [
        "JJKLoginCard"
      ]),
      ui: createModuleRecord("ui", "UiModule", UiModule, [
        "JJKUI",
        "JJKUIRenderHelpers",
        "JJKUIComponents",
        "JJKUIMobile",
        "JJKUIPanels"
      ]),
      debug: createModuleRecord("debug", "DebugModule", DebugModule, [
        "JJKDebug",
        "JJKDebugFlags",
        "JJKDebugLog",
        "JJKDebugPanel"
      ])
    }
  };
}

function getSiteModuleRegistry() {
  return buildModuleRegistry();
}

function assertRequiredModules() {
  const registry = getSiteModuleRegistry();
  const missing = Object.entries(registry.modules)
    .filter(([, record]) => !record.present)
    .map(([id]) => id);

  if (missing.length) {
    throw new Error(`JJKSite missing coarse modules: ${missing.join(", ")}`);
  }
  return registry;
}

function assertRequiredSiteModules() {
  return assertRequiredModules();
}

function initializeModules() {
  const registry = assertRequiredModules();
  Object.values(registry.modules).forEach((record) => {
    if (record.api && typeof record.api.initialize === "function") {
      record.api.initialize();
    }
  });
  return registry;
}

function setupLegacyBridge() {
  globalThis.JJKSite = JJKSite;
  globalThis.JJKLegacyMain = legacyMain;
  globalThis.JJKMain = JJKSite;
  return getSiteModuleRegistry();
}

function buildRuntimeChunkUrl(chunk) {
  const url = new URL(chunk.path, import.meta.url);
  url.searchParams.set("v", APP_BUILD_VERSION);
  url.searchParams.set("runtime", chunk.id);
  url.searchParams.set("ui", "tech-refresh-1");
  return url.href;
}

function loadRuntimeChunk(chunk) {
  const selector = `script[data-jjk-runtime-chunk="${chunk.id}"]`;
  const existing = document.querySelector(selector);

  if (existing?.dataset.loaded === "true") {
    return Promise.resolve({ skipped: true, id: chunk.id, path: chunk.path });
  }

  return new Promise((resolve, reject) => {
    const script = existing || document.createElement("script");
    script.src = buildRuntimeChunkUrl(chunk);
    script.dataset.jjkRuntimeChunk = chunk.id;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve({ skipped: false, id: chunk.id, path: chunk.path });
    };
    script.onerror = () => reject(new Error(`Failed to load runtime chunk: ${chunk.path}`));
    if (!existing) {
      document.head.appendChild(script);
    }
  });
}

async function startRuntimeBootstrap() {
  if (globalThis.__JJK_SITE_RUNTIME_BOOTSTRAP_STARTED__) {
    return { skipped: true, reason: "runtime bootstrap already started" };
  }
  globalThis.__JJK_SITE_RUNTIME_BOOTSTRAP_STARTED__ = true;
  const loaded = [];
  try {
    for (const chunk of RUNTIME_CHUNKS) {
      loaded.push(await loadRuntimeChunk(chunk));
    }
  } catch (error) {
    globalThis.__JJK_SITE_RUNTIME_BOOTSTRAP_STARTED__ = false;
    throw error;
  }
  installLegacyTabBridge();
  return { skipped: false, entry: "runtime-chunks", version: APP_BUILD_VERSION, loaded };
}

async function startLegacyAppBootstrap() {
  return startRuntimeBootstrap();
}

function activateLegacyTab(tab) {
  if (!tab || !tab.dataset || !tab.dataset.tab) return false;
  const panel = document.getElementById(tab.dataset.tab);
  if (!panel) return false;
  document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach((item) => item.classList.remove("active"));
  tab.classList.add("active");
  panel.classList.add("active");
  return true;
}

function installLegacyTabBridge() {
  if (globalThis.__JJK_SITE_LEGACY_TAB_BRIDGE_INSTALLED__) return;
  globalThis.__JJK_SITE_LEGACY_TAB_BRIDGE_INSTALLED__ = true;
  document.documentElement.dataset.jjkTabBridge = "installed";
  const handleTabActivation = (event) => {
    const target = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
    const tab = target?.closest?.(".tab[data-tab]");
    if (!tab || !document.body.contains(tab)) return;
    activateLegacyTab(tab);
  };
  document.addEventListener("pointerdown", handleTabActivation, true);
  document.addEventListener("mousedown", handleTabActivation, true);
  document.addEventListener("click", handleTabActivation, true);
}

function readFemboyEasterEggStats() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FEMBOY_EASTER_EGG_STORAGE_KEY) || "{}");
    return {
      shown: Math.max(0, Number(parsed.shown || 0)),
      yes: Math.max(0, Number(parsed.yes || 0)),
      backtracked: Math.max(0, Number(parsed.backtracked || 0)),
      rejected: Math.max(0, Number(parsed.rejected || 0))
    };
  } catch {
    return { shown: 0, yes: 0, backtracked: 0, rejected: 0 };
  }
}

function writeFemboyEasterEggStats(stats) {
  try {
    window.localStorage.setItem(FEMBOY_EASTER_EGG_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // localStorage may be unavailable; the easter egg can still be shown.
  }
  return stats;
}

function recordFemboyEasterEggChoice(choice) {
  const stats = readFemboyEasterEggStats();
  stats[choice] = Math.max(0, Number(stats[choice] || 0)) + 1;
  return writeFemboyEasterEggStats(stats);
}

function ensureFemboyEasterEggStyle() {
  if (document.getElementById(FEMBOY_EASTER_EGG_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = FEMBOY_EASTER_EGG_STYLE_ID;
  style.textContent = `
    .femboy-egg-modal {
      position: fixed;
      inset: 0;
      z-index: 2147483000;
      display: grid;
      place-items: center;
      padding: 20px;
      background: rgba(12, 15, 22, 0.48);
      backdrop-filter: blur(4px);
    }
    .femboy-egg-card {
      width: min(420px, calc(100vw - 32px));
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 8px;
      background: #171b24;
      color: #f8fafc;
      box-shadow: 0 20px 70px rgba(0,0,0,0.42);
      padding: 20px;
      text-align: center;
    }
    .femboy-egg-card h2 {
      margin: 0 0 16px;
      font-size: 20px;
      line-height: 1.35;
      letter-spacing: 0;
    }
    .femboy-egg-actions {
      display: grid;
      gap: 10px;
    }
    .femboy-egg-actions button {
      min-height: 42px;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 8px;
      background: #263244;
      color: #f8fafc;
      cursor: pointer;
      font-size: 15px;
    }
    .femboy-egg-actions button:hover {
      background: #334155;
    }
    .femboy-egg-float {
      position: fixed;
      left: 50%;
      top: 22%;
      z-index: 2147483001;
      transform: translateX(-50%);
      max-width: min(520px, calc(100vw - 32px));
      border: 1px solid rgba(255,255,255,0.22);
      border-radius: 8px;
      background: rgba(15, 23, 42, 0.94);
      color: #fff;
      padding: 12px 16px;
      font-size: 16px;
      line-height: 1.45;
      text-align: center;
      box-shadow: 0 14px 42px rgba(0,0,0,0.32);
      animation: femboyEggFloat 2.8s ease forwards;
    }
    @keyframes femboyEggFloat {
      0% { opacity: 0; transform: translate(-50%, 10px); }
      15%, 78% { opacity: 1; transform: translate(-50%, 0); }
      100% { opacity: 0; transform: translate(-50%, -14px); }
    }
  `;
  document.head.appendChild(style);
}

function showFemboyEasterEggFloat(message) {
  ensureFemboyEasterEggStyle();
  const existing = document.querySelector(".femboy-egg-float");
  if (existing) existing.remove();
  const float = document.createElement("div");
  float.className = "femboy-egg-float";
  float.textContent = message;
  document.body.appendChild(float);
  window.setTimeout(() => float.remove(), 3100);
}

function showFemboyEasterEggModal(step = "first") {
  ensureFemboyEasterEggStyle();
  document.querySelector(".femboy-egg-modal")?.remove();
  const modal = document.createElement("div");
  modal.className = "femboy-egg-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  const card = document.createElement("section");
  card.className = "femboy-egg-card";
  const title = document.createElement("h2");
  const actions = document.createElement("div");
  actions.className = "femboy-egg-actions";
  const closeWithMessage = (choice, message) => {
    recordFemboyEasterEggChoice(choice);
    modal.remove();
    showFemboyEasterEggFloat(message);
  };

  if (step === "second") {
    title.textContent = "不喜欢男娘的有难了";
    const backtrack = document.createElement("button");
    backtrack.type = "button";
    backtrack.textContent = "其实我一直都好喜欢男娘";
    backtrack.addEventListener("click", () => closeWithMessage("backtracked", "哼，不坚定的家伙"));
    const reject = document.createElement("button");
    reject.type = "button";
    reject.textContent = "我补药搞男同啊，滚";
    reject.addEventListener("click", () => closeWithMessage("rejected", "0分，无趣的家伙，站长讨厌你"));
    actions.append(backtrack, reject);
  } else {
    title.textContent = "你喜欢男娘吗";
    const yes = document.createElement("button");
    yes.type = "button";
    yes.textContent = "是";
    yes.addEventListener("click", () => closeWithMessage("yes", "站长认可了你的坚定"));
    const no = document.createElement("button");
    no.type = "button";
    no.textContent = "否";
    no.addEventListener("click", () => showFemboyEasterEggModal("second"));
    actions.append(yes, no);
  }

  card.append(title, actions);
  modal.appendChild(card);
  document.body.appendChild(modal);
  actions.querySelector("button")?.focus?.();
}

function maybeShowFemboyEasterEgg() {
  if (!document.body || globalThis.__JJK_FEMBOY_EASTER_EGG_TRIED__) return false;
  globalThis.__JJK_FEMBOY_EASTER_EGG_TRIED__ = true;
  if (Math.floor(Math.random() * FEMBOY_EASTER_EGG_TRIGGER_DENOMINATOR) !== 0) return false;
  const stats = readFemboyEasterEggStats();
  stats.shown += 1;
  writeFemboyEasterEggStats(stats);
  window.setTimeout(() => showFemboyEasterEggModal("first"), 900);
  return true;
}

globalThis.JJKFemboyEasterEgg = {
  show: () => showFemboyEasterEggModal("first"),
  maybeShow: maybeShowFemboyEasterEgg,
  stats: readFemboyEasterEggStats
};

async function initializeSite(options = {}) {
  setupLegacyBridge();
  const registry = initializeModules();
  if (options.startRuntime !== false && options.startLegacyApp !== false) {
    await startRuntimeBootstrap();
  }
  maybeShowFemboyEasterEgg();
  return registry;
}

export const JJKSite = {
  namespace: "JJKSite",
  version: APP_BUILD_VERSION,
  moduleFormat: "esm-coarse-entry",
  modules: {
    character: CharacterModule,
    lifeWheel: LifeWheelModule,
    api: ApiModule,
    fight: FightModule,
    battlePage: BattlePageModule,
    online: OnlineModule,
    loginCard: LoginCardModule,
    ui: UiModule,
    tools: ToolsModule,
    debug: DebugModule
  },
  legacyMain,
  initializeSite,
  initializeModules,
  setupLegacyBridge,
  startRuntimeBootstrap,
  startLegacyAppBootstrap,
  getSiteModuleRegistry,
  assertRequiredModules,
  assertRequiredSiteModules
};

setupLegacyBridge();
await initializeSite();

export default JJKSite;










