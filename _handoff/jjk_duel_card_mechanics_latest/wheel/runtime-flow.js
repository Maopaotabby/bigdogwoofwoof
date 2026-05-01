//--转盘流程队列与存档--//
function getRunProfile(record = null) {
  const runType = record?.runType || (isActivationCustomRun() ? "activationCustom" : state.playMode);
  const aiFreeAssist = Boolean(record?.aiFreeEnabled ?? (!record && state.aiFreeEnabled));
  if (runType === "activationCustom") {
    return {
      type: "activationCustom",
      publicLabel: "激活码自定义整局",
      shortLabel: "自定义局",
      exportTitle: "咒术转盘自定义局记录",
      disclosure: "本记录由激活码解锁的完全自定义整局生成，不属于普通随机局。",
      filenamePrefix: "jjk-wheel-custom-result"
    };
  }
  if (runType === "semi") {
    return {
      type: "semi",
      publicLabel: aiFreeAssist ? "半自定义模式 + AI自由辅助" : "半自定义模式",
      shortLabel: aiFreeAssist ? "半自定义+AI" : "半自定义",
      exportTitle: "咒术转盘抽取记录",
      disclosure: aiFreeAssist ? "本记录启用了 AI自由辅助：主线结果仍锚定网站前端合法节点，自由行动会转化为后续权重影响。" : "",
      modeHint: aiFreeAssist ? "关键人设可自选，AI自由辅助影响后续权重" : "关键人设可自选",
      filenamePrefix: "jjk-wheel-result"
    };
  }
  return {
    type: "random",
    publicLabel: aiFreeAssist ? "随机模式 + AI自由辅助" : "随机模式",
    shortLabel: aiFreeAssist ? "随机+AI" : "随机",
    exportTitle: "咒术转盘抽取记录",
    disclosure: aiFreeAssist ? "本记录启用了 AI自由辅助：主线结果仍锚定网站前端合法节点，自由行动会转化为后续权重影响。" : "",
    modeHint: aiFreeAssist ? "自动跳转，AI自由辅助影响后续权重" : "自动跳转",
    filenamePrefix: "jjk-wheel-result"
  };
}

function isActivationCustomRun() {
  return state.flags.activationCustomRun === true;
}

function getActivationCustomRunMeta() {
  if (!isActivationCustomRun()) return null;
  return {
    sessionId: state.flags.activationCustomSessionId || "custom-session",
    codeSuffix: state.flags.activationCodeSuffix || "",
    activatedAt: state.flags.activationCustomActivatedAt || "",
    disclosure: getRunProfile({ runType: "activationCustom" }).disclosure
  };
}

function markActivationCustomRun(session = {}) {
  state.flags.activationCustomRun = true;
  state.flags.activationCustomSessionId = session.sessionId || `CUSTOM-${Date.now().toString(36).toUpperCase()}`;
  state.flags.activationCodeSuffix = session.codeSuffix || "";
  state.flags.activationCustomActivatedAt = session.activatedAt || new Date().toISOString();
  syncPlayMode();
  saveLifeWheelRunDraft();
}

function createInitialFlowFlags() {
  return {
    dead: false,
    skipPeriods: new Set(),
    aiFreeInfluences: [],
    aiFreeAssistTimeline: [],
    aiFreeBridgeEvents: [],
    aiFreeWeightBias: createEmptyAiFreeBias()
  };
}

function restart(options = {}) {
  if (options.clearDraft) clearLifeWheelRunDraft();
  incrementUsageStat("flowStarts");
  state.spinToken += 1;
  stopResultSpeech();
  state.mainIndex = 0;
  state.taskQueue = [];
  state.currentTask = null;
  state.pendingResult = null;
  state.isSpinning = false;
  clearSpinModeSnapshot();
  state.records = [];
  state.recordSeq = 0;
  state.backtrackSnapshots = [];
  state.answers = {};
  state.flags = createInitialFlowFlags();
  state.restoredLifeWheelDraft = null;
  els.exportBox.hidden = true;
  syncPlayMode();
  advanceToNextTask();
  renderAll();
  saveLifeWheelRunDraft();
}

function getLifeWheelDataVersionSnapshot() {
  return {
    wheelsVersion: state.wheels?.version ?? "",
    wheelsExportTime: state.wheels?.exportTime ?? "",
    flowVersion: state.flow?.version ?? ""
  };
}

function buildLifeWheelRunDraftPayload() {
  return {
    schema: LIFE_WHEEL_RUN_DRAFT_SCHEMA,
    version: 1,
    buildVersion: APP_BUILD_VERSION,
    savedAt: new Date().toISOString(),
    dataVersion: getLifeWheelDataVersionSnapshot(),
    run: {
      mainIndex: state.mainIndex,
      taskQueue: clonePlain(state.taskQueue || []),
      currentTask: clonePlain(state.currentTask || null),
      records: clonePlain(state.records || []),
      recordSeq: state.recordSeq,
      backtrackSnapshots: clonePlain(state.backtrackSnapshots || []),
      answers: clonePlain(state.answers || {}),
      flags: serializeFlags(state.flags || {}),
      playMode: state.playMode,
      aiFreeEnabled: Boolean(state.aiFreeEnabled)
    }
  };
}

function isLifeWheelRunDraftCompatible(payload) {
  if (!payload || payload.schema !== LIFE_WHEEL_RUN_DRAFT_SCHEMA || payload.version !== 1) return false;
  if (!payload.run || typeof payload.run !== "object") return false;
  const currentData = getLifeWheelDataVersionSnapshot();
  const savedData = payload.dataVersion || {};
  return String(savedData.wheelsVersion ?? "") === String(currentData.wheelsVersion ?? "") &&
    String(savedData.wheelsExportTime ?? "") === String(currentData.wheelsExportTime ?? "") &&
    String(savedData.flowVersion ?? "") === String(currentData.flowVersion ?? "");
}

function saveLifeWheelRunDraft() {
  if (!state.wheels || !state.flow || state.isSpinning) return false;
  try {
    window.localStorage.setItem(
      LIFE_WHEEL_RUN_DRAFT_STORAGE_KEY,
      JSON.stringify(buildLifeWheelRunDraftPayload())
    );
    return true;
  } catch {
    return false;
  }
}

