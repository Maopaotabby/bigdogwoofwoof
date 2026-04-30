(function attachJJKLifeWheelData(global) {
  "use strict";

  var namespace = "JJKLifeWheelData";
  var version = "0.1.0-lookup-snapshot-candidate";
  var expectedExports = Object.freeze([
    "normalizeWheelId",
    "formatWheelCode",
    "toWheelArray",
    "buildWheelMap",
    "getWheel",
    "hasWheel",
    "getTaskWheel",
    "getWheelMetadata",
    "buildOptionLookup",
    "getWheelOptionByIndex",
    "getWheelOptionByText",
    "listWheelOptions",
    "summarizeWheel",
    "summarizeWheelCollection",
    "collectConfiguredWheelIds",
    "buildWheelLookupSnapshot",
    "buildWheelCatalogSnapshot",
    "validateWheelData"
  ]);

  var metadata = Object.freeze({
    namespace: namespace,
    version: version,
    layer: "life-wheel-data",
    moduleFormat: "classic-script-iife",
    scriptType: "classic",
    behavior: "lookup-snapshot-metadata-only",
    ownsBehavior: false,
    ownsWheelFlow: false,
    ownsWheelProbability: false,
    mutatesState: false,
    status: "CANDIDATE"
  });

  var specialConfiguredWheelIds = Object.freeze([
    85, 86, 87, 88, 89, 90, 92,
    105, 117, 118, 119, 120, 121, 122, 123, 124
  ]);

  function hasOwn(source, key) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }

  function isMap(value) {
    return Object.prototype.toString.call(value) === "[object Map]";
  }

  function normalizeWheelId(value) {
    var raw = String(value == null ? "" : value).trim();
    var numeric;

    if (!raw) return "";
    numeric = raw.match(/\d+/);
    return numeric ? String(Number(numeric[0])) : raw;
  }

  function formatWheelCode(value) {
    var id = normalizeWheelId(value);
    var number = Number(id);

    if (!id) return "";
    if (!Number.isFinite(number)) return id;
    return "W" + String(number).padStart(3, "0");
  }

  function toWheelArray(source) {
    if (Array.isArray(source)) return source.slice();
    if (Array.isArray(source?.wheels)) return source.wheels.slice();
    if (Array.isArray(source?.wheelData?.wheels)) return source.wheelData.wheels.slice();
    return [];
  }

  function buildWheelMap(source) {
    var map = new Map();

    toWheelArray(source).forEach(function addWheel(wheel) {
      var id = normalizeWheelId(wheel?.dbId);
      if (!id) return;
      map.set(id, wheel);
      map.set(String(wheel.dbId), wheel);
      map.set(formatWheelCode(id), wheel);
    });

    return map;
  }

  function getMapFromSource(source) {
    if (isMap(source)) return source;
    if (isMap(source?.wheelMap)) return source.wheelMap;
    return buildWheelMap(source);
  }

  function getWheel(source, wheelId) {
    var id = normalizeWheelId(wheelId);
    var map;

    if (!id) return null;
    map = getMapFromSource(source);
    return map.get(id) || map.get(String(wheelId)) || map.get(formatWheelCode(id)) || null;
  }

  function hasWheel(source, wheelId) {
    return Boolean(getWheel(source, wheelId));
  }

  function getTaskWheel(source, task) {
    if (Array.isArray(task?.options) && task.options.length) {
      return {
        dbId: task.nodeId || "virtual",
        title: task.title || "虚拟转盘",
        items: task.options
      };
    }
    return getWheel(source, task?.wheelId);
  }

  function getWheelMetadata(wheel) {
    var summary = summarizeWheel(wheel);

    return {
      id: summary.id,
      code: summary.code,
      dbId: wheel?.dbId ?? null,
      title: summary.title,
      itemCount: summary.itemCount,
      hasItems: summary.hasItems
    };
  }

  function buildOptionLookup(wheel) {
    var byIndex = new Map();
    var byText = new Map();

    (wheel?.items || []).forEach(function indexOption(item, index) {
      var text = String(item?.text || "");
      var option = {
        index: index,
        text: text,
        item: item || null,
        rawWeight: hasOwn(item || {}, "weight") ? item.weight : null,
        hasWeight: hasOwn(item || {}, "weight")
      };

      byIndex.set(index, option);
      if (!byText.has(text)) byText.set(text, []);
      byText.get(text).push(option);
    });

    return {
      wheel: getWheelMetadata(wheel),
      byIndex: byIndex,
      byText: byText,
      optionCount: byIndex.size
    };
  }

  function getWheelOptionByIndex(wheelOrSource, wheelIdOrIndex, maybeIndex) {
    var wheel = typeof maybeIndex === "undefined"
      ? wheelOrSource
      : getWheel(wheelOrSource, wheelIdOrIndex);
    var index = typeof maybeIndex === "undefined" ? wheelIdOrIndex : maybeIndex;

    return buildOptionLookup(wheel).byIndex.get(Number(index)) || null;
  }

  function getWheelOptionByText(wheelOrSource, wheelIdOrText, maybeText) {
    var wheel = typeof maybeText === "undefined"
      ? wheelOrSource
      : getWheel(wheelOrSource, wheelIdOrText);
    var text = String(typeof maybeText === "undefined" ? wheelIdOrText : maybeText);
    var matches = buildOptionLookup(wheel).byText.get(text) || [];

    return matches.slice();
  }

  function listWheelOptions(wheelOrSource, wheelId) {
    var wheel = typeof wheelId === "undefined"
      ? wheelOrSource
      : getWheel(wheelOrSource, wheelId);

    return (wheel?.items || []).map(function mapOption(item, index) {
      return {
        index: index,
        text: item?.text || "",
        rawWeight: hasOwn(item || {}, "weight") ? item.weight : null,
        hasWeight: hasOwn(item || {}, "weight")
      };
    });
  }

  function summarizeWheel(wheel) {
    var id = normalizeWheelId(wheel?.dbId);

    return {
      id: id,
      code: formatWheelCode(id),
      title: wheel?.title || "",
      itemCount: Array.isArray(wheel?.items) ? wheel.items.length : 0,
      hasItems: Array.isArray(wheel?.items) && wheel.items.length > 0
    };
  }

  function summarizeWheelCollection(source) {
    var wheels = toWheelArray(source);
    var ids = new Set();
    var duplicateIds = [];

    wheels.forEach(function collectId(wheel) {
      var id = normalizeWheelId(wheel?.dbId);
      if (!id) return;
      if (ids.has(id)) duplicateIds.push(id);
      ids.add(id);
    });

    return {
      wheelCount: wheels.length,
      uniqueWheelCount: ids.size,
      duplicateIds: duplicateIds,
      emptyWheelCount: wheels.filter(function isEmpty(wheel) {
        return !Array.isArray(wheel?.items) || wheel.items.length === 0;
      }).length
    };
  }

  function addWheelId(ids, value) {
    var id = normalizeWheelId(value);
    if (id) ids.add(id);
  }

  function collectConfiguredWheelIds(flow, options) {
    var includeSpecial = !options || options.includeSpecial !== false;
    var ids = new Set();

    Object.values(flow?.nodes || {}).forEach(function scanNode(node) {
      addWheelId(ids, node?.wheelId);
      addWheelId(ids, node?.contentWheelId);
      (node?.wheelSelection || []).forEach(function scanCandidate(candidate) {
        addWheelId(ids, candidate?.wheelId);
      });
      (node?.wheels || []).forEach(function scanWheelId(wheelId) {
        addWheelId(ids, wheelId);
      });
    });

    Object.values(flow?.timeline?.periods || {}).forEach(function scanPeriod(periodItems) {
      (periodItems || []).forEach(function scanTimelineItem(item) {
        addWheelId(ids, item?.wheelId);
        addWheelId(ids, item?.contentWheelId);
      });
    });

    (flow?.deferredTriggerWheels || []).forEach(function scanDeferred(item) {
      addWheelId(ids, item?.wheelId);
    });

    if (includeSpecial) {
      specialConfiguredWheelIds.forEach(function addSpecial(wheelId) {
        addWheelId(ids, wheelId);
      });
    }

    return Array.from(ids).sort(function sortNumeric(left, right) {
      return Number(left) - Number(right);
    });
  }

  function buildWheelLookupSnapshot(wheelsSource, wheelId) {
    var wheel = getWheel(wheelsSource, wheelId);
    var lookup = buildOptionLookup(wheel);

    return {
      schema: "jjk-life-wheel-lookup-snapshot",
      version: 1,
      metadata: metadata,
      query: {
        wheelId: wheelId,
        normalizedWheelId: normalizeWheelId(wheelId),
        code: formatWheelCode(wheelId)
      },
      found: Boolean(wheel),
      wheel: lookup.wheel,
      options: listWheelOptions(wheel),
      optionCount: lookup.optionCount
    };
  }

  function buildWheelCatalogSnapshot(wheelsSource, flow, options) {
    var configuredIds = new Set(collectConfiguredWheelIds(flow, options));
    var wheels = toWheelArray(wheelsSource).map(function mapWheel(wheel) {
      var summary = summarizeWheel(wheel);
      return {
        id: summary.id,
        code: summary.code,
        title: summary.title,
        itemCount: summary.itemCount,
        configured: configuredIds.has(summary.id)
      };
    });

    return {
      schema: "jjk-life-wheel-catalog-snapshot",
      version: 1,
      metadata: metadata,
      summary: summarizeWheelCollection(wheelsSource),
      configuredWheelCount: wheels.filter(function isConfigured(wheel) {
        return wheel.configured;
      }).length,
      configuredWheelIds: Array.from(configuredIds),
      wheels: wheels
    };
  }

  function validateWheelData(source) {
    var wheels = toWheelArray(source);
    var summary = summarizeWheelCollection(source);
    var missingIds = [];
    var missingItems = [];

    wheels.forEach(function validateWheel(wheel, index) {
      var id = normalizeWheelId(wheel?.dbId);
      if (!id) missingIds.push(index);
      if (!Array.isArray(wheel?.items)) missingItems.push(id || String(index));
    });

    return {
      ok: wheels.length > 0 && missingIds.length === 0 && missingItems.length === 0 && summary.duplicateIds.length === 0,
      wheelCount: wheels.length,
      missingIds: missingIds,
      missingItems: missingItems,
      duplicateIds: summary.duplicateIds
    };
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
    normalizeWheelId: normalizeWheelId,
    formatWheelCode: formatWheelCode,
    toWheelArray: toWheelArray,
    buildWheelMap: buildWheelMap,
    getWheel: getWheel,
    hasWheel: hasWheel,
    getTaskWheel: getTaskWheel,
    getWheelMetadata: getWheelMetadata,
    buildOptionLookup: buildOptionLookup,
    getWheelOptionByIndex: getWheelOptionByIndex,
    getWheelOptionByText: getWheelOptionByText,
    listWheelOptions: listWheelOptions,
    summarizeWheel: summarizeWheel,
    summarizeWheelCollection: summarizeWheelCollection,
    collectConfiguredWheelIds: collectConfiguredWheelIds,
    buildWheelLookupSnapshot: buildWheelLookupSnapshot,
    buildWheelCatalogSnapshot: buildWheelCatalogSnapshot,
    validateWheelData: validateWheelData
  };

  global[namespace] = api;
  if (global.JJKLifeWheel && typeof global.JJKLifeWheel.registerHelper === "function") {
    global.JJKLifeWheel.registerHelper("data", api);
  }
})(globalThis);
