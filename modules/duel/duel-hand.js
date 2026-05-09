(function attachDuelHand(global) {
  "use strict";

  var namespace = "JJKDuelHand";
  var version = "1.395-defeat-action-lock";
  var expectedExports = [
    "getDuelHandRules",
    "initializeDuelHandState",
    "buildDuelHandCandidates",
    "pickDuelHandCandidates",
    "pickDuelDomainHandCandidates",
    "getDuelHandCardViewModel",
    "buildDuelCardViewModel",
    "applyDuelHandSelection",
    "getDuelSelectedHandActions",
    "canSelectDuelHandCandidate",
    "selectDuelHandCandidate",
    "unselectDuelHandCandidate",
    "discardDuelHandCandidate",
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
  var domainControlHandActionIds = new Set([
    "domain_expand",
    "domain_compress",
    "domain_force_sustain",
    "domain_release",
    "domain_clash",
    "simple_domain_guard",
    "hollow_wicker_basket_guard",
    "falling_blossom_emotion",
    "zero_ce_domain_bypass",
    "domain_survival_guard"
  ]);
  var domainControlHandTags = new Set([
    "domain_access",
    "domain_activation",
    "domain_maintenance",
    "domain_response",
    "simple_domain",
    "hollow_wicker_basket",
    "falling_blossom_emotion",
    "zero_ce_domain_bypass",
    "领域操控",
    "领域展开",
    "领域对抗",
    "简易领域",
    "弥虚葛笼",
    "弥须葛笼",
    "落花之情",
    "必中规避"
  ]);

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
      : [].concat(activeBattle.handCandidates || activeBattle.actionChoices || [], activeBattle.domainHandCandidates || []);
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
    var candidates = [].concat(activeBattle.handCandidates || activeBattle.actionChoices || [], activeBattle.domainHandCandidates || []);
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
        defaultChoiceCount: 8,
        minChoiceCount: 3,
        maxChoiceCount: 8,
        maxHandSize: 8,
        drawPerTurn: 5,
        overflowDiscardMode: "auto_low_priority_candidate",
        discardFromRemainingAndNew: true,
        selectionMode: "multi_action_ap_beta",
        allowMultipleSelectionsPerTurn: true,
        maxSelectionsPerTurn: 3,
        disableSelectedCandidate: true,
        requireManualResolve: true
      },
      domainHand: {
        enabled: true,
        maxHandSize: 3,
        refreshEachRound: true,
        excludeFromNormalHandLimit: true,
        specialDomainWeightBonus: 2,
        domainAccessWeightBonus: 1
      },
      ap: { basePerTurn: 2, maxPerTurn: 3, carryOver: false },
      cpuDifficulty: {
        default: "normal",
        options: {
          easy: { label: "简单：陪练", beamWidth: 1, scoreNoise: 0.2, mistakeRate: 0.2 },
          normal: { label: "普通：稳定", beamWidth: 3, scoreNoise: 0, mistakeRate: 0 },
          hard: { label: "困难：强规划", beamWidth: 5, scoreNoise: 0, mistakeRate: 0 }
        }
      },
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

  var exclusiveHandTagArchetypeRules = [
    { archetype: "gojo_limitless", tokens: ["gojo_limitless", "gojo", "五条", "无下限", "无限", "不可侵", "苍", "赫", "茈", "紫", "虚式", "无限虚式", "无量空处", "limitless", "infinity", "blue", "red", "hollow_purple", "unlimited_void"] },
    { archetype: "sukuna_slash", tokens: ["sukuna_slash", "sukuna", "宿傩", "两面宿傩", "御厨子", "伏魔御厨子", "捌", "斩击", "切割", "火箭", "slash", "cleave", "dismantle", "shrine", "malevolent_shrine", "open_domain"] },
    { archetype: "higuruma_trial_owner", tokens: ["higuruma_trial_owner", "日车", "审判", "裁判", "没收", "处刑人之剑", "judgeman", "confiscation", "executioner"] },
    { archetype: "hakari_jackpot_owner", tokens: ["hakari_jackpot_owner", "秤金次", "坐杀博徒", "大中奖", "jackpot", "hakari", "pachinko", "idle_death_gamble"] },
    { archetype: "ten_shadows", tokens: ["ten_shadows", "十种影法术", "十影", "玉犬", "鵺", "满象", "脱兔", "魔虚罗", "八握剑", "mahoraga", "shadow_garden"] },
    { archetype: "mahito_soul_transfiguration", tokens: ["mahito_soul_transfiguration", "真人", "无为转变", "灵魂改造", "自闭圆顿裹", "mahito", "idle_transfiguration"] },
    { archetype: "okkotsu_rika_copy", tokens: ["okkotsu_rika_copy", "乙骨", "里香", "纯爱", "复制术式", "rika", "okkotsu", "copy_technique"] },
    { archetype: "zero_ce_heavenly_restriction", tokens: ["zero_ce_heavenly_restriction", "天与咒缚", "零咒力", "甚尔", "真希", "heavenly_restriction", "zero_ce"] },
    { archetype: "recontract_icon", tokens: ["recontract_icon", "再契象征", "契约再现", "reggie", "receipt_contract"] }
  ];

  function getExclusiveArchetypesFromHandTags(snapshot) {
    var scanText = uniqueList([]
      .concat(asList(snapshot?.tags))
      .concat(asList(snapshot?.specialHandTags))
      .concat(asList(snapshot?.exclusiveToArchetypes))
      .concat(asList(snapshot?.sourceTechniqueFamily))
      .concat(asList(snapshot?.sourceActionId))
      .concat(asList(snapshot?.cardId))
      .concat(asList(snapshot?.label))).join(" ").toLowerCase();
    if (!scanText) return [];
    return uniqueList(exclusiveHandTagArchetypeRules.filter(function matchesRule(rule) {
      return rule.tokens.some(function hasToken(token) {
        var normalized = String(token || "").trim().toLowerCase();
        return normalized && scanText.includes(normalized);
      });
    }).map(function toArchetype(rule) {
      return rule.archetype;
    }));
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
      source?.technique,
      source?.techniqueName,
      source?.domainProfile,
      source?.techniqueText,
      source?.externalResource,
      source?.notes
    ].concat(
      asList(source?.innateTraits),
      asList(source?.advancedTechniques),
      asList(source?.loadout),
      asList(source?.flags),
      asList(source?.traits),
      asList(source?.techniqueFamilies),
      asList(source?.archetypes),
      asList(source?.specialHandTags),
      asList(source?.["特殊手札"])
    ).join(" ");
    var traits = [];
    if (/零咒力|天与|真希|甚尔/i.test(text)) traits.push("zero_ce", "零咒力", "heavenly_restriction", "天与咒缚", "physical", "体术", "cursed_tool", "咒具");
    if (/咒具|释魂刀|天逆|游云|黑绳|万里锁/i.test(text)) traits.push("cursed_tool", "咒具");
    if (/咒灵之躯|咒灵|灾害/i.test(text)) traits.push("curse", "咒灵");
    if (/领域展开|开放领域|顶级领域|坐杀搏徒|无量空处|伏魔御厨子|自闭圆顿裹|诛伏赐死|真赝相爱|嵌合暗翳庭/i.test(text)) traits.push("domain", "领域");
    if (/无下限|五条/i.test(text)) traits.push("limitless", "gojo", "五条", "无下限");
    if (/六眼|six[_\s-]?eyes/i.test(text)) traits.push("six_eyes", "六眼");
    if (/宿傩|伏魔御厨子|御厨子|斩击/i.test(text)) traits.push("sukuna", "shrine", "slash", "宿傩", "斩击");
    if (/日车|诛伏赐死|审判|规则类/i.test(text)) traits.push("trial", "judgment", "日车", "审判");
    if (/秤|坐杀搏徒|中奖/i.test(text)) traits.push("jackpot", "hakari", "秤");
    if (/虎杖|虎天帝|itadori|逕庭拳|黑闪|灵魂打击|半人半咒/i.test(text)) traits.push("yuji", "itadori", "虎杖", "体术", "灵魂打击", "black_flash_window");
    if (hasTenShadowsEvidence(text)) traits.push("ten_shadows", "shikigami", "shadow", "伏黑惠", "式神", "影");
    else if (hasGenericSummonEvidence(text)) traits.push("summon", "shikigami", "式神", "召唤物");
    if (/真人|灵魂|无为转变|自闭圆顿裹/i.test(text)) traits.push("mahito", "soul", "真人", "灵魂");
    if (/乙骨|里香|真赝相爱|复制/i.test(text)) traits.push("okkotsu", "rika", "copy_candidate", "乙骨", "里香");
    if (/雷吉|レジィ|reggie|再契象|契约再现|收据|receipt|recontract/i.test(text)) traits.push("recontract_icon", "recontract", "receipt", "再契象", "收据", "实物具现");
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
      source?.technique,
      source?.techniqueName,
      source?.domainProfile,
      source?.techniqueText,
      source?.notes
    ].concat(
      asList(source?.innateTraits),
      asList(source?.flags),
      asList(source?.loadout),
      asList(source?.traits),
      asList(source?.techniqueFamilies),
      asList(source?.archetypes),
      asList(source?.specialHandTags),
      asList(source?.["特殊手札"])
    ).join(" ");
    var archetypes = asList(entry?.rules?.archetypes);
    if (/零咒力|天与|真希|甚尔/i.test(text) && !archetypes.includes("zero_ce_heavenly_restriction")) archetypes.push("zero_ce_heavenly_restriction");
    if (/宿傩|御厨子|伏魔|斩击/i.test(text) && !archetypes.includes("sukuna_slash")) archetypes.push("sukuna_slash");
    if (/五条|无下限|无量空处|gojo|limitless/i.test(text) && !archetypes.includes("gojo_limitless")) archetypes.push("gojo_limitless");
    if (/日车|诛伏赐死|审判/i.test(text) && !archetypes.includes("higuruma_trial_owner")) archetypes.push("higuruma_trial_owner");
    if (/秤|坐杀搏徒|中奖/i.test(text) && !archetypes.includes("hakari_jackpot_owner")) archetypes.push("hakari_jackpot_owner");
    if (/虎杖|虎天帝|itadori|逕庭拳|黑闪|灵魂打击|半人半咒/i.test(text) && !archetypes.includes("yuji_soul_melee")) archetypes.push("yuji_soul_melee");
    if (hasTenShadowsEvidence(text) && !archetypes.includes("ten_shadows")) archetypes.push("ten_shadows");
    if (/真人|无为转变|灵魂/i.test(text) && !archetypes.includes("mahito_soul_transfiguration")) archetypes.push("mahito_soul_transfiguration");
    if (/乙骨|里香|复制/i.test(text) && !archetypes.includes("okkotsu_rika_copy")) archetypes.push("okkotsu_rika_copy");
    if (/咒灵之躯|灾害咒灵|咒灵/i.test(text) && !archetypes.includes("curse_spirit_general")) archetypes.push("curse_spirit_general");
    if (/雷吉|レジィ|reggie|再契象|契约再现|收据|receipt|recontract/i.test(text) && !archetypes.includes("recontract_icon")) archetypes.push("recontract_icon");
    return uniqueList(archetypes);
  }

  function hasTenShadowsEvidence(text) {
    var value = String(text || "");
    if (/没有十种影|没有十影|无十种影|无十影|不具备十种影|不具备十影|不能使用十种影|不能使用十影|no\s+ten[_\s-]?shadows/i.test(value)) return false;
    return /伏黑惠|megumi|十种影法术|十种影|十影|ten[_\s-]?shadows|嵌合暗翳庭|魔虚罗|魔须罗|mahoraga/i.test(value);
  }

  function hasGenericSummonEvidence(text) {
    return /式神|召唤|召喚|咒灵操术|咒灵库存|傀儡|外部资源/i.test(String(text || ""));
  }

  function buildTechniqueEvidenceText(source, customCard) {
    var selectedLibrary = customCard?.selectedLibrary || source?.selectedLibrary || {};
    return [
      source?.id,
      source?.characterId,
      source?.name,
      source?.displayName,
      source?.technique,
      source?.techniqueName,
      source?.techniqueText,
      source?.techniqueDescription,
      source?.domainProfile,
      source?.externalResource,
      source?.notes,
      customCard?.id,
      customCard?.characterId,
      customCard?.name,
      customCard?.displayName,
      customCard?.technique,
      customCard?.techniqueName,
      customCard?.techniqueText,
      customCard?.techniqueDescription,
      customCard?.domainProfile,
      customCard?.externalResource
    ].concat(
      asList(source?.innateTraits),
      asList(source?.advancedTechniques),
      asList(source?.loadout),
      asList(source?.traits),
      asList(source?.selectedMechanisms),
      asList(source?.selectedToolTags),
      asList(customCard?.innateTraits),
      asList(customCard?.advancedTechniques),
      asList(customCard?.loadout),
      asList(customCard?.traits),
      asList(customCard?.selectedMechanisms),
      asList(customCard?.selectedToolTags),
      asList(selectedLibrary?.techniques),
      asList(selectedLibrary?.domains),
      asList(selectedLibrary?.advanced),
      asList(selectedLibrary?.resources)
    ).filter(Boolean).join(" ");
  }

  function hasExplicitConstructionTechniqueEvidence(text) {
    var value = String(text || "");
    return /构筑术式|真球|液态金属|昆虫铠甲|三重疾苦|禅院真依|真依|yorozu|construction\s+sorcery/i.test(value) ||
      /(^|[\s、，,;；|/／])万($|[\s、，,;；|/／])/i.test(value);
  }

  function hasExplicitBloodTechniqueEvidence(text) {
    return /赤血操术|穿血|血刃|赤鳞跃动|超新星|苅祓|百敛|胀相|脹相|加茂宪纪|加茂憲紀|blood\s+manipulation/i.test(String(text || ""));
  }

  function sanitizeTechniqueSpecialHandTags(tags, evidenceText) {
    var normalized = uniqueList(tags);
    return normalized.filter(function keepTag(tag) {
      if (tag === "construction") return hasExplicitConstructionTechniqueEvidence(evidenceText);
      if (tag === "blood_manipulation") return hasExplicitBloodTechniqueEvidence(evidenceText);
      if (tag === "ten_shadows") return hasTenShadowsEvidence(evidenceText);
      if (tag === "projection_sorcery") return /投射术式|投射咒法|二十四帧|帧率|直哉|直毘人|projection\s+sorcery/i.test(String(evidenceText || ""));
      if (tag === "star_rage") return /星之怒|虚拟质量|凰轮|黑洞|九十九由基|star\s+rage/i.test(String(evidenceText || ""));
      if (tag === "limitless") return /无下限|五条|六眼|苍|赫|茈|limitless|infinity/i.test(String(evidenceText || ""));
      if (tag === "shrine") return /御厨子|伏魔御厨子|宿傩|捌|解|斩击|shrine|cleave|dismantle/i.test(String(evidenceText || ""));
      return true;
    });
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
    var sourceId = source?.characterId || source?.profileId || source?.id || "";
    var customCard = (dependencies.state?.customDuelCards || []).find(function findCustomCard(card) {
      return card?.characterId === sourceId || card?.id === sourceId;
    }) || null;
    var sourceDomainScript = source?.domainScript || customCard?.domainScript || null;
    var sourceDomainText = [
      source?.domainProfile,
      customCard?.domainProfile,
      sourceDomainScript?.domainName
    ].filter(Boolean).join(" ");
    var domainFlags = new Set(asList(source?.flags).concat(asList(customCard?.flags)));
    var antiDomainOnly = /简易领域|simple domain|弥虚葛笼|彌虚葛籠|落花之情|反领域/i.test(sourceDomainText) &&
      !/领域展开|生得领域|开放领域|顶级领域|顶尖领域|顶格领域|最高级领域|无量空处|伏魔御厨子|坐杀搏徒|真赝相爱|自闭圆顿裹|盖棺铁围山|荡蕴平线|时胞月宫殿|诛伏赐死|三重疾苦|domain expansion/i.test(sourceDomainText);
    var hasDeclaredDomain = !domainFlags.has("noDomain") && !antiDomainOnly && (Boolean(sourceDomainScript) || Boolean(sourceDomainText && !/无明确领域|无领域|没有领域|不具备领域|未知|未公开|^无$/i.test(sourceDomainText)));
    var entry = getCharacterRuleEntry(source, rules);
    var archetypes = getDuelCharacterArchetypes(source, { rules: rules });
    var traits = uniqueList([]
      .concat(inferCharacterTraits(source))
      .concat(asList(source?.innateTraits))
      .concat(asList(source?.advancedTechniques))
      .concat(asList(source?.loadout))
      .concat(asList(source?.flags))
      .concat(asList(source?.traits))
      .concat(asList(source?.techniqueFamilies))
      .concat(asList(customCard?.techniqueFamilies))
      .concat(asList(entry?.rules?.forceAllowTags))
      .concat(asList(entry?.rules?.techniqueFamilies))
      .concat(archetypes));
    var explicitSpecialHandTags = uniqueList([]
      .concat(asList(source?.specialHandTags))
      .concat(asList(source?.["特殊手札"]))
      .concat(asList(customCard?.specialHandTags))
      .concat(asList(customCard?.["特殊手札"])));
    var techniqueEvidenceText = buildTechniqueEvidenceText(source, customCard);
    explicitSpecialHandTags = sanitizeTechniqueSpecialHandTags(explicitSpecialHandTags, techniqueEvidenceText);
    var specialHandTags = uniqueList([].concat(explicitSpecialHandTags));
    var variants = uniqueList([]
      .concat(asList(source?.variants))
      .concat(asList(source?.characterVariants))
      .concat(asList(customCard?.variants))
      .concat(asList(entry?.rules?.variants)));
    traits = uniqueList(traits.concat(specialHandTags));
    var text = traits.concat([
      source?.id,
      source?.characterId,
      source?.name,
      source?.displayName,
      source?.technique,
      source?.techniqueName,
      source?.domainProfile,
      customCard?.technique,
      customCard?.techniqueName,
      customCard?.techniqueText,
      customCard?.domainProfile,
      sourceDomainScript?.domainName,
      source?.techniqueText,
      source?.notes
    ]).join(" ");
    if (archetypes.includes("ten_shadows") || /伏黑惠|megumi|十种影法术|十种影|十影|ten[_\s-]?shadows|嵌合暗翳庭/i.test(text)) variants.push("ten_shadows_user");
    if (/宿傩|sukuna/i.test(text) && /十影|十种影|魔虚罗|mahoraga|嵌合兽/i.test(text)) variants.push("sukuna_ten_shadows_user");
    if (archetypes.includes("sukuna_slash") || /宿傩|御厨子|伏魔御厨子|shrine|sukuna/i.test(text)) variants.push("sukuna_shrine_user");
    if (archetypes.includes("gojo_limitless") || /五条|无下限|limitless/i.test(text)) variants.push("gojo_limitless_user");
    var profile = {
      characterId: source?.characterId || source?.profileId || source?.id || entry?.id || "",
      displayName: source?.displayName || source?.name || "",
      domainProfile: source?.domainProfile || customCard?.domainProfile || "",
      domainScript: sourceDomainScript,
      traits: traits,
      archetypes: archetypes,
      variants: uniqueList(variants),
      specialHandTags: specialHandTags,
      explicitSpecialHandTags: explicitSpecialHandTags,
      hasCe: !/零咒力|zero_ce/i.test(text),
      ceLimited: /零咒力|zero_ce|咒力受限|ce_limited/i.test(text),
      hasInnateTechnique: !/零咒力|无术式|no_innate_technique/i.test(text),
      hasDomainAccess: !domainFlags.has("noDomain") && (hasDeclaredDomain || /领域展开|开放领域|顶级领域|坐杀搏徒|诛伏赐死|无量空处|伏魔御厨子|自闭圆顿裹|真赝相爱|嵌合暗翳庭|domain expansion/i.test(text)),
      isZeroCe: /零咒力|zero_ce/i.test(text),
      isCurse: /咒灵|curse_spirit|cursed_spirit|disaster_curse|low_grade_curse/i.test(text),
      isIncarnated: /受肉|incarnated/i.test(text),
      usesCursedTools: /咒具|cursed_tool|释魂刀|天逆|游云|黑绳|万里锁/i.test(text),
      techniqueFamilies: sanitizeTechniqueSpecialHandTags(uniqueList([]
        .concat(asList(entry?.rules?.techniqueFamilies))
        .concat(asList(source?.techniqueFamilies))
        .concat(asList(customCard?.techniqueFamilies))
        .concat(traits.filter(function keepFamily(tag) {
        return /^[a-z][a-z0-9_]{2,}$/i.test(String(tag || "")) || ["宿傩", "伏魔御厨子", "五条", "无下限", "六眼", "十种影法术", "赤血操术", "咒灵操术", "无为转变", "十划咒法", "咒言", "不义游戏", "黑鸟操术", "投射咒法", "构筑术式", "刍灵咒法", "星之怒", "冰凝咒法", "坐杀搏徒", "超人", "模仿", "天空术式", "龙髓炮", "反重力机构", "幻兽琥珀"].includes(tag);
      }))), techniqueEvidenceText),
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
      exclusiveToVariants: uniqueList([].concat(asList(action.exclusiveToVariants), asList(template.exclusiveToVariants), asList(sourceRule.exclusiveToVariants))),
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
    var characterRules = entry?.rules || {};
    var characterRulePatch = characterRules.rules || {};
    denyTags.push(...asList(characterRules.denyTags), ...asList(characterRulePatch.denyTags));
    denyCardTypes.push(...asList(characterRules.denyCardTypes), ...asList(characterRulePatch.denyCardTypes));
    weightBoostTags.push(...asList(characterRules.weightBoostTags), ...asList(characterRules.forceAllowTags), ...asList(characterRulePatch.weightBoostTags), ...asList(characterRulePatch.forceAllowTags));
    weightPenaltyTags.push(...asList(characterRules.weightPenaltyTags), ...asList(characterRulePatch.weightPenaltyTags));
    forceAllowSourceActionIds.push(...asList(characterRules.forceAllowSourceActionIds), ...asList(characterRulePatch.forceAllowSourceActionIds));
    forceDenySourceActionIds.push(...asList(characterRules.forceDenySourceActionIds), ...asList(characterRulePatch.forceDenySourceActionIds));
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
    var explicitProfileSpecialHandTags = profile.explicitSpecialHandTags || [];
    var specialHandMatched = Boolean(snapshot.specialHandTags.length && includesAny(explicitProfileSpecialHandTags, snapshot.specialHandTags));
    if (policy.forceDenySourceActionIds.includes(sourceActionId)) {
      return { ok: false, reason: "不符合当前角色特性", profile: profile, snapshot: snapshot };
    }
    if (snapshot.specialHandTags.length && !specialHandMatched) {
      return { ok: false, reason: "需要角色特殊手札标签", profile: profile, snapshot: snapshot };
    }
    var impliedExclusiveArchetypes = getExclusiveArchetypesFromHandTags(snapshot);
    if (!forceAllowed && impliedExclusiveArchetypes.length && !includesAny(profile.archetypes, impliedExclusiveArchetypes) && !specialHandMatched) {
      return { ok: false, reason: "需要对应专属术式原型", profile: profile, snapshot: snapshot };
    }
    if (!forceAllowed && snapshot.exclusiveToCharacters.length) {
      var ids = uniqueList([profile.characterId, profile.ruleId, profile.displayName]);
      if (!includesAny(ids, snapshot.exclusiveToCharacters)) return { ok: false, reason: "需要指定角色专属术式", profile: profile, snapshot: snapshot };
    }
    if (!forceAllowed && snapshot.exclusiveToVariants.length && !includesAny(profile.variants, snapshot.exclusiveToVariants)) {
      return { ok: false, reason: "需要对应角色形态", profile: profile, snapshot: snapshot };
    }
    if (!forceAllowed && snapshot.exclusiveToArchetypes.length && !includesAny(profile.archetypes, snapshot.exclusiveToArchetypes)) {
      return { ok: false, reason: "需要对应角色原型", profile: profile, snapshot: snapshot };
    }
    if (!forceAllowed && snapshot.forbiddenArchetypes.length && includesAny(profile.archetypes, snapshot.forbiddenArchetypes)) {
      return { ok: false, reason: "当前角色原型禁止此卡", profile: profile, snapshot: snapshot };
    }
    if (!forceAllowed && !specialHandMatched && policy.denyCardTypes.includes(snapshot.cardType)) {
      return { ok: false, reason: "当前角色不能使用该卡牌类型", profile: profile, snapshot: snapshot };
    }
    if (!forceAllowed && !specialHandMatched && includesAny(snapshot.tags, policy.denyTags)) {
      return { ok: false, reason: "标签不符合当前角色特性", profile: profile, snapshot: snapshot };
    }
    var traitPool = uniqueList(profile.traits.concat(profile.archetypes, profile.techniqueFamilies));
    if (!forceAllowed && snapshot.requiredTraits.length && !includesAll(traitPool, snapshot.requiredTraits)) {
      return { ok: false, reason: "缺少必要角色特质", profile: profile, snapshot: snapshot };
    }
    if (!forceAllowed && snapshot.forbiddenTraits.length && includesAny(traitPool, snapshot.forbiddenTraits)) {
      return { ok: false, reason: "角色特质与此卡冲突", profile: profile, snapshot: snapshot };
    }
    if (!forceAllowed && !specialHandMatched && snapshot.requiresCe && !profile.hasCe) return { ok: false, reason: "需要正常咒力流动", profile: profile, snapshot: snapshot };
    if (!forceAllowed && !specialHandMatched && snapshot.requiresInnateTechnique && !profile.hasInnateTechnique) return { ok: false, reason: "需要生得术式", profile: profile, snapshot: snapshot };
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

  function getCandidateCardType(candidate) {
    var action = getActionFromEntry(candidate);
    var templateGetter = getOptionalFunction("getDuelCardTemplateForAction");
    var template = templateGetter ? templateGetter(candidate) || templateGetter(action) : null;
    return candidate?.cardType || template?.cardType || inferFallbackCardType(action);
  }

  function normalizeDomainControlToken(value) {
    return String(value || "").trim().toLowerCase();
  }

  function getDomainControlCandidateIds(candidate) {
    var action = getActionFromEntry(candidate);
    return [
      getActionId(candidate),
      candidate?.sourceActionId,
      candidate?.actionId,
      candidate?.id,
      candidate?.cardId,
      action?.sourceActionId,
      action?.actionId,
      action?.id,
      action?.cardId
    ].flatMap(function expandCardId(value) {
      var token = normalizeDomainControlToken(value);
      return token.startsWith("card_") ? [token, token.slice(5)] : [token];
    }).filter(Boolean);
  }

  function getDomainControlCandidateTags(candidate) {
    var action = getActionFromEntry(candidate);
    return []
      .concat(asList(candidate?.tags))
      .concat(asList(action?.tags))
      .concat(asList(candidate?.specialHandTags), asList(candidate?.["特殊手札"]))
      .concat(asList(action?.specialHandTags), asList(action?.["特殊手札"]))
      .map(normalizeDomainControlToken)
      .filter(Boolean);
  }

  function isDomainControlHandCandidate(candidate) {
    var action = getActionFromEntry(candidate);
    var cardType = normalizeDomainControlToken(getCandidateCardType(candidate) || action?.cardType || action?.type || "");
    var ids = getDomainControlCandidateIds(candidate);
    if (ids.some(function hasDomainControlId(id) { return domainControlHandActionIds.has(id); })) return true;
    if (candidate?.domainHand || action?.domainHand) return true;
    var hasControlTag = getDomainControlCandidateTags(candidate).some(function hasDomainControlTag(tag) {
      return domainControlHandTags.has(tag);
    });
    if (!hasControlTag) return false;
    return cardType === "domain_maintenance" ||
      ids.some(function hasDomainControlPrefix(id) {
        return /^domain_(expand|compress|force_sustain|release|clash|survival)/.test(id);
      });
  }

  function isDomainHandCandidate(candidate) {
    var action = getActionFromEntry(candidate);
    var cardType = normalizeDomainControlToken(getCandidateCardType(candidate) || action?.cardType || action?.type || "");
    if (["rule_trial", "rule_defense", "jackpot"].includes(cardType)) return false;
    if (action?.domainSpecific || candidate?.domainSpecific) return true;
    if (action?.techniqueFeatureHand && action?.normalHandOnly && !action?.effects?.activateDomain) return false;
    return isDomainControlHandCandidate(candidate);
  }

  function getActorDomainText(actor) {
    var profile = buildDuelCharacterCardProfile(actor);
    return [
      actor?.id,
      actor?.characterId,
      actor?.name,
      actor?.displayName,
      actor?.domainProfile,
      actor?.profile?.domainProfile,
      actor?.domainScript?.domainName,
      actor?.profile?.domainScript?.domainName,
      actor?.profile?.notes,
      profile?.domainProfile,
      profile?.domainScript?.domainName,
      profile?.notes
    ].concat(asList(actor?.traits), asList(actor?.innateTraits), asList(actor?.profile?.innateTraits)).join(" ");
  }

  function getDomainHandSpecialtyBonus(candidate, actor, rules) {
    var handRules = rules || getDuelHandRules();
    var text = getActorDomainText(actor);
    var id = getActionId(candidate);
    var action = getActionFromEntry(candidate);
    var hasDomainAccess = /领域展开|生得领域|开放领域|无量空处|伏魔御厨子|坐杀搏徒|真赝相爱|自闭圆顿裹|盖棺铁围山|荡蕴平线|时胞月宫殿|诛伏赐死|三重疾苦|domain/i.test(text);
    var hasNamedDomain = hasDomainAccess && !/未公开|未知|无领域|没有领域|不具备领域/.test(text);
    var bonus = hasDomainAccess ? Number(handRules.domainHand?.domainAccessWeightBonus || 1) : 0;
    if (hasNamedDomain && (id === "domain_expand" || action?.effects?.activateDomain)) {
      bonus += Number(handRules.domainHand?.specialDomainWeightBonus || 2);
    }
    if (hasNamedDomain && /domain_(compress|force_sustain|release)|domain_clash/.test(id)) {
      bonus += Number(handRules.domainHand?.specialDomainWeightBonus || 2) * 0.55;
    }
    return bonus;
  }

  function splitNormalAndDomainCandidates(candidates) {
    var normal = [];
    var domain = [];
    (candidates || []).forEach(function splitCandidate(candidate) {
      if (isDomainHandCandidate(candidate)) domain.push(candidate);
      else normal.push(candidate);
    });
    return { normal: normal, domain: domain };
  }

  function isDomainActiveForActor(actor) {
    return Boolean(actor?.domain?.active || actor?.profile?.domain?.active);
  }

  function isOpponentDomainActiveForHand(opponent) {
    return Boolean(opponent?.domain?.active || opponent?.profile?.domain?.active);
  }

  function isDomainMaintenanceHandCandidate(candidate) {
    var id = getActionId(candidate);
    return ["domain_compress", "domain_force_sustain", "domain_release"].includes(id);
  }

  function isDomainResponseHandCandidate(candidate) {
    var action = getActionFromEntry(candidate);
    var id = getActionId(candidate);
    return ["domain_clash", "simple_domain_guard", "hollow_wicker_basket_guard", "falling_blossom_emotion", "zero_ce_domain_bypass", "domain_survival_guard"].includes(id) ||
      Boolean(action?.requirements?.opponentDomainActive);
  }

  function isPreDomainDomainHandCandidate(candidate) {
    var id = getActionId(candidate);
    return ["domain_expand", "simple_domain_guard", "hollow_wicker_basket_guard"].includes(id);
  }

  function filterDomainCandidatesByPhase(domainCandidates, actor, opponent) {
    var candidates = domainCandidates || [];
    if (isDomainActiveForActor(actor)) {
      var opponentDomainActive = isOpponentDomainActiveForHand(opponent);
      return candidates.filter(function keepActiveDomainHand(candidate) {
        if (isDomainMaintenanceHandCandidate(candidate)) return true;
        if (isDomainResponseHandCandidate(candidate)) return opponentDomainActive;
        return false;
      });
    }
    return candidates.filter(isPreDomainDomainHandCandidate);
  }

  function getActiveTrialSubPhaseForActor(actor, battle) {
    var subPhase = battle?.domainSubPhase;
    if (!actor || subPhase?.type !== "trial" || subPhase.verdictResolved) return null;
    return actor.side === subPhase.owner || actor.side === subPhase.defender ? subPhase : null;
  }

  function isStrictTrialHandCandidate(candidate, actor, battle) {
    var subPhase = getActiveTrialSubPhaseForActor(actor, battle);
    var action = getActionFromEntry(candidate);
    var id = getActionId(candidate);
    if (!subPhase) return false;
    if (!action?.domainSpecific || action.domainClass !== "rule_trial") return false;
    if (actor.side === subPhase.owner) {
      return ["present_evidence", "press_charge", "advance_trial", "rule_pressure", "request_verdict", "object_confiscation", "tool_function_lock", "wielder_liability", "controller_redirect", "summon_suppression"].includes(id);
    }
    if (actor.side === subPhase.defender) {
      return ["defend", "challenge_evidence", "remain_silent", "deny_charge", "delay_trial", "curse_argument", "distort_residue", "curse_pressure", "instinctive_struggle", "curse_fluctuation", "flee_exorcism", "proxy_denial"].includes(id);
    }
    return false;
  }

  function isRuleTrialCardLike(candidate) {
    var action = getActionFromEntry(candidate);
    var id = getActionId(candidate);
    var text = [
      id,
      action?.label,
      action?.name,
      action?.cardType,
      action?.domainClass,
      action?.domainRole
    ].concat(asList(action?.tags), asList(action?.allowedContexts)).filter(Boolean).join(" ");
    if (action?.domainSpecific && action.domainClass === "rule_trial") return true;
    if (["present_evidence", "press_charge", "advance_trial", "rule_pressure", "request_verdict", "defend", "challenge_evidence", "remain_silent", "deny_charge", "delay_trial", "curse_argument", "distort_residue", "curse_pressure", "instinctive_struggle", "curse_fluctuation", "flee_exorcism", "proxy_denial", "object_confiscation", "tool_function_lock", "wielder_liability", "controller_redirect", "summon_suppression"].includes(id)) return true;
    return /rule_trial|rule_defense|trial_owner|trial_defender|审判|辩护|裁定|证据|指控/.test(text);
  }

  function isJackpotSubPhaseCardLike(candidate) {
    var action = getActionFromEntry(candidate);
    var id = getActionId(candidate);
    var text = [
      id,
      action?.label,
      action?.name,
      action?.cardType,
      action?.domainClass,
      action?.domainRole
    ].concat(asList(action?.tags), asList(action?.allowedContexts)).filter(Boolean).join(" ");
    if (action?.domainSpecific && action.domainClass === "jackpot_rule") return true;
    if (["advance_jackpot", "raise_probability", "risk_spin", "stabilize_cycle", "claim_jackpot", "advance_jackpot_cycle"].includes(id)) return true;
    return /jackpot_rule|jackpot_owner|坐杀搏徒|抽奖|中奖|概率|连续演出/.test(text);
  }

  function filterInactiveRuleSubphaseCards(candidates, actor, battle) {
    var trialActive = Boolean(getActiveTrialSubPhaseForActor(actor, battle));
    var jackpotActive = Boolean(getActiveJackpotSubPhaseForActor(actor, battle));
    return (candidates || []).filter(function keepCandidate(candidate) {
      if (!trialActive && isRuleTrialCardLike(candidate)) return false;
      if (!jackpotActive && isJackpotSubPhaseCardLike(candidate)) return false;
      return true;
    });
  }

  function shouldReplaceHandWithTrialCards(actor, battle) {
    var subPhase = getActiveTrialSubPhaseForActor(actor, battle);
    if (!subPhase) return false;
    return actor.side === subPhase.owner || actor.side === subPhase.defender;
  }

  function filterStrictTrialHandCandidates(candidates, actor, battle) {
    if (!shouldReplaceHandWithTrialCards(actor, battle)) return candidates || [];
    return (candidates || []).filter(function keepTrialCandidate(candidate) {
      return isStrictTrialHandCandidate(candidate, actor, battle);
    });
  }

  function getActiveJackpotSubPhaseForActor(actor, battle) {
    var subPhase = battle?.domainSubPhase;
    if (!actor || subPhase?.type !== "jackpot" || subPhase.jackpotResolved) return null;
    return actor.side === subPhase.owner ? subPhase : null;
  }

  function isStrictJackpotHandCandidate(candidate, actor, battle) {
    var subPhase = getActiveJackpotSubPhaseForActor(actor, battle);
    var action = getActionFromEntry(candidate);
    var id = getActionId(candidate);
    if (!subPhase) return false;
    if (!action?.domainSpecific || action.domainClass !== "jackpot_rule") return false;
    return ["advance_jackpot", "raise_probability", "risk_spin", "stabilize_cycle", "claim_jackpot", "advance_jackpot_cycle"].includes(id);
  }

  function shouldReplaceHandWithJackpotCards(actor, battle) {
    return Boolean(getActiveJackpotSubPhaseForActor(actor, battle));
  }

  function filterStrictJackpotHandCandidates(candidates, actor, battle) {
    if (!shouldReplaceHandWithJackpotCards(actor, battle)) return candidates || [];
    return (candidates || []).filter(function keepJackpotCandidate(candidate) {
      return isStrictJackpotHandCandidate(candidate, actor, battle);
    });
  }

  function shouldReplaceHandWithRuleSubphaseCards(actor, battle) {
    return shouldReplaceHandWithTrialCards(actor, battle) || shouldReplaceHandWithJackpotCards(actor, battle);
  }

  function getCurrentTrialReplacementHandCards(actor, battle, side, rules) {
    var hand;
    if (!shouldReplaceHandWithTrialCards(actor, battle)) return [];
    hand = getPersistentHandState(battle, side || actor?.side || "left", rules);
    if (Number(hand?.round || 0) !== getTurnNumber(battle)) return [];
    return (hand.cards || []).filter(function keepTrialReplacement(card) {
      return card?.handSource === "trial-replacement" && (card?.domainClass === "rule_trial" || card?.domainSpecific);
    });
  }

  function normalizeRefreshedTrialHandAction(template, profile, subPhase, side, round) {
    var isDefender = side === subPhase?.defender;
    if (!template?.id || !profile || !subPhase) return null;
    return {
      ...template,
      action: null,
      actionId: template.id,
      sourceActionId: template.id,
      status: "CANDIDATE",
      cost: template.cost || { ceRatio: 0.03, minCe: 0 },
      effects: template.effects || {},
      requirements: { ...(template.requirements || {}), domainSpecific: true },
      domainSpecific: true,
      domainProfileId: profile.id || subPhase.domainId || "",
      domainName: profile.domainName || subPhase.domainName || "",
      domainClass: profile.domainClass || "rule_trial",
      domainRole: template.role || "",
      trialEligibility: template.trialEligibility || subPhase.trialEligibility || null,
      trialSubjectType: template.trialSubjectType || subPhase.trialSubjectType || "",
      canDefend: template.canDefend ?? subPhase.canDefend,
      canRemainSilent: template.canRemainSilent ?? subPhase.canRemainSilent,
      verdictVocabulary: template.verdictVocabulary || subPhase.verdictVocabulary || null,
      tags: isDefender ? ["抗审判"] : ["审判"],
      handSource: "trial-replacement",
      drawnRound: round,
      selectedRound: 0
    };
  }

  function rebuildTrialReplacementHandCards(actor, battle, side, rules) {
    var subPhase = getActiveTrialSubPhaseForActor(actor, battle);
    var stateEntry = subPhase ? battle?.domainProfileStates?.[subPhase.owner] : null;
    var profile = stateEntry?.profile || (battle?.domainProfileState?.ownerSide === subPhase?.owner ? battle.domainProfileState.profile : null);
    var actorSide = side || actor?.side || "left";
    var templates;
    var round;
    var cards;
    var hand;
    if (!subPhase || !profile) return [];
    if (actorSide === subPhase.owner) {
      templates = profile.domainActions || [];
    } else if (actorSide === subPhase.defender) {
      templates = profile.opponentActions || [];
    } else {
      return [];
    }
    round = getTurnNumber(battle);
    cards = templates.map(function mapTrialTemplate(template) {
      return normalizeRefreshedTrialHandAction(template, profile, subPhase, actorSide, round);
    }).filter(Boolean);
    hand = getPersistentHandState(battle, actorSide, rules);
    hand.cards = cards;
    hand.round = round;
    hand.lastDrawn = cards.map(function summarize(card) {
      return { actionId: getActionId(card), label: card.label || card.id || getActionId(card) };
    });
    hand.lastInjected = cards.map(function summarize(card) {
      return { actionId: getActionId(card), label: card.label || card.id || getActionId(card), source: actorSide === subPhase.defender ? "anti-trial" : "trial" };
    });
    hand.lastDiscarded = [];
    hand.pendingDiscardCount = 0;
    hand.overflowDiscardRequired = false;
    return cards;
  }

  function filterStrictRuleSubphaseHandCandidates(candidates, actor, battle) {
    if (shouldReplaceHandWithTrialCards(actor, battle)) return filterStrictTrialHandCandidates(candidates, actor, battle);
    if (shouldReplaceHandWithJackpotCards(actor, battle)) return filterStrictJackpotHandCandidates(candidates, actor, battle);
    return candidates || [];
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
        var domainBonus = options?.domainHand ? getDomainHandSpecialtyBonus(candidate, actor, options?.handRules) : 0;
        var randomBonus = options?.randomize ? Math.random() * Number(options.randomize || 1) : 0;
        var rankScore = Number(candidate.selectionWeight || 0) + pickerBonus + availabilityBonus + domainBonus + randomBonus - index * 0.001;
        return { candidate: candidate, rankScore: rankScore };
      })
      .sort(function sortRanked(a, b) {
        return b.rankScore - a.rankScore;
      })
      .map(function unwrap(entry) {
        return entry.candidate;
      });
  }

  function getCandidateSortScore(candidate) {
    var availableBonus = candidate?.available ? 2 : -3;
    return Number(candidate?.selectionWeight || candidate?.characterWeight || candidate?.weight || candidate?.score || 0) + availableBonus;
  }

  function normalizePersistentHandCard(candidate, round, source) {
    return {
      ...(candidate || {}),
      handSource: source || candidate?.handSource || "draw",
      drawnRound: Number(candidate?.drawnRound || round || 0),
      retained: source === "retained" || Boolean(candidate?.retained)
    };
  }

  function isPermanentHandCard(card) {
    return Boolean(card?.noRefresh || card?.retainedPermanent || card?.executionSword);
  }

  function getMaintenanceSpec(card) {
    return card?.maintenanceSpec || card?.action?.maintenanceSpec || null;
  }

  function isMaintenanceUnitAlive(battle, unitCardId) {
    if (!unitCardId) return true;
    return (battle?.battlefieldUnits || []).some(function matchUnit(unit) {
      var id = unit?.cardId || unit?.sourceActionId || unit?.id || "";
      var hp = Number(unit?.hp ?? unit?.currentHp ?? unit?.unitStats?.currentHp ?? unit?.unitStats?.maxHp ?? 0);
      return id === unitCardId && unit?.defeated !== true && unit?.active !== false && hp > 0;
    });
  }

  function isMahoragaProxyProtectingHandSide(battle, side) {
    var proxy = battle?.mahoragaProxy?.[side];
    if (!proxy?.active) return false;
    if (!proxy.unitId) return true;
    return (battle?.battlefieldUnits || []).some(function findProxyUnit(unit) {
      var hp = Number(unit?.hp ?? unit?.currentHp ?? unit?.unitStats?.currentHp ?? unit?.unitStats?.maxHp ?? 0);
      return unit?.id === proxy.unitId && unit?.defeated !== true && unit?.active !== false && hp > 0;
    });
  }

  function isDuelActorDefeatedForExecution(actor, battle, side) {
    if (!actor) return true;
    if (Number(actor.hp || 0) > 0) return false;
    return !isMahoragaProxyProtectingHandSide(battle, side || actor.side || "");
  }

  function isMaintenanceCardCurrentlyValid(card, battle) {
    var spec = getMaintenanceSpec(card);
    if (!spec?.mandatoryWhileUnitActive) return true;
    return isMaintenanceUnitAlive(battle, spec.mandatoryWhileUnitActive);
  }

  function isSkipTurnMaintenance(entry) {
    return Boolean(getMaintenanceSpec(entry)?.skipActiveTurn);
  }

  function getPersistentHandState(battle, side, rules) {
    var activeBattle = getBattle(battle);
    if (!activeBattle) return null;
    initializeDuelHandState(activeBattle, rules);
    var actorSide = side || "left";
    activeBattle.handState ||= {};
    activeBattle.handState[actorSide] ||= {
      cards: [],
      discardPile: [],
      round: 0,
      lastDrawn: [],
      lastInjected: [],
      lastDiscarded: [],
      maxHandSize: getMaxHandSize(rules),
      drawPerTurn: getDrawPerTurn(rules)
    };
    activeBattle.handState[actorSide].maxHandSize = getMaxHandSize(rules);
    activeBattle.handState[actorSide].drawPerTurn = getDrawPerTurn(rules);
    return activeBattle.handState[actorSide];
  }

  function removeCardsFromPersistentHand(battle, side, actionIds, rules) {
    var hand = getPersistentHandState(battle, side, rules);
    if (!hand || !Array.isArray(hand.cards) || !actionIds?.length) return [];
    var ids = new Set(actionIds.filter(Boolean));
    var removed = [];
    hand.cards = hand.cards.filter(function keepCard(card) {
      var id = getActionId(card);
      if (!ids.has(id)) return true;
      if (isPermanentHandCard(card)) {
        card.retained = true;
        card.lastUsedRound = getTurnNumber(battle);
        return true;
      }
      removed.push(card);
      return false;
    });
    return removed;
  }

  function updatePersistentHandOverflow(hand, maxHandSize) {
    if (!hand) return 0;
    var protectedCards = (hand.cards || []).filter(function countProtected(card) {
      return isPermanentHandCard(card);
    });
    var countedCards = (hand.cards || []).length - protectedCards.length;
    var overflow = Math.max(0, countedCards - Number(maxHandSize || hand.maxHandSize || 8));
    hand.pendingDiscardCount = overflow;
    hand.overflowDiscardRequired = overflow > 0;
    return overflow;
  }

  function discardDuelHandCandidate(actionOrId, actor, duelState, options) {
    var battle = getBattle(duelState);
    if (!battle || !actor) return { discarded: false, reason: "战斗资源缺失" };
    var rules = options?.rules || getDuelHandRules();
    var side = getActorSide(actor, options);
    var hand = getPersistentHandState(battle, side, rules);
    var id = typeof actionOrId === "string" ? actionOrId : getActionId(actionOrId);
    if (!id) return { discarded: false, reason: "手札不存在" };
    var index = (hand.cards || []).findIndex(function findCard(card) {
      return getActionId(card) === id;
    });
    if (index < 0) return { discarded: false, reason: "手札不在当前手牌中" };
    if (isPermanentHandCard(hand.cards[index])) return { discarded: false, reason: "该手札为锁定常驻手札，不能弃置" };
    var removed = hand.cards.splice(index, 1)[0];
    var round = getTurnNumber(battle);
    var summary = {
      actionId: getActionId(removed),
      label: removed?.label || removed?.id || getActionId(removed),
      discardedRound: round,
      reason: "manualOverflowDiscard"
    };
    hand.lastDiscarded = [summary];
    hand.discardPile = (hand.discardPile || []).concat(summary);
    updatePersistentHandOverflow(hand, getMaxHandSize(rules));
    invalidateDuelHandCandidateCache(battle);
    return { discarded: true, reason: "", card: removed, side: side, pendingDiscardCount: hand.pendingDiscardCount };
  }

  function getDuelCpuDiscardKeepScore(candidate, actor, opponent, battle) {
    var action = getActionFromEntry(candidate);
    if (!action?.id) return -999;
    var damage = getCpuDamagePriority(candidate);
    var block = getCpuBlockPriority(candidate);
    var type = getCpuActionType(candidate);
    var text = collectCandidateSearchText(candidate);
    var score = Number(candidate?.selectionWeight || candidate?.characterWeight || candidate?.weight || 0);
    score += damage * 0.9 + block * 0.55;
    if (isPermanentHandCard(candidate)) score += 9999;
    if (type.includes("domain") || action.effects?.activateDomain) score += 34;
    if (action.summonSpec || action.mechanismSpec || action.resourceSpec) score += 26;
    if (action.starRageEffect || action.projectionSorcery || action.bloodConversion) score += 24;
    if (/star_rage|projection_sorcery|blood_manipulation|星之怒|投射|赤血|虚拟质量|帧率/.test(text)) score += 18;
    if (action.risk === "critical") score += 8;
    if (action.risk === "high") score += 4;
    if (!damage && !block && !type.includes("support") && !type.includes("resource")) score -= 10;
    return Number(score.toFixed(4));
  }

  function autoDiscardDuelCpuOverflow(actor, opponent, battle, side, rules) {
    var hand = getPersistentHandState(battle, side, rules);
    var maxHandSize = getMaxHandSize(rules);
    var overflow = updatePersistentHandOverflow(hand, maxHandSize);
    if (!hand || overflow <= 0) return [];
    var discardable = (hand.cards || []).map(function mapDiscard(card, index) {
      return {
        card: card,
        index: index,
        score: getDuelCpuDiscardKeepScore(card, actor, opponent, battle)
      };
    }).filter(function keepDiscardable(entry) {
      return !isPermanentHandCard(entry.card);
    }).sort(function byLowKeepScore(left, right) {
      return left.score - right.score;
    }).slice(0, overflow);
    var removed = [];
    discardable.sort(function byIndexDesc(left, right) {
      return right.index - left.index;
    }).forEach(function removeEntry(entry) {
      var card = hand.cards.splice(entry.index, 1)[0];
      if (card) removed.push(card);
    });
    if (!removed.length) return [];
    var round = getTurnNumber(battle);
    var summaries = removed.reverse().map(function summarize(card) {
      return {
        actionId: getActionId(card),
        label: card?.label || card?.id || getActionId(card),
        discardedRound: round,
        reason: "cpuOverflowAutoDiscard"
      };
    });
    hand.lastDiscarded = summaries;
    hand.discardPile = (hand.discardPile || []).concat(summaries);
    updatePersistentHandOverflow(hand, maxHandSize);
    invalidateDuelHandCandidateCache(battle);
    battle.cpuOverflowDiscardLog ||= {};
    battle.cpuOverflowDiscardLog[side] = {
      round: round,
      discarded: summaries,
      pendingDiscardCount: hand.pendingDiscardCount
    };
    return summaries;
  }

  function getCandidateAction(candidate) {
    return candidate?.action || candidate || {};
  }

  function collectCandidateSearchText(candidate) {
    var action = getCandidateAction(candidate);
    var parts = [
      action.id,
      action.actionId,
      action.sourceActionId,
      action.cardId,
      action.name,
      action.label,
      action.displayName,
      action.description,
      action.effectSummary,
      candidate?.id,
      candidate?.actionId,
      candidate?.sourceActionId,
      candidate?.cardId,
      candidate?.label,
      candidate?.name
    ];
    if (Array.isArray(action.tags)) parts = parts.concat(action.tags);
    if (Array.isArray(action.specialHandTags)) parts = parts.concat(action.specialHandTags);
    if (Array.isArray(candidate?.tags)) parts = parts.concat(candidate.tags);
    if (Array.isArray(candidate?.specialHandTags)) parts = parts.concat(candidate.specialHandTags);
    return parts.filter(Boolean).join(" ").toLowerCase();
  }

  function isTenShadowsRabbitCandidate(candidate) {
    var text = collectCandidateSearchText(candidate);
    return text.indexOf("rabbit") !== -1 || text.indexOf("脱兔") !== -1;
  }

  function isTenShadowsUniqueShikigamiCandidate(candidate) {
    var action = getCandidateAction(candidate);
    var text = collectCandidateSearchText(candidate);
    var summonSpec = action?.summonSpec || candidate?.summonSpec || {};
    var isTenShadows = text.indexOf("ten_shadows") !== -1 || text.indexOf("十种影") !== -1;
    return Boolean(summonSpec.unitCardId && isTenShadows && !isTenShadowsRabbitCandidate(candidate));
  }

  function getTenShadowsCandidateSummonKey(candidate) {
    var action = getCandidateAction(candidate);
    var summonSpec = action?.summonSpec || candidate?.summonSpec || {};
    return String(
      summonSpec.unitCardId ||
      action.cardId ||
      candidate?.cardId ||
      action.sourceActionId ||
      candidate?.sourceActionId ||
      action.actionId ||
      candidate?.actionId ||
      action.id ||
      candidate?.id ||
      ""
    );
  }

  function isTenShadowsSummonSpent(candidate, battle, side) {
    var key = getTenShadowsCandidateSummonKey(candidate);
    if (!isTenShadowsUniqueShikigamiCandidate(candidate) || !battle || !side || !key) return false;
    var state = battle.tenShadowsSummonState && battle.tenShadowsSummonState[side];
    if (state && state[key]) return true;
    var logs = Array.isArray(battle.summonLog) ? battle.summonLog : [];
    return logs.some(function matchSummon(entry) {
      if (!entry || entry.actorSide !== side) return false;
      return entry.unitCardId === key || entry.cardId === key || entry.sourceActionId === key || entry.actionId === key;
    });
  }

  function filterSpentTenShadowsSummons(candidates, battle, side) {
    return (candidates || []).filter(function keepCandidate(candidate) {
      return !isTenShadowsSummonSpent(candidate, battle, side);
    });
  }

  function reconcilePersistentHandCards(hand, fullCandidates, actor, opponent, battle, rules) {
    var byId = Object.create(null);
    (fullCandidates || []).forEach(function indexCandidate(candidate) {
      var id = getActionId(candidate);
      if (id) byId[id] = candidate;
    });
    hand.cards = (hand.cards || []).map(function refreshCard(card) {
      var id = getActionId(card);
      var refreshed = byId[id] || card;
      return normalizePersistentHandCard(refreshed, card.drawnRound || hand.round, "retained");
    }).filter(function keepExisting(card) {
      if (!isMaintenanceCardCurrentlyValid(card, battle)) return false;
      if (!getActiveTrialSubPhaseForActor(actor, battle) && isRuleTrialCardLike(card)) return false;
      if (!getActiveJackpotSubPhaseForActor(actor, battle) && isJackpotSubPhaseCardLike(card)) return false;
      if (isTenShadowsSummonSpent(card, battle, getActorSide(actor, {}))) return false;
      return Boolean(getActionId(card));
    });
  }

  function removeDomainCardsFromNormalHand(hand) {
    hand.cards = (hand.cards || []).filter(function keepNormalPersistentCard(card) {
      return !isDomainHandCandidate(card);
    });
  }

  function getRandomHandInjectionsForActor(actor) {
    var characterRules = getDuelCharacterCardRules();
    var profile = buildDuelCharacterCardProfile(actor, { rules: characterRules });
    var entry = getCharacterRuleEntry({ id: profile.characterId, name: profile.displayName }, characterRules);
    return asList(entry?.rules?.randomHandInjections).concat(asList(entry?.rules?.rules?.randomHandInjections));
  }

  function getFixedHandInjectionsForActor(actor) {
    var characterRules = getDuelCharacterCardRules();
    var profile = buildDuelCharacterCardProfile(actor, { rules: characterRules });
    var entry = getCharacterRuleEntry({ id: profile.characterId, name: profile.displayName }, characterRules);
    return asList(entry?.rules?.fixedHandInjections).concat(asList(entry?.rules?.rules?.fixedHandInjections));
  }

  function getFixedActionInjectionsFromPool(fullCandidates) {
    return (fullCandidates || []).filter(function keepGuaranteed(candidate) {
      var action = candidate?.action || candidate || {};
      return Boolean(candidate?.guaranteedPerTurn || action.guaranteedPerTurn);
    }).map(function mapGuaranteed(candidate) {
      var action = candidate?.action || candidate || {};
      return {
        id: getActionId(candidate),
        sourceActionId: getActionId(candidate),
        weight: Number(action.selectionWeight || action.weight || 999),
        retainedPermanent: action.retainedPermanent !== false,
        handSource: action.handSource || "guaranteed-per-turn"
      };
    });
  }

  function shouldApplyFixedHandInjection(injection, actor, battle, round) {
    var condition = injection?.condition || injection?.conditions || {};
    if (!condition || typeof condition !== "object" || !Object.keys(condition).length) return true;
    var hpBelowRatio = Number(condition.hpBelowRatio ?? condition.requiresHpBelowRatio);
    if (Number.isFinite(hpBelowRatio)) {
      var maxHp = Number(actor?.maxHp || 0);
      if (maxHp <= 0) return false;
      var hpRatio = Number(actor?.hp || 0) / maxHp;
      if (!(hpRatio < hpBelowRatio)) return false;
    }
    var minRound = Number(condition.minRound || 0);
    if (Number.isFinite(minRound) && minRound > 0 && Number(round || 0) < minRound) return false;
    return true;
  }

  function rollRandomHandInjection(injection, actor, battle, round) {
    var chance = Number(injection?.probability ?? injection?.chance ?? 0);
    if (!Number.isFinite(chance) || chance <= 0) return false;
    if (chance >= 1) return true;
    return Math.random() < chance;
  }

  function injectRandomHandCards(hand, fullCandidates, actor, battle, rules, round) {
    var injections = getRandomHandInjectionsForActor(actor);
    if (!injections.length) return [];
    var byId = Object.create(null);
    (fullCandidates || []).forEach(function indexCandidate(candidate) {
      var id = getActionId(candidate);
      if (id) byId[id] = candidate;
    });
    var existingIds = new Set((hand.cards || []).map(getActionId).filter(Boolean));
    var injected = [];
    injections.forEach(function maybeInject(injection) {
      var id = injection?.sourceActionId || injection?.actionId || injection?.id || "";
      if (!id || existingIds.has(id)) return;
      if (!rollRandomHandInjection(injection, actor, battle, round)) return;
      var candidate = byId[id];
      if (!candidate) return;
      if (isDomainHandCandidate(candidate)) return;
      var card = normalizePersistentHandCard({
        ...(candidate || {}),
        randomHandInjection: true,
        randomHandInjectionChance: Number(injection.probability ?? injection.chance ?? 0),
        characterWeight: Math.max(Number(candidate.characterWeight || candidate.selectionWeight || 0), Number(injection.weight || 99)),
        selectionWeight: Math.max(Number(candidate.selectionWeight || candidate.characterWeight || 0), Number(injection.weight || 99)),
        handSource: injection.handSource || "random-injection"
      }, round, injection.handSource || "random-injection");
      hand.cards.push(card);
      existingIds.add(id);
      injected.push(card);
    });
    return injected;
  }

  function injectFixedHandCards(hand, fullCandidates, actor, battle, rules, round) {
    var injections = getFixedHandInjectionsForActor(actor).concat(getFixedActionInjectionsFromPool(fullCandidates));
    if (!injections.length) return [];
    var byId = Object.create(null);
    (fullCandidates || []).forEach(function indexCandidate(candidate) {
      var id = getActionId(candidate);
      if (id) byId[id] = candidate;
    });
    var existingIds = new Set((hand.cards || []).map(getActionId).filter(Boolean));
    var injected = [];
    injections.forEach(function injectFixed(injection) {
      var id = injection?.sourceActionId || injection?.actionId || injection?.id || "";
      if (!id || existingIds.has(id)) return;
      if (!shouldApplyFixedHandInjection(injection, actor, battle, round)) return;
      var candidate = byId[id];
      if (!candidate) return;
      if (isDomainHandCandidate(candidate)) return;
      var card = normalizePersistentHandCard({
        ...(candidate || {}),
        fixedHandInjection: true,
        retainedPermanent: injection.retainedPermanent !== false,
        characterWeight: Math.max(Number(candidate.characterWeight || candidate.selectionWeight || 0), Number(injection.weight || 999)),
        selectionWeight: Math.max(Number(candidate.selectionWeight || candidate.characterWeight || 0), Number(injection.weight || 999)),
        handSource: injection.handSource || "fixed-injection"
      }, round, injection.handSource || "fixed-injection");
      hand.cards.unshift(card);
      existingIds.add(id);
      injected.push(card);
    });
    return injected;
  }

  function updatePersistentDuelHand(actor, opponent, battle, rankedCandidates, rules, options) {
    var side = getActorSide(actor, options);
    var hand = getPersistentHandState(battle, side, rules);
    var round = getTurnNumber(battle);
    var maxHandSize = getMaxHandSize(rules);
    var drawPerTurn = getDrawPerTurn(rules);
    reconcilePersistentHandCards(hand, rankedCandidates, actor, opponent, battle, rules);
    if (!options?.strictReplaceHand) removeDomainCardsFromNormalHand(hand);
    if (Number(hand.round || 0) === round) {
      if (options?.strictReplaceHand) {
        if (!Array.isArray(hand.preTrialCards)) {
          hand.preTrialCards = (hand.cards || []).filter(function keepPreTrialCard(card) {
            return card?.handSource !== "trial-replacement" && card?.domainClass !== "rule_trial";
          });
          hand.preTrialCardsRound = round;
        }
        hand.cards = (rankedCandidates || []).slice(0, maxHandSize).map(function markTrialReplacement(candidate) {
          return normalizePersistentHandCard(candidate, round, "trial-replacement");
        });
        hand.lastDrawn = hand.cards.map(function summarize(card) {
          return { actionId: getActionId(card), label: card.label || card.id || getActionId(card) };
        });
        hand.lastInjected = [];
        hand.lastDiscarded = [];
        updatePersistentHandOverflow(hand, maxHandSize);
        return hand.cards;
      }
      var fixedSameRound = injectFixedHandCards(hand, options?.fullCandidates || rankedCandidates, actor, battle, rules, round);
      updatePersistentHandOverflow(hand, maxHandSize);
      if (fixedSameRound.length) {
        hand.lastInjected = fixedSameRound.map(function summarize(card) {
          return { actionId: getActionId(card), label: card.label || card.id || getActionId(card), reason: "fixed" };
        }).concat(hand.lastInjected || []).slice(0, 8);
      }
      return hand.cards;
    }

    if (options?.strictReplaceHand) {
      if (!Array.isArray(hand.preTrialCards)) {
        hand.preTrialCards = (hand.cards || []).filter(function keepPreTrialCard(card) {
          return card?.handSource !== "trial-replacement" && card?.domainClass !== "rule_trial";
        });
        hand.preTrialCardsRound = round;
      }
      hand.cards = (rankedCandidates || []).slice(0, maxHandSize).map(function markTrialReplacement(candidate) {
        return normalizePersistentHandCard(candidate, round, "trial-replacement");
      });
      hand.round = round;
      hand.lastDrawn = hand.cards.map(function summarize(card) {
        return { actionId: getActionId(card), label: card.label || card.id || getActionId(card) };
      });
      hand.lastInjected = [];
      hand.lastDiscarded = [];
      updatePersistentHandOverflow(hand, maxHandSize);
      return hand.cards;
    }

    var existingIds = new Set((hand.cards || []).map(getActionId).filter(Boolean));
    var drawPool = (rankedCandidates || []).filter(function canDraw(candidate) {
      var id = getActionId(candidate);
      return id && !existingIds.has(id);
    });
    var drawn = drawPool.slice(0, drawPerTurn).map(function markDrawn(candidate) {
      return normalizePersistentHandCard(candidate, round, "draw");
    });
    hand.cards = (hand.cards || []).map(function markRetained(card) {
      return normalizePersistentHandCard(card, card.drawnRound || round, "retained");
    }).concat(drawn);
    var fixedInjected = injectFixedHandCards(hand, options?.fullCandidates || rankedCandidates, actor, battle, rules, round);
    var randomInjected = injectRandomHandCards(hand, options?.fullCandidates || rankedCandidates, actor, battle, rules, round);
    var injected = fixedInjected.concat(randomInjected);

    if (hand.cards.length > maxHandSize) {
      updatePersistentHandOverflow(hand, maxHandSize);
    } else {
      updatePersistentHandOverflow(hand, maxHandSize);
    }

    hand.round = round;
    hand.lastDrawn = drawn.map(function summarize(card) {
      return { actionId: getActionId(card), label: card.label || card.id || getActionId(card) };
    });
    hand.lastInjected = injected.map(function summarize(card) {
      return { actionId: getActionId(card), label: card.label || card.id || getActionId(card), chance: card.randomHandInjectionChance || "", reason: card.fixedHandInjection ? "fixed" : "random" };
    });
    if (!hand.overflowDiscardRequired) hand.lastDiscarded = [];
    return hand.cards;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || 0));
  }

  function getChoiceCount(rules, requestedCount) {
    var handRules = rules || getDuelHandRules();
    var min = Number(handRules.hand?.minChoiceCount || 3);
    var max = Number(handRules.hand?.maxChoiceCount || handRules.hand?.maxHandSize || 8);
    var fallback = Number(handRules.hand?.defaultChoiceCount || handRules.hand?.maxHandSize || 8);
    var count = requestedCount === undefined ? fallback : Number(requestedCount);
    return Math.round(clamp(count, min, max));
  }

  function getMaxHandSize(rules) {
    var handRules = rules || getDuelHandRules();
    return Math.max(1, Math.round(Number(handRules.hand?.maxHandSize || handRules.hand?.maxChoiceCount || 8)));
  }

  function getDrawPerTurn(rules) {
    var handRules = rules || getDuelHandRules();
    return Math.max(1, Math.round(Number(handRules.hand?.drawPerTurn || 5)));
  }

  function getDomainHandSize(rules) {
    var handRules = rules || getDuelHandRules();
    if (handRules.domainHand?.enabled === false) return 0;
    return Math.max(0, Math.round(Number(handRules.domainHand?.maxHandSize || 3)));
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

  function isDomainScriptNoCardLocked(battle, side) {
    var locks = battle && battle.domainScriptNoCardLocks;
    return Boolean(side && locks && Number(locks[side] || 0) === getTurnNumber(battle));
  }

  function setDomainScriptNoCardMessage(battle, side, sourceDomainName) {
    var domainName = sourceDomainName || "领域";
    var message = "由于本回合被" + domainName + "效果命中，无法行动，请直接点击锁定。";
    if (!battle || !side) return message;
    battle.handLockMessages ||= {};
    battle.handLockMessages[side] = {
      round: getTurnNumber(battle),
      message: message,
      sourceDomainName: sourceDomainName || ""
    };
    if (shouldShowHandLockMessageForSide(battle, side)) battle.actionUiMessage = message;
    return message;
  }

  function shouldShowHandLockMessageForSide(battle, side) {
    if (!battle || !side) return false;
    if (battle.mode === "online") return (battle.onlinePlayerSide || "left") === side;
    return side === "left";
  }

  function consumeDomainScriptNoCard(actor, battle, side) {
    var actorSide = side || getActorSide(actor, {});
    var round = getTurnNumber(battle);
    var effects = Array.isArray(actor?.statusEffects) ? actor.statusEffects : [];
    var consumed = false;
    var sourceDomainName = "";
    if (!actor || !battle || !actorSide) return false;
    if (isDomainScriptNoCardLocked(battle, actorSide)) {
      var lockedMessage = battle.handLockMessages?.[actorSide];
      if (lockedMessage && Number(lockedMessage.round || 0) === round && shouldShowHandLockMessageForSide(battle, actorSide)) battle.actionUiMessage = lockedMessage.message || "";
      return true;
    }
    actor.statusEffects = effects.filter(function keepEffect(effect) {
      var triggerRound;
      if (effect?.id !== "domainScriptNoCard") return true;
      triggerRound = Number(effect.triggerRound || 0);
      if (triggerRound && triggerRound > round) return true;
      consumed = true;
      sourceDomainName = effect.sourceDomainName || sourceDomainName;
      return false;
    });
    if (!consumed) return false;
    battle.domainScriptNoCardLocks ||= {};
    battle.domainScriptNoCardLocks[actorSide] = round;
    setDomainScriptNoCardMessage(battle, actorSide, sourceDomainName);
    clearDuelSelectedHandActions(battle, actorSide);
    if (getOptionalFunction("recordDuelResourceChange")) {
      callDependency("recordDuelResourceChange", [battle, {
        side: actorSide,
        title: "领域封锁手札",
        detail: (actorSide === "left" ? "我方" : "对方") + actor.name + " 被" + (sourceDomainName || "领域") + "效果封锁，本轮不能抽取或使用手札。",
        type: "domain",
        delta: { domainScriptNoCardConsumed: true }
      }]);
    }
    return true;
  }

  function initializeDuelHandState(battle, rules) {
    var activeBattle = getBattle(battle);
    if (!activeBattle) return null;
    activeBattle.actionPoints ||= {};
    ["left", "right"].forEach(function initializeSide(side) {
      if (!activeBattle.actionPoints[side]) resetDuelApForTurn(activeBattle, side, rules);
    });
    activeBattle.handCandidates ||= [];
    activeBattle.domainHandCandidates ||= [];
    activeBattle.handState ||= {};
    activeBattle.domainHandState ||= {};
    ["left", "right"].forEach(function initializeHandSide(side) {
      activeBattle.handState[side] ||= {
        cards: [],
        discardPile: [],
        round: 0,
        lastDrawn: [],
        lastInjected: [],
        lastDiscarded: [],
        maxHandSize: getMaxHandSize(rules),
        drawPerTurn: getDrawPerTurn(rules)
      };
    });
    ["left", "right"].forEach(function initializeDomainHandSide(side) {
      activeBattle.domainHandState[side] ||= {
        cards: [],
        round: 0,
        lastRefreshed: [],
        maxHandSize: getDomainHandSize(rules)
      };
      activeBattle.domainHandState[side].maxHandSize = getDomainHandSize(rules);
    });
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
    if (effects.evasionBonus) parts.push("闪避调整");
    if (effects.selfHpCostRatio || effects.selfHpCostFlat) parts.push("体势代价");
    if (effects.stabilityDelta) parts.push("稳定度变化");
    if (effects.domainLoadDelta || effects.domainLoadScale) parts.push("领域负荷变化");
    if (effects.opponentDomainLoadDelta) parts.push("干涉对方领域");
    if (effects.activateDomain) parts.push("展开领域");
    if (effects.releaseDomain) parts.push("解除领域");
    if (action?.exclusiveHandSelection) parts.push("单独使用");
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
    if (field === "evasionBonus" && value !== 0) preview.statusPreview.push("闪避：" + formatSignedPercent(value));
    if (field === "selfHpCostRatio" && value > 0) preview.resourcePreview.push("体势代价：最大体势 " + formatSignedPercent(value).replace(/^\+/, ""));
    if (field === "selfHpCostFlat" && value > 0) preview.resourcePreview.push("体势代价 " + formatSignedNumber(value).replace(/^\+/, ""));
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
      "evasionBonus",
      "selfHpCostRatio",
      "selfHpCostFlat",
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
    if (action.exclusiveHandSelection || template?.exclusiveHandSelection) preview.conditionPreview.push("限制：本回合只能选择此手札");
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
      version: "1.392-public-template-tactics",
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

  function isExclusiveDuelHandSelection(actionOrEntry) {
    var action = getActionFromEntry(actionOrEntry);
    return Boolean(action?.exclusiveHandSelection || action?.exclusiveSelection || action?.selectionMode === "exclusive");
  }

  function getExclusiveDuelHandSelectionReason(actionOrEntry) {
    var action = getActionFromEntry(actionOrEntry);
    return action?.selectionLockReason || "该手札必须单独使用";
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

  function isMeaningfulDuelEffectValue(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value) && value !== 0 && value !== 1;
    if (typeof value === "string") return Boolean(value.trim());
    if (Array.isArray(value)) return value.some(isMeaningfulDuelEffectValue);
    if (value && typeof value === "object") return Object.keys(value).some(function hasMeaningfulChild(key) {
      if (key === "id" || key === "label" || key === "name") return Boolean(String(value[key] || "").trim());
      return isMeaningfulDuelEffectValue(value[key]);
    });
    return false;
  }

  function hasMeaningfulDuelHandValues(candidate) {
    var action = candidate?.action || candidate || {};
    var effects = action.effects || {};
    var numericFields = [
      "baseDamage",
      "baseBlock",
      "baseShield",
      "baseDomainPressure",
      "baseEvidencePressure",
      "baseJackpotGauge",
      "baseStabilityDamage",
      "baseStabilityRestore",
      "baseDomainLoadDelta",
      "baseHealing",
      "baseCeDamage",
      "hpDamage",
      "ceDamage"
    ];
    if (action.techniqueFeatureHand || action.featureTechniqueHand || action.specialHandCard) return true;
    if (action.domainSpecific || action.domainRole || effects.activateDomain || effects.releaseDomain) return true;
    if (action.summonSpec || action.mechanismSpec || action.resourceSpec || action.serviceReceiptRules || action.massiveObjectRules) return true;
    if (action.projectionSorcery || action.starRageEffect || action.bloodConversion || action.bloodRuntime || action.starRageRuntime || action.projectionRuntime) return true;
    if (numericFields.some(function hasNumericField(field) {
      var value = Number(action[field] ?? effects[field]);
      return Number.isFinite(value) && value !== 0;
    })) return true;
    return Object.keys(effects).some(function hasMeaningfulEffect(key) {
      return isMeaningfulDuelEffectValue(effects[key]);
    });
  }

  function filterMeaningfulDuelHandCandidates(candidates) {
    return (candidates || []).filter(hasMeaningfulDuelHandValues);
  }

  function getCachedDuelActionPool(actor, opponent, battle) {
    if (!battle) return callDependency("buildDuelActionPool", [actor, opponent, battle]) || [];
    var side = actor?.side || "left";
    var cacheKey = [
      battle.battleId || battle.onlineRoomId || "battle",
      side,
      getTurnNumber(battle),
      actor?.characterId || actor?.profileId || actor?.id || "",
      opponent?.characterId || opponent?.profileId || opponent?.id || "",
      Number(actor?.ce || 0).toFixed(1),
      Number(actor?.hp || 0).toFixed(1)
    ].join("|");
    battle.actionPoolCache ||= {};
    var cached = battle.actionPoolCache[side];
    if (cached?.key === cacheKey && Array.isArray(cached.pool)) return cached.pool;
    var pool = callDependency("buildDuelActionPool", [actor, opponent, battle]) || [];
    battle.actionPoolCache[side] = { key: cacheKey, pool: pool };
    return pool;
  }

  function buildDuelHandCandidates(actor, opponent, duelState, options) {
    var battle = getBattle(duelState);
    var side = getActorSide(actor, options);
    var pool = getCachedDuelActionPool(actor, opponent, battle);
    var candidates = (pool || []).map(function mapAction(action) {
      return wrapActionAsCandidate(action, actor, opponent, battle, options);
    });
    var rules = options?.characterCardRules || getDuelCharacterCardRules();
    var profile = buildDuelCharacterCardProfile(actor, { rules: rules });
    if (consumeDomainScriptNoCard(actor, battle, side)) return [];
    candidates = filterMeaningfulDuelHandCandidates(candidates);
    candidates = filterInactiveRuleSubphaseCards(candidates, actor, battle);
    candidates = filterStrictRuleSubphaseHandCandidates(candidates, actor, battle);
    candidates = filterSpentTenShadowsSummons(candidates, battle, side);
    var filtered = filterDuelHandCandidatesByCharacter(candidates, actor, { rules: rules, profile: profile, battle: battle });
    return applyDuelCharacterCardWeights(filtered, actor, { rules: rules, profile: profile }).filter(function keepNormalHand(candidate) {
      return !isDomainHandCandidate(candidate);
    });
  }

  function pickDuelHandCandidates(actor, opponent, duelState, count) {
    var battle = getBattle(duelState);
    var rules = getDuelHandRules();
    var choiceCount = getChoiceCount(rules, count);
    var picker = getOptionalFunction("pickDuelActionChoices");
    var rawPool = getCachedDuelActionPool(actor, opponent, battle);
    var side = actor?.side || "left";
    var strictRuleSubphaseHand = shouldReplaceHandWithRuleSubphaseCards(actor, battle);
    var currentTrialReplacement = getCurrentTrialReplacementHandCards(actor, battle, side, rules);
    if (currentTrialReplacement.length) {
      if (battle && actor?.side === "left") {
        battle.handCandidates = currentTrialReplacement;
        buildDuelHandCandidateCache(battle);
      }
      return currentTrialReplacement;
    }
    if (shouldReplaceHandWithTrialCards(actor, battle)) {
      var rebuiltTrialReplacement = rebuildTrialReplacementHandCards(actor, battle, side, rules);
      if (battle && actor?.side === "left") {
        battle.handCandidates = rebuiltTrialReplacement;
        buildDuelHandCandidateCache(battle);
      }
      return rebuiltTrialReplacement;
    }
    if (consumeDomainScriptNoCard(actor, battle, side)) {
      initializeDuelHandState(battle, rules);
      battle.handState[side] = {
        ...(battle.handState?.[side] || {}),
        cards: [],
        round: getTurnNumber(battle),
        lastDrawn: [],
        maxHandSize: getMaxHandSize(rules),
        drawPerTurn: getDrawPerTurn(rules)
      };
      if (side === "left") {
        battle.handCandidates = [];
        buildDuelHandCandidateCache(battle);
      }
      return [];
    }
    var fullCandidates = rawPool.map(function mapAction(action) {
      return wrapActionAsCandidate(action, actor, opponent, battle, { count: choiceCount });
    });
    fullCandidates = filterMeaningfulDuelHandCandidates(fullCandidates);
    fullCandidates = filterInactiveRuleSubphaseCards(fullCandidates, actor, battle);
    fullCandidates = filterStrictRuleSubphaseHandCandidates(fullCandidates, actor, battle);
    fullCandidates = filterSpentTenShadowsSummons(fullCandidates, battle, side);
    var splitPool = splitNormalAndDomainCandidates(fullCandidates);
    var actions = strictRuleSubphaseHand
      ? splitPool.normal.slice(0, choiceCount)
      : picker
      ? picker(actor, opponent, battle, choiceCount)
      : splitPool.normal.slice(0, choiceCount);
    actions = (actions || []).filter(function keepNormalAction(action) {
      return !isDomainHandCandidate(action);
    });
    var candidates = rankDuelHandCandidatesByCharacter(splitPool.normal, actions, actor, opponent, battle, choiceCount, {});
    var handCards = updatePersistentDuelHand(actor, opponent, battle, candidates, rules, {
      side: actor?.side || "left",
      fullCandidates: fullCandidates,
      strictReplaceHand: strictRuleSubphaseHand
    });
    if (battle && actor?.side === "left") {
      battle.handCandidates = handCards;
      buildDuelHandCandidateCache(battle);
    }
    return handCards;
  }

  function pickDuelDomainHandCandidates(actor, opponent, duelState, count) {
    var battle = getBattle(duelState);
    var rules = getDuelHandRules();
    var maxDomainCards = count === undefined ? getDomainHandSize(rules) : Math.max(0, Math.round(Number(count || 0)));
    if (!battle || !maxDomainCards || rules.domainHand?.enabled === false) return [];
    initializeDuelHandState(battle, rules);
    var side = getActorSide(actor, { side: actor?.side || "left" });
    if (consumeDomainScriptNoCard(actor, battle, side)) {
      battle.domainHandState ||= {};
      battle.domainHandState[side] = {
        cards: [],
        round: getTurnNumber(battle),
        lastRefreshed: [],
        maxHandSize: maxDomainCards
      };
      if (side === "left") {
        battle.domainHandCandidates = [];
        buildDuelHandCandidateCache(battle);
      }
      return [];
    }
    if (shouldReplaceHandWithRuleSubphaseCards(actor, battle)) {
      battle.domainHandState ||= {};
      battle.domainHandState[side] = {
        cards: [],
        round: getTurnNumber(battle),
        lastRefreshed: [],
        maxHandSize: maxDomainCards
      };
      if (side === "left") {
        battle.domainHandCandidates = [];
        buildDuelHandCandidateCache(battle);
      }
      return [];
    }
    var domainState = battle.domainHandState?.[side] || { cards: [], round: 0, lastRefreshed: [], maxHandSize: maxDomainCards };
    var round = getTurnNumber(battle);
    if (Number(domainState.round || 0) === round && Array.isArray(domainState.cards)) {
      return domainState.cards.slice(0, maxDomainCards);
    }
    var rawPool = callDependency("buildDuelActionPool", [actor, opponent, battle]) || [];
    var fullCandidates = rawPool.map(function mapAction(action) {
      return wrapActionAsCandidate(action, actor, opponent, battle, { count: maxDomainCards, side: side });
    });
    fullCandidates = filterMeaningfulDuelHandCandidates(fullCandidates);
    fullCandidates = filterInactiveRuleSubphaseCards(fullCandidates, actor, battle);
    fullCandidates = filterSpentTenShadowsSummons(fullCandidates, battle, side);
    var domainCandidates = filterDomainCandidatesByPhase(splitNormalAndDomainCandidates(fullCandidates).domain, actor, opponent);
    var ranked = rankDuelHandCandidatesByCharacter(domainCandidates, [], actor, opponent, battle, maxDomainCards, {
      domainHand: true,
      handRules: rules,
      randomize: 1.4
    });
    var refreshed = ranked.slice(0, maxDomainCards).map(function markDomainCard(candidate) {
      return {
        ...(candidate || {}),
        handSource: "domain-refresh",
        domainHand: true,
        drawnRound: round
      };
    });
    battle.domainHandState ||= {};
    battle.domainHandState[side] = {
      cards: refreshed,
      round: round,
      lastRefreshed: refreshed.map(function summarize(card) {
        return { actionId: getActionId(card), label: card.label || card.id || getActionId(card) };
      }),
      maxHandSize: maxDomainCards
    };
    if (side === "left") {
      battle.domainHandCandidates = refreshed;
      buildDuelHandCandidateCache(battle);
    }
    return refreshed;
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
    var handState = battle.handState || {};
    var handCards = [].concat(handState.left?.cards || [], handState.right?.cards || []);
    var handCard = handCards.find(function findHandMatch(item) {
      return item?.id === id || item?.actionId === id || item?.sourceActionId === id || item?.action?.id === id;
    });
    if (handCard) return handCard;
    return [].concat(battle.handCandidates || battle.actionChoices || [], battle.domainHandCandidates || []).find(function findMatch(item) {
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
    if (isDuelActorDefeatedForExecution(actor, battle, side)) {
      return { ok: false, reason: "体势已归零，无法选择手札" };
    }
    var candidate = typeof actionOrId === "string" ? findCandidateById(battle, actionOrId) : actionOrId;
    var action = candidate?.action || candidate;
    if (!action?.id) return { ok: false, reason: "手札不存在" };
    var selected = getDuelSelectedHandActions(battle, side);
    var hand = getPersistentHandState(battle, side, options?.rules);
    if (Number(hand?.pendingDiscardCount || 0) > 0) {
      return { ok: false, reason: "手牌超过上限，请先弃牌", action: action };
    }
    if (selected.some(function alreadySelected(entry) {
      return getActionId(entry) === action.id;
    })) {
      return { ok: false, reason: "本回合已选择", action: action };
    }
    var exclusiveSelected = selected.find(isExclusiveDuelHandSelection);
    if (exclusiveSelected) {
      return { ok: false, reason: getExclusiveDuelHandSelectionReason(exclusiveSelected), action: action };
    }
    if (isExclusiveDuelHandSelection(action) && selected.length > 0) {
      return { ok: false, reason: getExclusiveDuelHandSelectionReason(action), action: action };
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

  function buildDuelHandTargetPlan(action, actor, opponent, battle, entry, options) {
    var explicitTargetId = entry?.targetId || entry?.primaryTargetId || entry?.target?.id || action?.targetId || action?.primaryTargetId || "";
    var targetSide = entry?.targetSide || entry?.primaryTargetSide || action?.targetSide || action?.primaryTargetSide || opponent?.side || "";
    return {
      source: "duel_hand_selection",
      selectionMode: explicitTargetId ? "explicit" : "guard_priority",
      actorSide: actor?.side || getActorSide(actor, options),
      primaryTargetSide: targetSide,
      primaryTargetId: explicitTargetId,
      targetTeamId: entry?.targetTeamId || action?.targetTeamId || "",
      allowUnitInterception: action?.allowUnitInterception !== false && action?.bypassGuard !== true,
      teamModeReady: true
    };
  }

  function withDuelHandTargetPlan(action, actor, opponent, battle, entry, options) {
    if (!action) return action;
    var existing = action.targetPlan || {};
    return {
      ...action,
      targetPlan: {
        ...buildDuelHandTargetPlan(action, actor, opponent, battle, entry, options),
        ...existing
      }
    };
  }

  function applyDuelSelectedHandActions(actor, opponent, duelState, options) {
    var battle = getBattle(duelState);
    if (!battle || !actor || !opponent) return { applied: false, reason: "战斗资源缺失", actions: [], results: [] };
    var side = getActorSide(actor, options);
    var selected = normalizeSelectedForExecution(options?.actions || getDuelSelectedHandActions(battle, side), actor, opponent, battle, options);
    if (!selected.length) return { applied: false, reason: "尚未选择手札", actions: [], results: [] };
    if (isDuelActorDefeatedForExecution(actor, battle, side)) {
      return { applied: false, reason: "体势已归零，无法继续行动", side: side, actions: [], results: [] };
    }
    var preflight = validateDuelSelectedForExecution(actor, opponent, battle, side, selected, options);
    if (!preflight.ok) return preflight;
    selected = preflight.entries;
    var results = [];
    var appliedActions = [];
    for (var index = 0; index < selected.length; index += 1) {
      var entry = selected[index];
      var action = getActionFromEntry(entry);
      if (!action?.id) continue;
      var actionForExecution = withDuelHandTargetPlan({
        ...withZeroCeCostOverride(action, actor),
        selectedCount: selected.length,
        selectedIndex: index,
        selectedLast: index === selected.length - 1
      }, actor, opponent, battle, entry, options);
      var result = callDependency("applyDuelActionEffect", [actionForExecution, actor, opponent, battle]);
      results.push({ applied: Boolean(result), reason: result ? "" : "动作未结算", action: actionForExecution, result: result });
      if (result) appliedActions.push(actionForExecution);
      if (isDuelActorDefeatedForExecution(actor, battle, side)) break;
    }
    if (appliedActions.length && options?.clearAfter !== false) {
      removeCardsFromPersistentHand(battle, side, appliedActions.map(function mapAction(action) { return action.id; }), options?.rules);
      invalidateDuelHandCandidateCache(battle);
      clearDuelSelectedHandActions(battle, side, { refund: false, rules: options?.rules });
    }
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
    var selectedIds = new Set(entries.map(getActionId).filter(Boolean));
    var exclusiveEntry = entries.find(isExclusiveDuelHandSelection);
    var simulatedActor = actor ? {
      ...actor,
      hp: Number(actor.hp || 0),
      ce: Number(actor.ce || 0),
      maxHp: Number(actor.maxHp || 0),
      maxCe: Number(actor.maxCe || 0)
    } : actor;
    if (isDuelActorDefeatedForExecution(actor, battle, side)) {
      return {
        applied: false,
        ok: false,
        reason: "体势已归零，无法行动",
        side: side,
        actions: entries.map(getActionFromEntry),
        results: results,
        totalCeCost: totalCeCost
      };
    }
    if (exclusiveEntry && entries.length > 1) {
      return {
        applied: false,
        ok: false,
        reason: getExclusiveDuelHandSelectionReason(exclusiveEntry),
        side: side,
        actions: entries.map(getActionFromEntry),
        results: results,
        totalCeCost: totalCeCost
      };
    }
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
      var availability = getAvailability(action, simulatedActor, opponent, battle);
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
      if (simulatedActor) {
        var paidCe = Math.min(Number(simulatedActor.ce || 0), ceCost);
        simulatedActor.ce = Number((Number(simulatedActor.ce || 0) - paidCe).toFixed(1));
        var hpCost = Number(action?.effects?.selfHpCostFlat ?? action?.selfHpCostFlat ?? 0);
        if (hpCost > 0) {
          var beforeHp = Number(simulatedActor.hp || 0);
          simulatedActor.hp = Number(Math.max(1, beforeHp - hpCost).toFixed(1));
          hpCost = Math.max(0, beforeHp - Number(simulatedActor.hp || 0));
        }
        if (action?.bloodConversion === "ce_to_hp") {
          simulatedActor.hp = Number((Number(simulatedActor.hp || 0) + paidCe * Number(action.bloodCeToHpEfficiency || 0.82)).toFixed(1));
        } else if (action?.bloodConversion === "hp_to_ce") {
          simulatedActor.ce = Number((Number(simulatedActor.ce || 0) + hpCost * Number(action.bloodHpToCeEfficiency || 0.76)).toFixed(1));
        }
      }
    }
    var remainingCe = Number(simulatedActor ? simulatedActor.ce : Number(actor.ce || 0));
    if (remainingCe < 0) {
      return { applied: false, ok: false, reason: "咒力不足", side: side, actions: entries.map(getActionFromEntry), results: [], totalCeCost: totalCeCost };
    }
    return { ok: true, entries: entries, totalCeCost: totalCeCost };
  }

  function isOpponentMahoragaProxyActive(battle, opponent) {
    var side = opponent?.side || "";
    return Boolean(side && battle?.mahoragaProxy?.[side]?.active);
  }

  function getCpuDamagePriority(candidate) {
    var action = getActionFromEntry(candidate);
    var effects = action?.effects || {};
    var values = [
      action?.numericPreview?.finalDamage,
      action?.baseDamage,
      action?.hpDamage,
      effects.hpDamage,
      effects.directDamage,
      effects.hutianBlackFlash ? 45 : 0
    ];
    return values.reduce(function maxDamage(max, value) {
      var numeric = Number(value || 0);
      return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
    }, 0);
  }

  function getCpuBlockPriority(candidate) {
    var action = getActionFromEntry(candidate);
    var effects = action?.effects || {};
    return [action?.numericPreview?.finalBlock, action?.baseBlock, effects.block, effects.incomingHpScale ? (1 - Number(effects.incomingHpScale || 1)) * 80 : 0]
      .reduce(function maxBlock(max, value) {
        var numeric = Number(value || 0);
        return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
      }, 0);
  }

  function getCpuActionType(candidate) {
    var action = getActionFromEntry(candidate);
    return String(action?.cardType || action?.type || "").toLowerCase();
  }

  function chooseDuelCpuStrategy(actor, opponent, candidates) {
    var actorHpRatio = Number(actor?.maxHp || 0) > 0 ? Number(actor.hp || 0) / Number(actor.maxHp || 1) : 1;
    var actorCeRatio = Number(actor?.maxCe || 0) > 0 ? Number(actor.ce || 0) / Number(actor.maxCe || 1) : 1;
    var opponentHp = Number(opponent?.hp || 0);
    var possibleDamage = (candidates || []).reduce(function sumDamage(total, candidate) {
      return total + getCpuDamagePriority(candidate);
    }, 0);
    if (opponentHp > 0 && possibleDamage >= opponentHp * 0.92) return "KILL";
    if (actorHpRatio <= 0.36) return "DEFENSE";
    if (actorCeRatio <= 0.24) return "VALUE";
    if (Number(actor?.hp || 0) - Number(opponent?.hp || 0) > 80 && actorCeRatio >= 0.45) return "TEMPO";
    return "BALANCE";
  }

  function getDuelCpuStrategyWeights(strategy) {
    return {
      KILL: { damage: 1.85, block: 0.08, ceUse: 0.22, conserve: -0.18, domain: 0.4, support: 0.05, risk: 0.05 },
      TEMPO: { damage: 1.05, block: 0.35, ceUse: 0.22, conserve: -0.05, domain: 0.45, support: 0.3, risk: -0.08 },
      DEFENSE: { damage: 0.5, block: 1.25, ceUse: 0.16, conserve: 0.08, domain: 0.25, support: 0.45, risk: -0.35 },
      VALUE: { damage: 0.72, block: 0.42, ceUse: -0.1, conserve: 0.62, domain: 0.15, support: 0.38, risk: -0.28 },
      BALANCE: { damage: 0.9, block: 0.62, ceUse: 0.14, conserve: 0.16, domain: 0.32, support: 0.28, risk: -0.12 }
    }[strategy] || { damage: 0.9, block: 0.62, ceUse: 0.14, conserve: 0.16, domain: 0.32, support: 0.28, risk: -0.12 };
  }

  function normalizeDuelCpuDifficulty(value) {
    var key = String(value || "").trim().toLowerCase();
    return ["easy", "normal", "hard"].includes(key) ? key : "normal";
  }

  function getDuelCpuDifficultyConfig(value, rules) {
    var defaults = {
      easy: { id: "easy", label: "简单：陪练", beamWidth: 1, scoreNoise: 0.2, mistakeRate: 0.2, mistakePool: 3 },
      normal: { id: "normal", label: "普通：稳定", beamWidth: 3, scoreNoise: 0, mistakeRate: 0, mistakePool: 1 },
      hard: { id: "hard", label: "困难：强规划", beamWidth: 5, scoreNoise: 0, mistakeRate: 0, mistakePool: 1 }
    };
    var id = normalizeDuelCpuDifficulty(value || rules?.cpuDifficulty?.default || "normal");
    var configured = rules?.cpuDifficulty?.options?.[id] || {};
    return { ...defaults[id], ...configured, id };
  }

  function getDuelCpuPlanningRandom(battle) {
    var value = typeof battle?.rng === "function" ? battle.rng() : Math.random();
    return Math.max(0, Math.min(0.999999, Number(value) || 0));
  }

  function isDuelCpuSetupAction(candidate) {
    var action = getActionFromEntry(candidate);
    var type = getCpuActionType(candidate);
    var effects = action?.effects || {};
    return ["support", "resource", "defense", "counter"].some(function match(part) { return type.includes(part); }) ||
      Number(effects.outgoingScale || effects.damageScale || 0) > 1 ||
      Number(effects.stabilityDelta || 0) > 0 ||
      Number(getCpuBlockPriority(candidate) || 0) > 0;
  }

  function isDuelCpuAttackAction(candidate) {
    return getCpuDamagePriority(candidate) > 0;
  }

  function getDuelCpuActorSide(actor) {
    return actor?.side || "right";
  }

  function createDuelCpuTempSelectionEntry(candidate, actor, battle) {
    var action = getActionFromEntry(candidate);
    var actionId = getActionId(candidate);
    return {
      id: actionId,
      actionId: actionId,
      label: candidate?.label || action?.label || actionId,
      action: action,
      selectedRound: getTurnNumber(battle),
      side: getDuelCpuActorSide(actor)
    };
  }

  function getDuelCpuAvailabilityForSequence(candidate, actor, opponent, battle, sequence) {
    if (!battle) return getAvailability(getActionFromEntry(candidate), actor, opponent, battle);
    var side = getDuelCpuActorSide(actor);
    var previousSelections = battle.selectedHandActions?.[side];
    battle.selectedHandActions ||= {};
    battle.selectedHandActions[side] = (sequence || []).map(function mapSequence(item) {
      return createDuelCpuTempSelectionEntry(item, actor, battle);
    });
    try {
      return getAvailability(getActionFromEntry(candidate), actor, opponent, battle);
    } finally {
      if (previousSelections) {
        battle.selectedHandActions[side] = previousSelections;
      } else if (battle.selectedHandActions) {
        delete battle.selectedHandActions[side];
      }
    }
  }

  function isDuelCpuConditionalAvailability(availability) {
    var reason = String(availability?.reason || "");
    return /需要本回合一起|需要.*一起|another card|requires another/i.test(reason);
  }

  function getDuelCpuTechniqueText(candidate) {
    return collectCandidateSearchText(candidate);
  }

  function isDuelCpuProjectionAttack(candidate) {
    var action = getActionFromEntry(candidate);
    var spec = action?.projectionSorcery || {};
    var text = getDuelCpuTechniqueText(candidate);
    return Boolean(action?.projectionRuntime?.active || action?.projectionSorcery || /projection_sorcery|投射|二十四帧|帧内闪击|破帧/.test(text)) && getCpuDamagePriority(candidate) > 0 && spec.effect !== "self_bind";
  }

  function isDuelCpuProjectionSelfBind(candidate) {
    var action = getActionFromEntry(candidate);
    var text = getDuelCpuTechniqueText(candidate);
    return action?.projectionSorcery?.effect === "self_bind" || /自缚帧|projectionSelfBindFrame/.test(text);
  }

  function isDuelCpuSequenceCompatible(candidate, sequence) {
    var action = getActionFromEntry(candidate);
    var previous = Array.isArray(sequence) ? sequence : [];
    if (!action?.id) return false;
    if (isExclusiveDuelHandSelection(action) && previous.length > 0) return false;
    if (previous.some(isExclusiveDuelHandSelection)) return false;
    if (action.starRageEffect === "black_hole" && previous.length > 0) return false;
    if (previous.some(function hasBlackHole(item) { return getActionFromEntry(item)?.starRageEffect === "black_hole"; })) return false;
    if (isDuelCpuProjectionSelfBind(candidate) && previous.some(isDuelCpuProjectionAttack)) return false;
    if (isDuelCpuProjectionAttack(candidate) && previous.some(isDuelCpuProjectionSelfBind)) return false;
    if (action?.projectionSorcery?.requiresAnotherCard && previous.length < 1) return false;
    return true;
  }

  function getDuelCpuTechniqueState(actor, battle) {
    var side = getDuelCpuActorSide(actor);
    var turn = getTurnNumber(battle);
    var projection = battle?.projectionSorceryState?.[side] || {};
    var star = battle?.starRageState?.[side] || {};
    var blood = battle?.bloodManipulationState?.[side] || {};
    return {
      side: side,
      turn: turn,
      projectionFrame: Number(projection.frame ?? 10),
      projectionMax: Number(projection.max ?? 24),
      starMass: Number(star.mass ?? 1),
      bloodPierce: Number(blood.pierce || 0),
      bloodBoost: Number(blood.blood || 0)
    };
  }

  function scoreDuelCpuTechniqueSynergy(candidate, actor, opponent, battle, strategy, sequence) {
    var action = getActionFromEntry(candidate);
    if (!action?.id) return 0;
    var previous = Array.isArray(sequence) ? sequence : [];
    var state = getDuelCpuTechniqueState(actor, battle);
    var hpRatio = Number(actor?.maxHp || 0) > 0 ? Number(actor.hp || 0) / Number(actor.maxHp || 1) : 1;
    var ceRatio = Number(actor?.maxCe || 0) > 0 ? Number(actor.ce || 0) / Number(actor.maxCe || 1) : 1;
    var damage = getCpuDamagePriority(candidate);
    var block = getCpuBlockPriority(candidate);
    var score = 0;
    var type = getCpuActionType(candidate);
    var spec = action.projectionSorcery || {};
    if (action.projectionSorcery || /projection_sorcery|投射|帧/.test(getDuelCpuTechniqueText(candidate))) {
      var frameNeed = Math.max(0, state.projectionMax - state.projectionFrame);
      if (Number(spec.frameGain || 0) > 0) score += Math.min(26, Number(spec.frameGain || 0) * 5 + frameNeed * 0.7);
      if (spec.effect === "frame_shield" && (hpRatio < 0.58 || strategy === "DEFENSE")) score += 24 + block * 0.35;
      if (spec.effect === "over_frame_drive" && previous.length > 0) score += 22;
      if (spec.effect === "self_bind") score += strategy === "DEFENSE" || hpRatio < 0.5 ? 18 : -18;
      if (isDuelCpuProjectionAttack(candidate) && previous.some(function hasProjectionSetup(item) {
        var setup = getActionFromEntry(item)?.projectionSorcery || {};
        return Number(setup.frameGain || 0) > 0 || setup.effect === "over_frame_drive";
      })) score += 18;
      if (Number(spec.frameCost || 0) > 0 && state.projectionFrame - Number(spec.frameCost || 0) < 8 && strategy !== "KILL") score -= 18;
      if (state.projectionFrame >= state.projectionMax - 1 && damage > 0) score += 34;
    }
    if (action.starRageEffect || /star_rage|星之怒|虚拟质量|凰轮|黑洞/.test(getDuelCpuTechniqueText(candidate))) {
      if (action.starRageEffect === "mass_attack") score += previous.some(isDuelCpuAttackAction) ? -12 : 28;
      if (action.starRageEffect === "mass_defense") score += hpRatio < 0.55 || strategy === "DEFENSE" ? 30 : 8;
      if (action.starRageEffect === "garuda") score += state.starMass >= Number(action.starRageSummonMassCost || 0) ? 24 : -20;
      if (Number(action.starRageMassGain || 0) > 0) score += Math.max(6, 18 - state.starMass * 1.5);
      if (action.starRageEffect === "black_hole") {
        score += state.starMass >= 5 ? 50 + state.starMass * 5 : -80;
        if (hpRatio < 0.42 && strategy !== "KILL") score -= 36;
      }
    }
    if (action.bloodConversion || /blood_manipulation|赤血|咒力化血|血铸咒力|穿血|血刃/.test(getDuelCpuTechniqueText(candidate))) {
      if (action.bloodConversion === "ce_to_hp") score += hpRatio < 0.65 && ceRatio > 0.22 ? 34 : -8;
      if (action.bloodConversion === "hp_to_ce") score += ceRatio < 0.42 && hpRatio > 0.52 ? 32 : -24;
      if (!action.bloodConversion && damage > 0) {
        score += (state.bloodPierce + state.bloodBoost) * 42;
        if (previous.some(function hasBloodConversion(item) { return Boolean(getActionFromEntry(item)?.bloodConversion); })) score += 16;
      }
      if (Number(action.bloodHpCostRatio || 0) > 0 && hpRatio < 0.36 && strategy !== "KILL") score -= 28;
    }
    if (action.summonSpec || type.includes("summon")) score += previous.length === 0 ? 20 : 8;
    if (action.resourceSpec || type.includes("resource")) score += ceRatio < 0.5 ? 20 : 10;
    return Number(score.toFixed(4));
  }

  function scoreDuelCpuAction(candidate, actor, opponent, battle, strategy, usedCe, sequence) {
    var action = getActionFromEntry(candidate);
    if (!action?.id) return -9999;
    var weights = getDuelCpuStrategyWeights(strategy);
    var type = getCpuActionType(candidate);
    var damage = getCpuDamagePriority(candidate);
    var block = getCpuBlockPriority(candidate);
    var ceCost = Math.max(0, Number(getCeCost(action, actor) || 0));
    var maxCe = Math.max(1, Number(actor?.maxCe || actor?.ce || 1));
    var remainingCe = Math.max(0, Number(actor?.ce || 0) - Number(usedCe || 0) - ceCost);
    var score = 0;
    score += damage * weights.damage;
    score += block * weights.block;
    score += (ceCost / maxCe) * 30 * weights.ceUse;
    score += (remainingCe / maxCe) * 18 * weights.conserve;
    if (type.includes("domain") || action.effects?.activateDomain) score += 18 * weights.domain;
    if (["support", "resource", "defense", "counter"].some(function match(part) { return type.includes(part); })) score += 12 * weights.support;
    if (action.risk === "critical") score += 18 * weights.risk;
    if (action.risk === "high") score += 10 * weights.risk;
    if (Number(opponent?.hp || 0) > 0 && damage >= Number(opponent.hp || 0)) score += strategy === "KILL" ? 180 : 60;
    if (Number(actor?.hp || 0) < Number(actor?.maxHp || 0) * 0.32 && block > 0) score += 35;
    if (battle?.domainSubPhase && /trial|rule/.test(type + " " + action.id)) score += 12;
    if (isExclusiveDuelHandSelection(action) && strategy !== "KILL" && damage < Number(opponent?.hp || 0)) score -= 8;
    var previous = Array.isArray(sequence) ? sequence : [];
    var hasSetupBefore = previous.some(isDuelCpuSetupAction);
    var hasAttackBefore = previous.some(isDuelCpuAttackAction);
    if (isDuelCpuAttackAction(candidate) && hasSetupBefore) score += strategy === "KILL" ? 10 : 6;
    if (isDuelCpuSetupAction(candidate) && !hasAttackBefore) score += strategy === "DEFENSE" ? 7 : 3.5;
    if (isDuelCpuSetupAction(candidate) && hasAttackBefore && strategy !== "DEFENSE") score -= 4;
    score += scoreDuelCpuTechniqueSynergy(candidate, actor, opponent, battle, strategy, sequence);
    return Number(score.toFixed(4));
  }

  function getDuelCpuPlayableCandidates(actor, opponent, battle, ordered) {
    var used = new Set();
    return (ordered || []).filter(function keepPlayable(candidate) {
      var action = getActionFromEntry(candidate);
      var actionId = getActionId(candidate);
      if (!action?.id || !actionId || used.has(actionId)) return false;
      used.add(actionId);
      var availability = getDuelCpuAvailabilityForSequence(candidate, actor, opponent, battle, []);
      if (!availability.available && !isDuelCpuConditionalAvailability(availability)) return false;
      var ceCost = Math.max(0, Number(availability.costCe ?? getCeCost(action, actor)));
      return Number(actor?.ce || 0) >= ceCost;
    });
  }

  function getDuelCpuTargetSelectionCount(strategy, actor, playable, maxSelections) {
    var count = Math.max(0, Math.min(Number(maxSelections || 1), playable?.length || 0));
    if (count <= 1) return count;
    var ceRatio = Number(actor?.maxCe || 0) > 0 ? Number(actor.ce || 0) / Number(actor.maxCe || 1) : 1;
    if (strategy === "KILL" || strategy === "TEMPO") return Math.min(3, count);
    if (strategy === "DEFENSE") return Math.min(count, playable.some(function hasBlock(candidate) { return getCpuBlockPriority(candidate) > 0; }) ? 3 : 2);
    if (strategy === "VALUE") return ceRatio < 0.12 ? 1 : Math.min(2, count);
    return ceRatio < 0.16 ? Math.min(2, count) : Math.min(3, count);
  }

  function scoreDuelCpuBeamFinal(beam, targetCount, maxSelections) {
    var length = Number(beam?.sequence?.length || 0);
    var target = Math.max(0, Number(targetCount || 0));
    var score = Number(beam?.score || 0);
    if (length > 0) score += length * 9;
    if (target > 0 && length === 0) score -= 120;
    if (target > 0 && length < target) score -= (target - length) * 28;
    if (length >= Math.min(target, maxSelections || target)) score += 10;
    return Number(score.toFixed(4));
  }

  function buildDuelCpuKillSequence(actor, opponent, battle, ordered, rules) {
    var maxSelections = getMaxSelections(rules);
    var hp = Math.max(0, Number(opponent?.hp || 0));
    if (!hp) return [];
    var usedCe = 0;
    var sequence = [];
    var candidates = (ordered || []).slice().sort(function byDamage(left, right) {
      return getCpuDamagePriority(right) - getCpuDamagePriority(left);
    });
    candidates.some(function addLethal(candidate) {
      var action = getActionFromEntry(candidate);
      if (!action?.id || sequence.length >= maxSelections) return true;
      if (!isDuelCpuAttackAction(candidate)) return false;
      var availability = getAvailability(action, actor, opponent, battle);
      var ceCost = Math.max(0, Number(availability.costCe ?? getCeCost(action, actor)));
      if (!availability.available || Number(actor.ce || 0) < usedCe + ceCost) return false;
      sequence.push(candidate);
      usedCe += ceCost;
      var damage = sequence.reduce(function sum(total, item) { return total + getCpuDamagePriority(item); }, 0);
      return damage >= hp;
    });
    return sequence.reduce(function sum(total, item) { return total + getCpuDamagePriority(item); }, 0) >= hp ? sequence : [];
  }

  function planDuelCpuHandSequence(actor, opponent, battle, ordered, options) {
    var rules = options?.rules || getDuelHandRules();
    var difficulty = getDuelCpuDifficultyConfig(options?.difficulty || battle?.cpuDifficulty || rules.cpuDifficulty?.default || "normal", rules);
    var maxSelections = getMaxSelections(rules);
    var width = Math.max(1, Math.min(5, Number(options?.beamWidth || difficulty.beamWidth || rules.cpuBeamWidth || 3)));
    var strategy = chooseDuelCpuStrategy(actor, opponent, ordered);
    var playable = getDuelCpuPlayableCandidates(actor, opponent, battle, ordered);
    var targetSelections = getDuelCpuTargetSelectionCount(strategy, actor, playable, maxSelections);
    if (!playable.length) {
      battle.cpuPlannerLog = {
        difficulty: difficulty.id,
        difficultyLabel: difficulty.label,
        strategy: strategy,
        beamWidth: width,
        scoreNoise: Number(difficulty.scoreNoise || 0),
        score: 0,
        actionIds: [],
        playableCount: 0,
        targetSelections: 0,
        reason: "no-playable-hand-actions",
        generatedAtRound: Number(battle.round || 0) + 1
      };
      return [];
    }
    if (strategy === "KILL") {
      var killSequence = buildDuelCpuKillSequence(actor, opponent, battle, ordered, rules);
      if (killSequence.length) {
        battle.cpuPlannerLog = {
          difficulty: difficulty.id,
          difficultyLabel: difficulty.label,
          strategy: "KILL",
          beamWidth: width,
          fastPath: "lethal-confirmed",
          score: killSequence.reduce(function sum(total, item) { return total + getCpuDamagePriority(item); }, 0),
          actionIds: killSequence.map(getActionId),
          playableCount: playable.length,
          targetSelections: Math.min(maxSelections, killSequence.length),
          generatedAtRound: Number(battle.round || 0) + 1
        };
        return killSequence;
      }
    }
    var beams = [{ sequence: [], score: 0, usedCe: 0, usedIds: new Set(), criticalUsed: false }];
    var steps = Math.max(1, Math.min(maxSelections, ordered.length));
    for (var step = 0; step < steps; step += 1) {
      var expanded = [];
      beams.forEach(function expandBeam(beam) {
        if (beam.sequence.length > 0) expanded.push({
          ...beam,
          score: beam.score - Math.max(0, targetSelections - beam.sequence.length) * 6
        });
        ordered.forEach(function addCandidate(candidate) {
          var action = getActionFromEntry(candidate);
          var actionId = getActionId(candidate);
          if (!action?.id || !actionId || beam.usedIds.has(actionId)) return;
          if (beam.sequence.length >= maxSelections) return;
          if (beam.criticalUsed || (action.risk === "critical" && beam.sequence.length > 0)) return;
          if (!isDuelCpuSequenceCompatible(candidate, beam.sequence)) return;
          var availability = getDuelCpuAvailabilityForSequence(candidate, actor, opponent, battle, beam.sequence);
          var ceCost = Math.max(0, Number(availability.costCe ?? getCeCost(action, actor)));
          if (!availability.available || Number(actor.ce || 0) < beam.usedCe + ceCost) return;
          var score = scoreDuelCpuAction(candidate, actor, opponent, battle, strategy, beam.usedCe, beam.sequence);
          var nextLength = beam.sequence.length + 1;
          score += 8;
          if (nextLength <= targetSelections) score += 16;
          if (targetSelections >= 3 && nextLength === 3) score += 12;
          if (strategy !== "VALUE" && nextLength < targetSelections) score += 4;
          if (difficulty.scoreNoise) {
            score += Math.abs(score || 1) * (getDuelCpuPlanningRandom(battle) * 2 - 1) * Number(difficulty.scoreNoise || 0);
          }
          var nextIds = new Set(beam.usedIds);
          nextIds.add(actionId);
          expanded.push({
            sequence: beam.sequence.concat(candidate),
            score: beam.score + score - Math.max(0, beam.sequence.length) * 1.5,
            usedCe: beam.usedCe + ceCost,
            usedIds: nextIds,
            criticalUsed: beam.criticalUsed || action.risk === "critical"
          });
        });
      });
      expanded.sort(function byScore(left, right) {
        return scoreDuelCpuBeamFinal(right, targetSelections, maxSelections) - scoreDuelCpuBeamFinal(left, targetSelections, maxSelections);
      });
      beams = expanded.slice(0, width);
      if (!beams.length) break;
    }
    var mistakeApplied = false;
    beams = (beams || []).filter(function keepNonEmpty(beam) {
      return beam?.sequence?.length > 0;
    }).sort(function byFinalScore(left, right) {
      return scoreDuelCpuBeamFinal(right, targetSelections, maxSelections) - scoreDuelCpuBeamFinal(left, targetSelections, maxSelections);
    });
    var best = beams[0] || { sequence: playable.slice(0, Math.min(targetSelections || 1, maxSelections)), score: 0 };
    if (difficulty.mistakeRate && beams.length > 1 && getDuelCpuPlanningRandom(battle) < Number(difficulty.mistakeRate || 0)) {
      var pool = Math.max(2, Math.min(beams.length, Number(difficulty.mistakePool || 2)));
      var mistakeIndex = Math.max(1, Math.min(pool - 1, 1 + Math.floor(getDuelCpuPlanningRandom(battle) * (pool - 1))));
      best = beams[mistakeIndex] || best;
      mistakeApplied = true;
    }
    battle.cpuPlannerLog = {
      difficulty: difficulty.id,
      difficultyLabel: difficulty.label,
      strategy: strategy,
      beamWidth: width,
      scoreNoise: Number(difficulty.scoreNoise || 0),
      mistakeApplied: mistakeApplied,
      score: scoreDuelCpuBeamFinal(best, targetSelections, maxSelections),
      actionIds: (best.sequence || []).map(getActionId),
      playableCount: playable.length,
      targetSelections: targetSelections,
      selectedCount: Number(best.sequence?.length || 0),
      generatedAtRound: Number(battle.round || 0) + 1
    };
    return best.sequence || [];
  }

  function selectDuelCpuOrderedCandidates(actor, opponent, battle, side, rules, ordered, maxSelections, focusMahoragaProxy) {
    var failures = [];
    (ordered || []).some(function selectCandidate(candidate) {
      var action = getActionFromEntry(candidate);
      if (!action?.id) return false;
      if (getDuelSelectedHandActions(battle, side).length >= maxSelections) return true;
      if (action.risk === "critical" && getDuelSelectedHandActions(battle, side).length > 0) return false;
      var selected = selectDuelHandCandidate(candidate, actor, opponent, battle, { side: side, rules: rules });
      if (!selected.selected) {
        failures.push({ actionId: getActionId(candidate), reason: selected.reason || "select-failed" });
        if (selected.reason === "手牌超过上限，请先弃牌") {
          autoDiscardDuelCpuOverflow(actor, opponent, battle, side, rules);
          selected = selectDuelHandCandidate(candidate, actor, opponent, battle, { side: side, rules: rules });
          if (selected.selected) return false;
          failures.push({ actionId: getActionId(candidate), reason: selected.reason || "select-failed-after-discard" });
        }
      }
      if (!selected.selected && selected.reason === "咒力不足") return !focusMahoragaProxy;
      return false;
    });
    return failures;
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
    var domainCandidates = pickDuelDomainHandCandidates(actor, opponent, battle, getDomainHandSize(rules));
    var discardedOverflow = autoDiscardDuelCpuOverflow(actor, opponent, battle, side, rules);
    var firstPick = null;
    var cpuPicker = getOptionalFunction("getDuelCpuAction");
    if (cpuPicker) firstPick = cpuPicker(actor, opponent, battle);
    var ordered = [];
    if (getActionId(firstPick)) ordered.push(firstPick);
    domainCandidates.concat(candidates).forEach(function addCandidate(candidate) {
      var actionId = getActionId(candidate);
      if (actionId && !ordered.some(function duplicate(item) { return getActionId(item) === actionId; })) ordered.push(candidate);
    });
    var focusMahoragaProxy = isOpponentMahoragaProxyActive(battle, opponent);
    if (focusMahoragaProxy) {
      ordered = ordered.slice().sort(function byDamage(left, right) {
        return getCpuDamagePriority(right) - getCpuDamagePriority(left);
      });
    }
    var planned = planDuelCpuHandSequence(actor, opponent, battle, ordered, { ...options, rules: rules });
    var fallbackOrdered = planned.length ? planned : ordered;
    var maxSelections = getMaxSelections(rules);
    var failures = selectDuelCpuOrderedCandidates(actor, opponent, battle, side, rules, fallbackOrdered, maxSelections, focusMahoragaProxy);
    if (getDuelSelectedHandActions(battle, side).length < Math.min(maxSelections, ordered.length)) {
      failures = failures.concat(selectDuelCpuOrderedCandidates(actor, opponent, battle, side, rules, ordered, maxSelections, focusMahoragaProxy));
    }
    if (battle.cpuPlannerLog) {
      battle.cpuPlannerLog.overflowAutoDiscarded = discardedOverflow;
      battle.cpuPlannerLog.selectionFailures = failures.slice(0, 8);
      battle.cpuPlannerLog.finalSelectedCount = getDuelSelectedHandActions(battle, side).length;
    }
    return getDuelSelectedHandActions(battle, side);
  }

  function resolveDuelHandTurn(battle, options) {
    var activeBattle = getBattle(battle);
    if (!activeBattle?.resourceState) return { ok: false, reason: "战斗资源缺失" };
    var left = activeBattle.resourceState.p1;
    var right = activeBattle.resourceState.p2;
    if (!getDuelSelectedHandActions(activeBattle, "right").length && options?.autoPickCpu !== false) {
      pickDuelCpuHandActions(right, left, activeBattle, { side: "right", rules: options?.rules, difficulty: options?.difficulty || activeBattle.cpuDifficulty });
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
    var side = getActorSide(actor, options);
    if (isDuelActorDefeatedForExecution(actor, battle, side)) {
      return { applied: false, reason: "体势已归零，无法行动" };
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
    action = withDuelHandTargetPlan(withZeroCeCostOverride(action, actor), actor, opponent, battle, candidate, options);
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
    pickDuelDomainHandCandidates: pickDuelDomainHandCandidates,
    getDuelHandCardViewModel: getDuelHandCardViewModel,
    buildDuelCardViewModel: buildDuelCardViewModel,
    applyDuelHandSelection: applyDuelHandSelection,
    getDuelSelectedHandActions: getDuelSelectedHandActions,
    canSelectDuelHandCandidate: canSelectDuelHandCandidate,
    selectDuelHandCandidate: selectDuelHandCandidate,
    unselectDuelHandCandidate: unselectDuelHandCandidate,
    discardDuelHandCandidate: discardDuelHandCandidate,
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
