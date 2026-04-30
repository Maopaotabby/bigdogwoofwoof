(function attachJJKCharacter(global) {
  "use strict";

  var namespace = "JJKCharacter";
  var version = "0.2.0-helper-boundary-candidate";
  var expectedExports = Object.freeze([
    "getDuelCharacterCards",
    "evaluateDuelCharacterCard",
    "renderDuelCharacterCard",
    "buildCustomDuelCard",
    "readCustomDuelForm",
    "addCustomDuelCharacter",
    "editCustomDuelCharacter",
    "removeCustomDuelCharacter",
    "clearCustomDuelCharacters",
    "importCombatPowerCodeToDuel",
    "applyCombatPowerImportToDuelForm"
  ]);
  var helperExportNames = Object.freeze([
    "character-profile",
    "character-strength",
    "character-export-import"
  ]);
  var bindings = Object.create(null);
  var helperModules = Object.create(null);
  var helperMetadata = Object.create(null);
  var initialized = false;
  var previousApi = global[namespace] && typeof global[namespace] === "object" ? global[namespace] : null;

  var metadata = Object.freeze({
    namespace: namespace,
    version: version,
    layer: "character-index",
    moduleFormat: "classic-script-iife",
    scriptType: "classic",
    behavior: "boundary-plus-pure-helpers",
    ownsBehavior: false,
    status: "CANDIDATE"
  });

  var registry = Object.freeze({
    namespace: namespace,
    layer: "character",
    ownedFiles: Object.freeze([
      "modules/character/character-index.js",
      "modules/character/character-profile.js",
      "modules/character/character-strength.js",
      "modules/character/character-export-import.js"
    ]),
    forbiddenFiles: Object.freeze([
      "app.js",
      "index.html"
    ]),
    expectedExports: expectedExports,
    helperExportNames: helperExportNames,
    ownership: Object.freeze({
      role: "index-and-pure-helper-registry",
      mayBindExistingAppExports: true,
      mayCallBusinessLogic: false,
      ownsCharacterStrength: false,
      ownsWheelFlow: false,
      ownsWheelProbability: false,
      helperPurity: "no DOM, no state, no fetch, no storage"
    }),
    boundaries: Object.freeze({
      allowed: Object.freeze([
        "classic script namespace",
        "metadata registry",
        "export contract assertions",
        "future app-owned export binding",
        "pure profile normalization helpers",
        "pure rank and visible-grade helpers",
        "pure combat-power envelope codec helpers"
      ]),
      forbidden: Object.freeze([
        "character strength formulas",
        "duel character evaluation changes",
        "custom character persistence changes",
        "wheel flow",
        "wheel probability"
      ])
    })
  });

  function hasOwn(source, key) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }

  function cloneArray(values) {
    return values.slice();
  }

  function assertExpectedExport(name) {
    if (!expectedExports.includes(name)) {
      throw new Error(namespace + " cannot bind unexpected export: " + name);
    }
  }

  function bind(name, value) {
    assertExpectedExport(name);
    if (typeof value !== "function") {
      throw new Error(namespace + "." + name + " must be a function.");
    }
    bindings[name] = value;
    return api;
  }

  function register(map) {
    Object.keys(map || {}).forEach(function bindExport(name) {
      bind(name, map[name]);
    });
    return api;
  }

  function initialize(options) {
    initialized = true;
    if (options && options.exports) register(options.exports);
    return getRegistry();
  }

  function hasBinding(name) {
    if (name === undefined) {
      return expectedExports.every(function hasExpected(exportName) {
        return hasOwn(bindings, exportName);
      });
    }
    assertExpectedExport(name);
    return hasOwn(bindings, name);
  }

  function getBinding(name) {
    assertExpectedExport(name);
    if (hasOwn(bindings, name)) return bindings[name];
    throw new Error(namespace + "." + name + " is not bound.");
  }

  function listBindings() {
    return expectedExports.reduce(function buildSnapshot(snapshot, name) {
      snapshot[name] = hasOwn(bindings, name);
      return snapshot;
    }, {});
  }

  function clearBindings() {
    expectedExports.forEach(function clearName(name) {
      delete bindings[name];
    });
    return api;
  }

  function isReservedApiName(name) {
    return hasOwn(api, name) || name === "__pendingHelperModules";
  }

  function registerHelperModule(moduleId, helperMap, info) {
    var id = String(moduleId || "").trim();
    if (!id) throw new Error(namespace + " helper module id is required.");
    var helpers = helperMap || {};
    var names = Object.keys(helpers).filter(function isFunctionExport(name) {
      return typeof helpers[name] === "function";
    });
    var moduleSnapshot = Object.create(null);
    names.forEach(function copyHelper(name) {
      moduleSnapshot[name] = helpers[name];
      if (!isReservedApiName(name)) api[name] = helpers[name];
    });
    helperModules[id] = Object.freeze(moduleSnapshot);
    helperMetadata[id] = Object.freeze({
      id: id,
      namespace: namespace,
      layer: info && info.layer ? String(info.layer) : id,
      version: info && info.version ? String(info.version) : "",
      behavior: info && info.behavior ? String(info.behavior) : "pure-helper",
      exports: Object.freeze(names.slice())
    });
    return api;
  }

  function registerHelpers(moduleId, helperMap, info) {
    return registerHelperModule(moduleId, helperMap, info);
  }

  function hasHelper(name) {
    return Object.keys(helperModules).some(function hasHelperInModule(moduleId) {
      return hasOwn(helperModules[moduleId], name);
    });
  }

  function getHelper(name) {
    for (var moduleId in helperModules) {
      if (hasOwn(helperModules, moduleId) && hasOwn(helperModules[moduleId], name)) {
        return helperModules[moduleId][name];
      }
    }
    throw new Error(namespace + " helper is not registered: " + name);
  }

  function getHelperModule(moduleId) {
    var id = String(moduleId || "").trim();
    return helperModules[id] || null;
  }

  function listHelperModules() {
    return Object.keys(helperModules).map(function buildHelperEntry(moduleId) {
      return helperMetadata[moduleId];
    });
  }

  function validateRequiredExports(source) {
    var target = source || bindings;
    var missing = expectedExports.filter(function isMissing(name) {
      return typeof target[name] !== "function";
    });
    return {
      ok: missing.length === 0,
      missing: missing,
      checked: cloneArray(expectedExports)
    };
  }

  function assertRequiredExports(source) {
    var result = validateRequiredExports(source);
    if (!result.ok) {
      throw new Error(namespace + " missing required exports: " + result.missing.join(", "));
    }
    return true;
  }

  function getExpectedExports() {
    return cloneArray(expectedExports);
  }

  function getMetadata() {
    return metadata;
  }

  function getRegistry() {
    return {
      metadata: metadata,
      registry: registry,
      expectedExports: cloneArray(expectedExports),
      helperExportNames: cloneArray(helperExportNames),
      initialized: initialized,
      bindings: listBindings(),
      helperModules: listHelperModules()
    };
  }

  var api = {
    namespace: namespace,
    version: version,
    metadata: metadata,
    getMetadata: getMetadata,
    registry: registry,
    expectedExports: expectedExports,
    helperExportNames: helperExportNames,
    getExpectedExports: getExpectedExports,
    initialize: initialize,
    getRegistry: getRegistry,
    assertRequiredExports: assertRequiredExports,
    validateRequiredExports: validateRequiredExports,
    bind: bind,
    register: register,
    hasBinding: hasBinding,
    get: getBinding,
    getBinding: getBinding,
    listBindings: listBindings,
    clearBindings: clearBindings,
    registerHelperModule: registerHelperModule,
    registerHelpers: registerHelpers,
    hasHelper: hasHelper,
    getHelper: getHelper,
    getHelperModule: getHelperModule,
    listHelperModules: listHelperModules
  };

  if (previousApi) {
    Object.keys(previousApi).forEach(function preserveExistingHelper(name) {
      if (!hasOwn(api, name) && name !== "__pendingHelperModules") api[name] = previousApi[name];
    });
    (previousApi.__pendingHelperModules || []).forEach(function registerPendingHelper(entry) {
      registerHelperModule(entry.id, entry.exports, entry.metadata);
    });
  }

  global[namespace] = api;
})(globalThis);
