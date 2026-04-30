(function attachDuelActions(global) {
  "use strict";

  var namespace = "JJKDuelActions";
  var version = "1.386E-resource-action-extraction";
  var expectedExports = [
    "getDuelActionTemplates",
    "buildDuelActionPool",
    "pickDuelActionChoices",
    "getDuelActionCost",
    "getDuelActionAvailability",
    "applyDuelActionEffect",
    "getDuelCpuAction",
    "buildDuelDomainSpecificActions",
    "invalidateDuelActionChoices"
  ];
  var expectedDependencyNames = [
    "state",
    "getDuelActionRules",
    "getDuelMechanicTemplateRules",
    "getDuelBattle",
    "getDuelActionCost",
    "getDuelProfileForSide",
    "getDuelDomainResponseProfile",
    "isDuelOpponentDomainThreat",
    "hasDuelDomainCounterAccess",
    "getDuelStatusEffectValue",
    "hashDuelSeed",
    "clamp",
    "syncDuelTrialSubPhaseLifecycle",
    "updateDuelDomainTrialContext",
    "normalizeDuelDomainSpecificAction",
    "applyDuelDomainSpecificAction",
    "applyDuelTrialAction",
    "applyDuelJackpotAction",
    "getDuelTrialOwnerActionTemplates",
    "getDuelTrialDefenderActionTemplates",
    "getDuelResourcePair",
    "clampDuelResource",
    "appendDuelActionLog",
    "recordDuelResourceChange",
    "getDuelResourceSideLabel",
    "formatSignedDuelDelta",
    "DUEL_DOMAIN_RESPONSE_ACTION_IDS"
  ];
  var dependencySources = {
    getDuelDomainResponseProfile: ["JJKDuelDomainResponse", "getDuelDomainResponseProfile"],
    isDuelOpponentDomainThreat: ["JJKDuelDomainResponse", "isDuelOpponentDomainThreat"],
    hasDuelDomainCounterAccess: ["JJKDuelDomainResponse", "hasDuelDomainCounterAccess"],
    getDuelResourcePair: ["JJKDuelResource", "getDuelResourcePair"],
    clampDuelResource: ["JJKDuelResource", "clampDuelResource"],
    syncDuelTrialSubPhaseLifecycle: ["JJKDuelRuleSubphase", "syncDuelTrialSubPhaseLifecycle"],
    updateDuelDomainTrialContext: ["JJKDuelRuleSubphase", "updateDuelDomainTrialContext"],
    applyDuelTrialAction: ["JJKDuelRuleSubphase", "applyDuelTrialAction"],
    applyDuelJackpotAction: ["JJKDuelRuleSubphase", "applyDuelJackpotAction"],
    DUEL_DOMAIN_RESPONSE_ACTION_IDS: ["JJKDuelDomainResponse", "DUEL_DOMAIN_RESPONSE_ACTION_IDS"]
  };
  var domainResponseActionIds = new Set([
    "domain_clash",
    "simple_domain_guard",
    "hollow_wicker_basket_guard",
    "falling_blossom_emotion",
    "zero_ce_domain_bypass",
    "domain_survival_guard"
  ]);
  var bindings = Object.create(null);
  var dependencies = Object.create(null);
  var actionTemplateIndexCache = null;
  var mechanicTemplateIndexCache = null;
  var performanceCacheStats = {
    actionLastInvalidatedAt: "",
    mechanicLastInvalidatedAt: ""
  };

  function hasOwn(source, key) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }

  function isExpected(name) {
    return expectedExports.indexOf(name) !== -1;
  }

  function isExpectedDependency(name) {
    return expectedDependencyNames.indexOf(name) !== -1;
  }

  function assertExpected(name) {
    if (!isExpected(name)) {
      throw new Error(namespace + ": unexpected export '" + name + "'");
    }
  }

  function assertExpectedDependency(name) {
    if (!isExpectedDependency(name)) {
      throw new Error(namespace + ": unexpected dependency '" + name + "'");
    }
  }

  function assertFunction(name, value) {
    if (typeof value !== "function") {
      throw new TypeError(namespace + ": binding '" + name + "' must be a function");
    }
  }

  function bind(name, value) {
    assertExpected(name);
    assertFunction(name, value);
    bindings[name] = value;
    return api;
  }

  function register(map) {
    if (!map || typeof map !== "object") return api;
    expectedExports.forEach(function bindExport(name) {
      if (hasOwn(map, name) && map[name] != null) {
        bind(name, map[name]);
      }
    });
    return api;
  }

  function bindDependency(name, value) {
    assertExpectedDependency(name);
    if (name === "state") {
      dependencies[name] = value;
      return api;
    }
    if (name === "DUEL_DOMAIN_RESPONSE_ACTION_IDS") {
      dependencies[name] = normalizeActionIdSet(value);
      return api;
    }
    assertFunction(name, value);
    dependencies[name] = value;
    return api;
  }

  function configure(map) {
    if (!map || typeof map !== "object") return api;
    Object.keys(map).forEach(function bindEntry(name) {
      if (isExpectedDependency(name) && map[name] != null) {
        bindDependency(name, map[name]);
      }
    });
    return api;
  }

  function registerDependencies(map) {
    return configure(map);
  }

  function hasBinding(name) {
    if (typeof name === "undefined") {
      return expectedExports.every(function hasExport(exportName) {
        return typeof get(exportName) === "function";
      });
    }
    return isExpected(name) && typeof get(name) === "function";
  }

  function get(name) {
    assertExpected(name);
    return bindings[name] || implementations[name];
  }

  function getBinding(name) {
    assertExpected(name);
    return bindings[name] || null;
  }

  function listBindings() {
    return expectedExports.reduce(function buildSnapshot(snapshot, name) {
      snapshot[name] = typeof get(name) === "function";
      return snapshot;
    }, {});
  }

  function clearBindings() {
    expectedExports.forEach(function clearName(name) {
      delete bindings[name];
    });
    return api;
  }

  function hasDependency(name) {
    return isExpectedDependency(name) && Boolean(getOptionalDependency(name));
  }

  function listDependencies() {
    return expectedDependencyNames.reduce(function buildSnapshot(snapshot, name) {
      snapshot[name] = Boolean(getOptionalDependency(name));
      return snapshot;
    }, {});
  }

  function clearDependencies() {
    expectedDependencyNames.forEach(function clearName(name) {
      delete dependencies[name];
    });
    return api;
  }

  function getNamespaceBinding(namespaceName, exportName) {
    var target = global[namespaceName];
    if (!target) return null;
    if (typeof target.getBinding === "function") {
      var binding = target.getBinding(exportName);
      if (binding != null) return binding;
    }
    if (typeof target.get === "function") {
      try {
        var value = target.get(exportName);
        if (value != null) return value;
      } catch (error) {
        return null;
      }
    }
    if (hasOwn(target, exportName) && target[exportName] != null) return target[exportName];
    return null;
  }

  function getOptionalDependency(name) {
    if (hasOwn(dependencies, name)) return dependencies[name];
    var source = dependencySources[name];
    if (!source) return null;
    return getNamespaceBinding(source[0], source[1]);
  }

  function requireDependency(name) {
    var dependency = getOptionalDependency(name);
    if (dependency == null) {
      throw new Error(namespace + ": missing dependency '" + name + "'");
    }
    return dependency;
  }

  function callDependency(name, args) {
    return requireDependency(name).apply(null, args || []);
  }

  function getDefaultBattle() {
    var getter = getOptionalDependency("getDuelBattle");
    if (typeof getter === "function") return getter();
    var appState = getOptionalDependency("state");
    return appState?.duelBattle || null;
  }

  function getBattle(duelState) {
    return duelState || getDefaultBattle();
  }

  function getDuelActionRules() {
    return callDependency("getDuelActionRules", []);
  }

  function getDuelActionTemplates() {
    return getDuelActionRules().templates || [];
  }

  function getDuelMechanicTemplateRules() {
    var getter = getOptionalDependency("getDuelMechanicTemplateRules");
    if (typeof getter === "function" && getter !== getDuelMechanicTemplateRules) return getter();
    var appState = getOptionalDependency("state");
    return appState?.duelMechanicRules || {
      schema: "jjk-duel-mechanic-templates",
      version: "0.1.0-candidate",
      status: "CANDIDATE",
      mechanics: []
    };
  }

  function getDuelMechanicTemplates() {
    var rules = getDuelMechanicTemplateRules();
    return Array.isArray(rules?.mechanics) ? rules.mechanics : [];
  }

  function addIndexedItem(index, key, value) {
    if (!key) return;
    index[key] ||= [];
    index[key].push(value);
  }

  function readActionContexts(action) {
    var contexts = []
      .concat(action?.allowedContexts || [])
      .concat(action?.availability?.contexts || []);
    if (action?.requirements?.domainActive === true) contexts.push("domain_active");
    if (action?.requirements?.opponentDomainActive) contexts.push("opponent_domain");
    if (!contexts.length) contexts.push("normal");
    return Array.from(new Set(contexts.filter(Boolean)));
  }

  function buildDuelActionTemplateIndexes(rules) {
    var activeRules = rules || getDuelActionRules();
    var templates = Array.isArray(activeRules?.templates) ? activeRules.templates : [];
    var index = {
      schema: "jjk-duel-action-template-index",
      version: activeRules?.version || "",
      templateCount: templates.length,
      templates: templates,
      actionById: Object.create(null),
      actionsByTag: Object.create(null),
      actionsByContext: Object.create(null)
    };
    templates.forEach(function indexAction(action) {
      if (!action?.id) return;
      index.actionById[action.id] = action;
      (action.tags || []).forEach(function indexTag(tag) {
        addIndexedItem(index.actionsByTag, tag, action);
      });
      readActionContexts(action).forEach(function indexContext(context) {
        addIndexedItem(index.actionsByContext, context, action);
      });
    });
    return index;
  }

  function getActionRulesStamp(rules) {
    var activeRules = rules || getDuelActionRules();
    return [
      activeRules?.version || "",
      Array.isArray(activeRules?.templates) ? activeRules.templates.length : 0
    ].join("|");
  }

  function getDuelActionTemplateIndex() {
    var rules = getDuelActionRules();
    var stamp = getActionRulesStamp(rules);
    if (!actionTemplateIndexCache || actionTemplateIndexCache.stamp !== stamp) {
      actionTemplateIndexCache = buildDuelActionTemplateIndexes(rules);
      actionTemplateIndexCache.stamp = stamp;
    }
    return actionTemplateIndexCache;
  }

  function warmDuelActionTemplateCache() {
    return getDuelActionTemplateIndex();
  }

  function invalidateDuelActionTemplateCache() {
    actionTemplateIndexCache = null;
    performanceCacheStats.actionLastInvalidatedAt = new Date().toISOString();
  }

  function collectStatusEffectIds(effectPatch) {
    var statuses = []
      .concat(effectPatch?.selfStatus ? [effectPatch.selfStatus] : [])
      .concat(effectPatch?.opponentStatus ? [effectPatch.opponentStatus] : [])
      .concat(effectPatch?.selfStatuses || [])
      .concat(effectPatch?.opponentStatuses || []);
    return statuses.map(function mapStatus(status) { return status?.id || ""; }).filter(Boolean);
  }

  function buildDuelMechanicTemplateIndexes(rules) {
    var activeRules = rules || getDuelMechanicTemplateRules();
    var mechanics = Array.isArray(activeRules?.mechanics) ? activeRules.mechanics : [];
    var index = {
      schema: "jjk-duel-mechanic-template-index",
      version: activeRules?.version || "",
      mechanicCount: mechanics.length,
      mechanics: mechanics,
      mechanicById: Object.create(null),
      mechanicsByTrigger: Object.create(null),
      mechanicsBySourceActionId: Object.create(null),
      mechanicsByStatusEffect: Object.create(null)
    };
    mechanics.forEach(function indexMechanic(mechanic) {
      if (!mechanic?.id) return;
      index.mechanicById[mechanic.id] = mechanic;
      addIndexedItem(index.mechanicsByTrigger, mechanic.trigger, mechanic);
      (mechanic.sourceActionIds || []).forEach(function indexSourceAction(sourceActionId) {
        addIndexedItem(index.mechanicsBySourceActionId, sourceActionId, mechanic);
      });
      collectStatusEffectIds(mechanic.effectPatch || {}).forEach(function indexStatus(statusId) {
        addIndexedItem(index.mechanicsByStatusEffect, statusId, mechanic);
      });
    });
    return index;
  }

  function getMechanicRulesStamp(rules) {
    var activeRules = rules || getDuelMechanicTemplateRules();
    return [
      activeRules?.version || "",
      Array.isArray(activeRules?.mechanics) ? activeRules.mechanics.length : 0
    ].join("|");
  }

  function getDuelMechanicTemplateIndex() {
    var rules = getDuelMechanicTemplateRules();
    var stamp = getMechanicRulesStamp(rules);
    if (!mechanicTemplateIndexCache || mechanicTemplateIndexCache.stamp !== stamp) {
      mechanicTemplateIndexCache = buildDuelMechanicTemplateIndexes(rules);
      mechanicTemplateIndexCache.stamp = stamp;
    }
    return mechanicTemplateIndexCache;
  }

  function warmDuelMechanicTemplateCache() {
    return getDuelMechanicTemplateIndex();
  }

  function invalidateDuelMechanicTemplateCache() {
    mechanicTemplateIndexCache = null;
    performanceCacheStats.mechanicLastInvalidatedAt = new Date().toISOString();
  }

  function getDuelMechanicTemplateById(mechanicId) {
    return getDuelMechanicTemplateIndex().mechanicById[mechanicId] || null;
  }

  function collectDuelMechanicsForAction(action) {
    if (!action?.id) return [];
    var index = getDuelMechanicTemplateIndex();
    var collected = [];
    var seen = new Set();
    function pushMechanic(mechanic) {
      if (!mechanic?.id || seen.has(mechanic.id)) return;
      seen.add(mechanic.id);
      collected.push(mechanic);
    }
    (action.mechanicIds || []).forEach(function addExplicit(id) {
      pushMechanic(index.mechanicById[id]);
    });
    (index.mechanicsBySourceActionId[action.id] || []).forEach(pushMechanic);
    return collected;
  }

  function addEffectMap(target, source) {
    Object.entries(source || {}).forEach(function addEntry(entry) {
      var key = entry[0];
      var value = entry[1];
      target[key] = Number((Number(target[key] || 0) + Number(value || 0)).toFixed(3));
    });
  }

  function pushStatusEffects(target, value) {
    if (!value) return;
    [].concat(value || []).forEach(function pushStatus(status) {
      if (status?.id) target.push({ ...status });
    });
  }

  function mergeDuelMechanicEffects(baseEffects, mechanics) {
    var effects = { ...(baseEffects || {}) };
    var scaleKeys = [
      "outgoingScale",
      "incomingHpScale",
      "incomingCeScale",
      "sureHitScale",
      "domainPressureScale",
      "manualAttackScale",
      "domainLoadScale"
    ];
    var additiveKeys = [
      "stabilityDelta",
      "domainLoadDelta",
      "opponentDomainLoadDelta",
      "opponentStabilityDelta",
      "opponentRegenInterference",
      "lowStabilityHpRecoil"
    ];
    effects.weightDeltas = { ...(effects.weightDeltas || {}) };
    effects.opponentWeightDeltas = { ...(effects.opponentWeightDeltas || {}) };
    effects.selfStatuses = [].concat(effects.selfStatus ? [effects.selfStatus] : [], effects.selfStatuses || []);
    effects.opponentStatuses = [].concat(effects.opponentStatus ? [effects.opponentStatus] : [], effects.opponentStatuses || []);
    mechanics.forEach(function mergeMechanic(mechanic) {
      var patch = mechanic?.effectPatch || {};
      scaleKeys.forEach(function mergeScale(key) {
        if (patch[key] !== undefined) effects[key] = Number((Number(effects[key] || 1) * Number(patch[key] || 1)).toFixed(4));
      });
      additiveKeys.forEach(function mergeAdditive(key) {
        if (patch[key] !== undefined) effects[key] = Number((Number(effects[key] || 0) + Number(patch[key] || 0)).toFixed(4));
      });
      if (patch.activateDomain) effects.activateDomain = true;
      if (patch.releaseDomain) effects.releaseDomain = true;
      addEffectMap(effects.weightDeltas, patch.weightDeltas);
      addEffectMap(effects.opponentWeightDeltas, patch.opponentWeightDeltas);
      pushStatusEffects(effects.selfStatuses, patch.selfStatus);
      pushStatusEffects(effects.selfStatuses, patch.selfStatuses);
      pushStatusEffects(effects.opponentStatuses, patch.opponentStatus);
      pushStatusEffects(effects.opponentStatuses, patch.opponentStatuses);
    });
    return effects;
  }

  function getDuelProfileForSide(battle, side) {
    var dependency = getOptionalDependency("getDuelProfileForSide");
    if (dependency && dependency !== getDuelProfileForSide) return dependency(battle, side);
    if (side === "left") return battle?.left || null;
    if (side === "right") return battle?.right || null;
    return null;
  }

  function getDuelActionCost(action, actor) {
    var dependency = getOptionalDependency("getDuelActionCost");
    if (dependency && dependency !== getDuelActionCost) return dependency(action, actor);
    var costPreview = global.JJKDuelCardTemplate?.calculateDuelCardCeCost;
    if (typeof costPreview === "function") {
      var preview = costPreview(action, actor || {});
      if (Number.isFinite(Number(preview?.finalCost))) return Number(preview.finalCost);
    }
    if (action?.costType === "zero_ce" || action?.zeroCeCostOverride) return 0;
    if (Number.isFinite(Number(action?.baseCeCost))) return Math.max(0, Number(action.baseCeCost));
    if (Number.isFinite(Number(action?.ceCost))) return Math.max(0, Number(action.ceCost));
    if (Number.isFinite(Number(action?.costCe))) return Math.max(0, Number(action.costCe));
    var cost = action?.cost || {};
    var ratioCost = Number(actor?.maxCe || 0) * Number(cost.ceRatio || 0);
    return Number(Math.max(Number(cost.flatCe || 0), Number(cost.minCe || 0), ratioCost).toFixed(1));
  }

  function getDuelDomainResponseProfile(profile, actor, opponent, battle) {
    return callDependency("getDuelDomainResponseProfile", [profile, actor, opponent, battle]);
  }

  function isDuelOpponentDomainThreat(opponent, actor, battle) {
    return callDependency("isDuelOpponentDomainThreat", [opponent, actor, battle]);
  }

  function hasDuelDomainCounterAccess(profile) {
    return callDependency("hasDuelDomainCounterAccess", [profile]);
  }

  function syncDuelTrialSubPhaseLifecycle(battle) {
    return callDependency("syncDuelTrialSubPhaseLifecycle", [battle]);
  }

  function updateDuelDomainTrialContext(battle, patch) {
    return callDependency("updateDuelDomainTrialContext", [battle, patch]);
  }

  function getDuelResourcePair(battle, side) {
    return callDependency("getDuelResourcePair", [battle, side]);
  }

  function clampDuelResource(resource) {
    return callDependency("clampDuelResource", [resource]);
  }

  function getDuelStatusEffectValue(resource, id) {
    var dependency = getOptionalDependency("getDuelStatusEffectValue");
    if (dependency) return dependency(resource, id);
    if (!resource?.statusEffects?.length) return 0;
    return Math.max(0, ...resource.statusEffects
      .filter(function filterEffect(effect) {
        return effect.id === id;
      })
      .map(function mapEffect(effect) {
        return Number(effect.value || 1);
      }));
  }

  function recordDuelResourceChange(battle, entry) {
    return callDependency("recordDuelResourceChange", [battle, entry]);
  }

  function getDuelResourceSideLabel(side) {
    var dependency = getOptionalDependency("getDuelResourceSideLabel");
    return dependency ? dependency(side) : (side === "left" ? "我方" : side === "right" ? "对方" : "战场");
  }

  function formatSignedDuelDelta(value) {
    var dependency = getOptionalDependency("formatSignedDuelDelta");
    if (dependency) return dependency(value);
    var number = Number(value || 0);
    return number >= 0 ? "+" + number : String(number);
  }

  function clamp(value, min, max) {
    var dependency = getOptionalDependency("clamp");
    if (dependency && dependency !== clamp) return dependency(value, min, max);
    return Math.max(min, Math.min(max, value));
  }

  function hashDuelSeed(value) {
    var dependency = getOptionalDependency("hashDuelSeed");
    if (dependency && dependency !== hashDuelSeed) return dependency(value);
    var hash = 2166136261;
    var text = String(value || "duel-seed");
    for (var index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function normalizeActionIdSet(value) {
    if (value instanceof Set) return value;
    if (Array.isArray(value)) return new Set(value);
    if (value && typeof value.has === "function") return value;
    return domainResponseActionIds;
  }

  function getDomainResponseActionIds() {
    return normalizeActionIdSet(getOptionalDependency("DUEL_DOMAIN_RESPONSE_ACTION_IDS"));
  }

  function buildDuelDomainSpecificActions(actor, opponent, duelState) {
    var battle = getBattle(duelState);
    if (!battle?.resourceState || !actor || !opponent) return [];
    var states = battle.domainProfileStates || {};
    var actions = [];
    var subPhase = syncDuelTrialSubPhaseLifecycle(battle) || battle.domainSubPhase;
    if (subPhase?.type === "trial" && !subPhase.verdictResolved) {
      var trialStateEntry = states[subPhase.owner];
      var trialProfile = trialStateEntry?.profile;
      var templates = actor.side === subPhase.owner
        ? callDependency("getDuelTrialOwnerActionTemplates", [trialProfile, subPhase])
        : callDependency("getDuelTrialDefenderActionTemplates", [trialProfile, subPhase]);
      actions.push(...templates.map(function normalizeTemplate(template) {
        return normalizeDuelDomainSpecificAction(template, trialProfile, actor, opponent, trialStateEntry, battle);
      }));
    }
    if (subPhase?.type === "jackpot" && !subPhase.jackpotResolved && actor.side === subPhase.owner) {
      var jackpotStateEntry = states[subPhase.owner];
      var jackpotProfile = jackpotStateEntry?.profile;
      actions.push(...(jackpotProfile?.domainActions || []).map(function normalizeTemplate(template) {
        return normalizeDuelDomainSpecificAction(template, jackpotProfile, actor, opponent, jackpotStateEntry, battle);
      }));
    }
    Object.values(states).forEach(function addStateActions(stateEntry) {
      if (!stateEntry?.profile || stateEntry.domainId === subPhase?.domainId || stateEntry.ownerSide !== actor.side) return;
      if (!getDuelResourcePair(battle, actor.side)?.domain?.active) return;
      actions.push(...(stateEntry.profile.domainActions || []).map(function normalizeTemplate(template) {
        return normalizeDuelDomainSpecificAction(template, stateEntry.profile, actor, opponent, stateEntry, battle);
      }));
    });
    return actions;
  }

  function normalizeDuelDomainSpecificAction(template, profile, actor, opponent, stateEntry, duelState) {
    return callDependency("normalizeDuelDomainSpecificAction", [template, profile, actor, opponent, stateEntry, duelState]);
  }

  function invalidateDuelActionChoices(battle) {
    var activeBattle = getBattle(battle);
    if (!activeBattle) return;
    activeBattle.actionChoices = [];
    activeBattle.actionRound = 0;
  }

  function getDuelActionAvailability(action, actor, opponent, duelState) {
    var battle = getBattle(duelState);
    var side = actor?.side || "";
    var profile = getDuelProfileForSide(battle, side);
    var domainResponse = getDuelDomainResponseProfile(profile || {}, actor, opponent, battle);
    var requirements = action.requirements || {};
    var costCe = getDuelActionCost(action, actor);
    if (!actor || !opponent) return { available: false, reason: "资源状态缺失", costCe: costCe };
    if (actor.ce < costCe) return { available: false, reason: "咒力不足", costCe: costCe };
    if (requirements.domainActive === true && !actor.domain?.active) return { available: false, reason: "当前未展开领域", costCe: costCe };
    if (requirements.domainActive === false && actor.domain?.active) return { available: false, reason: "领域已展开", costCe: costCe };
    if (requirements.requiresDomainAccess && !domainResponse.canExpandDomain) return { available: false, reason: "当前角色不具备领域条件", costCe: costCe };
    if (requirements.opponentDomainActive && !isDuelOpponentDomainThreat(opponent, actor, battle)) return { available: false, reason: "对方未展开领域", costCe: costCe };
    if (requirements.requiresDomainClash && !domainResponse.allowedDomainResponseActions.includes("domain_clash")) return { available: false, reason: "缺少真正领域对抗条件", costCe: costCe };
    if (requirements.requiresSimpleDomain && !domainResponse.allowedDomainResponseActions.includes("simple_domain_guard")) return { available: false, reason: "缺少简易领域防线", costCe: costCe };
    if (requirements.requiresHollowWickerBasket && !domainResponse.allowedDomainResponseActions.includes("hollow_wicker_basket_guard")) return { available: false, reason: "缺少弥虚葛笼", costCe: costCe };
    if (requirements.requiresFallingBlossomEmotion && !domainResponse.allowedDomainResponseActions.includes("falling_blossom_emotion")) return { available: false, reason: "缺少落花之情", costCe: costCe };
    if (requirements.requiresZeroCeBypass && !domainResponse.allowedDomainResponseActions.includes("zero_ce_domain_bypass")) return { available: false, reason: "不具备零咒力必中规避", costCe: costCe };
    if (requirements.requiresNoDomainResponse && !domainResponse.allowedDomainResponseActions.includes("domain_survival_guard")) return { available: false, reason: "已有更合适的领域应对", costCe: costCe };
    if (requirements.requiresDomainCounter && !hasDuelDomainCounterAccess(profile || {})) return { available: false, reason: "缺少领域对抗手段", costCe: costCe };
    if (requirements.blocksOnTechniqueImbalance && (getDuelStatusEffectValue(actor, "techniqueImbalance") > 0 || getDuelStatusEffectValue(actor, "techniqueBurnout") > 0)) return { available: false, reason: "术式烧断中", costCe: costCe };
    var subPhase = battle?.domainSubPhase;
    if (subPhase?.type === "trial" && subPhase.violenceRestricted && !subPhase.verdictResolved && action.id === "forced_output") {
      return { available: false, reason: "审判规则限制暴力输出", costCe: costCe };
    }
    if (subPhase?.type === "trial" && actor?.side === subPhase.defender && !subPhase.verdictResolved) {
      if (["defend", "challenge_evidence", "deny_charge", "delay_trial"].includes(action.id) && subPhase.canDefend === false) {
        return { available: false, reason: "当前审判目标类型不能有效辩护", costCe: costCe };
      }
      if (action.id === "remain_silent" && subPhase.canRemainSilent === false) {
        return { available: false, reason: "当前审判目标类型不能主张沉默", costCe: costCe };
      }
    }
    if (action.id === "request_verdict" && subPhase?.type === "trial" && !subPhase.verdictResolved) {
      var selfIncriminationScale = subPhase.hasSelfAwareness === false ? 0.12 : 0.25;
      var targetPressureScale = {
        full: 1,
        partial: 0.92,
        exorcism_ruling: 0.88,
        redirect_to_controller: 0.82,
        object_confiscation: 0.78
      }[subPhase.trialEligibility] ?? 0.9;
      var adjustedPressure = (
        Number(subPhase.evidencePressure || 0) -
        Number(subPhase.defensePressure || 0) * 0.35 +
        Number(subPhase.heavyVerdictRisk || 0) * 0.45 -
        Number(subPhase.selfIncriminationRisk || 0) * selfIncriminationScale
      ) * targetPressureScale;
      if (!subPhase.verdictReady && adjustedPressure < 4.2) return { available: false, reason: "判决尚未成熟", costCe: costCe };
    }
    if (action.id === "claim_jackpot" && subPhase?.type === "jackpot" && !subPhase.jackpotResolved) {
      if (!subPhase.jackpotReady && Number(subPhase.jackpotGauge || 0) < 100) return { available: false, reason: "jackpot 期待度不足", costCe: costCe };
    }
    if ((getDuelStatusEffectValue(actor, "techniqueConfiscated") > 0 || getDuelStatusEffectValue(actor, "curseTechniqueBound") > 0 || getDuelStatusEffectValue(actor, "techniqueBurnout") > 0) &&
      ["technique_interference", "forced_output", "domain_expand", "domain_force_sustain"].includes(action.id)) {
      return { available: false, reason: "术式被没收或烧断中", costCe: costCe };
    }
    if ((getDuelStatusEffectValue(actor, "cursedToolConfiscated") > 0 || getDuelStatusEffectValue(actor, "toolFunctionLocked") > 0) &&
      ["forced_output", "ce_reinforcement"].includes(action.id)) {
      return { available: false, reason: "咒具没收/封锁候选生效", costCe: costCe };
    }
    return { available: true, reason: "", costCe: costCe };
  }

  function buildDuelActionPool(actor, opponent, duelState) {
    var battle = getBattle(duelState);
    var templates = [
      ...getDuelActionTemplateIndex().templates,
      ...buildCustomDuelSpecialActions(actor),
      ...buildDuelDomainSpecificActions(actor, opponent, battle)
    ];
    return templates.map(function mapTemplate(template) {
      if (template.domainSpecific && template.available !== undefined) return template;
      var availability = getDuelActionAvailability(template, actor, opponent, battle);
      return {
        ...template,
        costCe: availability.costCe,
        available: availability.available,
        unavailableReason: availability.reason,
        riskLabel: getDuelActionRiskLabel(template, actor, opponent)
      };
    });
  }

  function buildCustomDuelSpecialActions(actor) {
    var appState = getOptionalDependency("state");
    var actorId = actor?.profileId || actor?.characterId || actor?.id || "";
    if (!actorId || !Array.isArray(appState?.customDuelCards)) return [];
    var card = appState.customDuelCards.find(function findCustomCard(item) {
      return item?.characterId === actorId || item?.id === actorId;
    });
    if (!card || !Array.isArray(card.customHandCards)) return [];
    return card.customHandCards.map(function mapCustomHand(action) {
      return {
        ...action,
        customDuelCard: true,
        available: true
      };
    });
  }

  function scoreDuelActionCandidate(action, actor, opponent, duelState) {
    var battle = getBattle(duelState);
    var profile = getDuelProfileForSide(battle, actor?.side || "");
    var domainResponse = getDuelDomainResponseProfile(profile || {}, actor, opponent, battle);
    var stable = Number(actor?.stability || 0);
    var ceRatio = actor?.maxCe ? Number(actor.ce || 0) / actor.maxCe : 0;
    var hpRatio = actor?.maxHp ? Number(actor.hp || 0) / actor.maxHp : 0;
    var domainRisk = actor?.domain?.threshold ? Number(actor.domain.load || 0) / actor.domain.threshold : 0;
    var seedContext = [
      battle?.battleSeed || battle?.seed || "",
      battle?.round || 0,
      actor?.side || "",
      actor?.characterId || actor?.id || actor?.name || "",
      opponent?.domain?.active ? "opponent-domain" : "no-opponent-domain",
      battle?.domainSubPhase?.type || "normal",
      action.id
    ].join("|");
    var seedJitter = (hashDuelSeed(seedContext) % 1000) / 1000;
    var score = 1 + seedJitter;
    if (!action.available) score -= 8;
    var subPhase = battle?.domainSubPhase;
    if (subPhase?.type === "trial" && !subPhase.verdictResolved) {
      if (action.domainSpecific) score += actor.side === subPhase.owner ? 4.2 : 3.9;
      if (action.id === "request_verdict") score += subPhase.verdictReady ? 5.5 : -3.5;
      if (subPhase.violenceRestricted && ["forced_output", "ce_reinforcement", "domain_expand", "domain_force_sustain", "technique_interference"].includes(action.id)) score -= 2.4;
      if (actor.side === subPhase.defender && ["defend", "challenge_evidence", "deny_charge", "delay_trial"].includes(action.id)) score += subPhase.canDefend === false ? -4 : 2.4;
      if (actor.side === subPhase.defender && action.id === "remain_silent") score += subPhase.canRemainSilent === false ? -4 : 2.4;
    }
    if (subPhase?.type === "jackpot" && !subPhase.jackpotResolved) {
      if (actor.side === subPhase.owner && action.domainSpecific) score += 4.2;
      if (action.id === "claim_jackpot") score += subPhase.jackpotReady ? 6 : -4;
      if (actor.side === subPhase.owner && ["risk_spin", "raise_probability", "advance_jackpot", "advance_jackpot_cycle"].includes(action.id)) score += 1.5;
    }
    if ((getDuelStatusEffectValue(actor, "techniqueConfiscated") > 0 || getDuelStatusEffectValue(actor, "curseTechniqueBound") > 0) && ["technique_interference", "forced_output", "domain_expand", "domain_force_sustain"].includes(action.id)) score -= 4.5;
    if ((getDuelStatusEffectValue(actor, "cursedToolConfiscated") > 0 || getDuelStatusEffectValue(actor, "toolFunctionLocked") > 0) && ["forced_output", "ce_reinforcement"].includes(action.id)) score -= 3.8;
    if (getDuelStatusEffectValue(actor, "summonSuppressed") > 0 && ["ce_reinforcement", "technique_interference", "domain_force_sustain"].includes(action.id)) score -= 2.2;
    if (getDuelStatusEffectValue(actor, "executionStateCandidate") > 0 && ["ce_reinforcement", "forced_output", "domain_clash"].includes(action.id)) score += 1.8;
    if (getDuelStatusEffectValue(actor, "jackpotStateCandidate") > 0 && ["ce_reinforcement", "defensive_frame", "ce_compression"].includes(action.id)) score += 1.6;
    if (ceRatio < 0.22) score += ["residue_reading", "defensive_frame", "ce_compression", "domain_release"].includes(action.id) ? 2.2 : -2;
    if (hpRatio < 0.38) score += action.id === "defensive_frame" ? 2.4 : 0;
    if (stable < 0.38) score += ["ce_compression", "defensive_frame", "residue_reading"].includes(action.id) ? 2.1 : -1.1;
    if (getDuelStatusEffectValue(actor, "techniqueImbalance") > 0) score += ["ce_compression", "defensive_frame", "residue_reading"].includes(action.id) ? 2 : -2.2;
    if (getDuelStatusEffectValue(actor, "ceRegenBlocked") > 0) score += action.costCe <= Math.max(8, actor.maxCe * 0.035) ? 1.3 : -1.5;
    if (actor.domain?.active) {
      score += ["domain_compress", "domain_force_sustain", "domain_release"].includes(action.id) ? 2.4 : 0;
      if (domainRisk > 0.72) score += ["domain_compress", "domain_release"].includes(action.id) ? 2.8 : (action.id === "domain_force_sustain" ? -2.4 : 0);
    } else if (action.id === "domain_expand" && ceRatio > 0.42 && stable > 0.45) {
      score += 2;
    }
    if (opponent?.domain?.active && domainResponse.allowedDomainResponseActions.includes(action.id)) score += 2.9;
    if (ceRatio > 0.55 && hpRatio > 0.45) score += ["ce_reinforcement", "technique_interference", "forced_output"].includes(action.id) ? 0.8 : 0;
    return score;
  }

  function pickDuelActionChoices(actor, opponent, duelState, count) {
    var battle = getBattle(duelState);
    var choiceCount = count === undefined ? 3 : count;
    var pool = buildDuelActionPool(actor, opponent, battle);
    var profile = getDuelProfileForSide(battle, actor?.side || "");
    var domainResponse = getDuelDomainResponseProfile(profile || {}, actor, opponent, battle);
    var selected = [];
    function pushById(id) {
      var item = pool.find(function findAction(action) {
        return action.id === id && !selected.some(function isChosen(chosen) {
          return chosen.id === id;
        });
      });
      if (item && item.available) selected.push(item);
    }
    getDuelSubPhasePreferredActionIds(actor, battle).forEach(pushById);
    if (actor?.domain?.active) {
      var risk = actor.domain.threshold ? actor.domain.load / actor.domain.threshold : 0;
      pushById(risk > 0.68 ? "domain_release" : "domain_compress");
      pushById("domain_force_sustain");
    } else {
      pushById("domain_expand");
    }
    if (isDuelOpponentDomainThreat(opponent, actor, battle)) {
      domainResponse.allowedDomainResponseActions.forEach(pushById);
    }
    var ranked = pool
      .filter(function filterSelected(action) {
        return !selected.some(function isSelected(chosen) {
          return chosen.id === action.id;
        });
      })
      .sort(function sortByScore(a, b) {
        return scoreDuelActionCandidate(b, actor, opponent, battle) - scoreDuelActionCandidate(a, actor, opponent, battle);
      });
    ranked.forEach(function addAvailable(action) {
      if (selected.length >= choiceCount) return;
      if (action.available) selected.push(action);
    });
    ranked.forEach(function addFallback(action) {
      if (selected.length >= choiceCount) return;
      selected.push(action);
    });
    return selected.slice(0, choiceCount);
  }

  function getDuelSubPhasePreferredActionIds(actor, battle) {
    var activeBattle = getBattle(battle);
    var subPhase = activeBattle?.domainSubPhase;
    if (!actor || !subPhase) return [];
    if (subPhase.type === "trial" && !subPhase.verdictResolved) {
      if (actor.side === subPhase.owner) {
        if (subPhase.trialEligibility === "object_confiscation") {
          return ["object_confiscation", "tool_function_lock", "wielder_liability", "request_verdict", "rule_pressure"];
        }
        if (subPhase.trialEligibility === "redirect_to_controller") {
          return ["controller_redirect", "summon_suppression", "request_verdict", "rule_pressure", "present_evidence"];
        }
        if (subPhase.trialEligibility === "exorcism_ruling") {
          return subPhase.verdictReady
            ? ["request_verdict", "present_evidence", "rule_pressure", "advance_trial"]
            : ["present_evidence", "rule_pressure", "advance_trial", "request_verdict"];
        }
        return subPhase.verdictReady
          ? ["request_verdict", "present_evidence", "rule_pressure", "press_charge", "advance_trial"]
          : ["present_evidence", "press_charge", "advance_trial", "rule_pressure", "request_verdict"];
      }
      if (actor.side === subPhase.defender) {
        if (subPhase.trialSubjectType === "intelligent_curse") return ["curse_argument", "distort_residue", "curse_pressure", "remain_silent"];
        if (subPhase.trialSubjectType === "instinct_curse") return ["instinctive_struggle", "curse_fluctuation", "flee_exorcism"];
        if (subPhase.trialSubjectType === "shikigami") return ["proxy_denial"];
        if (subPhase.canDefend === false && subPhase.canRemainSilent === false) return [];
        return ["defend", "challenge_evidence", "remain_silent", "deny_charge", "delay_trial"];
      }
    }
    if (subPhase.type === "jackpot" && !subPhase.jackpotResolved && actor.side === subPhase.owner) {
      return subPhase.jackpotReady
        ? ["claim_jackpot", "stabilize_cycle", "advance_jackpot", "raise_probability", "risk_spin", "advance_jackpot_cycle"]
        : ["advance_jackpot", "raise_probability", "stabilize_cycle", "risk_spin", "claim_jackpot", "advance_jackpot_cycle"];
    }
    return [];
  }

  function getDuelActionRiskLabel(action, actor, opponent) {
    var rules = getDuelActionRules();
    var base = rules.riskLabels?.[action.risk] || action.risk || "风险未知";
    if (!actor) return base;
    if (!action.available && action.unavailableReason) return action.unavailableReason;
    var domainRisk = actor.domain?.threshold ? Number(actor.domain.load || 0) / actor.domain.threshold : 0;
    if (action.id === "domain_force_sustain" && domainRisk > 0.72) return "极高风险，可能领域崩解";
    if (getDuelStatusEffectValue(actor, "ceRegenBlocked") > 0 && Number(action.costCe || 0) > actor.maxCe * 0.08) return "咒力回流断裂，慎用高消耗手法";
    if (getDuelStatusEffectValue(actor, "techniqueImbalance") > 0 && ["forced_output", "domain_expand", "technique_interference"].includes(action.id)) return "术式失衡中，风险上升";
    if (opponent?.domain?.active && action.id === "domain_clash") return "高负荷，对抗领域";
    if (opponent?.domain?.active && action.id === "simple_domain_guard") return "防必中，简易领域会磨损";
    if (opponent?.domain?.active && action.id === "hollow_wicker_basket_guard") return "防必中，行动受限";
    if (opponent?.domain?.active && action.id === "falling_blossom_emotion") return "自动迎击必中";
    if (opponent?.domain?.active && action.id === "zero_ce_domain_bypass") return "零咒力必中规避";
    if (opponent?.domain?.active && action.id === "domain_survival_guard") return "缺少硬防线，硬扛领域";
    return base;
  }

  function createEmptyDuelActionContext() {
    return {
      outgoingScale: 1,
      incomingHpScale: 1,
      incomingCeScale: 1,
      sureHitScale: 1,
      domainPressureScale: 1,
      manualAttackScale: 1,
      domainLoadScale: 1,
      weightDeltas: {},
      actionLabels: []
    };
  }

  function ensureDuelActionContext(battle) {
    if (!battle) return null;
    if (!battle.actionContext) {
      battle.actionContext = {
        left: createEmptyDuelActionContext(),
        right: createEmptyDuelActionContext()
      };
    }
    battle.actionContext.left ||= createEmptyDuelActionContext();
    battle.actionContext.right ||= createEmptyDuelActionContext();
    return battle.actionContext;
  }

  function getDuelActionContext(battle, side) {
    var context = battle?.actionContext?.[side];
    return context || createEmptyDuelActionContext();
  }

  function addDuelActionWeightDeltas(context, deltas) {
    Object.entries(deltas || {}).forEach(function addDelta(entry) {
      var key = entry[0];
      var value = entry[1];
      context.weightDeltas[key] = Number((Number(context.weightDeltas[key] || 0) + Number(value || 0)).toFixed(3));
    });
  }

  function isDomainActive(resource) {
    return Boolean(resource?.domain && resource.domain.active);
  }

  function isStrikeLikeAction(action) {
    var text = [
      action?.id,
      action?.label,
      [].concat(action?.tags || []).join(" "),
      action?.damageType,
      action?.scalingProfile
    ].join(" ").toLowerCase();
    return /strike|melee|physical|打击|体术|近身|拳|slash|斩|cursed_tool|咒具/.test(text);
  }

  function takeBlackFlashWindow(actor) {
    if (!Array.isArray(actor?.statusEffects)) return null;
    var ids = new Set(["impactWindowCandidate", "burstTimingWindowCandidate", "blackFlashWindow", "black_flash_window"]);
    var index = actor.statusEffects.findIndex(function findWindow(effect) {
      return ids.has(effect?.id);
    });
    if (index < 0) return null;
    var status = actor.statusEffects.splice(index, 1)[0];
    return status || null;
  }

  function calculateActionNumericPreview(action, actor) {
    var helper = global.JJKDuelCardTemplate?.calculateDuelCardFinalPreview;
    if (typeof helper !== "function") return null;
    try {
      return helper(action, actor || {});
    } catch (error) {
      return null;
    }
  }

  function applyDuelActionEffect(action, actor, opponent, duelState) {
    var battle = getBattle(duelState);
    if (!action || !actor || !opponent || !battle) return null;
    var side = actor.side;
    var opponentSide = opponent.side;
    var mechanicsApplied = collectDuelMechanicsForAction(action);
    var effects = mergeDuelMechanicEffects(action.effects || {}, mechanicsApplied);
    var contexts = ensureDuelActionContext(battle);
    var actorContext = contexts?.[side] || createEmptyDuelActionContext();
    var opponentContext = contexts?.[opponentSide] || createEmptyDuelActionContext();
    var before = {
      actorCe: actor.ce,
      actorHp: actor.hp,
      actorStability: actor.stability,
      actorDomainLoad: actor.domain?.load || 0,
      actorDomainActive: Boolean(actor.domain?.active),
      opponentCe: opponent.ce,
      opponentHp: opponent.hp,
      opponentStability: opponent.stability,
      opponentDomainLoad: opponent.domain?.load || 0
    };
    var numericPreview = calculateActionNumericPreview(action, actor);
    var blackFlashWindow = isStrikeLikeAction(action) ? takeBlackFlashWindow(actor) : null;
    var costCe = Math.min(actor.ce, Number(action.costCe ?? getDuelActionCost(action, actor)));
    actor.ce -= costCe;
    actor.stability = Number(clamp(Number(actor.stability || 0) + Number(effects.stabilityDelta || 0), 0, 1).toFixed(4));

    if (effects.activateDomain && actor.domain?.threshold > 0) {
      actor.domain.active = true;
      actor.domain.turnsActive = 0;
    }
    if (effects.releaseDomain && actor.domain) {
      actor.domain.active = false;
      if (battle.domainProfileStates?.[side]) delete battle.domainProfileStates[side];
      if (battle.domainSubPhase?.owner === side) {
        battle.domainSubPhase.verdictResolved = true;
        battle.domainSubPhase.endedByRelease = true;
        battle.domainSubPhase.trialEndReason = "domainManuallyEnded";
        battle.domainSubPhase.trialStatus = "resolved";
        updateDuelDomainTrialContext(battle, {
          trialStatus: "resolved",
          trialEndReason: "domainManuallyEnded"
        });
        invalidateDuelActionChoices(battle);
      }
    }
    if (actor.domain && isDomainActive(actor) && Number(effects.domainLoadDelta || 0)) {
      actor.domain.load += Number(effects.domainLoadDelta || 0);
    }
    if (opponent.domain && isDomainActive(opponent) && Number(effects.opponentDomainLoadDelta || 0)) {
      opponent.domain.load += Number(effects.opponentDomainLoadDelta || 0);
    }
    if (Number(effects.opponentStabilityDelta || 0)) {
      opponent.stability = Number(clamp(Number(opponent.stability || 0) + Number(effects.opponentStabilityDelta || 0), 0, 1).toFixed(4));
    }
    if (effects.opponentRegenInterference) {
      opponent.statusEffects.push({ id: "ceRegenInterference", label: "咒力回流受扰", rounds: 1, value: Number(effects.opponentRegenInterference) });
    }
    (effects.selfStatuses || []).forEach(function addSelfStatus(status) {
      if (status?.id) actor.statusEffects.push({ ...status });
    });
    (effects.opponentStatuses || []).forEach(function addOpponentStatus(status) {
      if (status?.id) opponent.statusEffects.push({ ...status });
    });
    if (Number(effects.lowStabilityHpRecoil || 0) && Number(actor.stability || 0) < 0.38) actor.hp -= Number(effects.lowStabilityHpRecoil);
    var directDamage = Math.max(0, Math.round(Number(numericPreview?.finalDamage || 0) * (action.risk === "high" || action.risk === "critical" ? 0.58 : 0.45)));
    var stabilityShock = Math.max(0, Number(numericPreview?.base?.baseStabilityDamage || 0) / 100);
    if (blackFlashWindow) {
      directDamage = Math.max(directDamage + 10, Math.round(Number(numericPreview?.finalDamage || 8) * 0.9));
      stabilityShock += 0.085;
      opponent.statusEffects.push({ id: "blackFlashShock", label: actor?.characterCardProfile?.isZeroCe ? "极限打击冲击" : "黑闪冲击", rounds: 1, value: 1 });
    }
    if (directDamage > 0) opponent.hp -= directDamage;
    if (stabilityShock > 0) {
      opponent.stability = Number(clamp(Number(opponent.stability || 0) - stabilityShock, 0, 1).toFixed(4));
    }

    actorContext.outgoingScale *= Number(effects.outgoingScale || 1);
    actorContext.incomingHpScale *= Number(effects.incomingHpScale || 1);
    actorContext.incomingCeScale *= Number(effects.incomingCeScale || 1);
    actorContext.sureHitScale *= Number(effects.sureHitScale || 1);
    actorContext.domainPressureScale *= Number(effects.domainPressureScale || 1);
    actorContext.manualAttackScale *= Number(effects.manualAttackScale || 1);
    actorContext.domainLoadScale *= Number(effects.domainLoadScale || 1);
    actorContext.actionLabels.push(action.label);
    addDuelActionWeightDeltas(actorContext, effects.weightDeltas);
    addDuelActionWeightDeltas(opponentContext, effects.opponentWeightDeltas);
    var domainSpecificResult = action.domainSpecific
      ? applyDuelDomainSpecificAction(action, actor, opponent, battle)
      : null;
    clampDuelResource(actor);
    clampDuelResource(opponent);

    var result = {
      costCe: costCe,
      actorCe: Number((actor.ce - before.actorCe).toFixed(1)),
      actorHp: Number((actor.hp - before.actorHp).toFixed(1)),
      actorStability: Number((actor.stability - before.actorStability).toFixed(4)),
      actorDomainLoad: Number(((actor.domain?.load || 0) - before.actorDomainLoad).toFixed(1)),
      opponentStability: Number((opponent.stability - before.opponentStability).toFixed(4)),
      opponentHp: Number((opponent.hp - before.opponentHp).toFixed(1)),
      opponentDomainLoad: Number(((opponent.domain?.load || 0) - before.opponentDomainLoad).toFixed(1)),
      domainActivated: !before.actorDomainActive && Boolean(actor.domain?.active),
      domainReleased: before.actorDomainActive && !actor.domain?.active,
      directDamage: directDamage,
      blackFlashTriggered: Boolean(blackFlashWindow),
      blackFlashLabel: blackFlashWindow ? (actor?.characterCardProfile?.isZeroCe ? "极限打击窗口" : "黑闪") : "",
      numericPreview: numericPreview,
      mechanicsApplied: mechanicsApplied.map(function mapMechanic(mechanic) {
        return {
          id: mechanic.id || "",
          label: mechanic.label || mechanic.id || "",
          logTemplate: mechanic.logTemplate || mechanic.effectSummary || ""
        };
      }),
      domainSpecific: domainSpecificResult || undefined
    };
    appendDuelActionLog(action, actor, opponent, result, battle);
    return result;
  }

  function applyDuelDomainSpecificAction(action, actor, opponent, duelState) {
    return callDependency("applyDuelDomainSpecificAction", [action, actor, opponent, duelState]);
  }

  function appendDuelActionLog(action, actor, opponent, result, duelState) {
    return callDependency("appendDuelActionLog", [action, actor, opponent, result, duelState]);
  }

  function getDuelCpuAction(actor, opponent, duelState) {
    var battle = getBattle(duelState);
    var pool = buildDuelActionPool(actor, opponent, battle).filter(function availableOnly(action) {
      return action.available;
    });
    if (!pool.length) return null;
    var profile = getDuelProfileForSide(battle, actor?.side || "");
    var domainResponse = getDuelDomainResponseProfile(profile || {}, actor, opponent, battle);
    var hpRatio = actor.maxHp ? actor.hp / actor.maxHp : 0;
    var ceRatio = actor.maxCe ? actor.ce / actor.maxCe : 0;
    var domainRisk = actor.domain?.threshold ? actor.domain.load / actor.domain.threshold : 0;
    var preferred = [];
    if (actor.domain?.active && domainRisk > 0.75) preferred.push("domain_release", "domain_compress");
    if (isDuelOpponentDomainThreat(opponent, actor, battle)) preferred.push(...domainResponse.allowedDomainResponseActions, "defensive_frame");
    if (hpRatio < 0.36) preferred.push("defensive_frame", "ce_compression");
    if (ceRatio < 0.24) preferred.push("residue_reading", "ce_compression");
    if (actor.domain?.active && domainRisk < 0.45) preferred.push("domain_force_sustain");
    if (!actor.domain?.active && ceRatio > 0.5) preferred.push("domain_expand", "technique_interference", "ce_reinforcement");
    preferred.push("technique_interference", "ce_reinforcement", "defensive_frame", "residue_reading");
    return preferred.map(function findPreferred(id) {
      return pool.find(function findAction(action) {
        return action.id === id;
      });
    }).find(Boolean) ||
      pool.sort(function sortByScore(a, b) {
        return scoreDuelActionCandidate(b, actor, opponent, battle) - scoreDuelActionCandidate(a, actor, opponent, battle);
      })[0];
  }

  var implementations = {
    getDuelActionTemplates: getDuelActionTemplates,
    buildDuelActionPool: buildDuelActionPool,
    pickDuelActionChoices: pickDuelActionChoices,
    getDuelActionCost: getDuelActionCost,
    getDuelActionAvailability: getDuelActionAvailability,
    applyDuelActionEffect: applyDuelActionEffect,
    getDuelCpuAction: getDuelCpuAction,
    buildDuelDomainSpecificActions: buildDuelDomainSpecificActions,
    invalidateDuelActionChoices: invalidateDuelActionChoices,
    getDuelActionRiskLabel: getDuelActionRiskLabel,
    getDuelActionContext: getDuelActionContext,
    buildDuelActionTemplateIndexes: buildDuelActionTemplateIndexes,
    getDuelActionTemplateIndex: getDuelActionTemplateIndex,
    warmDuelActionTemplateCache: warmDuelActionTemplateCache,
    invalidateDuelActionTemplateCache: invalidateDuelActionTemplateCache,
    buildDuelMechanicTemplateIndexes: buildDuelMechanicTemplateIndexes,
    getDuelMechanicTemplateIndex: getDuelMechanicTemplateIndex,
    warmDuelMechanicTemplateCache: warmDuelMechanicTemplateCache,
    invalidateDuelMechanicTemplateCache: invalidateDuelMechanicTemplateCache,
    getDuelMechanicTemplateById: getDuelMechanicTemplateById,
    collectDuelMechanicsForAction: collectDuelMechanicsForAction
  };

  var api = {
    metadata: Object.freeze({
      namespace: namespace,
      version: version,
      layer: "duel-actions",
      moduleFormat: "classic-script-iife",
      scriptType: "classic",
      behavior: "implementation",
      ownsBehavior: true
    }),
    expectedExports: Object.freeze(expectedExports.slice()),
    expectedDependencies: Object.freeze(expectedDependencyNames.slice()),
    bind: bind,
    register: register,
    hasBinding: hasBinding,
    get: get,
    getBinding: getBinding,
    listBindings: listBindings,
    clearBindings: clearBindings,
    bindDependency: bindDependency,
    configure: configure,
    registerDependencies: registerDependencies,
    hasDependency: hasDependency,
    listDependencies: listDependencies,
    clearDependencies: clearDependencies,
    getDuelActionTemplates: getDuelActionTemplates,
    buildDuelActionPool: buildDuelActionPool,
    pickDuelActionChoices: pickDuelActionChoices,
    getDuelActionCost: getDuelActionCost,
    getDuelActionAvailability: getDuelActionAvailability,
    applyDuelActionEffect: applyDuelActionEffect,
    getDuelCpuAction: getDuelCpuAction,
    buildDuelDomainSpecificActions: buildDuelDomainSpecificActions,
    invalidateDuelActionChoices: invalidateDuelActionChoices,
    buildDuelActionTemplateIndexes: buildDuelActionTemplateIndexes,
    getDuelActionTemplateIndex: getDuelActionTemplateIndex,
    warmDuelActionTemplateCache: warmDuelActionTemplateCache,
    invalidateDuelActionTemplateCache: invalidateDuelActionTemplateCache,
    buildDuelMechanicTemplateIndexes: buildDuelMechanicTemplateIndexes,
    getDuelMechanicTemplateIndex: getDuelMechanicTemplateIndex,
    warmDuelMechanicTemplateCache: warmDuelMechanicTemplateCache,
    invalidateDuelMechanicTemplateCache: invalidateDuelMechanicTemplateCache,
    getDuelMechanicTemplateById: getDuelMechanicTemplateById,
    collectDuelMechanicsForAction: collectDuelMechanicsForAction,
    getDuelActionCacheStats: function getDuelActionCacheStats() {
      return {
        actionIndexReady: Boolean(actionTemplateIndexCache),
        mechanicIndexReady: Boolean(mechanicTemplateIndexCache),
        actionLastInvalidatedAt: performanceCacheStats.actionLastInvalidatedAt,
        mechanicLastInvalidatedAt: performanceCacheStats.mechanicLastInvalidatedAt
      };
    }
  };

  global[namespace] = api;
})(globalThis);
