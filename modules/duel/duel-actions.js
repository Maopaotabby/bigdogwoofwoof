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
  var FEATURE_TECHNIQUE_ALIASES = Object.freeze({
    ten_shadows: ["十种影法术", "十影", "伏黑惠", "伏黑", "嵌合暗翳庭", "shikigami"],
    limitless: ["无下限术式", "无下限", "六眼", "五条悟", "五条", "无量空处", "limitless"],
    blood_manipulation: ["赤血操术", "胀相", "加茂宪纪", "虎杖悠仁", "blood"],
    curse_spirit_manipulation: ["咒灵操术", "夏油杰", "夏油", "羂索", "咒灵群"],
    idle_transfiguration: ["无为转变", "真人", "自闭圆顿裹", "灵魂"],
    ratio_technique: ["十划咒法", "七海建人", "七海", "七三"],
    cursed_speech: ["咒言", "狗卷棘", "狗卷"],
    boogie_woogie: ["不义游戏", "东堂葵", "东堂"],
    black_bird_manipulation: ["黑鸟操术", "冥冥"],
    projection_sorcery: ["投射咒法", "禅院直哉", "直哉", "直毘人", "时胞月宫殿"],
    construction: ["构筑术式", "万", "真依", "真球", "三重疾苦"],
    straw_doll_technique: ["刍灵咒法", "钉崎野蔷薇", "钉崎", "共鸣"],
    star_rage: ["星之怒", "九十九由基", "九十九", "凰轮"],
    ice_formation: ["冰凝咒法", "里梅"],
    disaster_flames: ["漏瑚", "盖棺铁围山", "火山", "熔灾"],
    disaster_plants: ["花御", "朶颐光海", "咒植"],
    disaster_tides: ["陀艮", "荡蕴平线", "潮灾"],
    idle_death_gamble: ["赌运显法", "秤金次", "秤", "坐杀搏徒", "jackpot"],
    comedian: ["超人", "高羽史彦", "高羽"],
    copy: ["模仿", "乙骨忧太", "乙骨", "里香", "真赝相爱"],
    sky_manipulation: ["天空术式", "乌鹭亨子", "乌鹭"],
    granite_blast: ["龙髓炮", "石流龙", "石流", "咒力大炮", "花岗岩"],
    anti_gravity_system: ["反重力机构", "羂索", "虎杖香织", "重力"],
    mythical_beast_amber: ["幻兽琥珀", "鹿紫云一", "鹿紫云"],
    kashimo_mythical_beast: ["幻兽琥珀", "鹿紫云一", "鹿紫云"],
    shrine: ["御厨子", "伏魔御厨子", "两面宿傩", "宿傩", "虎杖悠仁", "解", "捌", "斩击"],
    embodied_killing_intent_light: ["光", "具象化杀意", "达布拉", "达布拉卡拉巴"],
    chaos_and_harmony: ["混沌与调和", "玛鲁", "马鲁", "克罗斯"],
    prayer_song: ["祈祷之歌", "米格尔", "黑绳"],
    moon_dregs: ["淀月", "吉野顺平", "顺平"],
    auspicious_beasts: ["来访瑞兽", "猪野琢真", "猪野"],
    manga_artist: ["漫画家", "查理", "贝尔纳"]
  });
  var RCT_CHARACTER_IDS = new Set([
    "gojo_satoru_shinjuku",
    "sukuna_heian_or_shinjuku",
    "yuta_okkotsu_volume0_true_rika",
    "yuta_okkotsu_shinjuku",
    "shoko_ieiri_support_candidate",
    "kenjaku_geto_body",
    "yuki_tsukumo_culling",
    "yuji_itadori_shinjuku",
    "yuji_itadori_after68",
    "higuruma_hiromi_culling",
    "hazel"
  ]);
  var RCT_OUTPUT_CHARACTER_IDS = new Set([
    "sukuna_heian_or_shinjuku",
    "yuta_okkotsu_volume0_true_rika",
    "yuta_okkotsu_shinjuku",
    "shoko_ieiri_support_candidate"
  ]);

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
    if (requirements.requiresMissingHp && actor.maxHp && Number(actor.hp || 0) >= Number(actor.maxHp || 0) - 0.5) {
      return { available: false, reason: "当前没有需要反转治疗的伤势", costCe: costCe };
    }
    if (requirements.domainActive === true && !actor.domain?.active) return { available: false, reason: "当前未展开领域", costCe: costCe };
    if (requirements.domainActive === false && actor.domain?.active) return { available: false, reason: "领域已展开", costCe: costCe };
    if (requirements.requiresDomainAccess && !domainResponse.canExpandDomain) return { available: false, reason: "当前角色不具备领域条件", costCe: costCe };
    if (requirements.opponentDomainActive && !isDuelOpponentDomainThreat(opponent, actor, battle)) {
      if (!getDomainResponseActionIds().has(action.id)) return { available: false, reason: "对方未展开领域", costCe: costCe };
    }
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
      (action.requiresInnateTechnique || action.techniqueFeatureHand || ["technique_interference", "forced_output", "domain_expand", "domain_force_sustain"].includes(action.id))) {
      return { available: false, reason: "术式被没收或烧断中", costCe: costCe };
    }
    if ((getDuelStatusEffectValue(actor, "cursedToolConfiscated") > 0 || getDuelStatusEffectValue(actor, "toolFunctionLocked") > 0) &&
      ["forced_output", "ce_reinforcement"].includes(action.id)) {
      return { available: false, reason: "咒具没收/封锁候选生效", costCe: costCe };
    }
    return { available: true, reason: "", costCe: costCe };
  }

  function toFeatureList(value) {
    if (Array.isArray(value)) return value.filter(function keepValue(item) { return item !== undefined && item !== null && item !== ""; });
    if (value === undefined || value === null || value === "") return [];
    return [value];
  }

  function uniqueFeatureList(values) {
    var seen = new Set();
    var output = [];
    (values || []).forEach(function addValue(value) {
      var text = String(value || "").trim();
      if (!text || seen.has(text)) return;
      seen.add(text);
      output.push(text);
    });
    return output;
  }

  function normalizeFeatureText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[\s"'`.,，。；;：:、/／\\|!?！？()（）\[\]【】{}《》<>·・_\-—~]+/g, "");
  }

  function getTechniqueFeatureHandCards() {
    var appState = getOptionalDependency("state");
    var source = appState?.techniqueFeatureHandCandidates;
    var cards = Array.isArray(source?.draftCards) ? source.draftCards : (Array.isArray(source) ? source : []);
    return cards.filter(function keepFeatureCard(card) {
      return card?.importableFromMergedPackage !== false &&
        card?.reviewStatus !== "needs_merge" &&
        card?.duplicateStatus !== "exact_duplicate" &&
        card?.draftRole !== "conflict_only";
    });
  }

  function pushFeatureTextParts(parts, source) {
    if (!source || typeof source !== "object") return;
    [
      "id",
      "characterId",
      "profileId",
      "name",
      "displayName",
      "stage",
      "technique",
      "techniqueName",
      "techniqueText",
      "techniqueDescription",
      "domainProfile",
      "notes",
      "sourceLayer",
      "officialGrade",
      "visibleGrade",
      "powerTier",
      "externalResource"
    ].forEach(function pushField(field) {
      if (source[field]) parts.push(source[field]);
    });
    if (source.domainScript) {
      parts.push(source.domainScript.id, source.domainScript.domainName, source.domainScript.effectSummary, source.domainScript.scriptType);
      parts.push(...toFeatureList(source.domainScript.effectTags));
    }
    [
      "traits",
      "innateTraits",
      "advancedTechniques",
      "loadout",
      "flags",
      "specialHandTags",
      "techniqueFamilies",
      "archetypes"
    ].forEach(function pushList(field) {
      parts.push(...toFeatureList(source[field]));
    });
  }

  function getActorFeatureSnapshot(actor, battle) {
    var appState = getOptionalDependency("state");
    var actorId = actor?.profileId || actor?.characterId || actor?.id || "";
    var profile = getDuelProfileForSide(battle, actor?.side || "") || actor?.characterCardProfile || actor?.profile || {};
    var customCard = Array.isArray(appState?.customDuelCards)
      ? appState.customDuelCards.find(function findCustomCard(card) {
        return card?.characterId === actorId || card?.id === actorId;
      })
      : null;
    var handProfile = null;
    try {
      var handProfileGetter = global.JJKDuelHand?.get?.("buildDuelCharacterCardProfile");
      if (typeof handProfileGetter === "function") handProfile = handProfileGetter(actor) || null;
    } catch (error) {
      handProfile = null;
    }
    var parts = [];
    pushFeatureTextParts(parts, actor);
    pushFeatureTextParts(parts, actor?.profile);
    pushFeatureTextParts(parts, actor?.characterCardProfile);
    pushFeatureTextParts(parts, profile);
    pushFeatureTextParts(parts, handProfile);
    pushFeatureTextParts(parts, customCard);
    var ids = uniqueFeatureList([
      actorId,
      actor?.characterId,
      actor?.profileId,
      actor?.id,
      actor?.name,
      actor?.displayName,
      actor?.profile?.characterId,
      actor?.profile?.id,
      actor?.profile?.displayName,
      profile?.characterId,
      profile?.id,
      profile?.displayName,
      handProfile?.characterId,
      handProfile?.ruleId,
      handProfile?.displayName,
      customCard?.characterId,
      customCard?.id,
      customCard?.displayName
    ]);
    var rawText = uniqueFeatureList(parts).join(" ");
    return {
      ids: ids,
      text: rawText,
      normalizedText: normalizeFeatureText(rawText),
      hasInnateTechnique: handProfile?.hasInnateTechnique !== false && !/零咒力|无术式|no_innate_technique/i.test(rawText)
    };
  }

  function splitFeatureOwnerAliases(value) {
    return uniqueFeatureList(String(value || "")
      .split(/[;；、,/／|和与及]+/g)
      .map(function trimAlias(alias) { return alias.replace(/后也使用|继承使用|占据.*后使用|夺取.*后也使用/g, "").trim(); })
      .filter(Boolean));
  }

  function getFeatureCardAliases(card) {
    var configuredAliases = toFeatureList(FEATURE_TECHNIQUE_ALIASES[card?.techniqueId]);
    var techniqueNameAliases = toFeatureList(card?.techniqueName).filter(function keepTechniqueNameAlias(alias) {
      return normalizeFeatureText(alias).length >= 3 || configuredAliases.includes(alias);
    });
    return uniqueFeatureList([]
      .concat(toFeatureList(card?.techniqueId))
      .concat(techniqueNameAliases)
      .concat(toFeatureList(card?.domainName))
      .concat(splitFeatureOwnerAliases(card?.ownerOrRepresentative))
      .concat(configuredAliases));
  }

  function isFeatureAliasMatch(snapshot, alias) {
    var normalized = normalizeFeatureText(alias);
    if (!normalized) return false;
    var isAscii = /^[a-z0-9]+$/i.test(normalized);
    if (isAscii && normalized.length < 4) return false;
    if (!isAscii && normalized.length < 2 && !["万"].includes(alias)) return false;
    return snapshot.normalizedText.includes(normalized);
  }

  function doesFeatureCardMatchActor(card, snapshot) {
    if (!snapshot?.normalizedText || snapshot.hasInnateTechnique === false) return false;
    if (snapshot.ids.some(function hasDirectTechnique(id) { return normalizeFeatureText(id) === normalizeFeatureText(card?.techniqueId); })) return true;
    return getFeatureCardAliases(card).some(function hasAlias(alias) {
      return isFeatureAliasMatch(snapshot, alias);
    });
  }

  function mapFeatureCardType(intent) {
    var key = String(intent || "").toLowerCase();
    if (key === "defense") return "defense";
    if (key === "resource") return "resource";
    if (key === "support") return "support";
    if (key === "mobility") return "technique";
    if (key === "summon") return "technique";
    if (key === "soul") return "technique";
    if (key === "control" || key === "rule" || key === "domain") return "technique";
    return "technique";
  }

  function mapFeatureScalingProfile(card, stats) {
    var text = [
      card?.scalingProfile,
      card?.cardIntent,
      card?.mechanicSubtype,
      card?.futureCardType,
      card?.techniqueId,
      card?.techniqueName
    ].concat(toFeatureList(card?.mechanicTags)).join(" ").toLowerCase();
    if (/咒具|cursed_tool|tool/.test(text)) return "cursed_tool";
    if (/体术|physical|melee|strike/.test(text)) return "physical";
    if (/防御|defense|guard|block/.test(text)) return "defense";
    if (/jackpot|赌|坐杀|概率|中奖/.test(text)) return "jackpot_rule";
    if (/审判|trial|verdict|evidence/.test(text)) return "trial_rule";
    if (/领域|domain|barrier/.test(text) && Number(stats?.baseDamage || 0) <= 0) return "domain";
    if (/burst|最大输出|炮|blast/.test(text)) return "ce_burst";
    return "technique";
  }

  function addFeatureNumericDelta(effects, key, delta) {
    var value = Number(delta || 0);
    if (!Number.isFinite(value) || value === 0) return;
    effects[key] = Number((Number(effects[key] || 0) + value).toFixed(4));
  }

  function buildFeatureCardEffects(card, stats) {
    var effects = { ...(stats?.proposedEffectFields || {}) };
    var baseBlock = Number(stats?.baseBlock || 0);
    var controlValue = Number(stats?.controlValue || 0);
    var soulDamage = Number(stats?.soulDamage || 0);
    var domainLoadDelta = Number(stats?.domainLoadDelta || 0);
    var durationRounds = Math.max(0, Number(stats?.durationRounds || 0));
    if (baseBlock > 0) {
      effects.incomingHpScale = Math.min(
        Number(effects.incomingHpScale || 1),
        Number(clamp(1 - baseBlock / 120, 0.62, 0.94).toFixed(4))
      );
      addFeatureNumericDelta(effects, "stabilityDelta", clamp(baseBlock / 950, 0.012, 0.052));
    }
    if (controlValue > 0) {
      addFeatureNumericDelta(effects, "opponentStabilityDelta", -clamp(controlValue / 950, 0.008, 0.072));
      effects.opponentStatuses ||= [];
      effects.opponentStatuses.push({
        id: "featureControlPressure",
        label: "特色术式压制",
        rounds: Math.max(1, durationRounds || 1),
        value: controlValue
      });
    }
    if (soulDamage > 0) {
      effects.opponentStatuses ||= [];
      effects.opponentStatuses.push({
        id: "soulPressure",
        label: "灵魂受扰",
        rounds: Math.max(1, durationRounds || 1),
        value: soulDamage
      });
    }
    if (domainLoadDelta) addFeatureNumericDelta(effects, "domainLoadDelta", domainLoadDelta);
    if (durationRounds > 0 && !effects.durationRounds) effects.durationRounds = durationRounds;
    if (!effects.weightDeltas && (card?.cardIntent === "resource" || card?.cardIntent === "support")) {
      effects.weightDeltas = { ce_compression: 0.35, defensive_frame: 0.2 };
    }
    return effects;
  }

  function toFeatureNumber(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : Number(fallback || 0);
  }

  function buildTechniqueFeatureHandAction(card, actor, snapshot) {
    var stats = card?.balancedRuntimeStats || card?.originalCandidateRuntimeStats || {};
    var sourceActionId = card?.sourceActionId || card?.draftCardId || ("feature_" + card?.techniqueId + "_" + card?.cardName);
    var baseDamage = toFeatureNumber(stats.baseDamage, 0);
    var baseBlock = toFeatureNumber(stats.baseBlock, 0);
    var controlValue = toFeatureNumber(stats.controlValue, 0);
    var soulDamage = toFeatureNumber(stats.soulDamage, 0);
    var tags = uniqueFeatureList([
      "特色手札",
      "术式",
      "technique_feature",
      card?.techniqueId,
      card?.techniqueName,
      card?.cardIntent,
      card?.mechanicSubtype
    ].concat(toFeatureList(card?.mechanicTags)));
    if (card?.soulRelated || soulDamage > 0) tags.push("灵魂");
    if (card?.summonRelated) tags.push("式神");
    if (card?.antiDomainRelated) tags.push("领域应对");
    var action = {
      id: sourceActionId,
      sourceActionId: sourceActionId,
      label: card?.cardName || sourceActionId,
      description: card?.shortEffect || card?.effectDraft || card?.longEffect || "按特色术式手札规则结算。",
      cardType: mapFeatureCardType(card?.cardIntent),
      type: "feature_technique",
      techniqueFeatureHand: true,
      normalHandOnly: true,
      draftCardId: card?.draftCardId || "",
      sourceTechniqueFamily: card?.techniqueId || "",
      techniqueName: card?.techniqueName || "",
      ownerOrRepresentative: card?.ownerOrRepresentative || "",
      tags: tags,
      specialHandTags: [],
      exclusiveToCharacters: snapshot?.ids || [],
      requiresCe: true,
      requiresInnateTechnique: true,
      requirements: {
        domainActive: "any",
        blocksOnTechniqueImbalance: true
      },
      apCost: Math.max(1, toFeatureNumber(stats.apCost, 1)),
      baseCeCost: Math.max(0, toFeatureNumber(stats.baseCeCost, 0)),
      baseDamage: Math.max(0, baseDamage),
      baseBlock: Math.max(0, baseBlock),
      baseStabilityDamage: controlValue > 0 ? Math.max(1, Math.round(controlValue * 0.55)) : 0,
      baseCeDamage: soulDamage > 0 ? Math.max(1, Math.round(soulDamage * 0.35)) : 0,
      baseDomainLoadDelta: toFeatureNumber(stats.domainLoadDelta, 0),
      durationRounds: Math.max(0, toFeatureNumber(stats.durationRounds, 0)),
      scalingProfile: mapFeatureScalingProfile(card, stats),
      accuracyProfile: stats.accuracyProfile || (baseDamage > 0 ? "technique_projectile" : "none"),
      evasionAllowed: stats.evasionAllowed !== false && baseDamage > 0,
      hitRateModifier: toFeatureNumber(stats.hitRateModifier, 0),
      effects: buildFeatureCardEffects(card, stats),
      risk: card?.riskTags?.includes("high") || card?.powerHint === "extreme" ? "high" : (card?.suggestedRarity === "rare" ? "medium" : "low"),
      rarity: card?.suggestedRarity || "uncommon",
      weight: Number(card?.cardIntent === "finisher" ? 4.5 : 5.25),
      selectionWeight: Number(card?.cardIntent === "finisher" ? 5.1 : 5.8),
      characterHints: getFeatureCardAliases(card),
      effectSummary: card?.shortEffect || card?.effectDraft || "",
      status: "CANDIDATE_RUNTIME_IMPORT"
    };
    if (card?.cardIntent === "finisher") action.risk = action.risk === "high" ? "critical" : "high";
    return action;
  }

  function buildTechniqueFeatureHandActions(actor, opponent, duelState) {
    var battle = getBattle(duelState);
    var snapshot = getActorFeatureSnapshot(actor, battle);
    if (!snapshot?.normalizedText || snapshot.hasInnateTechnique === false) return [];
    var matched = [];
    var seen = new Set();
    var seenNames = new Set();
    getTechniqueFeatureHandCards().forEach(function collectFeatureCard(card) {
      if (!card?.techniqueId || !doesFeatureCardMatchActor(card, snapshot)) return;
      var sourceActionId = card.sourceActionId || card.draftCardId || "";
      var normalizedName = normalizeFeatureText(card.cardName || sourceActionId);
      if (!sourceActionId || seen.has(sourceActionId) || seenNames.has(normalizedName)) return;
      seen.add(sourceActionId);
      seenNames.add(normalizedName);
      matched.push(buildTechniqueFeatureHandAction(card, actor, snapshot));
    });
    return matched;
  }

  function isCursedSpiritActor(actor, battle, snapshot) {
    var profile = getDuelProfileForSide(battle, actor?.side || "") || actor?.characterCardProfile || actor?.profile || {};
    var text = [
      snapshot?.text,
      actor?.name,
      actor?.displayName,
      actor?.characterId,
      actor?.officialGrade,
      actor?.powerTier,
      actor?.notes,
      actor?.profile?.officialGrade,
      actor?.profile?.powerTier,
      actor?.profile?.notes,
      actor?.characterCardProfile?.officialGrade,
      actor?.characterCardProfile?.powerTier,
      actor?.characterCardProfile?.notes,
      profile?.officialGrade,
      profile?.powerTier,
      profile?.notes
    ].concat(
      toFeatureList(actor?.specialHandTags),
      toFeatureList(actor?.["特殊手札"]),
      toFeatureList(actor?.profile?.specialHandTags),
      toFeatureList(actor?.profile?.["特殊手札"]),
      toFeatureList(actor?.characterCardProfile?.specialHandTags),
      toFeatureList(actor?.characterCardProfile?.["特殊手札"]),
      toFeatureList(profile?.specialHandTags),
      toFeatureList(profile?.["特殊手札"])
    ).join(" ");
    return /特级咒灵|低级咒灵|咒灵之躯|咒灵，|咒灵\)|咒灵）|（咒灵|\(咒灵|cursed_spirit|cursedspirit|disaster_curse|disastercurse|low_grade_curse|lowgradecurse/i.test(text);
  }

  function getDuelActionIdentityText(action) {
    return [
      action?.id,
      action?.sourceActionId,
      action?.label,
      action?.name,
      action?.description,
      action?.cardType,
      action?.type,
      action?.scalingProfile
    ].concat(
      toFeatureList(action?.tags),
      toFeatureList(action?.mechanicIds)
    ).join(" ");
  }

  function isReverseCursedTechniqueAction(action) {
    if (action?.rctHealing) return true;
    var text = getDuelActionIdentityText(action).toLowerCase();
    if (/curse_regen|咒灵再生/.test(text)) return false;
    return /反转术式|rct|reverse_output|reverse_cursed_technique|正能量|疗伤|治疗/.test(text);
  }

  function isReverseCursedTechniqueOutputAction(action) {
    var text = getDuelActionIdentityText(action).toLowerCase();
    return /reverse_output|rct_output|反转输出|正能量外放|输出反转/.test(text);
  }

  function isCurseRegenerationAction(action) {
    var text = getDuelActionIdentityText(action).toLowerCase();
    return /curse_regen|咒灵再生/.test(text) || (/咒灵/.test(text) && /再生/.test(text));
  }

  function isDuelActionAllowedByActorIdentity(action, actor, battle) {
    if (!actor || !action) return true;
    if (!isReverseCursedTechniqueAction(action) && !isCurseRegenerationAction(action)) return true;
    var snapshot = getActorFeatureSnapshot(actor, battle);
    var cursedSpirit = isCursedSpiritActor(actor, battle, snapshot);
    if (isReverseCursedTechniqueAction(action)) {
      if (cursedSpirit) return false;
      if (isReverseCursedTechniqueOutputAction(action)) return hasReverseCursedTechniqueOutputAccess(actor, battle, snapshot);
      return hasReverseCursedTechniqueAccess(actor, battle, snapshot);
    }
    if (isCurseRegenerationAction(action)) return cursedSpirit;
    return true;
  }

  function hasReverseCursedTechniqueAccess(actor, battle, snapshot) {
    var ids = snapshot?.ids || [];
    if (ids.some(function hasKnownRctId(id) { return RCT_CHARACTER_IDS.has(String(id || "")); })) return true;
    var text = snapshot?.text || "";
    return /反转术式|反转输出|正能量外放|rct_user|rct_output|reverse_output|reverse_cursed_technique|healer|self_repair|反转恢复|疗伤/i.test(text);
  }

  function hasReverseCursedTechniqueOutputAccess(actor, battle, snapshot) {
    var ids = snapshot?.ids || [];
    if (ids.some(function hasKnownRctOutputId(id) { return RCT_OUTPUT_CHARACTER_IDS.has(String(id || "")); })) return true;
    var text = snapshot?.text || "";
    return /反转输出|正能量外放|rct_output|reverse_output|healer/i.test(text);
  }

  function buildReverseCursedTechniqueActions(actor, opponent, duelState) {
    var battle = getBattle(duelState);
    var snapshot = getActorFeatureSnapshot(actor, battle);
    if (!snapshot?.normalizedText || isCursedSpiritActor(actor, battle, snapshot)) return [];
    if (!hasReverseCursedTechniqueAccess(actor, battle, snapshot)) return [];
    var hpRatio = actor?.maxHp ? Number(actor.hp || 0) / Number(actor.maxHp || 1) : 1;
    if (hpRatio >= 0.985) return [];
    var missingHp = Math.max(0, Number(actor?.maxHp || 0) - Number(actor?.hp || 0));
    var baseHealing = missingHp > 90 ? 24 : (missingHp > 45 ? 20 : 16);
    return [{
      id: "reverse_cursed_technique_heal",
      sourceActionId: "reverse_cursed_technique_heal",
      label: "反转术式疗伤",
      description: "将咒力反转为正向能量修复自身伤势，治疗量按角色咒力操控、效率、术式能力和输出修正。",
      cardType: "healing",
      type: "rct_healing",
      rctHealing: true,
      normalHandOnly: true,
      tags: ["反转术式", "rct", "正能量", "疗伤", "治疗", "支援", "resource"],
      exclusiveToCharacters: snapshot.ids || [],
      requiresCe: true,
      requirements: {
        domainActive: "any",
        requiresMissingHp: true
      },
      apCost: 1,
      baseCeCost: 20,
      baseHealing: baseHealing,
      baseBlock: 8,
      baseStabilityRestore: 20,
      durationRounds: 1,
      damageType: "none",
      scalingProfile: "healing",
      accuracyProfile: "none",
      evasionAllowed: false,
      effects: {
        incomingHpScale: 0.9,
        stabilityDelta: 0.024,
        weightDeltas: {
          sustain: 0.8,
          support: 0.65,
          resource: 0.35
        },
        selfStatus: {
          id: "rctRecovery",
          label: "反转治疗",
          rounds: 1,
          value: 1
        }
      },
      risk: "medium",
      rarity: "uncommon",
      weight: hpRatio < 0.45 ? 7.2 : 5.4,
      selectionWeight: hpRatio < 0.45 ? 8.4 : 6.1,
      effectSummary: "按基础治疗值与角色属性修正恢复体势。",
      logTemplate: "你使用反转术式疗伤，把咒力转为正向能量修复伤势。"
    }];
  }

  function buildDuelActionPool(actor, opponent, duelState) {
    var battle = getBattle(duelState);
    var templates = [
      ...getDuelActionTemplateIndex().templates,
      ...buildCustomDuelSpecialActions(actor),
      ...buildReverseCursedTechniqueActions(actor, opponent, battle),
      ...buildTechniqueFeatureHandActions(actor, opponent, battle),
      ...buildDuelDomainSpecificActions(actor, opponent, battle)
    ];
    return templates.filter(function filterIdentityScopedAction(template) {
      return isDuelActionAllowedByActorIdentity(template, actor, battle);
    }).map(function mapTemplate(template) {
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
    if (Number(action.baseHealing || 0) > 0 || action.rctHealing || isCurseRegenerationAction(action)) {
      var missingHpRatio = Math.max(0, 1 - hpRatio);
      if (hpRatio < 0.72) score += Math.min(4.2, 0.8 + missingHpRatio * 5);
      if (hpRatio < 0.38) score += 1.6;
      if (action.id === "reverse_cursed_technique_heal" || action.id === "curse_regen_candidate") score += 1.8;
    }
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
    if (actor?.maxHp && Number(actor.hp || 0) / Number(actor.maxHp || 1) < 0.72) {
      pushById("reverse_cursed_technique_heal");
      pushById("curse_regen_candidate");
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

  function getHutianBlackFlashStacks(actor) {
    var stored = Number(actor?.hutianBlackFlashStacks || 0);
    var statusValue = getDuelStatusEffectValue(actor, "hutianBlackFlashGrowth");
    return Math.max(0, Math.floor(Number.isFinite(stored) ? Math.max(stored, statusValue) : statusValue));
  }

  function setHutianBlackFlashStacks(actor, stacks) {
    if (!actor) return;
    var value = Math.max(0, Math.floor(Number(stacks || 0)));
    actor.hutianBlackFlashStacks = value;
    actor.statusEffects = Array.isArray(actor.statusEffects) ? actor.statusEffects.filter(function keepEffect(effect) {
      return effect?.id !== "hutianBlackFlashGrowth";
    }) : [];
    if (value > 0) {
      actor.statusEffects.push({
        id: "hutianBlackFlashGrowth",
        label: "黑闪递增",
        rounds: 999,
        value: value
      });
    }
  }

  function getDuelMartialScoreForEvasion(resource) {
    var profile = resource?.characterCardProfile || {};
    var raw = profile.raw || {};
    var axes = profile.axes || {};
    return Math.max(0, Number(raw.martialScore ?? raw.bodyScore ?? axes.body ?? 0) || 0);
  }

  function getDuelHitRateFromMartialDiff(diff) {
    var rounded = Math.round(Number(diff || 0));
    if (rounded >= 4) return 0.96;
    if (rounded === 3) return 0.92;
    if (rounded === 2) return 0.86;
    if (rounded === 1) return 0.78;
    if (rounded === 0) return 0.68;
    if (rounded === -1) return 0.55;
    if (rounded === -2) return 0.4;
    if (rounded === -3) return 0.25;
    if (rounded === -4) return 0.12;
    return 0.05;
  }

  function normalizeRate(value, fallback) {
    var number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    if (Math.abs(number) > 1) return number / 100;
    return number;
  }

  function inferDuelAccuracyProfile(action) {
    var cardType = String(action?.cardType || action?.type || "").toLowerCase();
    var damageType = String(action?.damageType || "").toLowerCase();
    var scalingProfile = String(action?.scalingProfile || "").toLowerCase();
    var text = [
      action?.id,
      action?.label,
      action?.name,
      action?.description,
      action?.effectSummary,
      cardType,
      damageType,
      scalingProfile,
      [].concat(action?.tags || []).join(" ")
    ].filter(Boolean).join(" ").toLowerCase();
    if (action?.evasionAllowed === false || action?.domainSpecific || action?.effects?.activateDomain || action?.effects?.releaseDomain) return "none";
    if (action?.accuracyProfile) return String(action.accuracyProfile);
    if (action?.executionSword || action?.instantKillOnHit) return "execution_sword";
    if (/范围|area|aoe|environment|swarm|散射|爆破|地形|环境/.test(text)) return "technique_area";
    if (/咒具|cursed_tool|weapon|刀|剑|斩|slash/.test(text) || cardType === "curse_tool" || damageType === "cursed_tool") return "weapon";
    if (/近身|体术|拳|踢|melee|strike|physical|black_flash/.test(text) || cardType === "attack" || cardType === "basic") return "melee";
    if (cardType === "technique" || cardType === "ce_burst" || cardType === "special" || cardType === "soul_pressure") return "technique_projectile";
    return "melee";
  }

  function getDuelAccuracyProfileConfig(profile) {
    var key = String(profile || "none");
    var configs = {
      melee: { hitBonus: 0, min: 0.05, max: 0.96, damageScaleOnMiss: 0, ceScaleOnMiss: 0, stabilityScaleOnMiss: 0 },
      weapon: { hitBonus: 0, min: 0.05, max: 0.96, damageScaleOnMiss: 0, ceScaleOnMiss: 0, stabilityScaleOnMiss: 0 },
      execution_sword: { hitBonus: 0.12, min: 0.05, max: 0.95, damageScaleOnMiss: 0, ceScaleOnMiss: 0, stabilityScaleOnMiss: 0 },
      technique_projectile: { hitBonus: 0.08, min: 0.08, max: 0.95, damageScaleOnMiss: 0.12, ceScaleOnMiss: 0.2, stabilityScaleOnMiss: 0.2 },
      technique_area: { hitBonus: 0.23, min: 0.18, max: 0.95, damageScaleOnMiss: 0.38, ceScaleOnMiss: 0.45, stabilityScaleOnMiss: 0.45 }
    };
    return configs[key] || null;
  }

  function rollDuelEvasionRandom(battle, label) {
    var value = typeof battle?.rng === "function" ? battle.rng() : Math.random();
    if (battle) {
      battle.randomLog ||= [];
      battle.randomLog.push({
        round: Number(battle.round || 0) + 1,
        label: label || "evasion",
        value: Number(value.toFixed(8))
      });
    }
    return value;
  }

  function showDuelFloatingCombatText(battle, text, type, side) {
    var now = Date.now();
    if (!battle) return;
    battle.floatingCombatText = {
      text: text || "Miss!",
      type: type || "miss",
      side: side || "",
      createdAt: now,
      expiresAt: now + 1000
    };
  }

  function resolveDuelActionEvasion(action, actor, opponent, battle, options) {
    var profile = inferDuelAccuracyProfile(action);
    var config = getDuelAccuracyProfileConfig(profile);
    var attackerMartial;
    var defenderMartial;
    var diff;
    var baseRate;
    var hitRate;
    var roll;
    var onMiss = action?.onMiss || {};
    if (!config || !action || !actor || !opponent || !battle) {
      return { checked: false, evaded: false, profile: profile || "none", hitRate: 1, roll: 0 };
    }
    if (options?.damage <= 0 && !action.instantKillOnHit && !action.effects?.instantKillOnHit) {
      return { checked: false, evaded: false, profile: profile, hitRate: 1, roll: 0 };
    }
    attackerMartial = getDuelMartialScoreForEvasion(actor);
    defenderMartial = getDuelMartialScoreForEvasion(opponent);
    diff = attackerMartial - defenderMartial;
    baseRate = normalizeRate(action.baseHitRate ?? action.accuracyBaseRate, getDuelHitRateFromMartialDiff(diff));
    hitRate = clamp(
      baseRate +
      Number(config.hitBonus || 0) +
      normalizeRate(action.hitRateModifier ?? action.accuracyModifier ?? action.effects?.hitRateModifier, 0),
      Number(config.min || 0.05),
      Number(config.max || 0.96)
    );
    roll = rollDuelEvasionRandom(battle, "evasion:" + (action.id || action.label || profile));
    return {
      checked: true,
      evaded: roll > hitRate,
      profile: profile,
      hitRate: Number(hitRate.toFixed(4)),
      roll: Number(roll.toFixed(4)),
      attackerMartial: Number(attackerMartial.toFixed(2)),
      defenderMartial: Number(defenderMartial.toFixed(2)),
      martialDiff: Number(diff.toFixed(2)),
      damageScaleOnMiss: normalizeRate(onMiss.damageScale, config.damageScaleOnMiss),
      ceScaleOnMiss: normalizeRate(onMiss.ceDamageScale, config.ceScaleOnMiss),
      stabilityScaleOnMiss: normalizeRate(onMiss.stabilityScale, config.stabilityScaleOnMiss),
      keepCardOnMiss: Boolean(onMiss.keepCard || action.executionSword || action.retainedPermanent || action.noRefresh)
    };
  }

  function applyHutianBlackFlashEffect(effects, actor, opponent, options) {
    var stacks = getHutianBlackFlashStacks(actor);
    var baseRatio = Number(effects.hutianBlackFlashBaseHpRatio || 0.03) + stacks * Number(effects.hutianBlackFlashGrowthPerHit || 0.005);
    var baseDamage = Math.max(0, Number(actor?.hp || 0) * baseRatio);
    var exponent = Number(effects.hutianBlackFlashDamageExponent || 2.5);
    var directDamage = Math.max(0, Math.round(Math.pow(baseDamage, exponent)));
    if (options?.previewOnly) {
      return {
        directDamage: directDamage,
        baseDamage: Number(baseDamage.toFixed(4)),
        baseRatio: Number(baseRatio.toFixed(4)),
        stacksBefore: stacks,
        stacksAfter: stacks + 1,
        hpHeal: 0,
        ceHeal: 0,
        previewOnly: true
      };
    }
    if (directDamage > 0) opponent.hp -= directDamage;
    var hpHeal = Math.max(0, Number(actor?.hp || 0) * Number(effects.hutianBlackFlashHpHealCurrentRatio || 0.08));
    var ceHeal = Math.max(0, Number(actor?.ce || 0) * Number(effects.hutianBlackFlashCeHealCurrentRatio || 0.04));
    actor.hp = Number(actor.hp || 0) + hpHeal;
    actor.ce = Number(actor.ce || 0) + ceHeal;
    actor.stability = Number(clamp(Number(actor.stability || 0) + Number(effects.hutianBlackFlashStabilityDelta || 0.01), 0, 1).toFixed(4));
    setHutianBlackFlashStacks(actor, stacks + 1);
    opponent.statusEffects = Array.isArray(opponent.statusEffects) ? opponent.statusEffects : [];
    opponent.statusEffects.push({ id: "hutianBlackFlashShock", label: "黑闪！", rounds: 1, value: 1 });
    return {
      directDamage: directDamage,
      baseDamage: Number(baseDamage.toFixed(4)),
      baseRatio: Number(baseRatio.toFixed(4)),
      stacksBefore: stacks,
      stacksAfter: stacks + 1,
      hpHeal: Number(hpHeal.toFixed(1)),
      ceHeal: Number(ceHeal.toFixed(1))
    };
  }

  function applyDuelActionEffect(action, actor, opponent, duelState) {
    var battle = getBattle(duelState);
    if (!action || !actor || !opponent || !battle) return null;
    if (action.id === "online_pass_turn" || action.id === "duel_pass_turn" || action.type === "pass") {
      var passResult = {
        costCe: 0,
        actorCe: 0,
        actorHp: 0,
        actorStability: 0,
        actorDomainLoad: 0,
        opponentStability: 0,
        opponentHp: 0,
        opponentDomainLoad: 0,
        domainActivated: false,
        domainReleased: false,
        directDamage: 0,
        blackFlashTriggered: false,
        blackFlashLabel: "",
        mechanicsApplied: [],
        passTurn: true
      };
      appendDuelActionLog(action, actor, opponent, passResult, battle);
      return passResult;
    }
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
    var blackFlashWindow = effects.hutianBlackFlash ? null : (isStrikeLikeAction(action) ? takeBlackFlashWindow(actor) : null);
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
    var directHealing = Math.max(0, Math.round(Number(numericPreview?.finalHealing || 0)));
    var actualHealing = 0;
    var stabilityShock = Math.max(0, Number(numericPreview?.base?.baseStabilityDamage || 0) / 100);
    var hutianBlackFlashResult = null;
    var evasionResult = null;
    var blackFlashStatus = null;
    var instantKillOnHit = Boolean(action.instantKillOnHit || effects.instantKillOnHit);
    if (effects.hutianBlackFlash) {
      hutianBlackFlashResult = applyHutianBlackFlashEffect(effects, actor, opponent, { previewOnly: true });
      directDamage = hutianBlackFlashResult.directDamage;
    }
    if (blackFlashWindow) {
      directDamage = Math.max(directDamage + 10, Math.round(Number(numericPreview?.finalDamage || 8) * 0.9));
      stabilityShock += 0.085;
      blackFlashStatus = { id: "blackFlashShock", label: actor?.characterCardProfile?.isZeroCe ? "极限打击冲击" : "黑闪冲击", rounds: 1, value: 1 };
    }
    evasionResult = resolveDuelActionEvasion(action, actor, opponent, battle, { damage: directDamage, stabilityShock: stabilityShock, instantKillOnHit: instantKillOnHit });
    if (evasionResult?.evaded) {
      showDuelFloatingCombatText(battle, "Miss!", "miss", opponentSide);
      battle.evasionLog ||= [];
      battle.evasionLog.unshift({
        round: Number(battle.round || 0) + 1,
        actionId: action.id || "",
        actionLabel: action.label || action.id || "",
        actorSide: side,
        opponentSide: opponentSide,
        hitRate: evasionResult.hitRate,
        roll: evasionResult.roll,
        profile: evasionResult.profile
      });
      directDamage = Math.max(0, Math.round(directDamage * Number(evasionResult.damageScaleOnMiss || 0)));
      stabilityShock = Math.max(0, Number(stabilityShock || 0) * Number(evasionResult.stabilityScaleOnMiss || 0));
      instantKillOnHit = false;
      if (hutianBlackFlashResult) hutianBlackFlashResult.evaded = true;
    }
    if (!evasionResult?.evaded && instantKillOnHit) {
      directDamage = Math.max(directDamage, Math.ceil(Number(opponent.hp || 0)));
      opponent.hp = 0;
    } else if (!evasionResult?.evaded && effects.hutianBlackFlash) {
      hutianBlackFlashResult = applyHutianBlackFlashEffect(effects, actor, opponent);
      directDamage = hutianBlackFlashResult.directDamage;
    } else if (!effects.hutianBlackFlash && directDamage > 0) {
      opponent.hp -= directDamage;
    }
    if (!evasionResult?.evaded && blackFlashStatus) opponent.statusEffects.push(blackFlashStatus);
    if (stabilityShock > 0) {
      opponent.stability = Number(clamp(Number(opponent.stability || 0) - stabilityShock, 0, 1).toFixed(4));
    }
    if (directHealing > 0 && Number(actor.maxHp || 0) > 0) {
      var beforeHealHp = Number(actor.hp || 0);
      actor.hp = Number(clamp(beforeHealHp + directHealing, 0, Number(actor.maxHp || beforeHealHp + directHealing)).toFixed(1));
      actualHealing = Math.max(0, Number((Number(actor.hp || 0) - beforeHealHp).toFixed(1)));
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
      directHealing: directHealing,
      actorHealing: actualHealing,
      instantKillOnHit: Boolean(!evasionResult?.evaded && (action.instantKillOnHit || effects.instantKillOnHit)),
      evasion: evasionResult?.checked ? evasionResult : undefined,
      blackFlashTriggered: Boolean(!evasionResult?.evaded && (blackFlashWindow || effects.hutianBlackFlash)),
      blackFlashLabel: !evasionResult?.evaded && effects.hutianBlackFlash ? "黑闪！" : (!evasionResult?.evaded && blackFlashWindow ? (actor?.characterCardProfile?.isZeroCe ? "极限打击窗口" : "黑闪") : ""),
      hutianBlackFlash: hutianBlackFlashResult || undefined,
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
