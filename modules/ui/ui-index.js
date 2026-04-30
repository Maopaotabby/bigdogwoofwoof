(function attachJJKUI(global) {
  "use strict";

  var namespace = "JJKUI";
  var version = "1.387M-agent-d-ui-helper-candidate";
  var registry = Object.create(null);
  var initialized = false;
  var initializeCount = 0;
  var lastInitializeReport = null;
  var childModuleDescriptors = [
    { id: "renderHelpers", namespace: "JJKUIRenderHelpers", file: "modules/ui/ui-render-helpers.js", layer: "ui-render-helpers", optional: true },
    { id: "components", namespace: "JJKUIComponents", file: "modules/ui/ui-components.js", layer: "ui-components", optional: true },
    { id: "mobile", namespace: "JJKUIMobile", file: "modules/ui/ui-mobile.js", layer: "ui-mobile", optional: true },
    { id: "panels", namespace: "JJKUIPanels", file: "modules/ui/ui-panels.js", layer: "ui-panels", optional: true }
  ];

  function hasOwn(source, key) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }

  function cloneArray(value) {
    return Array.isArray(value) ? value.slice() : [];
  }

  function cloneChildDescriptor(descriptor) {
    return {
      id: descriptor.id,
      namespace: descriptor.namespace,
      file: descriptor.file,
      layer: descriptor.layer,
      optional: Boolean(descriptor.optional)
    };
  }

  function cloneObject(value) {
    var copy = {};
    if (!value || typeof value !== "object") return copy;
    Object.keys(value).forEach(function copyKey(key) {
      var item = value[key];
      if (Array.isArray(item)) {
        copy[key] = item.slice();
      } else if (item && typeof item === "object") {
        copy[key] = cloneObject(item);
      } else {
        copy[key] = item;
      }
    });
    return copy;
  }

  function normalizeId(id) {
    return String(id || "").trim();
  }

  function warn(message) {
    if (global.console && typeof global.console.warn === "function") {
      global.console.warn(namespace + ": " + message);
    }
  }

  function getMetadata(moduleApi) {
    if (!moduleApi || typeof moduleApi !== "object") return {};
    if (moduleApi.metadata && typeof moduleApi.metadata === "object") {
      return cloneObject(moduleApi.metadata);
    }
    return {};
  }

  function createDescriptor(id, moduleApi, options) {
    var metadata = getMetadata(moduleApi);
    var descriptorOptions = options || {};
    var moduleId = normalizeId(id || descriptorOptions.id || metadata.namespace || metadata.layer);

    if (!moduleId) {
      throw new Error(namespace + ": registry id is required");
    }

    return {
      id: moduleId,
      namespace: descriptorOptions.namespace || metadata.namespace || moduleId,
      layer: descriptorOptions.layer || metadata.layer || "ui",
      owner: descriptorOptions.owner || metadata.owner || "",
      status: descriptorOptions.status || "registered",
      required: Boolean(descriptorOptions.required),
      initialized: Boolean(descriptorOptions.initialized),
      registeredAt: new Date().toISOString(),
      metadata: metadata,
      expectedDependencies: cloneArray(moduleApi && moduleApi.expectedDependencies),
      expectedExports: cloneArray(moduleApi && moduleApi.expectedExports),
      api: moduleApi || null
    };
  }

  function toPublicDescriptor(descriptor) {
    return {
      id: descriptor.id,
      namespace: descriptor.namespace,
      layer: descriptor.layer,
      owner: descriptor.owner,
      status: descriptor.status,
      required: descriptor.required,
      initialized: descriptor.initialized,
      registeredAt: descriptor.registeredAt,
      metadata: cloneObject(descriptor.metadata),
      expectedDependencies: cloneArray(descriptor.expectedDependencies),
      expectedExports: cloneArray(descriptor.expectedExports),
      available: Boolean(descriptor.api)
    };
  }

  function registerModule(id, moduleApi, options) {
    var descriptor;
    var moduleId = normalizeId(id);

    if (moduleId && arguments.length === 1 && global[moduleId]) {
      moduleApi = global[moduleId];
    }
    descriptor = createDescriptor(moduleId, moduleApi, options);
    registry[descriptor.id] = descriptor;
    return api;
  }

  function register(map) {
    if (!map || typeof map !== "object") return api;
    Object.keys(map).forEach(function registerEntry(id) {
      registerModule(id, map[id]);
    });
    return api;
  }

  function unregisterModule(id) {
    var moduleId = normalizeId(id);
    if (moduleId && hasOwn(registry, moduleId)) delete registry[moduleId];
    return api;
  }

  function hasModule(id) {
    var moduleId = normalizeId(id);
    return Boolean(moduleId && hasOwn(registry, moduleId) && registry[moduleId].api);
  }

  function getModule(id) {
    var moduleId = normalizeId(id);
    return moduleId && hasOwn(registry, moduleId) ? registry[moduleId].api : null;
  }

  function listModules() {
    return Object.keys(registry);
  }

  function getRegistry() {
    return Object.keys(registry).reduce(function buildSnapshot(snapshot, id) {
      snapshot[id] = toPublicDescriptor(registry[id]);
      return snapshot;
    }, {});
  }

  function clearRegistry() {
    Object.keys(registry).forEach(function clearEntry(id) {
      delete registry[id];
    });
    return api;
  }

  function refreshChildModules(options) {
    var config = options || {};
    var discovered = [];
    var missing = [];

    childModuleDescriptors.forEach(function refreshChild(descriptor) {
      var moduleApi = global[descriptor.namespace];

      if (moduleApi && typeof moduleApi === "object") {
        registerModule(descriptor.id, moduleApi, {
          namespace: descriptor.namespace,
          layer: descriptor.layer,
          owner: descriptor.namespace,
          status: "candidate",
          required: descriptor.optional === false,
          initialized: Boolean(moduleApi.isInitialized && moduleApi.isInitialized())
        });
        discovered.push(descriptor.namespace);
      } else {
        missing.push(descriptor.namespace);
        if (config.registerMissing) {
          registerModule(descriptor.id, null, {
            namespace: descriptor.namespace,
            layer: descriptor.layer,
            owner: descriptor.namespace,
            status: "missing",
            required: descriptor.optional === false
          });
        }
      }
    });

    return {
      discovered: discovered,
      missing: missing,
      descriptors: childModuleDescriptors.map(cloneChildDescriptor)
    };
  }

  function getKnownChildModules() {
    return childModuleDescriptors.map(cloneChildDescriptor);
  }

  function getMissingExpectedChildModules(options) {
    var includeOptional = Boolean(options && options.includeOptional);
    return refreshChildModules({ registerMissing: false }).missing.filter(function filterMissing(namespaceName) {
      if (includeOptional) return true;
      return childModuleDescriptors.some(function findRequired(descriptor) {
        return descriptor.namespace === namespaceName && descriptor.optional === false;
      });
    });
  }

  function assertExpectedChildModules(options) {
    var missing = getMissingExpectedChildModules(options);
    var result = {
      ok: missing.length === 0,
      missing: missing,
      optionalOnly: missing.length === 0 && !getMissingExpectedChildModules({ includeOptional: true }).length
    };

    if (!result.ok && (!options || options.warnOnMissing !== false)) {
      missing.forEach(function warnMissing(moduleNamespace) {
        warn("Missing UI child module: globalThis." + moduleNamespace);
      });
    }
    return result;
  }

  function initialize(options) {
    var config = options || {};
    var modules = config.modules;

    initialized = true;
    initializeCount += 1;

    if (modules && typeof modules === "object") {
      register(modules);
    }

    refreshChildModules({
      registerMissing: Boolean(config.registerMissingChildren)
    });

    if (!hasOwn(registry, namespace)) {
      registerModule(namespace, api, {
        layer: "ui-index",
        owner: namespace,
        initialized: true
      });
    } else {
      registry[namespace].initialized = true;
    }

    lastInitializeReport = {
      namespace: namespace,
      initialized: initialized,
      initializeCount: initializeCount,
      registry: getRegistry(),
      childModules: refreshChildModules({ registerMissing: false }),
      warnings: []
    };

    if (!listModules().length) {
      lastInitializeReport.warnings.push("UI registry is empty.");
      warn("UI registry is empty.");
    }

    return cloneObject(lastInitializeReport);
  }

  function getInitializeReport() {
    return lastInitializeReport ? cloneObject(lastInitializeReport) : null;
  }

  var api = {
    metadata: Object.freeze({
      namespace: namespace,
      version: version,
      layer: "ui-index",
      moduleFormat: "classic-script-iife",
      scriptType: "classic",
      behavior: "metadata-registry",
      ownsBehavior: false,
      childModules: Object.freeze(childModuleDescriptors.map(cloneChildDescriptor)),
      notes: "Lightweight UI metadata and helper registry only; app.js remains the runtime owner."
    }),
    registry: registry,
    childModuleDescriptors: childModuleDescriptors.map(cloneChildDescriptor),
    initialize: initialize,
    getInitializeReport: getInitializeReport,
    register: register,
    registerModule: registerModule,
    unregisterModule: unregisterModule,
    hasModule: hasModule,
    getModule: getModule,
    listModules: listModules,
    getRegistry: getRegistry,
    clearRegistry: clearRegistry,
    refreshChildModules: refreshChildModules,
    getKnownChildModules: getKnownChildModules,
    getMissingExpectedChildModules: getMissingExpectedChildModules,
    assertExpectedChildModules: assertExpectedChildModules
  };

  global[namespace] = api;
})(globalThis);
