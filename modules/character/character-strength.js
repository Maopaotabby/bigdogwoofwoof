(function attachJJKCharacterStrength(global) {
  "use strict";

  var namespace = "JJKCharacter";
  var moduleId = "character-strength";
  var version = "0.1.0-helper-candidate";
  var rankScale = Object.freeze({
    "E-": 0,
    E: 1,
    D: 2,
    C: 3,
    B: 4,
    A: 5,
    S: 6.2,
    SS: 7.4,
    SSS: 8.8,
    "EX-": 10.2,
    EX: 12
  });
  var visibleGradeLabels = Object.freeze({
    support: "辅助人员",
    grade4: "四级",
    grade3: "三级",
    grade2: "二级",
    grade1: "一级",
    semiSpecialGrade1: "超一级（特别一级行政等效）",
    specialGrade: "特级"
  });
  var visibleGradeOrder = Object.freeze({
    support: 0,
    grade4: 1,
    grade3: 2,
    grade2: 3,
    grade1: 4,
    semiSpecialGrade1: 5,
    specialGrade: 6
  });
  var visibleGradeWinRateOrder = Object.freeze({
    support: 0,
    grade4: 1,
    grade3: 2,
    grade2: 3,
    grade1: 4,
    semiSpecialGrade1: 4.5,
    specialGrade: 6
  });
  var defaultGradeRanges = Object.freeze([
    Object.freeze({ grade: "support", min: 0, max: 1.3 }),
    Object.freeze({ grade: "grade4", min: 1.3, max: 2.2 }),
    Object.freeze({ grade: "grade3", min: 2.2, max: 3.2 }),
    Object.freeze({ grade: "grade2", min: 3.2, max: 4.6 }),
    Object.freeze({ grade: "grade1", min: 4.6, max: 6.8 }),
    Object.freeze({ grade: "semiSpecialGrade1", min: 6.8, max: 8.6 }),
    Object.freeze({ grade: "specialGrade", min: 8.6, max: null })
  ]);
  var metadata = Object.freeze({
    namespace: namespace,
    moduleId: moduleId,
    version: version,
    layer: "character-strength",
    moduleFormat: "classic-script-iife",
    scriptType: "classic",
    behavior: "pure-helper",
    formulaPolicy: "mirrors current app.js display utilities; does not run combat evaluation",
    touchesDom: false,
    touchesState: false,
    status: "CANDIDATE"
  });

  function cloneObject(source) {
    var result = {};
    Object.keys(source || {}).forEach(function copy(key) {
      result[key] = source[key];
    });
    return result;
  }

  function clampCharacterScore(value, min, max) {
    var number = Number(value);
    var lower = Number.isFinite(Number(min)) ? Number(min) : 0;
    var upper = Number.isFinite(Number(max)) ? Number(max) : 12;
    if (!Number.isFinite(number)) number = lower;
    return Math.min(upper, Math.max(lower, number));
  }

  function parseCharacterRank(text) {
    var match = String(text || "").trim().match(/^(EX-|EX|SSS|SS|S|A|B|C|D|E-|E)/);
    return match ? match[1] : "";
  }

  function normalizeCharacterRank(value, fallback) {
    var rank = parseCharacterRank(String(value || "").toUpperCase());
    return rank || fallback || "";
  }

  function getCharacterRankScale(options) {
    var source = options && options.rankScale && typeof options.rankScale === "object" ? options.rankScale : rankScale;
    return cloneObject(source);
  }

  function characterRankValue(rank, options) {
    var curve = options && options.rankScale && typeof options.rankScale === "object" ? options.rankScale : rankScale;
    var key = normalizeCharacterRank(rank, "");
    return Number(curve[key] == null ? -1 : curve[key]);
  }

  function normalizeVisibleGradeKey(value, fallback) {
    var raw = String(value || "").trim();
    if (Object.prototype.hasOwnProperty.call(visibleGradeLabels, raw)) return raw;
    if (raw.indexOf("辅助人员") >= 0 || raw.indexOf("辅助") >= 0) return "support";
    if (raw.indexOf("特别一级") >= 0 || raw.indexOf("超一级") >= 0) return "semiSpecialGrade1";
    if (raw.indexOf("特级") >= 0) return "specialGrade";
    if (raw.indexOf("一级") >= 0) return "grade1";
    if (raw.indexOf("二级") >= 0) return "grade2";
    if (raw.indexOf("三级") >= 0) return "grade3";
    if (raw.indexOf("四级") >= 0) return "grade4";
    return arguments.length > 1 ? fallback : "support";
  }

  function mapVisibleGradeText(text, fallback) {
    return normalizeVisibleGradeKey(text, fallback);
  }

  function labelVisibleGrade(gradeKey) {
    return visibleGradeLabels[normalizeVisibleGradeKey(gradeKey, "support")] || "未定";
  }

  function visibleGradeRank(gradeKey) {
    var key = normalizeVisibleGradeKey(gradeKey, "");
    return visibleGradeOrder[key] == null ? NaN : visibleGradeOrder[key];
  }

  function visibleGradeCategoryRank(gradeKey) {
    var key = normalizeVisibleGradeKey(gradeKey, "");
    return visibleGradeWinRateOrder[key] == null ? NaN : visibleGradeWinRateOrder[key];
  }

  function compareVisibleGrades(left, right) {
    var leftRank = visibleGradeRank(left);
    var rightRank = visibleGradeRank(right);
    if (!Number.isFinite(leftRank) || !Number.isFinite(rightRank)) return NaN;
    return leftRank - rightRank;
  }

  function isVisibleGradeBelow(gradeKey, floorGrade) {
    var gradeRank = visibleGradeRank(gradeKey);
    var floorRank = visibleGradeRank(floorGrade);
    return (Number.isFinite(gradeRank) ? gradeRank : 0) < (Number.isFinite(floorRank) ? floorRank : 0);
  }

  function getDeterministicGradeRanges(options) {
    var configured = options && options.ranges;
    var source = Array.isArray(configured) && configured.length ? configured : defaultGradeRanges;
    return source.map(function normalizeRange(item) {
      return {
        grade: normalizeVisibleGradeKey(item && item.grade, "support"),
        min: Number(item && item.min) || 0,
        max: Number.isFinite(Number(item && item.max)) ? Number(item.max) : null
      };
    });
  }

  function getVisibleGradeFromScore(score, floorKey, options) {
    var numericScore = Number(score);
    if (!Number.isFinite(numericScore)) numericScore = 0;
    var ranges = getDeterministicGradeRanges(options);
    var range = ranges.find(function inRange(item) {
      return numericScore >= item.min && (item.max == null || numericScore < item.max);
    }) || ranges[ranges.length - 1];
    var baseKey = range && range.grade || "support";
    var floor = normalizeVisibleGradeKey(floorKey, "support");
    return isVisibleGradeBelow(baseKey, floor) ? floor : baseKey;
  }

  function resolveVisibleGrade(item, options) {
    if (item && typeof item === "object") {
      var explicitGrade = normalizeVisibleGradeKey(item.visibleGrade, "");
      var officialGrade = normalizeVisibleGradeKey(item.officialGrade, "");
      if (explicitGrade) return explicitGrade;
      if (officialGrade) return officialGrade;
      var score = item.score == null ? item.gradeEffectiveScore : item.score;
      if (Number.isFinite(Number(score))) {
        return getVisibleGradeFromScore(Number(score), item.gradeFloor, options);
      }
      var tier = String(item.powerTier || item.tier || "");
      if (["canonCeiling", "postCanonException", "postCanonCeiling", "specialGrade"].indexOf(tier) >= 0) return "specialGrade";
      if (["topTierPhysical", "topTier", "topTierSustain", "topTierMinus", "newGenerationTop", "haxException"].indexOf(tier) >= 0) return "grade1";
      if (tier === "supportHax") return "grade2";
    }
    return normalizeVisibleGradeKey(item, "support");
  }

  function formatCombatPowerUnit(value) {
    var number = Number(value) || 0;
    if (number >= 10000) return String((number / 10000).toFixed(2)).replace(/\.?0+$/, "") + "万";
    return number.toLocaleString("zh-CN");
  }

  function getCombatPowerUnitBand(value) {
    var unit = Number(value) || 0;
    if (unit < 420) return "weak";
    if (unit < 850) return "normal-";
    if (unit < 2100) return "normal";
    if (unit < 5200) return "strong";
    return "special";
  }

  function buildCombatPowerUnit(score) {
    var normalized = clampCharacterScore(score, 0, 12);
    var value = Math.round(100 * Math.pow(2, normalized / 1.55));
    return {
      value: value,
      label: formatCombatPowerUnit(value),
      scoreBasis: Number(normalized.toFixed(4)),
      band: getCombatPowerUnitBand(value),
      formula: "round(100 * 2^(instantPowerScore / 1.55))"
    };
  }

  function buildCharacterDisruptionUnit(score) {
    var normalized = clampCharacterScore(score, 0, 12);
    var value = Math.round(100 * Math.pow(2, normalized / 1.85));
    return {
      score: Number(normalized.toFixed(4)),
      value: value,
      label: formatCombatPowerUnit(value),
      band: getCombatPowerUnitBand(value)
    };
  }

  function normalizeDuelRankForImport(rank, validRanks) {
    var ranks = Array.isArray(validRanks) && validRanks.length
      ? validRanks
      : ["E-", "E", "D", "C", "B", "A", "S", "SS", "SSS", "EX-", "EX"];
    return ranks.indexOf(rank) !== -1 ? rank : "B";
  }

  function getCharacterStrengthMetadata() {
    return metadata;
  }

  var api = {
    getCharacterStrengthMetadata: getCharacterStrengthMetadata,
    clampCharacterScore: clampCharacterScore,
    parseCharacterRank: parseCharacterRank,
    normalizeCharacterRankForStrength: normalizeCharacterRank,
    characterRankValue: characterRankValue,
    getCharacterRankScale: getCharacterRankScale,
    normalizeVisibleGradeKey: normalizeVisibleGradeKey,
    mapVisibleGradeText: mapVisibleGradeText,
    labelVisibleGrade: labelVisibleGrade,
    visibleGradeRank: visibleGradeRank,
    visibleGradeCategoryRank: visibleGradeCategoryRank,
    compareVisibleGrades: compareVisibleGrades,
    isVisibleGradeBelow: isVisibleGradeBelow,
    getDeterministicGradeRanges: getDeterministicGradeRanges,
    getVisibleGradeFromScore: getVisibleGradeFromScore,
    resolveVisibleGrade: resolveVisibleGrade,
    formatCombatPowerUnit: formatCombatPowerUnit,
    getCombatPowerUnitBand: getCombatPowerUnitBand,
    buildCombatPowerUnit: buildCombatPowerUnit,
    buildCharacterDisruptionUnit: buildCharacterDisruptionUnit,
    normalizeDuelRankForImport: normalizeDuelRankForImport
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
