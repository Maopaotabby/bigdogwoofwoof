(function attachDuelRuleSubphase(global) {
  "use strict";

  var namespace = "JJKDuelRuleSubphase";
  var version = "1.386H-rule-subphase-extraction";
  var expectedExports = [
    "getDuelTrialTargetRules",
    "normalizeDuelTrialEligibility",
    "getDuelTrialTargetRuleClassId",
    "getDuelTrialTargetRuleProfile",
    "getDuelTrialTargetLabel",
    "getDuelTrialEligibilityLabel",
    "getDuelTrialPhaseLabel",
    "normalizeDuelTrialSubjectType",
    "inferDuelTrialSubjectType",
    "normalizeDuelTrialEligibilityOverride",
    "buildDuelTrialTargetProfile",
    "isDuelTrialSubjectEligible",
    "getDuelTrialVerdictLabel",
    "getDuelTrialStatusLabel",
    "getDuelTrialEndReasonLabel",
    "buildDuelDomainTrialContext",
    "updateDuelDomainTrialContext",
    "getDuelActiveTrialContext",
    "syncDuelTrialSubPhaseLifecycle",
    "getDuelTrialTargetChoiceTemplates",
    "getDuelTrialOwnerActionTemplates",
    "getDuelTrialDefenderActionTemplates",
    "getDuelJackpotActionTemplates",
    "createDuelTrialSubPhase",
    "updateDuelTrialVerdictState",
    "applyDuelTrialAction",
    "resolveDuelTrialVerdict",
    "createDuelJackpotSubPhase",
    "updateDuelJackpotState",
    "applyDuelJackpotAction",
    "resolveDuelJackpot"
  ];
  var expectedDependencies = [
    "state",
    "getDuelBattle",
    "getCurrentDuelBattle",
    "getDuelTrialTargetRulesData",
    "getDuelTrialTargetRules",
    "getDuelProfileForSide",
    "getDuelResourcePair",
    "getDuelStatusEffectValue",
    "clampDuelResource",
    "invalidateDuelActionChoices",
    "appendDuelDomainProfileLog",
    "formatNumber",
    "formatSignedDuelDelta",
    "clamp"
  ];
  var dependencyModules = {
    getDuelResourcePair: { namespace: "JJKDuelResource", exportName: "getDuelResourcePair" },
    clampDuelResource: { namespace: "JJKDuelResource", exportName: "clampDuelResource" },
    invalidateDuelActionChoices: { namespace: "JJKDuelActions", exportName: "invalidateDuelActionChoices" }
  };
  var bindings = Object.create(null);
  var dependencies = Object.create(null);

  var DUEL_TRIAL_TARGET_TYPE_LABELS = {
    human: "人类",
    curse_user: "诅咒师 / 术师",
    incarnated: "受肉体",
    intelligent_curse: "高智能咒灵",
    instinct_curse: "低级咒灵",
    shikigami: "式神",
    cursed_tool: "咒具",
    cursed_object: "咒物",
    unknown: "未知对象"
  };
  var DUEL_TRIAL_ELIGIBILITY_LABELS = {
    full: "完整审判",
    partial: "部分审判",
    exorcism_ruling: "祓除裁定",
    redirect_to_controller: "指向操控者",
    object_confiscation: "咒具没收 / 封锁",
    none: "不适用"
  };
  var DUEL_TRIAL_PHASE_LABELS = {
    full: "审判中",
    partial: "部分审判中",
    exorcism_ruling: "祓除裁定中",
    redirect_to_controller: "操控链裁定中",
    object_confiscation: "没收判定中",
    none: "对象不适用"
  };
  var DUEL_TRIAL_TARGET_TYPES = new Set([
    "human",
    "curse_user",
    "incarnated",
    "intelligent_curse",
    "instinct_curse",
    "shikigami",
    "cursed_tool",
    "cursed_object",
    "unknown"
  ]);
  var DUEL_TRIAL_ELIGIBILITY_VALUES = new Set(["full", "partial", "exorcism_ruling", "redirect_to_controller", "object_confiscation", "none"]);
  var DUEL_TRIAL_TARGET_DEFAULTS = {
    human: {
      trialEligibility: "full",
      hasLegalAgency: true,
      hasSelfAwareness: true,
      canDefend: true,
      canRemainSilent: true,
      verdictVocabulary: "legal",
      verdictLabels: { insufficient: "证据不足", light: "轻判", confiscation: "没收", execution: "处刑状态候选" },
      notes: "CANDIDATE: 人类目标按完整审判主体处理。"
    },
    curse_user: {
      trialEligibility: "full",
      hasLegalAgency: true,
      hasSelfAwareness: true,
      canDefend: true,
      canRemainSilent: true,
      verdictVocabulary: "legal",
      verdictLabels: { insufficient: "证据不足", light: "轻判", confiscation: "术式没收", execution: "处刑状态候选" },
      notes: "CANDIDATE: 诅咒师仍按有责任能力的人类审判主体处理。"
    },
    incarnated: {
      trialEligibility: "partial",
      hasLegalAgency: true,
      hasSelfAwareness: true,
      canDefend: true,
      canRemainSilent: true,
      verdictVocabulary: "incarnated",
      verdictLabels: { insufficient: "证据不足", light: "受肉稳定下降", confiscation: "术式/咒物意识压制候选", execution: "处刑状态候选" },
      notes: "CANDIDATE: 受肉体按部分审判处理，第一版不精细拆分宿主与受肉意识。"
    },
    intelligent_curse: {
      trialEligibility: "partial",
      hasLegalAgency: false,
      hasSelfAwareness: true,
      canDefend: true,
      canRemainSilent: true,
      verdictVocabulary: "exorcism",
      verdictLabels: { insufficient: "残秽证据不足", light: "咒灵裁定", confiscation: "咒力罪证成立", execution: "祓除令候选" },
      notes: "CANDIDATE: 高智能咒灵不按普通法律被告处理，判决语义转为咒灵裁定。"
    },
    instinct_curse: {
      trialEligibility: "exorcism_ruling",
      hasLegalAgency: false,
      hasSelfAwareness: false,
      canDefend: false,
      canRemainSilent: false,
      verdictVocabulary: "exorcism",
      verdictLabels: { insufficient: "残秽不足", light: "祓除压力", confiscation: "咒力枷锁", execution: "祓除令候选" },
      notes: "CANDIDATE: 本能型咒灵不走完整辩护流程，只进入简化祓除裁定。"
    },
    shikigami: {
      trialEligibility: "redirect_to_controller",
      hasLegalAgency: false,
      hasSelfAwareness: false,
      canDefend: false,
      canRemainSilent: false,
      verdictVocabulary: "controller",
      verdictLabels: { insufficient: "操控链不明", light: "召唤链压制", confiscation: "式神控制封锁候选", execution: "操控者责任裁定候选" },
      notes: "CANDIDATE: 式神不作为完整被告，审判压力优先指向操控链或召唤质量。"
    },
    cursed_tool: {
      trialEligibility: "object_confiscation",
      hasLegalAgency: false,
      hasSelfAwareness: false,
      canDefend: false,
      canRemainSilent: false,
      verdictVocabulary: "object",
      verdictLabels: { insufficient: "非审判主体", light: "咒具风险标记", confiscation: "咒具没收候选", execution: "咒具封锁候选" },
      notes: "CANDIDATE: 咒具默认不是审判主体，只能作为没收或封存对象。"
    },
    cursed_object: {
      trialEligibility: "none",
      hasLegalAgency: false,
      hasSelfAwareness: false,
      canDefend: false,
      canRemainSilent: false,
      verdictVocabulary: "object",
      verdictLabels: { insufficient: "非审判主体", light: "咒物风险标记", confiscation: "咒物没收候选", execution: "咒物封印候选" },
      notes: "CANDIDATE: 普通咒物默认不审判；受肉咒物或有意识咒物需显式覆盖为 partial/incarnated。"
    },
    unknown: {
      trialEligibility: "partial",
      hasLegalAgency: false,
      hasSelfAwareness: false,
      canDefend: true,
      canRemainSilent: true,
      verdictVocabulary: "legal",
      verdictLabels: { insufficient: "证据不足", light: "轻判", confiscation: "没收", execution: "处刑状态候选" },
      notes: "CANDIDATE: 类型未知时保留旧版审判可玩性，但标记为未确认。"
    }
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
    if (!isExpectedExport(name)) throw new Error(namespace + ": unexpected export '" + name + "'");
  }

  function assertExpectedDependency(name) {
    if (!isExpectedDependency(name)) throw new Error(namespace + ": unexpected dependency '" + name + "'");
  }

  function assertFunction(name, value) {
    if (typeof value !== "function") throw new TypeError(namespace + ": binding '" + name + "' must be a function");
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
    if (!map || typeof map !== "object") return api;
    Object.keys(map).forEach(function bindEntry(name) {
      if (isExpectedDependency(name) && map[name] != null) bindDependency(name, map[name]);
      if (isExpectedExport(name) && map[name] != null) bind(name, map[name]);
    });
    return api;
  }

  function registerDependencies(map) {
    if (!map || typeof map !== "object") return api;
    Object.keys(map).forEach(function bindEntry(name) {
      if (isExpectedDependency(name) && map[name] != null) bindDependency(name, map[name]);
    });
    return api;
  }

  function configure(map) {
    return registerDependencies(map);
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

  function callOptionalDependency(name, args, fallback) {
    var dependency = getOptionalDependency(name);
    if (typeof dependency === "function") return dependency.apply(null, args || []);
    if (typeof fallback === "function") return fallback();
    return fallback;
  }

  function getCurrentBattle(defaultBattle) {
    if (defaultBattle) return defaultBattle;
    return callOptionalDependency("getCurrentDuelBattle", [], function fallbackBattle() {
      return callOptionalDependency("getDuelBattle", [], function fallbackStateBattle() {
        return dependencies.state?.duelBattle || null;
      });
    });
  }

  function clampValue(value, min, max) {
    var fn = getOptionalDependency("clamp");
    if (typeof fn === "function") return fn(value, min, max);
    return Math.max(min, Math.min(max, value));
  }

  function formatNumberValue(value) {
    var fn = getOptionalDependency("formatNumber");
    if (typeof fn === "function") return fn(value);
    if (!Number.isFinite(Number(value))) return "0";
    return Number(value).toFixed(4).replace(/\.?0+$/, "");
  }

  function formatSignedDuelDeltaValue(value) {
    var fn = getOptionalDependency("formatSignedDuelDelta");
    var number;
    if (typeof fn === "function") return fn(value);
    number = Number(value || 0);
    if (Math.abs(number) < 0.05) return "+0";
    return (number > 0 ? "+" : "") + formatNumberValue(Number(number.toFixed(1)));
  }

  function getProfileForSide(battle, side) {
    return callOptionalDependency("getDuelProfileForSide", [battle, side], function fallbackProfile() {
      if (side === "left") return battle?.left || null;
      if (side === "right") return battle?.right || null;
      return null;
    });
  }

  function getResourcePair(battle, side) {
    return callOptionalDependency("getDuelResourcePair", [battle, side], null);
  }

  function clampResource(resource) {
    return callOptionalDependency("clampDuelResource", [resource], resource);
  }

  function getStatusEffectValue(resource, id) {
    return callOptionalDependency("getDuelStatusEffectValue", [resource, id], function fallbackStatusEffectValue() {
      if (!resource?.statusEffects?.length) return 0;
      return Math.max(0, ...resource.statusEffects.filter(function filterEffect(effect) {
        return effect.id === id;
      }).map(function mapEffect(effect) {
        return Number(effect.value || 1);
      }));
    });
  }

  function invalidateActionChoices(battle) {
    return callOptionalDependency("invalidateDuelActionChoices", [battle], null);
  }

  function appendDomainProfileLog(battle, entry) {
    return callOptionalDependency("appendDuelDomainProfileLog", [battle, entry], null);
  }

  function addOrRefreshDuelStatusEffect(resource, effect) {
    var normalized;
    var existing;
    if (!resource || !effect?.id) return;
    normalized = { ...effect, rounds: Math.max(1, Number(effect.rounds || 1)), value: Number(effect.value ?? 1) };
    existing = resource.statusEffects?.find(function findEffect(item) {
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

  function getDuelTrialTargetRules() {
    var rules = callOptionalDependency("getDuelTrialTargetRulesData", [], null)
      || callOptionalDependency("getDuelTrialTargetRules", [], null)
      || dependencies.state?.duelTrialTargetRules;
    return rules || { schema: "jjk-duel-trial-target-rules", version: "0.1.0-candidate", status: "CANDIDATE", targetClassProfiles: [] };
  }

  function normalizeDuelTrialEligibility(value, fallback) {
    var normalized = String(value || "").trim();
    var legacyMap = { eligible: "full", limited: "partial", ineligible: "none", uncertain: "partial", no_trial: "none" };
    var mapped = legacyMap[normalized] || normalized;
    return DUEL_TRIAL_ELIGIBILITY_VALUES.has(mapped) ? mapped : (fallback || "partial");
  }

  function getDuelTrialTargetRuleClassId(trialSubjectType) {
    return { intelligent_curse: "high_intelligence_curse", instinct_curse: "low_grade_curse", shikigami: "shikigami", cursed_tool: "cursed_tool" }[trialSubjectType || "unknown"] || "";
  }

  function getDuelTrialTargetRuleProfile(trialSubjectType) {
    var id = getDuelTrialTargetRuleClassId(trialSubjectType || "unknown");
    if (!id) return null;
    return (getDuelTrialTargetRules().targetClassProfiles || []).find(function findProfile(profile) {
      return profile.id === id;
    }) || null;
  }

  function getDuelTrialTargetLabel(type) {
    return DUEL_TRIAL_TARGET_TYPE_LABELS[type || "unknown"] || DUEL_TRIAL_TARGET_TYPE_LABELS.unknown;
  }

  function getDuelTrialEligibilityLabel(eligibility) {
    return DUEL_TRIAL_ELIGIBILITY_LABELS[eligibility || "partial"] || DUEL_TRIAL_ELIGIBILITY_LABELS.partial;
  }

  function getDuelTrialPhaseLabel(eligibility) {
    return DUEL_TRIAL_PHASE_LABELS[eligibility || "partial"] || DUEL_TRIAL_PHASE_LABELS.partial;
  }

  function normalizeDuelTrialSubjectType(value) {
    var type = String(value || "").trim();
    return DUEL_TRIAL_TARGET_TYPES.has(type) ? type : "unknown";
  }

  function inferDuelTrialSubjectType(profile, resource) {
    var explicit = normalizeDuelTrialSubjectType(profile?.trialSubjectType || resource?.trialSubjectType || "");
    var text;
    if (explicit !== "unknown") return explicit;
    profile ||= {};
    text = [
      profile.id,
      profile.name,
      profile.displayName,
      profile.visibleGrade,
      profile.tier,
      profile.powerTier,
      profile.officialGrade,
      profile.domainProfile,
      profile.techniqueText,
      profile.notes,
      ...(profile.flags || []),
      ...(profile.innateTraits || [])
    ].filter(Boolean).join(" ");
    if (/受肉|incarnated|incarnation|九相图|咒胎九相图|半人半咒|不老\/咒物沉淀/i.test(text)) return "incarnated";
    if (/诅咒师|咒诅师|curse user|curse_user/i.test(text)) return "curse_user";
    if (/咒灵之躯|特级咒灵|灾害咒灵|cursed spirit|curseBody|positiveEnergyWeakness/i.test(text)) {
      return /真人|漏瑚|花御|陀艮|直哉|里香|智慧|语言|自我|self/i.test(text) ? "intelligent_curse" : "instinct_curse";
    }
    if (/式神|shikigami|魔虚罗|鵺|玉犬|脱兔|満象|圆鹿|贯牛/i.test(text) && (!profile.name || /式神|魔虚罗|鵺|玉犬|脱兔|満象|圆鹿|贯牛/i.test(profile.name))) return "shikigami";
    if (/咒具|cursed tool|天逆鉾|释魂刀|游云|黑绳|万里锁/i.test(text) && !profile.name) return "cursed_tool";
    if (/咒物|cursed object|宿傩手指|狱门疆|特级咒物/i.test(text) && !profile.name) return "cursed_object";
    if (profile.id || profile.name || profile.displayName) return "human";
    return "unknown";
  }

  function normalizeDuelTrialEligibilityOverride(value, type) {
    if (!value) return "";
    if (typeof value === "string") return normalizeDuelTrialEligibility(value, "");
    if (typeof value === "object") return normalizeDuelTrialEligibility(value[type] || value.default || "", "");
    return "";
  }

  function buildDuelTrialTargetProfile(profile, resource, domainProfile) {
    var targetProfile = profile || {};
    var domain = domainProfile || {};
    var type = normalizeDuelTrialSubjectType(targetProfile.trialSubjectType || domain.trialSubjectType || inferDuelTrialSubjectType(targetProfile, resource));
    var defaults = DUEL_TRIAL_TARGET_DEFAULTS[type] || DUEL_TRIAL_TARGET_DEFAULTS.unknown;
    var trialEligibility = normalizeDuelTrialEligibility(normalizeDuelTrialEligibilityOverride(targetProfile.trialEligibility || domain.trialEligibility, type) || defaults.trialEligibility, defaults.trialEligibility);
    var verdictVocabulary = String(targetProfile.verdictVocabulary || domain.verdictVocabulary || defaults.verdictVocabulary || "legal");
    var verdictLabels = { ...(defaults.verdictLabels || {}), ...(domain.verdictLabels || {}), ...(targetProfile.verdictLabels || {}) };
    return {
      trialSubjectType: type,
      trialEligibility: trialEligibility,
      targetLabel: getDuelTrialTargetLabel(type),
      eligibilityLabel: getDuelTrialEligibilityLabel(trialEligibility),
      phaseLabel: getDuelTrialPhaseLabel(trialEligibility),
      hasLegalAgency: Boolean(targetProfile.hasLegalAgency ?? domain.hasLegalAgency ?? defaults.hasLegalAgency),
      hasSelfAwareness: Boolean(targetProfile.hasSelfAwareness ?? domain.hasSelfAwareness ?? defaults.hasSelfAwareness),
      canDefend: Boolean(targetProfile.canDefend ?? domain.canDefend ?? defaults.canDefend),
      canRemainSilent: Boolean(targetProfile.canRemainSilent ?? domain.canRemainSilent ?? defaults.canRemainSilent),
      verdictVocabulary: verdictVocabulary,
      verdictLabels: verdictLabels,
      notes: [defaults.notes, domain.notes, targetProfile.notes].filter(Boolean).join(" / "),
      status: "CANDIDATE"
    };
  }

  function isDuelTrialSubjectEligible(targetProfile) {
    return normalizeDuelTrialEligibility(targetProfile?.trialEligibility, "none") !== "none";
  }

  function getDuelTrialVerdictLabel(subPhase, key, fallback) {
    return subPhase?.verdictLabels?.[key] || fallback;
  }

  function getDuelTrialStatusLabel(status) {
    return {
      full: "审判中",
      partial: "部分审判中",
      weakened: "审判规则被削弱",
      suppressed: "目标已识别，审判规则未完整成立",
      pending: "审判准备中",
      resolved: "审判已结束",
      none: "未进入审判"
    }[status || "pending"] || status || "审判准备中";
  }

  function getDuelTrialEndReasonLabel(reason) {
    return {
      verdictResolved: "判决完成",
      domainMeltdown: "领域熔断",
      domainManuallyEnded: "主动解除领域",
      domainResponseDisrupted: "领域对抗破坏",
      insufficientCeOrStability: "咒力不足",
      battleEnded: "战斗结束",
      ineligibleTarget: "对象不适用",
      ongoing: "未结束 / 持续中",
      none: "未进入审判"
    }[reason || ""] || reason || "未结束 / 持续中";
  }

  function buildDuelDomainTrialContext(profile, actor, opponent, battle, response, options) {
    var duelBattle = getCurrentBattle(battle);
    var responseInfo = response || {};
    var contextOptions = options || {};
    var defenderProfile;
    var defenderResource;
    var trialTarget;
    var responseEffective;
    var responseStatus;
    var trialStatus;
    var context;
    if (!duelBattle || !profile || !actor || !opponent) return null;
    defenderProfile = getProfileForSide(duelBattle, opponent.side) || {};
    defenderResource = getResourcePair(duelBattle, opponent.side);
    trialTarget = contextOptions.trialTargetProfile || buildDuelTrialTargetProfile(defenderProfile, defenderResource, profile);
    responseEffective = Boolean(contextOptions.responseEffective ?? responseInfo.effective);
    responseStatus = {
      responseType: contextOptions.responseActionId || responseInfo.actionId || "",
      responseLabel: contextOptions.responseLabel || responseInfo.label || (responseEffective ? "已削弱" : "无硬防线"),
      responseDetail: contextOptions.responseDetail || responseInfo.detail || "",
      responseEffective: responseEffective,
      suppressedByDomainResponse: responseEffective
    };
    trialStatus = contextOptions.trialStatus || (responseEffective ? "weakened" : "pending");
    context = {
      owner: actor.side,
      target: opponent.side,
      ownerName: actor.name || "",
      targetName: opponent.name || "",
      domainId: profile.id,
      domainName: profile.domainName,
      trialTargetProfile: trialTarget,
      trialSubjectType: trialTarget.trialSubjectType,
      trialEligibility: trialTarget.trialEligibility,
      verdictVocabulary: trialTarget.verdictVocabulary,
      targetLabel: trialTarget.targetLabel,
      eligibilityLabel: trialTarget.eligibilityLabel,
      phaseLabel: trialTarget.phaseLabel,
      hasLegalAgency: trialTarget.hasLegalAgency,
      hasSelfAwareness: trialTarget.hasSelfAwareness,
      canDefend: trialTarget.canDefend,
      canRemainSilent: trialTarget.canRemainSilent,
      responseStatus: responseStatus,
      trialStatus: trialStatus,
      trialEndReason: contextOptions.trialEndReason || "",
      roundStarted: duelBattle.round + 1,
      status: "CANDIDATE"
    };
    duelBattle.domainTrialContext = context;
    return context;
  }

  function updateDuelDomainTrialContext(battle, patch) {
    var duelBattle = getCurrentBattle(battle);
    var update = patch || {};
    var rest;
    if (!duelBattle?.domainTrialContext) return null;
    if (update.responseStatus) duelBattle.domainTrialContext.responseStatus = { ...(duelBattle.domainTrialContext.responseStatus || {}), ...update.responseStatus };
    rest = { ...update };
    delete rest.responseStatus;
    Object.assign(duelBattle.domainTrialContext, rest);
    return duelBattle.domainTrialContext;
  }

  function getDuelActiveTrialContext(battle, subPhase) {
    var duelBattle = getCurrentBattle(battle);
    var phase = subPhase || duelBattle?.domainSubPhase;
    var context = duelBattle?.domainTrialContext || null;
    if (context) return context;
    if (phase?.type !== "trial") return null;
    return {
      owner: phase.owner,
      target: phase.defender,
      domainId: phase.domainId,
      domainName: phase.domainName,
      trialSubjectType: phase.trialSubjectType || "unknown",
      trialEligibility: phase.trialEligibility || "partial",
      verdictVocabulary: phase.verdictVocabulary || "legal",
      targetLabel: phase.targetLabel || getDuelTrialTargetLabel(phase.trialSubjectType || "unknown"),
      eligibilityLabel: phase.eligibilityLabel || getDuelTrialEligibilityLabel(phase.trialEligibility || "partial"),
      phaseLabel: phase.phaseLabel || getDuelTrialPhaseLabel(phase.trialEligibility || "partial"),
      responseStatus: {
        responseType: phase.responseActionId || "",
        responseLabel: phase.responseLabel || (phase.responseEffective ? "已削弱" : "无硬防线"),
        responseDetail: phase.responseDetail || "",
        responseEffective: Boolean(phase.responseEffective),
        suppressedByDomainResponse: Boolean(phase.responseEffective)
      },
      trialStatus: phase.verdictResolved ? "resolved" : (phase.responseEffective ? "weakened" : "full"),
      trialEndReason: phase.trialEndReason || "",
      status: "CANDIDATE"
    };
  }

  function syncDuelTrialSubPhaseLifecycle(battle) {
    var duelBattle = getCurrentBattle(battle);
    var subPhase = duelBattle?.domainSubPhase;
    var owner;
    var reason;
    if (subPhase?.type !== "trial") return subPhase || null;
    if (subPhase.verdictResolved) {
      reason = subPhase.trialEndReason || (subPhase.endedByMeltdown ? "domainMeltdown" : (subPhase.endedByRelease ? "domainManuallyEnded" : (subPhase.verdict ? "verdictResolved" : "domainResponseDisrupted")));
      subPhase.trialEndReason = reason;
      updateDuelDomainTrialContext(duelBattle, { trialStatus: "resolved", trialEndReason: reason, verdict: subPhase.verdict || "" });
      return subPhase;
    }
    owner = getResourcePair(duelBattle, subPhase.owner);
    if (!owner?.domain?.active) {
      subPhase.verdictResolved = true;
      subPhase.violenceRestricted = false;
      subPhase.trialEndReason = subPhase.trialEndReason || "domainManuallyEnded";
      updateDuelDomainTrialContext(duelBattle, { trialStatus: "resolved", trialEndReason: subPhase.trialEndReason });
      invalidateActionChoices(duelBattle);
      return subPhase;
    }
    updateDuelDomainTrialContext(duelBattle, { trialStatus: subPhase.responseEffective ? "weakened" : "full", trialEndReason: "" });
    return subPhase;
  }

  function getDuelTrialTargetChoiceTemplates(subPhase, roleFilter) {
    var phase = subPhase || {};
    var ruleProfile = getDuelTrialTargetRuleProfile(phase.trialSubjectType);
    var choices = (ruleProfile?.choices || []).filter(function filterChoice(choice) {
      if (!roleFilter) return true;
      return roleFilter(choice.role || "");
    });
    return choices.map(function mapChoice(choice) {
      return {
        ...choice,
        description: (choice.description || choice.label) + "（" + (ruleProfile?.label || getDuelTrialTargetLabel(phase.trialSubjectType)) + " CANDIDATE）",
        targetSpecific: true,
        targetClassProfileId: ruleProfile?.id || ""
      };
    });
  }

  function getDuelTrialOwnerActionTemplates(profile, subPhase) {
    var phase = subPhase || {};
    var base = profile?.domainActions || [];
    var targetControl = getDuelTrialTargetChoiceTemplates(phase, function filterRole(role) {
      return role === "trial_control" || role === "prosecution";
    });
    if (["redirect_to_controller", "object_confiscation"].includes(phase.trialEligibility)) {
      return [
        ...targetControl,
        ...base.filter(function filterAction(action) {
          return ["request_verdict", "rule_pressure", "present_evidence"].includes(action.id);
        })
      ];
    }
    if (phase.trialEligibility === "exorcism_ruling") {
      return base.filter(function filterAction(action) {
        return ["present_evidence", "rule_pressure", "request_verdict", "advance_trial"].includes(action.id);
      });
    }
    return [...base, ...targetControl];
  }

  function getDuelTrialDefenderActionTemplates(profile, subPhase) {
    var phase = subPhase || {};
    var targetDefense;
    var base;
    if (["redirect_to_controller", "object_confiscation"].includes(phase.trialEligibility)) return [];
    targetDefense = getDuelTrialTargetChoiceTemplates(phase, function filterRole(role) {
      return role === "defense";
    });
    if (targetDefense.length) return targetDefense;
    if (phase.canDefend === false && phase.canRemainSilent === false) return [];
    base = profile?.opponentActions || [];
    return base.filter(function filterAction(action) {
      if (action.id === "remain_silent") return phase.canRemainSilent !== false;
      if (["defend", "challenge_evidence", "deny_charge", "delay_trial"].includes(action.id)) return phase.canDefend !== false;
      return true;
    });
  }

  function getDuelJackpotActionTemplates(profile) {
    return profile?.domainActions || [];
  }

  function createDuelTrialSubPhase(profile, actor, opponent, battle, context) {
    var duelBattle = getCurrentBattle(battle);
    var phaseContext = context || {};
    var defenderProfile;
    var defenderResource;
    var trialTarget;
    var baseEvidencePressure;
    var responseScale;
    var initialEvidencePressure;
    if (!duelBattle) return null;
    defenderProfile = getProfileForSide(duelBattle, opponent.side) || {};
    defenderResource = getResourcePair(duelBattle, opponent.side);
    trialTarget = phaseContext.trialTargetProfile || buildDuelTrialTargetProfile(defenderProfile, defenderResource, profile);
    if (!isDuelTrialSubjectEligible(trialTarget)) {
      if (!duelBattle.domainTrialContext) buildDuelDomainTrialContext(profile, actor, opponent, duelBattle, {}, { trialTargetProfile: trialTarget, trialStatus: "none", trialEndReason: "ineligibleTarget" });
      updateDuelDomainTrialContext(duelBattle, { trialStatus: "none", trialEndReason: "ineligibleTarget" });
      addOrRefreshDuelStatusEffect(opponent, { id: "trialTargetIneligibleCandidate", label: "非审判主体候选", rounds: 1, value: 1 });
      appendDomainProfileLog(duelBattle, {
        side: actor.side,
        title: "审判目标类型不成立",
        type: "trialTarget",
        detail: actor.name + " 的" + profile.domainName + "尝试进入审判规则，但审判对象为" + trialTarget.targetLabel + "，裁定类型为" + trialTarget.eligibilityLabel + "；审判子阶段不完整展开，只保留规则压力候选。" + trialTarget.notes
      });
      return null;
    }
    baseEvidencePressure = { full: 0, partial: 0.4, exorcism_ruling: 1.2, redirect_to_controller: 1.4, object_confiscation: 1.8 }[trialTarget.trialEligibility] || 0;
    responseScale = phaseContext.responseEffective ? clampValue(Number(phaseContext.responseScale || 0.65), 0.22, 0.95) : 1;
    initialEvidencePressure = Number((baseEvidencePressure * responseScale).toFixed(1));
    duelBattle.domainSubPhase = {
      type: "trial",
      owner: actor.side,
      defender: opponent.side,
      domainId: profile.id,
      domainName: profile.domainName,
      trialSubjectType: trialTarget.trialSubjectType,
      trialEligibility: trialTarget.trialEligibility,
      hasLegalAgency: trialTarget.hasLegalAgency,
      hasSelfAwareness: trialTarget.hasSelfAwareness,
      canDefend: trialTarget.canDefend,
      canRemainSilent: trialTarget.canRemainSilent,
      verdictVocabulary: trialTarget.verdictVocabulary,
      verdictLabels: trialTarget.verdictLabels,
      targetLabel: trialTarget.targetLabel,
      eligibilityLabel: trialTarget.eligibilityLabel,
      phaseLabel: trialTarget.phaseLabel,
      targetNotes: trialTarget.notes,
      evidencePressure: initialEvidencePressure,
      defensePressure: 0,
      trialRound: 1,
      verdictReady: ["exorcism_ruling", "redirect_to_controller", "object_confiscation"].includes(trialTarget.trialEligibility),
      verdictResolved: false,
      violenceRestricted: true,
      heavyVerdictRisk: 0,
      selfIncriminationRisk: 0,
      responseEffective: Boolean(phaseContext.responseEffective),
      responseScale: responseScale,
      responseActionId: phaseContext.responseActionId || "",
      responseLabel: phaseContext.responseLabel || "",
      responseDetail: phaseContext.responseDetail || "",
      trialStatus: phaseContext.responseEffective ? "weakened" : "full",
      trialEndReason: "",
      status: "CANDIDATE"
    };
    updateDuelDomainTrialContext(duelBattle, {
      trialStatus: duelBattle.domainSubPhase.trialStatus,
      trialEndReason: "",
      trialSubjectType: trialTarget.trialSubjectType,
      trialEligibility: trialTarget.trialEligibility,
      verdictVocabulary: trialTarget.verdictVocabulary,
      targetLabel: trialTarget.targetLabel,
      eligibilityLabel: trialTarget.eligibilityLabel,
      phaseLabel: trialTarget.phaseLabel,
      responseStatus: {
        responseType: phaseContext.responseActionId || "",
        responseLabel: phaseContext.responseLabel || (phaseContext.responseEffective ? "已削弱" : "无硬防线"),
        responseDetail: phaseContext.responseDetail || "",
        responseEffective: Boolean(phaseContext.responseEffective),
        suppressedByDomainResponse: Boolean(phaseContext.responseEffective)
      }
    });
    invalidateActionChoices(duelBattle);
    appendDomainProfileLog(duelBattle, {
      side: actor.side,
      title: "审判子阶段",
      type: trialTarget.trialEligibility === "exorcism_ruling" ? "exorcismRuling" : (trialTarget.trialEligibility === "object_confiscation" ? "objectConfiscation" : (trialTarget.trialEligibility === "redirect_to_controller" ? "controllerRedirect" : "trialTarget")),
      detail: actor.name + " 的" + profile.domainName + "把战斗拉入" + trialTarget.phaseLabel + "；审判对象：" + trialTarget.targetLabel + "，裁定类型：" + trialTarget.eligibilityLabel + "，判决语义：" + trialTarget.verdictVocabulary + "。" + (phaseContext.responseEffective ? "领域应对已削弱规则推进，初始证据压力按 " + formatNumberValue(responseScale) + " 倍保留。" : "证据压力与辩护压力开始记录，暴力行为受到限制。")
    });
    return duelBattle.domainSubPhase;
  }

  function updateDuelTrialVerdictState(subPhase) {
    var adjustedPressure;
    if (!subPhase) return null;
    subPhase.evidencePressure = Number(clampValue(Number(subPhase.evidencePressure || 0), 0, 10).toFixed(1));
    subPhase.defensePressure = Number(clampValue(Number(subPhase.defensePressure || 0), 0, 8).toFixed(1));
    subPhase.heavyVerdictRisk = Number(clampValue(Number(subPhase.heavyVerdictRisk || 0), 0, 5).toFixed(1));
    subPhase.selfIncriminationRisk = Number(clampValue(Number(subPhase.selfIncriminationRisk || 0), 0, 5).toFixed(1));
    subPhase.trialRound = Math.max(1, Math.min(6, Math.round(Number(subPhase.trialRound || 1))));
    adjustedPressure = subPhase.evidencePressure - subPhase.defensePressure * 0.35 + subPhase.heavyVerdictRisk * 0.45 - subPhase.selfIncriminationRisk * 0.25;
    subPhase.verdictReady = Boolean(subPhase.verdictReady || subPhase.trialRound >= 3 || adjustedPressure >= 4.2);
    return subPhase;
  }

  function createDuelJackpotSubPhase(profile, actor, opponent, battle) {
    var duelBattle = getCurrentBattle(battle);
    if (!duelBattle) return null;
    duelBattle.domainTrialContext = null;
    duelBattle.domainSubPhase = {
      type: "jackpot",
      owner: actor.side,
      defender: opponent.side,
      domainId: profile.id,
      domainName: profile.domainName,
      jackpotGauge: 0,
      jackpotRound: 1,
      jackpotReady: false,
      jackpotResolved: false,
      status: "CANDIDATE"
    };
    invalidateActionChoices(duelBattle);
    appendDomainProfileLog(duelBattle, {
      side: actor.side,
      title: "坐杀搏徒子阶段",
      type: "subphase",
      detail: actor.name + " 的" + profile.domainName + "进入概率规则循环，jackpot 期待度开始推进；未中奖前会持续带来领域负荷与咒力压力。"
    });
    return duelBattle.domainSubPhase;
  }

  function updateDuelJackpotState(subPhase) {
    if (!subPhase) return null;
    subPhase.jackpotGauge = Number(clampValue(Number(subPhase.jackpotGauge || 0), 0, 120).toFixed(1));
    subPhase.jackpotRound = Math.max(1, Math.min(6, Math.round(Number(subPhase.jackpotRound || 1))));
    subPhase.jackpotReady = Boolean(subPhase.jackpotReady || subPhase.jackpotGauge >= 100 || subPhase.jackpotRound >= 3);
    return subPhase;
  }

  function applyDuelTrialAction(action, actor, opponent, battle) {
    var duelBattle = getCurrentBattle(battle);
    var subPhase = duelBattle?.domainSubPhase;
    var effects = action?.effects || {};
    var isDefenseSide;
    var defenseScale;
    var targetDefenseScale;
    var before;
    var rawEvidenceDelta;
    var rawDefenseDelta;
    var owner;
    var delta;
    if (!subPhase) return null;
    isDefenseSide = actor.side === subPhase.defender;
    if (isDefenseSide && ["defend", "challenge_evidence", "deny_charge", "delay_trial"].includes(action.id) && subPhase.canDefend === false) {
      appendDomainProfileLog(duelBattle, { side: actor.side, title: "审判手法不可用", type: "subphase", detail: actor.name + " 的目标类型 " + (subPhase.trialSubjectType || "unknown") + " 在当前 CANDIDATE 规则下不能有效辩护。" });
      return { trial: { blocked: true, reason: "cannotDefend", trialSubjectType: subPhase.trialSubjectType || "unknown" } };
    }
    if (isDefenseSide && action.id === "remain_silent" && subPhase.canRemainSilent === false) {
      appendDomainProfileLog(duelBattle, { side: actor.side, title: "审判手法不可用", type: "subphase", detail: actor.name + " 的目标类型 " + (subPhase.trialSubjectType || "unknown") + " 在当前 CANDIDATE 规则下不能主张沉默。" });
      return { trial: { blocked: true, reason: "cannotRemainSilent", trialSubjectType: subPhase.trialSubjectType || "unknown" } };
    }
    defenseScale = isDefenseSide ? clampValue(1 - getStatusEffectValue(actor, "trialRulePressure") * 0.25, 0.5, 1) : 1;
    targetDefenseScale = isDefenseSide ? ({ full: 1, partial: 0.78, exorcism_ruling: 0.46, redirect_to_controller: 0.35, object_confiscation: 0.25 }[subPhase.trialEligibility] ?? 0.72) : 1;
    before = {
      evidencePressure: Number(subPhase.evidencePressure || 0),
      defensePressure: Number(subPhase.defensePressure || 0),
      trialRound: Number(subPhase.trialRound || 1),
      heavyVerdictRisk: Number(subPhase.heavyVerdictRisk || 0),
      selfIncriminationRisk: Number(subPhase.selfIncriminationRisk || 0)
    };
    rawEvidenceDelta = Number(effects.evidencePressureDelta || 0);
    if (rawEvidenceDelta) subPhase.evidencePressure += isDefenseSide && rawEvidenceDelta < 0 ? rawEvidenceDelta * defenseScale * targetDefenseScale : rawEvidenceDelta;
    rawDefenseDelta = Number(effects.defensePressureDelta || 0);
    if (rawDefenseDelta) subPhase.defensePressure += isDefenseSide && rawDefenseDelta > 0 ? rawDefenseDelta * defenseScale * targetDefenseScale : rawDefenseDelta;
    if (Number(effects.trialRoundDelta || 0)) subPhase.trialRound += Number(effects.trialRoundDelta || 0);
    if (Number(effects.heavyVerdictRiskDelta || 0)) subPhase.heavyVerdictRisk += Number(effects.heavyVerdictRiskDelta || 0);
    if (Number(effects.selfIncriminationRiskDelta || 0)) subPhase.selfIncriminationRisk += Number(effects.selfIncriminationRiskDelta || 0);
    if (effects.verdictProgress) subPhase.verdictReady = true;
    if (effects.denyCharge) {
      if (subPhase.evidencePressure >= 3.6) {
        subPhase.evidencePressure += 0.8;
        subPhase.defensePressure += 0.2;
        subPhase.heavyVerdictRisk += 0.8;
      } else {
        subPhase.evidencePressure -= 0.8;
        subPhase.defensePressure += 0.7;
        subPhase.selfIncriminationRisk = Math.max(0, Number(subPhase.selfIncriminationRisk || 0) - 0.2);
      }
    }
    if (action.id === "remain_silent") {
      subPhase.selfIncriminationRisk = Math.max(0, Number(subPhase.selfIncriminationRisk || 0) - 0.6);
      subPhase.heavyVerdictRisk = Math.max(0, Number(subPhase.heavyVerdictRisk || 0) - 0.2);
    }
    if (Number(effects.ownerDomainLoadDelta || 0)) {
      owner = getResourcePair(duelBattle, subPhase.owner);
      if (owner?.domain) {
        owner.domain.load += Number(effects.ownerDomainLoadDelta || 0);
        clampResource(owner);
      }
    }
    if (effects.redirectTrialTarget) {
      subPhase.redirectTrialTarget = effects.redirectTrialTarget;
      subPhase.evidencePressure += effects.redirectTrialTarget === "controller" || effects.redirectTrialTarget === "wielder" ? 0.4 : 0.15;
    }
    if (effects.requestConfiscationTarget) {
      subPhase.confiscationTarget = effects.requestConfiscationTarget;
      subPhase.verdictReady = true;
    }
    updateDuelTrialVerdictState(subPhase);
    if (effects.requestVerdict) return resolveDuelTrialVerdict(action, actor, opponent, duelBattle, before);
    delta = {
      evidencePressure: Number((subPhase.evidencePressure - before.evidencePressure).toFixed(1)),
      defensePressure: Number((subPhase.defensePressure - before.defensePressure).toFixed(1)),
      trialRound: subPhase.trialRound - before.trialRound,
      heavyVerdictRisk: Number((Number(subPhase.heavyVerdictRisk || 0) - before.heavyVerdictRisk).toFixed(1)),
      selfIncriminationRisk: Number((Number(subPhase.selfIncriminationRisk || 0) - before.selfIncriminationRisk).toFixed(1))
    };
    appendDomainProfileLog(duelBattle, { side: actor.side, title: "审判手法：" + action.label, type: "subphase", detail: actor.name + " 在" + subPhase.domainName + "中选择" + action.label + "；证据压力 " + formatSignedDuelDeltaValue(delta.evidencePressure) + "，辩护压力 " + formatSignedDuelDeltaValue(delta.defensePressure) + "，重判风险 " + formatSignedDuelDeltaValue(delta.heavyVerdictRisk) + "，当前审判轮次 " + subPhase.trialRound + "。" });
    return { trial: { ...delta, verdictReady: subPhase.verdictReady } };
  }

  function applyDuelJackpotAction(action, actor, opponent, battle) {
    var duelBattle = getCurrentBattle(battle);
    var subPhase = duelBattle?.domainSubPhase;
    var effects = action?.effects || {};
    var before;
    var delta;
    if (!subPhase) return null;
    before = { jackpotGauge: Number(subPhase.jackpotGauge || 0), jackpotRound: Number(subPhase.jackpotRound || 1) };
    if (Number(effects.jackpotGaugeDelta || 0)) subPhase.jackpotGauge += Number(effects.jackpotGaugeDelta || 0);
    if (Number(effects.jackpotRoundDelta || 0)) subPhase.jackpotRound += Number(effects.jackpotRoundDelta || 0);
    if (effects.jackpotProgress) subPhase.jackpotReady = true;
    updateDuelJackpotState(subPhase);
    if (effects.claimJackpot) return resolveDuelJackpot(action, actor, opponent, duelBattle, before);
    delta = { jackpotGauge: Number((subPhase.jackpotGauge - before.jackpotGauge).toFixed(1)), jackpotRound: subPhase.jackpotRound - before.jackpotRound };
    appendDomainProfileLog(duelBattle, { side: actor.side, title: "坐杀搏徒：" + action.label, type: "subphase", detail: actor.name + " 推进" + subPhase.domainName + "规则循环；jackpot 期待度 " + formatSignedDuelDeltaValue(delta.jackpotGauge) + "，当前 " + formatNumberValue(subPhase.jackpotGauge) + " / 100，循环回合 " + subPhase.jackpotRound + "。" });
    return { jackpot: { ...delta, jackpotReady: subPhase.jackpotReady } };
  }

  function resolveDuelJackpot(action, actor, opponent, battle, before) {
    var duelBattle = getCurrentBattle(battle);
    var subPhase = duelBattle?.domainSubPhase;
    var previous = before || {};
    var owner;
    if (!subPhase) return null;
    updateDuelJackpotState(subPhase);
    owner = getResourcePair(duelBattle, subPhase.owner);
    if (!subPhase.jackpotReady) {
      subPhase.jackpotGauge = Math.min(100, Number(subPhase.jackpotGauge || 0) + 8);
      if (owner?.domain) owner.domain.load += 8;
      if (owner) owner.stability = Number(clampValue(Number(owner.stability || 0) - 0.02, 0, 1).toFixed(4));
      updateDuelJackpotState(subPhase);
      clampResource(owner);
      appendDomainProfileLog(duelBattle, { side: actor.side, title: "坐杀搏徒未中", type: "subphase", detail: actor.name + " 强行结算 jackpot，但期待度尚未成熟；领域负荷上升，循环继续压迫咒力与稳定。" });
      return { jackpot: { jackpotGauge: Number((subPhase.jackpotGauge - Number(previous.jackpotGauge || 0)).toFixed(1)), jackpotReady: subPhase.jackpotReady, jackpotResolved: false } };
    }
    addOrRefreshDuelStatusEffect(owner, { id: "jackpotStateCandidate", label: "jackpot 状态候选", rounds: 3, value: 1 });
    addOrRefreshDuelStatusEffect(owner, { id: "jackpotCycleCandidate", label: "坐杀搏徒循环候选", rounds: 2, value: 1.2 });
    if (owner) {
      owner.ce = Math.min(owner.maxCe, Number(owner.ce || 0) + owner.maxCe * 0.18);
      owner.hp = Math.min(owner.maxHp, Number(owner.hp || 0) + owner.maxHp * 0.08);
      owner.stability = Number(clampValue(Number(owner.stability || 0) + 0.06, 0, 1).toFixed(4));
    }
    subPhase.jackpotGauge = Math.max(100, Number(subPhase.jackpotGauge || 0));
    subPhase.jackpotReady = true;
    subPhase.jackpotResolved = true;
    subPhase.jackpotResult = "jackpotStateCandidate";
    clampResource(owner);
    appendDomainProfileLog(duelBattle, { side: subPhase.owner, title: "坐杀搏徒中奖", type: "subphase", detail: subPhase.domainName + "结算 jackpot，" + actor.name + " 获得 jackpot 状态候选：咒力回流、体势恢复和承伤减免开始生效。" });
    return { jackpot: { jackpotGauge: Number((subPhase.jackpotGauge - Number(previous.jackpotGauge || 0)).toFixed(1)), jackpotReady: true, jackpotResolved: true, status: "jackpotStateCandidate" } };
  }

  function getTrialCardActionId(card) {
    return card?.actionId || card?.id || card?.sourceActionId || card?.action?.id || "";
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function getTrialCardText(card) {
    return [
      getTrialCardActionId(card),
      card?.label,
      card?.name,
      card?.displayName,
      card?.cardType,
      card?.domainClass,
      card?.domainRole,
      card?.damageType,
      card?.sourceTechniqueFamily,
      card?.mechanicId,
      card?.description,
      card?.effectSummary
    ].concat(asArray(card?.tags), asArray(card?.allowedContexts)).filter(Boolean).join(" ");
  }

  function isTrialSubPhaseCard(card) {
    var id = getTrialCardActionId(card);
    var text = getTrialCardText(card);
    if (card?.domainSpecific && card.domainClass === "rule_trial") return true;
    if (["present_evidence", "press_charge", "advance_trial", "rule_pressure", "request_verdict", "defend", "challenge_evidence", "remain_silent", "deny_charge", "delay_trial", "curse_argument", "distort_residue", "curse_pressure", "instinctive_struggle", "curse_fluctuation", "flee_exorcism", "proxy_denial", "object_confiscation", "tool_function_lock", "wielder_liability", "controller_redirect", "summon_suppression"].includes(id)) return true;
    return /rule_trial|rule_defense|trial_owner|trial_defender|审判|辩护|裁定|证据|指控/.test(text);
  }

  function isCursedToolHandCard(card) {
    var text = getTrialCardText(card);
    return /curse_tool|cursed_tool|咒具|释魂刀|天逆|游云|黑绳|万里锁/.test(text);
  }

  function isJujutsuRelatedHandCard(card) {
    var text = getTrialCardText(card);
    if (isTrialSubPhaseCard(card) || isCursedToolHandCard(card)) return false;
    if (["technique", "ce_burst", "domain", "domain_response", "domain_maintenance", "soul_pressure", "rule_trial"].includes(card?.cardType)) return true;
    return /technique|cursed_energy|curse_technique|术式|咒术|咒力|领域|必中|灵魂|式神|反转|苍|赫|茈|御厨子|无下限|十种影|无为转变/.test(text);
  }

  function removeTrialCardsFromHandState(duelBattle, side) {
    var hand = duelBattle?.handState?.[side];
    var domainHand = duelBattle?.domainHandState?.[side];
    var removed = [];
    var restored;
    var seen;
    if (hand && Array.isArray(hand.cards)) {
      restored = Array.isArray(hand.preTrialCards) ? hand.preTrialCards.slice() : [];
      hand.cards = hand.cards.filter(function keepCard(card) {
        if (!isTrialSubPhaseCard(card)) return true;
        removed.push({ actionId: getTrialCardActionId(card), label: card.label || card.name || getTrialCardActionId(card), reason: "trial-ended" });
        return false;
      });
      if (restored.length) {
        seen = new Set(hand.cards.map(getTrialCardActionId).filter(Boolean));
        restored.forEach(function restoreCard(card) {
          var id = getTrialCardActionId(card);
          if (!id || seen.has(id)) return;
          hand.cards.push({ ...(card || {}), handSource: card.handSource || "trial-restored", retained: true });
          seen.add(id);
        });
      }
      delete hand.preTrialCards;
      delete hand.preTrialCardsRound;
      if (removed.length) hand.lastDiscarded = (hand.lastDiscarded || []).concat(removed);
      hand.pendingDiscardCount = 0;
    }
    if (domainHand && Array.isArray(domainHand.cards)) {
      domainHand.cards = domainHand.cards.filter(function keepDomainCard(card) {
        return !isTrialSubPhaseCard(card);
      });
      domainHand.lastRefreshed = domainHand.cards.map(function summarize(card) {
        return { actionId: getTrialCardActionId(card), label: card.label || card.name || getTrialCardActionId(card) };
      });
    }
    if (duelBattle?.selectedHandActions?.[side]) {
      duelBattle.selectedHandActions[side] = duelBattle.selectedHandActions[side].filter(function keepSelected(entry) {
        return !isTrialSubPhaseCard(entry?.action || entry);
      });
    }
    return removed;
  }

  function closeTrialDomainAfterVerdict(duelBattle, subPhase, owner) {
    if (owner?.domain) {
      owner.domain.active = false;
      owner.domain.turnsActive = 0;
    }
    if (duelBattle?.domainProfileStates && subPhase?.owner) delete duelBattle.domainProfileStates[subPhase.owner];
    if (duelBattle && duelBattle.domainProfileState?.ownerSide === subPhase?.owner) duelBattle.domainProfileState = null;
    removeTrialCardsFromHandState(duelBattle, subPhase?.owner);
    removeTrialCardsFromHandState(duelBattle, subPhase?.defender);
  }

  function buildExecutionSwordHandCard(round) {
    return {
      id: "execution_sword",
      actionId: "execution_sword",
      sourceActionId: "execution_sword",
      label: "处刑人之剑",
      name: "处刑人之剑",
      cardType: "technique",
      apCost: 2,
      costCe: 0,
      ceCost: 0,
      baseDamage: 140,
      baseStabilityDamage: 80,
      risk: "critical",
      tags: ["日车", "处刑", "处刑人之剑", "术式", "死刑判决"],
      description: "死刑判决后显现的处刑人之剑。以极高处刑伤害结算，命中判定仍交给本地战斗流程。",
      effectSummary: "死刑判决成立后加入手牌，不会被普通刷新移除。",
      effects: { outgoingScale: 1.45, weightDeltas: { finisher: 2.4, melee: 1.2 } },
      executionSword: true,
      noRefresh: true,
      retainedPermanent: true,
      retained: true,
      handSource: "execution-sword-verdict",
      drawnRound: Number(round || 0),
      source: "deadly-sentencing-verdict",
      status: "CANDIDATE"
    };
  }

  function addExecutionSwordToHand(duelBattle, side) {
    var hand;
    var round;
    if (!duelBattle || !side) return null;
    duelBattle.handState ||= {};
    hand = duelBattle.handState[side] ||= { cards: [], discardPile: [], round: 0, lastDrawn: [], lastInjected: [], lastDiscarded: [], maxHandSize: 8, drawPerTurn: 5 };
    round = Number(duelBattle.round || 0) + 1;
    hand.round = round;
    hand.cards = (hand.cards || []).filter(function removeExisting(card) {
      return getTrialCardActionId(card) !== "execution_sword";
    });
    var card = buildExecutionSwordHandCard(round);
    hand.cards.unshift(card);
    hand.lastInjected = [{ actionId: "execution_sword", label: "处刑人之剑", source: "death-verdict" }];
    hand.pendingDiscardCount = 0;
    hand.overflowDiscardRequired = false;
    if (side === "left") {
      duelBattle.handCandidates = [card].concat(duelBattle.handCandidates || []).filter(function keepUnique(candidate, index, list) {
        var id = getTrialCardActionId(candidate);
        return id && list.findIndex(function firstMatch(item) { return getTrialCardActionId(item) === id; }) === index;
      });
      delete duelBattle.handCandidateCache;
    }
    return card;
  }

  function confiscateVerdictHandCards(duelBattle, defenderSide) {
    var hand = duelBattle?.handState?.[defenderSide];
    var removed = [];
    var targetKind = "none";
    if (!hand || !Array.isArray(hand.cards)) return { removed: removed, targetKind: targetKind };
    var sourceCards = Array.isArray(hand.preTrialCards) ? hand.preTrialCards : hand.cards;
    var hasCursedTool = sourceCards.some(isCursedToolHandCard);
    var predicate = hasCursedTool ? isCursedToolHandCard : isJujutsuRelatedHandCard;
    targetKind = hasCursedTool ? "cursed_tool" : "jujutsu";
    sourceCards = sourceCards.filter(function keepCard(card) {
      if (!predicate(card)) return true;
      removed.push({ actionId: getTrialCardActionId(card), label: card.label || card.name || getTrialCardActionId(card), reason: targetKind + "-confiscated" });
      return false;
    });
    if (Array.isArray(hand.preTrialCards)) hand.preTrialCards = sourceCards;
    else hand.cards = sourceCards;
    hand.lastDiscarded = removed.slice();
    hand.discardPile = (hand.discardPile || []).concat(removed);
    if (duelBattle?.selectedHandActions?.[defenderSide]) {
      var removedIds = new Set(removed.map(function getRemovedId(item) { return item.actionId; }).filter(Boolean));
      duelBattle.selectedHandActions[defenderSide] = duelBattle.selectedHandActions[defenderSide].filter(function keepSelected(entry) {
        return !removedIds.has(getTrialCardActionId(entry?.action || entry));
      });
    }
    return { removed: removed, targetKind: targetKind };
  }

  function resolveDuelTrialVerdict(action, actor, opponent, battle, before) {
    var duelBattle = getCurrentBattle(battle);
    var subPhase = duelBattle?.domainSubPhase;
    var previous = before || {};
    var owner;
    var defender;
    var eligibility;
    var vocabulary;
    var pressure;
    var selfIncriminationScale;
    var targetPressureScale;
    var adjustedPressure;
    var insufficientVerdict;
    var verdict;
    var detail;
    var verdictKey;
    var confiscationResult;
    var executionSwordCard;
    if (!subPhase) return null;
    owner = getResourcePair(duelBattle, subPhase.owner);
    defender = getResourcePair(duelBattle, subPhase.defender);
    eligibility = normalizeDuelTrialEligibility(subPhase.trialEligibility, "partial");
    vocabulary = subPhase.verdictVocabulary || "legal";
    pressure = Number(subPhase.evidencePressure || 0) - Number(subPhase.defensePressure || 0) * 0.45;
    selfIncriminationScale = subPhase.hasSelfAwareness === false ? 0.12 : 0.35;
    targetPressureScale = { full: 1, partial: 0.92, exorcism_ruling: 0.88, redirect_to_controller: 0.82, object_confiscation: 0.78 }[eligibility] ?? 0.9;
    adjustedPressure = (pressure + Number(subPhase.heavyVerdictRisk || 0) * 0.6 - Number(subPhase.selfIncriminationRisk || 0) * selfIncriminationScale) * targetPressureScale;
    insufficientVerdict = getDuelTrialVerdictLabel(subPhase, "insufficient", "证据不足");
    verdict = getDuelTrialVerdictLabel(subPhase, "insufficient", "证据不足");
    detail = "证据压力不足，判决未形成实质惩罚。";
    verdictKey = "insufficient";
    if (eligibility !== "object_confiscation" && adjustedPressure >= 6.2) {
      verdictKey = "execution";
      verdict = getDuelTrialVerdictLabel(subPhase, "execution", "处刑状态候选");
      if (vocabulary === "exorcism") {
        detail = "残秽证据和咒力罪证极高，" + verdict + "成立；这不是自动死刑，只生成祓除压力候选。";
        addOrRefreshDuelStatusEffect(owner, { id: "executionStateCandidate", label: verdict, rounds: 3, value: 0.85 });
        addOrRefreshDuelStatusEffect(defender, { id: "exorcismOrderCandidate", label: "祓除令候选", rounds: 2, value: 1 });
        addOrRefreshDuelStatusEffect(defender, { id: "curseTechniqueBound", label: "咒力枷锁", rounds: 2, value: 1 });
      } else if (vocabulary === "controller") {
        detail = "审判压力指向操控链，" + verdict + "成立；式神不作为完整被告，效果转为召唤链压制。";
        addOrRefreshDuelStatusEffect(defender, { id: "controllerRedirectPressure", label: "操控链压力", rounds: 2, value: 1 });
        addOrRefreshDuelStatusEffect(defender, { id: "summonSuppressed", label: "召唤压制", rounds: 2, value: 1 });
      } else if (vocabulary === "incarnated") {
        detail = "受肉体证据压力极高，死刑判决成立；日车获得处刑人之剑手札。";
        addOrRefreshDuelStatusEffect(owner, { id: "executionStateCandidate", label: verdict, rounds: 3, value: 1 });
        addOrRefreshDuelStatusEffect(defender, { id: "incarnatedSuppressed", label: "受肉意识压制", rounds: 2, value: 1 });
        addOrRefreshDuelStatusEffect(defender, { id: "defenseShakenByVerdict", label: "判决动摇", rounds: 2, value: 1 });
      } else {
        detail = "证据压力极高，死刑判决成立；日车获得处刑人之剑手札。";
        addOrRefreshDuelStatusEffect(owner, { id: "executionStateCandidate", label: verdict, rounds: 3, value: 1 });
        addOrRefreshDuelStatusEffect(defender, { id: "defenseShakenByVerdict", label: "判决动摇", rounds: 2, value: 1 });
      }
    } else if (adjustedPressure >= 4.4) {
      verdictKey = "confiscation";
      verdict = getDuelTrialVerdictLabel(subPhase, "confiscation", "没收");
      if (vocabulary === "object" || eligibility === "object_confiscation") {
        detail = verdict + "成立，目标不作为被告，转为咒具没收/功能封锁判定。";
        addOrRefreshDuelStatusEffect(defender, { id: "cursedToolConfiscated", label: "咒具没收候选", rounds: 3, value: 1 });
        addOrRefreshDuelStatusEffect(defender, { id: "toolFunctionLocked", label: "咒具功能封锁", rounds: 2, value: 1 });
      } else if (vocabulary === "controller" || eligibility === "redirect_to_controller") {
        detail = verdict + "成立，目标不作为完整被告，审判压力转向操控者或召唤链。";
        addOrRefreshDuelStatusEffect(defender, { id: "controllerRedirectPressure", label: "操控链压力", rounds: 2, value: 1 });
        addOrRefreshDuelStatusEffect(defender, { id: "summonSuppressed", label: "召唤压制", rounds: 2, value: 1 });
      } else if (vocabulary === "exorcism") {
        detail = verdict + "成立，目标咒力流动被审判规则束缚。";
        addOrRefreshDuelStatusEffect(defender, { id: "curseTechniqueBound", label: "咒力枷锁", rounds: 3, value: 1 });
        addOrRefreshDuelStatusEffect(defender, { id: "trialRulePressure", label: "祓除压力", rounds: 2, value: 1 });
      } else if (vocabulary === "incarnated") {
        detail = verdict + "成立，术式与咒物意识稳定受到压制。";
        addOrRefreshDuelStatusEffect(defender, { id: "techniqueConfiscated", label: "术式没收候选", rounds: 3, value: 1 });
        addOrRefreshDuelStatusEffect(defender, { id: "incarnatedSuppressed", label: "受肉意识压制", rounds: 2, value: 1 });
      } else {
        detail = "判决倾向" + verdict + "，对手术式手法被压制数回合。";
        addOrRefreshDuelStatusEffect(defender, { id: "techniqueConfiscated", label: verdict, rounds: 3, value: 1 });
      }
      confiscationResult = confiscateVerdictHandCards(duelBattle, subPhase.defender);
      detail += " 手牌没收：" + (confiscationResult.targetKind === "cursed_tool" ? "检测到咒具标签，没收所有咒具手札" : "未检测到咒具标签，没收所有咒术相关手札") + "，共 " + formatNumberValue(confiscationResult.removed.length) + " 张。";
    } else if (adjustedPressure >= 2.3) {
      verdictKey = "light";
      verdict = getDuelTrialVerdictLabel(subPhase, "light", "轻判");
      if (vocabulary === "object" || eligibility === "object_confiscation") {
        detail = verdict + "形成，咒具功能被短暂标记和降权。";
        addOrRefreshDuelStatusEffect(defender, { id: "toolFunctionLocked", label: "咒具功能封锁", rounds: 1, value: 1 });
      } else if (vocabulary === "controller" || eligibility === "redirect_to_controller") {
        detail = verdict + "形成，式神不作为完整被告，召唤质量下降。";
        addOrRefreshDuelStatusEffect(defender, { id: "summonSuppressed", label: "召唤压制", rounds: 1, value: 1 });
      } else if (vocabulary === "exorcism") {
        detail = verdict + "形成，目标咒力流动被规则压制。";
        addOrRefreshDuelStatusEffect(defender, { id: "trialRulePressure", label: "祓除压力", rounds: 1, value: 1 });
        addOrRefreshDuelStatusEffect(defender, { id: "techniqueImbalance", label: "术式失衡", rounds: 1, value: 0.7 });
      } else if (vocabulary === "incarnated") {
        detail = verdict + "形成，受肉稳定下降并伴随术式失衡。";
        addOrRefreshDuelStatusEffect(defender, { id: "incarnatedStabilityDown", label: "受肉稳定下降", rounds: 2, value: 1 });
        addOrRefreshDuelStatusEffect(defender, { id: "techniqueImbalance", label: "术式失衡", rounds: 2, value: 1 });
      } else {
        detail = "判决形成" + verdict + "，对手进入短暂术式失衡。";
        addOrRefreshDuelStatusEffect(defender, { id: "techniqueImbalance", label: "术式失衡", rounds: 2, value: 1 });
      }
    } else {
      if (owner?.domain) owner.domain.load += 6;
      if (owner) owner.stability = Number(clampValue(Number(owner.stability || 0) - 0.02, 0, 1).toFixed(4));
    }
    if (owner?.domain && verdict !== insufficientVerdict) owner.domain.load += 4;
    subPhase.verdictReady = true;
    subPhase.verdictResolved = true;
    subPhase.violenceRestricted = false;
    subPhase.verdict = verdict;
    subPhase.verdictKey = verdictKey;
    subPhase.trialEndReason = "verdictResolved";
    subPhase.trialStatus = "resolved";
    updateDuelDomainTrialContext(duelBattle, { trialStatus: "resolved", trialEndReason: "verdictResolved", verdict: verdict, verdictKey: verdictKey });
    closeTrialDomainAfterVerdict(duelBattle, subPhase, owner);
    if (verdictKey === "execution") {
      executionSwordCard = addExecutionSwordToHand(duelBattle, subPhase.owner);
      if (executionSwordCard) detail += " 处刑人之剑已直接加入日车手牌，并标记为不会被普通刷新移除。";
    }
    invalidateActionChoices(duelBattle);
    clampResource(owner);
    clampResource(defender);
    appendDomainProfileLog(duelBattle, {
      side: subPhase.owner,
      title: "裁定结果：" + verdict,
      type: vocabulary === "exorcism" ? "exorcismRuling" : (vocabulary === "object" ? "objectConfiscation" : (vocabulary === "controller" ? "controllerRedirect" : "verdict")),
      detail: subPhase.domainName + "结算：" + detail + " 审判对象：" + getDuelTrialTargetLabel(subPhase.trialSubjectType || "unknown") + "，裁定类型：" + getDuelTrialEligibilityLabel(eligibility) + "，判决语义：" + vocabulary + "，法律主体 " + (subPhase.hasLegalAgency ? "yes" : "no") + "，自我意识 " + (subPhase.hasSelfAwareness ? "yes" : "no") + "。证据压力 " + formatNumberValue(subPhase.evidencePressure) + "，辩护压力 " + formatNumberValue(subPhase.defensePressure) + "，重判风险 " + formatNumberValue(subPhase.heavyVerdictRisk || 0) + "。审判子阶段结束，战斗回到普通流程。"
    });
    return {
      trial: {
        evidencePressure: Number((subPhase.evidencePressure - Number(previous.evidencePressure || 0)).toFixed(1)),
        defensePressure: Number((subPhase.defensePressure - Number(previous.defensePressure || 0)).toFixed(1)),
        verdict: verdict,
        verdictKey: verdictKey,
        trialSubjectType: subPhase.trialSubjectType || "unknown",
        trialEligibility: eligibility,
        verdictVocabulary: vocabulary,
        verdictResolved: true
      }
    };
  }

  function getExpectedExports() {
    return expectedExports.slice();
  }

  function getExpectedDependencies() {
    return expectedDependencies.slice();
  }

  function get(name) {
    assertExpectedExport(name);
    return bindings[name] || ownedExports[name];
  }

  function getBinding(name) {
    return get(name);
  }

  function hasBinding(name) {
    if (typeof name === "undefined") return expectedExports.every(function hasExpected(exportName) {
      return typeof get(exportName) === "function";
    });
    return isExpectedExport(name) && typeof get(name) === "function";
  }

  function hasDependency(name) {
    return isExpectedDependency(name) && Boolean(getOptionalDependency(name));
  }

  function listBindings() {
    return expectedExports.reduce(function buildSnapshot(snapshot, name) {
      snapshot[name] = typeof get(name) === "function";
      return snapshot;
    }, {});
  }

  function listDependencies() {
    return expectedDependencies.reduce(function buildSnapshot(snapshot, name) {
      snapshot[name] = Boolean(getOptionalDependency(name));
      return snapshot;
    }, {});
  }

  function missingDependencies() {
    return expectedDependencies.filter(function missing(name) {
      return !getOptionalDependency(name);
    });
  }

  function clearBindings() {
    expectedExports.forEach(function clearName(name) {
      delete bindings[name];
    });
    return api;
  }

  function clearDependencies() {
    expectedDependencies.forEach(function clearName(name) {
      delete dependencies[name];
    });
    return api;
  }

  function useOwnedImplementations() {
    clearBindings();
    return api;
  }

  function getMetadata() {
    return {
      name: namespace,
      namespace: namespace,
      version: version,
      layer: "duel-rule-subphase",
      moduleFormat: "classic-script-iife",
      scriptType: "classic",
      behavior: "owned-implementation",
      ownsBehavior: true,
      implementationAvailable: true,
      dependencyContract: "registerDependencies",
      registerBehavior: "dependencies-and-optional-overrides",
      expectedExports: expectedExports.slice(),
      expectedDependencies: expectedDependencies.slice(),
      boundExports: Object.keys(bindings),
      boundDependencies: Object.keys(dependencies)
    };
  }

  var ownedExports = {
    getDuelTrialTargetRules: getDuelTrialTargetRules,
    normalizeDuelTrialEligibility: normalizeDuelTrialEligibility,
    getDuelTrialTargetRuleClassId: getDuelTrialTargetRuleClassId,
    getDuelTrialTargetRuleProfile: getDuelTrialTargetRuleProfile,
    getDuelTrialTargetLabel: getDuelTrialTargetLabel,
    getDuelTrialEligibilityLabel: getDuelTrialEligibilityLabel,
    getDuelTrialPhaseLabel: getDuelTrialPhaseLabel,
    normalizeDuelTrialSubjectType: normalizeDuelTrialSubjectType,
    inferDuelTrialSubjectType: inferDuelTrialSubjectType,
    normalizeDuelTrialEligibilityOverride: normalizeDuelTrialEligibilityOverride,
    buildDuelTrialTargetProfile: buildDuelTrialTargetProfile,
    isDuelTrialSubjectEligible: isDuelTrialSubjectEligible,
    getDuelTrialVerdictLabel: getDuelTrialVerdictLabel,
    getDuelTrialStatusLabel: getDuelTrialStatusLabel,
    getDuelTrialEndReasonLabel: getDuelTrialEndReasonLabel,
    buildDuelDomainTrialContext: buildDuelDomainTrialContext,
    updateDuelDomainTrialContext: updateDuelDomainTrialContext,
    getDuelActiveTrialContext: getDuelActiveTrialContext,
    syncDuelTrialSubPhaseLifecycle: syncDuelTrialSubPhaseLifecycle,
    getDuelTrialTargetChoiceTemplates: getDuelTrialTargetChoiceTemplates,
    getDuelTrialOwnerActionTemplates: getDuelTrialOwnerActionTemplates,
    getDuelTrialDefenderActionTemplates: getDuelTrialDefenderActionTemplates,
    getDuelJackpotActionTemplates: getDuelJackpotActionTemplates,
    createDuelTrialSubPhase: createDuelTrialSubPhase,
    updateDuelTrialVerdictState: updateDuelTrialVerdictState,
    applyDuelTrialAction: applyDuelTrialAction,
    resolveDuelTrialVerdict: resolveDuelTrialVerdict,
    createDuelJackpotSubPhase: createDuelJackpotSubPhase,
    updateDuelJackpotState: updateDuelJackpotState,
    applyDuelJackpotAction: applyDuelJackpotAction,
    resolveDuelJackpot: resolveDuelJackpot
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
    getDuelTrialTargetRules: getDuelTrialTargetRules,
    normalizeDuelTrialEligibility: normalizeDuelTrialEligibility,
    getDuelTrialTargetRuleClassId: getDuelTrialTargetRuleClassId,
    getDuelTrialTargetRuleProfile: getDuelTrialTargetRuleProfile,
    getDuelTrialTargetLabel: getDuelTrialTargetLabel,
    getDuelTrialEligibilityLabel: getDuelTrialEligibilityLabel,
    getDuelTrialPhaseLabel: getDuelTrialPhaseLabel,
    normalizeDuelTrialSubjectType: normalizeDuelTrialSubjectType,
    inferDuelTrialSubjectType: inferDuelTrialSubjectType,
    normalizeDuelTrialEligibilityOverride: normalizeDuelTrialEligibilityOverride,
    buildDuelTrialTargetProfile: buildDuelTrialTargetProfile,
    isDuelTrialSubjectEligible: isDuelTrialSubjectEligible,
    getDuelTrialVerdictLabel: getDuelTrialVerdictLabel,
    getDuelTrialStatusLabel: getDuelTrialStatusLabel,
    getDuelTrialEndReasonLabel: getDuelTrialEndReasonLabel,
    buildDuelDomainTrialContext: buildDuelDomainTrialContext,
    updateDuelDomainTrialContext: updateDuelDomainTrialContext,
    getDuelActiveTrialContext: getDuelActiveTrialContext,
    syncDuelTrialSubPhaseLifecycle: syncDuelTrialSubPhaseLifecycle,
    getDuelTrialTargetChoiceTemplates: getDuelTrialTargetChoiceTemplates,
    getDuelTrialOwnerActionTemplates: getDuelTrialOwnerActionTemplates,
    getDuelTrialDefenderActionTemplates: getDuelTrialDefenderActionTemplates,
    getDuelJackpotActionTemplates: getDuelJackpotActionTemplates,
    createDuelTrialSubPhase: createDuelTrialSubPhase,
    updateDuelTrialVerdictState: updateDuelTrialVerdictState,
    applyDuelTrialAction: applyDuelTrialAction,
    resolveDuelTrialVerdict: resolveDuelTrialVerdict,
    createDuelJackpotSubPhase: createDuelJackpotSubPhase,
    updateDuelJackpotState: updateDuelJackpotState,
    applyDuelJackpotAction: applyDuelJackpotAction,
    resolveDuelJackpot: resolveDuelJackpot
  };

  useOwnedImplementations();
  global[namespace] = api;
})(globalThis);
