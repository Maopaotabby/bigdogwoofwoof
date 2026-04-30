(function attachJJKLifeWheel(global) {
  "use strict";

  var namespace = "JJKLifeWheel";
  var version = "0.1.0-boundary-candidate";
  var expectedExports = Object.freeze([
    "getWheel",
    "getTaskWheel",
    "taskFromNode",
    "expandTask",
    "selectDynamicWheel",
    "renderCurrentTask",
    "buildWheelMarkup",
    "spinWheel",
    "drawOne",
    "drawMultiple",
    "getWeightedOptions",
    "getAdjustedWeight",
    "applyOptionEffects",
    "getAutoResultForTask",
    "advanceToNextTask"
  ]);
  var helperDescriptors = Object.freeze([
    Object.freeze({
      key: "data",
      namespace: "JJKLifeWheelData",
      file: "modules/life_wheel/wheel-data.js",
      role: "lookup/snapshot/metadata helper"
    }),
    Object.freeze({
      key: "state",
      namespace: "JJKLifeWheelState",
      file: "modules/life_wheel/wheel-state.js",
      role: "state snapshot/metadata helper"
    }),
    Object.freeze({
      key: "result",
      namespace: "JJKLifeWheelResult",
      file: "modules/life_wheel/wheel-result.js",
      role: "result snapshot/metadata helper"
    }),
    Object.freeze({
      key: "flow",
      namespace: "JJKLifeWheelFlow",
      file: "modules/life_wheel/wheel-flow.js",
      role: "flow transition descriptor helper"
    }),
    Object.freeze({
      key: "random",
      namespace: "JJKLifeWheelRandom",
      file: "modules/life_wheel/wheel-random.js",
      role: "weight/random/no-repeat helper"
    })
  ]);
  var bindings = Object.create(null);
  var helpers = Object.create(null);
  var initialized = false;

  var metadata = Object.freeze({
    namespace: namespace,
    version: version,
    layer: "life-wheel-index",
    moduleFormat: "classic-script-iife",
    scriptType: "classic",
    behavior: "boundary-only",
    ownsBehavior: false,
    helperBehavior: "lookup-state-result-flow-random-helpers",
    status: "CANDIDATE"
  });

  var registry = Object.freeze({
    namespace: namespace,
    layer: "life_wheel",
    ownedFiles: Object.freeze([
      "modules/life_wheel/life-wheel-index.js",
      "modules/life_wheel/wheel-data.js",
      "modules/life_wheel/wheel-state.js",
      "modules/life_wheel/wheel-result.js",
      "modules/life_wheel/wheel-flow.js",
      "modules/life_wheel/wheel-random.js"
    ]),
    forbiddenFiles: Object.freeze([
      "app.js",
      "index.html"
    ]),
    expectedExports: expectedExports,
    ownership: Object.freeze({
      role: "index-only",
      mayBindExistingAppExports: true,
      mayRegisterHelpers: true,
      mayCallBusinessLogic: false,
      ownsCharacterStrength: false,
      ownsWheelFlow: false,
      ownsWheelProbability: false,
      ownsWheelRandomHelpers: true
    }),
    boundaries: Object.freeze({
      allowed: Object.freeze([
        "classic script namespace",
        "metadata registry",
        "export contract assertions",
        "future app-owned export binding",
        "lookup/snapshot/metadata helper registry",
        "flow transition descriptors",
        "weight/random/no-repeat helper registry"
      ]),
      forbidden: Object.freeze([
        "wheel flow rewrites",
        "wheel probability rewrites",
        "weighted option changes",
        "spin timing changes",
        "arrow animation changes",
        "sound behavior changes",
        "character strength formulas"
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

  function assertHelperKey(key) {
    if (!helperDescriptors.some(function matchesDescriptor(descriptor) {
      return descriptor.key === key;
    })) {
      throw new Error(namespace + " cannot register unexpected helper: " + key);
    }
  }

  function registerHelper(key, helperApi) {
    assertHelperKey(key);
    if (!helperApi || typeof helperApi !== "object") {
      throw new Error(namespace + "." + key + " helper must be an object.");
    }
    helpers[key] = helperApi;
    return api;
  }

  function refreshHelpers() {
    helperDescriptors.forEach(function refreshHelper(descriptor) {
      var helperApi = global[descriptor.namespace];
      if (helperApi && typeof helperApi === "object") {
        helpers[descriptor.key] = helperApi;
      }
    });
    return api;
  }

  function hasHelper(key) {
    refreshHelpers();
    if (key === undefined) {
      return helperDescriptors.every(function hasExpectedHelper(descriptor) {
        return hasOwn(helpers, descriptor.key);
      });
    }
    assertHelperKey(key);
    return hasOwn(helpers, key);
  }

  function getHelper(key) {
    refreshHelpers();
    assertHelperKey(key);
    if (hasOwn(helpers, key)) return helpers[key];
    throw new Error(namespace + "." + key + " helper is not registered.");
  }

  function listHelpers() {
    refreshHelpers();
    return helperDescriptors.reduce(function buildSnapshot(snapshot, descriptor) {
      snapshot[descriptor.key] = {
        namespace: descriptor.namespace,
        file: descriptor.file,
        role: descriptor.role,
        present: hasOwn(helpers, descriptor.key)
      };
      return snapshot;
    }, {});
  }

  function getHelperDescriptors() {
    return helperDescriptors.map(function cloneDescriptor(descriptor) {
      return {
        key: descriptor.key,
        namespace: descriptor.namespace,
        file: descriptor.file,
        role: descriptor.role
      };
    });
  }

  function validateHelpers() {
    var helperStatus = listHelpers();
    var missing = Object.keys(helperStatus).filter(function isMissing(key) {
      return !helperStatus[key].present;
    });
    return {
      ok: missing.length === 0,
      missing: missing,
      helpers: helperStatus
    };
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
      helperDescriptors: getHelperDescriptors(),
      initialized: initialized,
      bindings: listBindings(),
      helpers: listHelpers()
    };
  }

  var api = {
    namespace: namespace,
    version: version,
    metadata: metadata,
    getMetadata: getMetadata,
    registry: registry,
    expectedExports: expectedExports,
    helperDescriptors: helperDescriptors,
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
    registerHelper: registerHelper,
    refreshHelpers: refreshHelpers,
    hasHelper: hasHelper,
    getHelper: getHelper,
    listHelpers: listHelpers,
    getHelperDescriptors: getHelperDescriptors,
    validateHelpers: validateHelpers
  };

  refreshHelpers();
  global[namespace] = api;
})(globalThis);
