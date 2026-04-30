(function attachJJKDebugLog(global) {
  "use strict";

  var namespace = "JJKDebugLog";
  var version = "0.1.0-candidate";
  var expectedExports = Object.freeze([
    "initialize",
    "setEnabled",
    "isEnabled",
    "addEntry",
    "getEntries",
    "clear",
    "createSnapshot"
  ]);
  var enabled = false;
  var maxEntries = 200;
  var entries = [];

  function sanitizeDetail(value, depth) {
    if (depth <= 0) return null;
    if (Array.isArray(value)) {
      return value.slice(0, 24).map(function mapItem(item) {
        return sanitizeDetail(item, depth - 1);
      });
    }
    if (!value || typeof value !== "object") return value;
    return Object.keys(value).reduce(function copy(result, key) {
      var item = value[key];
      if (typeof item !== "function") result[key] = sanitizeDetail(item, depth - 1);
      return result;
    }, {});
  }

  function initialize(options) {
    enabled = options?.enabled === true;
    maxEntries = Math.max(1, Number(options?.maxEntries || maxEntries || 200));
    if (options?.clear !== false) clear();
    return createSnapshot();
  }

  function setEnabled(value) {
    enabled = value === true;
    return api;
  }

  function isEnabled() {
    return enabled;
  }

  function addEntry(channel, message, detail, options) {
    var config = options || {};
    var entry;

    if (!enabled && config.force !== true) return null;
    entry = {
      id: entries.length + 1,
      channel: String(channel || "debug"),
      message: String(message || ""),
      detail: sanitizeDetail(detail || null, Number(config.depth || 4)),
      level: config.level || "info",
      createdAt: config.createdAt || new Date().toISOString()
    };
    entries.push(entry);
    if (entries.length > maxEntries) entries = entries.slice(entries.length - maxEntries);
    return Object.assign({}, entry);
  }

  function getEntries(options) {
    var config = options || {};
    var list = entries;

    if (config.channel) {
      list = list.filter(function matchesChannel(entry) {
        return entry.channel === config.channel;
      });
    }
    if (Number(config.limit) > 0) list = list.slice(-Number(config.limit));
    return list.map(function clone(entry) {
      return Object.assign({}, entry, {
        detail: sanitizeDetail(entry.detail, 4)
      });
    });
  }

  function clear() {
    entries = [];
    return api;
  }

  function createSnapshot() {
    return {
      schema: "jjk-debug-log-snapshot",
      version: 1,
      enabled: enabled,
      maxEntries: maxEntries,
      entries: getEntries(),
      createdAt: new Date().toISOString()
    };
  }

  function getExpectedExports() {
    return expectedExports.slice();
  }

  function registerWithParent() {
    try {
      if (global.JJKDebug && typeof global.JJKDebug.registerSubmodule === "function") {
        global.JJKDebug.registerSubmodule("log", api);
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
      layer: "debug-log",
      moduleFormat: "classic-script-iife",
      scriptType: "classic",
      behavior: "inert-memory-log",
      ownsBehavior: false,
      defaultEnabled: false,
      consoleBehavior: "none",
      domBehavior: "none",
      status: "CANDIDATE"
    }),
    expectedExports: expectedExports,
    getExpectedExports: getExpectedExports,
    initialize: initialize,
    setEnabled: setEnabled,
    isEnabled: isEnabled,
    addEntry: addEntry,
    getEntries: getEntries,
    clear: clear,
    createSnapshot: createSnapshot
  };

  global[namespace] = api;
  registerWithParent();
})(globalThis);
