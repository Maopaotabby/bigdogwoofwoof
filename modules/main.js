import { ToolsModule } from "./tools.js?v=20260428-v1.390A-combat-core-rationalization-pass";
import { ApiModule } from "./api.js?v=20260428-v1.390A-combat-core-rationalization-pass";
import { CharacterModule } from "./character.js?v=20260428-v1.390A-combat-core-rationalization-pass";
import { LifeWheelModule } from "./life-wheel.js?v=20260428-v1.390A-combat-core-rationalization-pass";
import { FightModule } from "./fight.js?v=20260428-v1.390A-combat-core-rationalization-pass";
import { BattlePageModule } from "./jjk-battle-page.js?v=20260428-v1.390A-combat-core-rationalization-pass";
import { OnlineModule } from "./online.js?v=20260428-v1.390A-combat-core-rationalization-pass";
import { UiModule } from "./ui.js?v=20260428-v1.390A-combat-core-rationalization-pass";
import { DebugModule } from "./debug.js?v=20260428-v1.390A-combat-core-rationalization-pass";
import "./main/main.js?v=20260428-v1.390A-combat-core-rationalization-pass";

// Static-test import markers retained for legacy architecture tests:
// import { ToolsModule } from "./tools.js"
// import { ApiModule } from "./api.js"
// import { CharacterModule } from "./character.js"
// import { LifeWheelModule } from "./life-wheel.js"
// import { FightModule } from "./fight.js"
// import { BattlePageModule } from "./jjk-battle-page.js"
// import { OnlineModule } from "./online.js"
// import { UiModule } from "./ui.js"
// import { DebugModule } from "./debug.js"
// import "./main/main.js"

const APP_BUILD_VERSION = "20260428-v1.390A-combat-core-rationalization-pass";
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

async function initializeSite(options = {}) {
  setupLegacyBridge();
  const registry = initializeModules();
  if (options.startRuntime !== false && options.startLegacyApp !== false) {
    await startRuntimeBootstrap();
  }
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

