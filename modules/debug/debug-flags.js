(function attachJJKDebugFlags(global) {
  "use strict";

  var namespace = "JJKDebugFlags";
  var version = "0.1.0-candidate";
  var expectedExports = Object.freeze([
    "initialize",
    "createFlags",
    "getFlags",
    "updateFlags",
    "setEnabled",
    "isEnabled",
    "reset"
  ]);
  var flags = createFlags();

  function createFlags(options) {
    var config = options || {};
    var enabled = config.enabled === true;

    return {
      enabled: enabled,
      verbose: enabled && config.verbose === true,
      panel: enabled && config.panel === true,
      source: String(config.source || ""),
      updatedAt: config.updatedAt || ""
    };
  }

  function cloneFlags(value) {
    return {
      enabled: Boolean(value && value.enabled),
      verbose: Boolean(value && value.verbose),
      panel: Boolean(value && value.panel),
      source: String(value?.source || ""),
      updatedAt: String(value?.updatedAt || "")
    };
  }

  function initialize(options) {
    flags = createFlags(options);
    return getFlags();
  }

  function getFlags() {
    return cloneFlags(flags);
  }

  function updateFlags(patch) {
    var next = Object.assign({}, flags, patch || {});
    next.updatedAt = next.updatedAt || new Date().toISOString();
    flags = createFlags(next);
    return getFlags();
  }

  function setEnabled(value, options) {
    return updateFlags(Object.assign({}, options || {}, { enabled: value === true }));
  }

  function isEnabled(value) {
    return Boolean((value || flags).enabled === true);
  }

  function reset() {
    flags = createFlags();
    return getFlags();
  }

  function getExpectedExports() {
    return expectedExports.slice();
  }

  function registerWithParent() {
    try {
      if (global.JJKDebug && typeof global.JJKDebug.registerSubmodule === "function") {
        global.JJKDebug.registerSubmodule("flags", api);
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
      layer: "debug-flags",
      moduleFormat: "classic-script-iife",
      scriptType: "classic",
      behavior: "inert-debug-flags",
      ownsBehavior: false,
      defaultEnabled: false,
      domBehavior: "none",
      status: "CANDIDATE"
    }),
    expectedExports: expectedExports,
    getExpectedExports: getExpectedExports,
    initialize: initialize,
    createFlags: createFlags,
    getFlags: getFlags,
    updateFlags: updateFlags,
    setEnabled: setEnabled,
    isEnabled: isEnabled,
    reset: reset
  };

  global[namespace] = api;
  registerWithParent();
})(globalThis);
