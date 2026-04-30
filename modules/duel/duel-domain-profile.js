(function attachDuelDomainProfile(global) {
  "use strict";

  var namespace = "JJKDuelDomainProfile";
  var version = "1.386G-domain-profile-extraction";
  var expectedExports = [
    "getDuelDomainProfiles",
    "normalizeDuelDomainBarrierProfile",
    "inferDuelDomainBarrierType",
    "inferDuelDomainCompletion",
    "getDuelDomainBarrierModifiers",
    "getDuelDomainBarrierSummary",
    "getDuelDomainProfileForCharacter",
    "applyDuelDomainProfileOnActivation",
    "resolveDuelDomainProfileActivations"
  ];
  var expectedDependencies = [
    "state",
    "getDuelDomainProfilesData",
    "getDuelBattle",
    "getCurrentDuelBattle",
    "isDuelDomainActivationAction",
    "getDuelDomainProfileResponseImpact",
    "buildDuelDomainTrialContext",
    "createDuelTrialSubPhase",
    "createDuelJackpotSubPhase",
    "appendDuelDomainProfileLog",
    "recordDuelResourceChange",
    "clampDuelResource",
    "clamp"
  ];
  var dependencyModules = {
    isDuelDomainActivationAction: { namespace: "JJKDuelDomainResponse", exportName: "isDuelDomainActivationAction" },
    getDuelDomainProfileResponseImpact: { namespace: "JJKDuelDomainResponse", exportName: "getDuelDomainProfileResponseImpact" },
    buildDuelDomainTrialContext: { namespace: "JJKDuelRuleSubphase", exportName: "buildDuelDomainTrialContext" },
    createDuelTrialSubPhase: { namespace: "JJKDuelRuleSubphase", exportName: "createDuelTrialSubPhase" },
    createDuelJackpotSubPhase: { namespace: "JJKDuelRuleSubphase", exportName: "createDuelJackpotSubPhase" },
    recordDuelResourceChange: { namespace: "JJKDuelResource", exportName: "recordDuelResourceChange" },
    clampDuelResource: { namespace: "JJKDuelResource", exportName: "clampDuelResource" }
  };
  var bindings = Object.create(null);
  var dependencies = Object.create(null);

  var defaultDomainProfiles = {
    schema: "jjk-duel-domain-profiles",
    version: "0.1.0-candidate",
    status: "CANDIDATE",
    profiles: []
  };

  var DUEL_DOMAIN_CLASS_LABELS = {
    rule_trial: "规则 / 审判",
    sure_hit_damage: "必中伤害",
    auto_attack: "自动攻击",
    control: "强控",
    environment_pressure: "环境压制",
    jackpot_rule: "规则 / 赌博",
    hybrid: "混合领域"
  };
  var DUEL_DOMAIN_BARRIER_LABELS = {
    closed_barrier: "封闭领域",
    open_barrier: "开放领域",
    incomplete_barrier: "未完成领域",
    rule_barrier: "规则型领域",
    hybrid_barrier: "混合领域",
    pseudo_domain: "类领域",
    unknown: "未知形态"
  };
  var DUEL_DOMAIN_COMPLETION_LABELS = {
    complete: "完成",
    incomplete: "未完成",
    unstable: "不稳定",
    conditional: "条件型",
    unknown: "未知"
  };
  var DUEL_DOMAIN_SWITCH_LABELS = {
    fixed: "固定",
    can_shift: "可切换",
    forced_by_context: "受环境影响",
    none: "不可切换",
    unknown: "未知"
  };

  function hasOwn(source, key) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }

  function isExpectedExport(name) {
    return expectedExports.indexOf(name) !== -1;
  }

  function isExpectedDependency(name) {
    return expectedDependencies.indexOf(name) !== -1;
  }

  function assertExpectedExport(name) {
    if (!isExpectedExport(name)) {
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
    assertExpectedExport(name);
    assertFunction(name, value);
    bindings[name] = value;
    return api;
  }

  function bindDependency(name, value) {
    assertExpectedDependency(name);
    if (name === "state") {
      dependencies[name] = value;
      return api;
    }
    assertFunction(name, value);
    dependencies[name] = value;
    return api;
  }

  function register(map) {
    return registerDependencies(map);
  }

  function registerDependencies(map) {
    if (!map || typeof map !== "object") return api;
    Object.keys(map).forEach(function bindEntry(name) {
      if (isExpectedDependency(name) && map[name] != null) {
        bindDependency(name, map[name]);
      }
    });
    return api;
  }

  function configure(map) {
    return registerDependencies(map);
  }

  function get(name) {
    assertExpectedExport(name);
    return bindings[name] || ownedExports[name];
  }

  function getBinding(name) {
    return get(name);
  }

  function hasExpectedValue(name) {
    return typeof get(name) === "function";
  }

  function hasBinding(name) {
    if (typeof name === "undefined") {
      return expectedExports.every(function hasExport(exportName) {
        return hasExpectedValue(exportName);
      });
    }
    return isExpectedExport(name) && hasExpectedValue(name);
  }

  function listBindings() {
    return expectedExports.reduce(function buildSnapshot(snapshot, name) {
      snapshot[name] = hasExpectedValue(name);
      return snapshot;
    }, {});
  }

  function clearBindings() {
    expectedExports.forEach(function clearName(name) {
      delete bindings[name];
    });
    return api;
  }

  function getNamespaceBinding(namespaceName, exportName) {
    var target = global[namespaceName];
    var value;

    if (!target) return undefined;
    try {
      if (typeof target.getBinding === "function") {
        value = target.getBinding(exportName);
        if (value != null) return value;
      }
      if (typeof target.get === "function") {
        value = target.get(exportName);
        if (value != null) return value;
      }
    } catch (error) {
      value = undefined;
    }
    if (hasOwn(target, exportName)) return target[exportName];
    return undefined;
  }

  function resolveModuleDependency(name) {
    var moduleInfo = dependencyModules[name];
    if (!moduleInfo) return undefined;
    return getNamespaceBinding(moduleInfo.namespace, moduleInfo.exportName);
  }

  function getOptionalDependency(name) {
    assertExpectedDependency(name);
    return hasOwn(dependencies, name) ? dependencies[name] : resolveModuleDependency(name);
  }

  function getDependency(name) {
    return getOptionalDependency(name);
  }

  function requireDependency(name) {
    var dependency = getOptionalDependency(name);
    if (typeof dependency !== "function") {
      throw new Error(namespace + ": dependency '" + name + "' must be registered before this behavior can run.");
    }
    return dependency;
  }

  function hasDependency(name) {
    if (typeof name === "undefined") {
      return expectedDependencies.every(function hasExpectedDependency(dependencyName) {
        return Boolean(getOptionalDependency(dependencyName));
      });
    }
    return isExpectedDependency(name) && Boolean(getOptionalDependency(name));
  }

  function listDependencies() {
    return expectedDependencies.reduce(function buildSnapshot(snapshot, name) {
      snapshot[name] = Boolean(getOptionalDependency(name));
      return snapshot;
    }, {});
  }

  function missingDependencies() {
    return expectedDependencies.filter(function isMissing(name) {
      return !getOptionalDependency(name);
    });
  }

  function clearDependencies() {
    expectedDependencies.forEach(function clearName(name) {
      delete dependencies[name];
    });
    return api;
  }

  function getState() {
    return dependencies.state || null;
  }

  function getCurrentBattle(fallback) {
    var getter;
    var state;

    if (fallback) return fallback;
    getter = getOptionalDependency("getCurrentDuelBattle") || getOptionalDependency("getDuelBattle");
    if (typeof getter === "function") return getter();
    state = getState();
    return state ? state.duelBattle : null;
  }

  function getDuelDomainProfilesData() {
    var getter = getOptionalDependency("getDuelDomainProfilesData");
    var state;
    var data;

    if (typeof getter === "function") {
      data = getter();
      if (data) return data;
    }
    state = getState();
    return state?.duelDomainProfiles || defaultDomainProfiles;
  }

  function clampValue(value, min, max) {
    var dependency = getOptionalDependency("clamp");
    if (typeof dependency === "function") return dependency(value, min, max);
    return Math.min(max, Math.max(min, value));
  }

  function getDuelProfileForSide(battle, side) {
    if (side === "left") return battle?.left || null;
    if (side === "right") return battle?.right || null;
    return null;
  }

  function addOrRefreshDuelStatusEffect(resource, effect) {
    var normalized;
    var existing;

    if (!resource || !effect?.id) return;
    normalized = {
      ...effect,
      rounds: Math.max(1, Number(effect.rounds || 1)),
      value: Number(effect.value ?? 1)
    };
    existing = resource.statusEffects?.find(function findStatus(item) {
      return item.id === normalized.id;
    });
    if (existing) {
      existing.rounds = Math.max(Number(existing.rounds || 0), normalized.rounds);
      existing.value = Math.max(Number(existing.value || 0), normalized.value);
      existing.label = normalized.label || existing.label;
      return;
    }
    resource.statusEffects ||= [];
    resource.statusEffects.push(normalized);
  }

  function appendDuelDomainProfileLog(battle, entry) {
    var appendLog = getOptionalDependency("appendDuelDomainProfileLog");
    var recordChange;

    if (!battle) return;
    if (typeof appendLog === "function" && appendLog !== appendDuelDomainProfileLog) {
      appendLog(battle, entry || {});
      return;
    }
    recordChange = getOptionalDependency("recordDuelResourceChange");
    if (typeof recordChange !== "function") {
      throw new Error(namespace + ": dependency 'recordDuelResourceChange' or 'appendDuelDomainProfileLog' must be registered before logging domain profile activation.");
    }
    entry = entry || {};
    recordChange(battle, {
      side: entry.side || "neutral",
      title: entry.title || "领域资料层",
      detail: entry.detail || "",
      type: entry.type || entry.category || "domain",
      delta: {
        domainProfile: true,
        status: "CANDIDATE",
        ...(entry.delta || {})
      }
    });
  }

  function getDuelDomainProfiles() {
    var data = getDuelDomainProfilesData();
    return {
      ...data,
      profiles: (data.profiles || []).map(function normalizeProfile(profile) {
        return normalizeDuelDomainBarrierProfile(profile);
      })
    };
  }

  function normalizeDuelDomainBarrierProfile(domainProfile) {
    var profile = domainProfile || {};
    var barrierTypeMap = {
      closed: "closed_barrier",
      open: "open_barrier",
      incomplete: "incomplete_barrier",
      rule: "rule_barrier",
      hybrid: "hybrid_barrier",
      pseudo: "pseudo_domain"
    };
    var validBarrierTypes = new Set(["closed_barrier", "open_barrier", "incomplete_barrier", "rule_barrier", "hybrid_barrier", "pseudo_domain", "unknown"]);
    var validCompletion = new Set(["complete", "incomplete", "unstable", "conditional", "unknown"]);
    var validSwitchability = new Set(["fixed", "can_shift", "forced_by_context", "none", "unknown"]);
    var inferredBarrierType = inferDuelDomainBarrierType(profile);
    var barrierType = validBarrierTypes.has(profile.barrierType)
      ? profile.barrierType
      : (barrierTypeMap[profile.barrierType] || inferredBarrierType);
    var domainCompletion = validCompletion.has(profile.domainCompletion)
      ? profile.domainCompletion
      : inferDuelDomainCompletion(profile, barrierType);
    var domainSwitchability = validSwitchability.has(profile.domainSwitchability)
      ? profile.domainSwitchability
      : "unknown";
    return {
      ...profile,
      barrierType: barrierType,
      domainCompletion: domainCompletion,
      domainSwitchability: domainSwitchability,
      barrierBehavior: normalizeDuelBarrierBehavior(profile.barrierBehavior, barrierType, domainCompletion)
    };
  }

  function inferDuelDomainBarrierType(domainProfile) {
    var profile = domainProfile || {};
    var text = [
      profile.domainClass,
      profile.barrierType,
      profile.domainName,
      ...(profile.effectTags || [])
    ].filter(Boolean).join(" ");
    if (/open_barrier|open_domain|开放|伏魔御厨子/.test(text)) return "open_barrier";
    if (/incomplete_barrier|incomplete_domain|未完成|不完全|嵌合暗翳庭/.test(text)) return "incomplete_barrier";
    if (/rule_barrier|rule_trial|jackpot_rule|审判|规则|坐杀搏徒|诛伏赐死/.test(text)) return "rule_barrier";
    if (/hybrid_barrier|hybrid/.test(text)) return "hybrid_barrier";
    if (/pseudo_domain|类领域/.test(text)) return "pseudo_domain";
    if (/closed_barrier|closed|封闭|无量空处|自闭圆顿裹|荡蕴平线/.test(text)) return "closed_barrier";
    return "unknown";
  }

  function inferDuelDomainCompletion(domainProfile, barrierType) {
    var profile = domainProfile || {};
    var resolvedBarrierType = barrierType || "unknown";
    var text = [
      profile.domainCompletion,
      profile.domainClass,
      profile.domainName,
      ...(profile.effectTags || [])
    ].filter(Boolean).join(" ");
    if (/incomplete|未完成|不完全|嵌合暗翳庭/.test(text) || resolvedBarrierType === "incomplete_barrier") return "incomplete";
    if (/unstable|不稳定/.test(text)) return "unstable";
    if (/conditional|jackpot|rule_trial|规则|审判|坐杀搏徒|诛伏赐死/.test(text) || resolvedBarrierType === "rule_barrier") return "conditional";
    if (resolvedBarrierType === "unknown" || resolvedBarrierType === "pseudo_domain") return "unknown";
    return "complete";
  }

  function normalizeDuelBarrierBehavior(behavior, barrierType, domainCompletion) {
    var source = behavior || {};
    var defaults = getDefaultDuelBarrierBehavior(barrierType, domainCompletion);
    return {
      escapeDifficulty: source.escapeDifficulty || defaults.escapeDifficulty,
      externalBreakRisk: source.externalBreakRisk || defaults.externalBreakRisk,
      sureHitStability: source.sureHitStability || defaults.sureHitStability,
      domainLoadModifier: Number(source.domainLoadModifier ?? defaults.domainLoadModifier),
      counterplayModifier: {
        ...defaults.counterplayModifier,
        ...(source.counterplayModifier || {})
      }
    };
  }

  function getDefaultDuelBarrierBehavior(barrierType, domainCompletion) {
    var resolvedBarrierType = barrierType || "unknown";
    var resolvedCompletion = domainCompletion || "unknown";
    var base = {
      escapeDifficulty: "medium",
      externalBreakRisk: "medium",
      sureHitStability: "medium",
      domainLoadModifier: 1,
      counterplayModifier: {
        domainClash: 1,
        simpleDomain: 1,
        hollowWickerBasket: 1,
        zeroCeBypass: 1,
        physicalBreak: 1
      }
    };
    if (resolvedBarrierType === "open_barrier") {
      return {
        escapeDifficulty: "medium",
        externalBreakRisk: "low",
        sureHitStability: "high",
        domainLoadModifier: 1.15,
        counterplayModifier: { domainClash: 0.9, simpleDomain: 0.82, hollowWickerBasket: 0.82, zeroCeBypass: 0.78, physicalBreak: 0.25 }
      };
    }
    if (resolvedBarrierType === "incomplete_barrier" || resolvedCompletion === "incomplete") {
      return {
        escapeDifficulty: "medium",
        externalBreakRisk: "high",
        sureHitStability: "low",
        domainLoadModifier: 1.25,
        counterplayModifier: { domainClash: 1.2, simpleDomain: 1.1, hollowWickerBasket: 1, zeroCeBypass: 0.95, physicalBreak: 1.3 }
      };
    }
    if (resolvedBarrierType === "rule_barrier") {
      return {
        escapeDifficulty: "high",
        externalBreakRisk: "medium",
        sureHitStability: "medium",
        domainLoadModifier: 0.92,
        counterplayModifier: { domainClash: 1, simpleDomain: 0.9, hollowWickerBasket: 0.9, zeroCeBypass: 0.75, physicalBreak: 0.75 }
      };
    }
    if (resolvedBarrierType === "closed_barrier") {
      return {
        escapeDifficulty: "high",
        externalBreakRisk: "medium",
        sureHitStability: "high",
        domainLoadModifier: 1,
        counterplayModifier: { domainClash: 1, simpleDomain: 0.95, hollowWickerBasket: 0.95, zeroCeBypass: 0.85, physicalBreak: 1 }
      };
    }
    return base;
  }

  function getDuelDomainBarrierModifiers(domainProfile, actor, opponent, duelState) {
    var profile = normalizeDuelDomainBarrierProfile(domainProfile || {});
    var behavior = profile.barrierBehavior || getDefaultDuelBarrierBehavior(profile.barrierType, profile.domainCompletion);
    var sureHitScales = { low: 0.42, medium: 0.82, high: 1, extreme: 1.12 };
    var sureHitScale = sureHitScales[behavior.sureHitStability] ?? 0.82;
    var pressureScale = 1;
    var manualAttackScale = 1;
    var domainLoadScale = Number(behavior.domainLoadModifier || 1);

    void actor;
    void opponent;
    void duelState;

    if (profile.barrierType === "open_barrier") {
      pressureScale *= 1.18;
      manualAttackScale *= 1.08;
    }
    if (profile.barrierType === "incomplete_barrier" || profile.domainCompletion === "incomplete") {
      sureHitScale *= 0.55;
      pressureScale *= 0.9;
      domainLoadScale *= 1.08;
    }
    if (profile.barrierType === "rule_barrier") {
      sureHitScale *= 0.25;
      pressureScale *= 0.55;
      manualAttackScale *= 0.65;
    }
    if (profile.domainCompletion === "unstable") domainLoadScale *= 1.12;
    return {
      barrierType: profile.barrierType,
      domainCompletion: profile.domainCompletion,
      domainSwitchability: profile.domainSwitchability,
      escapeDifficulty: behavior.escapeDifficulty,
      externalBreakRisk: behavior.externalBreakRisk,
      physicalBreakScale: Number(behavior.counterplayModifier?.physicalBreak ?? 1),
      counterplayScale: { ...(behavior.counterplayModifier || {}) },
      domainLoadScale: Number(domainLoadScale.toFixed(3)),
      sureHitScale: Number(sureHitScale.toFixed(3)),
      pressureScale: Number(pressureScale.toFixed(3)),
      manualAttackScale: Number(manualAttackScale.toFixed(3))
    };
  }

  function getDuelDomainBarrierSummary(profile) {
    var normalized = normalizeDuelDomainBarrierProfile(profile || {});
    var behavior = normalized.barrierBehavior || {};
    return {
      shape: DUEL_DOMAIN_BARRIER_LABELS[normalized.barrierType] || normalized.barrierType || "未知形态",
      completion: DUEL_DOMAIN_COMPLETION_LABELS[normalized.domainCompletion] || normalized.domainCompletion || "未知",
      switchability: DUEL_DOMAIN_SWITCH_LABELS[normalized.domainSwitchability] || normalized.domainSwitchability || "未知",
      risk: (behavior.escapeDifficulty || "medium") + " escape / " + (behavior.externalBreakRisk || "medium") + " break",
      hint: getDuelDomainBarrierRiskHint(normalized)
    };
  }

  function getDuelDomainBarrierRiskHint(profile) {
    var normalized = normalizeDuelDomainBarrierProfile(profile || {});
    if (normalized.barrierType === "open_barrier") {
      return "开放领域不能简单依靠破坏结界壳解除压制；反必中手段只能削弱必中组件。";
    }
    if (normalized.barrierType === "incomplete_barrier" || normalized.domainCompletion === "incomplete") {
      return "未完成领域的必中稳定度较低，但领域负荷更不稳定，也更容易被反制撬动。";
    }
    if (normalized.barrierType === "rule_barrier") {
      return "规则型领域重点不是直接伤害，而是规则子阶段是否成立。";
    }
    if (normalized.barrierType === "closed_barrier") {
      return "封闭领域可通过领域对抗、简易领域、弥虚葛笼等标准防线削弱。";
    }
    return "领域形态信息不足，按通用候选规则处理。";
  }

  function getDuelDomainProfileForCharacter(profile, card, duelState) {
    var profiles;
    var texts;

    void duelState;

    if (!profile || profile.customDuel) return null;
    profiles = getDuelDomainProfiles().profiles || [];
    texts = [
      profile.id,
      profile.name,
      profile.domainProfile,
      profile.techniqueText,
      card?.characterId,
      card?.displayName,
      card?.domainProfile,
      ...(profile.flags || []),
      ...(profile.innateTraits || []),
      ...(profile.advancedTechniques || [])
    ].filter(Boolean).join(" ");
    return profiles.find(function matchesProfile(item) {
      if (item.ownerId && (item.ownerId === profile.id || item.ownerId === card?.characterId)) return true;
      return [item.ownerName, item.domainName].filter(Boolean).every(function hasKeyword(keyword) {
        return texts.includes(keyword);
      });
    }) || null;
  }

  function resolveDuelDomainProfileActivations(battle, pairs) {
    var isActivationAction;

    if (!battle?.resourceState) return [];
    battle.domainProfileActivations ||= [];
    isActivationAction = requireDependency("isDuelDomainActivationAction");
    return (pairs || [])
      .map(function resolvePair(pair) {
        if (!pair?.action || !isActivationAction(pair.action) || !pair.actor?.domain?.active) return null;
        return applyDuelDomainProfileOnActivation(pair.actor, pair.opponent, battle, {
          action: pair.action,
          responseAction: pair.responseAction
        });
      })
      .filter(Boolean);
  }

  function applyDuelDomainProfileOnActivation(actor, opponent, duelState, context) {
    var battle = getCurrentBattle(duelState);
    var ownerProfile;
    var rawProfile;
    var profile;
    var activationKey;
    var barrierModifiers;
    var barrierSummary;
    var response;
    var responseScale;
    var resourceRules;
    var loadBase;
    var stabilityPressure;
    var stateEntry;
    var trialContext;
    var trialSubPhase;
    var clampResource;

    context = context || {};
    if (!battle?.resourceState || !actor || !opponent) return null;
    ownerProfile = getDuelProfileForSide(battle, actor.side);
    rawProfile = getDuelDomainProfileForCharacter(ownerProfile, null, battle);
    if (!rawProfile) return null;
    profile = normalizeDuelDomainBarrierProfile(rawProfile);
    activationKey = actor.side + ":" + (battle.round + 1) + ":" + profile.id;
    if (battle.domainProfileActivations?.includes(activationKey)) return null;
    battle.domainProfileActivations ||= [];
    battle.domainProfileActivations.push(activationKey);
    battle.domainProfileStates ||= {};
    barrierModifiers = getDuelDomainBarrierModifiers(profile, actor, opponent, battle);
    barrierSummary = getDuelDomainBarrierSummary(profile);
    response = requireDependency("getDuelDomainProfileResponseImpact")(context.responseAction, profile);
    responseScale = response.effective ? response.scale : 1;
    resourceRules = profile.resourceRules || {};
    loadBase = Number(resourceRules.domainLoadBase || 0) * responseScale * Number(barrierModifiers.domainLoadScale || 1);
    stabilityPressure = Number(resourceRules.stabilityPressure || 0) * responseScale * (profile.domainCompletion === "incomplete" ? 1.2 : 1);
    if (actor.domain) actor.domain.load += loadBase;
    actor.stability = Number(clampValue(Number(actor.stability || 0) - stabilityPressure, 0, 1).toFixed(4));

    stateEntry = {
      ownerSide: actor.side,
      domainId: profile.id,
      domainName: profile.domainName,
      ownerName: profile.ownerName,
      domainClass: profile.domainClass,
      barrierType: profile.barrierType || "unknown",
      domainCompletion: profile.domainCompletion || "unknown",
      domainSwitchability: profile.domainSwitchability || "unknown",
      barrierBehavior: profile.barrierBehavior || {},
      barrierModifiers: barrierModifiers,
      effectTags: profile.effectTags || [],
      profile: profile,
      weakened: Boolean(response.effective),
      responseActionId: response.actionId || "",
      responseLabel: response.label || "",
      responseDetail: response.detail || "",
      barrierHint: barrierSummary.hint || "",
      roundStarted: battle.round + 1,
      status: "CANDIDATE"
    };
    battle.domainProfileStates[actor.side] = stateEntry;
    battle.domainProfileState = stateEntry;
    trialContext = profile.domainClass === "rule_trial"
      ? requireDependency("buildDuelDomainTrialContext")(profile, actor, opponent, battle, response, {
        trialStatus: response.effective ? "weakened" : "pending"
      })
      : null;

    if (profile.domainClass === "rule_trial" && !response.effective) {
      requireDependency("createDuelTrialSubPhase")(profile, actor, opponent, battle);
    } else if (profile.domainClass === "rule_trial") {
      trialSubPhase = requireDependency("createDuelTrialSubPhase")(profile, actor, opponent, battle, {
        trialTargetProfile: trialContext?.trialTargetProfile,
        responseEffective: true,
        responseScale: responseScale,
        responseActionId: response.actionId || "",
        responseLabel: response.label || "",
        responseDetail: response.detail || "",
        trialStatus: "weakened"
      });
      addOrRefreshDuelStatusEffect(opponent, {
        id: "trialRulePressure",
        label: "审判规则压制",
        rounds: 1,
        value: 0.4
      });
      appendDuelDomainProfileLog(battle, {
        side: actor.side,
        title: "审判规则被削弱",
        type: "response",
        detail: trialSubPhase
          ? opponent.name + " 的" + (response.label || "领域应对") + "削弱了" + profile.domainName + "，但审判对象上下文仍保留：" + trialSubPhase.targetLabel + " / " + trialSubPhase.eligibilityLabel + "；" + response.detail
          : opponent.name + " 的" + (response.label || "领域应对") + "阻止了" + profile.domainName + "完整进入审判程序，规则压力只以削弱状态残留。"
      });
    } else if (profile.domainClass === "jackpot_rule" && !response.effective) {
      requireDependency("createDuelJackpotSubPhase")(profile, actor, opponent, battle);
    } else if (profile.domainClass === "jackpot_rule") {
      addOrRefreshDuelStatusEffect(actor, {
        id: "jackpotCycleCandidate",
        label: "坐杀搏徒循环候选",
        rounds: 1,
        value: 0.35
      });
      appendDuelDomainProfileLog(battle, {
        side: actor.side,
        title: "坐杀搏徒循环受阻",
        type: "subphase",
        detail: opponent.name + " 的" + (response.label || "领域应对") + "削弱了坐杀搏徒完整规则循环，jackpot 只保留低强度候选收益。"
      });
    }

    if (profile.effectTags?.includes("information_overload")) {
      addOrRefreshDuelStatusEffect(opponent, {
        id: "domainActionSuppression",
        label: "信息过载压制",
        rounds: 1,
        value: response.effective ? 0.45 : 1
      });
    }
    if (profile.effectTags?.includes("slash_auto_attack")) {
      addOrRefreshDuelStatusEffect(opponent, {
        id: "openSlashPressure",
        label: "开放斩击压力",
        rounds: 2,
        value: response.effective ? 0.55 : 1
      });
    }
    if (profile.effectTags?.includes("soul_touch")) {
      addOrRefreshDuelStatusEffect(opponent, {
        id: "soulTouchPressure",
        label: "灵魂接触压力",
        rounds: 1,
        value: response.effective ? 0.45 : 1
      });
    }
    if (profile.effectTags?.includes("shikigami_auto_attack")) {
      addOrRefreshDuelStatusEffect(opponent, {
        id: "shikigamiAutoAttack",
        label: "式神洪流压制",
        rounds: 2,
        value: response.effective ? 0.5 : 1
      });
    }
    if (profile.effectTags?.includes("jackpot_rule") || profile.effectTags?.includes("probability_loop")) {
      addOrRefreshDuelStatusEffect(actor, {
        id: "jackpotCycleCandidate",
        label: "坐杀搏徒循环候选",
        rounds: 2,
        value: response.effective ? 0.5 : 1
      });
    }
    if (profile.barrierType === "incomplete_barrier" || profile.domainCompletion === "incomplete") {
      addOrRefreshDuelStatusEffect(actor, {
        id: "incompleteDomainInstability",
        label: "未完成领域不稳",
        rounds: 2,
        value: 1
      });
    }

    clampResource = requireDependency("clampDuelResource");
    clampResource(actor);
    clampResource(opponent);
    appendDuelDomainProfileLog(battle, {
      side: actor.side,
      title: profile.domainName + "展开",
      type: "domain",
      detail: actor.name + " 展开" + profile.domainName + "，领域类型为" + (DUEL_DOMAIN_CLASS_LABELS[profile.domainClass] || profile.domainClass) + "，领域形态：" + barrierSummary.shape + "，完成度：" + barrierSummary.completion + "，反制风险：" + barrierSummary.risk + "。" + barrierSummary.hint + (response.effective ? opponent.name + " 以" + response.label + "削弱了专属领域完整展开；" + response.detail : "对方没有有效硬防线，专属领域效果完整进入战场。")
    });
    return stateEntry;
  }

  function useOwnedImplementations() {
    expectedExports.forEach(function bindOwned(name) {
      bindings[name] = ownedExports[name];
    });
    return api;
  }

  function getExpectedExports() {
    return expectedExports.slice();
  }

  function getExpectedDependencies() {
    return expectedDependencies.slice();
  }

  function getMetadata() {
    return {
      name: namespace,
      namespace: namespace,
      version: version,
      layer: "duel-domain-profile",
      moduleFormat: "classic-script-iife",
      scriptType: "classic",
      behavior: "owned-implementation",
      ownsBehavior: true,
      implementationAvailable: true,
      dependencyContract: "registerDependencies",
      registerBehavior: "dependencies-only",
      expectedExports: expectedExports.slice(),
      expectedDependencies: expectedDependencies.slice(),
      helperExports: [
        "normalizeDuelBarrierBehavior",
        "getDefaultDuelBarrierBehavior",
        "getDuelDomainBarrierRiskHint"
      ],
      boundExports: Object.keys(bindings),
      boundDependencies: Object.keys(dependencies)
    };
  }

  var ownedExports = {
    getDuelDomainProfiles: getDuelDomainProfiles,
    normalizeDuelDomainBarrierProfile: normalizeDuelDomainBarrierProfile,
    inferDuelDomainBarrierType: inferDuelDomainBarrierType,
    inferDuelDomainCompletion: inferDuelDomainCompletion,
    getDuelDomainBarrierModifiers: getDuelDomainBarrierModifiers,
    getDuelDomainBarrierSummary: getDuelDomainBarrierSummary,
    getDuelDomainProfileForCharacter: getDuelDomainProfileForCharacter,
    applyDuelDomainProfileOnActivation: applyDuelDomainProfileOnActivation,
    resolveDuelDomainProfileActivations: resolveDuelDomainProfileActivations
  };

  var api = {
    metadata: getMetadata,
    getMetadata: getMetadata,
    expectedExports: getExpectedExports,
    getExpectedExports: getExpectedExports,
    expectedDependencies: getExpectedDependencies,
    getExpectedDependencies: getExpectedDependencies,
    bind: bind,
    bindDependency: bindDependency,
    register: register,
    registerDependencies: registerDependencies,
    configure: configure,
    hasBinding: hasBinding,
    hasDependency: hasDependency,
    get: get,
    getBinding: getBinding,
    getDependency: getDependency,
    listBindings: listBindings,
    listDependencies: listDependencies,
    missingDependencies: missingDependencies,
    clearBindings: clearBindings,
    clearDependencies: clearDependencies,
    useOwnedImplementations: useOwnedImplementations,
    getDuelDomainProfiles: getDuelDomainProfiles,
    normalizeDuelDomainBarrierProfile: normalizeDuelDomainBarrierProfile,
    inferDuelDomainBarrierType: inferDuelDomainBarrierType,
    inferDuelDomainCompletion: inferDuelDomainCompletion,
    getDuelDomainBarrierModifiers: getDuelDomainBarrierModifiers,
    getDuelDomainBarrierSummary: getDuelDomainBarrierSummary,
    getDuelDomainProfileForCharacter: getDuelDomainProfileForCharacter,
    applyDuelDomainProfileOnActivation: applyDuelDomainProfileOnActivation,
    resolveDuelDomainProfileActivations: resolveDuelDomainProfileActivations,
    normalizeDuelBarrierBehavior: normalizeDuelBarrierBehavior,
    getDefaultDuelBarrierBehavior: getDefaultDuelBarrierBehavior,
    getDuelDomainBarrierRiskHint: getDuelDomainBarrierRiskHint
  };

  useOwnedImplementations();
  global[namespace] = api;
})(globalThis);
