(function attachJJKLifeWheelState(global) {
  "use strict";

  var namespace = "JJKLifeWheelState";
  var version = "0.1.0-snapshot-candidate";
  var expectedExports = Object.freeze([
    "clonePlain",
    "serializeFlags",
    "summarizeFlags",
    "getTaskMetadata",
    "getRecordMetadata",
    "createQueueSnapshot",
    "createRecordsSnapshot",
    "createBacktrackSnapshotData",
    "createBacktrackHistorySnapshot",
    "createStateHistorySnapshot",
    "summarizeLifeWheelState",
    "createLifeWheelStateSnapshot"
  ]);

  var metadata = Object.freeze({
    namespace: namespace,
    version: version,
    layer: "life-wheel-state",
    moduleFormat: "classic-script-iife",
    scriptType: "classic",
    behavior: "snapshot-metadata-only",
    ownsBehavior: false,
    ownsWheelFlow: false,
    ownsWheelProbability: false,
    mutatesState: false,
    status: "CANDIDATE"
  });

  function hasOwn(source, key) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }

  function objectType(value) {
    return Object.prototype.toString.call(value);
  }

  function isSet(value) {
    return objectType(value) === "[object Set]";
  }

  function isMap(value) {
    return objectType(value) === "[object Map]";
  }

  function clonePlain(value, options) {
    var maxDepth = Number(options?.maxDepth || 8);
    return cloneValue(value, maxDepth, []);
  }

  function cloneValue(value, depth, seen) {
    var output;

    if (value == null || typeof value !== "object") return value;
    if (depth <= 0) return Array.isArray(value) ? [] : {};
    if (seen.indexOf(value) >= 0) return "[Circular]";
    seen.push(value);

    if (isSet(value)) {
      output = Array.from(value).map(function cloneSetItem(item) {
        return cloneValue(item, depth - 1, seen.slice());
      });
      return output;
    }

    if (isMap(value)) {
      output = {};
      value.forEach(function cloneMapItem(item, key) {
        output[String(key)] = cloneValue(item, depth - 1, seen.slice());
      });
      return output;
    }

    if (Array.isArray(value)) {
      return value.map(function cloneArrayItem(item) {
        return cloneValue(item, depth - 1, seen.slice());
      });
    }

    if (typeof value.toISOString === "function" && value instanceof Date) {
      return value.toISOString();
    }

    output = {};
    Object.keys(value).forEach(function cloneKey(key) {
      if (typeof value[key] !== "function") {
        output[key] = cloneValue(value[key], depth - 1, seen.slice());
      }
    });
    return output;
  }

  function serializeFlags(flags) {
    var copy = clonePlain(flags || {});

    if (isSet(flags?.skipPeriods)) {
      copy.skipPeriods = Array.from(flags.skipPeriods);
    } else if (Array.isArray(flags?.skipPeriods)) {
      copy.skipPeriods = flags.skipPeriods.slice();
    } else if (!hasOwn(copy, "skipPeriods")) {
      copy.skipPeriods = [];
    }

    return copy;
  }

  function summarizeFlags(flags) {
    var serialized = serializeFlags(flags);
    var keys = Object.keys(serialized);
    var truthyKeys = keys.filter(function isTruthy(key) {
      return Boolean(serialized[key]);
    });

    return {
      keyCount: keys.length,
      truthyKeyCount: truthyKeys.length,
      truthyKeys: truthyKeys,
      skipPeriodCount: Array.isArray(serialized.skipPeriods) ? serialized.skipPeriods.length : 0,
      dead: Boolean(serialized.dead),
      finalSequenceStarted: Boolean(serialized.finalSequenceStarted),
      enteredEasterEgg: Boolean(serialized.enteredEasterEgg)
    };
  }

  function getTaskMetadata(task) {
    if (!task) return null;
    return {
      type: task.type || "",
      nodeId: task.nodeId || "",
      wheelId: task.wheelId || task.contentWheelId || null,
      title: task.title || "",
      stage: task.stage || "",
      condition: task.condition || "",
      why: task.why || "",
      countFrom: task.countFrom || "",
      noRepeatScope: task.noRepeatScope || "",
      timelinePeriod: task.timelinePeriod || "",
      optionCount: Array.isArray(task.options) ? task.options.length : 0,
      expand: task.expand || "",
      dynamicSource: task.dynamicSource || ""
    };
  }

  function getRecordMetadata(record) {
    if (!record) return null;
    return {
      id: Number(record.id || 0),
      nodeId: record.nodeId || "",
      title: record.title || "",
      stage: record.stage || "",
      result: record.result || "",
      type: record.type || "",
      skipped: Boolean(record.skipped),
      selectionMode: record.selectionMode || "random",
      runType: record.runType || "",
      runLabel: record.runLabel || "",
      aiFreeEnabled: Boolean(record.aiFreeEnabled),
      hasOptionsSnapshot: Boolean(record.optionsSnapshot),
      hasOptionEffects: Boolean(record.optionEffects),
      hasAiFreeInteraction: Boolean(record.aiFreeInteraction),
      hasAiFreeInfluence: Boolean(record.aiFreeInfluence),
      hasAiFreeBridge: Boolean(record.aiFreeBridge)
    };
  }

  function createQueueSnapshot(queue, options) {
    var limit = Number(options?.limit || 50);
    var tasks = Array.isArray(queue) ? queue : [];

    return {
      total: tasks.length,
      limit: limit,
      truncated: tasks.length > limit,
      items: tasks.slice(0, limit).map(getTaskMetadata)
    };
  }

  function createRecordsSnapshot(records, options) {
    var limit = Number(options?.limit || 50);
    var includeSkipped = options?.includeSkipped !== false;
    var includeFullRecords = Boolean(options?.includeFullRecords);
    var items = Array.isArray(records) ? records : [];
    var filtered = includeSkipped ? items : items.filter(function isVisible(record) {
      return !record?.skipped;
    });

    return {
      total: items.length,
      visibleTotal: items.filter(function isVisible(record) {
        return !record?.skipped;
      }).length,
      skippedTotal: items.filter(function isSkipped(record) {
        return Boolean(record?.skipped);
      }).length,
      limit: limit,
      truncated: filtered.length > limit,
      items: includeFullRecords
        ? clonePlain(filtered.slice(0, limit), { maxDepth: 6 })
        : filtered.slice(0, limit).map(getRecordMetadata)
    };
  }

  function createBacktrackSnapshotData(appState) {
    return {
      mainIndex: Number(appState?.mainIndex || 0),
      taskQueue: clonePlain(appState?.taskQueue || [], { maxDepth: 6 }),
      currentTask: clonePlain(appState?.currentTask || null, { maxDepth: 6 }),
      records: clonePlain(appState?.records || [], { maxDepth: 6 }),
      recordSeq: Number(appState?.recordSeq || 0),
      answers: clonePlain(appState?.answers || {}, { maxDepth: 6 }),
      flags: serializeFlags(appState?.flags || {})
    };
  }

  function createBacktrackHistorySnapshot(backtrackSnapshots, options) {
    var limit = Number(options?.limit || 50);
    var includeSnapshots = Boolean(options?.includeSnapshots);
    var items = Array.isArray(backtrackSnapshots) ? backtrackSnapshots : [];

    return {
      total: items.length,
      limit: limit,
      truncated: items.length > limit,
      items: items.slice(0, limit).map(function mapBacktrackEntry(entry) {
        return {
          recordId: Number(entry?.recordId || 0),
          snapshot: includeSnapshots
            ? clonePlain(entry?.snapshot || null, { maxDepth: 6 })
            : undefined,
          snapshotSummary: entry?.snapshot ? {
            mainIndex: Number(entry.snapshot.mainIndex || 0),
            queueLength: Array.isArray(entry.snapshot.taskQueue) ? entry.snapshot.taskQueue.length : 0,
            recordCount: Array.isArray(entry.snapshot.records) ? entry.snapshot.records.length : 0,
            recordSeq: Number(entry.snapshot.recordSeq || 0),
            answerCount: entry.snapshot.answers && typeof entry.snapshot.answers === "object"
              ? Object.keys(entry.snapshot.answers).length
              : 0
          } : null
        };
      })
    };
  }

  function createStateHistorySnapshot(appState, options) {
    return {
      schema: "jjk-life-wheel-history-snapshot",
      version: 1,
      metadata: metadata,
      capturedAt: options?.capturedAt || new Date().toISOString(),
      summary: summarizeLifeWheelState(appState),
      records: createRecordsSnapshot(appState?.records, {
        limit: Number(options?.recordLimit || options?.limit || 50),
        includeSkipped: options?.includeSkipped,
        includeFullRecords: options?.includeFullRecords
      }),
      backtrackHistory: createBacktrackHistorySnapshot(appState?.backtrackSnapshots, {
        limit: Number(options?.backtrackLimit || options?.limit || 50),
        includeSnapshots: options?.includeBacktrackSnapshots
      })
    };
  }

  function summarizeLifeWheelState(appState) {
    var records = Array.isArray(appState?.records) ? appState.records : [];
    var skipped = records.filter(function isSkipped(record) {
      return Boolean(record?.skipped);
    });

    return {
      hasWheels: Boolean(appState?.wheels),
      hasFlow: Boolean(appState?.flow),
      hasCurrentTask: Boolean(appState?.currentTask),
      currentTaskType: appState?.currentTask?.type || "",
      mainIndex: Number(appState?.mainIndex || 0),
      queueLength: Array.isArray(appState?.taskQueue) ? appState.taskQueue.length : 0,
      recordCount: records.length,
      visibleRecordCount: records.length - skipped.length,
      skippedRecordCount: skipped.length,
      answerCount: appState?.answers && typeof appState.answers === "object" ? Object.keys(appState.answers).length : 0,
      isSpinning: Boolean(appState?.isSpinning),
      aiFreeEnabled: Boolean(appState?.aiFreeEnabled),
      debugMode: Boolean(appState?.debugMode),
      flags: summarizeFlags(appState?.flags)
    };
  }

  function createLifeWheelStateSnapshot(appState, options) {
    var includeRecords = Boolean(options?.includeRecords);
    var includeAnswers = options?.includeAnswers !== false;
    var includeFlags = options?.includeFlags !== false;
    var queueLimit = Number(options?.queueLimit || 50);
    var records = Array.isArray(appState?.records) ? appState.records : [];

    return {
      schema: "jjk-life-wheel-state-snapshot",
      version: 1,
      metadata: metadata,
      capturedAt: options?.capturedAt || new Date().toISOString(),
      summary: summarizeLifeWheelState(appState),
      mainIndex: Number(appState?.mainIndex || 0),
      currentTask: getTaskMetadata(appState?.currentTask),
      pendingResult: clonePlain(appState?.pendingResult || null, { maxDepth: 5 }),
      taskQueue: createQueueSnapshot(appState?.taskQueue, { limit: queueLimit }),
      recordSeq: Number(appState?.recordSeq || 0),
      records: includeRecords ? clonePlain(records, { maxDepth: 6 }) : undefined,
      answers: includeAnswers ? clonePlain(appState?.answers || {}, { maxDepth: 6 }) : undefined,
      flags: includeFlags ? serializeFlags(appState?.flags || {}) : undefined,
      backtrackSnapshotCount: Array.isArray(appState?.backtrackSnapshots) ? appState.backtrackSnapshots.length : 0
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
    clonePlain: clonePlain,
    serializeFlags: serializeFlags,
    summarizeFlags: summarizeFlags,
    getTaskMetadata: getTaskMetadata,
    getRecordMetadata: getRecordMetadata,
    createQueueSnapshot: createQueueSnapshot,
    createRecordsSnapshot: createRecordsSnapshot,
    createBacktrackSnapshotData: createBacktrackSnapshotData,
    createBacktrackHistorySnapshot: createBacktrackHistorySnapshot,
    createStateHistorySnapshot: createStateHistorySnapshot,
    summarizeLifeWheelState: summarizeLifeWheelState,
    createLifeWheelStateSnapshot: createLifeWheelStateSnapshot
  };

  global[namespace] = api;
  if (global.JJKLifeWheel && typeof global.JJKLifeWheel.registerHelper === "function") {
    global.JJKLifeWheel.registerHelper("state", api);
  }
})(globalThis);
