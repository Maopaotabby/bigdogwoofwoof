(function attachJJKApi(global) {
  "use strict";

  var namespace = "JJKApi";
  var version = "0.1.0-candidate";
  var registryNames = [
    "clients",
    "endpoints",
    "requests",
    "responses",
    "storage",
    "clipboard",
    "feedbackExport",
    "aiWorker",
    "aiPromptBuilder"
  ];
  var submoduleCatalog = Object.freeze([
    Object.freeze({ key: "storage", namespace: "JJKStorageApi", file: "modules/api/storage-api.js", registry: "storage" }),
    Object.freeze({ key: "clipboard", namespace: "JJKClipboardApi", file: "modules/api/clipboard-api.js", registry: "clipboard" }),
    Object.freeze({ key: "feedbackExport", namespace: "JJKFeedbackExportApi", file: "modules/api/feedback-export-api.js", registry: "feedbackExport" }),
    Object.freeze({ key: "aiWorker", namespace: "JJKAiWorkerClient", file: "modules/api/ai-worker-client.js", registry: "aiWorker" }),
    Object.freeze({ key: "aiPromptBuilder", namespace: "JJKAiPromptBuilder", file: "modules/api/ai-prompt-builder.js", registry: "aiPromptBuilder" })
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

  function initialize(options) {
    var nextOptions = {};

    registryNames.forEach(ensureRegistry);
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

    assert(descriptor, "unknown api submodule '" + keyOrNamespace + "'");
    if (!target && global[descriptor.namespace]) target = global[descriptor.namespace];
    assert(target && typeof target === "object", "api submodule '" + descriptor.key + "' must be an object");
    register(descriptor.registry, "api", target);
    register("clients", descriptor.key, target);
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
      layer: "api-boundary",
      moduleFormat: "classic-script-iife",
      scriptType: "classic",
      ownsBehavior: false,
      defaultRegistries: Object.freeze(registryNames.slice()),
      expectedSubmodules: submoduleCatalog,
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
    getInitializeOptions: getInitializeOptions
  };

  initialize();
  global[namespace] = api;
})(globalThis);
