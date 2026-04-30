(function attachJJKLifeWheelResult(global) {
  "use strict";

  var namespace = "JJKLifeWheelResult";
  var version = "0.1.0-result-snapshot-candidate";
  var expectedExports = Object.freeze([
    "getPendingResultIndexes",
    "countSelectableOptions",
    "summarizeResult",
    "summarizeRecord",
    "createResultSnapshot",
    "createResultLogSnapshot",
    "createResultSummary",
    "createResultExportSummary",
    "createResultDebugSummary",
    "validateResultRecord"
  ]);

  var metadata = Object.freeze({
    namespace: namespace,
    version: version,
    layer: "life-wheel-result",
    moduleFormat: "classic-script-iife",
    scriptType: "classic",
    behavior: "result-snapshot-metadata-only",
    ownsBehavior: false,
    ownsWheelFlow: false,
    ownsWheelProbability: false,
    mutatesState: false,
    status: "CANDIDATE"
  });

  function hasOwn(source, key) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }

  function cloneArray(value) {
    return Array.isArray(value) ? value.slice() : [];
  }

  function clonePlain(value) {
    if (!value || typeof value !== "object") return value ?? null;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return null;
    }
  }

  function toRecordList(records) {
    return Array.isArray(records) ? records : [];
  }

  function getPendingResultIndexes(result) {
    if (!result) return [];
    if (Array.isArray(result.results)) {
      return result.results
        .map(function mapResult(item) {
          return item?.index;
        })
        .filter(Number.isInteger);
    }
    if (Number.isInteger(result.index)) return [result.index];
    return [];
  }

  function countSelectableOptions(snapshot) {
    return (snapshot?.options || []).filter(function isSelectable(item) {
      return item?.selectable !== false;
    }).length;
  }

  function summarizeResult(result) {
    var indexes = getPendingResultIndexes(result);

    return {
      text: result?.text || "",
      indexes: indexes,
      indexCount: indexes.length,
      count: Number(result?.count || (Array.isArray(result?.results) ? result.results.length : indexes.length)),
      requestedCount: result?.requestedCount ?? null,
      selectionMode: result?.selectionMode || "random",
      hasMultipleResults: Array.isArray(result?.results),
      hasAiFreeInteraction: Boolean(result?.aiFreeInteraction),
      hasAiFreeInfluence: Boolean(result?.aiFreeInfluence),
      hasAiFreeBridge: Boolean(result?.aiFreeBridge)
    };
  }

  function createResultSnapshot(result, task) {
    var summary = summarizeResult(result);

    return {
      schema: "jjk-life-wheel-result-snapshot",
      version: 1,
      result: summary,
      task: task ? {
        type: task.type || "",
        nodeId: task.nodeId || "",
        title: task.title || "",
        stage: task.stage || "",
        wheelId: task.wheelId || null,
        condition: task.condition || "",
        countFrom: task.countFrom || ""
      } : null,
      selectedText: result?.text || "",
      selectedIndexes: summary.indexes.slice(),
      selectedResults: Array.isArray(result?.results)
        ? result.results.map(function mapSelected(item) {
          return {
            index: Number.isInteger(item?.index) ? item.index : null,
            text: item?.text || "",
            weight: Number(item?.weight || 0),
            selectionMode: item?.selectionMode || result?.selectionMode || "random"
          };
        })
        : [],
      aiFreeInteraction: clonePlain(result?.aiFreeInteraction || null),
      aiFreeInfluence: clonePlain(result?.aiFreeInfluence || null),
      aiFreeAssistTrace: clonePlain(result?.aiFreeAssistTrace || null),
      aiFreeBridge: clonePlain(result?.aiFreeBridge || null)
    };
  }

  function summarizeRecord(record) {
    var optionSnapshot = record?.optionsSnapshot || null;

    return {
      id: Number(record?.id || 0),
      nodeId: record?.nodeId || "",
      title: record?.title || "",
      stage: record?.stage || "",
      result: record?.result || "",
      skipped: Boolean(record?.skipped),
      type: record?.type || "",
      runType: record?.runType || "",
      runLabel: record?.runLabel || "",
      selectionMode: record?.selectionMode || "",
      aiFreeEnabled: Boolean(record?.aiFreeEnabled),
      hasAiFreeInteraction: Boolean(record?.aiFreeInteraction),
      hasAiFreeInfluence: Boolean(record?.aiFreeInfluence),
      hasAiFreeAssistTrace: Boolean(record?.aiFreeAssistTrace),
      hasAiFreeBridge: Boolean(record?.aiFreeBridge),
      optionCount: Array.isArray(optionSnapshot?.options) ? optionSnapshot.options.length : 0,
      selectableOptionCount: countSelectableOptions(optionSnapshot),
      selectedIndexes: cloneArray(optionSnapshot?.selectedIndexes),
      resultTags: cloneArray(record?.optionEffects?.resultTags)
    };
  }

  function createResultLogSnapshot(records, options) {
    var source = Array.isArray(records) ? records : [];
    var includeSkipped = Boolean(options?.includeSkipped);
    var limit = Number(options?.limit || source.length || 0);
    var visible = includeSkipped ? source : source.filter(function isVisible(record) {
      return !record?.skipped;
    });
    var skipped = source.filter(function isSkipped(record) {
      return Boolean(record?.skipped);
    });

    return {
      schema: "jjk-life-wheel-result-log-snapshot",
      version: 1,
      metadata: metadata,
      capturedAt: options?.capturedAt || new Date().toISOString(),
      totalRecordCount: source.length,
      visibleRecordCount: visible.length,
      skippedRecordCount: skipped.length,
      includeSkipped: includeSkipped,
      limit: limit,
      truncated: limit > 0 && visible.length > limit,
      records: (limit > 0 ? visible.slice(0, limit) : visible).map(summarizeRecord)
    };
  }

  function createResultSummary(records, options) {
    var source = toRecordList(records);
    var includeSkipped = Boolean(options?.includeSkipped);
    var visible = includeSkipped ? source : source.filter(function isVisible(record) {
      return !record?.skipped;
    });
    var resultRecords = visible.filter(function isResult(record) {
      return !record?.skipped;
    });
    var skippedRecords = source.filter(function isSkipped(record) {
      return Boolean(record?.skipped);
    });
    var aiFreeRecords = resultRecords.filter(function isAiFree(record) {
      return record?.selectionMode === "aiFree";
    });
    var halfCustomRecords = resultRecords.filter(function isHalfCustom(record) {
      return record?.selectionMode === "halfCustom";
    });
    var activationCustomRecords = resultRecords.filter(function isActivationCustom(record) {
      return record?.runType === "activationCustom";
    });

    return {
      schema: "jjk-life-wheel-result-summary",
      version: 1,
      totalRecordCount: source.length,
      visibleRecordCount: visible.length,
      resultRecordCount: resultRecords.length,
      skippedRecordCount: skippedRecords.length,
      aiFreeRecordCount: aiFreeRecords.length,
      aiFreeInteractionCount: resultRecords.filter(function hasInteraction(record) {
        return Boolean(record?.aiFreeInteraction);
      }).length,
      aiFreeBridgeCount: resultRecords.filter(function hasBridge(record) {
        return Boolean(record?.aiFreeBridge);
      }).length,
      halfCustomRecordCount: halfCustomRecords.length,
      activationCustomRecordCount: activationCustomRecords.length,
      includeSkipped: includeSkipped,
      lastRecord: resultRecords.length ? summarizeRecord(resultRecords[resultRecords.length - 1]) : null
    };
  }

  function createResultExportSummary(records, options) {
    var source = toRecordList(records);
    var debugMode = Boolean(options?.debugMode);
    var visibleRecords = debugMode ? source : source.filter(function isVisible(record) {
      return !record?.skipped;
    });
    var resultRecords = visibleRecords.filter(function isResult(record) {
      return !record?.skipped;
    });
    var skippedRecords = visibleRecords.filter(function isSkipped(record) {
      return Boolean(record?.skipped);
    });

    return {
      schema: "jjk-life-wheel-result-export-summary",
      version: 1,
      exportMode: debugMode ? "debug" : "public",
      debugMode: debugMode,
      totalRecordCount: source.length,
      visibleRecordCount: visibleRecords.length,
      resultRecordCount: resultRecords.length,
      skippedRecordCount: skippedRecords.length,
      records: visibleRecords.map(summarizeRecord),
      resultRecords: resultRecords.map(summarizeRecord),
      skippedRecords: skippedRecords.map(summarizeRecord)
    };
  }

  function createResultDebugSummary(records, options) {
    var source = toRecordList(records);
    var limit = Number(options?.limit || 0);
    var list = limit > 0 ? source.slice(-limit) : source;

    return {
      schema: "jjk-life-wheel-result-debug-summary",
      version: 1,
      totalRecordCount: source.length,
      includedRecordCount: list.length,
      truncated: limit > 0 && source.length > limit,
      logicChain: list.map(function mapLogicChain(record) {
        return {
          id: record?.id || null,
          nodeId: record?.nodeId || "",
          title: record?.title || "",
          stage: record?.stage || "",
          result: record?.result || "",
          selectionMode: record?.selectionMode || "random",
          skipped: Boolean(record?.skipped),
          reason: record?.why || record?.reason || "",
          condition: record?.optionsSnapshot?.condition || "",
          selectedText: record?.optionsSnapshot?.selectedText || "",
          selectedIndexes: cloneArray(record?.optionsSnapshot?.selectedIndexes),
          aiFreeAssistTrace: clonePlain(record?.aiFreeAssistTrace || null),
          aiFreeBridge: clonePlain(record?.aiFreeBridge || null),
          optionEffects: clonePlain(record?.optionEffects || null),
          options: clonePlain(record?.optionsSnapshot?.options || [])
        };
      })
    };
  }

  function validateResultRecord(record) {
    var missing = [];

    ["id", "title", "result"].forEach(function requireKey(key) {
      if (!hasOwn(record || {}, key)) missing.push(key);
    });

    return {
      ok: missing.length === 0,
      missing: missing,
      hasOptionsSnapshot: Boolean(record?.optionsSnapshot),
      skipped: Boolean(record?.skipped)
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
    getPendingResultIndexes: getPendingResultIndexes,
    countSelectableOptions: countSelectableOptions,
    summarizeResult: summarizeResult,
    summarizeRecord: summarizeRecord,
    createResultSnapshot: createResultSnapshot,
    createResultLogSnapshot: createResultLogSnapshot,
    createResultSummary: createResultSummary,
    createResultExportSummary: createResultExportSummary,
    createResultDebugSummary: createResultDebugSummary,
    validateResultRecord: validateResultRecord
  };

  global[namespace] = api;
  if (global.JJKLifeWheel && typeof global.JJKLifeWheel.registerHelper === "function") {
    global.JJKLifeWheel.registerHelper("result", api);
  }
})(globalThis);
