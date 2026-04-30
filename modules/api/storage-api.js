(function attachJJKStorageApi(global) {
  "use strict";

  var namespace = "JJKStorageApi";
  var version = "0.1.0-candidate";
  var expectedExports = Object.freeze([
    "isStorageAvailable",
    "readText",
    "writeText",
    "remove",
    "readJson",
    "writeJson",
    "updateJson",
    "safeJsonParse",
    "createMemoryStorage"
  ]);
  var expectedDependencies = Object.freeze(["storage", "localStorage", "sessionStorage"]);
  var dependencies = Object.create(null);

  function hasOwn(source, key) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }

  function normalizeKey(key) {
    var value = String(key || "").trim();
    if (!value) throw new Error(namespace + ": storage key is required");
    return value;
  }

  function isStorageLike(value) {
    return value &&
      typeof value.getItem === "function" &&
      typeof value.setItem === "function" &&
      typeof value.removeItem === "function";
  }

  function getGlobalStorage(type) {
    try {
      return global[type + "Storage"] || null;
    } catch (error) {
      return null;
    }
  }

  function resolveStorage(options) {
    var type = options && options.type === "session" ? "session" : "local";
    var storage = options && options.storage;

    if (isStorageLike(storage)) return storage;
    if (isStorageLike(dependencies.storage)) return dependencies.storage;
    if (type === "session" && isStorageLike(dependencies.sessionStorage)) return dependencies.sessionStorage;
    if (type === "local" && isStorageLike(dependencies.localStorage)) return dependencies.localStorage;
    return getGlobalStorage(type);
  }

  function isStorageAvailable(options) {
    var storage = resolveStorage(options);
    var key = "__jjk_storage_probe__";

    if (!isStorageLike(storage)) return false;
    try {
      storage.setItem(key, "1");
      storage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  function readText(key, options) {
    var storage = resolveStorage(options);
    var fallback = hasOwn(options || {}, "fallback") ? options.fallback : null;

    if (!isStorageLike(storage)) return fallback;
    try {
      var value = storage.getItem(normalizeKey(key));
      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function writeText(key, value, options) {
    var storage = resolveStorage(options);

    if (!isStorageLike(storage)) return false;
    try {
      storage.setItem(normalizeKey(key), String(value ?? ""));
      return true;
    } catch (error) {
      return false;
    }
  }

  function remove(key, options) {
    var storage = resolveStorage(options);

    if (!isStorageLike(storage)) return false;
    try {
      storage.removeItem(normalizeKey(key));
      return true;
    } catch (error) {
      return false;
    }
  }

  function safeJsonParse(value, fallback) {
    if (typeof value !== "string" || !value.trim()) return fallback;
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function readJson(key, fallback, options) {
    return safeJsonParse(readText(key, {
      storage: options && options.storage,
      type: options && options.type,
      fallback: null
    }), fallback);
  }

  function writeJson(key, value, options) {
    try {
      return writeText(key, JSON.stringify(value), options);
    } catch (error) {
      return false;
    }
  }

  function updateJson(key, updater, fallback, options) {
    var current = readJson(key, fallback, options);
    var next = typeof updater === "function" ? updater(current) : current;

    return writeJson(key, next, options) ? next : current;
  }

  function createMemoryStorage(seed) {
    var data = Object.create(null);

    Object.keys(seed || {}).forEach(function copySeed(key) {
      data[key] = String(seed[key]);
    });
    return {
      get length() {
        return Object.keys(data).length;
      },
      key: function key(index) {
        return Object.keys(data)[index] || null;
      },
      getItem: function getItem(key) {
        return hasOwn(data, key) ? data[key] : null;
      },
      setItem: function setItem(key, value) {
        data[String(key)] = String(value);
      },
      removeItem: function removeItem(key) {
        delete data[String(key)];
      },
      clear: function clear() {
        Object.keys(data).forEach(function removeKey(key) {
          delete data[key];
        });
      },
      snapshot: function snapshot() {
        return Object.keys(data).reduce(function copy(result, key) {
          result[key] = data[key];
          return result;
        }, {});
      }
    };
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
        global.JJKApi.registerSubmodule("storage", api);
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
      layer: "api-storage-helper",
      moduleFormat: "classic-script-iife",
      scriptType: "classic",
      behavior: "storage-wrapper",
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
    isStorageAvailable: isStorageAvailable,
    readText: readText,
    writeText: writeText,
    remove: remove,
    readJson: readJson,
    writeJson: writeJson,
    updateJson: updateJson,
    safeJsonParse: safeJsonParse,
    createMemoryStorage: createMemoryStorage
  };

  global[namespace] = api;
  registerWithParent();
})(globalThis);
