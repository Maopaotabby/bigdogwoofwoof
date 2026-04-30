(function attachDuelDomainResponse(global) {
  "use strict";

  var namespace = "JJKDuelDomainResponse";
  var version = "1.386F-domain-response-extraction";
  var expectedExports = [
    "DUEL_DOMAIN_RESPONSE_ACTION_IDS",
    "getDuelDomainResponseProfile",
    "getDuelDomainProfileResponseImpact",
    "isDuelOpponentDomainThreat",
    "isDuelDomainActivationAction",
    "hasDuelDomainCounterAccess"
  ];
  var expectedDependencies = [
    "state",
    "getDuelBattle",
    "getCurrentDuelBattle",
    "getDuelDomainResponseText",
    "hasDuelTrueDomainAccess",
    "normalizeDuelDomainBarrierProfile",
    "getDuelDomainBarrierModifiers",
    "clamp"
  ];
  var dependencyModules = {
    normalizeDuelDomainBarrierProfile: { namespace: "JJKDuelDomainProfile", exportName: "normalizeDuelDomainBarrierProfile" },
    getDuelDomainBarrierModifiers: { namespace: "JJKDuelDomainProfile", exportName: "getDuelDomainBarrierModifiers" }
  };
  var domainResponseActionIdList = [
    "domain_clash",
    "simple_domain_guard",
    "hollow_wicker_basket_guard",
    "falling_blossom_emotion",
    "zero_ce_domain_bypass",
    "domain_survival_guard"
  ];
  var DUEL_DOMAIN_RESPONSE_ACTION_IDS = new Set(domainResponseActionIdList);
  var bindings = Object.create(null);
  var dependencies = Object.create(null);

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

  function normalizeActionIdSet(value) {
    var set = new Set();

    if (!value) return DUEL_DOMAIN_RESPONSE_ACTION_IDS;
    domainResponseActionIdList.forEach(function addKnownId(id) {
      if (
        (typeof value.has === "function" && value.has(id)) ||
        (Array.isArray(value) && value.indexOf(id) !== -1) ||
        (typeof value === "object" && value[id])
      ) {
        set.add(id);
      }
    });
    return set.size ? set : DUEL_DOMAIN_RESPONSE_ACTION_IDS;
  }

  function bind(name, value) {
    assertExpectedExport(name);
    if (name === "DUEL_DOMAIN_RESPONSE_ACTION_IDS") {
      bindings[name] = normalizeActionIdSet(value);
      return api;
    }
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
    if (!map || typeof map !== "object") return api;
    registerDependencies(map);
    expectedExports.forEach(function bindExport(name) {
      if (hasOwn(map, name) && map[name] != null) {
        bind(name, map[name]);
      }
    });
    return api;
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
    return hasOwn(bindings, name) ? bindings[name] : ownedExports[name];
  }

  function getBinding(name) {
    return get(name);
  }

  function hasExpectedValue(name) {
    var value = get(name);
    if (name === "DUEL_DOMAIN_RESPONSE_ACTION_IDS") {
      return Boolean(value && typeof value.has === "function");
    }
    return typeof value === "function";
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

  function hasDependency(name) {
    if (typeof name === "undefined") {
      return expectedDependencies.every(function hasExpectedDependency(dependencyName) {
        return Boolean(getOptionalDependency(dependencyName));
      });
    }
    return isExpectedDependency(name) && Boolean(getOptionalDependency(name));
  }

  function getDependency(name) {
    return getOptionalDependency(name);
  }

  function listDependencies() {
    return expectedDependencies.reduce(function buildSnapshot(snapshot, name) {
      snapshot[name] = Boolean(getOptionalDependency(name));
      return snapshot;
    }, {});
  }

  function missingDependencies(names) {
    return (names || expectedDependencies).filter(function isMissing(name) {
      return isExpectedDependency(name) && !getOptionalDependency(name);
    });
  }

  function clearDependencies() {
    expectedDependencies.forEach(function clearName(name) {
      delete dependencies[name];
    });
    return api;
  }

  function resolveDefaultBattle() {
    var getBattle = getOptionalDependency("getDuelBattle") || getOptionalDependency("getCurrentDuelBattle");
    var appState;

    if (typeof getBattle === "function") return getBattle();
    appState = getOptionalDependency("state");
    return appState && appState.duelBattle || null;
  }

  function resolveBattle(duelState) {
    return typeof duelState === "undefined" ? resolveDefaultBattle() : duelState;
  }

  function getDuelDomainResponseText(profile) {
    var dependency = getOptionalDependency("getDuelDomainResponseText");
    if (dependency && dependency !== getDuelDomainResponseText) return dependency(profile);
    return [
      profile?.name,
      profile?.domainProfile,
      profile?.techniqueText,
      profile?.externalResource,
      profile?.notes,
      ...(profile?.flags || []),
      ...(profile?.advancedTechniques || []),
      ...(profile?.innateTraits || []),
      ...(profile?.loadout || [])
    ].filter(Boolean).join(" ");
  }

  function hasDuelTrueDomainAccess(profile) {
    var dependency = getOptionalDependency("hasDuelTrueDomainAccess");
    var flags;
    var text;
    var antiDomainOnly;
    var trueDomainTags;

    if (dependency && dependency !== hasDuelTrueDomainAccess) return dependency(profile);
    flags = new Set(profile?.flags || []);
    text = getDuelDomainResponseText(profile);
    if (!profile || flags.has("noDomain") || /无领域|没有领域|不具备领域展开|未掌握领域/.test(text)) return false;
    antiDomainOnly = /简易领域|弥虚葛笼|彌虚葛籠|落花之情|反领域/.test(text) &&
      !/领域展开|生得领域|开放领域|顶级领域|顶尖领域|顶格领域|最高级领域|无量空处|伏魔御厨子|坐杀搏徒|真赝相爱|自闭圆顿裹|盖棺铁围山|荡蕴平线|时胞月宫殿|诛伏赐死|三重疾苦/.test(text);
    if (antiDomainOnly) return false;
    trueDomainTags = ["topDomain", "domainCapableAssumption", "domainSustainEngine", "openDomainExecution", "customDomain"];
    return trueDomainTags.some(function hasTag(tag) {
      return flags.has(tag);
    }) ||
      /领域展开|生得领域|开放领域|顶级领域|顶尖领域|顶格领域|最高级领域|无量空处|伏魔御厨子|坐杀搏徒|真赝相爱|自闭圆顿裹|盖棺铁围山|荡蕴平线|时胞月宫殿|诛伏赐死|三重疾苦|domain expansion/i.test(text) ||
      (/领域|domain|Domain/.test(String(profile?.domainProfile || "")) && !antiDomainOnly);
  }

  function getDuelDomainResponseProfile(profile, actor, opponent, duelState) {
    var flags;
    var text;
    var canExpandDomain;
    var hasHighDomainInterference;
    var hasSimpleDomain;
    var hasHollowWickerBasket;
    var hasFallingBlossomEmotion;
    var hasZeroCeBypass;
    var hasCursedToolBreak;
    var allowedDomainResponseActions = [];
    var battle = resolveBattle(duelState);
    var opponentThreat;

    if (typeof actor === "undefined") actor = null;
    if (typeof opponent === "undefined") opponent = null;
    flags = new Set(profile?.flags || []);
    text = getDuelDomainResponseText(profile);
    canExpandDomain = hasDuelTrueDomainAccess(profile);
    hasHighDomainInterference = !flags.has("noDomain") && /高阶领域干涉|领域干涉|领域展延|结界干涉|空性结界/.test(text);
    hasSimpleDomain = flags.has("antiDomain") || flags.has("simpleDomain") || /简易领域|simple domain/i.test(text);
    hasHollowWickerBasket = flags.has("hollowWickerBasket") || /弥虚葛笼|彌虚葛籠|Hollow Wicker Basket/i.test(text);
    hasFallingBlossomEmotion = flags.has("fallingBlossomEmotion") || /落花之情/.test(text);
    hasZeroCeBypass = flags.has("zeroCE") ||
      flags.has("domainSureHitInvalid") ||
      /零咒力|无咒力|無咒力|天与暴君|天与咒缚.*零|天与咒缚.*无咒力|甚尔|真希/.test(text);
    hasCursedToolBreak = flags.has("techniqueNullification") ||
      /天逆鉾|天逆矛|黑绳|破坏结界|破坏领域|破坏术式|术式中和|术式无效/.test(text);
    opponentThreat = isDuelOpponentDomainThreat(opponent, actor, battle);

    if (opponentThreat) {
      if (canExpandDomain || hasHighDomainInterference) {
        allowedDomainResponseActions.push("domain_clash");
      } else if (hasSimpleDomain) {
        allowedDomainResponseActions.push("simple_domain_guard");
      } else if (hasHollowWickerBasket) {
        allowedDomainResponseActions.push("hollow_wicker_basket_guard");
      } else if (hasFallingBlossomEmotion) {
        allowedDomainResponseActions.push("falling_blossom_emotion");
      } else if (hasZeroCeBypass) {
        allowedDomainResponseActions.push("zero_ce_domain_bypass");
      } else {
        allowedDomainResponseActions.push("domain_survival_guard");
      }
    }

    return {
      canExpandDomain: canExpandDomain,
      hasSimpleDomain: hasSimpleDomain,
      hasHollowWickerBasket: hasHollowWickerBasket,
      hasFallingBlossomEmotion: hasFallingBlossomEmotion,
      hasZeroCeBypass: hasZeroCeBypass,
      hasCursedToolBreak: hasCursedToolBreak,
      responseTier: allowedDomainResponseActions[0] || (opponentThreat ? "domain_survival_guard" : "none"),
      allowedDomainResponseActions: allowedDomainResponseActions
    };
  }

  function hasDuelDomainCounterAccess(profile) {
    return getDuelDomainResponseProfile(profile, null, { domain: { active: true } })
      .allowedDomainResponseActions.includes("domain_clash");
  }

  function isDuelOpponentDomainThreat(opponent, actor, battle) {
    var activeBattle = resolveBattle(battle);
    var opponentSide;

    if (typeof actor === "undefined") actor = null;
    if (opponent?.domain?.active) return true;
    if (!activeBattle || !opponent) return false;
    opponentSide = opponent.side || "";
    if (opponentSide === "left" && isDuelDomainActivationAction(activeBattle.pendingAction || activeBattle.currentAction)) return true;
    if (opponentSide === "right" && isDuelDomainActivationAction(activeBattle.cpuAction)) return true;
    return false;
  }

  function isDuelDomainActivationAction(action) {
    return Boolean(action?.effects?.activateDomain || action?.id === "domain_expand");
  }

  function inferDuelDomainBarrierType(domainProfile) {
    var text = [
      domainProfile?.domainClass,
      domainProfile?.barrierType,
      domainProfile?.domainName,
      ...((domainProfile && domainProfile.effectTags) || [])
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
    var text = [
      domainProfile?.domainCompletion,
      domainProfile?.domainClass,
      domainProfile?.domainName,
      ...((domainProfile && domainProfile.effectTags) || [])
    ].filter(Boolean).join(" ");
    if (/incomplete|未完成|不完全|嵌合暗翳庭/.test(text) || barrierType === "incomplete_barrier") return "incomplete";
    if (/unstable|不稳定/.test(text)) return "unstable";
    if (/conditional|jackpot|rule_trial|规则|审判|坐杀搏徒|诛伏赐死/.test(text) || barrierType === "rule_barrier") return "conditional";
    if (barrierType === "unknown" || barrierType === "pseudo_domain") return "unknown";
    return "complete";
  }

  function getDefaultDuelBarrierBehavior(barrierType, domainCompletion) {
    if (barrierType === "open_barrier") {
      return {
        escapeDifficulty: "medium",
        externalBreakRisk: "low",
        sureHitStability: "high",
        domainLoadModifier: 1.15,
        counterplayModifier: { domainClash: 0.9, simpleDomain: 0.82, hollowWickerBasket: 0.82, zeroCeBypass: 0.78, physicalBreak: 0.25 }
      };
    }
    if (barrierType === "incomplete_barrier" || domainCompletion === "incomplete") {
      return {
        escapeDifficulty: "medium",
        externalBreakRisk: "high",
        sureHitStability: "low",
        domainLoadModifier: 1.25,
        counterplayModifier: { domainClash: 1.2, simpleDomain: 1.1, hollowWickerBasket: 1, zeroCeBypass: 0.95, physicalBreak: 1.3 }
      };
    }
    if (barrierType === "rule_barrier") {
      return {
        escapeDifficulty: "high",
        externalBreakRisk: "medium",
        sureHitStability: "medium",
        domainLoadModifier: 0.92,
        counterplayModifier: { domainClash: 1, simpleDomain: 0.9, hollowWickerBasket: 0.9, zeroCeBypass: 0.75, physicalBreak: 0.75 }
      };
    }
    if (barrierType === "closed_barrier") {
      return {
        escapeDifficulty: "high",
        externalBreakRisk: "medium",
        sureHitStability: "high",
        domainLoadModifier: 1,
        counterplayModifier: { domainClash: 1, simpleDomain: 0.95, hollowWickerBasket: 0.95, zeroCeBypass: 0.85, physicalBreak: 1 }
      };
    }
    return {
      escapeDifficulty: "medium",
      externalBreakRisk: "medium",
      sureHitStability: "medium",
      domainLoadModifier: 1,
      counterplayModifier: { domainClash: 1, simpleDomain: 1, hollowWickerBasket: 1, zeroCeBypass: 1, physicalBreak: 1 }
    };
  }

  function normalizeDuelBarrierBehavior(behavior, barrierType, domainCompletion) {
    var defaults = getDefaultDuelBarrierBehavior(barrierType, domainCompletion);
    behavior = behavior || {};
    return {
      escapeDifficulty: behavior.escapeDifficulty || defaults.escapeDifficulty,
      externalBreakRisk: behavior.externalBreakRisk || defaults.externalBreakRisk,
      sureHitStability: behavior.sureHitStability || defaults.sureHitStability,
      domainLoadModifier: Number(behavior.domainLoadModifier ?? defaults.domainLoadModifier),
      counterplayModifier: {
        ...defaults.counterplayModifier,
        ...(behavior.counterplayModifier || {})
      }
    };
  }

  function normalizeDuelDomainBarrierProfile(domainProfile) {
    var dependency = getOptionalDependency("normalizeDuelDomainBarrierProfile");
    var source;
    var copy;
    var barrierTypeMap;
    var validBarrierTypes;
    var validCompletion;
    var validSwitchability;
    var inferredBarrierType;
    var barrierType;
    var domainCompletion;
    var domainSwitchability;

    if (dependency && dependency !== normalizeDuelDomainBarrierProfile) return dependency(domainProfile || {});
    source = domainProfile || {};
    copy = {};
    Object.keys(source).forEach(function copyKey(key) {
      copy[key] = source[key];
    });
    barrierTypeMap = {
      closed: "closed_barrier",
      open: "open_barrier",
      incomplete: "incomplete_barrier",
      rule: "rule_barrier",
      hybrid: "hybrid_barrier",
      pseudo: "pseudo_domain"
    };
    validBarrierTypes = new Set(["closed_barrier", "open_barrier", "incomplete_barrier", "rule_barrier", "hybrid_barrier", "pseudo_domain", "unknown"]);
    validCompletion = new Set(["complete", "incomplete", "unstable", "conditional", "unknown"]);
    validSwitchability = new Set(["fixed", "can_shift", "forced_by_context", "none", "unknown"]);
    inferredBarrierType = inferDuelDomainBarrierType(source);
    barrierType = validBarrierTypes.has(source.barrierType)
      ? source.barrierType
      : (barrierTypeMap[source.barrierType] || inferredBarrierType);
    domainCompletion = validCompletion.has(source.domainCompletion)
      ? source.domainCompletion
      : inferDuelDomainCompletion(source, barrierType);
    domainSwitchability = validSwitchability.has(source.domainSwitchability)
      ? source.domainSwitchability
      : "unknown";
    copy.barrierType = barrierType;
    copy.domainCompletion = domainCompletion;
    copy.domainSwitchability = domainSwitchability;
    copy.barrierBehavior = normalizeDuelBarrierBehavior(source.barrierBehavior, barrierType, domainCompletion);
    return copy;
  }

  function getDuelDomainBarrierModifiers(domainProfile, actor, opponent, duelState) {
    var dependency = getOptionalDependency("getDuelDomainBarrierModifiers");
    var profile;
    var behavior;
    var sureHitScales;
    var sureHitScale;
    var pressureScale = 1;
    var manualAttackScale = 1;
    var domainLoadScale;

    if (dependency && dependency !== getDuelDomainBarrierModifiers) {
      return dependency(domainProfile, actor || null, opponent || null, resolveBattle(duelState));
    }
    profile = normalizeDuelDomainBarrierProfile(domainProfile || {});
    behavior = profile.barrierBehavior || getDefaultDuelBarrierBehavior(profile.barrierType, profile.domainCompletion);
    sureHitScales = { low: 0.42, medium: 0.82, high: 1, extreme: 1.12 };
    sureHitScale = sureHitScales[behavior.sureHitStability] ?? 0.82;
    domainLoadScale = Number(behavior.domainLoadModifier || 1);
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

  function clamp(value, min, max) {
    var dependency = getOptionalDependency("clamp");
    if (dependency && dependency !== clamp) return dependency(value, min, max);
    return Math.max(min, Math.min(max, value));
  }

  function getDuelDomainProfileResponseImpact(responseAction, domainProfile) {
    var id = responseAction?.id || "";
    var normalizedProfile;
    var modifiers;
    var counterplayKey;
    var scales;
    var counterplayScale;
    var scale;
    var detail;

    if (!id || id === "domain_survival_guard" || !DUEL_DOMAIN_RESPONSE_ACTION_IDS.has(id)) {
      return {
        effective: false,
        weakened: false,
        scale: 1,
        label: "缺少硬防线"
      };
    }
    normalizedProfile = normalizeDuelDomainBarrierProfile(domainProfile || {});
    modifiers = getDuelDomainBarrierModifiers(normalizedProfile);
    counterplayKey = {
      domain_clash: "domainClash",
      simple_domain_guard: "simpleDomain",
      hollow_wicker_basket_guard: "hollowWickerBasket",
      falling_blossom_emotion: "simpleDomain",
      zero_ce_domain_bypass: "zeroCeBypass"
    }[id] || "domainClash";
    scales = {
      domain_clash: 0.32,
      simple_domain_guard: 0.58,
      hollow_wicker_basket_guard: 0.64,
      falling_blossom_emotion: 0.66,
      zero_ce_domain_bypass: 0.72
    };
    counterplayScale = Number(modifiers.counterplayScale?.[counterplayKey] ?? 1);
    scale = clamp((scales[id] || 0.7) / Math.max(0.2, counterplayScale), 0.22, 0.95);
    detail = "领域应对削弱专属领域完整展开。";
    if (normalizedProfile.barrierType === "open_barrier" && ["simple_domain_guard", "hollow_wicker_basket_guard", "zero_ce_domain_bypass"].includes(id)) {
      detail = "应对削弱必中组件，但未完全消除开放领域压制。";
    } else if (normalizedProfile.barrierType === "rule_barrier") {
      detail = "应对重点转为阻止或削弱规则子阶段。";
    } else if (normalizedProfile.barrierType === "incomplete_barrier") {
      detail = "未完成领域结构不稳，应对更容易撬动领域效果。";
    }
    return {
      effective: true,
      weakened: true,
      scale: scale,
      label: responseAction.label || id,
      actionId: id,
      barrierType: normalizedProfile.barrierType,
      detail: detail
    };
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
      layer: "duel-domain-response",
      moduleFormat: "classic-script-iife",
      scriptType: "classic",
      behavior: "implementation",
      ownsBehavior: true,
      implementationAvailable: true,
      dependencyContract: "registerDependencies",
      registerBehavior: "exports-and-dependencies",
      expectedExports: expectedExports.slice(),
      expectedDependencies: expectedDependencies.slice(),
      helperExports: [
        "getDuelDomainResponseText",
        "hasDuelTrueDomainAccess",
        "normalizeDuelDomainBarrierProfile",
        "getDuelDomainBarrierModifiers",
        "clamp"
      ],
      boundExports: Object.keys(bindings),
      boundDependencies: Object.keys(dependencies)
    };
  }

  var ownedExports = {
    DUEL_DOMAIN_RESPONSE_ACTION_IDS: DUEL_DOMAIN_RESPONSE_ACTION_IDS,
    getDuelDomainResponseProfile: getDuelDomainResponseProfile,
    getDuelDomainProfileResponseImpact: getDuelDomainProfileResponseImpact,
    isDuelOpponentDomainThreat: isDuelOpponentDomainThreat,
    isDuelDomainActivationAction: isDuelDomainActivationAction,
    hasDuelDomainCounterAccess: hasDuelDomainCounterAccess
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
    DUEL_DOMAIN_RESPONSE_ACTION_IDS: DUEL_DOMAIN_RESPONSE_ACTION_IDS,
    getDuelDomainResponseProfile: getDuelDomainResponseProfile,
    getDuelDomainProfileResponseImpact: getDuelDomainProfileResponseImpact,
    isDuelOpponentDomainThreat: isDuelOpponentDomainThreat,
    isDuelDomainActivationAction: isDuelDomainActivationAction,
    hasDuelDomainCounterAccess: hasDuelDomainCounterAccess,
    getDuelDomainResponseText: getDuelDomainResponseText,
    hasDuelTrueDomainAccess: hasDuelTrueDomainAccess,
    normalizeDuelDomainBarrierProfile: normalizeDuelDomainBarrierProfile,
    getDuelDomainBarrierModifiers: getDuelDomainBarrierModifiers,
    clamp: clamp
  };

  useOwnedImplementations();
  global[namespace] = api;
})(globalThis);
