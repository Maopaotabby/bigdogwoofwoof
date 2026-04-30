(function attachDuelHand(global) {
  "use strict";

  var namespace = "JJKDuelHand";
  var version = "1.390A-combat-core-rationalization-pass";
  var expectedExports = [
    "getDuelHandRules",
    "initializeDuelHandState",
    "buildDuelHandCandidates",
    "pickDuelHandCandidates",
    "getDuelHandCardViewModel",
    "buildDuelCardViewModel",
    "applyDuelHandSelection",
    "getDuelSelectedHandActions",
    "canSelectDuelHandCandidate",
    "selectDuelHandCandidate",
    "unselectDuelHandCandidate",
    "applyDuelSelectedHandActions",
    "resolveDuelHandTurn",
    "clearDuelSelectedHandActions",
    "pickDuelCpuHandActions",
    "getDuelActionApCost",
    "getDuelApState",
    "spendDuelAp",
    "resetDuelApForTurn",
    "getDuelCharacterCardRules",
    "buildDuelCharacterCardProfile",
    "getDuelCharacterArchetypes",
    "isDuelCardEligibleForCharacter",
    "isDuelActionEligibleForCharacter",
    "applyDuelCharacterCardWeights",
    "filterDuelHandCandidatesByCharacter",
    "explainDuelCardIneligibility"
  ];
  var expectedDependencyNames = [
    "state",
    "getDuelHandRules",
    "getDuelCharacterCardRules",
    "getDuelBattle",
    "buildDuelActionPool",
    "pickDuelActionChoices",
    "getDuelCpuAction",
    "getDuelActionAvailability",
    "getDuelCardTemplateForAction",
    "buildDuelCardViewModel",
    "applyDuelActionEffect",
    "getDuelActionCost",
    "getDuelResourcePair",
    "clampDuelResource",
    "appendDuelActionLog",
    "recordDuelResourceChange"
  ];
  var bindings = Object.create(null);
  var dependencies = Object.create(null);
  var handCandidateCacheStats = {
    lastInvalidatedAt: ""
  };

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

  function getDependency(name) {
    return dependencies[name];
  }

  function getOptionalFunction(name) {
    var value = getDependency(name);
    return typeof value === "function" ? value : null;
  }

  function callDependency(name, args) {
    var fn = getOptionalFunction(name);
    if (!fn) throw new Error(namespace + " dependency is not available: " + name);
    return fn.apply(null, args || []);
  }

  function getDefaultBattle() {
    var getter = getOptionalFunction("getDuelBattle");
    if (getter) return getter();
    return dependencies.state?.duelBattle || null;
  }

  function getBattle(duelState) {
    return duelState || getDefaultBattle();
  }

  function getCandidateId(candidate) {
    var action = candidate?.action || candidate;
    return candidate?.id || candidate?.actionId || action?.id || "";
  }

  function buildDuelHandCandidateCache(battle, candidates) {
    var activeBattle = getBattle(battle);
    if (!activeBattle) return null;
    var items = Array.isArray(candidates)
      ? candidates
      : (activeBattle.handCandidates || activeBattle.actionChoices || []);
    var cache = {
      schema: "jjk-duel-hand-candidate-cache",
      round: Number(activeBattle.round || 0),
      total: items.length,
      candidates: items,
      byId: Object.create(null)
    };
    items.forEach(function indexCandidate(candidate) {
      var id = getCandidateId(candidate);
      if (id) cache.byId[id] = candidate;
    });
    activeBattle.handCandidateCache = cache;
    return cache;
  }

  function getDuelHandCandidateCache(battle) {
    var activeBattle = getBattle(battle);
    if (!activeBattle) return null;
    var candidates = activeBattle.handCandidates || activeBattle.actionChoices || [];
    var cache = activeBattle.handCandidateCache;
    if (!cache || cache.candidates !== candidates || Number(cache.round || 0) !== Number(activeBattle.round || 0)) {
      cache = buildDuelHandCandidateCache(activeBattle, candidates);
    }
    return cache;
  }

  function getDuelHandCandidateById(battle, actionOrId) {
    var activeBattle = getBattle(battle);
    if (!activeBattle) return null;
    var id = typeof actionOrId === "string" ? actionOrId : getCandidateId(actionOrId);
    if (!id) return null;
    return getDuelHandCandidateCache(activeBattle)?.byId?.[id] || null;
  }

  function invalidateDuelHandCandidateCache(battle) {
    var activeBattle = getBattle(battle);
    if (activeBattle) delete activeBattle.handCandidateCache;
    handCandidateCacheStats.lastInvalidatedAt = new Date().toISOString();
  }

  function getDuelHandRules() {
    var getter = getOptionalFunction("getDuelHandRules");
    if (getter && getter !== getDuelHandRules) return getter();
    return {
      version: "0.1.0",
      status: "CANDIDATE",
      hand: {
        defaultChoiceCount: 5,
        minChoiceCount: 3,
        maxChoiceCount: 6,
        selectionMode: "multi_action_ap_beta",
        allowMultipleSelectionsPerTurn: true,
        maxSelectionsPerTurn: 3,
        disableSelectedCandidate: true,
        requireManualResolve: true
      },
      ap: { basePerTurn: 2, maxPerTurn: 3, carryOver: false },
      cardLikeDisplay: {
        enabled: true,
        showApCost: true,
        showCeCost: true,
        showRisk: true,
        showTags: true,
        showCardType: true,
        showRarity: true
      },
      notes: "Hand-like candidates wrap existing duel actions only."
    };
  }

  function asList(value) {
    if (Array.isArray(value)) return value.filter(function keepValue(item) { return item != null && item !== ""; });
    if (value == null || value === "") return [];
    return [value];
  }

  function uniqueList(values) {
    return Array.from(new Set((values || []).map(function normalizeValue(value) {
      return typeof value === "string" ? value.trim() : value;
    }).filter(function keepValue(value) {
      return value != null && value !== "";
    })));
  }

  function includesAny(source, targets) {
    var sourceSet = new Set(asList(source));
    return asList(targets).some(function hasTarget(target) {
      return sourceSet.has(target);
    });
  }

  function includesAll(source, targets) {
    var sourceSet = new Set(asList(source));
    return asList(targets).every(function hasTarget(target) {
      return sourceSet.has(target);
    });
  }

  function normalizeCharacterKey(value) {
    return String(value || "").trim().toLowerCase();
  }

  function getDuelCharacterCardRules() {
    var getter = getOptionalFunction("getDuelCharacterCardRules");
    if (getter && getter !== getDuelCharacterCardRules) return getter();
    return dependencies.state?.duelCharacterCardRules || {
      schema: "jjk-duel-character-card-rules",
      version: "0.1.0",
      status: "CANDIDATE",
      defaults: { enabled: false },
      archetypes: {},
      characters: {},
      sourceActionRules: {}
    };
  }

  function getCharacterRuleEntry(characterOrActor, rules) {
    var activeRules = rules || getDuelCharacterCardRules();
    var characters = activeRules?.characters || {};
    var id = characterOrActor?.characterId || characterOrActor?.id || characterOrActor?.profile?.id || "";
    if (id && characters[id]) return { id: id, rules: characters[id] };
    var haystack = normalizeCharacterKey([
      id,
      characterOrActor?.displayName,
      characterOrActor?.name,
      characterOrActor?.profile?.displayName,
      characterOrActor?.profile?.name
    ].filter(Boolean).join(" "));
    return Object.entries(characters).reduce(function findMatch(match, entry) {
      if (match) return match;
      var characterId = entry[0];
      var rule = entry[1] || {};
      var aliases = uniqueList([characterId].concat(asList(rule.aliases)));
      var found = aliases.some(function aliasMatches(alias) {
        var normalized = normalizeCharacterKey(alias);
        return normalized && haystack.includes(normalized);
      });
      return found ? { id: characterId, rules: rule } : null;
    }, null);
  }

  function inferCharacterTraits(source) {
    var text = [
      source?.id,
      source?.characterId,
      source?.name,
      source?.displayName,
      source?.officialGrade,
      source?.tier,
      source?.powerTier,
      source?.domainProfile,
      source?.techniqueText,
      source?.externalResource,
      source?.notes
    ].concat(
      asList(source?.innateTraits),
      asList(source?.advancedTechniques),
      asList(source?.loadout),
      asList(source?.flags),
      asList(source?.traits)
    ).join(" ");
    var traits = [];
    if (/零咒力|天与|真希|甚尔/i.test(text)) traits.push("zero_ce", "零咒力", "heavenly_restriction", "天与咒缚", "physical", "体术", "cursed_tool", "咒具");
    if (/咒具|释魂刀|天逆|游云|黑绳|万里锁/i.test(text)) traits.push("cursed_tool", "咒具");
    if (/咒灵之躯|咒灵|灾害/i.test(text)) traits.push("curse", "咒灵");
    if (/领域展开|开放领域|顶级领域|坐杀搏徒|无量空处|伏魔御厨子|自闭圆顿裹|诛伏赐死|真赝相爱|嵌合暗翳庭/i.test(text)) traits.push("domain", "领域");
    if (/无下限|六眼|五条/i.test(text)) traits.push("limitless", "gojo", "五条", "无下限");
    if (/宿傩|伏魔御厨子|御厨子|斩击/i.test(text)) traits.push("sukuna", "shrine", "slash", "宿傩", "斩击");
    if (/日车|诛伏赐死|审判|规则类/i.test(text)) traits.push("trial", "judgment", "日车", "审判");
    if (/秤|坐杀搏徒|中奖/i.test(text)) traits.push("jackpot", "hakari", "秤");
    if (/虎杖|虎天帝|itadori|逕庭拳|黑闪|灵魂打击|半人半咒/i.test(text)) traits.push("yuji", "itadori", "虎杖", "体术", "灵魂打击", "black_flash_window");
    if (/伏黑|十种影|式神|嵌合暗翳庭/i.test(text)) traits.push("ten_shadows", "shikigami", "shadow", "伏黑", "式神", "影");
    if (/真人|灵魂|无为转变|自闭圆顿裹/i.test(text)) traits.push("mahito", "soul", "真人", "灵魂");
    if (/乙骨|里香|真赝相爱|复制/i.test(text)) traits.push("okkotsu", "rika", "copy_candidate", "乙骨", "里香");
    return uniqueList(traits);
  }

  function getDuelCharacterArchetypes(characterOrActor, options) {
    var rules = options?.rules || getDuelCharacterCardRules();
    var entry = getCharacterRuleEntry(characterOrActor, rules);
    var source = characterOrActor?.profile || characterOrActor || {};
    var text = [
      source?.id,
      source?.characterId,
      source?.name,
      source?.displayName,
      source?.domainProfile,
      source?.techniqueText,
      source?.notes
    ].concat(asList(source?.innateTraits), asList(source?.flags), asList(source?.loadout)).join(" ");
    var archetypes = asList(entry?.rules?.archetypes);
    if (/零咒力|天与|真希|甚尔/i.test(text) && !archetypes.includes("zero_ce_heavenly_restriction")) archetypes.push("zero_ce_heavenly_restriction");
    if (/宿傩|御厨子|伏魔|斩击/i.test(text) && !archetypes.includes("sukuna_slash")) archetypes.push("sukuna_slash");
    if (/五条|无下限|六眼|无量空处/i.test(text) && !archetypes.includes("gojo_limitless")) archetypes.push("gojo_limitless");
    if (/日车|诛伏赐死|审判/i.test(text) && !archetypes.includes("higuruma_trial_owner")) archetypes.push("higuruma_trial_owner");
    if (/秤|坐杀搏徒|中奖/i.test(text) && !archetypes.includes("hakari_jackpot_owner")) archetypes.push("hakari_jackpot_owner");
    if (/虎杖|虎天帝|itadori|逕庭拳|黑闪|灵魂打击|半人半咒/i.test(text) && !archetypes.includes("yuji_soul_melee")) archetypes.push("yuji_soul_melee");
    if (/伏黑|十种影|式神|嵌合暗翳庭/i.test(text) && !archetypes.includes("ten_shadows")) archetypes.push("ten_shadows");
    if (/真人|无为转变|灵魂/i.test(text) && !archetypes.includes("mahito_soul_transfiguration")) archetypes.push("mahito_soul_transfiguration");
    if (/乙骨|里香|复制/i.test(text) && !archetypes.includes("okkotsu_rika_copy")) archetypes.push("okkotsu_rika_copy");
    if (/咒灵之躯|灾害咒灵|咒灵/i.test(text) && !archetypes.includes("curse_spirit_general")) archetypes.push("curse_spirit_general");
    return uniqueList(archetypes);
  }

  function applyProfilePatch(profile, patch) {
    if (!patch || typeof patch !== "object") return profile;
    ["hasCe", "ceLimited", "hasInnateTechnique", "hasDomainAccess", "isZeroCe", "isCurse", "isIncarnated", "usesCursedTools"].forEach(function applyFlag(key) {
      if (typeof patch[key] === "boolean") profile[key] = patch[key];
    });
    return profile;
  }

  function buildDuelCharacterCardProfile(characterOrActor, options) {
    var rules = options?.rules || getDuelCharacterCardRules();
    var source = characterOrActor?.profile || characterOrActor || {};
    var entry = getCharacterRuleEntry(source, rules);
    var archetypes = getDuelCharacterArchetypes(source, { rules: rules });
    var traits = uniqueList([]
      .concat(inferCharacterTraits(source))
      .concat(asList(source?.innateTraits))
      .concat(asList(source?.advancedTechniques))
      .concat(asList(source?.loadout))
      .concat(asList(source?.flags))
      .concat(asList(source?.traits))
      .concat(asList(entry?.rules?.forceAllowTags))
      .concat(archetypes));
    var specialHandTags = uniqueList([]
      .concat(asList(source?.specialHandTags))
      .concat(asList(source?.["特殊手札"]))
      .concat(archetypes));
    traits = uniqueList(traits.concat(specialHandTags));
    var text = traits.concat([
      source?.id,
      source?.characterId,
      source?.name,
      source?.displayName,
      source?.domainProfile,
      source?.techniqueText,
      source?.notes
    ]).join(" ");
    var profile = {
      characterId: source?.characterId || source?.id || entry?.id || "",
      displayName: source?.displayName || source?.name || "",
      traits: traits,
      archetypes: archetypes,
      specialHandTags: specialHandTags,
      hasCe: !/零咒力|zero_ce/i.test(text),
      ceLimited: /零咒力|zero_ce|咒力受限|ce_limited/i.test(text),
      hasInnateTechnique: !/零咒力|无术式|no_innate_technique/i.test(text),
      hasDomainAccess: /领域展开|开放领域|顶级领域|坐杀搏徒|诛伏赐死|无量空处|伏魔御厨子|自闭圆顿裹|真赝相爱|嵌合暗翳庭|domain/i.test(text),
      isZeroCe: /零咒力|zero_ce/i.test(text),
      isCurse: /咒灵|curse_spirit|cursed_spirit|disaster_curse|low_grade_curse/i.test(text),
      isIncarnated: /受肉|incarnated/i.test(text),
      usesCursedTools: /咒具|cursed_tool|释魂刀|天逆|游云|黑绳|万里锁/i.test(text),
      techniqueFamilies: uniqueList(asList(entry?.rules?.techniqueFamilies).concat(traits.filter(function keepFamily(tag) {
        return ["sukuna", "shrine", "slash", "limitless", "gojo", "trial", "judgment", "jackpot", "yuji", "itadori", "black_flash_window", "ten_shadows", "shikigami", "shadow", "mahito", "soul", "okkotsu", "rika", "copy_candidate"].includes(tag);
      }))),
      ruleId: entry?.id || ""
    };
    archetypes.forEach(function applyArchetypePatch(archetypeId) {
      applyProfilePatch(profile, rules?.archetypes?.[archetypeId]?.profilePatch);
    });
    applyProfilePatch(profile, entry?.rules?.profilePatch);
    if (profile.isZeroCe) {
      profile.hasCe = false;
      profile.ceLimited = true;
      profile.hasInnateTechnique = false;
      profile.hasDomainAccess = false;
      profile.usesCursedTools = true;
    }
    profile.traits = uniqueList(profile.traits.concat(
      profile.isZeroCe ? ["zero_ce", "零咒力"] : [],
      profile.isCurse ? ["curse", "咒灵"] : [],
      profile.usesCursedTools ? ["cursed_tool", "咒具"] : [],
      profile.hasDomainAccess ? ["domain", "领域"] : []
    ));
    return profile;
  }

  function getActionRuleForCandidate(actionOrCandidate, rules) {
    var action = getActionFromEntry(actionOrCandidate);
    var id = actionOrCandidate?.sourceActionId || actionOrCandidate?.actionId || actionOrCandidate?.id || action?.id || "";
    return rules?.sourceActionRules?.[id] || rules?.sourceActionRules?.[action?.id] || {};
  }

  function getDuelCardTemplateForCandidate(actionOrCandidate) {
    var templateGetter = getOptionalFunction("getDuelCardTemplateForAction");
    return templateGetter ? templateGetter(actionOrCandidate) : null;
  }

  function getCandidateCardRuleSnapshot(actionOrCandidate, rules) {
    var action = getActionFromEntry(actionOrCandidate) || {};
    var template = getDuelCardTemplateForCandidate(actionOrCandidate) || {};
    var sourceActionId = actionOrCandidate?.sourceActionId || actionOrCandidate?.actionId || template.sourceActionId || actionOrCandidate?.id || action.id || "";
    var sourceRule = getActionRuleForCandidate({ ...actionOrCandidate, sourceActionId: sourceActionId }, rules);
    var tags = uniqueList([]
      .concat(asList(action.tags))
      .concat(asList(template.tags))
      .concat(asList(sourceRule.tags))
      .concat(asList(action.archetypeHints))
      .concat(asList(template.archetypeHints))
      .concat(asList(action.characterHints))
      .concat(asList(template.characterHints)));
    return {
      sourceActionId: sourceActionId,
      cardId: actionOrCandidate?.cardId || template.cardId || ("card_" + sourceActionId),
      label: actionOrCandidate?.label || template.name || action.label || sourceActionId,
      cardType: actionOrCandidate?.cardType || template.cardType || sourceRule.cardType || "",
      tags: tags,
      requiredTraits: uniqueList([].concat(asList(action.requiredTraits), asList(template.requiredTraits), asList(sourceRule.requiredTraits))),
      forbiddenTraits: uniqueList([].concat(asList(action.forbiddenTraits), asList(template.forbiddenTraits), asList(sourceRule.forbiddenTraits))),
      exclusiveToCharacters: uniqueList([].concat(asList(action.exclusiveToCharacters), asList(template.exclusiveToCharacters), asList(sourceRule.exclusiveToCharacters))),
      exclusiveToArchetypes: uniqueList([].concat(asList(action.exclusiveToArchetypes), asList(template.exclusiveToArchetypes), asList(sourceRule.exclusiveToArchetypes))),
      specialHandTags: uniqueList([]
        .concat(asList(action.specialHandTags), asList(action["特殊手札"]))
        .concat(asList(template.specialHandTags), asList(template["特殊手札"]))
        .concat(asList(sourceRule.specialHandTags), asList(sourceRule["特殊手札"]))),
      forbiddenArchetypes: uniqueList([].concat(asList(action.forbiddenArchetypes), asList(template.forbiddenArchetypes), asList(sourceRule.forbiddenArchetypes))),
      requiresCe: Boolean(action.requiresCe || template.requiresCe || sourceRule.requiresCe),
      requiresInnateTechnique: Boolean(action.requiresInnateTechnique || template.requiresInnateTechnique || sourceRule.requiresInnateTechnique),
      requiresDomainAccess: Boolean(action.requiresDomainAccess || template.requiresDomainAccess || sourceRule.requiresDomainAccess),
      requiresCursedTool: Boolean(action.requiresCursedTool || template.requiresCursedTool || sourceRule.requiresCursedTool),
      requiresZeroCe: Boolean(action.requiresZeroCe || template.requiresZeroCe || sourceRule.requiresZeroCe),
      sourceTechniqueFamily: action.sourceTechniqueFamily || template.sourceTechniqueFamily || sourceRule.sourceTechniqueFamily || ""
    };
  }

  function getCharacterRuleAllowDeny(profile, rules) {
    var entry = getCharacterRuleEntry({ id: profile.characterId, name: profile.displayName }, rules);
    var denyTags = [];
    var denyCardTypes = [];
    var weightBoostTags = [];
    var weightPenaltyTags = [];
    var forceAllowSourceActionIds = [];
    var forceDenySourceActionIds = [];
    profile.archetypes.forEach(function collectArchetype(archetypeId) {
      var archetype = rules?.archetypes?.[archetypeId] || {};
      denyTags.push(...asList(archetype.denyTags));
      denyCardTypes.push(...asList(archetype.denyCardTypes));
      weightBoostTags.push(...asList(archetype.weightBoostTags));
      weightPenaltyTags.push(...asList(archetype.weightPenaltyTags));
      forceAllowSourceActionIds.push(...asList(archetype.forceAllowSourceActionIds));
      forceDenySourceActionIds.push(...asList(archetype.forceDenySourceActionIds));
    });
    denyTags.push(...asList(entry?.rules?.denyTags));
    denyCardTypes.push(...asList(entry?.rules?.denyCardTypes));
    weightBoostTags.push(...asList(entry?.rules?.weightBoostTags), ...asList(entry?.rules?.forceAllowTags));
    weightPenaltyTags.push(...asList(entry?.rules?.weightPenaltyTags));
    forceAllowSourceActionIds.push(...asList(entry?.rules?.forceAllowSourceActionIds));
    forceDenySourceActionIds.push(...asList(entry?.rules?.forceDenySourceActionIds));
    return {
      entry: entry,
      denyTags: uniqueList(denyTags),
      denyCardTypes: uniqueList(denyCardTypes),
      weightBoostTags: uniqueList(weightBoostTags),
      weightPenaltyTags: uniqueList(weightPenaltyTags),
      forceAllowSourceActionIds: uniqueList(forceAllowSourceActionIds),
      forceDenySourceActionIds: uniqueList(forceDenySourceActionIds)
    };
  }

  function explainDuelCardIneligibility(actionOrCandidate, characterOrActor, options) {
    var decision = getDuelCardEligibilityDecision(actionOrCandidate, characterOrActor, options);
    return decision.ok ? "" : decision.reason;
  }

  function getDuelCardEligibilityDecision(actionOrCandidate, characterOrActor, options) {
    var rules = options?.rules || getDuelCharacterCardRules();
    if (rules?.defaults?.enabled === false) return { ok: true, reason: "" };
    var profile = options?.profile || buildDuelCharacterCardProfile(characterOrActor, { rules: rules });
    var snapshot = getCandidateCardRuleSnapshot(actionOrCandidate, rules);
    var policy = getCharacterRuleAllowDeny(profile, rules);
    var sourceActionId = snapshot.sourceActionId;
    var forceAllowed = policy.forceAllowSourceActionIds.includes(sourceActionId);
    if (policy.forceDenySourceActionIds.includes(sourceActionId)) {
      return { ok: false, reason: "不符合当前角色特性", profile: profile, snapshot: snapshot };
    }
    if (!forceAllowed && snapshot.exclusiveToCharacters.length) {
      var ids = uniqueList([profile.characterId, profile.ruleId, profile.displayName]);
      if (!includesAny(ids, snapshot.exclusiveToCharacters)) return { ok: false, reason: "需要指定角色专属术式", profile: profile, snapshot: snapshot };
    }
    if (!forceAllowed && snapshot.exclusiveToArchetypes.length && !includesAny(profile.archetypes, snapshot.exclusiveToArchetypes)) {
      return { ok: false, reason: "需要对应角色原型", profile: profile, snapshot: snapshot };
    }
    if (!forceAllowed && snapshot.specialHandTags.length && !includesAny(profile.specialHandTags, snapshot.specialHandTags)) {
      return { ok: false, reason: "需要角色特殊手札标签", profile: profile, snapshot: snapshot };
    }
    if (!forceAllowed && snapshot.forbiddenArchetypes.length && includesAny(profile.archetypes, snapshot.forbiddenArchetypes)) {
      return { ok: false, reason: "当前角色原型禁止此卡", profile: profile, snapshot: snapshot };
    }
    if (!forceAllowed && policy.denyCardTypes.includes(snapshot.cardType)) {
      return { ok: false, reason: "当前角色不能使用该卡牌类型", profile: profile, snapshot: snapshot };
    }
    if (!forceAllowed && includesAny(snapshot.tags, policy.denyTags)) {
      return { ok: false, reason: "标签不符合当前角色特性", profile: profile, snapshot: snapshot };
    }
    var traitPool = uniqueList(profile.traits.concat(profile.archetypes, profile.techniqueFamilies));
    if (!forceAllowed && snapshot.requiredTraits.length && !includesAll(traitPool, snapshot.requiredTraits)) {
      return { ok: false, reason: "缺少必要角色特质", profile: profile, snapshot: snapshot };
    }
    if (!forceAllowed && snapshot.forbiddenTraits.length && includesAny(traitPool, snapshot.forbiddenTraits)) {
      return { ok: false, reason: "角色特质与此卡冲突", profile: profile, snapshot: snapshot };
    }
    if (!forceAllowed && snapshot.requiresCe && !profile.hasCe) return { ok: false, reason: "需要正常咒力流动", profile: profile, snapshot: snapshot };
    if (!forceAllowed && snapshot.requiresInnateTechnique && !profile.hasInnateTechnique) return { ok: false, reason: "需要生得术式", profile: profile, snapshot: snapshot };
    if (!forceAllowed && snapshot.requiresDomainAccess && !profile.hasDomainAccess) return { ok: false, reason: "需要领域能力", profile: profile, snapshot: snapshot };
    if (!forceAllowed && snapshot.requiresCursedTool && !profile.usesCursedTools) return { ok: false, reason: "需要咒具适性或咒具状态", profile: profile, snapshot: snapshot };
    if (!forceAllowed && snapshot.requiresZeroCe && !profile.isZeroCe) return { ok: false, reason: "仅零咒力个体可用", profile: profile, snapshot: snapshot };
    return { ok: true, reason: "", profile: profile, snapshot: snapshot };
  }

  function isDuelCardEligibleForCharacter(actionOrCandidate, characterOrActor, options) {
    return getDuelCardEligibilityDecision(actionOrCandidate, characterOrActor, options).ok;
  }

  function isDuelActionEligibleForCharacter(action, characterOrActor, options) {
    return isDuelCardEligibleForCharacter(action, characterOrActor, options);
  }

  function computeDuelCharacterCardWeight(candidate, profile, rules) {
    var snapshot = getCandidateCardRuleSnapshot(candidate, rules);
    var policy = getCharacterRuleAllowDeny(profile, rules);
    var defaults = rules?.defaults || {};
    var weight = Number(candidate?.selectionWeight ?? candidate?.characterWeight ?? candidate?.weight ?? candidate?.score ?? defaults.baseWeight ?? 1);
    if (!Number.isFinite(weight) || weight <= 0) weight = Number(defaults.baseWeight || 1);
    var boost = 0;
    if (includesAny(snapshot.tags, policy.weightBoostTags)) boost += Number(defaults.tagBoost || 1.75);
    if (includesAny(snapshot.tags, policy.weightPenaltyTags)) boost += Number(defaults.tagPenalty || -1.1);
    if (includesAny(snapshot.exclusiveToArchetypes, profile.archetypes)) boost += Number(defaults.exclusiveBoost || 2.5);
    profile.archetypes.forEach(function addArchetypeBoost(archetypeId) {
      var archetype = rules?.archetypes?.[archetypeId] || {};
      if (includesAny(snapshot.tags, archetype.weightBoostTags)) boost += Number(defaults.archetypeBoost || 2.25);
      if (includesAny(snapshot.tags, archetype.weightPenaltyTags)) boost += Number(defaults.tagPenalty || -1.1);
    });
    var finalWeight = Math.max(Number(defaults.minimumWeight || 0.05), weight + boost);
    return Number(finalWeight.toFixed(4));
  }

  function applyDuelCharacterCardWeights(candidates, characterOrActor, options) {
    var rules = options?.rules || getDuelCharacterCardRules();
    var profile = options?.profile || buildDuelCharacterCardProfile(characterOrActor, { rules: rules });
    return (candidates || []).map(function addWeight(candidate) {
      var weight = computeDuelCharacterCardWeight(candidate, profile, rules);
      return {
        ...candidate,
        characterWeight: weight,
        selectionWeight: weight,
        characterCardProfile: profile,
        characterCardArchetypes: profile.archetypes
      };
    });
  }

  function recordFilteredDuelHandCandidates(battle, actor, filtered) {
    if (!battle || !actor || !Array.isArray(filtered)) return;
    var side = getActorSide(actor, {});
    battle.characterCardFilterDebug ||= {};
    battle.characterCardFilterDebug[side] = filtered.slice(0, 40);
  }

  function filterDuelHandCandidatesByCharacter(candidates, characterOrActor, options) {
    var rules = options?.rules || getDuelCharacterCardRules();
    if (rules?.defaults?.enabled === false) return candidates || [];
    var profile = options?.profile || buildDuelCharacterCardProfile(characterOrActor, { rules: rules });
    var filtered = [];
    var kept = (candidates || []).filter(function keepCandidate(candidate) {
      var decision = getDuelCardEligibilityDecision(candidate, characterOrActor, { rules: rules, profile: profile });
      if (decision.ok) return true;
      filtered.push({
        actionId: decision.snapshot?.sourceActionId || candidate?.actionId || candidate?.id || "",
        label: decision.snapshot?.label || candidate?.label || candidate?.id || "",
        reason: decision.reason,
        characterId: profile.characterId,
        archetypes: profile.archetypes
      });
      return false;
    });
    recordFilteredDuelHandCandidates(options?.battle || getBattle(options?.duelState), characterOrActor, filtered);
    return kept;
  }

  function rankDuelHandCandidatesByCharacter(fullCandidates, preferredActions, actor, opponent, battle, choiceCount, options) {
    var preferredIndex = Object.create(null);
    (preferredActions || []).forEach(function indexPreferred(action, index) {
      var id = getActionId(action);
      if (id && preferredIndex[id] === undefined) preferredIndex[id] = index;
    });
    var rules = options?.rules || getDuelCharacterCardRules();
    var profile = buildDuelCharacterCardProfile(actor, { rules: rules });
    var filtered = filterDuelHandCandidatesByCharacter(fullCandidates, actor, { rules: rules, profile: profile, battle: battle });
    var weighted = applyDuelCharacterCardWeights(filtered, actor, { rules: rules, profile: profile });
    return weighted
      .map(function rankCandidate(candidate, index) {
        var id = getActionId(candidate);
        var preferred = preferredIndex[id] !== undefined;
        var pickerBonus = preferred ? Math.max(0, choiceCount + 3 - Number(preferredIndex[id] || 0) * 0.25) : 0;
        var availabilityBonus = candidate.available ? 2 : -3;
        var rankScore = Number(candidate.selectionWeight || 0) + pickerBonus + availabilityBonus - index * 0.001;
        return { candidate: candidate, rankScore: rankScore };
      })
      .sort(function sortRanked(a, b) {
        return b.rankScore - a.rankScore;
      })
      .map(function unwrap(entry) {
        return entry.candidate;
      });
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || 0));
  }

  function getChoiceCount(rules, requestedCount) {
    var handRules = rules || getDuelHandRules();
    var min = Number(handRules.hand?.minChoiceCount || 3);
    var max = Number(handRules.hand?.maxChoiceCount || 6);
    var fallback = Number(handRules.hand?.defaultChoiceCount || 5);
    var count = requestedCount === undefined ? fallback : Number(requestedCount);
    return Math.round(clamp(count, min, max));
  }

  function getMaxSelections(rules) {
    var handRules = rules || getDuelHandRules();
    var max = Number(handRules.hand?.maxSelectionsPerTurn || 1);
    return Math.max(1, Math.min(Math.round(max), 3));
  }

  function getBaseAp(rules) {
    var handRules = rules || getDuelHandRules();
    var base = Number(handRules.ap?.basePerTurn || 2);
    var max = Number(handRules.ap?.maxPerTurn || base || 2);
    return Math.max(1, Math.min(base, max));
  }

  function getMaxAp(rules) {
    var handRules = rules || getDuelHandRules();
    var base = getBaseAp(handRules);
    var max = Number(handRules.ap?.maxPerTurn || base);
    return Math.max(base, max);
  }

  function getTurnNumber(battle) {
    return Number(battle?.round || 0) + 1;
  }

  function initializeDuelHandState(battle, rules) {
    var activeBattle = getBattle(battle);
    if (!activeBattle) return null;
    activeBattle.actionPoints ||= {};
    ["left", "right"].forEach(function initializeSide(side) {
      if (!activeBattle.actionPoints[side]) resetDuelApForTurn(activeBattle, side, rules);
    });
    activeBattle.handCandidates ||= [];
    ensureSelectedHandActions(activeBattle);
    return activeBattle.actionPoints;
  }

  function ensureSelectedHandActions(battle) {
    if (!battle) return null;
    battle.selectedHandActions ||= {};
    ["left", "right"].forEach(function ensureSide(side) {
      if (!Array.isArray(battle.selectedHandActions[side])) battle.selectedHandActions[side] = [];
      battle.selectedHandActions[side] = battle.selectedHandActions[side].filter(function keepCurrentRound(entry) {
        return Number(entry?.selectedRound || 0) === getTurnNumber(battle);
      });
    });
    return battle.selectedHandActions;
  }

  function resetDuelApForTurn(battle, side, rules) {
    var activeBattle = getBattle(battle);
    if (!activeBattle) return null;
    var actorSide = side || "left";
    var handRules = rules || getDuelHandRules();
    activeBattle.actionPoints ||= {};
    var base = getBaseAp(handRules);
    var max = getMaxAp(handRules);
    activeBattle.actionPoints[actorSide] = {
      current: base,
      max: max,
      base: base,
      spent: 0,
      round: getTurnNumber(activeBattle),
      carryOver: Boolean(handRules.ap?.carryOver)
    };
    if (activeBattle.selectedHandActions?.[actorSide]) activeBattle.selectedHandActions[actorSide] = [];
    return activeBattle.actionPoints[actorSide];
  }

  function getDuelApState(battle, side, rules) {
    var activeBattle = getBattle(battle);
    if (!activeBattle) {
      var fallbackBase = getBaseAp(rules);
      return { current: fallbackBase, max: getMaxAp(rules), base: fallbackBase, spent: 0, round: 0, carryOver: false };
    }
    var actorSide = side || "left";
    initializeDuelHandState(activeBattle, rules);
    var state = activeBattle.actionPoints?.[actorSide];
    if (!state || state.round !== getTurnNumber(activeBattle)) {
      state = resetDuelApForTurn(activeBattle, actorSide, rules);
    }
    return state;
  }

  function spendDuelAp(battle, side, amount, options) {
    var activeBattle = getBattle(battle);
    var actorSide = side || "left";
    var cost = Math.max(1, Number(amount || 0));
    var state = getDuelApState(activeBattle, actorSide, options?.rules);
    if (!activeBattle || !state) return { ok: false, reason: "行动点状态缺失", current: 0, max: 0, spent: 0 };
    if (Number(state.current || 0) < cost) {
      return { ok: false, reason: "行动点不足", current: state.current, max: state.max, spent: 0 };
    }
    state.current = Number(Math.max(0, Number(state.current || 0) - cost).toFixed(3));
    state.spent = Number((Number(state.spent || 0) + cost).toFixed(3));
    return { ok: true, reason: "", current: state.current, max: state.max, spent: cost };
  }

  function refundDuelAp(battle, side, amount, rules) {
    var activeBattle = getBattle(battle);
    if (!activeBattle) return null;
    var apState = getDuelApState(activeBattle, side, rules);
    var refund = Math.max(0, Number(amount || 0));
    var cap = Number(apState.max || apState.base || 0);
    apState.current = Number(Math.min(cap, Number(apState.current || 0) + refund).toFixed(3));
    apState.spent = Number(Math.max(0, Number(apState.spent || 0) - refund).toFixed(3));
    return apState;
  }

  function getDuelActionApCost(action, actor, opponent, duelState) {
    var value = Number(action?.apCost);
    if (Number.isFinite(value) && value > 0) return Math.max(1, Math.round(value));
    var id = action?.id || "";
    if ([
      "domain_expand",
      "domain_force_sustain",
      "domain_clash",
      "request_verdict",
      "claim_jackpot",
      "forced_output"
    ].includes(id)) {
      return 2;
    }
    if (action?.effects?.activateDomain || action?.id === "domain_force_sustain") return 2;
    if (["high", "critical"].includes(action?.risk)) return 2;
    return 1;
  }

  function isZeroCeActor(actor) {
    if (!actor) return false;
    var profile = buildDuelCharacterCardProfile(actor);
    if (profile?.isZeroCe || profile?.hasCe === false || profile?.ceLimited === true) return true;
    var text = [
      actor?.id,
      actor?.characterId,
      actor?.name,
      actor?.displayName,
      actor?.profile?.id,
      actor?.profile?.characterId,
      actor?.profile?.name,
      actor?.profile?.displayName,
      actor?.profile?.notes
    ].concat(
      asList(actor?.flags),
      asList(actor?.traits),
      asList(actor?.profile?.flags),
      asList(actor?.profile?.traits)
    ).join(" ");
    return /零咒力|zero_ce|甚尔|真希/i.test(text);
  }

  function isZeroCeCostAction(action) {
    var id = action?.sourceActionId || action?.actionId || action?.id || "";
    if ([
      "zero_ce_domain_bypass",
      "zero_ce_entry",
      "sure_hit_bypass_counter",
      "cursed_tool_combo",
      "barrier_boundary_break"
    ].includes(id)) return true;
    var tags = [].concat(asList(action?.tags), asList(action?.archetypeHints), asList(action?.characterHints));
    if (includesAny(tags, ["zero_ce", "零咒力"])) return true;
    return Boolean(action?.requiresZeroCe || action?.requirements?.requiresZeroCeBypass);
  }

  function shouldUseZeroCeCost(action, actor) {
    return isZeroCeActor(actor) && isZeroCeCostAction(action);
  }

  function withZeroCeCostOverride(action, actor) {
    if (!shouldUseZeroCeCost(action, actor)) return action;
    return {
      ...(action || {}),
      costCe: 0,
      ceCost: 0,
      zeroCeCostOverride: true,
      cost: {
        ...(action?.cost || {}),
        flatCe: 0,
        minCe: 0,
        ceRatio: 0
      }
    };
  }

  function getCeCost(action, actor) {
    if (shouldUseZeroCeCost(action, actor)) return 0;
    if (Number.isFinite(Number(action?.costCe))) return Number(action.costCe);
    var getter = getOptionalFunction("getDuelActionCost");
    if (getter) return Number(getter(action, actor) || 0);
    return 0;
  }

  function getAvailability(action, actor, opponent, battle) {
    var checkedAction = withZeroCeCostOverride(action, actor);
    var fn = getOptionalFunction("getDuelActionAvailability");
    if (fn) {
      var availability = fn(checkedAction, actor, opponent, battle) || { available: false, reason: "不可用", costCe: getCeCost(checkedAction, actor) };
      if (shouldUseZeroCeCost(checkedAction, actor)) return { ...availability, costCe: 0, ceCost: 0 };
      return availability;
    }
    var costCe = getCeCost(checkedAction, actor);
    if (actor && Number(actor.ce || 0) < costCe) return { available: false, reason: "咒力不足", costCe: costCe };
    return { available: true, reason: "", costCe: costCe };
  }

  function createEffectText(action) {
    var effects = action?.effects || {};
    var parts = [];
    if (effects.outgoingScale && effects.outgoingScale !== 1) parts.push("输出调整");
    if (effects.incomingHpScale && effects.incomingHpScale !== 1) parts.push("承伤调整");
    if (effects.stabilityDelta) parts.push("稳定度变化");
    if (effects.domainLoadDelta || effects.domainLoadScale) parts.push("领域负荷变化");
    if (effects.opponentDomainLoadDelta) parts.push("干涉对方领域");
    if (effects.activateDomain) parts.push("展开领域");
    if (effects.releaseDomain) parts.push("解除领域");
    return parts.join(" / ") || action?.description || "调整本回合咒力节奏";
  }

  function isReadablePreviewText(value) {
    if (typeof value !== "string") return false;
    var text = value.trim();
    return Boolean(text) && !/(undefined|null|TODO|NaN)/i.test(text);
  }

  function cleanPreviewLines(lines) {
    return Array.from(new Set((lines || []).filter(isReadablePreviewText)));
  }

  function readFiniteNumber(sources, key) {
    for (var index = 0; index < sources.length; index += 1) {
      var source = sources[index];
      if (!source || !hasOwn(source, key)) continue;
      var value = Number(source[key]);
      if (Number.isFinite(value)) return value;
    }
    return null;
  }

  function formatSignedNumber(value) {
    var rounded = Number(value.toFixed(4));
    return (rounded > 0 ? "+" : "") + String(rounded);
  }

  function formatScaleNumber(value) {
    return Number(value.toFixed(2)).toString();
  }

  function formatSignedPercent(value) {
    var numeric = Number(value || 0);
    if (!Number.isFinite(numeric) || numeric === 0) return "";
    var percent = Number((numeric * 100).toFixed(Math.abs(numeric) < 0.01 ? 1 : 0));
    return (percent > 0 ? "+" : "") + String(percent) + "%";
  }

  function formatScalePercent(value) {
    var numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric === 1) return "";
    return formatSignedPercent(numeric - 1);
  }

  function pushKnownNumericPreview(preview, field, value) {
    if (!Number.isFinite(value)) return;
    if (field === "outgoingScale" && value !== 1) preview.riskPreview.push("输出倍率：" + formatScalePercent(value));
    if (field === "incomingHpScale" && value !== 1) preview.statusPreview.push("受到体势伤害：" + formatScalePercent(value));
    if (field === "stabilityDelta" && value !== 0) preview.statusPreview.push("稳定度：" + formatSignedPercent(value));
    if (field === "domainLoadDelta" && value !== 0) preview.resourcePreview.push("己方领域负荷 " + formatSignedNumber(value));
    if (field === "ceCost" && value > 0) preview.resourcePreview.push("消耗咒力 " + formatSignedNumber(value).replace(/^\+/, ""));
    if (field === "hpDamage" && value !== 0) preview.riskPreview.push("预计体势伤害 " + formatSignedNumber(value).replace(/^\+/, ""));
    if (field === "durationRounds" && value > 0) preview.statusPreview.push("持续 " + formatSignedNumber(value).replace(/^\+/, "") + " 回合");
  }

  function buildFallbackEffectPreview(actionOrCandidate, template, baseView, availabilityMessage) {
    var action = actionOrCandidate?.action || actionOrCandidate || {};
    var effects = action?.effects || {};
    var sources = [effects, action, baseView || {}, template || {}];
    var preview = {
      resourcePreview: [],
      statusPreview: [],
      riskPreview: [],
      conditionPreview: []
    };
    [
      "outgoingScale",
      "incomingHpScale",
      "stabilityDelta",
      "domainLoadDelta",
      "ceCost",
      "hpDamage",
      "durationRounds"
    ].forEach(function addNumericField(field) {
      var aliases = field === "ceCost" ? ["ceCost", "costCe"] : [field];
      var value = null;
      aliases.some(function findAlias(alias) {
        value = readFiniteNumber(sources, alias);
        return value !== null;
      });
      if (value !== null) pushKnownNumericPreview(preview, field, value);
    });
    if (effects.activateDomain) preview.conditionPreview.push("展开领域");
    if (effects.releaseDomain) preview.conditionPreview.push("解除领域");
    if (isReadablePreviewText(availabilityMessage) && availabilityMessage !== "可用") preview.conditionPreview.push(availabilityMessage);
    preview.resourcePreview = cleanPreviewLines(preview.resourcePreview);
    preview.statusPreview = cleanPreviewLines(preview.statusPreview);
    preview.riskPreview = cleanPreviewLines(preview.riskPreview);
    preview.conditionPreview = cleanPreviewLines(preview.conditionPreview);
    var resolvedEffectLines = cleanPreviewLines([]
      .concat(preview.resourcePreview)
      .concat(preview.statusPreview)
      .concat(preview.riskPreview)
      .concat(preview.conditionPreview));
    var summary = resolvedEffectLines[0] || baseView?.effectText || template?.effectSummary || action?.description || "沿用既有手法效果。";
    if (!isReadablePreviewText(summary)) summary = "沿用既有手法效果。";
    var sourceActionId = template?.sourceActionId || baseView?.actionId || action?.id || "";
    var debugFields = cleanPreviewLines([
      template?.cardId || sourceActionId ? "cardId:" + (template?.cardId || ("card_" + sourceActionId)) : "",
      sourceActionId ? "sourceActionId:" + sourceActionId : "",
      action?.id ? "actionId:" + action.id : ""
    ]);
    return {
      schema: "jjk-duel-effect-preview",
      version: "1.390A-combat-core-rationalization-pass",
      summary: summary,
      lines: resolvedEffectLines,
      resolvedEffectLines: resolvedEffectLines,
      resourcePreview: preview.resourcePreview,
      statusPreview: preview.statusPreview,
      riskPreview: preview.riskPreview,
      conditionPreview: preview.conditionPreview,
      debugFields: debugFields
    };
  }

  function createTags(action) {
    var tags = [];
    if (action?.domainSpecific) tags.push(action.domainRole || action.domainClass || "domain");
    if (action?.effects?.activateDomain || String(action?.id || "").startsWith("domain_")) tags.push("领域");
    if (action?.id === "residue_reading") tags.push("读解", "稳定");
    if (action?.id === "ce_compression") tags.push("稳定", "低消耗");
    if (action?.risk) tags.push(action.risk);
    return Array.from(new Set(tags.filter(Boolean)));
  }

  function getActorSide(actor, options) {
    return options?.side || actor?.side || "left";
  }

  function getSelectedCeCost(battle, side) {
    return getDuelSelectedHandActions(battle, side).reduce(function sumCost(total, entry) {
      return total + Number(entry?.ceCost || 0);
    }, 0);
  }

  function getActionFromEntry(entry) {
    return entry?.action || entry;
  }

  function getActionId(entry) {
    var action = getActionFromEntry(entry);
    return entry?.actionId || entry?.id || action?.id || "";
  }

  function isCandidateSelected(battle, side, actionId) {
    if (!battle || !actionId) return false;
    return getDuelSelectedHandActions(battle, side).some(function matchSelected(entry) {
      return getActionId(entry) === actionId;
    });
  }

  function wrapActionAsCandidate(action, actor, opponent, duelState, options) {
    var battle = getBattle(duelState);
    var availability = getAvailability(action, actor, opponent, battle);
    var ceCost = Number(availability.costCe ?? getCeCost(action, actor));
    var apCost = getDuelActionApCost(action, actor, opponent, battle);
    var side = getActorSide(actor, options);
    var apState = getDuelApState(battle, side, options?.rules);
    var apAvailable = Number(apState.current || 0) >= apCost;
    var selected = isCandidateSelected(battle, side, action?.id);
    var available = Boolean(availability.available) && !selected;
    var reason = availability.reason || "";
    if (selected) reason = "已选择";
    var candidate = {
      ...action,
      action: action,
      actionId: action?.id || "",
      apCost: apCost,
      ceCost: ceCost,
      costCe: ceCost,
      available: available,
      unavailableReason: available ? "" : (reason || "不可用"),
      riskLabel: action?.riskLabel || action?.risk || "风险未知",
      effectText: createEffectText(action),
      tags: createTags(action),
      source: "existing-action-pool",
      status: "CANDIDATE",
      selected: selected,
      selectionStatus: selected ? "selected" : (available ? "available" : "blocked"),
      legacyAp: {
        cost: apCost,
        current: Number(apState.current || 0),
        gating: false,
        exhausted: !apAvailable
      }
    };
    return candidate;
  }

  function buildDuelHandCandidates(actor, opponent, duelState, options) {
    var battle = getBattle(duelState);
    var pool = callDependency("buildDuelActionPool", [actor, opponent, battle]);
    var candidates = (pool || []).map(function mapAction(action) {
      return wrapActionAsCandidate(action, actor, opponent, battle, options);
    });
    var rules = options?.characterCardRules || getDuelCharacterCardRules();
    var profile = buildDuelCharacterCardProfile(actor, { rules: rules });
    var filtered = filterDuelHandCandidatesByCharacter(candidates, actor, { rules: rules, profile: profile, battle: battle });
    return applyDuelCharacterCardWeights(filtered, actor, { rules: rules, profile: profile });
  }

  function pickDuelHandCandidates(actor, opponent, duelState, count) {
    var battle = getBattle(duelState);
    var choiceCount = getChoiceCount(null, count);
    var picker = getOptionalFunction("pickDuelActionChoices");
    var rawPool = callDependency("buildDuelActionPool", [actor, opponent, battle]) || [];
    var fullCandidates = rawPool.map(function mapAction(action) {
      return wrapActionAsCandidate(action, actor, opponent, battle, { count: choiceCount });
    });
    var actions = picker
      ? picker(actor, opponent, battle, choiceCount)
      : fullCandidates.slice(0, choiceCount);
    var candidates = rankDuelHandCandidatesByCharacter(fullCandidates, actions, actor, opponent, battle, choiceCount, {});
    if (battle && actor?.side === "left") {
      battle.handCandidates = candidates.slice(0, choiceCount);
      buildDuelHandCandidateCache(battle, battle.handCandidates);
    }
    return candidates.slice(0, choiceCount);
  }

  function getDuelHandCardViewModel(candidate, actor, opponent, duelState) {
    var action = candidate?.action || candidate;
    var view = wrapActionAsCandidate(action, actor, opponent, duelState, { side: actor?.side || "left" });
    var baseView = {
      id: view.id,
      actionId: view.actionId || view.id,
      label: view.label || view.id || "未命名手札",
      apCost: Number(view.apCost || 1),
      ceCost: Number(view.ceCost ?? view.costCe ?? 0),
      effectText: view.effectText || createEffectText(action),
      risk: view.riskLabel || view.risk || "风险未知",
      tags: view.tags || createTags(action),
      available: Boolean(view.available),
      unavailableReason: view.unavailableReason || "",
      selected: Boolean(view.selected),
      selectionStatus: view.selectionStatus || (view.selected ? "selected" : (view.available ? "available" : "blocked")),
      status: view.status || action?.status || "CANDIDATE",
      source: view.source || "existing-action-pool",
      characterWeight: view.characterWeight || action?.characterWeight || "",
      characterCardArchetypes: view.characterCardArchetypes || action?.characterCardArchetypes || [],
      characterCardProfile: candidate?.characterCardProfile || view.characterCardProfile || action?.characterCardProfile || buildDuelCharacterCardProfile(actor),
      actor: actor,
      debug: {
        actionId: view.actionId || view.id,
        effectTags: view.tags || [],
        status: view.status || action?.status || "CANDIDATE",
        source: view.source || "existing-action-pool",
        weight: view.characterWeight ?? action?.characterWeight ?? action?.weight ?? action?.score ?? "",
        characterArchetypes: view.characterCardArchetypes || action?.characterCardArchetypes || [],
        domainClass: action?.domainClass || "",
        domainRole: action?.domainRole || ""
      }
    };
    return buildDuelCardViewModel(action, baseView);
  }

  function buildDuelCardViewModel(actionOrCandidate, baseView) {
    var builder = getOptionalFunction("buildDuelCardViewModel");
    if (!builder) return buildFallbackDuelCardViewModel(actionOrCandidate, baseView);
    var cardView = builder(actionOrCandidate, baseView) || {};
    return mergeDuelCardViewModel(baseView, cardView, actionOrCandidate);
  }

  function buildFallbackDuelCardViewModel(actionOrCandidate, baseView) {
    var templateGetter = getOptionalFunction("getDuelCardTemplateForAction");
    var action = actionOrCandidate?.action || actionOrCandidate;
    var template = templateGetter ? templateGetter(actionOrCandidate) : null;
    var sourceActionId = template?.sourceActionId || baseView?.actionId || action?.id || "";
    var cardType = template?.cardType || inferFallbackCardType(action);
    var rarity = template?.rarity || inferFallbackCardRarity(action, cardType);
    var effectPreview = buildFallbackEffectPreview(actionOrCandidate, template, baseView, baseView?.unavailableReason || "");
    return mergeDuelCardViewModel(baseView, {
      cardId: template?.cardId || ("card_" + sourceActionId),
      sourceActionId: sourceActionId,
      cardType: cardType,
      cardTypeLabel: template?.cardTypeLabel || fallbackCardTypeLabel(cardType),
      rarity: rarity,
      rarityLabel: template?.rarityLabel || rarity,
      tags: template?.tags || baseView?.tags || createTags(action),
      allowedContexts: template?.allowedContexts || ["normal"],
      effectText: baseView?.effectText || template?.effectSummary || action?.description || "",
      status: template?.status || baseView?.status || "CANDIDATE",
      source: template ? "card-template" : "existing-action-pool",
      effectPreview: effectPreview,
      resolvedEffectLines: effectPreview.resolvedEffectLines,
      resourcePreview: effectPreview.resourcePreview,
      statusPreview: effectPreview.statusPreview,
      riskPreview: effectPreview.riskPreview,
      conditionPreview: effectPreview.conditionPreview,
      debugFields: effectPreview.debugFields,
      debug: {
        cardId: template?.cardId || ("card_" + sourceActionId),
        sourceActionId: sourceActionId,
        allowedContexts: template?.allowedContexts || ["normal"]
      }
    }, actionOrCandidate);
  }

  function mergeDuelCardViewModel(baseView, cardView, actionOrCandidate) {
    var action = actionOrCandidate?.action || actionOrCandidate;
    var mergedTags = Array.from(new Set([].concat(cardView?.tags || [], baseView?.tags || []).filter(Boolean)));
    var sourceActionId = cardView?.sourceActionId || baseView?.actionId || action?.id || "";
    var cardId = cardView?.cardId || ("card_" + sourceActionId);
    var effectPreview = cardView?.effectPreview || buildFallbackEffectPreview(actionOrCandidate, cardView, baseView, cardView?.availabilityMessage || baseView?.unavailableReason || "");
    return {
      ...(baseView || {}),
      ...(cardView || {}),
      id: baseView?.id || cardView?.id || action?.id || sourceActionId,
      actionId: baseView?.actionId || cardView?.actionId || action?.id || sourceActionId,
      label: cardView?.displayName || cardView?.label || baseView?.label || cardView?.name || action?.label || "未命名手札",
      displayName: cardView?.displayName || cardView?.label || baseView?.label || action?.label || "未命名手札",
      subtitle: cardView?.subtitle || "",
      cardId: cardId,
      sourceActionId: sourceActionId,
      cardType: cardView?.cardType || inferFallbackCardType(action),
      cardTypeLabel: cardView?.cardTypeLabel || fallbackCardTypeLabel(cardView?.cardType || inferFallbackCardType(action)),
      rarity: cardView?.rarity || inferFallbackCardRarity(action, cardView?.cardType),
      rarityLabel: cardView?.rarityLabel || cardView?.rarity || inferFallbackCardRarity(action, cardView?.cardType),
      tags: mergedTags,
      uiTags: Array.isArray(cardView?.uiTags) && cardView.uiTags.length ? cardView.uiTags.slice(0, 4) : mergedTags.slice(0, 4),
      effectText: cardView?.shortEffect || cardView?.effectText || baseView?.effectText || cardView?.effectSummary || action?.description || "沿用既有手法效果。",
      shortEffect: cardView?.shortEffect || cardView?.effectText || baseView?.effectText || cardView?.effectSummary || action?.description || "沿用既有手法效果。",
      longEffect: cardView?.longEffect || cardView?.effectSummary || action?.description || "",
      flavorLine: cardView?.flavorLine || "",
      riskLabel: cardView?.riskLabel || baseView?.riskLabel || baseView?.risk || action?.risk || "风险未知",
      availabilityMessage: cardView?.availabilityMessage || baseView?.unavailableReason || "",
      status: cardView?.status || baseView?.status || "CANDIDATE",
      source: cardView?.source || baseView?.source || "existing-action-pool",
      effectPreview: effectPreview,
      resolvedEffectLines: effectPreview.resolvedEffectLines,
      resourcePreview: effectPreview.resourcePreview,
      statusPreview: effectPreview.statusPreview,
      riskPreview: effectPreview.riskPreview,
      conditionPreview: effectPreview.conditionPreview,
      debugFields: effectPreview.debugFields,
      debug: {
        ...(baseView?.debug || {}),
        ...(cardView?.debug || {}),
        cardId: cardId,
        sourceActionId: sourceActionId,
        cardType: cardView?.cardType || inferFallbackCardType(action),
        rarity: cardView?.rarity || inferFallbackCardRarity(action, cardView?.cardType),
        allowedContexts: cardView?.allowedContexts || cardView?.debug?.allowedContexts || ["normal"],
        mechanicIds: action?.mechanicIds || cardView?.mechanicIds || []
      }
    };
  }

  function inferFallbackCardType(action) {
    var id = action?.id || "";
    if (action?.domainSpecific) {
      if (["defend", "remain_silent", "deny_charge", "challenge_evidence", "delay_trial"].includes(id)) return "rule_defense";
      if (["advance_jackpot", "raise_probability", "risk_spin", "stabilize_cycle", "claim_jackpot"].includes(id)) return "jackpot";
      return "rule_trial";
    }
    if (id === "domain_expand") return "domain";
    if (["domain_compress", "domain_force_sustain", "domain_release"].includes(id)) return "domain_maintenance";
    if (id.includes("domain") || id.includes("basket") || id.includes("blossom") || id.includes("bypass")) return "domain_response";
    if (id === "defensive_frame") return "defense";
    if (id === "ce_compression") return "resource";
    if (id === "residue_reading") return "support";
    if (id.includes("technique") || id.includes("forced")) return "technique";
    return "basic";
  }

  function inferFallbackCardRarity(action, cardType) {
    if (["domain", "domain_maintenance", "domain_response"].includes(cardType)) return "domain";
    if (["rule_trial", "rule_defense", "jackpot"].includes(cardType)) return "rule";
    if (action?.risk === "critical") return "special";
    if (action?.risk === "high") return "rare";
    if (action?.risk === "medium") return "uncommon";
    return "common";
  }

  function fallbackCardTypeLabel(cardType) {
    var labels = {
      basic: "基础",
      defense: "防御",
      technique: "术式",
      domain: "领域",
      domain_response: "领域应对",
      domain_maintenance: "领域维持",
      rule_trial: "审判推进",
      rule_defense: "审判防御",
      jackpot: "坐杀搏徒",
      resource: "资源",
      support: "支援",
      special: "特殊"
    };
    return labels[cardType] || cardType || "未知";
  }

  function findCandidateById(battle, actionOrId) {
    if (!battle) return null;
    var id = typeof actionOrId === "string" ? actionOrId : actionOrId?.id || actionOrId?.actionId || "";
    var cached = getDuelHandCandidateById(battle, id);
    if (cached) return cached;
    return (battle.handCandidates || battle.actionChoices || []).find(function findMatch(item) {
      return item?.id === id || item?.actionId === id || item?.action?.id === id;
    }) || null;
  }

  function getDuelSelectedHandActions(battle, side) {
    var activeBattle = getBattle(battle);
    if (!activeBattle) return [];
    ensureSelectedHandActions(activeBattle);
    var actorSide = side || "left";
    return (activeBattle.selectedHandActions?.[actorSide] || []).filter(function keepCurrentRound(entry) {
      return Number(entry?.selectedRound || 0) === getTurnNumber(activeBattle);
    });
  }

  function canSelectDuelHandCandidate(actionOrId, actor, opponent, duelState, options) {
    var battle = getBattle(duelState);
    if (!battle || !actor || !opponent) {
      return { ok: false, reason: "战斗资源缺失" };
    }
    initializeDuelHandState(battle, options?.rules);
    var side = getActorSide(actor, options);
    var candidate = typeof actionOrId === "string" ? findCandidateById(battle, actionOrId) : actionOrId;
    var action = candidate?.action || candidate;
    if (!action?.id) return { ok: false, reason: "手札不存在" };
    var selected = getDuelSelectedHandActions(battle, side);
    if (selected.some(function alreadySelected(entry) {
      return getActionId(entry) === action.id;
    })) {
      return { ok: false, reason: "本回合已选择", action: action };
    }
    var maxSelections = getMaxSelections(options?.rules);
    if (selected.length >= maxSelections) {
      return { ok: false, reason: "本回合手札选择数已达上限", action: action, maxSelections: maxSelections };
    }
    var availability = getAvailability(action, actor, opponent, battle);
    var ceCost = Number(availability.costCe ?? getCeCost(action, actor));
    var apCost = getDuelActionApCost(action, actor, opponent, battle);
    if (!availability.available) {
      return { ok: false, reason: availability.reason || "当前状态不可用", action: action, apCost: apCost, ceCost: ceCost };
    }
    if (Number(actor.ce || 0) < getSelectedCeCost(battle, side) + ceCost) {
      return { ok: false, reason: "咒力不足", action: action, apCost: apCost, ceCost: ceCost };
    }
    var apState = getDuelApState(battle, side, options?.rules);
    return {
      ok: true,
      reason: "",
      action: action,
      candidate: candidate,
      apCost: apCost,
      ceCost: ceCost,
      selectedCount: selected.length,
      maxSelections: maxSelections,
      ap: apState,
      legacyAp: {
        cost: apCost,
        current: Number(apState.current || 0),
        gating: false,
        exhausted: Number(apState.current || 0) < apCost
      }
    };
  }

  function selectDuelHandCandidate(actionOrId, actor, opponent, duelState, options) {
    var battle = getBattle(duelState);
    var check = canSelectDuelHandCandidate(actionOrId, actor, opponent, battle, options || {});
    if (!check.ok) return { selected: false, ...check };
    var side = getActorSide(actor, options);
    var apSpend = {
      ok: true,
      legacy: true,
      gating: false,
      cost: check.apCost,
      current: Number(check.ap?.current || 0),
      reason: "AP 已降级为 legacy 显示，不再阻止普通手札。"
    };
    ensureSelectedHandActions(battle);
    var entry = {
      id: check.action.id,
      actionId: check.action.id,
      label: check.action.label || check.action.id,
      action: withZeroCeCostOverride(check.action, actor),
      apCost: check.apCost,
      ceCost: check.ceCost,
      source: "existing-action-pool",
      status: "CANDIDATE",
      selectedRound: getTurnNumber(battle),
      side: side
    };
    battle.selectedHandActions[side].push(entry);
    return { selected: true, reason: "", entry: entry, action: check.action, ap: apSpend, legacyAp: apSpend };
  }

  function unselectDuelHandCandidate(actionOrId, actor, opponent, duelState, options) {
    var battle = getBattle(duelState);
    if (!battle) return { unselected: false, reason: "战斗资源缺失" };
    var side = getActorSide(actor, options);
    ensureSelectedHandActions(battle);
    var id = typeof actionOrId === "string" ? actionOrId : actionOrId?.id || actionOrId?.actionId || actionOrId?.action?.id || "";
    var list = battle.selectedHandActions?.[side] || [];
    var index = list.findIndex(function findEntry(entry) {
      return getActionId(entry) === id;
    });
    if (index < 0) return { unselected: false, reason: "未选择该手札" };
    var entry = list.splice(index, 1)[0];
    var apState = getDuelApState(battle, side, options?.rules);
    return { unselected: true, reason: "", entry: entry, ap: apState, legacyAp: { cost: Number(entry?.apCost || 0), gating: false } };
  }

  function clearDuelSelectedHandActions(battle, side, options) {
    var activeBattle = getBattle(battle);
    if (!activeBattle) return { cleared: false, reason: "战斗资源缺失" };
    ensureSelectedHandActions(activeBattle);
    var sides = side ? [side] : ["left", "right"];
    var cleared = 0;
    sides.forEach(function clearSide(actorSide) {
      var list = activeBattle.selectedHandActions?.[actorSide] || [];
      cleared += list.length;
      activeBattle.selectedHandActions[actorSide] = [];
    });
    return { cleared: true, count: cleared };
  }

  function applyDuelSelectedHandActions(actor, opponent, duelState, options) {
    var battle = getBattle(duelState);
    if (!battle || !actor || !opponent) return { applied: false, reason: "战斗资源缺失", actions: [], results: [] };
    var side = getActorSide(actor, options);
    var selected = normalizeSelectedForExecution(options?.actions || getDuelSelectedHandActions(battle, side), actor, opponent, battle, options);
    if (!selected.length) return { applied: false, reason: "尚未选择手札", actions: [], results: [] };
    var preflight = validateDuelSelectedForExecution(actor, opponent, battle, side, selected, options);
    if (!preflight.ok) return preflight;
    selected = preflight.entries;
    var results = [];
    var appliedActions = [];
    for (var index = 0; index < selected.length; index += 1) {
      var entry = selected[index];
      var action = getActionFromEntry(entry);
      if (!action?.id) continue;
      var actionForExecution = withZeroCeCostOverride(action, actor);
      var result = callDependency("applyDuelActionEffect", [actionForExecution, actor, opponent, battle]);
      results.push({ applied: Boolean(result), reason: result ? "" : "动作未结算", action: actionForExecution, result: result });
      if (result) appliedActions.push(actionForExecution);
    }
    if (appliedActions.length && options?.clearAfter !== false) clearDuelSelectedHandActions(battle, side, { refund: false, rules: options?.rules });
    return {
      applied: appliedActions.length > 0,
      reason: appliedActions.length ? "" : "没有可结算手札",
      side: side,
      actions: appliedActions,
      results: results,
      totalApCost: selected.reduce(function sumAp(total, entry) { return total + Number(entry?.apCost || 0); }, 0),
      totalCeCost: preflight.totalCeCost,
      ap: getDuelApState(battle, side, options?.rules)
    };
  }

  function normalizeSelectedForExecution(entries, actor, opponent, battle, options) {
    return (entries || []).map(function normalizeEntry(entry) {
      var action = getActionFromEntry(entry);
      var actionId = getActionId(entry);
      var actionForCost = withZeroCeCostOverride(action, actor);
      var ceCost = Number(entry?.ceCost ?? getCeCost(actionForCost, actor));
      var apCost = Number(entry?.apCost ?? getDuelActionApCost(action, actor, opponent, battle));
      return {
        ...(entry || {}),
        id: actionId,
        actionId: actionId,
        label: entry?.label || action?.label || actionId,
        action: actionForCost,
        apCost: apCost,
        ceCost: ceCost,
        selectedRound: entry?.selectedRound,
        side: entry?.side || getActorSide(actor, options)
      };
    });
  }

  function validateDuelSelectedForExecution(actor, opponent, battle, side, entries, options) {
    var seen = new Set();
    var totalCeCost = 0;
    var results = [];
    for (var index = 0; index < entries.length; index += 1) {
      var entry = entries[index];
      var action = getActionFromEntry(entry);
      var actionId = getActionId(entry);
      if (!action?.id || !actionId) {
        return { applied: false, ok: false, reason: "手札不存在", side: side, actions: [], results: results, totalCeCost: totalCeCost };
      }
      if (seen.has(actionId)) {
        return { applied: false, ok: false, reason: "本回合已选择", side: side, actions: entries.map(getActionFromEntry), results: results, totalCeCost: totalCeCost };
      }
      seen.add(actionId);
      if (entry.selectedRound && Number(entry.selectedRound) !== getTurnNumber(battle)) {
        return { applied: false, ok: false, reason: "手札回合已过期", side: side, actions: entries.map(getActionFromEntry), results: results, totalCeCost: totalCeCost };
      }
      var availability = getAvailability(action, actor, opponent, battle);
      var ceCost = Number(entry.ceCost ?? availability.costCe ?? getCeCost(action, actor));
      totalCeCost += ceCost;
      if (!availability.available) {
        return {
          applied: false,
          ok: false,
          reason: availability.reason || "当前状态不可用",
          side: side,
          actions: entries.map(getActionFromEntry),
          results: [{ applied: false, reason: availability.reason || "当前状态不可用", action: action }],
          totalCeCost: totalCeCost
        };
      }
    }
    if (Number(actor.ce || 0) < totalCeCost) {
      return { applied: false, ok: false, reason: "咒力不足", side: side, actions: entries.map(getActionFromEntry), results: [], totalCeCost: totalCeCost };
    }
    return { ok: true, entries: entries, totalCeCost: totalCeCost };
  }

  function pickDuelCpuHandActions(actor, opponent, duelState, options) {
    var battle = getBattle(duelState);
    if (!battle || !actor || !opponent) return [];
    var side = getActorSide(actor, { side: options?.side || actor.side || "right" });
    resetDuelApForTurn(battle, side, options?.rules);
    clearDuelSelectedHandActions(battle, side, { refund: false, rules: options?.rules });
    var rules = options?.rules || getDuelHandRules();
    var count = getChoiceCount(rules, options?.count);
    var candidates = pickDuelHandCandidates(actor, opponent, battle, count);
    var firstPick = null;
    var cpuPicker = getOptionalFunction("getDuelCpuAction");
    if (cpuPicker) firstPick = cpuPicker(actor, opponent, battle);
    var ordered = [];
    if (getActionId(firstPick)) ordered.push(firstPick);
    candidates.forEach(function addCandidate(candidate) {
      var actionId = getActionId(candidate);
      if (actionId && !ordered.some(function duplicate(item) { return getActionId(item) === actionId; })) ordered.push(candidate);
    });
    var maxSelections = getMaxSelections(rules);
    ordered.some(function selectCandidate(candidate) {
      var action = getActionFromEntry(candidate);
      if (!action?.id) return false;
      if (getDuelSelectedHandActions(battle, side).length >= maxSelections) return true;
      if (action.risk === "critical" && getDuelSelectedHandActions(battle, side).length > 0) return false;
      var selected = selectDuelHandCandidate(candidate, actor, opponent, battle, { side: side, rules: rules });
      if (!selected.selected && selected.reason === "咒力不足") return true;
      return false;
    });
    return getDuelSelectedHandActions(battle, side);
  }

  function resolveDuelHandTurn(battle, options) {
    var activeBattle = getBattle(battle);
    if (!activeBattle?.resourceState) return { ok: false, reason: "战斗资源缺失" };
    var left = activeBattle.resourceState.p1;
    var right = activeBattle.resourceState.p2;
    if (!getDuelSelectedHandActions(activeBattle, "right").length && options?.autoPickCpu !== false) {
      pickDuelCpuHandActions(right, left, activeBattle, { side: "right", rules: options?.rules });
    }
    var leftResult = applyDuelSelectedHandActions(left, right, activeBattle, { side: "left", rules: options?.rules });
    var rightResult = applyDuelSelectedHandActions(right, left, activeBattle, { side: "right", rules: options?.rules });
    activeBattle.currentActions = leftResult.actions || [];
    activeBattle.cpuActions = rightResult.actions || [];
    activeBattle.currentAction = activeBattle.currentActions[0] || null;
    activeBattle.cpuAction = activeBattle.cpuActions[0] || null;
    return {
      ok: Boolean(leftResult.applied || rightResult.applied),
      reason: leftResult.applied || rightResult.applied ? "" : (leftResult.reason || rightResult.reason || "没有可结算手札"),
      left: leftResult,
      right: rightResult
    };
  }

  function applyDuelHandSelection(actionOrId, actor, opponent, duelState, options) {
    var battle = getBattle(duelState);
    if (!battle || !actor || !opponent) {
      return { applied: false, reason: "战斗资源缺失" };
    }
    var candidate = typeof actionOrId === "string" ? findCandidateById(battle, actionOrId) : actionOrId;
    var action = candidate?.action || candidate;
    if (!action?.id) return { applied: false, reason: "手札不存在" };
    var availability = getAvailability(action, actor, opponent, battle);
    var ceCost = Number(availability.costCe ?? getCeCost(action, actor));
    if (!availability.available) {
      return { applied: false, reason: availability.reason || "不可执行", action: action, apCost: getDuelActionApCost(action, actor, opponent, battle), ceCost: ceCost };
    }
    if (Number(actor.ce || 0) < ceCost) {
      return { applied: false, reason: "咒力不足", action: action, apCost: getDuelActionApCost(action, actor, opponent, battle), ceCost: ceCost };
    }
    var apCost = getDuelActionApCost(action, actor, opponent, battle);
    var apSpend = {
      ok: true,
      legacy: true,
      gating: false,
      cost: apCost,
      reason: "AP 已降级为 legacy 显示，不再阻止普通手札。"
    };
    action = withZeroCeCostOverride(action, actor);
    var result = callDependency("applyDuelActionEffect", [action, actor, opponent, battle]);
    return {
      applied: true,
      reason: "",
      action: action,
      apCost: apCost,
      ceCost: Number(result?.costCe ?? ceCost),
      ap: apSpend,
      result: result
    };
  }

  var api = {
    metadata: Object.freeze({
      namespace: namespace,
      version: version,
      layer: "duel-hand",
      moduleFormat: "classic-script-iife",
      scriptType: "classic",
      behavior: "implementation",
      ownsBehavior: true,
      status: "CANDIDATE"
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
    registerDependencies: registerDependencies,
    configure: configure,
    hasDependency: hasDependency,
    listDependencies: listDependencies,
    clearDependencies: clearDependencies,
    getDuelHandRules: getDuelHandRules,
    initializeDuelHandState: initializeDuelHandState,
    buildDuelHandCandidates: buildDuelHandCandidates,
    pickDuelHandCandidates: pickDuelHandCandidates,
    getDuelHandCardViewModel: getDuelHandCardViewModel,
    buildDuelCardViewModel: buildDuelCardViewModel,
    applyDuelHandSelection: applyDuelHandSelection,
    getDuelSelectedHandActions: getDuelSelectedHandActions,
    canSelectDuelHandCandidate: canSelectDuelHandCandidate,
    selectDuelHandCandidate: selectDuelHandCandidate,
    unselectDuelHandCandidate: unselectDuelHandCandidate,
    applyDuelSelectedHandActions: applyDuelSelectedHandActions,
    resolveDuelHandTurn: resolveDuelHandTurn,
    clearDuelSelectedHandActions: clearDuelSelectedHandActions,
    pickDuelCpuHandActions: pickDuelCpuHandActions,
    getDuelActionApCost: getDuelActionApCost,
    getDuelApState: getDuelApState,
    spendDuelAp: spendDuelAp,
    resetDuelApForTurn: resetDuelApForTurn,
    getDuelCharacterCardRules: getDuelCharacterCardRules,
    buildDuelCharacterCardProfile: buildDuelCharacterCardProfile,
    getDuelCharacterArchetypes: getDuelCharacterArchetypes,
    isDuelCardEligibleForCharacter: isDuelCardEligibleForCharacter,
    isDuelActionEligibleForCharacter: isDuelActionEligibleForCharacter,
    applyDuelCharacterCardWeights: applyDuelCharacterCardWeights,
    filterDuelHandCandidatesByCharacter: filterDuelHandCandidatesByCharacter,
    explainDuelCardIneligibility: explainDuelCardIneligibility,
    buildDuelHandCandidateCache: buildDuelHandCandidateCache,
    getDuelHandCandidateCache: getDuelHandCandidateCache,
    getDuelHandCandidateById: getDuelHandCandidateById,
    invalidateDuelHandCandidateCache: invalidateDuelHandCandidateCache,
    getDuelHandCandidateCacheStats: function getDuelHandCandidateCacheStats() {
      return {
        lastInvalidatedAt: handCandidateCacheStats.lastInvalidatedAt
      };
    }
  };

  global[namespace] = api;
})(globalThis);
