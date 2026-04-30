(function attachJJKMain(global) {
  "use strict";

  var namespace = "JJKMain";
  var version = "1.387M-site-module-true-extraction-sweep";
  var siteModuleRegistry = {
    ui: {
      id: "ui",
      owner: "JJKUI",
      requiredNamespaces: ["JJKUI"],
      optionalNamespaces: [],
      delegatedToApp: false
    },
    modules: {
      id: "modules",
      owner: "JJKMain",
      requiredNamespaces: [
        "JJKTool",
        "JJKApi",
        "JJKCharacter",
        "JJKLifeWheel",
        "JJKDuelResource",
        "JJKDuelActions",
        "JJKDuelCardTemplate",
        "JJKDuelHand",
        "JJKDuelFeedback",
        "JJKDuelEndCondition",
        "JJKDuelDomainResponse",
        "JJKDuelDomainProfile",
        "JJKDuelRuleSubphase",
        "JJKFight",
        "JJKUI",
        "JJKDebug"
      ],
      optionalNamespaces: [],
      delegatedToApp: false
    },
    lifeWheel: {
      id: "lifeWheel",
      owner: "JJKLifeWheel",
      requiredNamespaces: ["JJKLifeWheel"],
      optionalNamespaces: [],
      delegatedToApp: true
    },
    fight: {
      id: "fight",
      owner: "JJKFight",
      requiredNamespaces: [
        "JJKFight",
        "JJKDuelResource",
        "JJKDuelActions",
        "JJKDuelCardTemplate",
        "JJKDuelHand",
        "JJKDuelFeedback",
        "JJKDuelEndCondition",
        "JJKDuelDomainResponse",
        "JJKDuelDomainProfile",
        "JJKDuelRuleSubphase"
      ],
      optionalNamespaces: [],
      delegatedToApp: true
    },
    character: {
      id: "character",
      owner: "JJKCharacter",
      requiredNamespaces: ["JJKCharacter"],
      optionalNamespaces: [],
      delegatedToApp: true
    },
    api: {
      id: "api",
      owner: "JJKApi",
      requiredNamespaces: ["JJKApi"],
      optionalNamespaces: [],
      delegatedToApp: true
    },
    tools: {
      id: "tools",
      owner: "JJKTool",
      requiredNamespaces: ["JJKTool"],
      optionalNamespaces: [],
      delegatedToApp: true
    },
    debug: {
      id: "debug",
      owner: "JJKDebug",
      requiredNamespaces: ["JJKDebug"],
      optionalNamespaces: [],
      delegatedToApp: true
    }
  };
  var lastSiteReport = null;

  function hasOwn(source, key) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }

  function cloneArray(value) {
    return Array.isArray(value) ? value.slice() : [];
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

  function warn(message) {
    if (global.console && typeof global.console.warn === "function") {
      global.console.warn(namespace + ": " + message);
    }
  }

  function normalizeNamespace(name) {
    return String(name || "").trim();
  }

  function getNamespaceApi(name) {
    var namespaceName = normalizeNamespace(name);
    if (!namespaceName) return null;
    return global[namespaceName] && typeof global[namespaceName] === "object" ? global[namespaceName] : null;
  }

  function getExpectedDependencies(api) {
    if (!api || typeof api !== "object") return [];
    if (Array.isArray(api.expectedDependencies)) return api.expectedDependencies.slice();
    if (api.metadata && Array.isArray(api.metadata.expectedDependencies)) {
      return api.metadata.expectedDependencies.slice();
    }
    return [];
  }

  function getExpectedExports(api) {
    if (!api || typeof api !== "object") return [];
    if (Array.isArray(api.expectedExports)) return api.expectedExports.slice();
    if (api.metadata && Array.isArray(api.metadata.expectedExports)) {
      return api.metadata.expectedExports.slice();
    }
    return [];
  }

  function getDependencyStatus(api) {
    var status = {};
    var missing = [];
    var list;

    if (!api || typeof api !== "object") {
      return { status: status, missing: missing };
    }

    if (typeof api.listDependencies === "function") {
      try {
        list = api.listDependencies();
      } catch (error) {
        list = null;
      }
      if (list && typeof list === "object") {
        Object.keys(list).forEach(function copyStatus(name) {
          status[name] = Boolean(list[name]);
          if (!list[name]) missing.push(name);
        });
      }
    }

    if (typeof api.missingDependencies === "function") {
      try {
        missing = api.missingDependencies();
      } catch (error) {
        missing = missing;
      }
    }

    return {
      status: status,
      missing: Array.isArray(missing) ? missing.slice() : []
    };
  }

  function getDependencyMap(options, namespaceName) {
    var dependencies = options && options.dependencies;
    if (!dependencies || typeof dependencies !== "object") return null;
    return dependencies[namespaceName] || null;
  }

  function registerDependencies(api, namespaceName, options, warnings) {
    var map = getDependencyMap(options, namespaceName);

    if (!map || typeof map !== "object") return false;

    if (typeof api.registerDependencies === "function") {
      api.registerDependencies(map);
      return true;
    }
    if (typeof api.configure === "function") {
      api.configure(map);
      return true;
    }

    warnings.push(namespaceName + " does not expose registerDependencies/configure; dependencies were not registered.");
    return false;
  }

  function inspectNamespace(namespaceName, options) {
    var api = getNamespaceApi(namespaceName);
    var warnings = [];
    var dependencyStatus;
    var registeredDependencies = false;

    if (!api) {
      warnings.push("Missing required namespace " + namespaceName + ".");
      return {
        namespace: namespaceName,
        present: false,
        metadata: {},
        expectedExports: [],
        expectedDependencies: [],
        dependencyStatus: {},
        missingDependencies: [],
        registeredDependencies: false,
        warnings: warnings
      };
    }

    registeredDependencies = registerDependencies(api, namespaceName, options, warnings);
    dependencyStatus = getDependencyStatus(api);

    if (dependencyStatus.missing.length) {
      warnings.push(namespaceName + " has missing dependencies: " + dependencyStatus.missing.join(", ") + ".");
    }

    return {
      namespace: namespaceName,
      present: true,
      metadata: cloneObject(api.metadata),
      expectedExports: getExpectedExports(api),
      expectedDependencies: getExpectedDependencies(api),
      dependencyStatus: dependencyStatus.status,
      missingDependencies: dependencyStatus.missing,
      registeredDependencies: registeredDependencies,
      warnings: warnings
    };
  }

  function collectNamespaces(group, options) {
    var config = options || {};
    var required = cloneArray(group.requiredNamespaces);
    var optional = cloneArray(group.optionalNamespaces);

    if (Array.isArray(config.requiredNamespaces)) {
      required = config.requiredNamespaces.slice();
    }
    if (Array.isArray(config.optionalNamespaces)) {
      optional = config.optionalNamespaces.slice();
    }

    return {
      required: required,
      optional: optional
    };
  }

  function checkGroup(groupId, options) {
    var group = siteModuleRegistry[groupId];
    var namespaceLists;
    var modules = [];
    var optionalModules = [];
    var warnings = [];
    var report;

    if (!group) {
      throw new Error(namespace + ": unknown site module group '" + groupId + "'");
    }

    namespaceLists = collectNamespaces(group, options);

    namespaceLists.required.forEach(function inspectRequired(namespaceName) {
      var moduleReport = inspectNamespace(namespaceName, options || {});
      modules.push(moduleReport);
      moduleReport.warnings.forEach(function addWarning(message) {
        warnings.push(groupId + ": " + message);
      });
    });

    namespaceLists.optional.forEach(function inspectOptional(namespaceName) {
      var api = getNamespaceApi(namespaceName);
      var moduleReport;
      if (!api) {
        optionalModules.push({
          namespace: namespaceName,
          present: false,
          metadata: {},
          warnings: []
        });
        return;
      }
      moduleReport = inspectNamespace(namespaceName, options || {});
      optionalModules.push(moduleReport);
      moduleReport.warnings.forEach(function addWarning(message) {
        warnings.push(groupId + " optional " + message);
      });
    });

    report = {
      id: group.id,
      owner: group.owner,
      delegatedToApp: Boolean(group.delegatedToApp),
      modules: modules,
      optionalModules: optionalModules,
      warnings: warnings,
      note: group.delegatedToApp
        ? group.id + " remains owned by app.js; JJKMain does not run business logic."
        : ""
    };

    if (warnings.length && !(options && options.silent)) {
      warnings.forEach(warn);
    }

    return report;
  }

  function initializeUI(options) {
    var report = checkGroup("ui", options);
    var ui = getNamespaceApi("JJKUI");

    if (ui && typeof ui.initialize === "function") {
      report.uiInitialize = ui.initialize({
        modules: {
          JJKMain: api
        }
      });
    }

    return report;
  }

  function initializeModules(options) {
    return checkGroup("modules", options);
  }

  function initializeLifeWheel(options) {
    return checkGroup("lifeWheel", options);
  }

  function initializeFight(options) {
    return checkGroup("fight", options);
  }

  function initializeCharacter(options) {
    return checkGroup("character", options);
  }

  function initializeApi(options) {
    return checkGroup("api", options);
  }

  function initializeTools(options) {
    return checkGroup("tools", options);
  }

  function initializeDebug(options) {
    return checkGroup("debug", options);
  }

  function initializeSite(options) {
    var config = options || {};
    var report = {
      namespace: namespace,
      version: version,
      initializedAt: new Date().toISOString(),
      warnings: [],
      ui: initializeUI(config),
      modules: initializeModules(config),
      lifeWheel: initializeLifeWheel(config),
      fight: initializeFight(config),
      character: initializeCharacter(config),
      api: initializeApi(config),
      tools: initializeTools(config),
      debug: initializeDebug(config)
    };

    ["ui", "modules", "lifeWheel", "fight", "character", "api", "tools", "debug"].forEach(function collectWarnings(key) {
      (report[key].warnings || []).forEach(function addWarning(message) {
        report.warnings.push(message);
      });
    });

    lastSiteReport = report;
    return cloneObject(report);
  }

  function getSiteModuleRegistry() {
    return cloneObject(siteModuleRegistry);
  }

  function assertRequiredSiteModules(options) {
    var config = options || {};
    var group = {
      id: "assertRequiredSiteModules",
      owner: "app.js",
      requiredNamespaces: Array.isArray(config.requiredNamespaces)
        ? config.requiredNamespaces.slice()
        : siteModuleRegistry.modules.requiredNamespaces.slice(),
      optionalNamespaces: [],
      delegatedToApp: true
    };
    var report = checkGroupWithConfig(group, config);
    var missingNamespaces = report.modules.filter(function isMissingNamespace(moduleReport) {
      return !moduleReport.present;
    }).map(function mapNamespace(moduleReport) {
      return moduleReport.namespace;
    });

    report.missingNamespaces = missingNamespaces;
    if (missingNamespaces.length && config.throwOnMissing === true) {
      throw new Error(namespace + ": missing required namespaces: " + missingNamespaces.join(", "));
    }

    return report;
  }

  function checkGroupWithConfig(group, options) {
    var previous = siteModuleRegistry[group.id];
    var report;
    siteModuleRegistry[group.id] = group;
    try {
      report = checkGroup(group.id, options || {});
    } finally {
      if (previous) {
        siteModuleRegistry[group.id] = previous;
      } else {
        delete siteModuleRegistry[group.id];
      }
    }
    return report;
  }

  function getLastSiteReport() {
    return lastSiteReport ? cloneObject(lastSiteReport) : null;
  }

  var api = {
    metadata: Object.freeze({
      namespace: namespace,
      version: version,
      layer: "main-entry",
      moduleFormat: "classic-script-iife",
      scriptType: "classic",
      behavior: "module-checks-only",
      ownsBehavior: false,
      notes: "JJKMain validates namespaces and dependency registration only; app.js remains the site initializer."
    }),
    initializeSite: initializeSite,
    initializeModules: initializeModules,
    initializeLifeWheel: initializeLifeWheel,
    initializeFight: initializeFight,
    initializeCharacter: initializeCharacter,
    initializeUI: initializeUI,
    initializeApi: initializeApi,
    initializeTools: initializeTools,
    initializeDebug: initializeDebug,
    getSiteModuleRegistry: getSiteModuleRegistry,
    assertRequiredSiteModules: assertRequiredSiteModules,
    getLastSiteReport: getLastSiteReport
  };

  global[namespace] = api;
})(globalThis);
