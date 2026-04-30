(function attachJJKTool(global) {
  "use strict";

  var namespace = "JJKTool";
  var version = "0.1.0-candidate";
  var registryNames = [
    "actions",
    "adapters",
    "formatters",
    "validators",
    "version",
    "schema",
    "export",
    "testHooks"
  ];
  var submoduleCatalog = Object.freeze([
    Object.freeze({ key: "version", namespace: "JJKVersionUtils", file: "modules/tool/version-utils.js", registry: "version" }),
    Object.freeze({ key: "schema", namespace: "JJKSchemaHelpers", file: "modules/tool/schema-helpers.js", registry: "schema" }),
    Object.freeze({ key: "export", namespace: "JJKExportUtils", file: "modules/tool/export-utils.js", registry: "export" }),
    Object.freeze({ key: "testHooks", namespace: "JJKTestHooks", file: "modules/tool/test-hooks.js", registry: "testHooks" })
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

    assert(descriptor, "unknown tool submodule '" + keyOrNamespace + "'");
    if (!target && global[descriptor.namespace]) target = global[descriptor.namespace];
    assert(target && typeof target === "object", "tool submodule '" + descriptor.key + "' must be an object");
    register(descriptor.registry, "api", target);
    register("adapters", descriptor.key, target);
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
      layer: "tool-boundary",
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
