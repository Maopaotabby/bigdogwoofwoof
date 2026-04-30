(function attachJJKDebugPanel(global) {
  "use strict";

  var namespace = "JJKDebugPanel";
  var version = "0.1.0-candidate";
  var expectedExports = Object.freeze([
    "initialize",
    "createPanelState",
    "getPanelState",
    "setPanelEnabled",
    "setSections",
    "buildPanelDescriptor",
    "markPanelMounted",
    "resetPanel"
  ]);
  var panelState = createPanelState();

  function cloneSections(sections) {
    return (Array.isArray(sections) ? sections : []).map(function cloneSection(section) {
      return {
        id: String(section?.id || ""),
        title: String(section?.title || ""),
        status: String(section?.status || ""),
        rows: Array.isArray(section?.rows) ? section.rows.slice(0, 100) : []
      };
    });
  }

  function createPanelState(options) {
    var config = options || {};
    var enabled = config.enabled === true;

    return {
      enabled: enabled,
      mounted: enabled && config.mounted === true,
      targetId: enabled ? String(config.targetId || "") : "",
      sections: cloneSections(config.sections),
      updatedAt: config.updatedAt || ""
    };
  }

  function getPanelState() {
    return createPanelState(panelState);
  }

  function initialize(options) {
    panelState = createPanelState(options);
    return getPanelState();
  }

  function setPanelEnabled(value, options) {
    panelState = createPanelState(Object.assign({}, panelState, options || {}, {
      enabled: value === true,
      updatedAt: new Date().toISOString()
    }));
    return getPanelState();
  }

  function setSections(sections) {
    panelState = createPanelState(Object.assign({}, panelState, {
      sections: cloneSections(sections),
      updatedAt: new Date().toISOString()
    }));
    return getPanelState();
  }

  function buildPanelDescriptor(sections, options) {
    var config = options || {};

    return {
      schema: "jjk-debug-panel-descriptor",
      version: 1,
      enabled: config.enabled === true,
      title: String(config.title || "Debug"),
      sections: cloneSections(sections),
      createdAt: config.createdAt || new Date().toISOString(),
      domBehavior: "none"
    };
  }

  function markPanelMounted(targetId, options) {
    var config = options || {};

    panelState = createPanelState(Object.assign({}, panelState, {
      mounted: panelState.enabled && config.mounted !== false,
      targetId: panelState.enabled ? String(targetId || "") : "",
      updatedAt: new Date().toISOString()
    }));
    return getPanelState();
  }

  function resetPanel() {
    panelState = createPanelState();
    return getPanelState();
  }

  function getExpectedExports() {
    return expectedExports.slice();
  }

  function registerWithParent() {
    try {
      if (global.JJKDebug && typeof global.JJKDebug.registerSubmodule === "function") {
        global.JJKDebug.registerSubmodule("panel", api);
        return true;
      }
    } catch (error) {
      return false;
    }
    return false;
  }

  var api = {
    namespace: namespace,
    version: version,
    metadata: Object.freeze({
      namespace: namespace,
      version: version,
      layer: "debug-panel",
      moduleFormat: "classic-script-iife",
      scriptType: "classic",
      behavior: "descriptor-only",
      ownsBehavior: false,
      defaultEnabled: false,
      domBehavior: "none",
      status: "CANDIDATE"
    }),
    expectedExports: expectedExports,
    getExpectedExports: getExpectedExports,
    initialize: initialize,
    createPanelState: createPanelState,
    getPanelState: getPanelState,
    setPanelEnabled: setPanelEnabled,
    setSections: setSections,
    buildPanelDescriptor: buildPanelDescriptor,
    markPanelMounted: markPanelMounted,
    resetPanel: resetPanel
  };

  global[namespace] = api;
  registerWithParent();
})(globalThis);
