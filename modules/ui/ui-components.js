(function attachJJKUIComponents(global) {
  "use strict";

  var namespace = "JJKUIComponents";
  var version = "0.1.0-ui-helper-candidate";
  var badgeTones = {
    neutral: true,
    info: true,
    success: true,
    warning: true,
    danger: true,
    beta: true,
    candidate: true,
    muted: true
  };

  function fallbackEscape(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function helpers() {
    return global.JJKUIRenderHelpers || {
      escapeHtml: fallbackEscape,
      escapeAttribute: fallbackEscape,
      classNames: fallbackClassNames,
      clamp: fallbackClamp,
      clampRatio: function clampRatio(value) {
        return fallbackClamp(value, 0, 1);
      },
      formatPercent: function formatPercent(value) {
        var percent = Math.round(fallbackClamp(value, 0, 1) * 10000) / 100;
        return percent.toFixed(2).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") + "%";
      },
      normalizeToken: function normalizeToken(value) {
        return String(value == null ? "" : value).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
      },
      htmlAttribute: function htmlAttribute(name, value) {
        if (value == null || value === false) return "";
        if (value === true) return " " + String(name);
        return " " + String(name) + "=\"" + fallbackEscape(value) + "\"";
      }
    };
  }

  function fallbackClassNames() {
    return Array.prototype.slice.call(arguments).filter(Boolean).join(" ");
  }

  function fallbackClamp(value, min, max) {
    var number = Number(value);
    var lower = Number(min);
    var upper = Number(max);

    if (!Number.isFinite(number)) number = Number.isFinite(lower) ? lower : 0;
    return Math.min(Math.max(number, lower), upper);
  }

  function normalizeTone(tone) {
    var value = String(tone || "neutral");
    return badgeTones[value] ? value : "neutral";
  }

  function createBadgeModel(input, options) {
    var config = options || {};
    var source = input && typeof input === "object" && !Array.isArray(input) ? input : { label: input };
    var tone = normalizeTone(source.tone || config.tone);
    var baseClass = config.baseClass || source.baseClass || "ui-badge";
    var label = source.label == null ? "" : String(source.label);

    return {
      label: label,
      tone: tone,
      title: source.title || config.title || "",
      hidden: Boolean(source.hidden || config.hidden || !label),
      className: helpers().classNames(baseClass, baseClass + "--" + tone, source.className, config.className)
    };
  }

  function renderBadge(input, options) {
    var model = createBadgeModel(input, options);
    var h = helpers();

    if (model.hidden) return "";
    return "<span" +
      h.htmlAttribute("class", model.className) +
      h.htmlAttribute("title", model.title) +
      ">" + h.escapeHtml(model.label) + "</span>";
  }

  function createProgressModel(input, options) {
    var config = options || {};
    var source = input && typeof input === "object" && !Array.isArray(input) ? input : { value: input };
    var min = Number.isFinite(Number(source.min)) ? Number(source.min) : Number(config.min || 0);
    var max = Number.isFinite(Number(source.max)) ? Number(source.max) : Number(config.max || 1);
    var value = Number.isFinite(Number(source.value)) ? Number(source.value) : min;
    var range = max - min;
    var ratio = range > 0 ? helpers().clampRatio((value - min) / range) : 0;
    var baseClass = config.baseClass || source.baseClass || "ui-progress";

    return {
      min: min,
      max: max,
      value: helpers().clamp(value, min, max),
      ratio: ratio,
      percentText: helpers().formatPercent(ratio, { digits: config.digits }),
      label: source.label || config.label || "",
      className: helpers().classNames(baseClass, source.className, config.className)
    };
  }

  function renderProgress(input, options) {
    var model = createProgressModel(input, options);
    var h = helpers();

    return "<div" +
      h.htmlAttribute("class", model.className) +
      h.htmlAttribute("role", "progressbar") +
      h.htmlAttribute("aria-valuemin", model.min) +
      h.htmlAttribute("aria-valuemax", model.max) +
      h.htmlAttribute("aria-valuenow", model.value) +
      h.htmlAttribute("aria-label", model.label) +
      "><span class=\"ui-progress-fill\" style=\"width: " + h.escapeAttribute(model.percentText) + ";\"></span></div>";
  }

  function createButtonState(input) {
    var source = input || {};
    var busy = Boolean(source.busy);
    var disabled = Boolean(source.disabled || busy);

    return {
      disabled: disabled,
      busy: busy,
      selected: Boolean(source.selected),
      pressed: typeof source.pressed === "undefined" ? Boolean(source.selected) : Boolean(source.pressed),
      label: source.label == null ? "" : String(source.label),
      title: source.title || "",
      className: helpers().classNames(source.className, {
        "is-busy": busy,
        selected: Boolean(source.selected),
        active: Boolean(source.active)
      }),
      ariaDisabled: disabled ? "true" : "false"
    };
  }

  function applyButtonState(button, input) {
    var state = createButtonState(input);

    if (!button) return state;
    button.disabled = state.disabled;
    button.setAttribute("aria-disabled", state.ariaDisabled);
    button.setAttribute("aria-pressed", state.pressed ? "true" : "false");
    button.classList.toggle("is-busy", state.busy);
    button.classList.toggle("selected", state.selected);
    if (state.title) button.title = state.title;
    if (state.label) button.textContent = state.label;
    return state;
  }

  function renderButtonAttributes(input) {
    var state = createButtonState(input);
    var h = helpers();

    return h.htmlAttribute("type", "button") +
      h.htmlAttribute("class", state.className) +
      h.htmlAttribute("title", state.title) +
      h.htmlAttribute("disabled", state.disabled) +
      h.htmlAttribute("aria-disabled", state.ariaDisabled) +
      h.htmlAttribute("aria-pressed", state.pressed ? "true" : "false");
  }

  function getExpectedExports() {
    return [
      "createBadgeModel",
      "renderBadge",
      "createProgressModel",
      "renderProgress",
      "createButtonState",
      "applyButtonState",
      "renderButtonAttributes"
    ];
  }

  function getMetadata() {
    return api.metadata;
  }

  var api = {
    metadata: Object.freeze({
      namespace: namespace,
      version: version,
      layer: "ui-components",
      moduleFormat: "classic-script-iife",
      scriptType: "classic",
      behavior: "low-risk-component-helper",
      ownsBehavior: false,
      migratesRenderer: false
    }),
    expectedDependencies: Object.freeze(["JJKUIRenderHelpers optional"]),
    expectedExports: getExpectedExports(),
    getExpectedExports: getExpectedExports,
    getMetadata: getMetadata,
    createBadgeModel: createBadgeModel,
    renderBadge: renderBadge,
    createProgressModel: createProgressModel,
    renderProgress: renderProgress,
    createButtonState: createButtonState,
    applyButtonState: applyButtonState,
    renderButtonAttributes: renderButtonAttributes
  };

  global[namespace] = api;
  if (global.JJKUI && typeof global.JJKUI.registerModule === "function") {
    global.JJKUI.registerModule("components", api, {
      namespace: namespace,
      layer: "ui-components",
      owner: "Agent-D",
      status: "candidate"
    });
  }
})(globalThis);
