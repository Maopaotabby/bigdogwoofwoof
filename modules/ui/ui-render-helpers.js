(function attachJJKUIRenderHelpers(global) {
  "use strict";

  var namespace = "JJKUIRenderHelpers";
  var version = "0.1.0-ui-helper-candidate";
  var allowedAttributeName = /^[A-Za-z_:][A-Za-z0-9_:.:-]*$/;

  function isNil(value) {
    return value === null || typeof value === "undefined";
  }

  function toSafeText(value, fallback) {
    if (isNil(value)) return isNil(fallback) ? "" : String(fallback);
    return String(value);
  }

  function normalizeText(value, fallback) {
    return toSafeText(value, fallback).replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return toSafeText(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatRichText(text) {
    return escapeHtml(text).replace(/【红字：([^】]+)】/g, '<span class="result-red-alert">【$1】</span>');
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }

  function isSafeAttributeName(name) {
    return allowedAttributeName.test(String(name || ""));
  }

  function htmlAttribute(name, value, options) {
    var config = options || {};
    var attributeName = String(name || "");

    if (!isSafeAttributeName(attributeName) || isNil(value) || value === false) return "";
    if (value === true && config.boolean !== false) return " " + attributeName;
    return " " + attributeName + "=\"" + escapeAttribute(value) + "\"";
  }

  function dataAttribute(name, value) {
    var key = normalizeToken(name);

    if (!key) return "";
    return htmlAttribute("data-" + key, value);
  }

  function normalizeToken(value, fallback) {
    var token = normalizeText(value, fallback).toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return token;
  }

  function uniqueList(items) {
    var seen = Object.create(null);
    var output = [];

    items.forEach(function addItem(item) {
      var value = normalizeText(item);

      if (!value || seen[value]) return;
      seen[value] = true;
      output.push(value);
    });
    return output;
  }

  function classNames() {
    var values = [];

    Array.prototype.slice.call(arguments).forEach(function collect(item) {
      if (!item) return;
      if (Array.isArray(item)) {
        values = values.concat(item);
        return;
      }
      if (typeof item === "object") {
        Object.keys(item).forEach(function collectObjectKey(key) {
          if (item[key]) values.push(key);
        });
        return;
      }
      values.push(item);
    });
    return uniqueList(values).join(" ");
  }

  function clamp(value, min, max) {
    var number = Number(value);
    var lower = Number(min);
    var upper = Number(max);

    if (!Number.isFinite(number)) number = Number.isFinite(lower) ? lower : 0;
    if (!Number.isFinite(lower)) lower = number;
    if (!Number.isFinite(upper)) upper = number;
    if (lower > upper) {
      var swap = lower;
      lower = upper;
      upper = swap;
    }
    return Math.min(Math.max(number, lower), upper);
  }

  function clampRatio(value) {
    return clamp(value, 0, 1);
  }

  function roundNumber(value, precision) {
    var digits = Math.max(0, Math.min(8, Number.isFinite(Number(precision)) ? Number(precision) : 2));
    var factor = Math.pow(10, digits);

    return Math.round(Number(value || 0) * factor) / factor;
  }

  function formatPercent(value, options) {
    var config = options || {};
    var ratio = config.alreadyPercent ? Number(value) / 100 : Number(value);
    var digits = Number.isFinite(Number(config.digits)) ? Number(config.digits) : 2;
    var percent = roundNumber(clampRatio(ratio) * 100, digits);

    return percent.toFixed(digits).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") + "%";
  }

  function getExpectedExports() {
    return [
      "toSafeText",
      "normalizeText",
      "escapeHtml",
      "formatRichText",
      "escapeAttribute",
      "htmlAttribute",
      "dataAttribute",
      "classNames",
      "normalizeToken",
      "clamp",
      "clampRatio",
      "formatPercent"
    ];
  }

  function getMetadata() {
    return api.metadata;
  }

  var api = {
    metadata: Object.freeze({
      namespace: namespace,
      version: version,
      layer: "ui-render-helpers",
      moduleFormat: "classic-script-iife",
      scriptType: "classic",
      behavior: "pure-helper",
      ownsBehavior: false,
      mutatesDom: false,
      migratesRenderer: false
    }),
    expectedExports: getExpectedExports(),
    getExpectedExports: getExpectedExports,
    getMetadata: getMetadata,
    toSafeText: toSafeText,
    normalizeText: normalizeText,
    escapeHtml: escapeHtml,
    escapeHTML: escapeHtml,
    formatRichText: formatRichText,
    escapeAttribute: escapeAttribute,
    htmlAttribute: htmlAttribute,
    dataAttribute: dataAttribute,
    classNames: classNames,
    normalizeToken: normalizeToken,
    clamp: clamp,
    clampRatio: clampRatio,
    formatPercent: formatPercent
  };

  global[namespace] = api;
  if (global.JJKUI && typeof global.JJKUI.registerModule === "function") {
    global.JJKUI.registerModule("renderHelpers", api, {
      namespace: namespace,
      layer: "ui-render-helpers",
      owner: "Agent-D",
      status: "candidate"
    });
  }
})(globalThis);
