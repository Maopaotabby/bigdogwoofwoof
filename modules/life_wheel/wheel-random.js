(function attachJJKLifeWheelRandom(global) {
  "use strict";

  var namespace = "JJKLifeWheelRandom";
  var version = "0.1.0-random-weight-repeat-candidate";
  var expectedExports = Object.freeze([
    "parseWeight",
    "readOptionWeight",
    "normalizeWeightedOptions",
    "buildWeightedOptions",
    "buildCandidatePool",
    "weightedPick",
    "drawOnce",
    "drawMultipleNoRepeat"
  ]);

  var metadata = Object.freeze({
    namespace: namespace,
    version: version,
    layer: "life-wheel-random",
    moduleFormat: "classic-script-iife",
    scriptType: "classic",
    behavior: "random-weight-repeat-helper-candidate",
    ownsBehavior: false,
    ownsWheelFlow: false,
    ownsWheelProbability: false,
    mutatesState: false,
    status: "CANDIDATE"
  });

  function toArray(value) {
    return Array.isArray(value) ? value.slice() : [];
  }

  function toSet(value) {
    if (value instanceof Set) return new Set(value);
    if (Object.prototype.toString.call(value) === "[object Set]" && typeof value.forEach === "function") {
      var copy = new Set();
      value.forEach(function addSetItem(item) {
        copy.add(item);
      });
      return copy;
    }
    if (Array.isArray(value)) return new Set(value);
    return new Set();
  }

  function parseWeight(value) {
    var parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  function readOptionWeight(option, fallback) {
    if (option && Object.prototype.hasOwnProperty.call(option, "weight")) {
      return parseWeight(option.weight);
    }
    return parseWeight(fallback);
  }

  function normalizeWeightedOptions(options, settings) {
    var source = toArray(options);
    var weightKey = settings?.weightKey || "weight";
    var totalWeight = source.reduce(function sumWeights(sum, option) {
      return sum + Number(option?.[weightKey] || 0);
    }, 0);

    return {
      totalWeight: totalWeight,
      options: source.map(function mapOption(option) {
        var weight = Number(option?.[weightKey] || 0);
        var normalizedWeight = totalWeight > 0 ? weight / totalWeight : 0;
        return Object.assign({}, option, {
          normalizedWeight: normalizedWeight
        });
      })
    };
  }

  function buildWeightedOptions(wheel, task, settings) {
    var config = settings || {};
    var context = config.context || {};
    var normalizeOptionText = typeof config.normalizeOptionText === "function"
      ? config.normalizeOptionText
      : function fallbackNormalize(_task, text) { return text; };
    var getAdjustedWeight = typeof config.getAdjustedWeight === "function"
      ? config.getAdjustedWeight
      : function fallbackAdjust(_task, _item, _index, baseWeight) { return baseWeight; };
    var applyAiFreeWeightAdjustments = typeof config.applyAiFreeWeightAdjustments === "function"
      ? config.applyAiFreeWeightAdjustments
      : function fallbackAiFree(_task, _text, adjustedWeight) { return adjustedWeight; };

    return toArray(wheel?.items).map(function mapWeightedItem(item, index) {
      var baseWeight = parseWeight(item?.weight);
      var displayText = normalizeOptionText(task, item?.text, item, index, context);
      var adjustedWeight = applyAiFreeWeightAdjustments(
        task,
        displayText,
        getAdjustedWeight(task, item, index, baseWeight, context),
        baseWeight,
        context
      );

      return Object.assign({}, item, {
        rawText: item?.text,
        text: displayText,
        index: index,
        baseWeight: baseWeight,
        weight: adjustedWeight,
        adjusted: Math.abs(Number(adjustedWeight || 0) - baseWeight) > 0.001
      });
    });
  }

  function buildCandidatePool(options, settings) {
    var excludedTexts = toSet(settings?.excludedTexts);
    var weightKey = settings?.weightKey || "weight";
    var textKey = settings?.textKey || "text";

    return toArray(options).filter(function isCandidate(option) {
      var text = option?.[textKey];
      return Number(option?.[weightKey] || 0) > 0 && !excludedTexts.has(text);
    });
  }

  function weightedPick(options, settings) {
    var source = toArray(options);
    var weightKey = settings?.weightKey || "weight";
    var rng = typeof settings?.rng === "function" ? settings.rng : Math.random;
    var total = source.reduce(function sumWeights(sum, option) {
      return sum + Number(option?.[weightKey] || 0);
    }, 0);
    var cursor;
    var i;

    if (source.length === 0 || total <= 0) return null;

    cursor = rng() * total;
    for (i = 0; i < source.length; i += 1) {
      cursor -= Number(source[i]?.[weightKey] || 0);
      if (cursor <= 0) return source[i];
    }
    return source[source.length - 1];
  }

  function drawOnce(options, settings) {
    var candidates = buildCandidatePool(options, settings);
    return weightedPick(candidates, settings);
  }

  function drawMultipleNoRepeat(getOptions, count, settings) {
    var selected = [];
    var excludedTexts = toSet(settings?.excludedTexts);
    var preventRepeat = Boolean(settings?.preventRepeat);
    var textKey = settings?.textKey || "text";
    var pickOne = typeof settings?.pickOne === "function" ? settings.pickOne : null;
    var maxCount = Math.max(0, Number(count) || 0);
    var i;
    var source;
    var result;

    for (i = 0; i < maxCount; i += 1) {
      source = typeof getOptions === "function"
        ? getOptions({
          selected: selected.slice(),
          excludedTexts: new Set(excludedTexts)
        })
        : getOptions;

      result = pickOne
        ? pickOne(source, Object.assign({}, settings, {
          excludedTexts: preventRepeat ? excludedTexts : settings?.excludedTexts
        }), {
          selected: selected.slice(),
          excludedTexts: new Set(excludedTexts),
          preventRepeat: preventRepeat
        })
        : drawOnce(source, Object.assign({}, settings, {
          excludedTexts: preventRepeat ? excludedTexts : settings?.excludedTexts
        }));
      if (!result) break;
      selected.push(result);
      if (preventRepeat) excludedTexts.add(result?.[textKey]);
    }

    return selected;
  }

  function getMetadata() {
    return metadata;
  }

  function getExpectedExports() {
    return expectedExports.slice();
  }

  var api = {
    namespace: namespace,
    version: version,
    metadata: metadata,
    expectedExports: expectedExports,
    getMetadata: getMetadata,
    getExpectedExports: getExpectedExports,
    parseWeight: parseWeight,
    readOptionWeight: readOptionWeight,
    normalizeWeightedOptions: normalizeWeightedOptions,
    buildWeightedOptions: buildWeightedOptions,
    buildCandidatePool: buildCandidatePool,
    weightedPick: weightedPick,
    drawOnce: drawOnce,
    drawMultipleNoRepeat: drawMultipleNoRepeat
  };

  global[namespace] = api;
  if (global.JJKLifeWheel && typeof global.JJKLifeWheel.registerHelper === "function") {
    global.JJKLifeWheel.registerHelper("random", api);
  }
})(globalThis);
