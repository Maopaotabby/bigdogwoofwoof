(function attachJJKLifeWheelFlow(global) {
  "use strict";

  var namespace = "JJKLifeWheelFlow";
  var version = "0.1.0-flow-metadata-candidate";
  var expectedExports = Object.freeze([
    "getFlowMetadata",
    "getExpectedExports",
    "isTerminalTask",
    "getTerminalDescriptor",
    "shouldStartFinalSequence",
    "shouldCompleteFinalSequence",
    "shouldStartEasterEggFinalSequence",
    "shouldCompleteEasterEggFinalSequence",
    "createFinalSequenceDescriptor",
    "createEasterEggFinalSequenceDescriptor",
    "createTransitionDescriptor",
    "getContinuationState",
    "getNextStepHint"
  ]);

  var metadata = Object.freeze({
    namespace: namespace,
    version: version,
    layer: "life-wheel-flow",
    moduleFormat: "classic-script-iife",
    scriptType: "classic",
    behavior: "flow-metadata-transition-descriptor-only",
    ownsBehavior: false,
    ownsWheelFlow: false,
    ownsWheelProbability: false,
    mutatesState: false,
    migratesAdvanceToNextTask: false,
    migratesRender: false,
    migratesAnimation: false,
    migratesSound: false,
    status: "CANDIDATE"
  });

  var terminalDescriptors = Object.freeze({
    death: Object.freeze({
      type: "end",
      title: "流程已因死亡终止",
      stage: "结束",
      why: "规则：死亡后只保留最终评价/投币序列。"
    }),
    easterEgg: Object.freeze({
      type: "end",
      title: "彩蛋线流程完成",
      stage: "结束",
      why: "彩蛋线独立结束；普通主线不再继续。"
    }),
    complete: Object.freeze({
      type: "end",
      title: "流程完成",
      stage: "结束",
      why: "已完成当前 v1 候选流程。"
    })
  });

  function clonePlain(value) {
    if (value == null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(clonePlain);
    var output = {};
    Object.keys(value).forEach(function cloneKey(key) {
      if (typeof value[key] !== "function") output[key] = clonePlain(value[key]);
    });
    return output;
  }

  function getFlags(appState) {
    return appState?.flags || {};
  }

  function getQueue(appState) {
    return Array.isArray(appState?.taskQueue) ? appState.taskQueue : [];
  }

  function getMainFlow(appState) {
    return Array.isArray(appState?.flow?.mainFlow) ? appState.flow.mainFlow : [];
  }

  function getMainIndex(appState) {
    return Number(appState?.mainIndex || 0);
  }

  function hasPendingMainFlow(appState) {
    return getMainIndex(appState) < getMainFlow(appState).length;
  }

  function isTerminalTask(task) {
    return task?.type === "end";
  }

  function getTerminalDescriptor(kind) {
    return clonePlain(terminalDescriptors[kind] || terminalDescriptors.complete);
  }

  function shouldStartFinalSequence(appState) {
    var flags = getFlags(appState);
    return Boolean(flags.dead && !flags.finalSequenceStarted);
  }

  function shouldCompleteFinalSequence(appState) {
    var flags = getFlags(appState);
    return Boolean(flags.dead && flags.finalSequenceStarted && getQueue(appState).length === 0);
  }

  function shouldStartEasterEggFinalSequence(appState) {
    var flags = getFlags(appState);
    return Boolean(flags.enteredEasterEgg && !flags.easterEggFinalSequenceStarted && getQueue(appState).length === 0);
  }

  function shouldCompleteEasterEggFinalSequence(appState) {
    var flags = getFlags(appState);
    return Boolean(flags.enteredEasterEgg && flags.easterEggFinalSequenceStarted && getQueue(appState).length === 0);
  }

  function createFinalSequenceDescriptor(appState, options) {
    var flags = getFlags(appState);
    var shouldRunPostEvaluation = Boolean(options?.shouldRunPostEvaluation);
    var tasks = [];

    if (shouldRunPostEvaluation && !flags.hadPostEvaluation) {
      tasks.push({
        type: "wheel",
        nodeId: "final-postEvaluation",
        wheelId: 91,
        title: "后代评价",
        stage: "结束/评价",
        why: "死亡或流程终止后的最终评价池。"
      });
    }

    if (!flags.hadCoinFlip) {
      tasks.push({
        type: "wheel",
        nodeId: "final-endingMeta",
        wheelId: 130,
        title: "观众是否会投币",
        stage: "结束/元互动",
        why: "无论任何路线，投币始终在最后。"
      });
    }

    return {
      kind: "death-final-sequence",
      clearsTaskQueue: true,
      setsFlag: "finalSequenceStarted",
      requiresExternalPostEvaluationDecision: !Object.prototype.hasOwnProperty.call(options || {}, "shouldRunPostEvaluation"),
      taskCount: tasks.length,
      tasks: tasks
    };
  }

  function createEasterEggFinalSequenceDescriptor(appState) {
    var flags = getFlags(appState);
    var tasks = [];

    if (!flags.hadCoinFlip) {
      tasks.push({
        type: "wheel",
        nodeId: "easter-endingMeta",
        wheelId: 130,
        title: "观众是否会投币",
        stage: "结束/元互动",
        why: "彩蛋线独立结束；投币仍为最后节点。"
      });
    }

    return {
      kind: "easter-egg-final-sequence",
      clearsTaskQueue: false,
      setsFlag: "easterEggFinalSequenceStarted",
      taskCount: tasks.length,
      tasks: tasks
    };
  }

  function createTransitionDescriptor(appState, options) {
    var queue = getQueue(appState);
    var mainFlow = getMainFlow(appState);
    var mainIndex = getMainIndex(appState);

    if (shouldStartFinalSequence(appState)) {
      return {
        action: "enqueue-final-sequence",
        terminal: false,
        continueFlow: true,
        clearsPendingResult: true,
        descriptor: createFinalSequenceDescriptor(appState, options || {})
      };
    }

    if (shouldCompleteFinalSequence(appState)) {
      return {
        action: "complete-death-final-sequence",
        terminal: true,
        continueFlow: false,
        clearsPendingResult: true,
        endTask: getTerminalDescriptor("death")
      };
    }

    if (shouldStartEasterEggFinalSequence(appState)) {
      return {
        action: "enqueue-easter-egg-final-sequence",
        terminal: false,
        continueFlow: true,
        clearsPendingResult: true,
        descriptor: createEasterEggFinalSequenceDescriptor(appState)
      };
    }

    if (shouldCompleteEasterEggFinalSequence(appState)) {
      return {
        action: "complete-easter-egg-final-sequence",
        terminal: true,
        continueFlow: false,
        clearsPendingResult: true,
        endTask: getTerminalDescriptor("easterEgg")
      };
    }

    if (queue.length > 0) {
      return {
        action: "consume-task-queue",
        terminal: false,
        continueFlow: true,
        clearsPendingResult: true,
        queuedTaskCount: queue.length,
        nextTask: clonePlain(queue[0])
      };
    }

    if (mainIndex < mainFlow.length) {
      return {
        action: "consume-main-flow",
        terminal: false,
        continueFlow: true,
        clearsPendingResult: true,
        mainIndex: mainIndex,
        remainingMainFlowCount: mainFlow.length - mainIndex,
        nextNodeId: mainFlow[mainIndex]
      };
    }

    return {
      action: "complete-main-flow",
      terminal: true,
      continueFlow: false,
      clearsPendingResult: true,
      endTask: getTerminalDescriptor("complete")
    };
  }

  function getContinuationState(appState, options) {
    var transition = createTransitionDescriptor(appState, options || {});
    return {
      terminal: Boolean(transition.terminal),
      continueFlow: Boolean(transition.continueFlow),
      currentTaskTerminal: isTerminalTask(appState?.currentTask),
      action: transition.action,
      reason: transition.terminal ? "terminal-transition" : "flow-has-next-step"
    };
  }

  function getNextStepHint(appState, options) {
    var transition = createTransitionDescriptor(appState, options || {});
    return {
      action: transition.action,
      terminal: transition.terminal,
      source: transition.nextTask ? "taskQueue" : (transition.nextNodeId ? "mainFlow" : (transition.endTask ? "terminal" : "descriptor")),
      nextTask: transition.nextTask || null,
      nextNodeId: transition.nextNodeId || null,
      endTask: transition.endTask || null,
      descriptor: transition.descriptor || null,
      requiresAppOwnedApplicabilityCheck: transition.action === "consume-task-queue" || transition.action === "consume-main-flow",
      requiresAppOwnedExpansion: transition.action === "consume-main-flow",
      pendingMainFlow: hasPendingMainFlow(appState),
      queuedTaskCount: getQueue(appState).length
    };
  }

  function getFlowMetadata() {
    return {
      metadata: metadata,
      terminalDescriptors: clonePlain(terminalDescriptors),
      expectedExports: expectedExports.slice(),
      appOwnedBehavior: [
        "advanceToNextTask mutation",
        "taskFromNode resolution",
        "expandTask queue mutation",
        "isTaskApplicable predicate",
        "recordSkip side effect",
        "markFlowCompletion side effect",
        "shouldRunPostEvaluation decision"
      ]
    };
  }

  function getExpectedExports() {
    return expectedExports.slice();
  }

  var api = {
    namespace: namespace,
    version: version,
    metadata: metadata,
    expectedExports: expectedExports,
    getFlowMetadata: getFlowMetadata,
    getExpectedExports: getExpectedExports,
    isTerminalTask: isTerminalTask,
    getTerminalDescriptor: getTerminalDescriptor,
    shouldStartFinalSequence: shouldStartFinalSequence,
    shouldCompleteFinalSequence: shouldCompleteFinalSequence,
    shouldStartEasterEggFinalSequence: shouldStartEasterEggFinalSequence,
    shouldCompleteEasterEggFinalSequence: shouldCompleteEasterEggFinalSequence,
    createFinalSequenceDescriptor: createFinalSequenceDescriptor,
    createEasterEggFinalSequenceDescriptor: createEasterEggFinalSequenceDescriptor,
    createTransitionDescriptor: createTransitionDescriptor,
    getContinuationState: getContinuationState,
    getNextStepHint: getNextStepHint
  };

  global[namespace] = api;
  if (global.JJKLifeWheel && typeof global.JJKLifeWheel.registerHelper === "function") {
    try {
      global.JJKLifeWheel.registerHelper("flow", api);
    } catch (error) {
      api.registrationWarning = "JJKLifeWheel registry does not yet declare helper key: flow";
    }
  }
})(globalThis);
