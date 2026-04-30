(function attachJJKUIPanels(global) {
  "use strict";

  var namespace = "JJKUIPanels";
  var version = "0.1.0-ui-helper-candidate";

  function helperClassNames() {
    if (global.JJKUIRenderHelpers && typeof global.JJKUIRenderHelpers.classNames === "function") {
      return global.JJKUIRenderHelpers.classNames.apply(null, arguments);
    }
    return Array.prototype.slice.call(arguments).filter(Boolean).join(" ");
  }

  function createPanelState(input) {
    var config = input || {};
    var active = Boolean(config.active);
    var hidden = typeof config.hidden === "boolean" ? config.hidden : !active;
    var activeClass = config.activeClass || "active";

    return {
      id: config.id || "",
      active: active,
      hidden: hidden,
      activeClass: activeClass,
      className: helperClassNames(config.baseClass, config.className, active ? activeClass : "")
    };
  }

  function applyPanelState(panel, input) {
    var state = createPanelState(input);

    if (!panel) return state;
    if (panel.classList) panel.classList.toggle(state.activeClass, state.active);
    panel.hidden = state.hidden;
    panel.setAttribute("aria-hidden", state.hidden ? "true" : "false");
    return state;
  }

  function applyTriggerState(trigger, input) {
    var config = input || {};
    var active = Boolean(config.active);
    var activeClass = config.activeClass || "active";

    if (!trigger) return { active: active, activeClass: activeClass };
    if (trigger.classList) trigger.classList.toggle(activeClass, active);
    trigger.setAttribute("aria-selected", active ? "true" : "false");
    if (config.controls) trigger.setAttribute("aria-controls", config.controls);
    return { active: active, activeClass: activeClass };
  }

  function getPanelIdFromTrigger(trigger, dataKey) {
    var key = dataKey || "tab";
    var dataset = trigger && trigger.dataset;

    return dataset && dataset[key] ? dataset[key] : "";
  }

  function syncPanelGroup(input) {
    var config = input || {};
    var triggers = Array.prototype.slice.call(config.triggers || []);
    var panels = Array.prototype.slice.call(config.panels || []);
    var activeId = String(config.activeId || "");
    var activeClass = config.activeClass || "active";
    var panelPrefix = config.panelPrefix || "";

    triggers.forEach(function syncTrigger(trigger) {
      var panelId = getPanelIdFromTrigger(trigger, config.dataKey);
      applyTriggerState(trigger, {
        active: panelId === activeId,
        activeClass: activeClass,
        controls: panelPrefix + panelId
      });
    });
    panels.forEach(function syncPanel(panel) {
      var id = panel && (panel.id || panel.getAttribute && panel.getAttribute("data-panel-id")) || "";
      applyPanelState(panel, {
        active: id === activeId || panelPrefix + activeId === id,
        activeClass: activeClass
      });
    });
    return {
      activeId: activeId,
      triggerCount: triggers.length,
      panelCount: panels.length
    };
  }

  function setStatusText(target, text, options) {
    var config = options || {};
    var isError = Boolean(config.error);
    var errorClass = config.errorClass || "error-text";

    if (!target) return { text: String(text == null ? "" : text), error: isError };
    target.textContent = String(text == null ? "" : text);
    if (target.classList) target.classList.toggle(errorClass, isError);
    return { text: target.textContent, error: isError };
  }

  function getExpectedExports() {
    return [
      "createPanelState",
      "applyPanelState",
      "applyTriggerState",
      "getPanelIdFromTrigger",
      "syncPanelGroup",
      "setStatusText"
    ];
  }

  function getMetadata() {
    return api.metadata;
  }

  var api = {
    metadata: Object.freeze({
      namespace: namespace,
      version: version,
      layer: "ui-panels",
      moduleFormat: "classic-script-iife",
      scriptType: "classic",
      behavior: "panel-state-helper",
      ownsBehavior: false,
      migratesRenderer: false
    }),
    expectedDependencies: Object.freeze(["JJKUIRenderHelpers optional"]),
    expectedExports: getExpectedExports(),
    getExpectedExports: getExpectedExports,
    getMetadata: getMetadata,
    createPanelState: createPanelState,
    applyPanelState: applyPanelState,
    applyTriggerState: applyTriggerState,
    getPanelIdFromTrigger: getPanelIdFromTrigger,
    syncPanelGroup: syncPanelGroup,
    setStatusText: setStatusText
  };

  global[namespace] = api;
  if (global.JJKUI && typeof global.JJKUI.registerModule === "function") {
    global.JJKUI.registerModule("panels", api, {
      namespace: namespace,
      layer: "ui-panels",
      owner: "Agent-D",
      status: "candidate"
    });
  }
})(globalThis);
