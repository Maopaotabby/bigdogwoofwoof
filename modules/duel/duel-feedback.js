(function attachDuelFeedback(global) {
  "use strict";

  var namespace = "JJKDuelFeedback";
  var version = "1.387G-beta-feedback-export-package";
  var expectedExports = [
    "getDuelBetaFeedbackRules",
    "buildDuelBetaFeedbackPackage",
    "summarizeDuelFeedbackResources",
    "summarizeDuelFeedbackHandState",
    "summarizeDuelFeedbackCardTemplatesUsed",
    "serializeDuelBetaFeedbackPackage",
    "getDuelBetaFeedbackFilename",
    "validateDuelBetaFeedbackPackage"
  ];
  var expectedDependencyNames = [
    "state",
    "getAppBuildVersion",
    "getDuelBetaCopy",
    "getDuelSelectedHandActions",
    "getDuelApState",
    "getDuelHandCardViewModel",
    "getDuelCardTemplateForAction",
    "getDuelCardTemplateIndex",
    "getDuelCardTemplateFallbackStats",
    "getDuelActionTemplateIndex",
    "getDuelMechanicTemplateIndex"
  ];
  var bindings = Object.create(null);
  var dependencies = Object.create(null);

  function hasOwn(source, key) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }

  function assertExpected(name) {
    if (!expectedExports.includes(name)) {
      throw new Error(namespace + " cannot bind unexpected export: " + name);
    }
  }

  function bind(name, value) {
    assertExpected(name);
    if (typeof value !== "function") {
      throw new Error(namespace + "." + name + " must be a function.");
    }
    bindings[name] = value;
  }

  function register(map) {
    Object.keys(map || {}).forEach(function bindExport(name) {
      bind(name, map[name]);
    });
  }

  function hasBinding(name) {
    if (name === undefined) {
      return expectedExports.every(function hasExport(exportName) {
        return hasOwn(bindings, exportName);
      });
    }
    return hasOwn(bindings, name);
  }

  function get(name) {
    assertExpected(name);
    if (hasOwn(bindings, name)) return bindings[name];
    if (typeof api?.[name] === "function") return api[name];
    throw new Error(namespace + "." + name + " is not bound.");
  }

  function getBinding(name) {
    return get(name);
  }

  function listBindings() {
    return expectedExports.reduce(function buildSnapshot(snapshot, name) {
      snapshot[name] = hasBinding(name);
      return snapshot;
    }, {});
  }

  function clearBindings() {
    expectedExports.forEach(function clearName(name) {
      delete bindings[name];
    });
  }

  function registerDependencies(map) {
    Object.keys(map || {}).forEach(function bindDependency(name) {
      if (!expectedDependencyNames.includes(name)) {
        throw new Error(namespace + " received unexpected dependency: " + name);
      }
      dependencies[name] = map[name];
    });
  }

  function configure(map) {
    registerDependencies(map);
  }

  function hasDependency(name) {
    return hasOwn(dependencies, name);
  }

  function listDependencies() {
    return expectedDependencyNames.reduce(function buildSnapshot(snapshot, name) {
      snapshot[name] = hasDependency(name);
      return snapshot;
    }, {});
  }

  function clearDependencies() {
    expectedDependencyNames.forEach(function clearName(name) {
      delete dependencies[name];
    });
  }

  function getOptionalFunction(name) {
    var value = dependencies[name];
    return typeof value === "function" ? value : null;
  }

  function getDuelBetaFeedbackRules() {
    var getter = getOptionalFunction("getDuelBetaCopy");
    return getter?.() || {
      version: "0.1.0",
      status: "CANDIDATE",
      title: "术式手札 Beta 反馈",
      summary: "当前为 CANDIDATE / Beta 反馈包，用于复现手札候选与 AP 多行动体验。"
    };
  }

  function getSiteVersion(options) {
    if (options?.version) return options.version;
    var getter = getOptionalFunction("getAppBuildVersion");
    return getter?.() || "";
  }

  function buildDuelBetaFeedbackPackage(battle, options) {
    var activeBattle = battle || dependencies.state?.duelBattle || null;
    var exportedAt = options?.exportedAt || new Date();
    var battleEnded = Boolean(activeBattle?.resolved || activeBattle?.battleEnded);
    var endReason = activeBattle?.endReason || activeBattle?.resolutionReason || (battleEnded ? "special_rule" : "ongoing");
    var finalResourceSnapshot = activeBattle?.finalResourceSnapshot || summarizeDuelFeedbackResources(activeBattle);
    var finalHandState = activeBattle?.finalHandState || summarizeDuelFeedbackHandState(activeBattle);
    var finalDomainState = activeBattle?.finalDomainState || summarizeDomainState(activeBattle);
    var packageData = {
      schema: "jjk-duel-beta-feedback",
      version: getSiteVersion(options),
      status: "CANDIDATE",
      exportedAt: typeof exportedAt.toISOString === "function" ? exportedAt.toISOString() : String(exportedAt || ""),
      battleId: activeBattle?.battleId || activeBattle?.id || "",
      seed: activeBattle?.seed || activeBattle?.duelSeed || "",
      replayKey: activeBattle?.resourceState?.replayKey || activeBattle?.replayKey || "",
      leftCharacter: activeBattle?.left?.name || activeBattle?.resourceState?.p1?.name || "",
      rightCharacter: activeBattle?.right?.name || activeBattle?.resourceState?.p2?.name || "",
      round: Number(activeBattle?.round || 0),
      battleEnded: battleEnded,
      winner: normalizeWinner(activeBattle?.winnerSide),
      endReason: endReason,
      endingRound: Number(activeBattle?.endingRound || (battleEnded ? activeBattle?.round || 0 : 0)),
      leftHp: numberOrZero(activeBattle?.resourceState?.p1?.hp),
      rightHp: numberOrZero(activeBattle?.resourceState?.p2?.hp),
      leftCe: numberOrZero(activeBattle?.resourceState?.p1?.ce),
      rightCe: numberOrZero(activeBattle?.resourceState?.p2?.ce),
      finalResourceSnapshot: finalResourceSnapshot,
      finalHandState: finalHandState,
      finalDomainState: finalDomainState,
      resources: summarizeDuelFeedbackResources(activeBattle),
      handState: summarizeDuelFeedbackHandState(activeBattle),
      selectedHandActions: summarizeSelectedHandActions(activeBattle, options),
      domainState: summarizeDomainState(activeBattle),
      domainTrialContext: sanitizePlainObject(activeBattle?.domainTrialContext || activeBattle?.trialContext || null, 4),
      logs: summarizeLogs(activeBattle),
      cardTemplatesUsed: summarizeDuelFeedbackCardTemplatesUsed(activeBattle),
      cardExpansionVersion: "1.389A",
      aiUsageSummary: summarizeAiUsage(options),
      cardTemplateStats: summarizeCardTemplateStats(),
      mechanicStats: summarizeMechanicStats(activeBattle),
      performanceCacheStats: summarizePerformanceCacheStats(),
      notes: String(options?.notes || "")
    };
    packageData.valid = validateDuelBetaFeedbackPackage(packageData).ok;
    return packageData;
  }

  function summarizeDuelFeedbackResources(battle) {
    var state = battle?.resourceState || {};
    return {
      left: summarizeResource(state.p1),
      right: summarizeResource(state.p2)
    };
  }

  function summarizeAiUsage(options) {
    var estimate = options?.aiPromptEstimate || null;
    return {
      aiGovernanceVersion: "1.389B",
      apiKeyIncluded: false,
      rawResponseIncluded: false,
      promptEstimate: estimate ? {
        estimatedPromptTokens: Number(estimate.estimatedPromptTokens || 0),
        maxPromptTokens: Number(estimate.maxPromptTokens || 0),
        maxOutputTokens: Number(estimate.maxOutputTokens || 0),
        trimmed: Boolean(estimate.trimmed)
      } : null
    };
  }

  function summarizeResource(resource) {
    if (!resource) return null;
    return {
      side: resource.side || "",
      name: resource.name || "",
      hp: numberOrZero(resource.hp),
      maxHp: numberOrZero(resource.maxHp),
      ce: numberOrZero(resource.ce),
      maxCe: numberOrZero(resource.maxCe),
      stability: numberOrZero(resource.stability),
      domain: summarizeDomain(resource.domain),
      statusEffects: (resource.statusEffects || []).map(function mapEffect(effect) {
        return {
          id: effect?.id || "",
          label: effect?.label || effect?.id || "",
          value: numberOrZero(effect?.value)
        };
      }).slice(0, 12)
    };
  }

  function summarizeDomain(domain) {
    if (!domain) return null;
    return {
      active: Boolean(domain.active),
      load: numberOrZero(domain.load),
      threshold: numberOrZero(domain.threshold),
      meltdown: Boolean(domain.meltdown)
    };
  }

  function summarizeDuelFeedbackHandState(battle) {
    var candidates = battle?.actionChoices || battle?.handCandidates || [];
    var apGetter = getOptionalFunction("getDuelApState");
    return {
      actionRound: Number(battle?.actionRound || 0),
      leftAp: apGetter ? apGetter(battle, "left") : battle?.actionPoints?.left || null,
      rightAp: apGetter ? apGetter(battle, "right") : battle?.actionPoints?.right || null,
      candidateCount: candidates.length,
      candidates: candidates.map(function mapCandidate(candidate) {
        var action = candidate?.action || candidate;
        return summarizeActionCandidate(action);
      }).slice(0, 8)
    };
  }

  function summarizeSelectedHandActions(battle, options) {
    var getter = getOptionalFunction("getDuelSelectedHandActions");
    var sides = options?.sides || ["left", "right"];
    return sides.flatMap(function mapSide(side) {
      var entries = getter ? getter(battle, side) : (battle?.selectedHandActions?.[side] || []);
      return (entries || []).map(function mapEntry(entry, index) {
        return {
          side: side,
          order: index + 1,
          actionId: entry?.actionId || entry?.id || entry?.action?.id || "",
          label: entry?.label || entry?.action?.label || entry?.id || "",
          apCost: numberOrZero(entry?.apCost),
          ceCost: numberOrZero(entry?.ceCost),
          status: entry?.status || "CANDIDATE"
        };
      });
    });
  }

  function summarizeDomainState(battle) {
    return {
      subPhaseType: battle?.domainSubPhase?.type || "",
      subPhaseOwner: battle?.domainSubPhase?.owner || "",
      subPhaseStatus: battle?.domainSubPhase?.status || "",
      leftDomain: summarizeDomain(battle?.resourceState?.p1?.domain),
      rightDomain: summarizeDomain(battle?.resourceState?.p2?.domain)
    };
  }

  function summarizeLogs(battle) {
    var residual = battle?.resourceState?.residualLog || [];
    var battleLog = battle?.log || [];
    return residual.concat(battleLog).slice(0, 30).map(function mapLog(entry) {
      return {
        round: Number(entry?.round || 0),
        type: entry?.type || entry?.category || "",
        title: entry?.title || "",
        detail: entry?.detail || ""
      };
    });
  }

  function summarizeDuelFeedbackCardTemplatesUsed(battle) {
    var templateGetter = getOptionalFunction("getDuelCardTemplateForAction");
    var candidates = (battle?.actionChoices || battle?.handCandidates || []).map(function mapCandidate(candidate) {
      return candidate?.action || candidate;
    });
    var selected = ["left", "right"].flatMap(function mapSide(side) {
      return (battle?.selectedHandActions?.[side] || []).map(function mapEntry(entry) {
        return entry?.action || entry;
      });
    });
    var seen = new Set();
    return candidates.concat(selected).map(function mapAction(action) {
      var template = templateGetter ? templateGetter(action) : null;
      var actionId = action?.id || action?.actionId || template?.sourceActionId || "";
      var cardId = template?.cardId || (actionId ? "card_" + actionId : "");
      var key = cardId + "|" + actionId;
      if (!actionId || seen.has(key)) return null;
      seen.add(key);
      return {
        cardId: cardId,
        sourceActionId: template?.sourceActionId || actionId,
        cardType: template?.cardType || "",
        rarity: template?.rarity || "",
        status: template?.status || action?.status || "CANDIDATE"
      };
    }).filter(Boolean).slice(0, 20);
  }

  function summarizeCardTemplateStats() {
    var indexGetter = getOptionalFunction("getDuelCardTemplateIndex");
    var fallbackGetter = getOptionalFunction("getDuelCardTemplateFallbackStats");
    var index = indexGetter ? indexGetter() : null;
    var cards = index?.cards || [];
    var futureTemplates = cards.filter(function countFuture(card) {
      return card?.futureTemplate === true || card?.playableInHandBeta === false;
    }).length;
    var actionBacked = cards.filter(function countActionBacked(card) {
      return card?.sourceActionId && card?.futureTemplate !== true && card?.playableInHandBeta !== false;
    }).length;
    var fallbackStats = fallbackGetter ? fallbackGetter() : null;
    return {
      total: Number(index?.total || cards.length || 0),
      actionBacked: actionBacked,
      futureTemplates: futureTemplates,
      fallbackCount: Number(fallbackStats?.fallbackCount || 0)
    };
  }

  function summarizeMechanicStats(battle) {
    var indexGetter = getOptionalFunction("getDuelMechanicTemplateIndex");
    var index = indexGetter ? indexGetter() : null;
    var activeIds = new Set();
    var logs = [].concat(battle?.resourceState?.residualLog || [], battle?.log || []);
    logs.forEach(function inspectLog(entry) {
      (entry?.delta?.mechanicsApplied || []).forEach(function addMechanic(mechanic) {
        if (mechanic?.id) activeIds.add(mechanic.id);
      });
    });
    return {
      total: Number(index?.mechanicCount || index?.mechanics?.length || 0),
      activeThisBattle: Array.from(activeIds).slice(0, 20)
    };
  }

  function summarizePerformanceCacheStats() {
    var cardIndexGetter = getOptionalFunction("getDuelCardTemplateIndex");
    var actionIndexGetter = getOptionalFunction("getDuelActionTemplateIndex");
    var mechanicIndexGetter = getOptionalFunction("getDuelMechanicTemplateIndex");
    var cardIndex = cardIndexGetter ? cardIndexGetter() : null;
    var actionIndex = actionIndexGetter ? actionIndexGetter() : null;
    var mechanicIndex = mechanicIndexGetter ? mechanicIndexGetter() : null;
    return {
      cardIndexReady: Boolean(cardIndex?.cardById),
      actionIndexReady: Boolean(actionIndex?.actionById),
      mechanicIndexReady: Boolean(mechanicIndex?.mechanicById),
      lastInvalidatedAt: ""
    };
  }

  function summarizeActionCandidate(action) {
    return {
      actionId: action?.id || action?.actionId || "",
      label: action?.label || "",
      apCost: numberOrZero(action?.apCost),
      ceCost: numberOrZero(action?.ceCost ?? action?.costCe),
      risk: action?.risk || "",
      status: action?.status || "CANDIDATE",
      cardId: action?.cardId || "",
      sourceActionId: action?.sourceActionId || action?.id || action?.actionId || ""
    };
  }

  function serializeDuelBetaFeedbackPackage(packageData) {
    return JSON.stringify(packageData || {}, null, 2);
  }

  function getDuelBetaFeedbackFilename(packageData) {
    var versionText = String(packageData?.version || "duel-beta-feedback").replace(/[^a-zA-Z0-9._-]+/g, "-");
    var round = Number(packageData?.round || 0);
    return "jjk-duel-feedback-" + versionText + "-r" + round + ".json";
  }

  function validateDuelBetaFeedbackPackage(packageData) {
    var missing = [];
    ["schema", "version", "status", "resources", "handState", "selectedHandActions", "logs", "battleEnded", "endReason", "finalResourceSnapshot", "finalHandState", "finalDomainState"].forEach(function requireKey(key) {
      if (!hasOwn(packageData || {}, key)) missing.push(key);
    });
    var ok = packageData?.schema === "jjk-duel-beta-feedback" &&
      packageData?.status === "CANDIDATE" &&
      !missing.length &&
      typeof packageData?.battleEnded === "boolean" &&
      typeof packageData?.endReason === "string" &&
      Array.isArray(packageData?.selectedHandActions) &&
      Array.isArray(packageData?.logs) &&
      packageData?.cardExpansionVersion === "1.389A";
    return { ok: ok, missing: missing };
  }

  function normalizeWinner(side) {
    if (side === "left" || side === "right" || side === "draw") return side;
    return side ? String(side) : "none";
  }

  function numberOrZero(value) {
    var number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function sanitizePlainObject(value, depth) {
    if (!value || depth <= 0) return value && typeof value === "object" ? {} : value;
    if (Array.isArray(value)) {
      return value.slice(0, 20).map(function mapItem(item) {
        return sanitizePlainObject(item, depth - 1);
      });
    }
    if (typeof value !== "object") return value;
    return Object.keys(value).slice(0, 40).reduce(function buildCopy(copy, key) {
      var item = value[key];
      if (typeof item !== "function") copy[key] = sanitizePlainObject(item, depth - 1);
      return copy;
    }, {});
  }

  var api = {
    namespace: namespace,
    version: version,
    metadata: {
      version: version,
      behavior: "metadata-export",
      scriptType: "classic",
      ownsBehavior: false
    },
    expectedExports: expectedExports.slice(),
    getExpectedExports: function getExpectedExports() { return expectedExports.slice(); },
    register: register,
    bind: bind,
    hasBinding: hasBinding,
    get: get,
    getBinding: getBinding,
    listBindings: listBindings,
    clearBindings: clearBindings,
    registerDependencies: registerDependencies,
    configure: configure,
    hasDependency: hasDependency,
    listDependencies: listDependencies,
    clearDependencies: clearDependencies,
    getDuelBetaFeedbackRules: getDuelBetaFeedbackRules,
    buildDuelBetaFeedbackPackage: buildDuelBetaFeedbackPackage,
    summarizeDuelFeedbackResources: summarizeDuelFeedbackResources,
    summarizeDuelFeedbackHandState: summarizeDuelFeedbackHandState,
    summarizeDuelFeedbackCardTemplatesUsed: summarizeDuelFeedbackCardTemplatesUsed,
    serializeDuelBetaFeedbackPackage: serializeDuelBetaFeedbackPackage,
    getDuelBetaFeedbackFilename: getDuelBetaFeedbackFilename,
    validateDuelBetaFeedbackPackage: validateDuelBetaFeedbackPackage
  };

  global[namespace] = api;
})(globalThis);
