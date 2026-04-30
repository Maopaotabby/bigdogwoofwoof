(function attachJJKClipboardApi(global) {
  "use strict";

  var namespace = "JJKClipboardApi";
  var version = "0.1.0-candidate";
  var expectedExports = Object.freeze([
    "canWriteText",
    "writeText",
    "copyText",
    "createClipboardResult",
    "createUnavailableResult"
  ]);
  var expectedDependencies = Object.freeze(["navigator", "clipboard"]);
  var dependencies = Object.create(null);

  function hasOwn(source, key) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }

  function resolveClipboard(options) {
    var navigatorRef = options && options.navigator || dependencies.navigator || global.navigator || null;
    var clipboard = options && options.clipboard || dependencies.clipboard || navigatorRef?.clipboard || null;
    return clipboard && typeof clipboard.writeText === "function" ? clipboard : null;
  }

  function canWriteText(options) {
    return Boolean(resolveClipboard(options));
  }

  function createClipboardResult(ok, detail) {
    return {
      ok: Boolean(ok),
      method: detail?.method || "clipboard.writeText",
      textLength: Number(detail?.textLength || 0),
      error: detail?.error || "",
      reason: detail?.reason || ""
    };
  }

  function createUnavailableResult(text) {
    return createClipboardResult(false, {
      method: "none",
      textLength: String(text ?? "").length,
      reason: "clipboard-unavailable"
    });
  }

  async function writeText(text, options) {
    var clipboard = resolveClipboard(options);
    var value = String(text ?? "");

    if (!clipboard) return createUnavailableResult(value);
    try {
      await clipboard.writeText(value);
      return createClipboardResult(true, {
        method: "clipboard.writeText",
        textLength: value.length
      });
    } catch (error) {
      return createClipboardResult(false, {
        method: "clipboard.writeText",
        textLength: value.length,
        error: error?.message || String(error || "clipboard write failed")
      });
    }
  }

  function copyText(text, options) {
    return writeText(text, options);
  }

  function registerDependencies(map) {
    Object.keys(map || {}).forEach(function registerDependency(name) {
      if (expectedDependencies.indexOf(name) === -1) {
        throw new Error(namespace + ": unexpected dependency '" + name + "'");
      }
      dependencies[name] = map[name];
    });
    return api;
  }

  function clearDependencies() {
    expectedDependencies.forEach(function clearDependency(name) {
      delete dependencies[name];
    });
    return api;
  }

  function listDependencies() {
    return expectedDependencies.reduce(function build(result, name) {
      result[name] = hasOwn(dependencies, name);
      return result;
    }, {});
  }

  function getExpectedExports() {
    return expectedExports.slice();
  }

  function registerWithParent() {
    try {
      if (global.JJKApi && typeof global.JJKApi.registerSubmodule === "function") {
        global.JJKApi.registerSubmodule("clipboard", api);
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
      layer: "api-clipboard-helper",
      moduleFormat: "classic-script-iife",
      scriptType: "classic",
      behavior: "clipboard-wrapper",
      ownsBehavior: false,
      domBehavior: "none",
      status: "CANDIDATE"
    }),
    expectedExports: expectedExports,
    getExpectedExports: getExpectedExports,
    expectedDependencies: expectedDependencies,
    registerDependencies: registerDependencies,
    configure: registerDependencies,
    clearDependencies: clearDependencies,
    listDependencies: listDependencies,
    canWriteText: canWriteText,
    writeText: writeText,
    copyText: copyText,
    createClipboardResult: createClipboardResult,
    createUnavailableResult: createUnavailableResult
  };

  global[namespace] = api;
  registerWithParent();
})(globalThis);
