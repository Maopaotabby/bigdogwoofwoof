const APP_BUILD_VERSION = "20260428-v1.390A-combat-core-rationalization-pass";

const PAGE_IDS = new Set(["home", "solo", "online", "custom", "archive", "settings"]);
const MODE_IDS = new Set(["none", "solo", "online"]);

const battlePageState = {
  activePage: "home",
  mode: "none",
  activeBattleId: "",
  activeRoomId: "",
  playerSide: null
};

function normalizeBattlePageId(pageId) {
  const value = String(pageId || "").trim();
  return PAGE_IDS.has(value) ? value : "home";
}

function normalizeBattleMode(mode) {
  const value = String(mode || "").trim();
  return MODE_IDS.has(value) ? value : "none";
}

function getBattlePageState() {
  return { ...battlePageState };
}

function getBattleMode() {
  return battlePageState.mode;
}

function isOnlineBattleActive() {
  return battlePageState.mode === "online" && Boolean(battlePageState.activeRoomId);
}

function isSoloBattleActive() {
  return battlePageState.mode === "solo" && Boolean(battlePageState.activeBattleId);
}

function emitBattlePageState() {
  if (typeof document === "undefined") return;
  document.dispatchEvent(new CustomEvent("jjk-battle-page-state", {
    detail: getBattlePageState()
  }));
}

function syncBattlePageDom() {
  if (typeof document === "undefined") return;
  const root = document.querySelector("[data-jjk-battle-root]");
  if (root) {
    root.dataset.activeBattlePage = battlePageState.activePage;
    root.dataset.battleMode = battlePageState.mode;
    root.dataset.activeRoomId = battlePageState.activeRoomId || "";
    root.dataset.playerSide = battlePageState.playerSide || "";
  }
  document.documentElement.dataset.jjkBattleMode = battlePageState.mode;
  document.documentElement.dataset.jjkBattlePage = battlePageState.activePage;

  document.querySelectorAll("[data-jjk-battle-tab]").forEach((button) => {
    const active = button.getAttribute("data-jjk-battle-tab") === battlePageState.activePage;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.querySelectorAll("[data-jjk-battle-page-panel]").forEach((panel) => {
    const active = panel.getAttribute("data-jjk-battle-page-panel") === battlePageState.activePage;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });

  const onlineActive = isOnlineBattleActive();
  document.querySelectorAll("[data-solo-disabled-when-online]").forEach((control) => {
    control.disabled = onlineActive;
    control.setAttribute("aria-disabled", onlineActive ? "true" : "false");
  });
}

function activateBattlePage(pageId, options = {}) {
  battlePageState.activePage = normalizeBattlePageId(pageId);
  if (battlePageState.activePage === "solo" && battlePageState.mode === "none" && options.primeMode !== false) {
    battlePageState.mode = "solo";
  }
  if (battlePageState.activePage === "online" && options.primeMode === "online") {
    battlePageState.mode = "online";
  }
  syncBattlePageDom();
  emitBattlePageState();
  return getBattlePageState();
}

function setBattleMode(mode, patch = {}) {
  battlePageState.mode = normalizeBattleMode(mode);
  if (Object.prototype.hasOwnProperty.call(patch, "activeBattleId")) {
    battlePageState.activeBattleId = String(patch.activeBattleId || "");
  }
  if (Object.prototype.hasOwnProperty.call(patch, "activeRoomId")) {
    battlePageState.activeRoomId = String(patch.activeRoomId || "");
  }
  if (Object.prototype.hasOwnProperty.call(patch, "playerSide")) {
    battlePageState.playerSide = patch.playerSide === "right" ? "right" : (patch.playerSide === "left" ? "left" : null);
  }
  if (patch.activePage) battlePageState.activePage = normalizeBattlePageId(patch.activePage);
  syncBattlePageDom();
  emitBattlePageState();
  return getBattlePageState();
}

function clearBattleMode(mode = "none") {
  battlePageState.mode = normalizeBattleMode(mode);
  battlePageState.activeBattleId = "";
  battlePageState.activeRoomId = "";
  battlePageState.playerSide = null;
  syncBattlePageDom();
  emitBattlePageState();
  return getBattlePageState();
}

function initialize() {
  if (typeof document === "undefined") return getBattlePageState();
  if (document.documentElement.dataset.jjkBattlePageBound === "true") {
    syncBattlePageDom();
    return getBattlePageState();
  }
  document.documentElement.dataset.jjkBattlePageBound = "true";
  document.addEventListener("click", (event) => {
    const tab = event.target?.closest?.("[data-jjk-battle-tab]");
    if (tab) {
      activateBattlePage(tab.getAttribute("data-jjk-battle-tab"));
      return;
    }
    const opener = event.target?.closest?.("[data-jjk-battle-open]");
    if (opener) {
      const page = opener.getAttribute("data-jjk-battle-open");
      const mode = opener.getAttribute("data-jjk-battle-mode");
      activateBattlePage(page, { primeMode: mode || undefined });
      if (mode) setBattleMode(mode, { activePage: page });
    }
  });
  syncBattlePageDom();
  return getBattlePageState();
}

const BattlePageModule = {
  namespace: "JJKBattlePage",
  version: APP_BUILD_VERSION,
  status: "CANDIDATE",
  pages: [...PAGE_IDS],
  modes: [...MODE_IDS],
  initialize,
  getBattlePageState,
  getBattleMode,
  setBattleMode,
  clearBattleMode,
  activateBattlePage,
  isOnlineBattleActive,
  isSoloBattleActive
};

globalThis.JJKBattlePage = BattlePageModule;

export { BattlePageModule };
export default BattlePageModule;