function readLifeWheelRunDraft() {
  try {
    const raw = window.localStorage.getItem(LIFE_WHEEL_RUN_DRAFT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearLifeWheelRunDraft() {
  try {
    window.localStorage.removeItem(LIFE_WHEEL_RUN_DRAFT_STORAGE_KEY);
  } catch {
    // Ignore restricted storage; the in-memory restart still succeeds.
  }
}

function restoreLifeWheelRunDraft() {
  const payload = readLifeWheelRunDraft();
  if (!payload) return false;
  if (!isLifeWheelRunDraftCompatible(payload)) {
    clearLifeWheelRunDraft();
    return false;
  }

  const run = payload.run || {};
  state.spinToken += 1;
  stopResultSpeech();
  state.mainIndex = Number(run.mainIndex || 0);
  state.taskQueue = clonePlain(run.taskQueue || []);
  state.currentTask = clonePlain(run.currentTask || null);
  state.pendingResult = null;
  state.isSpinning = false;
  clearSpinModeSnapshot();
  state.records = clonePlain(run.records || []);
  state.recordSeq = Number(run.recordSeq || state.records.reduce((max, record) => Math.max(max, Number(record?.id || 0)), 0));
  state.backtrackSnapshots = clonePlain(run.backtrackSnapshots || []);
  state.answers = clonePlain(run.answers || {});
  state.flags = restoreFlags(run.flags || {});
  state.playMode = PLAY_MODE_VALUES.has(run.playMode) ? run.playMode : "random";
  state.aiFreeEnabled = Boolean(run.aiFreeEnabled);
  state.restoredLifeWheelDraft = {
    savedAt: payload.savedAt || "",
    buildVersion: payload.buildVersion || "",
    recordCount: state.records.length
  };
  els.exportBox.hidden = true;
  syncPlayMode();
  return true;
}

function advanceToNextTask() {
  state.pendingResult = null;

  if (callSiteModuleImplementation("JJKLifeWheelFlow", "shouldStartFinalSequence", [state])) {
    enqueueFinalSequence();
  }

  if (callSiteModuleImplementation("JJKLifeWheelFlow", "shouldCompleteFinalSequence", [state])) {
    markFlowCompletion();
    state.currentTask = callSiteModuleImplementation("JJKLifeWheelFlow", "getTerminalDescriptor", ["death"]);
    return;
  }

  if (callSiteModuleImplementation("JJKLifeWheelFlow", "shouldStartEasterEggFinalSequence", [state])) {
    enqueueEasterEggFinalSequence();
  }

  if (callSiteModuleImplementation("JJKLifeWheelFlow", "shouldCompleteEasterEggFinalSequence", [state])) {
    markFlowCompletion();
    state.currentTask = callSiteModuleImplementation("JJKLifeWheelFlow", "getTerminalDescriptor", ["easterEgg"]);
    return;
  }

  while (state.taskQueue.length > 0) {
    const queued = state.taskQueue.shift();
    if (queued.timelinePeriod && state.flags.skipPeriods.has(queued.timelinePeriod)) {
      recordSkip(queued, "该时期已被前序结果跳过");
      continue;
    }
    if (isTaskApplicable(queued)) {
      state.currentTask = queued;
      return;
    }
    recordSkip(queued, "条件不满足");
  }

  while (state.mainIndex < state.flow.mainFlow.length) {
    const nodeId = state.flow.mainFlow[state.mainIndex++];
    const task = taskFromNode(nodeId);
    if (!task) continue;
    if (isTaskApplicable(task)) {
      if (task.type === "expand") {
        expandTask(task);
        return advanceToNextTask();
      }
      state.currentTask = task;
      return;
    }
    recordSkip(task, "条件不满足");
  }

  markFlowCompletion();
  state.currentTask = callSiteModuleImplementation("JJKLifeWheelFlow", "getTerminalDescriptor", ["complete"]);
}

function enqueueFinalSequence() {
  const descriptor = callSiteModuleImplementation("JJKLifeWheelFlow", "createFinalSequenceDescriptor", [state, {
    shouldRunPostEvaluation: shouldRunPostEvaluation()
  }]);
  state.taskQueue = [];
  state.flags.finalSequenceStarted = true;
  state.taskQueue.push(...descriptor.tasks);
}

function enqueueEasterEggFinalSequence() {
  const descriptor = callSiteModuleImplementation("JJKLifeWheelFlow", "createEasterEggFinalSequenceDescriptor", [state]);
  state.flags.easterEggFinalSequenceStarted = true;
  state.taskQueue.push(...descriptor.tasks);
}

function taskFromNode(nodeId) {
  const node = state.flow.nodes[nodeId];
  if (!node) return null;

  if (node.type === "branch") {
    return null;
  }

  if (node.type === "wheel") {
    return {
      type: "wheel",
      nodeId,
      wheelId: node.wheelId,
      options: node.options,
      title: node.title,
      stage: node.stage,
      why: node.why || node.condition || "流程节点",
      condition: node.condition
    };
  }

  if (node.type === "dynamicWheel") {
    const selected = selectDynamicWheel(node);
    return {
      type: "wheel",
      nodeId,
      wheelId: selected.wheelId,
      title: node.title,
      stage: node.stage,
      why: selected.why || node.why || "动态选择转盘",
      condition: node.condition,
      dynamicSource: node.title
    };
  }

  if (node.type === "computedGrade") {
    return buildComputedGradeTask(nodeId, node);
  }

  if (node.type === "multiDraw") {
    return {
      type: "multiDraw",
      nodeId,
      wheelId: node.contentWheelId,
      countFrom: node.countFrom,
      title: node.title,
      stage: node.stage,
      why: node.why || "按数量门多抽",
      condition: node.condition,
      noRepeatScope: node.noRepeatScope
    };
  }

  if (node.type === "subflow" && nodeId === "customTechnique") {
    return {
      type: "expand",
      nodeId,
      title: node.title,
      stage: node.stage,
      why: node.why || "展开自定义术式流程",
      condition: node.condition,
      expand: "customTechnique"
    };
  }

  if (node.type === "customChoice") {
    const custom = state.flow.customNodes.find((item) => item.id === node.customNodeId);
    return {
      type: "choice",
      nodeId,
      title: custom.title,
      stage: node.stage,
      why: node.why,
      condition: node.condition,
      options: custom.options
    };
  }

  if (node.type === "timelineSubflow") {
    return {
      type: "expand",
      nodeId,
      title: node.title,
      stage: node.stage,
      why: node.why || "按起始时间展开剧情流程",
      expand: "timeline"
    };
  }

  return null;
}

function expandTask(task) {
  if (task.expand === "customTechnique") enqueueCustomTechniqueSubflow();
  if (task.expand === "timeline") enqueueTimeline();
}

function buildComputedGradeTask(nodeId, node) {
  const grade = resolveDeterministicGrade();
  const option = {
    text: grade.label,
    weight: 1,
    index: 0,
    baseWeight: 1,
    selectionMode: "computed"
  };
  const floorText = grade.floorApplied
    ? `；触发保底 ${grade.floorLabel}，最终判为 ${grade.label}`
    : "";
  return {
    type: "computed",
    nodeId,
    title: node.title,
    stage: node.stage,
    why: `${node.why || "等级区间判定"} 有效分 ${formatNumber(grade.score)}，区间 ${grade.rangeText}：${grade.baseLabel}${floorText}。`,
    condition: node.condition,
    options: [option],
    computedOption: option,
    computedGrade: grade
  };
}

function selectDynamicWheel(node) {
  const includeTechniqueSynergy = node?.stage === "隐藏强度";
  for (const candidate of node.wheelSelection) {
    if (candidate.when === "strongPower" && isStrongPower({ includeTechniqueSynergy })) return candidate;
    if (candidate.when === "weakPower" && isWeakPower({ includeTechniqueSynergy })) return candidate;
    if (candidate.when === "weakGrade" && isWeakGrade()) return candidate;
    if (candidate.when === "highTalent" && isHighTalent()) return candidate;
    if (candidate.when === "default") return candidate;
  }
  return node.wheelSelection[node.wheelSelection.length - 1];
}

function enqueueCustomTechniqueSubflow() {
  state.taskQueue.push({
    type: "wheel",
    nodeId: "customTechniqueTypeCount",
    wheelId: 85,
    title: "（自定义）术式类型数量",
    stage: "自定义术式",
    why: "先决定自定义术式类型数量。"
  });
  state.taskQueue.push({
    type: "multiDraw",
    nodeId: "customTechniqueTypes",
    wheelId: 86,
    countFrom: "customTechniqueTypeCount",
    title: "（自定义）术式类型",
    stage: "自定义术式",
    why: "按数量抽取术式类型。",
    noRepeatScope: "singlePool"
  });
  for (const [wheelId, title] of [
    [87, "（自定义）术式风格"],
    [88, "（自定义）术式属性"],
    [89, "（自定义）术式来源"],
    [90, "（自定义）术式咒力要求"],
    [92, "（自定义）术式全方位威力"]
  ]) {
    state.taskQueue.push({
      type: "wheel",
      nodeId: `custom-${wheelId}`,
      wheelId,
      title,
      stage: "自定义术式",
      why: "自定义术式完整流程。"
    });
  }
}

function enqueueAwakenedInnateTechnique() {
  if (state.answers.innateTechnique) return;
  if (state.taskQueue.some((task) => task.nodeId === "innateTechnique")) return;

  state.taskQueue.unshift({
    type: "wheel",
    nodeId: "innateTechnique",
    wheelId: 11,
    title: "觉醒后的生得术式",
    stage: "能力构建",
    why: "普通人后天觉醒术式后，补抽实际获得的生得术式池。"
  });
}

function enqueueTimeline() {
  const timeline = state.flow.timeline;
  const startText = getAnswerText("startTime");
  const startPeriod = Object.entries(timeline.startMapping).find(([key]) => startText.includes(key))?.[1] || "mainStart";
  const ordered = Object.keys(timeline.periods);
  const startIndex = ordered.indexOf(startPeriod);
  const periods = ordered.slice(Math.max(0, startIndex));

  for (const period of periods) {
    if (state.flags.skipPeriods.has(period)) continue;
    for (const item of timeline.periods[period]) {
      state.taskQueue.push({
        type: item.type || "wheel",
        nodeId: item.nodeId || `timeline-${period}-${item.wheelId}`,
        wheelId: item.contentWheelId || item.wheelId,
        options: item.options,
        countFrom: item.countFrom,
        title: item.title,
        stage: `剧情：${periodLabel(period)}`,
        why: item.why || (item.condition ? `条件：${item.condition}` : "时间线事件"),
        condition: item.condition,
        noRepeatScope: item.noRepeatScope,
        timelinePeriod: period
      });
    }
  }
}

function isTaskApplicable(task) {
  if (!task) return false;

  if (task.nodeId === "innateTechnique") {
    return hasTechniqueNow() &&
      state.flags.familyInheritedTechnique !== true &&
      state.flags.innateTechniqueLocked !== true;
  }
  if (task.nodeId === "hasTechnique" && (state.flags.familyInheritedTechnique === true || state.flags.simuriaSpecies === "塞姆利亚人" || state.flags.innateTechniqueLocked === true)) return false;
  if (task.nodeId === "identity" && state.flags.jujutsuCouncil === true) return false;
  if (task.nodeId === "customTechnique") return getAnswerText("innateTechnique").includes("自定义");
  if (task.nodeId === "easterEggGate") return getAnswerText("innateTechnique").includes("进入彩蛋池");
  if (task.nodeId === "alienArrival") return state.flags.isAlien === true;
  if (task.nodeId === "talentReward") return getAnswerText("talent").startsWith("SSS");
  if (task.nodeId === "specialTalent") return getAnswerText("specialTalentGate") === "是";
  if (task.nodeId === "advancedTechniqueCount") return getEffectiveIdentity() !== "咒灵";
  if (task.nodeId === "advancedTechniques") return getEffectiveIdentity() !== "咒灵" && getCountFrom("advancedTechniqueCount") > 0;
  if (task.nodeId === "domainCompletion" || task.nodeId === "domainEffectCount" || task.nodeId === "domainMainEffect") {
    return getEffectiveIdentity() !== "咒灵" && hasDomainExpansionTechnique();
  }
  if (task.nodeId === "domainType") {
    return getEffectiveIdentity() !== "咒灵" &&
      hasDomainExpansionTechnique() &&
      state.flags.domainCompletion !== "未完成领域";
  }
  if (task.nodeId === "domainEffects") {
    return getEffectiveIdentity() !== "咒灵" &&
      hasDomainExpansionTechnique() &&
      getCountFrom("domainEffectCount") > 0;
  }
  if (task.nodeId === "binding") return getEffectiveIdentity() !== "咒灵" && hasAdvancedTechnique("无敌贷款王");
  if (task.nodeId === "toolCount" || task.nodeId === "tools") return getAnswerText("hasTool") === "是";
  if (task.nodeId === "joinHighSchool" || task.title === "是否加入高专") return canChooseHighSchool();
  if (task.title?.startsWith("是否参加新宿决战") && state.flags.participatesShinjuku === true) return false;
  if (task.nodeId?.startsWith("joinMainTeam") || task.title?.includes("是否加入主角小队")) {
    return canJoinMainTeam();
  }
  if (task.title === "是否活到68年后（存活专属）" && state.flags.aliveAfter68 === true) {
    return false;
  }

  if (task.condition) return evaluateCondition(task.condition, task);
  return true;
}

function evaluateCondition(condition, task) {
  if (!condition) return true;
  if (condition.includes(" or ")) {
    return condition.split(" or ").some((part) => evaluateCondition(part.trim(), task));
  }
  if (condition.includes(" and ")) {
    return condition.split(" and ").every((part) => evaluateCondition(part.trim(), task));
  }

  if (condition === "previous == 是") return state.flags.lastResultText === "是";
  if (condition === "protectRiko == 是") return getAnswerText("protectRiko") === "是";
  if (condition === "advancedTechniqueCount > 0") return getCountFrom("advancedTechniqueCount") > 0;
  if (condition === "domainEffectCount > 0") return getCountFrom("domainEffectCount") > 0;
  if (condition === "domainCompletion != 未完成领域") return state.flags.domainCompletion !== "未完成领域";
  if (condition === "talent starts SSS") return getAnswerText("talent").startsWith("SSS");

  if (condition === "identity is humanlike") return isHumanLike();
  if (condition === "identity is humanlike and location == 日本") return isHumanLike() && isInJapan();
  if (condition.startsWith("identity == ")) return getEffectiveIdentity() === condition.slice("identity == ".length);
  if (condition.startsWith("identity != ")) return getEffectiveIdentity() !== condition.slice("identity != ".length);
  if (condition === "location == 日本") return isInJapan();
  if (condition.startsWith("location == ")) return getAnswerText("location") === condition.slice("location == ".length) || state.flags.location === condition.slice("location == ".length);

  if (condition === "canChooseHighSchool == true") return canChooseHighSchool();
  if (condition === "greatFamilyGate == 是") return state.flags.greatFamilyGate === "是";
  if (condition === "greatFamilyGate == 否") return state.flags.greatFamilyGate === "否";
  if (condition === "jujutsuCouncilGate == 是") return state.flags.jujutsuCouncil === true;
  if (condition === "jujutsuCouncilGate == 否") return state.flags.jujutsuCouncilGate === "否";
  if (condition === "joinHighSchool == 是") return state.flags.joinHighSchool === "是" || getAnswerText("joinHighSchool") === "是";
  if (condition === "joinHighSchool == 否") return state.flags.joinHighSchool === "否" || getAnswerText("joinHighSchool") === "否";
  if (condition === "joinMainTeam unset") return !state.flags.joinMainTeam;
  if (condition === "highSchoolCampus unset") return !state.flags.highSchoolCampus;
  if (condition === "highSchoolStatus unset") return !state.flags.highSchoolStatus;
  if (condition === "highSchoolStatus == 学生") return state.flags.highSchoolStatus === "学生";
  if (condition.startsWith("curseUserOrganization includes ")) {
    const expected = condition.slice("curseUserOrganization includes ".length);
    return String(state.flags.curseUserOrganization || "").includes(expected);
  }
  if (condition === "greatFamilyKnown == true") return Boolean(state.flags.greatFamily);
  if (condition === "familyInheritedTechnique == true") return state.flags.familyInheritedTechnique === true;
  if (condition === "guardTengen == 是") return getAnswerText("guardTengen") === "是";
  if (condition === "hasTechnique == 是") return hasTechniqueNow();
  if (condition === "hasTechnique == 否") return getAnswerText("hasTechnique") === "否" && !state.flags.awakenedTechnique;
  if (condition === "hasTool == 是") return getAnswerText("hasTool") === "是";
  if (condition === "specialTalentGate == 是") return getAnswerText("specialTalentGate") === "是";
  if (condition === "specialTalent includes 天与咒缚") return String(state.flags.specialTalent || "").includes("天与咒缚");
  if (condition === "bindingProfileGate == 是") return state.flags.bindingProfileGate === "是" || getAnswerText("bindingProfileGate") === "是";
  if (condition === "bindingProfileGate == 否") return state.flags.bindingProfileGate === "否" || getAnswerText("bindingProfileGate") === "否";
  if (condition === "location includes 西姆利亚星" || condition === "location includes 希姆利亚星") {
    return isSimuriaLocation(getAnswerText("location") || state.flags.location || "");
  }
  if (condition.startsWith("simuriaSpecies == ")) return state.flags.simuriaSpecies === condition.slice("simuriaSpecies == ".length);
  if (condition.startsWith("innateTechnique includes ")) {
    return getAnswerText("innateTechnique").includes(condition.slice("innateTechnique includes ".length));
  }
  if (condition === "innateTechnique == 自定义") return getAnswerText("innateTechnique").includes("自定义");
  if (condition.startsWith("advancedTechniques includes ")) {
    return hasAdvancedTechnique(condition.slice("advancedTechniques includes ".length));
  }

  if (condition === "participatesCullingGame == true") return state.flags.participatesCullingGame === true;
  if (condition === "startPeriod == after68") return getStartPeriod() === "after68";
  if (condition === "startPeriod != after68") return getStartPeriod() !== "after68";
  if (condition === "participatesShibuya == true") return state.flags.participatesShibuya === true;
  if (condition === "participatesShibuya == false") return state.flags.participatesShibuya === false;
  if (condition === "participatesNightParade == true") return state.flags.participatesNightParade === true;
  if (condition === "participatesExchangeEvent == true") return state.flags.participatesExchangeEvent === true;
  if (condition.startsWith("startTime includes ")) {
    const expected = condition.slice("startTime includes ".length);
    return String(state.flags.startTime || getAnswerText("startTime") || "").includes(expected);
  }
  if (condition === "participatesShinjuku == true") return isShinjukuParticipant();
  if (condition === "participatesShinjuku == false") return state.flags.participatesShinjuku === false;
  if (condition === "participatesShinjuku != false") return state.flags.participatesShinjuku !== false;
  if (condition === "W054 == 被受肉了") return state.flags.wasIncarnated === true;
  if (condition === "isCurseWomb == true") return state.flags.isCurseWomb === true;
  if (condition === "curseSpecialPotential == true") return hasCurseSpecialPotential();
  if (condition === "isAlien == true") return state.flags.isAlien === true;
  if (condition === "zeninFamily == true") return state.flags.zeninFamily === true;
  if (condition === "isWeakGrade == true") return isWeakGrade();
  if (condition === "isWeakGrade == false") return !isWeakGrade();
  if (condition === "isStrongGrade == true") return isStrongGrade();
  if (condition === "isStrongGrade == false") return !isStrongGrade();
  if (condition === "isSpecialGrade == true") return isSpecialGrade();
  if (condition === "isSpecialGrade == false") return !isSpecialGrade();

  if (condition === "faction == 未定") return !state.flags.faction;
  if (condition === "faction != 未定") return Boolean(state.flags.faction);
  if (condition.startsWith("faction == ")) return state.flags.faction === condition.slice("faction == ".length);
  if (condition.startsWith("faction != ")) return state.flags.faction !== condition.slice("faction != ".length);
  if (condition === "getoSide == true") return state.flags.getoSide === true;
  if (condition === "getoSide != true") return state.flags.getoSide !== true;
  if (condition === "junpeiArcSide == 高专方") return state.flags.junpeiArcSide === "高专方";
  if (condition === "junpeiArcSide == 真人方") return state.flags.junpeiArcSide === "真人方";
  if (condition === "gojoBeforeSukuna == true") return state.flags.gojoBeforeSukuna === true;
  if (condition === "gojoAfterPlayerFirstFight == true") return state.flags.gojoAfterPlayerFirstFight === true;
  if (condition === "gojoSealFailed == true") return state.flags.gojoSealFailed === true;
  if (condition === "gojoShibuyaState unset") return !state.flags.gojoShibuyaState;
  if (condition === "kenjakuPlanState unset") return !state.flags.kenjakuPlanState;
  if (condition === "sukunaRevivalState unset") return !state.flags.sukunaRevivalState;
  if (condition === "shibuyaGojoRescueAttempt == true") return state.flags.shibuyaGojoRescueAttempt === true;
  if (condition === "gojoCanAffectSukuna == true") return canGojoAffectSukunaAfterShibuya();
  if (condition === "cullingGameCanOccur == true") return canCullingGameOccur();
  if (condition === "cullingGameCanOccur == false") return !canCullingGameOccur();
  if (condition === "sukunaCanFight == true") return canFightSukunaInShinjuku();
  if (condition === "shinjukuSukunaAltered == true") return isShinjukuSukunaAltered();
  if (condition.startsWith("sukunaRevivalState == ")) return state.flags.sukunaRevivalState === condition.slice("sukunaRevivalState == ".length);
  if (condition === "soloSukuna == true") return state.flags.soloSukuna === true;
  if (condition === "sukunaBattleUnresolved == true") return isUnresolvedBattleResult(state.flags.sukunaBattleResult) && state.flags.dead !== true && state.flags.battleFlowClosed !== true;
  if (condition === "canSecondRound == true") return state.flags.canSecondRound === true;
  if (condition === "canThirdRound == true") return state.flags.canThirdRound === true;
  if (condition === "needsSukunaBattleResult == true") return state.flags.needsSukunaBattleResult === true;
  if (condition === "sukunaBattleResult == 胜") return state.flags.sukunaBattleResult === "胜";
  if (condition === "sukunaBattleResult == 败") return state.flags.sukunaBattleResult === "败";
  if (condition === "sukunaBattleResult == 未定") return isUnresolvedBattleResult(state.flags.sukunaBattleResult);
  if (condition === "battleFlowClosed == true") return state.flags.battleFlowClosed === true;
  if (condition === "battleFlowClosed != true") return state.flags.battleFlowClosed !== true;
  if (condition === "curseLineResolved == true") return state.flags.curseLineResolved === true;
  if (condition === "curseLineResolved != true") return state.flags.curseLineResolved !== true;
  if (condition === "selfTeamOpponentRolled == true") return state.flags.selfTeamOpponentRolled === true;
  if (condition === "sukunaSideAfterDefeat == true") return state.flags.sukunaSideAfterDefeat === true;
  if (condition === "sukunaSideAfterDefeat != true") return state.flags.sukunaSideAfterDefeat !== true;
  if (condition === "sukunaSideStrategyResolved == true") return state.flags.sukunaSideStrategyResolved === true;
  if (condition === "sukunaSideWithSukunaGroup == true") return state.flags.sukunaSideWithSukunaGroup === true;
  if (condition === "sukunaSideOneWin == true") return state.flags.sukunaSideOneWin === true;
  if (condition === "hostileContributionAgainstHighSchool == true") return state.flags.hostileContributionAgainstHighSchool === true;
  if (condition === "shinjukuWarOutcome == 未定") return !state.flags.shinjukuWarOutcome;
  if (condition === "shouldRunBattleDefeatEnding == true") return shouldRunBattleDefeatEnding();
  if (condition === "sukunaSideGojoFight == true") return state.flags.sukunaSideGojoFight === true;
  if (condition === "sukunaSideGojoFight != true") return state.flags.sukunaSideGojoFight !== true;
  if (condition === "hostileToHighSchool == true") return state.flags.hostileToHighSchool === true;
  if (condition === "highSchoolDefeated != true") return state.flags.highSchoolDefeated !== true;
  if (condition === "curseAllFight == true") return state.flags.curseAllFight === true;
  if (condition === "curseVictory == true") return state.flags.curseVictory === true;
  if (condition === "wheelEmptyPerson == true") return state.flags.wheelEmptyPerson === true;
  if (condition === "appearanceMiguelEasterEgg == true") return shouldTriggerAppearanceMiguelEasterEgg();
  if (condition === "aliveAfter68 == 是") return state.flags.aliveAfter68 === true;
  if (condition === "shouldRunPostEvaluation == true") return shouldRunPostEvaluation();

  console.warn(`Unknown condition treated as false: ${condition}`);
  return false;
}

//--AI自由行动权重桥接--//
function parseAiFreeInfluence(actionText, anchorText = "") {
  const text = normalizeAiFreeText(actionText);
  const source = `${text} ${normalizeAiFreeText(anchorText)}`;
  const tags = [];
  const bias = createEmptyAiFreeBias();
  const add = (key, label, amount = 1) => {
    if (!AI_FREE_BIAS_KEYS.includes(key)) return;
    bias[key] += amount;
    const existing = tags.find((item) => item.key === key);
    if (existing) {
      existing.amount += amount;
    } else {
      tags.push({ key, label, amount });
    }
  };

  if (!text) {
    return {
      text,
      tags,
      weightBias: bias,
      summary: ""
    };
  }

  if (/对抗宿傩|反宿傩|阻止宿傩|救五条|高专|同伴|保护|救援|协助|老师|学生|虎杖|乙骨|真希|伏黑/.test(source)) {
    add("highSchool", "偏向高专/救援");
  }
  if (/帮助宿傩|加入宿傩|宿傩方|里梅|协助宿傩|诅咒之王/.test(source) && !/对抗宿傩|阻止宿傩|反宿傩/.test(source)) {
    add("sukuna", "偏向宿傩方");
  }
  if (/羂索|真人|漏瑚|花御|陀艮|咒灵方|死灭回游计划|改造人/.test(source)) {
    add("kenjaku", "偏向羂索/咒灵方");
  }
  if (/自己一队|单独行动|第三方|两不相帮|不站队|全都打一遍/.test(source)) {
    add("selfTeam", "偏向独立行动");
  }
  if (/修炼|训练|开发|学习|领悟|练习|打磨|黑闪|反转术式|领域|术式公开|束缚训练/.test(source)) {
    add("training", "强化成长/术式开发");
  }
  if (/调查|情报|侦查|潜伏|观察|分析|谈判|交涉|布局|计划|试探|残秽/.test(source)) {
    add("investigation", "重视调查/布局");
  }
  if (/保命|撤退|跑路|隐藏|避战|活下|生存|拖延|后撤|等待机会/.test(source)) {
    add("survival", "提高生存倾向");
  }
  if (/强攻|主动出击|偷袭|先手|击杀|斩杀|压制|终结|硬打|全力攻击/.test(source)) {
    add("aggression", "提高强攻倾向");
  }
  if (/束缚|契约|代价|交换条件|限制自己/.test(source)) {
    add("binding", "引入束缚倾向");
  }
  if (/治疗|救治|恢复|反转治疗|疗伤|续命/.test(source)) {
    add("healing", "提高救治/恢复倾向");
  }

  return {
    text,
    tags,
    weightBias: bias,
    summary: formatAiFreeInfluenceSummary(tags)
  };
}

function buildAiFreeInfluence(task, actionText, anchorText, parsedInfluence = null) {
  const parsed = parsedInfluence || parseAiFreeInfluence(actionText, anchorText);
  return {
    ...parsed,
    text: normalizeAiFreeText(parsed.text || actionText),
    anchorText,
    taskNodeId: task?.nodeId || "",
    taskTitle: task?.title || ""
  };
}

function buildAiFreeAssistTrace(influence, legalMainResult = "") {
  const anchorText = normalizeAiFreeText(legalMainResult || influence?.anchorText || "");
  const actionStrategy = normalizeAiFreeText(influence?.text || "");
  const topTags = getTopAiFreeInfluenceTags(influence?.tags || []);
  const remote = influence?.remoteAnalysis || {};
  const remoteUnderstanding = Array.isArray(remote.systemUnderstanding) ? remote.systemUnderstanding : [];
  const systemUnderstanding = (remoteUnderstanding.length ? remoteUnderstanding : topTags).map((item) => ({
    key: item.key,
    label: getAiFreeInfluenceDisplayName(item.key),
    amount: Number(item.amount || 0),
    display: `${getAiFreeInfluenceDisplayName(item.key)} +${trimWeight(item.amount || 1)}`,
    reason: item.reason || ""
  }));
  const futureInfluence = Array.isArray(remote.futureInfluence) && remote.futureInfluence.length
    ? remote.futureInfluence
    : topTags.map((item) => getAiFreeInfluenceExplanation(item.key));
  const expansionHooks = Array.isArray(remote.expansionHooks) ? remote.expansionHooks.slice(0, 5) : [];
  const summary = influence?.summary || formatAiFreeInfluenceSummary(topTags);
  const systemText = systemUnderstanding.length
    ? systemUnderstanding.map((item) => item.display).join("，")
    : "暂未识别出明确倾向";
  const futureText = futureInfluence.length
    ? futureInfluence.join(" ")
    : "暂无明确后续权重倾向。";
  const expansionText = expansionHooks.length ? `\n软桥接：${expansionHooks.join("；")}` : "";
  const sourceText = remote.provider ? `\n解析来源：远端 AI（${remote.provider}${remote.model ? ` / ${remote.model}` : ""}）` : "";

  return {
    mode: "AI自由辅助",
    legalMainResult: anchorText,
    actionStrategy,
    summary,
    systemUnderstanding,
    futureInfluence,
    expansionHooks,
    remoteAnalysis: remote,
    boundary: AI_FREE_BOUNDARY_TEXT,
    analysisText: `系统理解：${systemText}\n后续影响：${futureText}${expansionText}\n边界：${AI_FREE_BOUNDARY_TEXT}${sourceText}`,
    narrativeUse: "最终 AI总结应把行动策略写成角色当时的主动意图和后续倾向，但不得覆盖合法主线结果。"
  };
}

function buildAiFreeAssistTraceFromRecord(record) {
  if (record?.selectionMode !== "aiFree") return null;
  const interaction = record.aiFreeInteraction || {};
  const influence = record.aiFreeInfluence || {};
  return buildAiFreeAssistTrace({
    text: interaction.text || "",
    anchorText: interaction.anchorText || record.result || "",
    summary: interaction.summary || influence.summary || "",
    tags: influence.tags || [],
    weightBias: influence.weightBias || createEmptyAiFreeBias()
  }, interaction.anchorText || record.result || "");
}

function getTopAiFreeInfluenceTags(tags = []) {
  return (tags || [])
    .filter((item) => item && Number(item.amount || 0) > 0)
    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
    .slice(0, 5);
}

function formatAiFreeInfluenceSummary(tags = []) {
  const topTags = getTopAiFreeInfluenceTags(tags);
  if (!topTags.length) return "暂未识别出明确倾向";
  return topTags.map((item) => `${getAiFreeInfluenceDisplayName(item.key)} +${trimWeight(item.amount || 1)}`).join("，");
}

function getAiFreeInfluenceDisplayName(key) {
  const map = {
    highSchool: "高专 / 救援",
    sukuna: "宿傩倾向",
    kenjaku: "羂索 / 咒灵倾向",
    selfTeam: "独立行动",
    training: "修炼成长",
    investigation: "调查布局",
    survival: "保命撤退",
    aggression: "强攻压制",
    binding: "束缚代价",
    healing: "治疗恢复"
  };
  return map[key] || key;
}

function getAiFreeInfluenceExplanation(key) {
  const map = {
    highSchool: "后续更容易出现高专、救援、保护同伴、对抗宿傩相关结果。",
    sukuna: "后续更容易出现宿傩、里梅、诅咒侧或危险同盟相关结果。",
    kenjaku: "后续更容易出现羂索、咒灵方、死灭回游计划相关结果。",
    selfTeam: "后续更容易出现独立行动、第三方路线、非阵营化选择。",
    training: "后续更容易出现修炼、术式开发、咒具、领域或成长类结果。",
    investigation: "后续更容易出现侦查、情报、计划、谈判、布局类结果。",
    survival: "后续更容易出现撤退、隐藏、支援、规避死亡、延后交战类结果。",
    aggression: "后续更容易出现主动出击、压制、击败、削弱敌人的结果。",
    binding: "后续更容易出现束缚、代价、交换条件、限制自身换取收益的结果。",
    healing: "后续更容易出现治疗、恢复、救治、续命类结果。"
  };
  return map[key] || "该倾向会影响后续候选项权重。";
}

function renderAiFreeAnalysisPreview(influence, meta = {}) {
  const text = normalizeAiFreeText(influence?.text || "");
  const topTags = getTopAiFreeInfluenceTags(influence?.tags || []);
  const remote = influence?.remoteAnalysis || {};
  const titleStatus = meta.status === "remote" && remote.provider
    ? `<span class="ai-free-analysis-status">远端 AI：${escapeHtml(remote.provider)}${remote.model ? ` / ${escapeHtml(remote.model)}` : ""}</span>`
    : meta.status === "loading"
      ? `<span class="ai-free-analysis-status">正在连接远端 AI</span>`
      : meta.status === "error"
        ? `<span class="ai-free-analysis-status error-text">远端解析不可用</span>`
        : "";
  if (!text) {
    return `
      <div class="ai-free-analysis-title">AI解析${titleStatus}</div>
      <p class="ai-free-analysis-empty">填写行动策略后，系统会显示它将如何影响后续剧情。</p>
    `;
  }
  if (meta.status === "loading") {
    return `
      <div class="ai-free-analysis-title">AI解析${titleStatus}</div>
      <p class="ai-free-analysis-empty">正在把行动策略发送到远端 AI；解析完成前不会用本地关键词决定后续倾向。</p>
      <div class="ai-free-analysis-block">
        <strong>边界</strong>
        <p class="ai-free-boundary-note">${escapeHtml(AI_FREE_BOUNDARY_TEXT)}</p>
      </div>
    `;
  }
  if (meta.status === "error") {
    return `
      <div class="ai-free-analysis-title">AI解析${titleStatus}</div>
      <div class="ai-free-analysis-block">
        <strong>系统理解</strong>
        <p class="ai-free-analysis-empty">${escapeHtml(meta.message || "远端 AI 解析失败。")}</p>
      </div>
      <div class="ai-free-analysis-block">
        <strong>后续影响</strong>
        <p class="ai-free-analysis-empty">未取得远端解析结果，本次不会把本地关键词结果当作 AI解析写入流程。</p>
      </div>
      <div class="ai-free-analysis-block">
        <strong>边界</strong>
        <p class="ai-free-boundary-note">${escapeHtml(AI_FREE_BOUNDARY_TEXT)}</p>
      </div>
    `;
  }
  if (!topTags.length) {
    return `
      <div class="ai-free-analysis-title">AI解析${titleStatus}</div>
      <div class="ai-free-analysis-block">
        <strong>系统理解</strong>
        <p class="ai-free-analysis-empty">远端 AI 暂未识别出明确倾向；可补充你的目标、风险处理、资源使用和收束方式。</p>
      </div>
      <div class="ai-free-analysis-block">
        <strong>后续影响</strong>
        <p class="ai-free-analysis-empty">暂无明确后续权重倾向。</p>
      </div>
      <div class="ai-free-analysis-block">
        <strong>边界</strong>
        <p class="ai-free-boundary-note">${escapeHtml(AI_FREE_BOUNDARY_TEXT)}</p>
      </div>
    `;
  }
  const understanding = Array.isArray(remote.systemUnderstanding) && remote.systemUnderstanding.length
    ? remote.systemUnderstanding.slice(0, 5)
    : topTags;
  const futureInfluence = Array.isArray(remote.futureInfluence) && remote.futureInfluence.length
    ? remote.futureInfluence.slice(0, 5)
    : topTags.map((item) => getAiFreeInfluenceExplanation(item.key));
  const expansionHooks = Array.isArray(remote.expansionHooks) ? remote.expansionHooks.slice(0, 4) : [];
  return `
    <div class="ai-free-analysis-title">AI解析${titleStatus}</div>
    <div class="ai-free-analysis-block">
      <strong>系统理解</strong>
      <ul class="ai-free-analysis-list">
        ${understanding.map((item) => `<li>${escapeHtml(getAiFreeInfluenceDisplayName(item.key))} +${escapeHtml(trimWeight(item.amount || 1))}${item.reason ? `：${escapeHtml(item.reason)}` : ""}</li>`).join("")}
      </ul>
    </div>
    <div class="ai-free-analysis-block">
      <strong>后续影响</strong>
      <ul class="ai-free-analysis-list">
        ${futureInfluence.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </div>
    ${expansionHooks.length ? `
      <div class="ai-free-analysis-block">
        <strong>软桥接钩子</strong>
        <ul class="ai-free-analysis-list">
          ${expansionHooks.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </div>
    ` : ""}
    <div class="ai-free-analysis-block">
      <strong>边界</strong>
      <p class="ai-free-boundary-note">${escapeHtml(AI_FREE_BOUNDARY_TEXT)}</p>
    </div>
  `;
}

function applyAiFreeInfluence(task, result, recordId) {
  const influence = result?.aiFreeInfluence;
  if (!influence) return;
  if (!Array.isArray(state.flags.aiFreeInfluences)) state.flags.aiFreeInfluences = [];
  if (!Array.isArray(state.flags.aiFreeAssistTimeline)) state.flags.aiFreeAssistTimeline = [];
  const aiFreeAssistTrace = result.aiFreeAssistTrace || buildAiFreeAssistTrace(influence, influence.anchorText || result.text || "");
  state.flags.aiFreeModeUsed = true;
  state.flags.aiFreeInteractionCount = Number(state.flags.aiFreeInteractionCount || 0) + 1;
  state.flags.aiFreeLastInfluence = influence.summary;
  state.flags.aiFreeInfluences.push({
    recordId,
    nodeId: task?.nodeId || "",
    title: task?.title || "",
    anchorText: influence.anchorText || result.text || "",
    text: influence.text,
    summary: influence.summary,
    tags: influence.tags,
    analysis: aiFreeAssistTrace
  });
  if (state.flags.aiFreeInfluences.length > 30) state.flags.aiFreeInfluences.shift();
  state.flags.aiFreeAssistTimeline.push({
    recordId,
    nodeId: task?.nodeId || "",
    title: task?.title || "",
    stage: task?.stage || "",
    result: result.text || "",
    trace: aiFreeAssistTrace
  });
  if (state.flags.aiFreeAssistTimeline.length > 30) state.flags.aiFreeAssistTimeline.shift();

  const mergedBias = {
    ...createEmptyAiFreeBias(),
    ...(state.flags.aiFreeWeightBias || {})
  };
  for (const [key, value] of Object.entries(influence.weightBias || {})) {
    if (!AI_FREE_BIAS_KEYS.includes(key)) continue;
    mergedBias[key] = clamp(Number(mergedBias[key] || 0) + Number(value || 0), 0, 6);
  }
  state.flags.aiFreeWeightBias = mergedBias;

  if (mergedBias.training > 0 || mergedBias.investigation > 0) {
    state.flags.hiddenStrengthEligibleEvent = true;
  }
  if (mergedBias.highSchool > 0 && !state.flags.factionLocked) {
    state.flags.aiFreeFactionHint = "高专方";
  } else if (mergedBias.sukuna > 0 && !state.flags.factionLocked) {
    state.flags.aiFreeFactionHint = "宿傩方";
  } else if (mergedBias.kenjaku > 0 && !state.flags.factionLocked) {
    state.flags.aiFreeFactionHint = "羂索方";
  } else if (mergedBias.selfTeam > 0 && !state.flags.factionLocked) {
    state.flags.aiFreeFactionHint = "自己一队";
  }
}

function enqueueAiFreeBridgeTasks(sourceTask, result, parentRecordId) {
  if (!shouldEnqueueAiFreeBridgeTasks(sourceTask, result)) return;
  const influence = result.aiFreeInfluence || parseAiFreeInfluence(result.aiFreeInteraction?.text || "", result.aiFreeInteraction?.anchorText || result.text || "");
  const trace = result.aiFreeAssistTrace || buildAiFreeAssistTrace(influence, result.aiFreeInteraction?.anchorText || result.text || "");
  const tasks = buildAiFreeBridgeTasks(sourceTask, result, parentRecordId, trace).slice(0, AI_FREE_BRIDGE_TASK_LIMIT);
  if (!tasks.length) return;
  state.flags.aiFreeBridgeQueuedCount = Number(state.flags.aiFreeBridgeQueuedCount || 0) + tasks.length;
  state.taskQueue.unshift(...tasks);
}

function shouldEnqueueAiFreeBridgeTasks(task, result) {
  if (!state.aiFreeEnabled) return false;
  if (!task || task.aiFreeBridge === true) return false;
  if (result?.selectionMode !== "aiFree") return false;
  if (state.flags.dead || state.flags.finalSequenceStarted || state.flags.easterEggFinalSequenceStarted) return false;
  if (!result.aiFreeInteraction?.text) return false;
  return isAiFreeBridgeEligibleTask(task);
}

function isAiFreeBridgeEligibleTask(task) {
  const nodeId = String(task?.nodeId || "");
  if (AI_FREE_BRIDGE_BLOCKED_NODE_IDS.has(nodeId)) return false;
  if (isBaseAttributeTask(task)) return false;
  const descriptor = `${task?.stage || ""} ${task?.title || ""} ${nodeId}`;
  if (/基础生成|人设|能力生成|隐藏强度|评级|术式|咒具|领域|高级技巧/.test(descriptor)) return false;
  return isStoryOutcomeTask(task) ||
    /剧情|战|结果|结局|后|是否参加|涩谷|死灭|新宿|百鬼|理子|天元|高专|宿傩|羂索|咒灵|回游/.test(descriptor);
}

function buildAiFreeBridgeTasks(sourceTask, result, parentRecordId, trace) {
  const sourceTitle = sourceTask?.title || "当前主线";
  return [
    {
      type: "wheel",
      aiFreeBridge: true,
      nodeId: `aiFreeBridge-${parentRecordId}-strategy`,
      title: "AI辅助桥接：行动展开",
      stage: "AI辅助扩展",
      why: `承接「${sourceTitle}」的行动策略；本节点只扩展过程，之后自动回到主线。`,
      parentRecordId,
      options: buildAiFreeBridgeStrategyOptions(trace)
    },
    {
      type: "wheel",
      aiFreeBridge: true,
      nodeId: `aiFreeBridge-${parentRecordId}-consequence`,
      title: "AI辅助桥接：代价与收束",
      stage: "AI辅助扩展",
      why: "将行动展开收束为软收益或软代价，不直接改写正式剧情结果。",
      parentRecordId,
      options: buildAiFreeBridgeConsequenceOptions(trace)
    }
  ];
}

function buildAiFreeBridgeStrategyOptions(trace) {
  const ledger = buildAiCapabilityLedger();
  const techniqueAction = ledger.hasInnateTechnique
    ? "整理术式理解、咒力运转与可用资源，为后续行动做准备。"
    : ledger.zeroCursedEnergy
      ? "整理体术、感官、地形与咒具携带，不把行动写成术式发动。"
      : "整理咒力基础、体术节奏与撤退路线，不凭空获得新术式。";
  const attackAction = ledger.hasInnateTechnique
    ? "以已确认的术式、体术或咒具抢先打断敌方节奏。"
    : "以体术、站位或已确认咒具抢先打断敌方节奏。";
  return [
    ...buildAiFreeRemoteBridgeHookOptions(trace, "strategy"),
    aiFreeBridgeOption("侦查情报：观察咒力残秽、地形与敌方意图，暂不改写当前结果。", ["investigation"], "strategy", trace),
    aiFreeBridgeOption("保护支援：把行动重心放在同伴、普通人或撤离路线的安全上。", ["highSchool", "survival", "healing"], "strategy", trace),
    aiFreeBridgeOption(`修炼准备：${techniqueAction}`, ["training"], "strategy", trace),
    aiFreeBridgeOption("保命撤退：优先保存战力，寻找可回到主线的安全窗口。", ["survival"], "strategy", trace),
    aiFreeBridgeOption(`强攻压制：${attackAction}`, ["aggression"], "strategy", trace),
    aiFreeBridgeOption("束缚交换：用明确代价换取短期收益，但不直接改写胜负。", ["binding"], "strategy", trace),
    aiFreeBridgeOption("低调收束：不额外扩大行动，保存当前正式结果并回到主线。", [], "strategy", trace, 0.82)
  ];
}

function buildAiFreeBridgeConsequenceOptions(trace) {
  return [
    ...buildAiFreeRemoteBridgeHookOptions(trace, "consequence"),
    aiFreeBridgeOption("情报兑现：掌握一条可用情报，但暴露了部分行动意图。", ["investigation"], "consequence", trace),
    aiFreeBridgeOption("支援兑现：成功稳住一个保护目标，但自身状态有所消耗。", ["highSchool", "survival", "healing"], "consequence", trace),
    aiFreeBridgeOption("准备兑现：战前准备生效，但咒力、体力或时间被消耗。", ["training"], "consequence", trace),
    aiFreeBridgeOption("压制兑现：短暂打乱敌方节奏，但引来下一轮反击压力。", ["aggression"], "consequence", trace),
    aiFreeBridgeOption("代价兑现：束缚或交换条件生效，后续行动受到限制。", ["binding"], "consequence", trace),
    aiFreeBridgeOption("安全收束：没有额外收益，也没有扩大风险，流程回到主线。", [], "consequence", trace, 0.78)
  ];
}

function buildAiFreeRemoteBridgeHookOptions(trace, phase) {
  const hooks = (trace?.expansionHooks || []).map((item) => normalizeAiFreeText(item)).filter(Boolean).slice(0, 3);
  if (!hooks.length) return [];
  const traceTags = getTopAiFreeInfluenceTags(trace?.systemUnderstanding || []).map((item) => item.key);
  const tags = traceTags.length ? traceTags.slice(0, 3) : ["investigation"];
  return hooks.map((hook, index) => {
    const prefix = phase === "consequence" ? "AI收束建议" : "AI过程建议";
    return aiFreeBridgeOption(`${prefix}：${hook}`, tags, phase, trace, 1.18 - index * 0.08);
  });
}

function aiFreeBridgeOption(text, tags, phase, trace, baseWeight = 1) {
  return {
    text,
    weight: getAiFreeBridgeOptionWeight(tags, trace, baseWeight),
    aiFreeBridge: {
      phase,
      tags
    }
  };
}

function getAiFreeBridgeOptionWeight(tags = [], trace = null, baseWeight = 1) {
  let weight = Number(baseWeight) || 1;
  const traceTags = new Map((trace?.systemUnderstanding || []).map((item) => [item.key, Number(item.amount || 0)]));
  const bias = state.flags.aiFreeWeightBias || {};
  for (const tag of tags) {
    const traceAmount = Number(traceTags.get(tag) || 0);
    const storedAmount = Number(bias[tag] || 0);
    if (traceAmount > 0) weight *= 1 + Math.min(1.2, traceAmount * 0.55);
    else if (storedAmount > 0) weight *= 1 + Math.min(0.7, storedAmount * 0.12);
  }
  return Number(clamp(weight, 0.12, 6).toFixed(4));
}

function applyAiFreeBridgeResult(task, result, recordId) {
  if (task?.aiFreeBridge !== true || !result?.aiFreeBridge) return;
  if (!Array.isArray(state.flags.aiFreeBridgeEvents)) state.flags.aiFreeBridgeEvents = [];
  if (!Array.isArray(state.flags.selfCombatStatusTexts)) state.flags.selfCombatStatusTexts = [];
  const tags = (result.aiFreeBridge.tags || []).filter((tag) => AI_FREE_BIAS_KEYS.includes(tag));
  const event = {
    recordId,
    parentRecordId: task.parentRecordId || null,
    nodeId: task.nodeId || "",
    title: task.title || "",
    phase: result.aiFreeBridge.phase || "",
    result: result.text || "",
    tags,
    boundary: "桥接节点只提供软过程、软代价和后续倾向，不直接改写当前正式结果。"
  };
  state.flags.aiFreeBridgeEvents.push(event);
  if (state.flags.aiFreeBridgeEvents.length > 40) state.flags.aiFreeBridgeEvents.shift();
  state.flags.selfCombatStatusTexts.push(result.text || "");
  if (state.flags.selfCombatStatusTexts.length > 12) state.flags.selfCombatStatusTexts.shift();

  if (tags.includes("training") || tags.includes("investigation")) {
    state.flags.hiddenStrengthEligibleEvent = true;
  }
  const mergedBias = {
    ...createEmptyAiFreeBias(),
    ...(state.flags.aiFreeWeightBias || {})
  };
  for (const tag of tags) {
    mergedBias[tag] = clamp(Number(mergedBias[tag] || 0) + 0.45, 0, 6);
  }
  state.flags.aiFreeWeightBias = mergedBias;
}

//--抽取执行、流程标记与权重计算--//
async function drawCurrent() {
  const task = state.currentTask;
  if (!task || state.isSpinning) return;

  if (task.type === "choice") {
    drawChoiceTask(task);
    return;
  }

  if (task.type === "computed") {
    drawComputedTask(task);
    return;
  }

  if (task.type !== "wheel" && task.type !== "multiDraw") return;

  state.isSpinning = true;
  state.pendingResult = null;
  state.spinToken += 1;
  stopResultSpeech();
  const token = state.spinToken;
  const modeSnapshot = beginSpinModeSnapshot(token);
  els.drawBtn.disabled = true;
  els.drawBtn.textContent = "旋转中";

  if (task.type === "multiDraw") {
    await drawMultipleWithAnimations(task, token);
    return;
  }

  if (!(await waitForWheelPreDelay(token))) return;

  const durationMs = getSpinDurationMs();
  const result = drawOne(task);
  state.pendingResult = result;
  const selectedIndexes = getPendingResultIndexes(state.pendingResult);
  const audioContext = await primeWheelAudio();
  if (token !== state.spinToken) return;
  spinWheel(selectedIndexes[0] ?? 0, durationMs);
  playSpinSound(durationMs, audioContext);

  window.setTimeout(() => {
    if (token !== state.spinToken) return;
    state.isSpinning = false;
    const waitForAiFreeStrategy = shouldWaitForAiFreeStrategy(task, state.pendingResult, modeSnapshot);
    showResult(state.pendingResult.text, selectedIndexes, {
      note: waitForAiFreeStrategy
        ? "AI辅助已开启：抽取结果已固定，请填写或点击快速策略后确认。"
        : undefined
    });
    if (waitForAiFreeStrategy) {
      showAiFreePostDrawPanel(task, state.pendingResult, token, modeSnapshot);
      return;
    }
    window.setTimeout(() => {
      if (token !== state.spinToken) return;
      acceptAndAdvance();
    }, getResultHoldMs());
  }, durationMs);
}

function drawChoiceTask(task) {
  const result = getAutoResultForTask(task);
  if (!result) return;
  chooseChoiceOption(task, result.index, { result, label: "随机选择结果" });
}

function drawComputedTask(task) {
  if (!task || state.isSpinning) return;
  const result = getAutoResultForTask(task);
  if (!result) return;

  state.isSpinning = true;
  state.pendingResult = result;
  state.spinToken += 1;
  stopResultSpeech();
  const token = state.spinToken;
  beginSpinModeSnapshot(token);
  els.drawBtn.disabled = true;
  els.drawBtn.textContent = "已判定";
  showResult(result.text, [result.index ?? 0], { label: "判定结果" });

  window.setTimeout(() => {
    if (token !== state.spinToken) return;
    state.isSpinning = false;
    acceptAndAdvance();
  }, getChoiceDelayMs());
}

function chooseChoiceOption(task, index, options = {}) {
  if (!task || state.isSpinning) return;
  const option = options.result?.option || task.options[index];
  if (!option) return;

  state.isSpinning = true;
  state.pendingResult = options.result || {
    text: option.text,
    option,
    index,
    weight: 1
  };
  state.spinToken += 1;
  stopResultSpeech();
  const token = state.spinToken;
  beginSpinModeSnapshot(token);
  els.drawBtn.disabled = true;
  els.drawBtn.textContent = "已选择";
  els.wheelArea.querySelectorAll("[data-choice]").forEach((button) => {
    button.disabled = true;
    button.classList.toggle("selected", Number(button.dataset.choice) === index);
  });
  showResult(state.pendingResult.text, [index], { label: options.label || "选择结果" });

  window.setTimeout(() => {
    if (token !== state.spinToken) return;
    state.isSpinning = false;
    acceptAndAdvance();
  }, options.delayMs ?? getChoiceDelayMs());
}

async function drawMultipleWithAnimations(task, token) {
  const requestedCount = getCountFrom(task.countFrom);
  const wheel = getTaskWheel(task);
  const available = getWeightedOptions(wheel, task).filter((item) => Number(item.weight) > 0);
  const preventRepeat = task.noRepeatScope === "singlePool";
  const maxCount = task.nodeId === "advancedTechniques"
    ? requestedCount
    : preventRepeat ? Math.min(requestedCount, available.length) : requestedCount;
  const excluded = new Set();
  const results = [];

  if (maxCount <= 0) {
    state.pendingResult = { text: "无", results, count: 0, requestedCount };
    state.isSpinning = false;
    showResult("无", [], { accumulatedTexts: [], currentStep: 0, totalSteps: 0 });
    await waitMs(getResultHoldMs());
    if (token === state.spinToken) acceptAndAdvance();
    return;
  }

  for (let step = 0; step < maxCount; step += 1) {
    if (token !== state.spinToken) return;
    const context = task.nodeId === "advancedTechniques"
      ? { selectedAdvancedTechniques: results.map((item) => item.text) }
      : {};
    if (task.nodeId === "advancedTechniques") {
      els.wheelArea.innerHTML = `${buildWheelMarkup(wheel, task, context)}<div id="resultCard"></div>`;
    }
    const result = drawOne(task, preventRepeat ? excluded : new Set(), context);
    if (!result) break;

    results.push(result);
    if (preventRepeat) excluded.add(result.text);

    if (!(await waitForWheelPreDelay(token, `等待中 ${step + 1}/${maxCount}`))) return;

    const durationMs = getSpinDurationMs();
    els.drawBtn.textContent = `旋转中 ${step + 1}/${maxCount}`;
    const audioContext = await primeWheelAudio();
    if (token !== state.spinToken) return;
    spinWheel(result.index, durationMs, context);
    playSpinSound(durationMs, audioContext);
    await waitMs(durationMs);

    if (token !== state.spinToken) return;
    showResult(result.text, [result.index], {
      accumulatedTexts: results.map((item) => item.text),
      currentStep: step + 1,
      totalSteps: maxCount
    });

    await waitMs(getResultHoldMs());
  }

  if (token !== state.spinToken) return;
  state.pendingResult = {
    text: results.length ? results.map((item) => item.text).join("；") : "无",
    results,
    count: results.length,
    requestedCount
  };
  state.isSpinning = false;
  acceptAndAdvance();
}

function getSpinDurationMs() {
  return isWheelAnimationEnabled() ? getWheelSettingNumber("spinDurationMs") : 0;
}

async function waitForWheelPreDelay(token, label = "等待中") {
  const delayMs = getPreDelayMs();
  if (delayMs <= 0) return token === state.spinToken;
  els.drawBtn.textContent = label;
  await waitMs(delayMs);
  return token === state.spinToken;
}

function waitMs(durationMs) {
  return new Promise((resolve) => window.setTimeout(resolve, durationMs));
}

function showResult(text, indexes, details = {}) {
  els.wheelArea.querySelectorAll(".wheel-label").forEach((row) => {
    row.classList.toggle("selected", indexes.includes(Number(row.dataset.optionIndex)));
  });
  els.wheelArea.querySelectorAll(".wheel-slice").forEach((slice) => {
    slice.classList.toggle("selected", indexes.includes(Number(slice.dataset.optionIndex)));
  });
  const card = els.wheelArea.querySelector("#resultCard");
  const currentLabel = details.totalSteps
    ? `第 ${details.currentStep}/${details.totalSteps} 次结果`
    : details.label || "抽取结果";
  const note = details.note || (details.totalSteps && details.currentStep < details.totalSteps
    ? "已记录本次结果，继续抽取下一次。"
    : "已记录，自动进入下一步。");
  const accumulated = details.accumulatedTexts?.length
    ? `
      <div class="result-accumulated">
        <span>目前已抽到</span>
        <ol>
          ${details.accumulatedTexts.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ol>
      </div>
    `
    : "";
  const runProfile = getRunProfile();
  const runMark = runProfile.type === "activationCustom"
    ? `<div class="custom-run-mark">${escapeHtml(runProfile.disclosure)}</div>`
    : "";
  card.innerHTML = `
    <div class="result-card ${runProfile.type === "activationCustom" ? "custom-run-result" : ""}">
      <strong>${escapeHtml(currentLabel)}</strong>
      ${runMark}
      <span>${formatRichText(text)}</span>
      ${accumulated}
      <small>${escapeHtml(note)}</small>
    </div>
  `;
  speakResult(text, details);
}

function runAllDebug() {
  if (!state.debugMode || !state.currentTask) return;

  incrementUsageStat("debugRunAll");
  state.spinToken += 1;
  stopResultSpeech();
  state.isSpinning = false;
  clearSpinModeSnapshot();
  state.pendingResult = null;

  let steps = 0;
  const maxSteps = 1000;

  while (state.currentTask?.type !== "end" && steps < maxSteps) {
    const result = getAutoResultForTask(state.currentTask);
    if (!result) break;
    state.pendingResult = result;
    acceptAndAdvance({ render: false });
    steps += 1;
  }

  if (steps >= maxSteps) {
    state.records.push({
      id: ++state.recordSeq,
      title: "自动跑完整流程",
      stage: "调试",
      result: "已中止",
      why: `超过 ${maxSteps} 步，疑似流程循环。`,
      skipped: true
    });
  }

  saveLifeWheelRunDraft();
  renderAll();
}

function getAutoResultForTask(task) {
  if (task.type === "choice") {
    const forced = consumeDebugForcedOption(task);
    const index = forced?.index ?? Math.floor(Math.random() * task.options.length);
    const option = forced || task.options[index];
    return {
      text: option.text,
      option,
      index,
      weight: 1
    };
  }

  if (task.type === "computed") {
    const option = task.computedOption || task.options?.[0];
    if (!option) return null;
    return {
      ...option,
      text: option.text,
      index: option.index ?? 0,
      weight: 1,
      selectionMode: "computed"
    };
  }

  if (task.type === "multiDraw") {
    const count = getCountFrom(task.countFrom);
    const results = drawMultiple(task, count);
    return {
      text: results.length ? results.map((item) => item.text).join("；") : "无",
      results,
      count
    };
  }

  if (task.type === "wheel") {
    return drawOne(task);
  }

  return null;
}

function acceptAndAdvance(options = {}) {
  const task = state.currentTask;
  const result = state.pendingResult;
  if (!task || !result) return;
  clearSpinModeSnapshot();

  const backtrackSnapshot = captureBacktrackSnapshot();
  const recordId = ++state.recordSeq;
  const text = result.text;
  const optionsSnapshot = createOptionsSnapshot(task, result);
  const optionEffectTrace = getOptionEffectTrace(task, text);
  state.answers[task.nodeId] = result;
  state.flags.lastResultText = text;
  incrementUsageStat("draws");

  if (task.type === "choice" && result.option?.next === "easterEggPool") {
    state.flags.enteredEasterEgg = true;
    enqueueEasterEggSubflow();
  }

  updateFlags(task, text, result, optionEffectTrace);
  applyAiFreeInfluence(task, result, recordId);
  applyAiFreeBridgeResult(task, result, recordId);
  const aiFreeAssistTrace = result.aiFreeAssistTrace || (result.aiFreeInfluence
    ? buildAiFreeAssistTrace(result.aiFreeInfluence, result.aiFreeInteraction?.anchorText || text)
    : null);
  const aiFreeBridge = result.aiFreeBridge || null;

  state.backtrackSnapshots.push({
    recordId,
    snapshot: backtrackSnapshot
  });

  state.records.push({
    id: recordId,
    nodeId: task.nodeId,
    title: task.title,
    stage: task.stage,
    result: text,
    why: task.why,
    type: task.type,
    runType: getRunProfile().type,
    runLabel: getRunProfile().publicLabel,
    aiFreeEnabled: state.aiFreeEnabled,
    customRunMeta: getActivationCustomRunMeta(),
    selectionMode: result.selectionMode || "random",
    aiFreeInteraction: result.aiFreeInteraction || null,
    aiFreeInfluence: result.aiFreeInfluence ? {
      summary: result.aiFreeInfluence.summary,
      tags: result.aiFreeInfluence.tags,
      weightBias: result.aiFreeInfluence.weightBias
    } : null,
    aiFreeAssistTrace,
    aiFreeBridge,
    optionEffects: optionEffectTrace,
    optionsSnapshot
  });

  enqueueAiFreeBridgeTasks(task, result, recordId);

  advanceToNextTask();
  saveLifeWheelRunDraft();
  if (options.render !== false) renderAll();
}

function captureBacktrackSnapshot() {
  return callSiteModuleImplementation("JJKLifeWheelState", "createBacktrackSnapshotData", [state]);
}

function backtrackToRecord(recordId) {
  if (!state.debugMode) return;
  const entry = state.backtrackSnapshots.find((item) => item.recordId === recordId);
  if (!entry) return;

  state.spinToken += 1;
  stopResultSpeech();
  state.isSpinning = false;
  clearSpinModeSnapshot();
  state.pendingResult = null;
  restoreBacktrackSnapshot(entry.snapshot);
  renderAll();
  saveLifeWheelRunDraft();
}

function restoreBacktrackSnapshot(snapshot) {
  state.mainIndex = snapshot.mainIndex;
  state.taskQueue = clonePlain(snapshot.taskQueue);
  state.currentTask = clonePlain(snapshot.currentTask);
  state.records = clonePlain(snapshot.records);
  state.recordSeq = snapshot.recordSeq;
  state.answers = clonePlain(snapshot.answers);
  state.flags = restoreFlags(snapshot.flags);
  state.backtrackSnapshots = state.backtrackSnapshots.filter((item) => item.recordId <= snapshot.recordSeq);
}

function clonePlain(value) {
  if (value == null) return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function serializeFlags(flags) {
  return callSiteModuleImplementation("JJKLifeWheelState", "serializeFlags", [flags]);
}

function restoreFlags(flags) {
  const initial = createInitialFlowFlags();
  const restored = {
    ...initial,
    ...clonePlain(flags || {})
  };
  if (!restored.aiFreeWeightBias) restored.aiFreeWeightBias = createEmptyAiFreeBias();
  return {
    ...restored,
    skipPeriods: new Set(flags?.skipPeriods || [])
  };
}

function isSimuriaLocation(text = "") {
  return /[西希]姆利亚星/.test(String(text || ""));
}

function getGrantedSpecialTalents() {
  return Array.isArray(state.flags.grantedSpecialTalents)
    ? state.flags.grantedSpecialTalents
    : [];
}

function addGrantedSpecialTalent(text) {
  const value = String(text || "").trim();
  if (!value) return;
  const talents = getGrantedSpecialTalents();
  if (!talents.includes(value)) talents.push(value);
  state.flags.grantedSpecialTalents = talents;
  const current = String(state.flags.specialTalent || "")
    .split("；")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!current.includes(value)) current.push(value);
  state.flags.specialTalent = current.join("；");
}

function mergeSpecialTalentText(text) {
  const values = [
    ...getGrantedSpecialTalents(),
    ...String(text || "").split("；")
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  return [...new Set(values)].join("；");
}

function setInnateTechniqueFlags(text, rawText = text) {
  state.flags.innateTechnique = text;
  state.flags.innateTechniqueRaw = rawText;
  if (text.includes("十种影法术")) state.flags.tenShadows = true;
  if (text.includes("禅院") || text.includes("投射咒法") || text.includes("十种影法术")) {
    state.flags.zeninFamily = true;
  }
}

function updateFlags(task, text, result, optionEffectTrace = null) {
  applyOptionEffects(task, text, optionEffectTrace);
  markDirectSukunaCombatEntry(task);

  switch (task.nodeId) {
    case "identity":
      state.flags.identity = text;
      if (text === "咒术高层") {
        enterJujutsuCouncil("legacy-identity");
      }
      break;
    case "greatFamilyGate":
      state.flags.greatFamilyGate = text;
      state.flags.isGreatFamily = text === "是";
      break;
    case "greatFamily":
      state.flags.greatFamily = text;
      state.flags.gojoFamily = text.includes("五条");
      state.flags.kamoFamily = text.includes("加茂");
      state.flags.zeninFamily = text.includes("禅院");
      break;
    case "greatFamilyStatus":
      state.flags.greatFamilyStatus = text;
      state.flags.greatFamilyExiled = text.includes("被逐出家门");
      break;
    case "familyTechniqueInheritance":
      state.flags.familyTechniqueInheritance = text;
      state.flags.familyInheritedTechnique = text === "是";
      if (state.flags.familyInheritedTechnique) {
        state.flags.hasTechnique = "是";
      }
      break;
    case "familyInnateTechnique":
      setInnateTechniqueFlags(text, result.rawText || text);
      state.flags.familyInnateTechnique = text;
      break;
    case "jujutsuCouncilGate":
      state.flags.jujutsuCouncilGate = text;
      if (text === "是") {
        enterJujutsuCouncil("W178-O1");
      }
      break;
    case "startTime":
      state.flags.startTime = text;
      if (getStartPeriod() === "after68") {
        state.flags.aliveAfter68 = true;
      }
      break;
    case "location":
      state.flags.location = text;
      if (isSimuriaLocation(text)) {
        state.flags.isAlien = true;
        state.flags.identityOverride = "希姆利亚星人";
      }
      break;
    case "simuriaSpecies":
      state.flags.simuriaSpecies = text;
      if (text === "卡利亚") {
        state.flags.identityOverride = "卡利亚";
        addGrantedSpecialTalent("不灭兽性");
      }
      if (text === "塞姆利亚人") {
        state.flags.identityOverride = "塞姆利亚人";
        state.flags.hasTechnique = "是";
      }
      break;
    case "deskunteHighBlood":
      state.flags.deskunteHighBlood = text === "是";
      if (state.flags.simuriaSpecies === "塞姆利亚人") {
        addGrantedSpecialTalent("第三眼与塞姆利亚咒能适性");
        state.flags.hasTechnique = "是";
      }
      if (text === "是") {
        addGrantedSpecialTalent("德斯昆特血脉：杀意具现适性");
        setInnateTechniqueFlags("光 / 具象化杀意");
        state.flags.innateTechniqueLocked = true;
        state.flags.innateTechniqueLockReason = "德斯昆特高阶血脉";
      }
      if (text === "否") {
        state.flags.simuriaTechniqueWeightBoost = true;
      }
      break;
    case "curseUserOrganization":
      state.flags.curseUserOrganization = text;
      setCurseUserOrganizationBranchFlags(text);
      break;
    case "undergroundCasinoRole":
      state.flags.undergroundCasinoRole = text;
      break;
    case "gender":
      state.flags.gender = text;
      break;
    case "genderIdentity":
      state.flags.genderIdentity = text;
      break;
    case "appearance":
      state.flags.appearance = text;
      state.flags.appearanceRank = parseRank(text);
      break;
    case "occupation":
      state.flags.occupation = text;
      break;
    case "culture":
      state.flags.culture = text;
      break;
    case "hobby":
      state.flags.hobby = text;
      break;
    case "assets":
      state.flags.assets = text;
      break;
    case "personality":
      state.flags.personality = text;
      state.flags.personalityTechniqueModifier = getPersonalityTechniqueModifier(text);
      break;
    case "luck":
      state.flags.luck = text;
      break;
    case "innateTechnique":
      setInnateTechniqueFlags(text, result.rawText || text);
      break;
    case "talent":
      state.flags.talentRank = parseRank(text);
      state.flags.highTalent = rankValue(state.flags.talentRank) >= rankValue("A");
      break;
    case "cursedEnergyNature":
      state.flags.cursedEnergyNature = text;
      break;
    case "cursedEnergyColor":
      state.flags.cursedEnergyColor = text;
      break;
    case "bindingProfileGate":
      state.flags.bindingProfileGate = text;
      state.flags.hasBindingProfile = text === "是";
      if (text !== "是") {
        state.flags.bindingCount = 0;
        state.flags.bindingCountText = "无";
        state.flags.sweetPreference = "";
      }
      break;
    case "bindingCount":
      state.flags.bindingCount = getNumberFromText(text);
      state.flags.bindingCountText = text;
      break;
    case "sweetPreference":
      state.flags.sweetPreference = text;
      break;
    case "effortLevel":
      state.flags.effortLevel = text;
      state.flags.effortEffects = createEffortEffects(text);
      state.flags.effortEffectText = describeEffortEffects(state.flags.effortEffects);
      break;
    case "grade":
      state.flags.sorcererGrade = mapGrade(text);
      state.flags.sorcererGradeLabel = gradeLabel(state.flags.sorcererGrade);
      state.flags.gradeEffectiveScore = task.computedGrade?.score ?? buildStrengthSnapshot()?.gradeEffectiveScore ?? null;
      break;
    case "advancedTechniqueCount": {
      const baseCount = getNumberFromText(text);
      state.flags.advancedTechniqueBaseCount = baseCount;
      state.flags.advancedTechniqueCount = getAdjustedCountFrom("advancedTechniqueCount", baseCount);
      break;
    }
    case "advancedTechniques":
      state.flags.advancedTechniques = result.results?.map((item) => item.text) || [text];
      break;
    case "domainCompletion":
      state.flags.domainCompletion = text;
      state.flags.domainIncomplete = text === "未完成领域";
      state.flags.domainOpenDownsideRetained = text === "未完成领域";
      break;
    case "domainType":
      state.flags.domainType = text;
      break;
    case "domainMainEffect":
      state.flags.domainMainEffect = text;
      break;
    case "customTechniqueTypes":
      state.flags.customTechniqueTypes = result.results?.map((item) => item.text) || [text];
      break;
    case "specialTalent":
      state.flags.specialTalent = mergeSpecialTalentText(text);
      break;
    case "heavenlyRestrictionType":
      state.flags.heavenlyRestrictionType = text;
      state.flags.zeroCursedEnergyHeavenlyRestriction = isZeroCursedEnergyHeavenlyRestrictionText(text);
      state.flags.cursedEnergyBoostHeavenlyRestriction = isCursedEnergyBoostHeavenlyRestrictionText(text);
      break;
    case "domainEffectCount":
      state.flags.domainEffectCount = getNumberFromText(text);
      break;
    case "domainEffects":
      state.flags.domainEffects = result.results?.map((item) => item.text) || [text];
      break;
    case "mahoragaTune":
      state.flags.mahoragaTune = text;
      state.flags.mahoragaTuned = text.includes("成功");
      break;
    case "binding":
      state.flags.binding = text;
      break;
    case "toolCount":
      state.flags.toolCountBase = getNumberFromText(text);
      state.flags.toolCount = getAdjustedCountFrom("toolCount", state.flags.toolCountBase);
      break;
    case "tools":
      state.flags.tools = result.results?.map((item) => item.text) || [text];
      break;
    case "joinHighSchool":
      setHighSchoolChoice(text);
      break;
    case "highSchoolCampus":
      state.flags.highSchoolCampus = text;
      break;
    case "highSchoolStatus":
      state.flags.highSchoolStatus = text;
      break;
    case "ordinaryAwakening":
      state.flags.hasTechnique = "是";
      state.flags.awakenedTechnique = true;
      if (text.includes("吃咒物")) state.flags.superVessel = true;
      enqueueAwakenedInnateTechnique();
      break;
    default:
      break;
  }

  if (task.title === "是否参加涩谷事变") state.flags.participatesShibuya = text === "是";
  if (task.title === "是否参加百鬼夜行") state.flags.participatesNightParade = text === "是";
  if (task.title === "百鬼夜行结果（夏油杰方）") setNightParadeGetoResultFlags(text);
  if (task.title === "是否参加交流会") state.flags.participatesExchangeEvent = text === "是";
  if (task.nodeId === "shibuyaHighSchoolOpening") setShibuyaHighSchoolOpeningFlags(text);
  if (task.nodeId === "shibuyaHighSchoolImpact") setShibuyaHighSchoolImpactFlags(text);
  if (task.nodeId === "shibuyaGojoRescueResult") setShibuyaGojoRescueResultFlags(text);
  if (task.nodeId === "shibuyaSealFailureResult") setShibuyaSealFailureResultFlags(text);
  if (task.nodeId === "shibuyaGojoStateBridge") setShibuyaGojoStateFlags(text);
  if (task.nodeId === "shibuyaKenjakuPlanState") setKenjakuPlanStateFlags(text);
  if (task.nodeId === "shibuyaSukunaAfterGojoLine" || task.nodeId === "shibuyaSukunaAfterGojoRevival") {
    setSukunaRevivalStateFlags(text);
  }
  if (task.nodeId === "shibuyaWorldlineState") setShibuyaWorldlineFlags(text);
  if (task.title === "涩谷事变结局") setShibuyaOutcomeFlags(text);
  if (task.title === "是否参加死灭回游") state.flags.participatesCullingGame = text === "是";
  if (task.title.startsWith("是否参加新宿决战")) setShinjukuParticipation(text);
  if (task.title === "是否加入高专") setHighSchoolChoice(text);
  if (task.title.includes("是否加入主角小队")) {
    state.flags.joinMainTeam = text;
    state.flags.joinMainTeamTitle = task.title;
  }
  if (task.title.includes("如何来到现世")) {
    state.flags.modernArrivalResolved = true;
    state.flags.modernArrivalMethod = text;
  }
  if (task.title === "千年前遇见宿傩的结果") setAncientSukunaResultFlags(text);
  if (task.title === "保卫理子后" && text.includes("夏油杰一块黑化")) {
    enterGetoSide("W076-O4", { defectionFromHighSchool: true });
  }
  if (task.title.startsWith("参与幼鱼与逆罚")) setJunpeiArcFlags(text);
  if (task.title === "幼鱼与逆罚（真人方）" && text.includes("真人同流合污")) {
    lockFaction("羂索方");
  }
  if (task.title === "诞生时是什么状态（咒灵专属）") state.flags.isCurseWomb = text.includes("咒胎");
  if (task.title === "成长到完全体的加成是（咒胎专属）") {
    state.flags.curseWombGrowthBonus = text;
  }
  if (task.title === "成长到完全体会不会领域（咒胎专属）") {
    state.flags.curseWombHasDomain = text === "会";
  }
  if (task.title === "是否拥有领域（特级咒灵专属）") {
    state.flags.curseSpecialDomain = text === "是";
  }
  if (task.title === "是否拥有极之番（特级咒灵专属）") {
    state.flags.curseSpecialMaximum = text === "是";
  }
  if (task.title === "会不会领域展延（咒灵专属）") {
    state.flags.curseDomainAmplification = text === "是";
  }
  if (task.title === "成长上限（咒灵专属）") {
    state.flags.curseGrowthCeiling = text;
  }
  if (task.title === "死灭回游中能不能觉醒术式（没有生得术式专属）" && text.includes("被受肉")) {
    state.flags.wasIncarnated = true;
  }
  if (task.title === "死灭回游中能不能觉醒术式（没有生得术式专属）") {
    setCullingAwakeningFlags(text);
  }
  if (task.title === "涩谷事变阵营") setFaction(text, { lock: true });
  if (task.title.includes("决战阵营")) setFaction(text, { lock: true });
  if (task.title === "决战宿傩入场顺序" || task.title === "决战宿傩入场顺序（特级专属）") {
    setSukunaEntryFlags(text);
  }
  if (task.title === "五条对宿傩胜负（五条前打宿傩）" || task.title === "五条对决胜负（五条前大削）") {
    setGojoVsSukunaFlags(text);
  }
  if (task.title === "单挑宿傩结果") {
    setSoloSukunaResultFlags(text);
  }
  if (task.title === "参战宿傩后" || task.title === "参战宿傩后（特级专属）") {
    setPostSukunaFightFlags(text);
  }
  if (task.title === "二番战战绩" || task.title === "二番战（特级专属）") {
    setSecondRoundFlags(text);
  }
  if (task.title === "第三回合（特级专属）") {
    setThirdRoundFlags(text);
  }
  if (task.title === "宿傩战最终结果（高专方）") {
    setBattleResultFlags(text);
  }
  if (task.title === "新宿决战结局（云参加）") {
    setShinjukuSpectatorResultFlags(text);
  }
  if (task.title === "新宿决战结果（第三方参战）" || task.title === "新宿决战大势（第三方旁观）") {
    state.flags.shinjukuThirdPartyOutcome = text;
  }
  if (task.title === "决战的影响" || task.title === "高专车轮战结果（宿傩方）") {
    setSukunaSideImpactFlags(text);
  }
  if (task.title === "决战影响（一胜以上专属）") {
    setShinjukuImpactFlags(text);
  }
  if (task.title === "宿傩方在哪里") {
    setSukunaSideLocationFlags(text);
  }
  if (task.title === "宿傩对五条悟结果（宿傩方）") {
    setSukunaSideGojoFlags(text);
  }
  if (task.title === "和宿傩一起战术（宿傩方）") {
    setSukunaSideStrategyFlags(text);
  }
  if (task.title === "战斗结果（宿傩方·宿傩战败）") {
    setSukunaSideAfterDefeatResultFlags(text);
  }
  if (text.includes("活到68年后")) {
    state.flags.aliveAfter68 = true;
  }
  if (task.title === "车轮战结果" || task.title === "车轮战结果（第三方敌对）") {
    setWheelBattleResultFlags(text);
  }
  if (task.title === "由谁来对付你（单独一队专属）") setSelfTeamOpponentFlags(text);
  if (task.nodeId === "appearanceMiguelEasterEgg") setAppearanceMiguelEasterEggFlags();
  if (task.title === "战斗结果") setSelfTeamFinalBattleFlags(text);
  if (task.title === "战败结局") setBattleDefeatEndingFlags(text);
  if (task.title === "全打一遍战术（咒灵线）") setCurseAllFightFlags(text);
  if (task.title === "胜利结果（咒灵线）") setCurseVictoryFlags(text);
  if (task.title === "战后结果（咒灵线·胜）") setCurseVictoryEndingFlags(text);
  if (task.title === "是否活到68年后（存活专属）") state.flags.aliveAfter68 = text === "是";
  if (task.title === "后代评价") state.flags.hadPostEvaluation = true;
  if (task.title === "观众是否会投币") state.flags.hadCoinFlip = true;

  applySkipFlowKeywords(text);
  if (shouldMarkDeathFromTask(task, text, optionEffectTrace)) state.flags.dead = true;
}

function setHighSchoolChoice(text) {
  state.flags.joinHighSchool = text;
  if (text === "是") {
    lockFaction("高专方");
  }
}

function enterJujutsuCouncil(source = "") {
  state.flags.jujutsuCouncil = true;
  state.flags.jujutsuCouncilSource = source;
  state.flags.identityOverride = "咒术高层";
  state.flags.joinHighSchool = "是";
  state.flags.participatesShinjuku = true;
  if (state.flags.highSchoolStatus === "学生") {
    state.flags.highSchoolStatus = "";
  }
  lockFaction("高专方");
}

function setCurseUserOrganizationBranchFlags(text) {
  if (text.includes("旧盘星教")) {
    state.flags.oldStarReligiousGroupSide = true;
    state.flags.getoSide = false;
    state.flags.getoSideSource = "";
    return;
  }
  if (text.includes("夏油")) {
    enterGetoSide("W173-O2");
    return;
  }
  state.flags.oldStarReligiousGroupSide = false;
}

function enterGetoSide(source, options = {}) {
  state.flags.getoSide = true;
  state.flags.getoSideSource = source;
  state.flags.oldStarReligiousGroupSide = false;
  if (options.defectionFromHighSchool) {
    state.flags.formerHighSchool = state.flags.joinHighSchool === "是";
    state.flags.joinHighSchool = "叛离夏油杰方";
    state.flags.highSchoolDefectedToGeto = true;
    if (state.flags.faction === "高专方") {
      state.flags.faction = "夏油杰方";
      state.flags.factionLocked = true;
      state.flags.hostileToHighSchool = true;
    }
  }
}

function setShinjukuParticipation(text) {
  const participates = !/(云参加|不参与|不参加|否|观战|旁观|划水)/.test(text);
  state.flags.participatesShinjuku = participates;
  if (!participates) {
    state.flags.shinjukuSpectator = true;
    state.flags.shinjukuCombatParticipant = false;
    state.flags.canSecondRound = false;
    state.flags.canThirdRound = false;
    state.flags.needsSukunaBattleResult = false;
  }
}

function setShinjukuSpectatorResultFlags(text) {
  state.flags.shinjukuSpectatorResult = text.includes("胜") ? "高专方胜" : "高专方败";
  state.flags.highSchoolDefeated = !text.includes("胜");
}

function markShibuyaHighSchoolBranch() {
  state.flags.shibuyaHighSchoolBranch = true;
}

function setShibuyaHighSchoolOpeningFlags(text) {
  markShibuyaHighSchoolBranch();
  if (text.includes("救五条")) {
    state.flags.shibuyaGojoRescueAttempt = true;
  }
}

function setShibuyaHighSchoolImpactFlags(text) {
  markShibuyaHighSchoolBranch();
  if (text.includes("抢到五条盒")) {
    state.flags.shibuyaGojoRescueAttempt = true;
    state.flags.prisonRealmSecured = true;
    state.flags.gojoShibuyaState = "prisonRealmSecured";
  }
  if (text.includes("五条封印失败")) {
    state.flags.shibuyaGojoRescueAttempt = true;
    state.flags.gojoSealFailed = true;
    state.flags.gojoShibuyaState = "unsealed";
  }
  if (text.includes("对战宿傩")) {
    state.flags.shibuyaSukunaEncounter = true;
  }
}

function setShibuyaGojoRescueResultFlags(text) {
  markShibuyaHighSchoolBranch();
  if (text.includes("封印失败")) {
    state.flags.gojoSealFailed = true;
    state.flags.gojoShibuyaState = "unsealed";
    return;
  }
  if (text.includes("抢到狱门疆")) {
    state.flags.prisonRealmSecured = true;
    state.flags.gojoShibuyaState = "prisonRealmSecured";
    return;
  }
  if (text.includes("原著发展")) {
    state.flags.gojoShibuyaState = "sealedCanon";
    if (!state.flags.kenjakuPlanState) state.flags.kenjakuPlanState = "canon";
  }
}

function setShibuyaSealFailureResultFlags(text) {
  markShibuyaHighSchoolBranch();
  state.flags.gojoShibuyaState = "unsealed";
  if (text.includes("羂索被捕")) {
    state.flags.kenjakuCaptured = true;
    state.flags.kenjakuPlanState = "stopped";
    return;
  }
  if (text.includes("羂索跑路")) {
    state.flags.kenjakuPlanState = "damaged";
  }
}

function setShibuyaGojoStateFlags(text) {
  markShibuyaHighSchoolBranch();
  if (text.includes("未被封印")) {
    state.flags.gojoSealFailed = true;
    state.flags.gojoShibuyaState = "unsealed";
    return;
  }
  if (text.includes("狱门疆被高专夺回")) {
    state.flags.prisonRealmSecured = true;
    state.flags.gojoShibuyaState = "prisonRealmSecured";
    return;
  }
  state.flags.gojoShibuyaState = "sealedCanon";
}

function setKenjakuPlanStateFlags(text) {
  markShibuyaHighSchoolBranch();
  if (text.includes("被捕") || text.includes("无法正常发动")) {
    state.flags.kenjakuCaptured = text.includes("被捕");
    state.flags.kenjakuPlanState = "stopped";
    return;
  }
  if (text.includes("严重受损")) {
    state.flags.kenjakuPlanState = "damaged";
    return;
  }
  if (text.includes("备用方案")) {
    state.flags.kenjakuPlanState = "fallback";
    return;
  }
  state.flags.kenjakuPlanState = "canon";
}

function setSukunaRevivalStateFlags(text) {
  markShibuyaHighSchoolBranch();
  if (text.includes("没办法复活")) {
    state.flags.sukunaRevivalState = "blocked";
    state.flags.participatesShinjuku = false;
    return;
  }
  if (text.includes("实力大减")) {
    state.flags.sukunaRevivalState = "nerfed";
    return;
  }
  if (text.includes("减速带") || text.includes("提前压制")) {
    state.flags.sukunaRevivalState = "gojoSuppressed";
    state.flags.participatesShinjuku = false;
    return;
  }
  if (text.includes("恢复决战实力")) {
    state.flags.sukunaRevivalState = "recovered";
  }
}

function setShibuyaWorldlineFlags(text) {
  markShibuyaHighSchoolBranch();
  state.flags.shibuyaWorldlineState = text;
  if (text.includes("高专提前占优")) state.flags.cullingGameWeakened = true;
  if (text.includes("羂索残党") && !state.flags.kenjakuPlanState) state.flags.kenjakuPlanState = "fallback";
  if (text.includes("宿傩潜伏")) {
    state.flags.shinjukuVariant = true;
    if (!state.flags.sukunaRevivalState) state.flags.sukunaRevivalState = "recovered";
  }
}

function setShibuyaOutcomeFlags(text) {
  state.flags.shibuyaOutcome = text;
}

function applySkipFlowKeywords(text) {
  const rules = state.flow.endingRules?.skipFlowKeywords || [];
  for (const rule of rules) {
    if (text.includes(rule.keyword)) {
      state.flags.skipPeriods.add(rule.skip);
    }
  }
}

function setAncientSukunaResultFlags(text) {
  if (text.includes("加入宿傩")) {
    state.flags.ancientSukunaAlly = true;
    state.flags.formerHighSchool = state.flags.joinHighSchool === "是";
    state.flags.formerJujutsuCouncil = state.flags.jujutsuCouncil === true;
    state.flags.joinHighSchool = "叛离宿傩方";
    state.flags.highSchoolDefectedToSukuna = true;
    state.flags.jujutsuCouncil = false;
    state.flags.jujutsuCouncilSource = "";
    lockFaction("宿傩方");
  }
}

function setNightParadeGetoResultFlags(text) {
  state.flags.nightParadeGetoResult = text;

  if (text.includes("被高专诏安")) {
    state.flags.getoSide = false;
    state.flags.getoSideSource = "";
    state.flags.getoSideResolved = true;
    state.flags.highSchoolDefectedToGeto = false;
    state.flags.joinHighSchool = "是";
    lockFaction("高专方");
  }
}

function setJunpeiArcFlags(text) {
  if (text.includes("未参与")) {
    state.flags.junpeiArcSide = "未参与";
  } else if (text.includes("虎杖")) {
    state.flags.junpeiArcSide = "高专方";
  } else if (text.includes("真人") || text.includes("顺平")) {
    state.flags.junpeiArcSide = "真人方";
  }
}

function setFaction(text, options = {}) {
  if (state.flags.factionLocked && !options.force) return;
  const faction = parseFaction(text);
  if (!faction) return;
  state.flags.faction = faction;
  state.flags.hostileToHighSchool = isHostileToHighSchoolFactionText(text, faction);
  if (options.lock) state.flags.factionLocked = true;
}

function parseFaction(text) {
  if (text.includes("洗心革面") || text.includes("对抗宿傩")) return "高专方";
  if (text.includes("两不相帮")) return "第三方";
  if (text.includes("羂索") || text.includes("真人")) return "羂索方";
  if (text.includes("宿傩")) return "宿傩方";
  if (text.includes("高专")) return "高专方";
  if (text.includes("第三方") || text.includes("两不相帮")) return "第三方";
  if (text.includes("自己") || text.includes("单独") || text.includes("全都打一遍")) {
    return "自己一队";
  }
  return "";
}

function isHostileToHighSchoolFactionText(text, faction) {
  if (faction === "宿傩方" || faction === "羂索方") return true;
  if (faction !== "自己一队") return false;
  return text.includes("单独") || text.includes("自己") || text.includes("全都打一遍");
}

function lockFaction(faction) {
  state.flags.faction = faction;
  state.flags.factionLocked = true;
  state.flags.hostileToHighSchool = faction === "宿傩方" || faction === "羂索方";
}

function isUnresolvedBattleResult(value) {
  return value === undefined || value === null || value === "" || value === "未定";
}

function markDirectSukunaCombatEntry(task) {
  if (DIRECT_SUKUNA_COMBAT_WHEEL_IDS.has(Number(task?.wheelId))) {
    state.flags.shinjukuCombatParticipant = true;
  }
}

function terminateSukunaCombatChain() {
  state.flags.shinjukuCombatParticipant = false;
  state.flags.canSecondRound = false;
  state.flags.canThirdRound = false;
  state.flags.needsSukunaBattleResult = false;
}

function closeShinjukuWarOutcome(outcome, { highSchoolDefeated = null } = {}) {
  state.flags.shinjukuWarOutcome = outcome;
  if (highSchoolDefeated !== null) {
    state.flags.highSchoolDefeated = highSchoolDefeated;
  }
  state.flags.battleFlowClosed = true;
  terminateSukunaCombatChain();
}

function markSukunaSideOneWin() {
  state.flags.sukunaSideOneWin = true;
  state.flags.hostileContributionAgainstHighSchool = true;
}

function isDirectHighSchoolDefeatText(text) {
  return text.includes("战胜高专") ||
    text.includes("高专败") ||
    text.includes("高专方败") ||
    text.includes("高专败北") ||
    text.includes("高专被击败");
}

function isDirectHighSchoolCostlyWinText(text) {
  return text.includes("高专") && text.includes("惨烈") && text.includes("获胜");
}

function isDirectHighSchoolWinText(text) {
  return text.includes("高专胜") || isDirectHighSchoolCostlyWinText(text);
}

function isShinjukuParticipant() {
  if (state.flags.participatesShinjuku === false) return false;
  if (state.flags.participatesShinjuku === true) return true;
  if (state.flags.jujutsuCouncil === true && state.flags.faction === "高专方") return true;
  return state.flags.faction === "高专方" && !isWeakGrade();
}

function canGojoAffectSukunaAfterShibuya() {
  return state.flags.gojoShibuyaState === "unsealed" || state.flags.gojoShibuyaState === "prisonRealmSecured";
}

function canCullingGameOccur() {
  return state.flags.kenjakuPlanState !== "stopped";
}

function canFightSukunaInShinjuku() {
  return !["blocked", "gojoSuppressed"].includes(state.flags.sukunaRevivalState);
}

function isShinjukuSukunaAltered() {
  return state.flags.faction === "高专方" && !canFightSukunaInShinjuku();
}

function setSukunaEntryFlags(text) {
  state.flags.playerBeforeGojoSukuna = text.includes("五条前");
  state.flags.gojoBeforeSukuna = false;
  state.flags.gojoAfterPlayerFirstFight = false;
  const entryStage = getSukunaEntryStage(text);
  if (entryStage) {
    state.flags.sukunaEntryStage = entryStage.stage;
    state.flags.sukunaNerfStage = entryStage.nerfStage;
    state.flags.sukunaEntryStageLabel = entryStage.label;
    state.flags.sukunaNerfDetails = entryStage.nerfDetails || [];
    state.flags.sukunaBattleUnitMultiplier = entryStage.battleUnitMultiplier || 1;
  }
  state.flags.soloSukuna =
    text.includes("五条前") ||
    text.includes("单挑") ||
    text.includes("负责收菜") ||
    text.includes("打十影宿傩");
}

function setSoloSukunaResultFlags(text) {
  state.flags.canSecondRound = false;
  state.flags.canThirdRound = false;

  if (text.includes("战胜")) {
    state.flags.sukunaBattleResult = "胜";
    state.flags.needsSukunaBattleResult = false;
    return;
  }
  if (text.includes("被腰斩")) {
    state.flags.dead = true;
    state.flags.sukunaBattleResult = "败";
    state.flags.needsSukunaBattleResult = false;
    return;
  }
  if (text.includes("再战")) {
    state.flags.needsSukunaBattleResult = true;
    if (state.flags.playerBeforeGojoSukuna) {
      state.flags.gojoAfterPlayerFirstFight = true;
      state.flags.needsSukunaBattleResult = false;
      return;
    }
    state.flags.canSecondRound = true;
  }
}

function setGojoVsSukunaFlags(text) {
  state.flags.gojoAfterPlayerFirstFight = false;
  state.flags.canSecondRound = false;
  state.flags.canThirdRound = false;

  if (text.includes("胜")) {
    state.flags.gojoBattleResult = "胜";
    state.flags.shinjukuWarOutcome = "高专胜";
    state.flags.highSchoolDefeated = false;
    state.flags.battleFlowClosed = true;
    terminateSukunaCombatChain();
    return;
  }
  if (text.includes("负")) {
    state.flags.gojoBattleResult = "败";
    delete state.flags.sukunaBattleResult;
    state.flags.needsSukunaBattleResult = false;
  }
}

function setSukunaSideLocationFlags(text) {
  state.flags.sukunaSideLocation = text;
  state.flags.sukunaSideWithSukunaGroup = false;
  state.flags.sukunaSideWithKenjaku = false;

  if (text.includes("自己") || text.includes("单独")) {
    state.flags.faction = "自己一队";
    state.flags.factionLocked = true;
    state.flags.hostileToHighSchool = true;
    state.flags.sukunaSideStrategyResolved = false;
    state.flags.sukunaSideGojoFight = false;
    state.flags.sukunaSideAfterDefeat = false;
    return;
  }

  if (text.includes("羂索")) {
    state.flags.sukunaSideWithKenjaku = true;
    state.flags.sukunaSideStrategyResolved = true;
    state.flags.sukunaSideGojoFight = false;
    state.flags.sukunaSideAfterDefeat = false;
    return;
  }

  if (text.includes("宿傩") || text.includes("里梅")) {
    state.flags.sukunaSideWithSukunaGroup = true;
  }
}

function setSukunaSideStrategyFlags(text) {
  state.flags.sukunaSideStrategyResolved = true;
  state.flags.sukunaSideGojoFight = false;
  state.flags.sukunaSideAfterDefeat = false;

  if (text.includes("和宿傩一起打五条")) {
    state.flags.sukunaSideGojoFight = true;
    return;
  }
  if (text.includes("等宿傩战败")) {
    state.flags.sukunaSideAfterDefeat = true;
  }
}

function setSukunaSideGojoFlags(text) {
  state.flags.sukunaSideGojoFight = false;
  state.flags.sukunaSideGojoResolved = true;

  if (text.includes("胜")) {
    state.flags.gojoBattleResult = "宿傩方胜";
    markSukunaSideOneWin();
    return;
  }

  if (text.includes("负")) {
    state.flags.gojoBattleResult = "宿傩方败";
    state.flags.sukunaBattleResult = "败";
    state.flags.highSchoolDefeated = false;
    state.flags.needsSukunaBattleResult = false;
  }
}

function setPostSukunaFightFlags(text) {
  state.flags.canSecondRound = false;
  state.flags.canThirdRound = false;

  if (isDeathResult(text) || text.includes("重伤倒地再起不能")) {
    terminateSukunaCombatChain();
    return;
  }
  if (text.includes("宿傩？借过一下")) {
    state.flags.sukunaBattleResult = "胜";
    state.flags.needsSukunaBattleResult = false;
    return;
  }
  if (text.includes("见势不妙") || text.includes("跑路")) {
    terminateSukunaCombatChain();
    return;
  }
  if (text.includes("二番战") || text.includes("受伤进行二番战")) {
    state.flags.canSecondRound = true;
    state.flags.needsSukunaBattleResult = true;
  }
}

function setSecondRoundFlags(text) {
  state.flags.canThirdRound = false;
  state.flags.needsSukunaBattleResult = true;

  if (isDeathResult(text) || text.includes("重伤倒地再起不能")) return;
  if (text.includes("边缘支援") || text.includes("不能继续") || text.includes("再起不能")) return;
  if (text.includes("战而胜之") || text.includes("终结诅咒之王")) {
    state.flags.sukunaBattleResult = "胜";
    state.flags.needsSukunaBattleResult = false;
    return;
  }
  if (text.includes("不敌") || text.includes("败退")) {
    state.flags.sukunaBattleResult = "败";
    state.flags.needsSukunaBattleResult = false;
    return;
  }
  if (text.includes("三番战") || text.includes("第三回合") || text.includes("再战") || text.includes("单挑")) {
    state.flags.canThirdRound = true;
  }
}

function setThirdRoundFlags(text) {
  state.flags.canThirdRound = false;
  state.flags.needsSukunaBattleResult = false;
  if (isDeathResult(text)) {
    state.flags.dead = true;
    state.flags.sukunaBattleResult = "败";
    return;
  }
  if (text.includes("击败")) {
    state.flags.sukunaBattleResult = "胜";
    return;
  }
  if (text.includes("不敌") || text.includes("败退")) {
    state.flags.sukunaBattleResult = "败";
  }
}

function setBattleResultFlags(text) {
  if (text.includes("胜")) state.flags.sukunaBattleResult = "胜";
  if (text.includes("败") || text.includes("负")) state.flags.sukunaBattleResult = "败";
  state.flags.needsSukunaBattleResult = false;
}

function setCullingAwakeningFlags(text) {
  if (text === "是") {
    state.flags.hasTechnique = "是";
    state.flags.awakenedTechnique = true;
    state.flags.cullingAwakenedTechnique = true;
    enqueueAwakenedInnateTechnique();
    return;
  }

  if (text.includes("被受肉")) {
    state.flags.wasIncarnated = true;
  }
}

function setSukunaSideImpactFlags(text) {
  state.flags.sukunaSideImpact = text;

  if (text.includes("帮宿傩获胜")) {
    closeShinjukuWarOutcome("宿傩胜", { highSchoolDefeated: true });
    state.flags.sukunaSideAfterDefeat = false;
    return;
  }

  if (isDirectHighSchoolCostlyWinText(text)) {
    closeShinjukuWarOutcome("高专惨胜", { highSchoolDefeated: false });
    state.flags.sukunaSideAfterDefeat = false;
    return;
  }

  if (text.includes("微乎其微")) {
    state.flags.sukunaBattleResult = "败";
    state.flags.highSchoolDefeated = false;
    return;
  }

  if (text.includes("帮倒忙") || text.includes("坑惨")) {
    state.flags.sukunaBattleResult = "败";
    state.flags.highSchoolDefeated = false;
  }
}

function setShinjukuImpactFlags(text) {
  state.flags.shinjukuImpact = text;

  if (text.includes("帮助宿傩战胜高专")) {
    closeShinjukuWarOutcome("宿傩胜", { highSchoolDefeated: true });
    return;
  }

  if (text.includes("高专死伤惨重艰难取胜")) {
    closeShinjukuWarOutcome("高专惨胜", { highSchoolDefeated: false });
  }
}
function setSukunaSideAfterDefeatResultFlags(text) {
  state.flags.sukunaSideAfterDefeat = false;
  if (isDirectHighSchoolDefeatText(text)) {
    closeShinjukuWarOutcome("宿傩胜", { highSchoolDefeated: true });
    return;
  }
  if (isDirectHighSchoolWinText(text)) {
    closeShinjukuWarOutcome("高专胜", { highSchoolDefeated: false });
    return;
  }
  if (text.includes("跑路")) {
    state.flags.retreatAfterSukunaDefeat = true;
    closeShinjukuWarOutcome("高专胜", { highSchoolDefeated: false });
  }
}

function setSelfTeamOpponentFlags(text) {
  state.flags.selfTeamOpponent = text;
  state.flags.selfTeamOpponentRolled = true;
  state.flags.wheelEmptyPerson = text.includes("车轮战");
  if (text.includes("米格尔")) {
    state.flags.miguelOpponentEncountered = true;
  }
}

function setAppearanceMiguelEasterEggFlags() {
  state.flags.appearanceMiguelEasterEggSeen = true;
  state.flags.appearanceMiguelDebuff = true;
}

function shouldTriggerAppearanceMiguelEasterEgg() {
  if (state.flags.appearanceMiguelEasterEggSeen || state.flags.appearanceMiguelEasterEggChecked) return false;
  if (!hasEminusAppearance()) return false;
  if (!hasMiguelOpponentEncounter()) return false;

  state.flags.appearanceMiguelEasterEggChecked = true;
  state.flags.appearanceMiguelEasterEggTriggered = Math.random() < 0.35;
  return state.flags.appearanceMiguelEasterEggTriggered === true;
}

function hasEminusAppearance() {
  return parseRank(state.flags.appearance || getAnswerText("appearance")) === "E-";
}

function hasMiguelOpponentEncounter() {
  return Boolean(state.flags.miguelOpponentEncountered) ||
    String(state.flags.selfTeamOpponent || "").includes("米格尔");
}

function setWheelBattleResultFlags(text) {
  state.flags.selfTeamBattleResolved = true;
  if (isDirectHighSchoolDefeatText(text)) {
    state.flags.sukunaBattleResult = "胜";
    state.flags.highSchoolDefeated = true;
    if (state.flags.curseAllFight === true && getEffectiveIdentity() === "咒灵") {
      return;
    }
    closeShinjukuWarOutcome("高专败", { highSchoolDefeated: true });
    return;
  }
  if (text.includes("重创五条") || text.includes("削弱五条") || text.includes("击杀五条")) {
    state.flags.hostileContributionAgainstHighSchool = true;
  }
  if (text.includes("战败") || text.includes("秒了")) {
    state.flags.sukunaBattleResult = "败";
    state.flags.highSchoolDefeated = false;
  }
}
function setSelfTeamFinalBattleFlags(text) {
  state.flags.selfTeamBattleResolved = true;
  if (text.includes("胜")) {
    state.flags.sukunaBattleResult = "胜";
    closeShinjukuWarOutcome("高专败", { highSchoolDefeated: true });
    return;
  }
  if (text.includes("败") || text.includes("负")) {
    state.flags.sukunaBattleResult = "败";
    state.flags.highSchoolDefeated = false;
  }
}
function shouldRunBattleDefeatEnding() {
  return state.flags.sukunaBattleResult === "败" &&
    state.flags.hostileToHighSchool === true &&
    state.flags.battleFlowClosed !== true;
}

function setBattleDefeatEndingFlags(text) {
  state.flags.battleFlowClosed = true;
  state.flags.selfTeamBattleResolved = true;
  if (text.includes("战至死亡")) {
    state.flags.dead = true;
  }
}

function setCurseAllFightFlags(text) {
  state.flags.curseAllFight = true;
  state.flags.curseAllFightTactic = text;
}

function setCurseVictoryFlags(text) {
  state.flags.curseVictory = true;
  state.flags.curseVictoryResult = text;
  state.flags.sukunaBattleResult = "胜";
  state.flags.highSchoolDefeated = true;
}

function setCurseVictoryEndingFlags(text) {
  state.flags.curseLineResolved = true;
  state.flags.battleFlowClosed = true;
  state.flags.curseVictoryEnding = text;
}

function shouldRunPostEvaluation() {
  if (state.flags.enteredEasterEgg || state.flags.isAlien) return false;
  return state.flags.faction !== "宿傩方" && state.flags.faction !== "羂索方";
}

function isDeathResult(text, task = null, trace = null) {
  if (isNonTerminalDeathReference(text)) return false;
  const current = trace || getOptionEffectTrace(task, text);
  if (current) {
    return Boolean(
      current.resultTags?.includes("death") ||
        current.effects?.some((effect) => effect.type === "deathOutcome")
    );
  }
  const configured = state.flow.endingRules?.deathKeywords || [];
  return configured.some((keyword) => text.includes(keyword));
}

function shouldMarkDeathFromTask(task, text, trace = null) {
  if (!isDeathResult(text, task, trace)) return false;
  if (isNonTerminalDeathReference(text)) return false;

  const stage = task?.stage || "";
  if (/基础生成|能力构建|自定义术式|彩蛋|结束/.test(stage)) return false;
  if (["binding", "specialTalent", "advancedTechniques", "curseFear", "postEvaluation", "endingMeta"].includes(task?.nodeId)) {
    return false;
  }

  return true;
}

function isNonTerminalDeathReference(text) {
  return [
    /死亡概率/,
    /死去.*概率/,
    /只能在.*死去/,
    /根源恐惧（?死亡/,
    /生是死的开始/,
    /换自己不死/,
    /快被打死了极限跑路/
  ].some((pattern) => pattern.test(text));
}

function enqueueEasterEggSubflow() {
  for (const [wheelId, title] of [
    [105, "彩蛋池"],
    [117, "境界（默认上下限都在这个境界）"],
    [118, "性格（彩蛋专属）"],
    [119, "降临后世界结局（彩蛋专属）"],
    [120, "饮食/物质喜好（彩蛋专属）"],
    [121, "精神/娱乐喜好（彩蛋专属）"],
    [122, "人际喜好（彩蛋专属）"],
    [123, "特殊癖好（彩蛋专属）"],
    [124, "宏大喜好（彩蛋专属）"]
  ]) {
    state.taskQueue.push({
      type: "wheel",
      nodeId: `easter-${wheelId}`,
      wheelId,
      title,
      stage: "彩蛋",
      why: "彩蛋线暂定独立。"
    });
  }
}

function drawOne(task, excludedTexts = new Set(), context = {}) {
  const forced = consumeDebugForcedOption(task, excludedTexts, context);
  if (forced) return forced;

  const wheel = getTaskWheel(task);
  const options = getWeightedOptions(wheel, task, context);
  return callSiteModuleImplementation("JJKLifeWheelRandom", "drawOnce", [options, {
    excludedTexts,
    weightKey: "weight",
    textKey: "text",
    rng: Math.random
  }]);
}

function drawMultiple(task, count) {
  const wheel = getTaskWheel(task);
  const available = getWeightedOptions(wheel, task).filter((item) => Number(item.weight) > 0);
  const preventRepeat = task.noRepeatScope === "singlePool";
  const max = task.nodeId === "advancedTechniques"
    ? count
    : preventRepeat ? Math.min(count, available.length) : count;
  return callSiteModuleImplementation("JJKLifeWheelRandom", "drawMultipleNoRepeat", [
    ({ selected }) => {
      const context = task.nodeId === "advancedTechniques"
        ? { selectedAdvancedTechniques: selected.map((item) => item.text) }
        : {};
      return getWeightedOptions(wheel, task, context);
    },
    max,
    {
      preventRepeat,
      weightKey: "weight",
      textKey: "text",
      rng: Math.random,
      pickOne: (options, pickSettings, drawState) => {
        const context = task.nodeId === "advancedTechniques"
          ? { selectedAdvancedTechniques: drawState.selected.map((item) => item.text) }
          : {};
        const excludedTexts = preventRepeat ? drawState.excludedTexts : new Set();
        const forced = consumeDebugForcedOption(task, excludedTexts, context);
        if (forced) return forced;
        return callSiteModuleImplementation("JJKLifeWheelRandom", "drawOnce", [options, pickSettings]);
      }
    }
  ]);
}

function getForceableOptions(task, context = {}) {
  if (!task) return [];
  if (task.type === "choice") {
    return (task.options || []).map((option, index) => ({
      ...option,
      index,
      weight: 1
    }));
  }
  if (task.type !== "wheel" && task.type !== "multiDraw") return [];
  const wheel = getTaskWheel(task);
  if (!wheel) return [];
  return getWeightedOptions(wheel, task, context);
}

function consumeDebugForcedOption(task, excludedTexts = new Set(), context = {}) {
  if (!state.debugMode || !els.debugForcedOptionSelect) return null;
  const value = els.debugForcedOptionSelect.value;
  if (value === "") return null;

  const index = Number(value);
  const option = getForceableOptions(task, context).find((item) => item.index === index);
  if (!option || Number(option.weight ?? 1) <= 0 || excludedTexts.has(option.text)) return null;

  els.debugForcedOptionSelect.value = "";
  return option;
}

function createOptionsSnapshot(task, result = null) {
  const selectedIndexes = getPendingResultIndexes(result);
  const snapshot = {
    taskType: task.type,
    nodeId: task.nodeId || "",
    wheelId: task.wheelId || null,
    title: task.title || "",
    stage: task.stage || "",
    condition: task.condition || "",
    why: task.why || "",
    countFrom: task.countFrom || "",
    noRepeatScope: task.noRepeatScope || "",
    timelinePeriod: task.timelinePeriod || "",
    selectedText: result?.text || "",
    selectionMode: result?.selectionMode || "random",
    aiFreeInteraction: result?.aiFreeInteraction || null,
    aiFreeInfluence: result?.aiFreeInfluence ? {
      summary: result.aiFreeInfluence.summary,
      tags: result.aiFreeInfluence.tags
    } : null,
    aiFreeAssistTrace: result?.aiFreeAssistTrace || (result?.aiFreeInfluence
      ? buildAiFreeAssistTrace(result.aiFreeInfluence, result.aiFreeInteraction?.anchorText || result.text || "")
      : null),
    aiFreeBridge: result?.aiFreeBridge || null,
    selectedIndexes,
    requestedCount: task.type === "multiDraw" ? getCountFrom(task.countFrom) : null,
    stateBefore: {
      flags: serializeFlags(state.flags),
      strength: buildStrengthSnapshot()
    },
    options: []
  };

  if (task.type === "choice") {
    snapshot.options = (task.options || []).map((option, index) => {
      const trace = getOptionEffectTrace(task, option.text);
      return {
        index,
        text: option.text,
        next: option.next || "",
        baseWeight: 1,
        adjustedWeight: 1,
        selectable: true,
        selected: selectedIndexes.includes(index) || option.text === result?.text,
        resultTags: trace?.resultTags || [],
        optionEffects: trace?.effects?.map((effect) => effect.type) || []
      };
    });
    snapshot.totalAdjustedWeight = snapshot.options.length;
    return snapshot;
  }

  const wheel = getTaskWheel(task);
  if (!wheel) return snapshot;

  const options = getWeightedOptions(wheel, task);
  const totalAdjustedWeight = options.reduce((sum, item) => sum + Math.max(0, Number(item.weight || 0)), 0);
  snapshot.wheelTitle = wheel.title;
  snapshot.totalAdjustedWeight = Number(totalAdjustedWeight.toFixed(4));
  snapshot.options = options.map((item) => {
    const adjustedWeight = Number(item.weight || 0);
    const trace = getOptionEffectTrace(task, item.text);
    return {
      index: item.index,
      text: item.text,
      rawText: item.rawText || item.text,
      baseWeight: Number(item.baseWeight || 0),
      adjustedWeight: Number(adjustedWeight.toFixed(4)),
      adjusted: Boolean(item.adjusted),
      selectable: adjustedWeight > 0,
      probability: totalAdjustedWeight > 0 && adjustedWeight > 0
        ? Number((adjustedWeight / totalAdjustedWeight).toFixed(6))
        : 0,
      selected: selectedIndexes.includes(item.index),
      resultTags: trace?.resultTags || [],
      optionEffects: trace?.effects?.map((effect) => effect.type) || []
    };
  });
  return snapshot;
}

function getWeightedOptions(wheel, task, context = {}) {
  const options = callSiteModuleImplementation("JJKLifeWheelRandom", "buildWeightedOptions", [wheel, task, {
    context,
    normalizeOptionText,
    getAdjustedWeight,
    applyAiFreeWeightAdjustments
  }]);
  return applyAdvancedTechniqueDrawProgression(task, options, context);
}

function applyAdvancedTechniqueDrawProgression(task, options, context = {}) {
  if (task?.nodeId !== "advancedTechniques") return options;
  const selected = new Set((context.selectedAdvancedTechniques || []).map((text) => String(text).trim()));
  const normalizedOptions = options.map((item) => {
    if (!selected.has(String(item.text || "").trim())) return item;
    return {
      ...item,
      weight: 0,
      adjusted: true,
      adjustedReason: "advancedTechniqueAlreadySelected"
    };
  });

  const domainOption = normalizedOptions.find((item) => item.text === "领域展开");
  if (!domainOption || Number(domainOption.weight || 0) <= 0) return normalizedOptions;

  const drawNumber = selected.size + 1;
  const targetChance = getDomainExpansionChanceForAdvancedDraw(drawNumber);
  if (targetChance <= 0) {
    return normalizedOptions.map((item) => item === domainOption
      ? { ...item, weight: 0, adjusted: true, adjustedReason: "domainExpansionFirstAdvancedDrawBlocked" }
      : item
    );
  }

  if (targetChance >= 1) {
    return normalizedOptions.map((item) => {
      if (item === domainOption) {
        return {
          ...item,
          weight: Math.max(1, Number(item.weight || item.baseWeight || 1)),
          adjusted: true,
          adjustedReason: "domainExpansionAdvancedDrawGuarantee"
        };
      }
      return { ...item, weight: 0, adjusted: true, adjustedReason: "domainExpansionAdvancedDrawGuarantee" };
    });
  }

  const otherTotal = normalizedOptions.reduce((sum, item) => {
    if (item === domainOption) return sum;
    return sum + Math.max(0, Number(item.weight || 0));
  }, 0);
  if (otherTotal <= 0) return normalizedOptions;

  const domainWeight = otherTotal * targetChance / (1 - targetChance);
  return normalizedOptions.map((item) => item === domainOption
    ? {
      ...item,
      weight: domainWeight,
      adjusted: true,
      adjustedReason: "domainExpansionAdvancedDrawProgression"
    }
    : item
  );
}

function getDomainExpansionChanceForAdvancedDraw(drawNumber) {
  const step = Math.max(1, Number(drawNumber) || 1);
  if (step <= 1) return 0;
  return clamp(0.25 + 0.1 * (step - 2), 0, 1);
}

function applyAiFreeWeightAdjustments(task, optionText, adjustedWeight, baseWeight) {
  const currentWeight = Number(adjustedWeight);
  if (!Number.isFinite(currentWeight) || currentWeight <= 0) return currentWeight;
  if (!state.flags.aiFreeModeUsed && !state.aiFreeEnabled) return currentWeight;

  const bias = {
    ...createEmptyAiFreeBias(),
    ...(state.flags.aiFreeWeightBias || {})
  };
  const text = String(optionText || "");
  const title = String(task?.title || "");
  const nodeId = String(task?.nodeId || "");
  let multiplier = 1;
  const boost = (key, amount = 0.22) => {
    const value = Math.min(6, Number(bias[key] || 0));
    if (value > 0) multiplier *= 1 + Math.min(2.4, value * amount);
  };
  const dampen = (key, amount = 0.12) => {
    const value = Math.min(6, Number(bias[key] || 0));
    if (value > 0) multiplier *= Math.max(0.25, 1 - value * amount);
  };

  if (bias.highSchool > 0) {
    if (/(高专|救五条|救援|保护|对抗宿傩|洗心革面|虎杖|乙骨|真希|伏黑)/.test(text)) boost("highSchool", 0.24);
    if (/(宿傩方|加入宿傩|羂索|真人|咒灵方)/.test(text) && !/对抗宿傩/.test(text)) dampen("highSchool", 0.1);
  }
  if (bias.sukuna > 0) {
    if (/(宿傩|里梅|诅咒之王|伏魔御厨子)/.test(text) && !/对抗宿傩|阻止宿傩/.test(text)) boost("sukuna", 0.25);
    if (/(高专|救五条|对抗宿傩)/.test(text)) dampen("sukuna", 0.1);
  }
  if (bias.kenjaku > 0) {
    if (/(羂索|真人|咒灵|改造人|死灭回游|备用方案)/.test(text)) boost("kenjaku", 0.24);
    if (/(羂索被捕|计划中断|高专夺回|救五条)/.test(text)) dampen("kenjaku", 0.12);
  }
  if (bias.selfTeam > 0) {
    if (/(自己|单独|第三方|两不相帮|全都打一遍|旁观)/.test(text)) boost("selfTeam", 0.24);
  }
  if (bias.training > 0 && isAiFreeGrowthTask(task)) {
    if (isHighRankText(text) || /(成功|觉醒|学会|领域|反转|黑闪|极之番|咒具|多|强)/.test(text)) boost("training", 0.22);
    if (/(无|不会|没有|失败|E-|E级|D级|不入评级|辅助人员)/.test(text)) dampen("training", 0.08);
  }
  if (bias.investigation > 0 && /(结果|影响|战局|阵营|是否参加|后|结局|大势)/.test(`${title} ${nodeId}`)) {
    if (/(情报|计划|抢到|夺回|封印失败|压制|成功|获胜|救|提前|掌握)/.test(text)) boost("investigation", 0.18);
  }
  if (bias.survival > 0) {
    if (/(跑路|撤退|活|存活|再战|支援|保命|未死|重伤|惨胜|旁观)/.test(text)) boost("survival", 0.25);
    if (/(死亡|死|腰斩|被秒|战至死亡|再起不能)/.test(text)) dampen("survival", 0.14);
  }
  if (bias.aggression > 0) {
    if (/(胜|战胜|击败|终结|压制|强攻|杀|斩|重创|削弱)/.test(text)) boost("aggression", 0.2);
    if (/(跑路|撤退|旁观|不参与|未参与)/.test(text)) dampen("aggression", 0.1);
  }
  if (bias.binding > 0 && /(束缚|代价|术式公开|限制|交换)/.test(text)) boost("binding", 0.22);
  if (bias.healing > 0 && /(治疗|反转|恢复|救治|重伤后|续命|活)/.test(text)) boost("healing", 0.2);

  return clamp(currentWeight * multiplier, 0, Math.max(currentWeight, baseWeight) * 6);
}

function isAiFreeGrowthTask(task) {
  const nodeId = task?.nodeId || "";
  if (isBaseAttributeTask(task)) return true;
  return [
    "grade",
    "talent",
    "innateTechnique",
    "familyInnateTechnique",
    "advancedTechniqueCount",
    "advancedTechniques",
    "domainEffectCount",
    "domainEffects",
    "hasTool",
    "toolCount",
    "tools",
    "effortLevel",
    "specialTalent",
    "heavenlyRestrictionType"
  ].includes(nodeId);
}

function isHighRankText(text) {
  const rank = parseRank(text);
  return rank ? rankValue(rank) >= rankValue("A") : /(特级|一级|特别一级|超一级|S|SS|EX)/.test(text);
}

function parseWeight(value) {
  return callSiteModuleImplementation("JJKLifeWheelRandom", "parseWeight", [value]);
}

function normalizeOptionText(task, text) {
  if (task?.nodeId === "grade" && (text.includes("不入评级") || text.includes("不如评级"))) {
    return "辅助人员";
  }
  if (task?.nodeId === "innateTechnique" || task?.nodeId === "familyInnateTechnique") {
    return getTechniqueProfileByText(text)?.displayName || text;
  }
  return text;
}

function buildOptionEffectIndex(config = {}) {
  const index = new Map();
  const textOnly = new Map();
  for (const record of config.records || []) {
    const wheelId = normalizeOptionEffectWheelId(record.wheelId);
    const optionText = normalizeOptionEffectText(record.optionText);
    if (!wheelId || !optionText) continue;
    const normalizedRecord = normalizeOptionEffectRecord({ ...record, wheelId, optionText });
    index.set(optionEffectKey(wheelId, optionText), normalizedRecord);
    if (!textOnly.has(optionText)) textOnly.set(optionText, []);
    textOnly.get(optionText).push(normalizedRecord);
  }
  index.textOnly = textOnly;
  return index;
}

function normalizeOptionEffectRecord(record) {
  const allowedTags = new Set(state.optionEffects?.allowedResultTags || []);
  const allowedEffectTypes = new Set(state.optionEffects?.allowedEffectTypes || []);
  return {
    ...record,
    resultTags: (record.resultTags || []).filter((tag) => !allowedTags.size || allowedTags.has(tag)),
    effects: (record.effects || []).filter((effect) => effect && (!allowedEffectTypes.size || allowedEffectTypes.has(effect.type)))
  };
}

function optionEffectKey(wheelId, optionText) {
  return `${wheelId}\n${normalizeOptionEffectText(optionText)}`;
}

function normalizeOptionEffectWheelId(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const numeric = raw.match(/\d+/)?.[0];
  if (!numeric) return "";
  return `W${String(Number(numeric)).padStart(3, "0")}`;
}

function normalizeOptionEffectText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function getOptionEffectRecord(task, text) {
  const optionText = normalizeOptionEffectText(text);
  if (!optionText || !state.optionEffectIndex) return null;
  const wheelId = normalizeOptionEffectWheelId(task?.wheelId);
  if (wheelId) {
    const exact = state.optionEffectIndex.get(optionEffectKey(wheelId, optionText));
    if (exact) return exact;
  }
  const matches = state.optionEffectIndex.textOnly?.get(optionText) || [];
  if (matches.length === 1) return matches[0];
  if (matches.length > 1 && task?.title) {
    return matches.find((record) => record.wheelTitle === task.title) || null;
  }
  return null;
}

function getOptionEffectTrace(task, text) {
  const record = getOptionEffectRecord(task, text);
  if (!record) return null;
  return {
    wheelId: record.wheelId,
    wheelTitle: record.wheelTitle || task?.title || "",
    optionText: record.optionText,
    resultTags: record.resultTags || [],
    effects: record.effects || [],
    evidenceStatus: record.evidenceStatus || "unknown",
    activationStatus: record.activationStatus || "active"
  };
}

function hasOptionResultTag(task, text, tag, trace = null) {
  const current = trace || getOptionEffectTrace(task, text);
  return Boolean(current?.resultTags?.includes(tag));
}

function getOptionEffectValue(trace, type, field = "value") {
  const effect = (trace?.effects || []).find((item) => item.type === type && item[field] !== undefined);
  return effect ? effect[field] : undefined;
}

function getOptionEffectValues(trace, type, field = "value") {
  return (trace?.effects || [])
    .filter((item) => item.type === type && item[field] !== undefined)
    .map((item) => item[field]);
}

function getOptionEffectWeightPolicy(trace) {
  return getOptionEffectValue(trace, "weightPolicy") || "";
}

function applyOptionEffects(task, text, trace = getOptionEffectTrace(task, text)) {
  if (!trace) return null;
  const tags = new Set(trace.resultTags || []);
  if (!Array.isArray(state.flags.optionEffectLog)) state.flags.optionEffectLog = [];
  state.flags.lastOptionEffect = trace;
  state.flags.optionEffectLog.push({
    wheelId: trace.wheelId,
    optionText: trace.optionText,
    resultTags: trace.resultTags,
    effects: trace.effects.map((effect) => effect.type)
  });
  if (state.flags.optionEffectLog.length > 40) state.flags.optionEffectLog.shift();

  if (tags.has("severeInjury")) {
    state.flags.severeInjury = true;
    state.flags.lastSevereInjuryResult = text;
  }
  if (tags.has("neutralRecord")) {
    state.flags.neutralRecordCount = Number(state.flags.neutralRecordCount || 0) + 1;
  }
  if (tags.has("hiddenStrengthEligible")) {
    state.flags.hiddenStrengthEligibleEvent = true;
  }
  if (tags.has("death") && shouldMarkDeathFromTask(task, text, trace)) {
    state.flags.dead = true;
  }

  for (const effect of trace.effects || []) {
    applySingleOptionEffect(effect, task, text, trace);
  }
  return trace;
}

function applySingleOptionEffect(effect, task, text, trace) {
  switch (effect.type) {
    case "skipPeriod":
      if (effect.value) state.flags.skipPeriods.add(effect.value);
      break;
    case "setFlag":
      if (effect.flag) state.flags[effect.flag] = effect.value;
      break;
    case "battleResult":
      if (effect.target) {
        if (effect.value === "未定") {
          delete state.flags[effect.target];
        } else {
          state.flags[effect.target] = effect.value;
        }
      }
      break;
    case "factionOutcome":
      applyFactionOutcomeEffect(effect, task, text);
      break;
    case "playerContribution":
      recordPlayerContributionEffect(effect, trace);
      break;
    case "hiddenStrengthEligibility":
      recordHiddenStrengthEligibility(effect, trace);
      break;
    case "deathOutcome":
      state.flags.deathMethod = effect.method || effect.value || text;
      break;
    default:
      break;
  }
}

function applyFactionOutcomeEffect(effect, task, text) {
  const value = String(effect.value || "");
  if (!value) return;
  state.flags.factionOutcome = value;
  state.flags.factionOutcomePerspective = effect.perspective || "";
  if (/highSchoolDefeated|sukunaWin|sukunaSideCounterWin/.test(value)) {
    state.flags.highSchoolDefeated = true;
  }
  if (/highSchoolWin|highSchoolCostlyWin|junpeiSaved|defectsAndSavesJunpei/.test(value)) {
    state.flags.highSchoolDefeated = false;
  }
  if (/joinsMahito/.test(value)) {
    lockFaction("羂索方");
  }
}

function recordPlayerContributionEffect(effect, trace) {
  if (!Array.isArray(state.flags.playerContributionEvents)) state.flags.playerContributionEvents = [];
  state.flags.playerContributionEvents.push({
    wheelId: trace.wheelId,
    optionText: trace.optionText,
    value: effect.value || "contextual",
    mode: effect.mode || ""
  });
}

function recordHiddenStrengthEligibility(effect, trace) {
  if (!Array.isArray(state.flags.hiddenStrengthEvents)) state.flags.hiddenStrengthEvents = [];
  state.flags.hiddenStrengthEvents.push({
    wheelId: trace.wheelId,
    optionText: trace.optionText,
    value: effect.value || "eligible"
  });
  state.flags.hiddenStrengthEligibleEvent = true;
}

function getAdjustedWeight(task, item, index, baseWeight, context = {}) {
  if (task?.type === "computed") return baseWeight;
  if (task?.nodeId === "identity") {
    return adjustIdentityWeight(item.text, baseWeight);
  }
  if (task?.nodeId === "location") {
    return adjustLocationWeight(task, item.text, baseWeight);
  }
  if (task?.nodeId === "jujutsuCouncilGate") {
    return adjustJujutsuCouncilGateWeight(item.text, baseWeight);
  }
  if (task?.nodeId === "highSchoolStatus") {
    return adjustHighSchoolStatusWeight(item.text, baseWeight);
  }
  if (isBaseAttributeTask(task)) {
    return adjustBaseAttributeRankWeight(item.text, baseWeight);
  }
  if (task?.title === "宿傩方在哪里" && state.flags.ancientSukunaAlly && item.text.includes("羂索")) {
    return 0;
  }
  if (task?.title === "决战宿傩入场顺序" || task?.title === "决战宿傩入场顺序（特级专属）") {
    return adjustSukunaEntryOrderWeight(task, item.text, baseWeight);
  }
  if (task?.nodeId === "shibuyaOutcome") {
    return adjustShibuyaOutcomeWeight(item.text, baseWeight);
  }
  let adjustedWeight = adjustStoryOutcomeWeight(task, item.text, baseWeight);
  adjustedWeight = adjustAppearanceMiguelBattleWeight(task, item.text, adjustedWeight);
  if (adjustedWeight !== baseWeight) return adjustedWeight;
  if (task?.nodeId === "grade") {
    return adjustGradeWeight(item.text, index, baseWeight);
  }
  if (task?.nodeId === "genderIdentity") {
    return adjustGenderIdentityWeight(item.text);
  }
  if (task?.nodeId === "familyInnateTechnique") {
    return adjustFamilyInnateTechniqueWeight(item.text);
  }
  if (task?.nodeId === "innateTechnique") {
    return adjustInnateTechniqueWeight(item.text, baseWeight);
  }
  if (task?.nodeId === "specialTalentGate") {
    return adjustSpecialTalentGateWeight(item.text, baseWeight);
  }
  if (task?.nodeId === "specialTalent") {
    return adjustSpecialTalentWeight(item.text, baseWeight);
  }
  if (task?.nodeId === "advancedTechniqueCount") {
    return adjustAdvancedTechniqueCountWeight(item.text, baseWeight);
  }
  if (task?.nodeId === "advancedTechniques") {
    return adjustAdvancedTechniqueWeight(item.text, baseWeight, context);
  }
  if (task?.nodeId === "domainType") {
    return adjustDomainTypeWeight(item.text, baseWeight);
  }
  if (task?.nodeId === "domainEffectCount") {
    return adjustDomainEffectCountWeight(item.text, baseWeight);
  }
  if (task?.nodeId === "domainEffects") {
    return adjustDomainEffectWeight(item.text, baseWeight);
  }
  if (task?.nodeId === "hasTool") {
    return adjustHasToolWeight(item.text, baseWeight);
  }
  if (task?.nodeId === "toolCount") {
    return adjustToolCountWeight(item.text, baseWeight);
  }
  if (task?.nodeId === "tools") {
    return adjustToolWeight(item.text, baseWeight);
  }
  return baseWeight;
}

function adjustIdentityWeight(text, baseWeight) {
  if (text === "咒术高层") return 0;
  return baseWeight;
}

function adjustLocationWeight(task, text, baseWeight) {
  if (!isSimuriaLocation(text)) return baseWeight;
  if (getStartPeriod() !== "after68") return 0;
  const wheel = getTaskWheel(task);
  const japan = (wheel?.items || []).find((item) => String(item.text || "") === "日本");
  const japanWeight = Number(japan?.weight || 50);
  return Math.max(0, japanWeight * 0.8);
}

function adjustJujutsuCouncilGateWeight(text, baseWeight) {
  if (text !== "是") return baseWeight;

  let multiplier = 1;
  if (state.flags.familyInheritedTechnique === true) multiplier *= 0.45;

  const status = state.flags.greatFamilyStatus || "";
  if (status.includes("家主兄弟姐妹")) multiplier *= 5;
  else if (status === "家主") multiplier *= 8;
  else if (status.includes("家主的孩子")) multiplier *= 3;
  else if (status.includes("被逐出家门")) multiplier *= 0.08;

  return Math.max(0.02, baseWeight * multiplier);
}

function adjustHighSchoolStatusWeight(text, baseWeight) {
  if (state.flags.jujutsuCouncil === true && text === "学生") return 0;
  return baseWeight;
}

function adjustAppearanceMiguelBattleWeight(task, text, baseWeight) {
  if (!state.flags.appearanceMiguelDebuff) return baseWeight;
  if (!hasMiguelOpponentEncounter()) return baseWeight;
  if (!isMiguelEncounterBattleTask(task)) return baseWeight;
  return isPositiveBattleOutcome(text) ? baseWeight * 1.2 : baseWeight;
}

function isMiguelEncounterBattleTask(task) {
  return task?.title === "车轮战结果（第三方敌对）" ||
    task?.title === "车轮战结果" ||
    task?.title === "战斗结果";
}

function isPositiveBattleOutcome(text) {
  return text === "胜" || /战胜|胜利|获胜|击败|压制/.test(text);
}

function adjustGenderIdentityWeight(text) {
  const gender = state.flags.gender || getAnswerText("gender");
  const profiles = {
    男: {
      男: 62,
      女: 4,
      跨男: 0,
      跨女: 4,
      男娘: 12,
      假小子: 2,
      性别岂是这种不变之物: 8,
      非二元: 7
    },
    女: {
      男: 4,
      女: 62,
      跨男: 4,
      跨女: 0,
      男娘: 2,
      假小子: 12,
      性别岂是这种不变之物: 8,
      非二元: 7
    },
    非二元性别: {
      男: 10,
      女: 10,
      跨男: 3,
      跨女: 3,
      男娘: 6,
      假小子: 6,
      性别岂是这种不变之物: 22,
      非二元: 40
    }
  };
  const profile = profiles[gender] || profiles.非二元性别;
  return profile[text] ?? 0;
}

function adjustFamilyInnateTechniqueWeight(text) {
  const family = state.flags.greatFamily || "";
  if (family.includes("五条")) return text === "无下限" ? 1 : 0;
  if (family.includes("加茂")) return text === "赤血操术" ? 1 : 0;
  if (family.includes("禅院")) {
    if (text === "十种影法术") return 9;
    if (text === "投射咒法") return 1;
    return 0;
  }
  return 0;
}

function adjustInnateTechniqueWeight(text, baseWeight) {
  if (state.flags.simuriaTechniqueWeightBoost !== true) return baseWeight;
  if (text.includes("混沌与调和") || text.includes("光 / 具象化杀意")) {
    return baseWeight * 3;
  }
  return baseWeight;
}

function adjustStoryOutcomeWeight(task, text, baseWeight) {
  if (!isStoryOutcomeTask(task)) return baseWeight;
  const optionEffectTrace = getOptionEffectTrace(task, text);
  const risk = getStoryOutcomeRisk(text, task, optionEffectTrace);
  const benefit = getStoryOutcomeBenefit(text, task, optionEffectTrace);
  if (risk === 0 && benefit === 0) return baseWeight;

  const strength = buildStrengthSnapshot();
  if (!strength) return baseWeight;
  const combatProfile = strength.instantCombatProfile;
  const fallbackUnit = buildCombatPowerUnit(combatProfile?.instantPowerScore ?? strength.gradeEffectiveScore);
  let combatUnit = combatProfile?.combatPowerUnit?.value ?? fallbackUnit.value;
  combatUnit = Math.round(combatUnit * getSukunaBattleContextMultiplier(task, combatProfile, strength));
  const poolPolicy = getOutcomePoolWeightPolicy(task);
  const optionWeightPolicy = getOptionEffectWeightPolicy(optionEffectTrace);
  if (optionWeightPolicy === "factionContributionOnly") {
    return adjustFactionContributionOutcomeWeight(baseWeight, combatUnit, optionEffectTrace);
  }
  let multiplier = 1;

  if (risk >= 3) {
    if (combatUnit >= 5200) multiplier *= 0.08;
    else if (combatUnit >= 2100) multiplier *= 0.22;
    else if (combatUnit >= 850) multiplier *= 0.62;
    else multiplier *= 1.45;
  } else if (risk === 2) {
    if (combatUnit >= 5200) multiplier *= 0.18;
    else if (combatUnit >= 2100) multiplier *= 0.38;
    else if (combatUnit >= 850) multiplier *= 0.72;
    else multiplier *= 1.35;
  } else if (risk === 1) {
    if (combatUnit >= 5200) multiplier *= 0.48;
    else if (combatUnit >= 2100) multiplier *= 0.72;
    else if (combatUnit < 420) multiplier *= 1.18;
  }

  if (benefit > 0) {
    if (combatUnit >= 5200) multiplier *= 1.8 + benefit * 0.28;
    else if (combatUnit >= 2100) multiplier *= 1.35 + benefit * 0.16;
    else if (combatUnit < 420) multiplier *= 0.78;
  }

  if (poolPolicy === "light") {
    multiplier = 1 + clamp(multiplier - 1, -0.35, 0.45);
  }

  return Math.max(0.05, baseWeight * multiplier);
}

function adjustFactionContributionOutcomeWeight(baseWeight, combatUnit, trace) {
  const contributions = getOptionEffectValues(trace, "playerContribution");
  if (!contributions.length) return baseWeight;
  let multiplier = 1;
  for (const value of contributions) {
    const contribution = String(value || "");
    if (contribution === "positive") {
      if (combatUnit >= 5200) multiplier *= 1.72;
      else if (combatUnit >= 2100) multiplier *= 1.34;
      else if (combatUnit < 420) multiplier *= 0.72;
    } else if (contribution === "costlyPositive") {
      if (combatUnit >= 5200) multiplier *= 1.45;
      else if (combatUnit >= 2100) multiplier *= 1.2;
      else if (combatUnit < 420) multiplier *= 0.82;
    } else if (contribution === "negative") {
      if (combatUnit >= 5200) multiplier *= 0.35;
      else if (combatUnit >= 2100) multiplier *= 0.58;
      else if (combatUnit < 420) multiplier *= 1.35;
    } else if (contribution === "contextual") {
      if (combatUnit >= 5200) multiplier *= 1.18;
      else if (combatUnit < 420) multiplier *= 0.9;
    }
  }
  return Math.max(0.05, baseWeight * clamp(multiplier, 0.18, 2.1));
}

function getOutcomePoolWeightPolicy(task) {
  const title = String(task?.title || "");
  const hardPatterns = [
    "战斗",
    "战绩",
    "战败",
    "战胜",
    "宿傩",
    "二番战",
    "第三回合",
    "车轮战",
    "保卫",
    "守卫",
    "参战",
    "百鬼夜行结果",
    "死灭回游结果"
  ];
  if (hardPatterns.some((keyword) => title.includes(keyword))) return "hard";
  const lightPatterns = [
    "评价",
    "投币",
    "是否",
    "阵营",
    "加入",
    "在哪里",
    "到来结果",
    "后代",
    "政治",
    "关系"
  ];
  if (lightPatterns.some((keyword) => title.includes(keyword))) return "light";
  return "light";
}

function getSukunaBattleContextMultiplier(task, profile = {}, strength = {}) {
  if (!isDirectSukunaBattleTask(task)) return 1;
  if (state.flags.faction === "宿傩方") return 1;
  const stage = Number(state.flags.sukunaEntryStage);
  const hasExCounter = hasAfter68ExAnchorSukunaCounter(profile, strength);
  const configured = Number(state.flags.sukunaBattleUnitMultiplier);
  if (Number.isFinite(configured) && configured > 0) {
    if (hasExCounter && stage >= 5) return Math.max(configured, 1.9);
    return clamp(configured, 0.55, 5);
  }
  if (!Number.isFinite(stage)) return 1;
  if (hasExCounter && stage >= 5) return 1.9;
  if (stage >= 5) return 0.62;
  if (stage >= 4) return 0.82;
  if (stage >= 3) return 1.05;
  if (stage >= 2) return 1.32;
  if (stage >= 1.5) return 1.55;
  if (stage >= 1) return 1.85;
  if (stage >= 0.5) return 2.3;
  if (stage >= 0) return 3.2;
  return 5;
}

function hasAfter68ExAnchorSukunaCounter(profile = {}, strength = {}) {
  const tags = new Set(profile.tags || []);
  const raw = strength.raw || {};
  const isAfter68 = profile.stage?.period === "after68" || state.flags.aliveAfter68 === true || getStartPeriod() === "after68";
  const hasExAnchor = tags.has("exAnchor") || Number(raw.controlScore || 0) >= 10 || Number(raw.talentScore || 0) >= 10;
  const hasSukunaClassBody =
    Number(raw.cursedEnergyScore || 0) >= 8 &&
    Number(raw.efficiencyScore || 0) >= 8 &&
    Number(raw.bodyScore || 0) >= 8 &&
    Number(raw.martialScore || 0) >= 8;
  const hasYujiFinishRoute = tags.has("blackFlashAtWill") || tags.has("curseObjectSedimentation") || tags.has("curseHybrid");
  return isAfter68 && hasExAnchor && hasSukunaClassBody && hasYujiFinishRoute;
}

function isDirectSukunaBattleTask(task) {
  const title = String(task?.title || "");
  if (!title) return false;
  if (title.includes("战胜宿傩后")) return false;
  return title.includes("宿傩") ||
    title.includes("二番战") ||
    title.includes("第三回合");
}

function adjustShibuyaOutcomeWeight(text, baseWeight) {
  const preferred = getPreferredShibuyaOutcome();
  if (!preferred) return baseWeight;
  if (state.flags.participatesShibuya !== true) {
    return text === preferred ? baseWeight * 100 : 0;
  }
  return text === preferred ? baseWeight * 5 : baseWeight;
}

function getPreferredShibuyaOutcome() {
  if (state.flags.participatesShibuya !== true) return "诅咒师胜利";
  if (state.flags.kenjakuPlanState === "stopped" || state.flags.gojoShibuyaState === "unsealed") return "高专胜利";
  if (state.flags.faction === "高专方") return "高专胜利";
  if (state.flags.faction === "羂索方" || state.flags.faction === "第三方" || getEffectiveIdentity() === "诅咒师") {
    return "诅咒师胜利";
  }
  if (getEffectiveIdentity() === "咒灵" || state.flags.faction === "宿傩方") return "咒灵胜利";
  return "";
}

function adjustSukunaEntryOrderWeight(task, text, baseWeight) {
  const profile = buildStrengthSnapshot()?.instantCombatProfile;
  if (!profile?.combatPowerUnit) return baseWeight;
  const unit = Number(profile.combatPowerUnit.value || 0);
  const desiredStage = getRecommendedSukunaEntryStage(unit, profile);
  const optionStage = getSukunaEntryStage(text);
  if (!optionStage) return baseWeight;
  const distance = Math.abs(optionStage.stage - desiredStage.stage);
  let multiplier = Math.exp(-(distance * distance) / (2 * 0.95 * 0.95));
  multiplier = 0.12 + multiplier * 4.8;

  if (text.includes("五条前") && desiredStage.stage < 5) multiplier *= 0.08;
  if (text.includes("五条前") && desiredStage.stage === 5) multiplier *= 1.45;
  if (text.includes("负责收菜")) {
    if (desiredStage.stage >= 4) multiplier *= 0.18;
    if (unit < 700) multiplier *= 18;
    else if (unit < 850) multiplier *= 4;
  }
  if (text.includes("打一坨")) {
    multiplier *= 0.06;
  }
  if (task.title.includes("特级") && optionStage.stage < 2) multiplier *= 0.45;
  if (!task.title.includes("特级") && optionStage.stage > 3 && unit < 5200) multiplier *= 0.25;

  return Math.max(0.02, baseWeight * multiplier);
}

function getRecommendedSukunaEntryStage(unit, profile = {}) {
  const tags = new Set(profile.tags || []);
  const disruption = Number(profile.disruptionUnit?.score || 0);
  const effectiveUnit = Number(unit || 0) * (1 + Math.min(0.18, disruption * 0.018));
  if (effectiveUnit >= 10000 || tags.has("exAnchor")) {
    return { stage: 5, label: "五条前十影宿傩" };
  }
  if (effectiveUnit >= 5600) return { stage: 4, label: "五条战败后一削宿傩" };
  if (effectiveUnit >= 3600) return { stage: 3, label: "鹿紫云后一到二削原身宿傩" };
  if (effectiveUnit >= 2100) return { stage: 2, label: "众人二削宿傩" };
  if (effectiveUnit >= 700) return { stage: 1, label: "三削到四削宿傩" };
  return { stage: 0.5, label: "五削后虎杖终结阶段/后置支援" };
}

function getSukunaEntryStage(text) {
  if (text.includes("五条前")) {
    return {
      stage: 5,
      nerfStage: "fullTenShadows",
      label: "五条前十影宿傩",
      battleUnitMultiplier: 0.62,
      nerfDetails: ["十影资源完整", "魔虚罗/嵌合兽可用", "可用束缚兑现世界斩"]
    };
  }
  if (text.includes("五条战败后") || text.includes("一削")) {
    return {
      stage: 4,
      nerfStage: "firstNerfAfterGojo",
      label: "五条战败后一削宿傩",
      battleUnitMultiplier: 0.82,
      nerfDetails: ["领域熔断", "反转输出下降", "十影资源大幅消耗"]
    };
  }
  if (text.includes("鹿紫云") || text.includes("原身")) {
    return {
      stage: 3,
      nerfStage: "heianBodyAfterKashimo",
      label: "鹿紫云后一到二削原身宿傩",
      battleUnitMultiplier: 1.05,
      nerfDetails: ["原身受肉后仍有战损", "神武解可被日车领域没收", "反转输出下降"]
    };
  }
  if (text.includes("二削") || text.includes("众人一起")) {
    return {
      stage: 2,
      nerfStage: "secondNerfGroupFight",
      label: "高专众人二削宿傩",
      battleUnitMultiplier: 1.32,
      nerfDetails: ["咒具没收", "领域熔断/展开受限", "车轮战消耗"]
    };
  }
  if (text.includes("米格尔") || text.includes("三削")) {
    return {
      stage: 1.5,
      nerfStage: "thirdNerfMiguelPhase",
      label: "米格尔三削宿傩",
      battleUnitMultiplier: 1.55,
      nerfDetails: ["咒具没收", "反转输出下降", "肉体/灵魂伤累积"]
    };
  }
  if (text.includes("东堂") || text.includes("四削")) {
    return {
      stage: 1,
      nerfStage: "fourthNerfTodoYujiPhase",
      label: "东堂虎杖四削宿傩",
      battleUnitMultiplier: 1.85,
      nerfDetails: ["东堂/虎杖连携压制", "黑闪与灵魂打击累积", "输出稳定性下降"]
    };
  }
  if (text.includes("黑闪王") || text.includes("五削")) {
    return {
      stage: 0.5,
      nerfStage: "fifthNerfBlackFlashYujiPhase",
      label: "黑闪王虎杖五削宿傩",
      battleUnitMultiplier: 2.3,
      nerfDetails: ["虎杖黑闪终结阶段", "灵魂边界崩坏", "反转与领域基本失速"]
    };
  }
  if (text.includes("负责收菜")) {
    return {
      stage: 0,
      nerfStage: "collapsedSukuna",
      label: "收菜阶段",
      battleUnitMultiplier: 3.2,
      nerfDetails: ["濒临崩溃", "只剩收尾风险"]
    };
  }
  if (text.includes("一坨")) {
    return {
      stage: -0.5,
      nerfStage: "memeYujiFinish",
      label: "一坨宿傩（玩梗，虎杖终结后）",
      battleUnitMultiplier: 5,
      nerfDetails: ["玩梗项", "虎杖终结后"]
    };
  }
  return null;
}

function isStoryOutcomeTask(task) {
  if (!task) return false;
  return String(task.stage || "").startsWith("剧情") ||
    [
      "交流会结果",
      "百鬼夜行结果（高专方）",
      "百鬼夜行结果（夏油杰方）",
      "保卫理子后",
      "守卫天元结果",
      "涩谷事变后状态",
      "死灭回游结果",
      "参加死灭结果（弱者专属）",
      "参战宿傩后",
      "参战宿傩后（特级专属）",
      "二番战战绩",
      "二番战（特级专属）",
      "第三回合（特级专属）",
      "战胜宿傩后结果",
      "战胜宿傩后（特级专属）",
      "战败结局",
      "68年后外星人到来结果"
    ].includes(task.title);
}

function getStoryOutcomeRisk(text, task = null, trace = null) {
  const current = trace || getOptionEffectTrace(task, text);
  const explicit = Math.max(0, ...getOptionEffectValues(current, "storyRisk").map(Number).filter(Number.isFinite));
  if (explicit > 0) return explicit;
  if (hasOptionResultTag(task, text, "death", current)) return 3;
  if (hasOptionResultTag(task, text, "severeInjury", current)) return 2;
  if (hasOptionResultTag(task, text, "negative", current)) return 1;
  if (/(当场暴毙|死亡|死了|战死|战至死亡|牺牲|去世|被杀|腰斩|送菜)/.test(text)) return 3;
  if (/(重伤|无法参与|不能参加|再起不能|死伤惨重|被无为转变|被清算|不敌|败退)/.test(text)) return 2;
  if (/(轻伤|跑路|逃窜|没有改变任何事|边缘支援|实力大减|负|败)/.test(text)) return 1;
  return 0;
}

function getStoryOutcomeBenefit(text, task = null, trace = null) {
  const current = trace || getOptionEffectTrace(task, text);
  const explicit = getOptionEffectValues(current, "storyBenefit").map(Number).filter(Number.isFinite);
  if (explicit.length) return Math.max(0, ...explicit);
  let value = 0;
  if (hasOptionResultTag(task, text, "positive", current)) value += 1;
  if (hasOptionResultTag(task, text, "hiddenStrengthEligible", current)) value += 1;
  if (/(无伤|状态超好|问题不大|无伤大雅|存活|活着)/.test(text)) value += 1;
  if (/(成功|击败|战胜|胜|压制|终结|解救|拯救|守护成功|获胜)/.test(text)) value += 1;
  if (/(速通|唯一胜者|史上最强)/.test(text)) value += 1;
  return value;
}

function adjustGradeWeight(text, index, baseWeight) {
  // Legacy weighted grade-wheel path; the current flow uses computedGrade.
  const scores = computeScores();
  if (!scores) return baseWeight;

  const gradeKey = mapGrade(text);
  const targets = {
    support: 0.8,
    grade4: 2.4,
    grade3: 4,
    grade2: 5.55,
    grade1: 6.55,
    semiSpecialGrade1: 9.25,
    specialGrade: 10.4
  };
  Object.assign(targets, state.strength?.gradeDistributionPrior?.targets || {});

  const floorGrade = getGradeFloor(scores);
  if (isGradeBelow(gradeKey, floorGrade)) return 0;

  const target = targets[gradeKey] ?? 3;
  const effectiveScore = computeGradeEffectiveScore(scores);
  const distance = Math.abs(effectiveScore - target);
  const curve = Math.exp(-(distance * distance) / (2 * 1.15 * 1.15));
  let multiplier = 0.06 + 10 * curve;

  if (gradeKey === "specialGrade" && effectiveScore < 6.4) multiplier *= 0.32;
  if (gradeKey === "semiSpecialGrade1" && effectiveScore < 5.3) multiplier *= 0.5;
  if ((gradeKey === "support" || gradeKey === "grade4") && effectiveScore > 4.5) multiplier *= 0.18;
  if (gradeKey === "grade1" && scores.highCounts.aPlus >= 3) multiplier *= 1.35;
  if (gradeKey === "semiSpecialGrade1" && scores.highCounts.sPlus >= 3) multiplier *= 1.35;
  if (gradeKey === "specialGrade" && scores.highCounts.ssPlus >= 3) multiplier *= 1.5;
  multiplier *= getGradeDistributionPrior(gradeKey);

  return Math.max(0.05, baseWeight * multiplier);
}

function getGradeDistributionPrior(gradeKey) {
  const configured = Number(state.strength?.gradeDistributionPrior?.multipliers?.[gradeKey]);
  if (Number.isFinite(configured) && configured > 0) return configured;
  const defaults = {
    support: 0.3,
    grade4: 0.45,
    grade3: 0.55,
    grade2: 2,
    grade1: 2.75,
    semiSpecialGrade1: 0.09,
    specialGrade: 0.03
  };
  return defaults[gradeKey] ?? 1;
}

function resolveDeterministicGrade() {
  const scores = computeScores();
  if (!scores) {
    const fallbackRange = getDeterministicGradeRanges()[0];
    return {
      key: "support",
      label: gradeLabel("support"),
      baseKey: "support",
      baseLabel: gradeLabel("support"),
      score: 0,
      range: fallbackRange,
      rangeText: formatGradeRange(fallbackRange),
      floorKey: "support",
      floorLabel: gradeLabel("support"),
      floorApplied: false
    };
  }

  const score = computeGradeEffectiveScore(scores);
  const ranges = getDeterministicGradeRanges();
  const range = ranges.find((item) => score >= item.min && (item.max == null || score < item.max)) || ranges[ranges.length - 1];
  const baseKey = range.grade;
  const floorKey = getGradeFloor(scores);
  const finalKey = isGradeBelow(baseKey, floorKey) ? floorKey : baseKey;

  return {
    key: finalKey,
    label: gradeLabel(finalKey),
    baseKey,
    baseLabel: gradeLabel(baseKey),
    score,
    range,
    rangeText: formatGradeRange(range),
    floorKey,
    floorLabel: gradeLabel(floorKey),
    floorApplied: finalKey !== baseKey
  };
}

function getDeterministicGradeRanges() {
  const configured = state.strength?.deterministicGradeRanges?.ranges;
  const ranges = Array.isArray(configured) && configured.length ? configured : [
    { grade: "support", min: 0, max: 1.3 },
    { grade: "grade4", min: 1.3, max: 2.2 },
    { grade: "grade3", min: 2.2, max: 3.2 },
    { grade: "grade2", min: 3.2, max: 4.6 },
    { grade: "grade1", min: 4.6, max: 6.2 },
    { grade: "semiSpecialGrade1", min: 6.2, max: 7.6 },
    { grade: "specialGrade", min: 7.6, max: null }
  ];
  return ranges.map((item) => ({
    grade: item.grade,
    min: Number(item.min) || 0,
    max: Number.isFinite(Number(item.max)) ? Number(item.max) : null
  }));
}

function formatGradeRange(range) {
  const min = formatNumber(range?.min ?? 0);
  const max = range?.max == null ? "10" : `<${formatNumber(range.max)}`;
  return `${min} - ${max}`;
}

function computeGradeEffectiveScore(scores, options = {}) {
  const values = Object.values(scores.raw).sort((a, b) => b - a);
  const topPackage =
    0.38 * scores.basePowerScore +
    0.28 * (values[0] || 0) +
    0.20 * (values[1] || 0) +
    0.14 * (values[2] || 0);
  const highCountBonus =
    scores.highCounts.aPlus * 0.20 +
    scores.highCounts.sPlus * 0.18 +
    scores.highCounts.ssPlus * 0.15 +
      scores.highCounts.sssPlus * 0.12;
  let effectiveScore = topPackage + highCountBonus + computeAbilityBuildBonus(options);

  if (scores.raw.martialScore >= 6 && scores.raw.bodyScore >= 7) {
    effectiveScore = Math.max(effectiveScore, 5.35);
  }
  if (scores.raw.martialScore >= 8 && scores.raw.bodyScore >= 8) {
    effectiveScore = Math.max(effectiveScore, 6.35);
  }

  return clamp(effectiveScore, 0, 10);
}

function createEffortEffects(text = "") {
  const effects = {
    level: text,
    advancedTechniqueDelta: 0,
    toolCountDelta: 0,
    buildBonus: 0,
    weakBoosts: [],
    allPanelBoost: 0,
    peakBoost: 0,
    labels: []
  };

  const addAdvancedTechniqueChance = (chance, label) => {
    if (effects.advancedTechniqueDelta >= EFFORT_ADVANCED_TECHNIQUE_CAP) {
      effects.labels.push(`${label}（高级技巧数量已达努力上限）`);
      return;
    }
    if (Math.random() < chance) {
      effects.advancedTechniqueDelta += 1;
      effects.labels.push("高级技巧数量 +1（努力小概率）");
      return;
    }
    effects.labels.push(`${label}（未转化为数量）`);
  };

  const addReward = (rewardId) => {
    if (rewardId === 1) {
      addAdvancedTechniqueChance(0.22, "高级技巧学习倾向微升");
    } else if (rewardId === 2) {
      effects.weakBoosts.push({ count: 1, amount: 1 });
      effects.labels.push("一个弱项 +1");
    } else if (rewardId === 3) {
      addAdvancedTechniqueChance(0.38, "高级技巧学习倾向上升");
    } else if (rewardId === 4) {
      effects.weakBoosts.push({ count: 1, amount: 2 });
      effects.labels.push("一个弱项 +2");
    } else if (rewardId === 5) {
      effects.weakBoosts.push({ count: 3, amount: 1 });
      effects.labels.push("三处弱项 +1");
    } else if (rewardId === 6) {
      effects.weakBoosts.push({ count: 2, amount: 2 });
      effects.labels.push("两处弱项 +2");
    } else if (rewardId === 7) {
      effects.allPanelBoost = Math.max(effects.allPanelBoost, 1);
      effects.labels.push("全战力面板 +1（最高至 SSS）");
    } else if (rewardId === 8) {
      effects.peakBoost = Math.max(effects.peakBoost, 2);
      effects.labels.push("最高项 +2（可到 EX）");
    }
  };

  if (text.includes("彻底摆烂")) {
    if (Math.random() < 0.5) {
      effects.advancedTechniqueDelta -= 1;
      effects.labels.push("高级技巧数量 -1");
    } else {
      const value = randomInt(1, 3);
      effects.toolCountDelta -= value;
      effects.labels.push(`咒具数量 -${value}`);
    }
    effects.buildBonus -= 0.18;
    return effects;
  }

  if (text.includes("懒惰")) {
    effects.labels.push("无加强");
    return effects;
  }

  if (text.includes("不太想动") || text === "一般") {
    addReward(randomPick([1, 2]));
    return effects;
  }

  if (text.includes("比较勤奋")) {
    addReward(randomPick([1, 2]));
    addReward(randomPick([3, 4]));
    return effects;
  }

  if (text.includes("非常勤奋")) {
    addReward(1);
    addReward(2);
    addReward(randomPick([3, 4]));
    addReward(randomPick([5, 6, 7, 8]));
    return effects;
  }

  if (text.includes("持之以恒")) {
    addReward(1);
    addReward(2);
    addReward(randomPick([3, 4]));
    for (const rewardId of randomSample([5, 6, 7, 8], 2)) addReward(rewardId);
  }

  return effects;
}

function describeEffortEffects(effects = {}) {
  const labels = effects.labels || [];
  return labels.length ? labels.join("；") : "无修正";
}

function getEffortBuildBonus() {
  return Number(state.flags.effortEffects?.buildBonus || 0);
}

function applyEffortScoreEffects(raw) {
  const effects = state.flags.effortEffects;
  if (!effects) return;
  const keys = Object.keys(raw);
  if (effects.allPanelBoost) {
    for (const key of keys) {
      raw[key] = Math.min(8, raw[key] + effects.allPanelBoost);
    }
  }
  for (const boost of effects.weakBoosts || []) {
    const targets = keys
      .slice()
      .sort((left, right) => raw[left] - raw[right])
      .slice(0, Math.max(0, Number(boost.count) || 0));
    for (const key of targets) {
      raw[key] = Math.min(8, raw[key] + (Number(boost.amount) || 0));
    }
  }
  if (effects.peakBoost) {
    const peakKey = keys.slice().sort((left, right) => raw[right] - raw[left])[0];
    if (peakKey) raw[peakKey] = Math.min(12, raw[peakKey] + effects.peakBoost);
  }
}

function getFlavorScoreModifiers() {
  const modifiers = {
    resource: 0,
    control: 0,
    body: 0,
    growth: 0
  };
  const personalityModifier = getPersonalityTechniqueModifier(state.flags.personality);
  modifiers.resource += personalityModifier * 0.22;
  modifiers.control += personalityModifier * 0.40;
  modifiers.growth += personalityModifier * 0.18;

  const nature = state.flags.cursedEnergyNature || "";
  if (nature.includes("粗糙")) {
    modifiers.resource += 0.12;
    modifiers.control -= 0.08;
  }
  if (nature.includes("具有属性")) {
    modifiers.resource += 0.10;
    modifiers.control += 0.06;
  }
  if (nature.includes("细腻")) modifiers.control += 0.16;
  if (nature.includes("随") && nature.includes("心")) {
    modifiers.resource += 0.14;
    modifiers.control += 0.22;
  }

  const color = state.flags.cursedEnergyColor || "";
  if (color.includes("红色")) {
    modifiers.resource += 0.14;
    modifiers.control -= 0.06;
  }
  if (color.includes("纯黑色")) modifiers.resource += 0.24;
  if (color.includes("黑红色")) {
    modifiers.body += 0.10;
    modifiers.control += 0.08;
  }
  if (color.includes("紫色")) modifiers.control += 0.06;

  for (const key of Object.keys(modifiers)) {
    modifiers[key] = clamp(modifiers[key], -0.35, 0.35);
  }
  return modifiers;
}

function getFlavorBuildBonus() {
  let bonus = clamp(getPersonalityTechniqueModifier(state.flags.personality) * 0.32, -0.18, 0.35);
  const bindingCount = Number(state.flags.bindingCount || 0);
  bonus += Math.min(0.22, bindingCount * 0.04);
  if (hasAdvancedTechnique("无敌贷款王")) {
    const sweet = state.flags.sweetPreference || "";
    if (sweet.includes("天生理解束缚") || sweet.includes("五条悟级")) bonus += 0.10;
    else if (sweet.includes("束缚狂热") || sweet.includes("狂热")) bonus += 0.08;
    else if (sweet.includes("善用束缚") || sweet.includes("喜爱")) bonus += 0.04;
    else if (sweet.includes("排斥束缚") || sweet.includes("讨厌")) bonus -= 0.04;
  }
  bonus += getEffortBuildBonus();
  return clamp(bonus, -0.25, 0.55);
}

function getBindingAffinityMultiplier() {
  if (state.flags.bindingProfileGate === "否" || state.flags.hasBindingProfile === false) return 0;
  const count = Number(state.flags.bindingCount || 0);
  let multiplier = 1 + Math.min(0.75, count * 0.10);
  const sweet = state.flags.sweetPreference || "";
  if (sweet.includes("天生理解束缚") || sweet.includes("五条悟级")) multiplier *= 1.15;
  else if (sweet.includes("束缚狂热") || sweet.includes("狂热")) multiplier *= 1.10;
  else if (sweet.includes("善用束缚") || sweet.includes("喜爱")) multiplier *= 1.04;
  else if (sweet.includes("排斥束缚") || sweet.includes("讨厌")) multiplier *= 0.95;
  return clamp(multiplier, 0.9, 1.9);
}

function getPersonalityTechniqueModifier(text = "") {
  if (!text) return 0;
  if (text.includes("至最高")) return 0.52;
  if (text.includes("加四级")) return 0.42;
  if (text.includes("加三级")) return 0.32;
  if (text.includes("加二级")) return 0.22;
  if (text.includes("加一级")) return 0.14;
  if (text.includes("减四级")) return -0.42;
  if (text.includes("减三级")) return -0.32;
  if (text.includes("减二级")) return -0.22;
  if (text.includes("减一级")) return -0.14;
  return 0;
}

function computeAbilityBuildBonus(options = {}) {
  let bonus = 0;
  const advanced = state.flags.advancedTechniques || [];
  const specialTalent = state.flags.specialTalent || "";
  const tools = state.flags.tools || [];
  const scores = options.scores || computeScores();
  const includeTechniqueSynergy = options.includeTechniqueSynergy !== false;

  bonus += advanced.length * 0.12;
  if (hasDomainExpansionTechnique()) bonus += 0.62;
  if (hasExactAdvancedTechniqueInContext("反转术式")) bonus += 0.28;
  if (hasAdvancedTechnique("反转术式外放")) bonus += 0.42;
  if (hasAdvancedTechnique("术式反转")) bonus += 0.32;
  if (hasAdvancedTechnique("领域展延")) bonus += 0.28;
  if (hasAdvancedTechnique("极之番")) bonus += 0.34;
  if (hasAdvancedTechnique("黑闪")) bonus += 0.22;
  if (hasAdvancedTechnique("简易领域")) bonus += 0.16;
  if (hasAdvancedTechnique("制作咒具")) bonus += 0.18;

  if (specialTalent.includes("六眼")) bonus += 0.95;
  if (isZeroCursedEnergyHeavenlyRestriction()) bonus += 0.42;
  if (isCursedEnergyBoostHeavenlyRestriction()) bonus += 0.22;
  if (specialTalent.includes("双面四臂")) bonus += 0.68;
  if (specialTalent.includes("半人半咒")) bonus += 0.38;

  if (getAnswerText("hasTool") === "是") bonus += 0.18;
  bonus += Math.min(0.36, Number(state.flags.toolCount || 0) * 0.09);
  for (const tool of tools) {
    if (tool.includes("天逆") || tool.includes("黑绳") || tool.includes("狱门疆")) bonus += 0.38;
    else if (tool.includes("释魂刀") || tool.includes("神武解") || tool.includes("飞天")) bonus += 0.30;
    else if (tool.includes("游云") || tool.includes("龙骨") || tool.includes("万里锁")) bonus += 0.18;
  }

  if ((state.flags.domainEffects || []).length >= 3) bonus += 0.18;
  if ((state.flags.binding || "").includes("增强全属性")) bonus += 0.28;
  if ((state.flags.binding || "").includes("自身活着为代价")) bonus += 0.18;
  bonus += computeWealthTechniqueBonus();
  if (getEffectiveIdentity() === "咒灵") {
    bonus += computeCurseAbilityBonus();
  }
  if (includeTechniqueSynergy && scores) {
    bonus += computeTechniqueSynergyBreakdown(scores).gradeBonus;
  }
  bonus += getFlavorBuildBonus();

  return Math.min(3.0, bonus);
}

function computeWealthTechniqueBonus() {
  if (!hasRecontractTechnique()) return 0;
  const rank = parseRank(state.flags.assets || getAnswerText("assets"));
  if (rank === "SSS" || rank === "EX") return 1.75;
  if (rank === "SS") return 1.45;
  if (rank === "S") return 1.10;
  if (rank === "A") return 0.75;
  return 0;
}

function hasRecontractTechnique() {
  const values = [
    state.flags.innateTechnique,
    state.flags.innateTechniqueRaw,
    ...(state.flags.customTechniqueTypes || [])
  ];
  for (const [nodeId, answer] of Object.entries(state.answers || {})) {
    if (nodeId === "innateTechnique" || nodeId.startsWith("custom")) {
      values.push(answer?.text);
      if (Array.isArray(answer?.results)) {
        values.push(...answer.results.map((item) => item.text));
      }
    }
  }
  return values.filter(Boolean).some((value) => String(value).includes("再契象"));
}

function isBaseAttributeTask(task) {
  return ["cursedEnergy", "control", "martial", "body", "efficiency", "talent"].includes(task?.nodeId);
}

function adjustBaseAttributeRankWeight(text, baseWeight) {
  const rank = parseRank(text);
  const configured = Number(state.strength?.baseAttributeRankWeights?.[rank]);
  if (Number.isFinite(configured) && configured > 0) return configured;
  return baseWeight;
}

function getTechniqueProfileByText(text = "") {
  const profiles = state.strength?.techniqueProfiles || {};
  const value = String(text || "");
  if (!value) return null;
  if (profiles[value]) return profiles[value];
  return Object.values(profiles).find((profile) => profile.displayName === value) || null;
}

function getCurrentTechniqueProfile() {
  return getTechniqueProfileByText(state.flags.innateTechniqueRaw) ||
    getTechniqueProfileByText(state.flags.innateTechnique) ||
    null;
}

function getCurrentTechniqueText() {
  return state.flags.innateTechniqueRaw || state.flags.innateTechnique || "";
}

function hasTechniqueTag(tag) {
  const profile = getCurrentTechniqueProfile();
  return (profile?.tags || []).includes(tag);
}

function computeTechniqueSynergyBreakdown(scores) {
  const profile = getCurrentTechniqueProfile();
  if (!profile || !hasTechniqueNow()) {
    return {
      profile: null,
      displayName: "",
      baseBonus: 0,
      attributeBonus: 0,
      classicBonus: 0,
      domainBonus: 0,
      gradeBonus: 0,
      domainAffinity: 0,
      sourceNote: ""
    };
  }

  const config = state.strength?.techniqueSynergy || {};
  const scale = Number.isFinite(Number(config.scale)) ? Number(config.scale) : 1;
  const baseBonus = clamp(Number(profile.baseCombatBonus || 0), 0, 0.9);
  const attributeBonus = computeTechniqueAttributeBonus(profile, scores);
  const classicBonus = computeClassicTechniqueBonus(profile, scores);
  const domainAffinity = computeTechniqueDomainAffinity(profile, scores);
  const domainBonus = hasDomainExpansionTechnique()
    ? clamp(domainAffinity * 0.55 + computeSelectedDomainEffectSynergy(profile) * 0.18, config.domainPenaltyFloor ?? -0.2, config.domainBonusCap ?? 0.45)
    : 0;
  const highDisruptionPenalty = (profile.tags || []).includes("highDisruption") ? 0.82 : 1;
  const gradeBonus = clamp((baseBonus + attributeBonus + classicBonus + domainBonus) * scale * highDisruptionPenalty, -0.4, 1.65);

  return {
    profile,
    displayName: profile.displayName || getCurrentTechniqueText(),
    baseBonus: Number(baseBonus.toFixed(3)),
    attributeBonus: Number(attributeBonus.toFixed(3)),
    classicBonus: Number(classicBonus.toFixed(3)),
    domainBonus: Number(domainBonus.toFixed(3)),
    gradeBonus: Number(gradeBonus.toFixed(3)),
    domainAffinity: Number(domainAffinity.toFixed(3)),
    sourceNote: profile.sourceNote || ""
  };
}

function computeTechniqueAttributeBonus(profile, scores) {
  const tags = profile.tags || [];
  let bonus = 0;
  if (tags.includes("resourceHungry")) bonus += fitDimension(scores.resource, 5.4, 0.12);
  if (tags.includes("controlHungry") || tags.includes("precision")) bonus += fitDimension(scores.control, 5.5, 0.13);
  if (tags.includes("bodyScaling") || tags.includes("speed")) bonus += fitDimension(scores.body, 5.2, 0.12);
  if (tags.includes("talentScaling") || tags.includes("copy") || tags.includes("construction")) bonus += fitDimension(scores.growth, 5.1, 0.1);
  if (tags.includes("ruleBased") || tags.includes("soulTargeting")) {
    bonus += fitDimension((scores.control + scores.growth) / 2, 5.3, 0.12);
  }
  if (tags.includes("support") || tags.includes("strategic")) bonus *= 0.65;
  if (tags.includes("lowCombat")) bonus = Math.min(bonus, 0.08);
  if (tags.includes("selfDestructive") && scores.resource < 5) bonus -= 0.08;
  const cap = Number(state.strength?.techniqueSynergy?.attributeCap ?? 0.55);
  const floor = Number(state.strength?.techniqueSynergy?.attributeFloor ?? -0.35);
  return clamp(bonus, floor, cap);
}

function fitDimension(value, target, scale) {
  return clamp((Number(value || 0) - target) * scale, -0.18, 0.25);
}

function computeClassicTechniqueBonus(profile, scores) {
  const technique = getCurrentTechniqueText();
  const specialTalent = state.flags.specialTalent || "";
  let bonus = 0;

  if (technique.includes("无下限")) {
    bonus += specialTalent.includes("六眼") ? 0.55 : -0.22;
  }
  if (technique.includes("十种影法术")) {
    if (scores.control >= 6 || scores.growth >= 6) bonus += 0.14;
    if (state.flags.mahoragaTuned) bonus += 0.28;
  }
  if (technique.includes("投射咒法") && scores.body >= 6 && scores.control >= 5) bonus += 0.22;
  if (technique.includes("咒灵操术")) {
    bonus += scores.resource >= 6 && scores.growth >= 5 ? 0.16 : -0.08;
  }
  if ((technique.includes("模仿") || technique.includes("构筑术式")) && scores.resource >= 6 && scores.control >= 5) {
    bonus += 0.16;
  }
  if (technique.includes("再契象")) {
    bonus += Math.min(0.25, computeWealthTechniqueBonus() * 0.18);
  }
  if ((profile.tags || []).includes("lowCombat")) bonus = Math.min(bonus, 0.12);
  return clamp(bonus, -0.25, 0.65);
}

function computeTechniqueDomainAffinity(profile, scores) {
  const tags = profile?.tags || [];
  let affinity = 0;
  if (tags.includes("domainFriendly")) affinity += 0.2;
  if (tags.includes("ruleBased")) affinity += 0.18;
  if (tags.includes("soulTargeting")) affinity += 0.16;
  if (tags.includes("hardControl")) affinity += 0.12;
  if (tags.includes("highLethality")) affinity += 0.1;
  if (tags.includes("support") || tags.includes("strategic")) affinity -= 0.04;
  affinity += fitDimension((scores.control + scores.resource + scores.growth) / 3, 5.7, 0.08);
  return clamp(affinity, -0.2, 0.45);
}

function computeSelectedDomainEffectSynergy(profile) {
  const effects = [
    state.flags.domainMainEffect,
    ...(state.flags.domainEffects || [])
  ].filter(Boolean);
  if (!effects.length) return 0;
  const scores = effects.map((effect) => getDomainEffectCompatibility(effect, profile));
  return scores.reduce((sum, value) => sum + value, 0) / scores.length;
}

function computeDomainQualityScore() {
  const scores = computeScores();
  if (!scores) return 0;
  const profile = getCurrentTechniqueProfile();
  const techniqueAffinity = profile ? computeTechniqueDomainAffinity(profile, scores) : 0;
  return clamp(0.35 * scores.resource + 0.35 * scores.control + 0.2 * scores.growth + 0.1 * scores.body + techniqueAffinity, 0, 10);
}

function adjustDomainTypeWeight(text, baseWeight) {
  if (text !== "自由切换状态") return baseWeight;
  if (state.flags.domainCompletion === "高阶领域应用") return baseWeight + 1.4;
  if (state.flags.domainCompletion === "结界术天才") return baseWeight + 2.6;
  return baseWeight;
}

function adjustDomainEffectCountWeight(text, baseWeight) {
  const count = getNumberFromText(text);
  let weight = Number(baseWeight) || 0;
  if (state.flags.domainCompletion === "未完成领域") {
    if (count === 0) weight += 5;
    if (count === 1) weight += 4;
    if (count === 2) weight += 3;
  }
  if (count === 5 && state.flags.domainCompletion === "高阶领域应用") weight += 1.5;
  if (count === 5 && state.flags.domainCompletion === "结界术天才") weight += 2.5;
  return Math.max(0, weight);
}

function adjustDomainEffectWeight(text, baseWeight) {
  const profile = getCurrentTechniqueProfile();
  if (!profile) return baseWeight;
  const compatibility = getDomainEffectCompatibility(text, profile);
  return Math.max(0.05, baseWeight * clamp(1 + compatibility, 0.55, 1.75));
}

function getDomainEffectCompatibility(text, profile) {
  const tags = profile.tags || [];
  let value = 0;
  if (text.includes("打击灵魂")) value += tags.includes("soulTargeting") ? 0.55 : -0.08;
  if (text.includes("规则类")) value += tags.includes("ruleBased") ? 0.55 : -0.06;
  if (text.includes("强控")) value += tags.includes("hardControl") || tags.includes("controlHungry") ? 0.35 : 0;
  if (text.includes("自动攻击") || text.includes("必中")) {
    value += tags.includes("highLethality") || tags.includes("domainFriendly") ? 0.22 : 0;
  }
  if (text.includes("增幅咒术")) {
    value += tags.some((tag) => ["copy", "construction", "resourceHungry", "controlHungry"].includes(tag)) ? 0.2 : 0;
  }
  if (text.includes("增幅自身")) {
    value += tags.includes("bodyScaling") || tags.includes("survival") ? 0.2 : 0;
  }
  if ((tags.includes("support") || tags.includes("strategic") || tags.includes("lowCombat")) && (text.includes("自动攻击") || text.includes("打击灵魂"))) {
    value -= 0.18;
  }
  return clamp(value, -0.25, 0.65);
}

function computeCurseAbilityBonus() {
  let bonus = 0;
  const growthBonus = state.flags.curseWombGrowthBonus || "";
  if (growthBonus.includes("咒术强化")) bonus += 0.20;
  if (growthBonus.includes("属性强化")) bonus += 0.18;
  if (growthBonus.includes("领域强化")) bonus += 0.28;
  if (growthBonus.includes("永无止境成长")) bonus += 0.24;

  if (state.flags.curseWombHasDomain === true) bonus += 0.45;
  if (state.flags.curseSpecialDomain === true) bonus += 0.58;
  if (state.flags.curseSpecialMaximum === true) bonus += 0.34;
  if (state.flags.curseDomainAmplification === true) bonus += 0.26;
  bonus += computeCurseAgeGrowthProfile().gradeBonus;

  return bonus;
}

function computeCurseAgeGrowthProfile() {
  const empty = {
    applies: false,
    label: "",
    gradeBonus: 0,
    scoreBonus: 0,
    axisBonus: { jujutsu: 0, insight: 0, build: 0 },
    visibleGradeFloor: "",
    tags: []
  };
  if (getEffectiveIdentity() !== "咒灵") return empty;

  const time = getCurseLongTermGrowthTimeFactor();
  if (time.factor <= 0) return empty;

  const ceiling = state.flags.curseGrowthCeiling || "";
  const wombGrowth = state.flags.curseWombGrowthBonus || "";
  const hasUnboundedGrowth = ceiling.includes("永无止境") || wombGrowth.includes("永无止境");
  const ceilingConfig = getCurseGrowthCeilingConfig(ceiling, hasUnboundedGrowth);
  const intensity = clamp(time.factor * ceilingConfig.scale, 0, 1.35);
  const base = hasUnboundedGrowth ? 0.18 : 0.08;
  const gradeBonus = clamp(base + intensity * 0.86, 0, ceilingConfig.maxGradeBonus);
  const scoreBonus = clamp(gradeBonus * 0.42 + (hasUnboundedGrowth ? 0.08 : 0), 0, ceilingConfig.maxScoreBonus);
  const jujutsuAxisBonus = clamp(gradeBonus * 0.62 + time.factor * 0.18, 0, ceilingConfig.maxAxisBonus);
  const insightAxisBonus = clamp(gradeBonus * 0.22, 0, 0.32);
  const buildAxisBonus = clamp(gradeBonus * 0.28 + (hasUnboundedGrowth ? 0.1 : 0), 0, 0.55);
  const tags = ["curseAgeGrowth"];
  if (time.tags.includes("ancientCurse")) tags.push("ancientCurse");
  if (time.tags.includes("longLivedCurse")) tags.push("longLivedCurse");
  if (hasUnboundedGrowth) tags.push("unboundedCurseGrowth");
  if (time.tags.includes("dormantGrowthLimited")) tags.push("dormantGrowthLimited");

  let visibleGradeFloor = "";
  if (gradeBonus >= 0.8 || ceiling.includes("五宿级")) visibleGradeFloor = "specialGrade";
  else if (gradeBonus >= 0.45 || ceiling.includes("天灾级")) visibleGradeFloor = "semiSpecialGrade1";

  return {
    applies: true,
    label: `${time.label}${ceiling ? ` / ${ceiling}` : ""}${hasUnboundedGrowth ? " / 越久越强" : ""}`,
    gradeBonus: Number(gradeBonus.toFixed(4)),
    scoreBonus: Number(scoreBonus.toFixed(4)),
    axisBonus: {
      jujutsu: Number(jujutsuAxisBonus.toFixed(4)),
      insight: Number(insightAxisBonus.toFixed(4)),
      build: Number(buildAxisBonus.toFixed(4))
    },
    visibleGradeFloor,
    tags
  };
}

function getCurseGrowthCeilingConfig(ceiling = "", hasUnboundedGrowth = false) {
  if (hasUnboundedGrowth) {
    return { scale: 1.15, maxGradeBonus: 1.28, maxScoreBonus: 0.74, maxAxisBonus: 1.18 };
  }
  if (ceiling.includes("五宿级")) {
    return { scale: 0.98, maxGradeBonus: 1.02, maxScoreBonus: 0.58, maxAxisBonus: 0.92 };
  }
  if (ceiling.includes("天灾级")) {
    return { scale: 0.72, maxGradeBonus: 0.76, maxScoreBonus: 0.42, maxAxisBonus: 0.68 };
  }
  if (ceiling.includes("普通特级")) {
    return { scale: 0.42, maxGradeBonus: 0.42, maxScoreBonus: 0.24, maxAxisBonus: 0.42 };
  }
  return { scale: 0.26, maxGradeBonus: 0.28, maxScoreBonus: 0.16, maxAxisBonus: 0.28 };
}

function getCurseLongTermGrowthTimeFactor() {
  const startTime = state.flags.startTime || getAnswerText("startTime");
  const method = state.flags.modernArrivalMethod || "";
  const tags = [];
  let base = 0;
  let label = "";

  if (startTime.includes("千年前")) {
    base = 1;
    label = "千年前咒灵";
    tags.push("ancientCurse");
  } else if (startTime.includes("400年前")) {
    base = 0.64;
    label = "400年前咒灵";
    tags.push("ancientCurse");
  } else if (state.flags.aliveAfter68 === true && getStartPeriod() !== "after68") {
    base = 0.18;
    label = "存活到68年后";
  }

  if (base <= 0) return { factor: 0, label: "", tags };

  let continuity = 1;
  if (startTime.includes("千年前") || startTime.includes("400年前")) {
    if (!state.flags.modernArrivalResolved) return { factor: 0, label: "", tags };
    if (method.includes("就硬活")) {
      continuity = 1;
      tags.push("longLivedCurse");
    } else if (method.includes("天元") || method.includes("羂索")) {
      continuity = 0.82;
      tags.push("longLivedCurse");
    } else if (method.includes("咒物")) {
      continuity = 0.45;
      tags.push("dormantGrowthLimited");
    } else if (method.includes("受肉")) {
      continuity = 0.35;
      tags.push("dormantGrowthLimited");
    } else {
      continuity = 0.58;
    }
  } else {
    tags.push("longLivedCurse");
  }

  return {
    factor: Number(clamp(base * continuity, 0, 1.05).toFixed(4)),
    label,
    tags
  };
}

function hasCurseSpecialPotential() {
  if (getEffectiveIdentity() !== "咒灵") return false;
  const scores = computeScores();
  if (!scores) return false;
  const effectiveScore = computeGradeEffectiveScore(scores);
  return effectiveScore >= 5.7 ||
    scores.highCounts.sPlus >= 2 ||
    (scores.rankCounts?.ssPlus || 0) >= 1 ||
    state.flags.curseWombHasDomain === true;
}

function getGradeFloor(scores) {
  if ((scores.rankCounts?.ssPlus || 0) >= 1) return "semiSpecialGrade1";
  if (scores.raw.martialScore >= 8 && scores.raw.bodyScore >= 8) return "semiSpecialGrade1";
  const technique = getCurrentTechniqueText();
  const specialTalent = state.flags.specialTalent || "";
  if (technique.includes("无下限") && specialTalent.includes("六眼")) return "grade1";
  if (technique.includes("十种影法术") && state.flags.mahoragaTuned && scores.highCounts.aPlus >= 2) return "grade1";
  if (hasDomainExpansionTechnique() && scores.highCounts.sPlus >= 2) return "grade1";
  if ((state.flags.specialTalent || "").includes("六眼") && scores.highCounts.aPlus >= 2) return "grade1";
  if (
    (scores.raw.martialScore >= 6 && scores.raw.bodyScore >= 7) ||
    (scores.raw.martialScore >= 7 && scores.raw.bodyScore >= 6)
  ) {
    return "grade1";
  }
  return "support";
}

function isGradeBelow(gradeKey, floorGrade) {
  const order = {
    support: 0,
    grade4: 1,
    grade3: 2,
    grade2: 3,
    grade1: 4,
    semiSpecialGrade1: 5,
    specialGrade: 6
  };
  return (order[gradeKey] ?? 0) < (order[floorGrade] ?? 0);
}

function adjustSpecialTalentGateWeight(text, baseWeight) {
  const scores = computeScores();
  const talentRank = state.flags.talentRank || parseRank(getAnswerText("talent"));
  const talentValue = rankValue(talentRank);
  const highCounts = scores?.highCounts || { aPlus: 0, sPlus: 0, ssPlus: 0, sssPlus: 0 };
  let yesMultiplier = 1;
  if (talentValue >= rankValue("A")) yesMultiplier += 1.2;
  if (talentValue >= rankValue("S")) yesMultiplier += 1.3;
  if (talentValue >= rankValue("SS")) yesMultiplier += 1.8;
  yesMultiplier += highCounts.sPlus * 0.35 + highCounts.ssPlus * 0.25;

  if (text.includes("是")) return baseWeight * yesMultiplier;
  if (text.includes("否")) return baseWeight * (talentValue >= rankValue("A") ? 0.72 : 1.15);
  return baseWeight;
}

function adjustSpecialTalentWeight(text, baseWeight) {
  const scores = computeScores();
  if (!scores) return baseWeight;
  let multiplier = 1;
  if (text.includes("六眼")) multiplier *= scores.raw.controlScore >= 6 || scores.raw.efficiencyScore >= 6 ? 1.35 : 0.8;
  if (text.includes("天与咒缚")) multiplier *= 1;
  if (text.includes("双面四臂")) multiplier *= scores.raw.martialScore >= 6 ? 1.25 : 0.95;
  if (text.includes("超级受肉体")) multiplier *= scores.raw.bodyScore >= 5 ? 1.25 : 0.95;
  if (text.includes("半人半咒")) multiplier *= scores.highCounts.aPlus >= 2 ? 1.18 : 1;
  return baseWeight * multiplier;
}

function adjustAdvancedTechniqueCountWeight(text, baseWeight) {
  const count = getNumberFromText(text);
  const talentRank = state.flags.talentRank || parseRank(getAnswerText("talent"));
  const talentValue = rankValue(talentRank);
  let multiplier = 1;

  if (count === 0) {
    multiplier = talentValue >= rankValue("A") ? 0.62 : 1.35;
  } else if (count === 1) {
    multiplier = talentValue >= rankValue("A") ? 1.15 : 1.1;
  } else {
    const talentLift = Math.max(0, talentValue - rankValue("A")) * 0.12;
    multiplier = (0.72 + talentLift) * Math.pow(0.74, Math.max(0, count - 2));
    if (count >= 4) multiplier *= 0.62;
    if (count >= 6) multiplier *= 0.36;
  }

  if ((state.flags.specialTalent || "").includes("六眼") && count >= 2) multiplier *= 1.12;
  if (isZeroCursedEnergyHeavenlyRestriction() && text.includes("不会")) multiplier *= 1.25;
  return baseWeight * multiplier;
}

function adjustAdvancedTechniqueWeight(text, baseWeight, context = {}) {
  const scores = computeScores();
  if (!scores) return baseWeight;
  const gate = getAdvancedTechniqueGate(text, scores, context);
  if (!gate.allowed) return 0;

  let multiplier = 1;
  const specialTalent = state.flags.specialTalent || "";
  const raw = scores.raw;

  if (text === "反转术式") {
    multiplier *= raw.controlScore >= 6 || specialTalent.includes("六眼") ? 1.25 : 0.78;
  }
  if (isDomainExpansionTechniqueText(text)) {
    multiplier *= raw.controlScore >= 7 && raw.efficiencyScore >= 6 ? 1.5 : 0.78;
  }
  if (text.includes("反转术式外放") || text.includes("术式反转")) {
    multiplier *= raw.controlScore >= 7 || specialTalent.includes("六眼") ? 1.32 : 0.74;
  }
  if (text.includes("领域展延")) multiplier *= raw.controlScore >= 7 ? 1.18 : 0.7;
  if (text.includes("黑闪")) multiplier *= raw.martialScore >= 6 ? 0.75 : 0.28;
  if (text.includes("简易领域")) multiplier *= raw.controlScore >= 4 ? 1.1 : 0.72;
  if (text.includes("极之番")) multiplier *= raw.cursedEnergyScore >= 6 ? 1.18 : 0.66;
  if (text.includes("制作咒具")) multiplier *= raw.talentScore >= 5 ? 1.18 : 0.82;
  if (text.includes("无敌贷款王")) {
    multiplier *= raw.talentScore >= 6 ? 1.12 : 0.82;
    multiplier *= getBindingAffinityMultiplier();
  }
  if (specialTalent.includes("六眼") && (isDomainExpansionTechniqueText(text) || text.includes("领域") || text.includes("反转"))) multiplier *= 1.16;
  return baseWeight * multiplier;
}

function getAdvancedTechniqueGate(text, scores, context = {}) {
  const selected = context.selectedAdvancedTechniques || [];
  const raw = scores.raw || {};
  const specialTalent = state.flags.specialTalent || "";
  const hasSixEyes = specialTalent.includes("六眼");
  const enough = (value, target) => Number(value || 0) >= target;

  if (text.includes("领域展延") && !hasDomainExpansionTechniqueInContext(selected)) {
    return { allowed: false, reason: "requiresDomainExpansion" };
  }
  if (text === "反转术式外放" && !hasExactAdvancedTechniqueInContext("反转术式", selected)) {
    return { allowed: false, reason: "requiresReverseCursedTechnique" };
  }
  if (text === "术式反转") {
    if (!hasTechniqueNow()) return { allowed: false, reason: "requiresInnateTechnique" };
    if (!hasExactAdvancedTechniqueInContext("反转术式", selected)) {
      return { allowed: false, reason: "requiresReverseCursedTechnique" };
    }
  }
  if ((isDomainExpansionTechniqueText(text) || text === "极之番") && !hasTechniqueNow()) {
    return { allowed: false, reason: "requiresInnateTechnique" };
  }

  if (isDomainExpansionTechniqueText(text)) {
    const valid = hasSixEyes
      ? enough(raw.controlScore, 6) && enough(raw.cursedEnergyScore, 4)
      : enough(raw.controlScore, 6) && enough(raw.efficiencyScore, 5) && enough(raw.cursedEnergyScore, 5);
    if (!valid) return { allowed: false, reason: "domainStatGate" };
  }
  if (text === "领域展延") {
    const valid = hasSixEyes
      ? enough(raw.controlScore, 6)
      : enough(raw.controlScore, 7) && enough(raw.efficiencyScore, 5);
    if (!valid) return { allowed: false, reason: "domainAmplificationStatGate" };
  }
  if (text === "反转术式") {
    const valid = hasSixEyes
      ? enough(raw.controlScore, 5)
      : enough(raw.controlScore, 5) && (enough(raw.efficiencyScore, 5) || enough(raw.talentScore, 6));
    if (!valid) return { allowed: false, reason: "reverseCursedTechniqueStatGate" };
  }
  if (text === "反转术式外放") {
    const valid = hasSixEyes
      ? enough(raw.controlScore, 6)
      : enough(raw.controlScore, 6) && enough(raw.efficiencyScore, 6) && enough(raw.cursedEnergyScore, 5);
    if (!valid) return { allowed: false, reason: "reverseOutputStatGate" };
  }
  if (text === "术式反转") {
    const valid = hasSixEyes
      ? enough(raw.controlScore, 6)
      : enough(raw.controlScore, 6) && enough(raw.efficiencyScore, 5);
    if (!valid) return { allowed: false, reason: "techniqueReversalStatGate" };
  }
  if (text === "极之番" && !(enough(raw.cursedEnergyScore, 5) && enough(raw.controlScore, 5))) {
    return { allowed: false, reason: "maximumTechniqueStatGate" };
  }
  if (text.includes("黑闪（68虎水平）")) {
    const valid = enough(raw.martialScore, 7) && enough(raw.controlScore, 6) && enough(raw.talentScore, 6);
    if (!valid) return { allowed: false, reason: "yujiLevelBlackFlashGate" };
  }
  return { allowed: true, reason: "" };
}

function hasAdvancedTechniqueInContext(keyword, selectedTexts = []) {
  return [
    ...(state.flags.advancedTechniques || []),
    ...(selectedTexts || [])
  ].some((item) => String(item).includes(keyword));
}

function isDomainExpansionTechniqueText(text = "") {
  const value = String(text);
  return value.includes("领域展开") || value.includes("神秘农家乐");
}

function hasDomainExpansionTechniqueInContext(selectedTexts = []) {
  return [
    ...(state.flags.advancedTechniques || []),
    ...(selectedTexts || [])
  ].some((item) => isDomainExpansionTechniqueText(item));
}

function hasDomainExpansionTechnique() {
  return hasDomainExpansionTechniqueInContext();
}

function hasExactAdvancedTechniqueInContext(keyword, selectedTexts = []) {
  return [
    ...(state.flags.advancedTechniques || []),
    ...(selectedTexts || [])
  ].some((item) => String(item).trim() === keyword);
}

function adjustHasToolWeight(text, baseWeight) {
  let multiplier = 1;
  if (hasAdvancedTechnique("制作咒具")) multiplier *= 20;
  if (state.flags.specialTalent || hasDomainExpansionTechnique() || hasAdvancedTechnique("反转术式外放")) multiplier *= 1.25;
  if (text.includes("是")) return baseWeight * multiplier;
  if (text.includes("否")) return baseWeight * (hasAdvancedTechnique("制作咒具") ? 0.2 : 0.9);
  return baseWeight;
}

function adjustToolCountWeight(text, baseWeight) {
  if (!hasAdvancedTechnique("制作咒具")) return baseWeight;
  const count = getNumberFromText(text);
  if (count <= 1) return baseWeight * 0.65;
  if (count === 2) return baseWeight * 1.1;
  if (count === 3) return baseWeight * 1.35;
  if (count >= 4) return baseWeight * 1.6;
  return baseWeight;
}

function adjustToolWeight(text, baseWeight) {
  let multiplier = 1;
  if (text.includes("天逆") || text.includes("黑绳") || text.includes("狱门疆")) multiplier *= 0.72;
  if (text.includes("释魂刀") || text.includes("神武解") || text.includes("飞天")) multiplier *= 0.9;
  if (hasAdvancedTechnique("制作咒具") && !text.includes("狱门疆")) multiplier *= 1.18;
  if (isZeroCursedEnergyHeavenlyRestriction() && (text.includes("游云") || text.includes("释魂刀"))) {
    multiplier *= 1.35;
  }
  return baseWeight * multiplier;
}

function isZeroCursedEnergyHeavenlyRestrictionText(text) {
  const value = String(text || "");
  return value.includes("零咒力") || value.includes("天与暴君") || value.includes("咒力消失");
}

function isCursedEnergyBoostHeavenlyRestrictionText(text) {
  const value = String(text || "");
  return value.includes("咒力强化") || value.includes("咒力总量提升");
}

function isZeroCursedEnergyHeavenlyRestriction() {
  return isZeroCursedEnergyHeavenlyRestrictionText(state.flags.heavenlyRestrictionType || "");
}

function isCursedEnergyBoostHeavenlyRestriction() {
  return isCursedEnergyBoostHeavenlyRestrictionText(state.flags.heavenlyRestrictionType || "");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomSample(items, count) {
  const pool = items.slice();
  const selected = [];
  while (pool.length > 0 && selected.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    selected.push(pool.splice(index, 1)[0]);
  }
  return selected;
}

function getCountFrom(nodeId) {
  const answer = state.answers[nodeId];
  if (!answer) return 0;
  return getAdjustedCountFrom(nodeId, getNumberFromText(answer.text));
}

function getAdjustedCountFrom(nodeId, baseCount) {
  const count = Number(baseCount) || 0;
  const effects = state.flags.effortEffects || {};
  if (nodeId === "advancedTechniqueCount") {
    return clamp(Math.round(count + Number(effects.advancedTechniqueDelta || 0)), 0, 10);
  }
  if (nodeId === "toolCount") {
    return clamp(Math.round(count + Number(effects.toolCountDelta || 0)), 0, 10);
  }
  return count;
}

function getNumberFromText(text) {
  if (!text || text.includes("不会") || text.includes("没见过")) return 0;
  if (String(text).trim() === "无") return 0;
  const match = text.match(/\d+/);
  return match ? Number(match[0]) : 1;
}

function getWheel(wheelId) {
  return callSiteModuleImplementation("JJKLifeWheelData", "getWheel", [state, wheelId]);
}

function getTaskWheel(task) {
  return callSiteModuleImplementation("JJKLifeWheelData", "getTaskWheel", [state, task]);
}

function getAnswerText(nodeId) {
  return state.answers[nodeId]?.text || "";
}

function hasTechniqueNow() {
  return getAnswerText("hasTechnique") === "是" ||
    state.flags.hasTechnique === "是" ||
    state.flags.innateTechniqueLocked === true ||
    state.flags.awakenedTechnique === true ||
    state.flags.familyInheritedTechnique === true;
}

function hasAdvancedTechnique(keyword) {
  return (state.flags.advancedTechniques || []).some((item) => item.includes(keyword));
}

function isHighTalent() {
  return state.flags.highTalent === true;
}

function isStrongPower(options = {}) {
  const scores = computeScores();
  if (!scores) return false;
  const effectiveScore = computeGradeEffectiveScore(scores, options);
  return effectiveScore >= 9.6 ||
    (scores.highCounts.ssPlus >= 5 && getGradeFloor(scores) === "semiSpecialGrade1");
}

function isWeakPower(options = {}) {
  const scores = computeScores();
  if (!scores) return false;
  return computeGradeEffectiveScore(scores, options) < 3.2 && getGradeFloor(scores) === "support" && scores.highCounts.aPlus === 0;
}

function isWeakGrade() {
  return ["support", "grade4", "grade3", "grade2"].includes(state.flags.sorcererGrade);
}

function isStrongGrade() {
  return ["grade1", "semiSpecialGrade1", "specialGrade"].includes(state.flags.sorcererGrade);
}

function isSpecialGrade() {
  return state.flags.sorcererGrade === "specialGrade";
}

function isHumanLike() {
  const identity = getEffectiveIdentity();
  return ["咒术师", "诅咒师", "普通人", "咒术高层"].includes(identity);
}

function getStartPeriod() {
  const timeline = state.flow?.timeline;
  if (!timeline) return "mainStart";
  const startText = state.flags.startTime || getAnswerText("startTime");
  return Object.entries(timeline.startMapping).find(([key]) => startText.includes(key))?.[1] || "mainStart";
}

function isPeriodInSimulatedTimeline(period) {
  const timeline = state.flow?.timeline;
  if (!timeline) return true;
  const ordered = Object.keys(timeline.periods || {});
  const startIndex = ordered.indexOf(getStartPeriod());
  const periodIndex = ordered.indexOf(period);
  if (startIndex < 0 || periodIndex < 0) return true;
  return periodIndex >= startIndex;
}

function canChooseHighSchool() {
  if (state.flags.joinHighSchool) return false;
  if (state.flags.jujutsuCouncil === true) return false;
  if (state.flags.factionLocked) return false;
  if (state.flags.getoSide === true) return false;
  return isHumanLike() && isInJapan() && hasReachedModern();
}

function canJoinMainTeam() {
  if (state.flags.jujutsuCouncil === true) return false;
  if (state.flags.joinHighSchool !== "是") return false;
  if (state.flags.joinMainTeam) return false;
  return state.flags.highSchoolStatus === "学生";
}

function hasReachedModern() {
  const startTime = state.flags.startTime || getAnswerText("startTime");
  if (startTime.includes("千年前") || startTime.includes("400年前")) {
    return state.flags.modernArrivalResolved === true;
  }
  return true;
}

function isInJapan() {
  return getAnswerText("location").includes("日本") || state.flags.location === "日本";
}

function getEffectiveIdentity() {
  return state.flags.identityOverride || state.flags.identity || "";
}

function parseRank(text) {
  const match = text.match(/^(EX-|EX|SSS|SS|S|A|B|C|D|E-|E)/);
  return match ? match[1] : "";
}

function rankValue(rank) {
  return state.strength.rankScale[rank] ?? state.mechanisms?.rankScale?.[rank] ?? -1;
}

function mapGrade(text) {
  if (text.includes("辅助人员")) return "support";
  if (text.includes("特别一级")) return "semiSpecialGrade1";
  if (text.includes("特级")) return "specialGrade";
  if (text.includes("一级")) return "grade1";
  if (text.includes("二级")) return "grade2";
  if (text.includes("三级")) return "grade3";
  if (text.includes("四级")) return "grade4";
  return "support";
}

function gradeLabel(gradeKey) {
  return {
    support: "辅助人员",
    grade4: "四级",
    grade3: "三级",
    grade2: "二级",
    grade1: "一级",
    semiSpecialGrade1: "超一级（特别一级行政等效）",
    specialGrade: "特级"
  }[gradeKey] || "未定";
}
