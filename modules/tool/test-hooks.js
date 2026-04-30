(function attachJJKTestHooks(global) {
  "use strict";

  var namespace = "JJKTestHooks";
  var version = "0.1.0-candidate";
  var expectedExports = Object.freeze([
    "setEnabled",
    "isEnabled",
    "registerHook",
    "unregisterHook",
    "runHook",
    "runHooks",
    "listHooks",
    "clearHooks",
    "createSnapshot"
  ]);
  var enabled = false;
  var hooks = Object.create(null);

  function hasOwn(source, key) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }

  function normalizeName(name) {
    var value = String(name || "").trim();
    if (!value) throw new Error(namespace + ": hook name is required");
    return value;
  }

  function setEnabled(value) {
    enabled = value === true;
    return api;
  }

  function isEnabled() {
    return enabled;
  }

  function registerHook(name, fn, options) {
    var hookName = normalizeName(name);

    if (typeof fn !== "function") throw new Error(namespace + ": hook must be a function");
    hooks[hookName] = {
      name: hookName,
      fn: fn,
      label: options?.label || hookName,
      registeredAt: new Date().toISOString()
    };
    return api;
  }

  function unregisterHook(name) {
    delete hooks[normalizeName(name)];
    return api;
  }

  async function runHook(name, context, options) {
    var hookName = normalizeName(name);
    var hook = hooks[hookName];

    if (!hook) return { name: hookName, ok: false, skipped: true, reason: "missing-hook" };
    if (!enabled && options?.force !== true) {
      return { name: hookName, ok: true, skipped: true, reason: "hooks-disabled" };
    }
    try {
      return {
        name: hookName,
        ok: true,
        skipped: false,
        result: await hook.fn(context)
      };
    } catch (error) {
      return {
        name: hookName,
        ok: false,
        skipped: false,
        error: error?.message || String(error || "hook failed")
      };
    }
  }

  async function runHooks(context, options) {
    var names = Array.isArray(options?.names) ? options.names : Object.keys(hooks);
    var results = [];

    for (var index = 0; index < names.length; index += 1) {
      results.push(await runHook(names[index], context, options));
    }
    return {
      ok: results.every(function isOk(item) {
        return item.ok;
      }),
      results: results
    };
  }

  function listHooks() {
    return Object.keys(hooks).map(function mapHook(name) {
      return {
        name: name,
        label: hooks[name].label,
        registeredAt: hooks[name].registeredAt
      };
    });
  }

  function clearHooks() {
    Object.keys(hooks).forEach(function clearHook(name) {
      delete hooks[name];
    });
    return api;
  }

  function createSnapshot(extra) {
    return {
      schema: "jjk-test-hooks-snapshot",
      version: 1,
      enabled: enabled,
      hookCount: Object.keys(hooks).length,
      hooks: listHooks(),
      extra: extra || null,
      createdAt: new Date().toISOString()
    };
  }

  function getExpectedExports() {
    return expectedExports.slice();
  }

  function registerWithParent() {
    try {
      if (global.JJKTool && typeof global.JJKTool.registerSubmodule === "function") {
        global.JJKTool.registerSubmodule("testHooks", api);
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
      layer: "tool-test-hooks",
      moduleFormat: "classic-script-iife",
      scriptType: "classic",
      behavior: "inert-test-hooks",
      ownsBehavior: false,
      defaultEnabled: false,
      domBehavior: "none",
      status: "CANDIDATE"
    }),
    expectedExports: expectedExports,
    getExpectedExports: getExpectedExports,
    setEnabled: setEnabled,
    isEnabled: isEnabled,
    registerHook: registerHook,
    unregisterHook: unregisterHook,
    runHook: runHook,
    runHooks: runHooks,
    listHooks: listHooks,
    clearHooks: clearHooks,
    createSnapshot: createSnapshot
  };

  global[namespace] = api;
  registerWithParent();
})(globalThis);
