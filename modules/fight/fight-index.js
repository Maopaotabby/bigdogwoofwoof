(function attachFightFacade(global) {
  "use strict";

  var namespace = "JJKFight";
  var version = "1.387H-fight-facade";
  var moduleDescriptors = [
    { key: "resource", namespace: "JJKDuelResource", label: "duel-resource", optional: false },
    { key: "actions", namespace: "JJKDuelActions", label: "duel-actions", optional: false },
    { key: "domainResponse", namespace: "JJKDuelDomainResponse", label: "duel-domain-response", optional: false },
    { key: "domainProfile", namespace: "JJKDuelDomainProfile", label: "duel-domain-profile", optional: false },
    { key: "ruleSubphase", namespace: "JJKDuelRuleSubphase", label: "duel-rule-subphase", optional: false },
    { key: "hand", namespace: "JJKDuelHand", label: "duel-hand", optional: false },
    { key: "cardTemplate", namespace: "JJKDuelCardTemplate", label: "duel-card-template", optional: false },
    { key: "feedback", namespace: "JJKDuelFeedback", label: "duel-feedback", optional: false },
    { key: "endCondition", namespace: "JJKDuelEndCondition", label: "duel-end-condition", optional: true }
  ];
  var registry = Object.create(null);
  var initialized = false;
  var lastAssertion = null;

  function hasOwn(source, key) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }

  function warn(message, detail) {
    if (!global.console || typeof global.console.warn !== "function") return;
    if (typeof detail === "undefined") {
      global.console.warn("[JJKFight] " + message);
    } else {
      global.console.warn("[JJKFight] " + message, detail);
    }
  }

  function cloneList(value) {
    return Array.isArray(value) ? value.slice() : [];
  }

  function readCallableList(moduleApi, propertyName, getterName) {
    var value;

    if (!moduleApi) return [];
    try {
      if (typeof moduleApi[getterName] === "function") {
        value = moduleApi[getterName]();
      } else if (typeof moduleApi[propertyName] === "function") {
        value = moduleApi[propertyName]();
      } else {
        value = moduleApi[propertyName];
      }
    } catch (error) {
      warn("Unable to read " + propertyName + " from duel module.", error);
      return [];
    }
    return cloneList(value);
  }

  function readMetadata(moduleApi) {
    var metadata;

    if (!moduleApi) return null;
    try {
      if (typeof moduleApi.getMetadata === "function") {
        metadata = moduleApi.getMetadata();
      } else if (typeof moduleApi.metadata === "function") {
        metadata = moduleApi.metadata();
      } else {
        metadata = moduleApi.metadata || null;
      }
    } catch (error) {
      warn("Unable to read metadata from duel module.", error);
      return null;
    }
    return metadata || null;
  }

  function buildRegistryEntry(descriptor) {
    var moduleApi = global[descriptor.namespace];
    var present = moduleApi != null;
    return {
      key: descriptor.key,
      namespace: descriptor.namespace,
      label: descriptor.label,
      optional: Boolean(descriptor.optional),
      present: present,
      module: present ? moduleApi : null,
      metadata: readMetadata(moduleApi),
      expectedExports: readCallableList(moduleApi, "expectedExports", "getExpectedExports"),
      expectedDependencies: readCallableList(moduleApi, "expectedDependencies", "getExpectedDependencies")
    };
  }

  function refreshRegistry() {
    moduleDescriptors.forEach(function refreshEntry(descriptor) {
      registry[descriptor.key] = buildRegistryEntry(descriptor);
    });
    return registry;
  }

  function cloneRegistryEntry(entry, includeModules) {
    return {
      key: entry.key,
      namespace: entry.namespace,
      label: entry.label,
      optional: entry.optional,
      present: entry.present,
      module: includeModules ? entry.module : undefined,
      metadata: entry.metadata,
      expectedExports: cloneList(entry.expectedExports),
      expectedDependencies: cloneList(entry.expectedDependencies)
    };
  }

  function getFightModuleRegistry(options) {
    var includeModules = Boolean(options && options.includeModules);
    var refresh = !options || options.refresh !== false;
    var snapshot = Object.create(null);

    if (refresh) refreshRegistry();
    Object.keys(registry).forEach(function cloneEntry(key) {
      snapshot[key] = cloneRegistryEntry(registry[key], includeModules);
    });
    return snapshot;
  }

  function getMissingEntries(options) {
    var includeOptional = Boolean(options && options.includeOptional);
    return moduleDescriptors.filter(function isMissing(descriptor) {
      var entry = registry[descriptor.key] || buildRegistryEntry(descriptor);
      return !entry.present && (includeOptional || !descriptor.optional);
    });
  }

  function assertRequiredDuelModules(options) {
    var warnOnMissing = !options || options.warnOnMissing !== false;
    var includeOptionalWarnings = !options || options.includeOptionalWarnings !== false;
    var requiredMissing;
    var optionalMissing;
    var result;

    refreshRegistry();
    requiredMissing = getMissingEntries({ includeOptional: false });
    optionalMissing = moduleDescriptors.filter(function isOptionalMissing(descriptor) {
      var entry = registry[descriptor.key];
      return descriptor.optional && !entry.present;
    });
    if (warnOnMissing) {
      requiredMissing.forEach(function warnRequired(descriptor) {
        warn("Missing duel module: globalThis." + descriptor.namespace);
      });
      if (includeOptionalWarnings) {
        optionalMissing.forEach(function warnOptional(descriptor) {
          warn("Optional duel module is not present: globalThis." + descriptor.namespace);
        });
      }
    }
    result = {
      ok: requiredMissing.length === 0,
      missing: requiredMissing.map(function mapMissing(descriptor) {
        return descriptor.namespace;
      }),
      optionalMissing: optionalMissing.map(function mapOptionalMissing(descriptor) {
        return descriptor.namespace;
      }),
      present: moduleDescriptors.filter(function isPresent(descriptor) {
        return registry[descriptor.key].present;
      }).map(function mapPresent(descriptor) {
        return descriptor.namespace;
      }),
      registry: getFightModuleRegistry({ refresh: false })
    };
    lastAssertion = result;
    return result;
  }

  function initialize(options) {
    initialized = true;
    refreshRegistry();
    lastAssertion = assertRequiredDuelModules({
      warnOnMissing: !options || options.warnOnMissing !== false,
      includeOptionalWarnings: !options || options.includeOptionalWarnings !== false
    });
    return api;
  }

  function hasModule(keyOrNamespace) {
    var value = String(keyOrNamespace || "");
    var entry;

    if (!value) return false;
    refreshRegistry();
    entry = registry[value] || moduleDescriptors.reduce(function findByNamespace(found, descriptor) {
      return found || (descriptor.namespace === value ? registry[descriptor.key] : null);
    }, null);
    return Boolean(entry && entry.present);
  }

  function getModule(keyOrNamespace) {
    var value = String(keyOrNamespace || "");
    var entry;

    if (!value) return null;
    refreshRegistry();
    entry = registry[value] || moduleDescriptors.reduce(function findByNamespace(found, descriptor) {
      return found || (descriptor.namespace === value ? registry[descriptor.key] : null);
    }, null);
    return entry && entry.present ? entry.module : null;
  }

  var api = {
    namespace: namespace,
    version: version,
    metadata: Object.freeze({
      namespace: namespace,
      version: version,
      layer: "fight-facade",
      moduleFormat: "classic-script-iife",
      scriptType: "classic",
      behavior: "facade",
      ownsBehavior: false,
      mutatesDuelBalance: false
    }),
    moduleDescriptors: moduleDescriptors.map(function cloneDescriptor(descriptor) {
      return {
        key: descriptor.key,
        namespace: descriptor.namespace,
        label: descriptor.label,
        optional: Boolean(descriptor.optional)
      };
    }),
    registry: registry,
    initialize: initialize,
    assertRequiredDuelModules: assertRequiredDuelModules,
    getFightModuleRegistry: getFightModuleRegistry,
    refreshRegistry: refreshRegistry,
    hasModule: hasModule,
    getModule: getModule,
    isInitialized: function isInitialized() {
      return initialized;
    },
    getLastAssertion: function getLastAssertion() {
      return lastAssertion;
    }
  };

  refreshRegistry();
  if (hasOwn(global, namespace) && global[namespace] && typeof global[namespace] === "object") {
    warn("Replacing existing globalThis." + namespace + " facade.");
  }
  global[namespace] = api;
})(globalThis);
