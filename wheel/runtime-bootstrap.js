//--转盘运行时启动--//
(function bootstrapJjkRuntimeChunks() {
  if (!JJK_LEGACY_APP_ALREADY_BOOTED) {
    registerSiteModuleBoundaries();
    registerDuelModuleBoundaries();
    init();
  } else if (globalThis.console && typeof globalThis.console.warn === "function") {
    console.warn("JJK runtime bootstrap skipped because the app runtime was already imported.");
  }
})();
