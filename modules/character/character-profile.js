(function attachJJKCharacterProfile(global) {
  "use strict";

  var namespace = "JJKCharacter";
  var moduleId = "character-profile";
  var version = "0.1.0-helper-candidate";
  var ranks = Object.freeze(["E-", "E", "D", "C", "B", "A", "S", "SS", "SSS", "EX-", "EX"]);
  var defaultStats = Object.freeze({
    cursedEnergy: "B",
    control: "B",
    efficiency: "B",
    body: "B",
    martial: "B",
    talent: "B"
  });
  var gradeKeys = Object.freeze(["support", "grade4", "grade3", "grade2", "grade1", "semiSpecialGrade1", "specialGrade"]);
  var stageKeys = Object.freeze([
    "custom",
    "hiddenInventory",
    "volume0",
    "mainStart",
    "shibuya",
    "shibuyaToCulling",
    "cullingGame",
    "cullingGameToShinjuku",
    "shinjuku",
    "heianToShinjuku",
    "ancient400",
    "after68",
    "modulo"
  ]);
  var gradeLabels = Object.freeze({
    support: "辅助人员",
    grade4: "四级",
    grade3: "三级",
    grade2: "二级",
    grade1: "一级",
    semiSpecialGrade1: "超一级（特别一级行政等效）",
    specialGrade: "特级"
  });
  var metadata = Object.freeze({
    namespace: namespace,
    moduleId: moduleId,
    version: version,
    layer: "character-profile",
    moduleFormat: "classic-script-iife",
    scriptType: "classic",
    behavior: "pure-helper",
    touchesDom: false,
    touchesState: false,
    status: "CANDIDATE"
  });

  function hasOwn(source, key) {
    return Object.prototype.hasOwnProperty.call(source || {}, key);
  }

  function normalizeCharacterText(value, maxLength) {
    var limit = Number.isFinite(Number(maxLength)) ? Number(maxLength) : 160;
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
  }

  function normalizeCharacterLongText(value, maxLength) {
    var limit = Number.isFinite(Number(maxLength)) ? Number(maxLength) : 1200;
    return normalizeCharacterText(value, limit);
  }

  function normalizeLookupKey(value) {
    return normalizeCharacterText(value, 240).replace(/\s+/g, "").toLocaleLowerCase();
  }

  function normalizeLooseLookupKey(value) {
    return normalizeLookupKey(value).replace(/[（）()\[\]【】「」『』·・\/\\|:：,，.。;；_-]/g, "");
  }

  function splitCharacterList(value, options) {
    var limit = Number.isFinite(Number(options && options.limit)) ? Number(options.limit) : 12;
    var source = Array.isArray(value) ? value : String(value || "").split(/[\n,，、;；]+/g);
    var seen = Object.create(null);
    return source
      .map(function normalizeItem(item) {
        if (item && typeof item === "object") {
          return normalizeCharacterText(item.displayName || item.name || item.text || item.id || "");
        }
        return normalizeCharacterText(item);
      })
      .filter(function keepUnique(item) {
        var key = normalizeLookupKey(item);
        if (!key || seen[key]) return false;
        seen[key] = true;
        return true;
      })
      .slice(0, limit);
  }

  function mergeCharacterList(primary, fallback, options) {
    return splitCharacterList([].concat(primary || [], fallback || []), options);
  }

  function normalizeCharacterRank(value, fallback) {
    var rank = normalizeCharacterText(value, 8).toUpperCase();
    return ranks.indexOf(rank) >= 0 ? rank : (fallback || "B");
  }

  function normalizeCharacterGrade(value, fallback) {
    var raw = normalizeCharacterText(value, 60);
    if (gradeKeys.indexOf(raw) >= 0) return raw;
    if (raw.indexOf("特别一级") >= 0 || raw.indexOf("超一级") >= 0) return "semiSpecialGrade1";
    if (raw.indexOf("特级") >= 0) return "specialGrade";
    if (raw.indexOf("一级") >= 0) return "grade1";
    if (raw.indexOf("二级") >= 0) return "grade2";
    if (raw.indexOf("三级") >= 0) return "grade3";
    if (raw.indexOf("四级") >= 0) return "grade4";
    if (raw.indexOf("辅助") >= 0) return "support";
    return fallback || "grade2";
  }

  function labelCharacterGrade(value) {
    return gradeLabels[normalizeCharacterGrade(value, "support")] || "未定";
  }

  function normalizeCharacterStage(value, fallback) {
    var stage = normalizeCharacterText(value, 40);
    return stageKeys.indexOf(stage) >= 0 ? stage : (fallback || "custom");
  }

  function normalizeCharacterBaseStats(stats, fallbackStats) {
    var source = stats && typeof stats === "object" ? stats : {};
    var fallback = fallbackStats && typeof fallbackStats === "object" ? fallbackStats : defaultStats;
    return {
      cursedEnergy: normalizeCharacterRank(source.cursedEnergy, fallback.cursedEnergy || "B"),
      control: normalizeCharacterRank(source.control, fallback.control || "B"),
      efficiency: normalizeCharacterRank(source.efficiency, fallback.efficiency || "B"),
      body: normalizeCharacterRank(source.body, fallback.body || "B"),
      martial: normalizeCharacterRank(source.martial, fallback.martial || "B"),
      talent: normalizeCharacterRank(source.talent, fallback.talent || "B")
    };
  }

  function normalizeOptionalNumber(value, min, max) {
    var text = String(value == null ? "" : value).trim();
    if (!text) return null;
    var number = Number(text);
    if (!Number.isFinite(number)) return null;
    var lower = Number.isFinite(Number(min)) ? Number(min) : -Infinity;
    var upper = Number.isFinite(Number(max)) ? Number(max) : Infinity;
    return Number(Math.min(upper, Math.max(lower, number)).toFixed(4));
  }

  function normalizeSelectedLibrary(value) {
    var source = value && typeof value === "object" ? value : {};
    return {
      techniques: splitCharacterList(source.techniques || []),
      domains: splitCharacterList(source.domains || []),
      advanced: splitCharacterList(source.advanced || []),
      resources: splitCharacterList(source.resources || [])
    };
  }

  function firstPresent(primary, fallback) {
    return primary == null || primary === "" ? fallback : primary;
  }

  function normalizeCharacterId(value, fallback) {
    var id = normalizeCharacterText(value, 96);
    if (id) return id;
    var base = normalizeLooseLookupKey(fallback || "character");
    return base || "character";
  }

  function normalizeCharacterProfile(raw, options) {
    var source = raw && typeof raw === "object" ? raw : {};
    var selectedLibrary = normalizeSelectedLibrary(source.selectedLibrary || source.librarySelection);
    var techniqueName = normalizeCharacterText(source.techniqueName || source.technique || "");
    var mechanismTags = splitCharacterList(source.selectedMechanisms || source.mechanismTags || []);
    var toolTags = splitCharacterList(source.selectedToolTags || source.toolTags || []);
    var traits = splitCharacterList(source.innateTraits || source.traits || []);
    var loadout = splitCharacterList(source.loadout || source.tools || []);
    var visibleGrade = normalizeCharacterGrade(source.visibleGrade, options && options.defaultGrade || "grade2");
    var displayName = normalizeCharacterText(source.displayName || source.name || source.characterName || "未命名角色");
    return {
      characterId: normalizeCharacterId(source.characterId || source.id, displayName),
      displayName: displayName,
      customDuel: Boolean(source.customDuel),
      stage: normalizeCharacterStage(source.stage, options && options.defaultStage || "custom"),
      baseStats: normalizeCharacterBaseStats(source.baseStats || source.stats),
      innateTraits: mergeCharacterList([techniqueName], mergeCharacterList(traits, mechanismTags)),
      advancedTechniques: splitCharacterList(source.advancedTechniques || source.advanced || []),
      loadout: mergeCharacterList(loadout, toolTags),
      selectedMechanisms: mechanismTags,
      selectedToolTags: toolTags,
      selectedLibrary: selectedLibrary,
      externalResource: normalizeCharacterText(source.externalResource || source.resource || ""),
      techniqueName: techniqueName,
      techniqueDescription: normalizeCharacterLongText(source.techniqueDescription || ""),
      techniquePower: normalizeCharacterRank(source.techniquePower, "B"),
      domainProfile: normalizeCharacterText(source.domainProfile || source.domain || ""),
      visibleGrade: visibleGrade,
      officialGrade: normalizeCharacterText(source.officialGrade || labelCharacterGrade(visibleGrade)),
      powerTier: normalizeCharacterText(source.powerTier || source.tier || ""),
      trialSubjectType: normalizeCharacterText(source.trialSubjectType || ""),
      trialEligibility: normalizeCharacterText(source.trialEligibility || ""),
      verdictVocabulary: normalizeCharacterText(source.verdictVocabulary || ""),
      hasLegalAgency: source.hasLegalAgency,
      hasSelfAwareness: source.hasSelfAwareness,
      canDefend: source.canDefend,
      canRemainSilent: source.canRemainSilent,
      debugManualCombatScore: normalizeOptionalNumber(firstPresent(source.debugManualCombatScore, source.manualCombatScore), 0, 12),
      debugManualCombatUnit: normalizeOptionalNumber(firstPresent(source.debugManualCombatUnit, source.manualCombatUnit), 1, 99999999),
      encodedCombatProfile: source.encodedCombatProfile && typeof source.encodedCombatProfile === "object" ? source.encodedCombatProfile : null,
      notes: normalizeCharacterLongText(source.notes || "")
    };
  }

  function getCharacterCards(source, options) {
    var customCards = Array.isArray(options && options.customCards) ? options.customCards : [];
    var cards = Array.isArray(source) ? source : Array.isArray(source && source.cards) ? source.cards : [];
    var combined = options && options.includeCustom === false ? cards.slice() : customCards.concat(cards);
    return options && options.normalize ? combined.map(function normalize(card) {
      return normalizeCharacterProfile(card, options);
    }) : combined.slice();
  }

  function sortCharacterCardsByName(cards) {
    return (cards || []).slice().sort(function compareName(left, right) {
      return String(left && left.displayName || "").localeCompare(String(right && right.displayName || ""), "zh-Hans-CN");
    });
  }

  function characterNameCandidates(card) {
    return [
      card && card.characterId,
      card && card.id,
      card && card.displayName,
      card && card.name,
      card && card.characterName
    ].filter(Boolean);
  }

  function lookupCharacterById(source, id, options) {
    var key = normalizeLookupKey(id);
    if (!key) return null;
    return getCharacterCards(source, options).find(function matchesId(card) {
      return normalizeLookupKey(card && (card.characterId || card.id)) === key;
    }) || null;
  }

  function lookupCharacterByName(source, name, options) {
    var key = normalizeLookupKey(name);
    var looseKey = normalizeLooseLookupKey(name);
    if (!key && !looseKey) return null;
    return getCharacterCards(source, options).find(function matchesName(card) {
      var candidates = characterNameCandidates(card);
      return candidates.some(function exact(candidate) {
        return normalizeLookupKey(candidate) === key;
      }) || candidates.some(function loose(candidate) {
        return looseKey && normalizeLooseLookupKey(candidate) === looseKey;
      });
    }) || null;
  }

  function lookupCharacter(source, query, options) {
    if (query && typeof query === "object") {
      return lookupCharacterById(source, query.id || query.characterId, options) ||
        lookupCharacterByName(source, query.name || query.displayName || query.characterName, options);
    }
    return lookupCharacterById(source, query, options) || lookupCharacterByName(source, query, options);
  }

  function getMechanismCards(source, options) {
    var data = source && typeof source === "object" ? source : {};
    var type = options && options.type ? String(options.type) : "all";
    var mechanisms = Array.isArray(data) ? data : Array.isArray(data.mechanisms) ? data.mechanisms : [];
    var tools = Array.isArray(data.cursedTools) ? data.cursedTools : [];
    if (type === "mechanism" || type === "mechanisms") return mechanisms.slice();
    if (type === "tool" || type === "cursedTool" || type === "cursedTools") return tools.slice();
    return mechanisms.concat(tools);
  }

  function mechanismNameCandidates(item) {
    return [
      item && item.id,
      item && item.displayName,
      item && item.name,
      item && item.text
    ].concat(item && Array.isArray(item.match) ? item.match : []).filter(Boolean);
  }

  function lookupMechanismById(source, id, options) {
    var key = normalizeLookupKey(id);
    if (!key) return null;
    return getMechanismCards(source, options).find(function matchesId(item) {
      return normalizeLookupKey(item && item.id) === key;
    }) || null;
  }

  function lookupMechanismByName(source, name, options) {
    var key = normalizeLookupKey(name);
    var looseKey = normalizeLooseLookupKey(name);
    if (!key && !looseKey) return null;
    return getMechanismCards(source, options).find(function matchesName(item) {
      var candidates = mechanismNameCandidates(item);
      return candidates.some(function exact(candidate) {
        return normalizeLookupKey(candidate) === key;
      }) || candidates.some(function loose(candidate) {
        return looseKey && normalizeLooseLookupKey(candidate) === looseKey;
      });
    }) || null;
  }

  function lookupMechanism(source, query, options) {
    if (query && typeof query === "object") {
      return lookupMechanismById(source, query.id, options) ||
        lookupMechanismByName(source, query.name || query.displayName || query.text, options);
    }
    return lookupMechanismById(source, query, options) || lookupMechanismByName(source, query, options);
  }

  function matchMechanismsForText(source, text, options) {
    var content = String(text || "");
    if (!content) return [];
    return getMechanismCards(source, options).filter(function hasKeyword(item) {
      return (item.match || []).some(function matchesKeyword(keyword) {
        return keyword && content.indexOf(String(keyword)) >= 0;
      });
    });
  }

  function matchMechanismsForProfile(source, profile, options) {
    var card = profile && typeof profile === "object" ? profile : {};
    var text = [
      card.displayName,
      card.name,
      card.techniqueName,
      card.techniqueDescription,
      card.domainProfile,
      card.externalResource,
      card.notes
    ].concat(card.innateTraits || [], card.advancedTechniques || [], card.loadout || []).filter(Boolean).join(" ");
    return matchMechanismsForText(source, text, options);
  }

  function getCharacterProfileMetadata() {
    return metadata;
  }

  var api = {
    getCharacterProfileMetadata: getCharacterProfileMetadata,
    normalizeCharacterText: normalizeCharacterText,
    normalizeCharacterLongText: normalizeCharacterLongText,
    splitCharacterList: splitCharacterList,
    mergeCharacterList: mergeCharacterList,
    normalizeCharacterRank: normalizeCharacterRank,
    normalizeCharacterGrade: normalizeCharacterGrade,
    labelCharacterGrade: labelCharacterGrade,
    normalizeCharacterStage: normalizeCharacterStage,
    normalizeCharacterBaseStats: normalizeCharacterBaseStats,
    normalizeSelectedLibrary: normalizeSelectedLibrary,
    normalizeCharacterProfile: normalizeCharacterProfile,
    getCharacterCards: getCharacterCards,
    sortCharacterCardsByName: sortCharacterCardsByName,
    lookupCharacterById: lookupCharacterById,
    lookupCharacterByName: lookupCharacterByName,
    lookupCharacter: lookupCharacter,
    getMechanismCards: getMechanismCards,
    lookupMechanismById: lookupMechanismById,
    lookupMechanismByName: lookupMechanismByName,
    lookupMechanism: lookupMechanism,
    matchMechanismsForText: matchMechanismsForText,
    matchMechanismsForProfile: matchMechanismsForProfile
  };

  function registerCharacterHelpers(exportsMap) {
    var root = global[namespace] || (global[namespace] = {});
    if (typeof root.registerHelperModule === "function") {
      root.registerHelperModule(moduleId, exportsMap, metadata);
      return;
    }
    root.__pendingHelperModules = root.__pendingHelperModules || [];
    root.__pendingHelperModules.push({ id: moduleId, exports: exportsMap, metadata: metadata });
  }

  registerCharacterHelpers(api);
})(globalThis);
