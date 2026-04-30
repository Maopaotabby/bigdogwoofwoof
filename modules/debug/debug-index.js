(function attachJJKDebug(global) {
  "use strict";

  var namespace = "JJKDebug";
  var version = "0.1.0-candidate";
  var registryNames = ["flags", "log", "panel"];
  var submoduleCatalog = Object.freeze([
    Object.freeze({ key: "flags", namespace: "JJKDebugFlags", file: "modules/debug/debug-flags.js", registry: "flags" }),
    Object.freeze({ key: "log", namespace: "JJKDebugLog", file: "modules/debug/debug-log.js", registry: "log" }),
    Object.freeze({ key: "panel", namespace: "JJKDebugPanel", file: "modules/debug/debug-panel.js", registry: "panel" })
  ]);
  var registry = Object.create(null);
  var initialized = false;
  var initializeOptions = Object.freeze({});

  function hasOwn(source, key) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }

  function assert(condition, message) {
    if (!condition) {
      throw new Error(namespace + ": " + (message || "assertion failed"));
    }
    return true;
  }

  function assertRegistryName(name) {
    assert(typeof name === "string" && name.length > 0, "registry name must be a non-empty string");
    return name;
  }

  function createRegistryBucket() {
    return Object.create(null);
  }

  function ensureRegistry(name) {
    assertRegistryName(name);
    if (!hasOwn(registry, name)) registry[name] = createRegistryBucket();
    return registry[name];
  }

  function resetPlaceholders() {
    registry.flags.enabled = false;
    registry.flags.verbose = false;
    registry.flags.panel = false;
    registry.log.entries = [];
    registry.log.channels = Object.create(null);
    registry.panel.enabled = false;
    registry.panel.mounted = false;
    registry.panel.target = null;
  }

  function initialize(options) {
    var nextOptions = {};
    var enabled = Boolean(options && options.enabled === true);
    var panelEnabled = Boolean(enabled && options && options.panel === true);

    registryNames.forEach(ensureRegistry);
    resetPlaceholders();

    registry.flags.enabled = enabled;
    registry.flags.verbose = Boolean(enabled && options && options.verbose === true);
    registry.flags.panel = panelEnabled;
    registry.panel.enabled = panelEnabled;

    Object.keys(options || {}).forEach(function copyOption(key) {
      if (key !== "registries") nextOptions[key] = options[key];
    });
    Object.keys((options && options.registries) || {}).forEach(function registerOptionBucket(name) {
      registerRegistry(name, options.registries[name]);
    });

    initializeOptions = Object.freeze(nextOptions);
    initialized = true;
    return api;
  }

  function getRegistry(name) {
    if (typeof name === "undefined") return registry;
    assertRegistryName(name);
    return hasOwn(registry, name) ? registry[name] : null;
  }

  function assertRegistry(name) {
    var bucket = getRegistry(name);
    assert(bucket && typeof bucket === "object", "missing registry '" + name + "'");
    return bucket;
  }

  function hasRegistry(name) {
    return typeof name === "string" && hasOwn(registry, name);
  }

  function registerRegistry(name, bucket) {
    assertRegistryName(name);
    assert(registryNames.indexOf(name) !== -1, "debug registry must be flags, log, or panel");
    assert(!bucket || typeof bucket === "object", "registry '" + name + "' must be an object");
    registry[name] = bucket || createRegistryBucket();
    return api;
  }

  function register(registryName, key, value) {
    var bucket = assertRegistry(registryName);

    assert(typeof key === "string" && key.length > 0, "registry key must be a non-empty string");
    bucket[key] = value;
    return api;
  }

  function get(registryName, key) {
    var bucket = assertRegistry(registryName);

    assert(typeof key === "string" && key.length > 0, "registry key must be a non-empty string");
    return hasOwn(bucket, key) ? bucket[key] : null;
  }

  function listRegistries() {
    return Object.keys(registry);
  }

  function findSubmoduleDescriptor(keyOrNamespace) {
    return submoduleCatalog.reduce(function find(found, descriptor) {
      if (found) return found;
      return descriptor.key === keyOrNamespace || descriptor.namespace === keyOrNamespace ? descriptor : null;
    }, null);
  }

  function registerSubmodule(keyOrNamespace, moduleApi) {
    var descriptor = findSubmoduleDescriptor(keyOrNamespace);
    var target = moduleApi;

    assert(descriptor, "unknown debug submodule '" + keyOrNamespace + "'");
    if (!target && global[descriptor.namespace]) target = global[descriptor.namespace];
    assert(target && typeof target === "object", "debug submodule '" + descriptor.key + "' must be an object");
    register(descriptor.registry, "api", target);
    return api;
  }

  function getSubmodule(keyOrNamespace) {
    var descriptor = findSubmoduleDescriptor(keyOrNamespace);
    var bucket;

    if (!descriptor) return null;
    bucket = getRegistry(descriptor.registry);
    if (bucket && bucket.api) return bucket.api;
    return global[descriptor.namespace] && typeof global[descriptor.namespace] === "object"
      ? global[descriptor.namespace]
      : null;
  }

  function listSubmodules() {
    return submoduleCatalog.map(function mapDescriptor(descriptor) {
      return {
        key: descriptor.key,
        namespace: descriptor.namespace,
        file: descriptor.file,
        registry: descriptor.registry,
        registered: Boolean(getSubmodule(descriptor.key))
      };
    });
  }

  function isInitialized() {
    return initialized;
  }

  function isEnabled() {
    return Boolean(registry.flags && registry.flags.enabled === true);
  }

  function getInitializeOptions() {
    var copy = {};

    Object.keys(initializeOptions).forEach(function copyOption(key) {
      copy[key] = initializeOptions[key];
    });
    return copy;
  }

  var api = {
    metadata: Object.freeze({
      namespace: namespace,
      version: version,
      layer: "debug-boundary",
      moduleFormat: "classic-script-iife",
      scriptType: "classic",
      ownsBehavior: false,
      defaultEnabled: false,
      defaultRegistries: Object.freeze(registryNames.slice()),
      expectedSubmodules: submoduleCatalog,
      domBehavior: "none",
      workerPermissionBoundary: "not-owned"
    }),
    registry: registry,
    initialize: initialize,
    getRegistry: getRegistry,
    assert: assert,
    assertRegistry: assertRegistry,
    hasRegistry: hasRegistry,
    registerRegistry: registerRegistry,
    register: register,
    get: get,
    listRegistries: listRegistries,
    registerSubmodule: registerSubmodule,
    getSubmodule: getSubmodule,
    listSubmodules: listSubmodules,
    isInitialized: isInitialized,
    isEnabled: isEnabled,
    getInitializeOptions: getInitializeOptions
  };

  initialize();
  global[namespace] = api;
})(globalThis);
