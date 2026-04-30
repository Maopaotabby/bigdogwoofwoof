//--移动端顶栏与调试入口UI--//
function initializeMobileTopbarBehavior() {
  if (!els.topbar || typeof window.matchMedia !== "function") return;

  const media = window.matchMedia(MOBILE_TOPBAR_QUERY);
  const syncForViewport = () => {
    state.lastMobileScrollY = getWindowScrollY();
    if (!media.matches || state.lastMobileScrollY <= getMobileTopbarHideAfter()) {
      setMobileTopbarHidden(false);
    }
  };

  window.addEventListener("scroll", () => updateMobileTopbarOnScroll(media), { passive: true });
  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", syncForViewport);
  } else if (typeof media.addListener === "function") {
    media.addListener(syncForViewport);
  }
  syncForViewport();
}

function updateMobileTopbarOnScroll(media) {
  const currentY = getWindowScrollY();
  if (!media.matches) {
    state.lastMobileScrollY = currentY;
    setMobileTopbarHidden(false);
    return;
  }

  const hideAfter = getMobileTopbarHideAfter();
  if (currentY <= hideAfter) {
    state.lastMobileScrollY = currentY;
    setMobileTopbarHidden(false);
    return;
  }

  const delta = currentY - state.lastMobileScrollY;
  if (Math.abs(delta) < MOBILE_TOPBAR_SCROLL_DELTA) return;

  setMobileTopbarHidden(delta > 0 && currentY > hideAfter);
  state.lastMobileScrollY = currentY;
}

function setMobileTopbarHidden(hidden) {
  state.mobileTopbarHidden = hidden;
  document.body.classList.toggle("mobile-topbar-hidden", hidden);
}

function getWindowScrollY() {
  return Math.max(window.scrollY || window.pageYOffset || 0, 0);
}

function getMobileTopbarHideAfter() {
  const topbarHeight = els.topbar?.offsetHeight || 0;
  return Math.max(MOBILE_TOPBAR_MIN_HIDE_AFTER, Math.round(topbarHeight - 32));
}

function handleRestartButtonClick() {
  trackMobileDebugGesture("restart");
  restart({ clearDraft: true });
}

function handleFeedbackContactClick() {
  trackMobileDebugGesture("feedback");
}

function trackMobileDebugGesture(action) {
  if (state.debugMode || state.debugSummoned) return;
  if (!isMobileViewport()) {
    resetMobileDebugGesture();
    return;
  }
  let gesture = state.mobileDebugGesture;
  if (action === "restart") {
    if (gesture.phase !== "restart") resetMobileDebugGesture();
    gesture = state.mobileDebugGesture;
    gesture.restartCount += 1;
    gesture.feedbackCount = 0;
    gesture.lifeFileCount = 0;
    if (gesture.restartCount >= MOBILE_DEBUG_RESTART_TAPS) {
      gesture.phase = "feedback";
      gesture.restartCount = MOBILE_DEBUG_RESTART_TAPS;
    }
    return;
  }
  if (action === "feedback") {
    if (gesture.phase !== "feedback" || gesture.restartCount < MOBILE_DEBUG_RESTART_TAPS) {
      resetMobileDebugGesture();
      return;
    }
    gesture.feedbackCount += 1;
    gesture.lifeFileCount = 0;
    if (gesture.feedbackCount >= MOBILE_DEBUG_FEEDBACK_TAPS) {
      gesture.phase = "lifeFile";
      gesture.feedbackCount = MOBILE_DEBUG_FEEDBACK_TAPS;
    }
    return;
  }
  if (action === "lifeFile") {
    if (
      gesture.phase !== "lifeFile" ||
      gesture.restartCount < MOBILE_DEBUG_RESTART_TAPS ||
      gesture.feedbackCount < MOBILE_DEBUG_FEEDBACK_TAPS
    ) {
      resetMobileDebugGesture();
      return;
    }
    gesture.lifeFileCount += 1;
    if (gesture.lifeFileCount >= MOBILE_DEBUG_LIFE_FILE_TAPS) activateMobileDebugGesture();
    return;
  }
  resetMobileDebugGesture();
}

function resetMobileDebugGesture() {
  state.mobileDebugGesture = {
    restartCount: 0,
    feedbackCount: 0,
    lifeFileCount: 0,
    phase: "restart"
  };
}

function activateMobileDebugGesture() {
  state.debugMode = true;
  state.debugSummoned = true;
  resetMobileDebugGesture();
  syncDebugMode();
  renderFlowTree();
  renderFlowGraph();
  renderWheelLibrary();
  renderAll();
}

function isMobileViewport() {
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia(MOBILE_TOPBAR_QUERY).matches;
}

function handleDebugSummonKeydown(event) {
  if (state.debugSummoned || state.debugMode) return;
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
  if (isEditableTarget(event.target)) return;
  if (typeof event.key !== "string" || event.key.length !== 1) return;
  state.debugSummonBuffer = `${state.debugSummonBuffer}${event.key}`.slice(-DEBUG_SUMMON_SEQUENCE.length);
  if (state.debugSummonBuffer === DEBUG_SUMMON_SEQUENCE) {
    summonDebugControl();
  }
}

function isEditableTarget(target) {
  const element = target instanceof Element ? target : null;
  if (!element) return false;
  if (element.closest("input, textarea, select, [contenteditable='true']")) return true;
  return false;
}

function summonDebugControl() {
  state.debugSummoned = true;
  state.debugSummonBuffer = "";
  syncDebugMode();
  els.debugToggle?.focus();
}

//--模式控件与转盘设置UI--//
function syncDebugMode() {
  document.body.classList.toggle("debug-mode", state.debugMode);
  document.body.classList.toggle("debug-summoned", state.debugSummoned || state.debugMode);
  els.debugToggle.checked = state.debugMode;
  syncPlayMode();

  if (!state.debugMode && document.querySelector(".tab.active")?.classList.contains("debug-tab")) {
    document.querySelector('.tab[data-tab="run"]').click();
  }
}

function syncPlayMode() {
  document.body.classList.toggle("activation-custom-run", isActivationCustomRun());
  document.body.classList.toggle("ai-free-enabled", state.aiFreeEnabled);
  els.playModeInputs.forEach((input) => {
    input.checked = input.value === state.playMode || (state.playMode === "random" && input.value === "random");
  });
  if (els.aiFreeToggle) els.aiFreeToggle.checked = Boolean(state.aiFreeEnabled);
  syncDrawModeControlLock();
  const runProfile = getRunProfile();
  els.modeHint.textContent = state.debugMode
    ? `调试模式：${runProfile.publicLabel}；显示权重、条件、跳转说明与隐藏强度`
    : `${runProfile.publicLabel} · ${runProfile.modeHint || "自动跳转"}`;
}

function isDrawModeInteractionLocked() {
  return Boolean(state.isSpinning || state.spinModeSnapshot);
}

function syncDrawModeControlLock() {
  const locked = isDrawModeInteractionLocked();
  els.playModeInputs.forEach((input) => {
    input.disabled = locked;
    input.setAttribute("aria-disabled", locked ? "true" : "false");
  });
  if (els.aiFreeToggle) {
    els.aiFreeToggle.disabled = locked;
    els.aiFreeToggle.setAttribute("aria-disabled", locked ? "true" : "false");
  }
}

function beginSpinModeSnapshot(token) {
  state.spinModeSnapshot = {
    token,
    playMode: state.playMode,
    aiFreeEnabled: Boolean(state.aiFreeEnabled)
  };
  syncDrawModeControlLock();
  return state.spinModeSnapshot;
}

function clearSpinModeSnapshot() {
  state.spinModeSnapshot = null;
  syncDrawModeControlLock();
}

function getSpinModeSnapshot(token = state.spinToken) {
  const snapshot = state.spinModeSnapshot;
  return snapshot && snapshot.token === token ? snapshot : null;
}

function bindWheelSettingsControls() {
  els.wheelSettingInputs?.forEach((input) => {
    input.addEventListener("input", handleWheelSettingInput);
    input.addEventListener("change", handleWheelSettingInput);
  });
  els.wheelSettingsResetBtn?.addEventListener("click", () => {
    state.wheelSettings = { ...DEFAULT_WHEEL_SETTINGS };
    saveWheelSettings();
    syncWheelSettingsControls();
  });
}

function handleWheelSettingInput(event) {
  const input = event.currentTarget;
  const key = input?.dataset?.wheelSetting;
  if (!key) return;
  const next = {
    ...DEFAULT_WHEEL_SETTINGS,
    ...(state.wheelSettings || {})
  };
  if (typeof DEFAULT_WHEEL_SETTINGS[key] === "boolean") {
    next[key] = Boolean(input.checked);
    if (key === "soundEnabled" && !next[key]) stopSpinSound();
    if (key === "speechEnabled" && !next[key]) stopResultSpeech();
  } else {
    next[key] = normalizeWheelSettingNumber(key, input.value);
  }
  state.wheelSettings = normalizeWheelSettings(next);
  saveWheelSettings();
  syncWheelSettingsControls();
}

function readWheelSettings() {
  try {
    const raw = window.localStorage.getItem(WHEEL_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_WHEEL_SETTINGS };
    return normalizeWheelSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_WHEEL_SETTINGS };
  }
}

function saveWheelSettings() {
  try {
    window.localStorage.setItem(
      WHEEL_SETTINGS_STORAGE_KEY,
      JSON.stringify(normalizeWheelSettings(state.wheelSettings))
    );
  } catch {
    // Ignore private browsing or quota failures; settings remain active for this page load.
  }
}

function normalizeWheelSettings(settings = {}) {
  return {
    preDelayMs: normalizeWheelSettingNumber("preDelayMs", settings.preDelayMs),
    spinDurationMs: normalizeWheelSettingNumber("spinDurationMs", settings.spinDurationMs),
    resultHoldMs: normalizeWheelSettingNumber("resultHoldMs", settings.resultHoldMs),
    choiceDelayMs: normalizeWheelSettingNumber("choiceDelayMs", settings.choiceDelayMs),
    animationEnabled: settings.animationEnabled !== false,
    soundEnabled: settings.soundEnabled !== false,
    speechEnabled: settings.speechEnabled !== false
  };
}

function normalizeWheelSettingNumber(key, value) {
  const fallback = DEFAULT_WHEEL_SETTINGS[key] ?? 0;
  const limits = WHEEL_SETTING_LIMITS[key] || { min: 0, max: 10000, step: 1 };
  const raw = Number(value);
  const bounded = clamp(Number.isFinite(raw) ? raw : fallback, limits.min, limits.max);
  return Math.round(bounded / limits.step) * limits.step;
}

function syncWheelSettingsControls() {
  const settings = normalizeWheelSettings(state.wheelSettings);
  state.wheelSettings = settings;
  els.wheelSettingInputs?.forEach((input) => {
    const key = input.dataset.wheelSetting;
    if (!key || !(key in settings)) return;
    if (input.type === "checkbox") {
      input.checked = Boolean(settings[key]);
    } else {
      input.value = String(settings[key]);
    }
    const output = document.querySelector(`[data-wheel-setting-output="${key}"]`);
    if (output) output.textContent = formatWheelSettingValue(key, settings[key]);
  });
}

function formatWheelSettingValue(key, value) {
  if (typeof value === "boolean") return value ? "开" : "关";
  if (key.endsWith("Ms")) return `${Number(value)}ms`;
  return String(value);
}

function getWheelSettingNumber(key) {
  return normalizeWheelSettingNumber(key, state.wheelSettings?.[key]);
}

function getPreDelayMs() {
  return getWheelSettingNumber("preDelayMs");
}

function getResultHoldMs() {
  return getWheelSettingNumber("resultHoldMs");
}

function getChoiceDelayMs() {
  return getWheelSettingNumber("choiceDelayMs");
}

function isWheelAnimationEnabled() {
  return state.wheelSettings?.animationEnabled !== false;
}

function isWheelSoundEnabled() {
  return state.wheelSettings?.soundEnabled !== false;
}

function isResultSpeechEnabled() {
  return state.wheelSettings?.speechEnabled !== false;
}

function initializeDuelCustomPanel() {
  if (els.duelAiAssistToggle) {
    els.duelAiAssistToggle.checked = window.localStorage.getItem(DUEL_AI_ASSIST_STORAGE_KEY) === "yes";
  }
  els.duelCustomRankSelects?.forEach((select) => {
    const stat = select.dataset.duelCustomRank;
    const selected = select.dataset.defaultRank || DUEL_DEFAULT_CUSTOM_STATS[stat] || "B";
    select.innerHTML = buildDuelRankOptions(selected);
  });
  if (els.duelCustomTechniquePower) {
    els.duelCustomTechniquePower.innerHTML = buildDuelRankOptions("B");
  }
  if (els.duelCustomGrade) {
    els.duelCustomGrade.innerHTML = DUEL_GRADE_OPTIONS
      .map((item) => `<option value="${escapeHtml(item.value)}"${item.value === "grade2" ? " selected" : ""}>${escapeHtml(item.label)}</option>`)
      .join("");
  }
  if (els.duelCustomStage) {
    els.duelCustomStage.innerHTML = DUEL_STAGE_OPTIONS
      .map((item) => `<option value="${escapeHtml(item.value)}"${item.value === "custom" ? " selected" : ""}>${escapeHtml(item.label)}</option>`)
      .join("");
  }
  populateDuelDefinitionSelects();
  renderDuelCustomList();
  renderDuelSpecialTermList();
  syncDuelAiAssistPanel();
  syncDuelCustomMode();
}

function populateDuelDefinitionSelects() {
  populateDuelDefinitionSelect(els.duelCustomTechniqueTags, buildDuelTechniqueLibraryEntries());
  populateDuelDefinitionSelect(els.duelCustomDomainTags, buildDuelDomainLibraryEntries());
  populateDuelDefinitionSelect(els.duelCustomAdvancedTags, buildDuelAdvancedLibraryEntries());
  populateDuelDefinitionSelect(els.duelCustomResourceTags, buildDuelExternalResourceEntries());
  populateDuelDefinitionSelect(els.duelCustomMechanisms, state.mechanisms?.mechanisms || []);
  populateDuelDefinitionSelect(els.duelCustomToolTags, state.mechanisms?.cursedTools || []);
}

function populateDuelDefinitionSelect(select, entries) {
  if (!select) return;
  const seen = new Set();
  const options = (entries || [])
    .map((entry) => normalizeCustomDuelText(typeof entry === "string" ? entry : (entry.displayName || entry.text || entry.id || "")))
    .filter((label) => {
      if (!label || seen.has(label)) return false;
      seen.add(label);
      return true;
    })
    .map((label) => {
      return `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`;
    })
    .join("");
  if (select.dataset.optionSignature === options) return;
  const selected = new Set(readSelectedDuelDefinitionValues(select));
  select.innerHTML = options;
  setSelectedDuelDefinitionValues(select, [...selected]);
  select.dataset.optionSignature = options;
}

function buildDuelTechniqueLibraryEntries() {
  return [
    ...getDuelWheelOptionTexts(11),
    "自定义尸体/僵尸操术",
    "自定义结界术式"
  ];
}

function buildDuelDomainLibraryEntries() {
  return [
    ...DUEL_CURATED_DOMAIN_TAGS,
    ...getDuelWheelOptionTexts(51).map((item) => `领域类型：${item}`),
    ...getDuelWheelOptionTexts(52).map((item) => `领域效果：${item}`)
  ];
}

function buildDuelAdvancedLibraryEntries() {
  return [
    ...getDuelWheelOptionTexts(45),
    ...getDuelWheelOptionTexts(47),
    ...(state.mechanisms?.mechanisms || []).map((item) => item.displayName || item.id)
  ];
}

function buildDuelExternalResourceEntries() {
  const techniqueResources = getDuelWheelOptionTexts(11)
    .filter((item) => /式神|咒灵|操术|傀儡|付丧|降灵|模仿/.test(item));
  const customTechniqueResources = getDuelWheelOptionTexts(88)
    .filter((item) => /式神|操术|空间|假想|概念|元素/.test(item))
    .map((item) => `术式资源：${item}`);
  return [
    ...DUEL_CURATED_EXTERNAL_RESOURCES,
    ...techniqueResources,
    ...customTechniqueResources
  ];
}

function getDuelWheelOptionTexts(wheelId) {
  return (getWheel(wheelId)?.items || [])
    .map((item) => normalizeCustomDuelText(item.text || ""))
    .filter(Boolean);
}

function syncDuelCustomMode() {
  const mode = getDuelCustomMode();
  els.duelCustomModePanels?.forEach((panel) => {
    panel.hidden = panel.dataset.duelCustomModePanel !== mode;
  });
  if (mode === "ai" && els.duelAiAssistToggle && !els.duelAiAssistToggle.checked) {
    els.duelAiAssistToggle.checked = true;
    window.localStorage.setItem(DUEL_AI_ASSIST_STORAGE_KEY, "yes");
    syncDuelAiAssistPanel();
  }
}

function getDuelCustomMode() {
  const checked = Array.from(els.duelCustomModeInputs || []).find((input) => input.checked);
  return checked?.value === "ai" ? "ai" : "library";
}

function setDuelCustomMode(mode) {
  const value = mode === "ai" ? "ai" : "library";
  els.duelCustomModeInputs?.forEach((input) => {
    input.checked = input.value === value;
  });
  syncDuelCustomMode();
}

function applyDuelLibrarySelectionToFields() {
  const selection = readDuelLibrarySelection();
  mergeDuelTextInput(els.duelCustomTechnique, selection.techniques);
  mergeDuelTextInput(els.duelCustomDomain, selection.domains);
  mergeDuelTextArea(els.duelCustomTraits, selection.advanced);
  mergeDuelTextInput(els.duelCustomResource, selection.resources);
  const count = selection.techniques.length + selection.domains.length + selection.advanced.length + selection.resources.length;
  if (els.duelLibraryStatus) {
    els.duelLibraryStatus.textContent = count
      ? `已应用 ${count} 个定义库选项；加入角色池时会进入同一套战力计算。`
      : "尚未选择定义库选项。";
  }
}

function readDuelLibrarySelection() {
  if (getDuelCustomMode() !== "library") {
    return { techniques: [], domains: [], advanced: [], resources: [] };
  }
  return {
    techniques: readSelectedDuelDefinitionValues(els.duelCustomTechniqueTags),
    domains: readSelectedDuelDefinitionValues(els.duelCustomDomainTags),
    advanced: readSelectedDuelDefinitionValues(els.duelCustomAdvancedTags),
    resources: readSelectedDuelDefinitionValues(els.duelCustomResourceTags)
  };
}

function mergeDuelTextInput(input, values = []) {
  if (!input) return;
  input.value = mergeDuelLocalList(splitCustomDuelList(input.value), values).join("、");
}

function mergeDuelTextArea(textarea, values = []) {
  if (!textarea) return;
  textarea.value = mergeDuelLocalList(splitCustomDuelList(textarea.value), values).join("、");
}

function buildDuelRankOptions(selected) {
  return DUEL_RANKS
    .map((rank) => `<option value="${escapeHtml(rank)}"${rank === selected ? " selected" : ""}>${escapeHtml(rank)}</option>`)
    .join("");
}

//--斗蛐蛐AI辅助表单UI--//
function applyDuelAiSuggestion(suggestion) {
  if (suggestion.name && els.duelCustomName) els.duelCustomName.value = suggestion.name;
  if (els.duelCustomGrade) els.duelCustomGrade.value = suggestion.visibleGrade;
  if (els.duelCustomStage) els.duelCustomStage.value = suggestion.stage;
  if (els.duelCustomTechniquePower) els.duelCustomTechniquePower.value = suggestion.techniquePower;
  els.duelCustomRankSelects?.forEach((select) => {
    const stat = select.dataset.duelCustomRank;
    if (stat && suggestion.stats[stat]) select.value = suggestion.stats[stat];
  });
  if (els.duelCustomTechnique) els.duelCustomTechnique.value = suggestion.technique;
  if (els.duelCustomDomain) els.duelCustomDomain.value = suggestion.domain;
  if (els.duelCustomTools) els.duelCustomTools.value = suggestion.tools.join("、");
  if (els.duelCustomTraits) {
    els.duelCustomTraits.value = mergeDuelLocalList(
      suggestion.traits,
      (suggestion.generatedTerms || []).map((term) => term.name)
    ).join("、");
  }
  if (els.duelCustomResource) els.duelCustomResource.value = suggestion.externalResource;
  if (els.duelCustomNotes) els.duelCustomNotes.value = suggestion.notes;
  addGeneratedDuelSpecialTerms(suggestion.generatedTerms || []);
}

function updateDuelAiStatus(message, isError = false) {
  if (!els.duelAiStatus) return;
  els.duelAiStatus.textContent = message || "";
  els.duelAiStatus.classList.toggle("error-text", Boolean(isError));
}

function renderDuelAiOutput(text) {
  if (!els.duelAiOutput) return;
  els.duelAiOutput.textContent = text || "";
  els.duelAiOutput.hidden = !text;
}

function buildDuelAiFailureMessage(error) {
  if (error?.name === "AbortError") return "AI辅助请求超过 150 秒，已自动中断。";
  if (error?.status === 404) return "当前 AI 服务还没有部署新版斗蛐蛐辅助接口。请先部署新版 Worker，或继续手填。";
  if (error?.status === 429) return error?.message || "AI 生成次数暂时达到限制，请稍后再试。";
  return error?.message || "AI辅助服务暂时不可用。";
}

//--转盘页面渲染与AI自由控件UI--//
function renderAll() {
  if (isDrawModeInteractionLocked()) {
    syncDrawModeControlLock();
  } else {
    renderCurrentTask();
  }
  renderState();
  renderStrength();
  renderUsageStats();
  renderResults();
}

function renderCurrentTask() {
  const task = state.currentTask;
  els.stageBadge.textContent = task.stage || "流程";
  els.currentTitle.textContent = task.title;
  els.currentWhy.textContent = task.why || "";
  els.stepCounter.textContent = `${state.records.filter((item) => !item.skipped).length} 个结果`;
  els.drawBtn.disabled = true;
  els.drawBtn.textContent = "抽取";
  els.nextBtn.disabled = true;
  els.nextBtn.hidden = true;

  if (task.type === "end") {
    els.wheelArea.innerHTML = `<div class="empty-state">${escapeHtml(task.why || "完成")}</div>`;
    renderDebugForceControl(task);
    return;
  }

  if (task.type === "choice") {
    els.wheelArea.innerHTML = `<div class="choice-grid">${task.options.map((option, index) => (
      `<button type="button" data-choice="${index}">${escapeHtml(option.text)}</button>`
    )).join("")}</div><div id="resultCard"></div>`;
    els.wheelArea.querySelectorAll("[data-choice]").forEach((button) => {
      button.addEventListener("click", () => {
        chooseChoiceOption(task, Number(button.dataset.choice), { delayMs: getChoiceDelayMs(), label: "选择结果" });
      });
    });
    els.drawBtn.disabled = false;
    els.drawBtn.textContent = "随机选择";
    renderDebugForceControl(task);
    return;
  }

  if (task.type === "computed") {
    els.wheelArea.innerHTML = buildComputedGradeMarkup(task);
    els.drawBtn.disabled = false;
    els.drawBtn.textContent = "确认判定";
    renderDebugForceControl(task);
    return;
  }

  const wheel = getTaskWheel(task);
  if (!wheel) {
    els.wheelArea.innerHTML = `<div class="empty-state">找不到该转盘。</div>`;
    renderDebugForceControl(task);
    return;
  }

  els.wheelArea.innerHTML = `
    ${buildWheelMarkup(wheel, task)}
    ${buildHalfCustomMarkup(task, wheel)}
    <div id="resultCard"></div>
  `;
  els.drawBtn.disabled = false;
  bindAiFreeControl(task);
  bindHalfCustomControl(task);
  renderDebugForceControl(task);
}

function canAiFreeTask(task, modeSnapshot = null) {
  const aiFreeEnabled = modeSnapshot
    ? Boolean(modeSnapshot.aiFreeEnabled)
    : Boolean(state.aiFreeEnabled);
  return aiFreeEnabled && task?.type === "wheel" && task.aiFreeBridge !== true && Boolean(getTaskWheel(task));
}

function buildAiFreeMarkup(task, result, modeSnapshot = null) {
  if (!canAiFreeTask(task, modeSnapshot)) return "";
  const anchorText = normalizeAiFreeText(result?.text || "");
  if (!anchorText) return "";
  const anchorIndex = Number.isInteger(result?.index) ? result.index : "";
  return `
    <div class="ai-free-panel" id="aiFreePanel">
      <div class="ai-free-head">
        <strong>行动策略（AI辅助）</strong>
        <span class="ai-free-help-text">已先完成本节点抽取；你的行动策略只影响后续权重。</span>
      </div>
      <div class="field ai-free-anchor">
        <span>当前结果（合法主线）</span>
        <div id="aiFreeAnchorText" class="ai-free-anchor-result" data-ai-free-anchor-index="${escapeHtml(String(anchorIndex))}">${escapeHtml(anchorText)}</div>
        <small class="ai-free-help-text">这是本次已经抽中的正式结果，行动策略不能改写它。</small>
      </div>
      <label class="field ai-free-story" for="aiFreeText">
        <span>你的行动策略（影响后续）</span>
        <textarea id="aiFreeText" maxlength="${AI_FREE_MAX_TEXT_LENGTH}" rows="3" placeholder="例：先观察敌方行动，保护同伴，避免正面冲突，并寻找反击机会。"></textarea>
        <small class="ai-free-help-text">这段内容会被解析为调查、保护、修炼、保命、强攻等倾向，用于影响后续候选项权重。</small>
      </label>
      <div class="ai-free-strategy-section">
        <strong>快速策略</strong>
        <p class="ai-free-help-text">点击后会把对应倾向加入行动策略。</p>
        <div class="ai-free-strategy-buttons">
          ${AI_FREE_PRESETS.map((preset) => `<button class="secondary" type="button" data-ai-free-preset="${escapeHtml(preset.id)}">${escapeHtml(preset.label)}</button>`).join("")}
        </div>
      </div>
      <div id="aiFreeAnalysisPanel" class="ai-free-analysis-panel">
        ${renderAiFreeAnalysisPreview({ text: "", tags: [], weightBias: createEmptyAiFreeBias(), summary: "" }, { status: "idle" })}
      </div>
      <div class="ai-free-actions">
        <button id="aiFreeApplyBtn" class="primary" type="button">确认行动策略</button>
        <span id="aiFreeStatus" class="ai-free-help-text">确认后：当前已抽中结果保持不变；行动策略写入记录，并影响后续权重。</span>
      </div>
    </div>
  `;
}

function getDefaultAiFreeAnchorIndex(options) {
  const best = options.reduce((current, item) => (
    Number(item.weight || 0) > Number(current?.weight || 0) ? item : current
  ), options[0]);
  return best?.index ?? options[0]?.index ?? 0;
}

function bindAiFreeControl(task) {
  const panel = els.wheelArea.querySelector("#aiFreePanel");
  if (!panel) return;
  panel.querySelector("#aiFreeApplyBtn")?.addEventListener("click", () => applyAiFreeSelection(task));
  panel.querySelector("#aiFreeText")?.addEventListener("input", () => scheduleAiFreeAnalysisPreview(task));
  panel.querySelector("#aiFreeAnchorSelect")?.addEventListener("change", () => scheduleAiFreeAnalysisPreview(task));
  panel.querySelectorAll("[data-ai-free-preset]").forEach((button) => {
    button.addEventListener("click", () => applyAiFreePreset(button.dataset.aiFreePreset));
  });
  scheduleAiFreeAnalysisPreview(task);
}

function shouldWaitForAiFreeStrategy(task, result, modeSnapshot = null) {
  return canAiFreeTask(task, modeSnapshot) &&
    Boolean(result) &&
    Number.isInteger(result.index) &&
    Boolean(normalizeAiFreeText(result.text));
}

function showAiFreePostDrawPanel(task, result, token, modeSnapshot = getSpinModeSnapshot(token)) {
  if (!shouldWaitForAiFreeStrategy(task, result, modeSnapshot) || token !== state.spinToken) return false;
  const card = els.wheelArea.querySelector("#resultCard");
  if (!card) return false;
  card.insertAdjacentHTML("beforeend", buildAiFreeMarkup(task, result, modeSnapshot));
  bindAiFreeControl(task);
  els.drawBtn.disabled = true;
  els.drawBtn.textContent = "等待策略";
  els.nextBtn.disabled = true;
  els.nextBtn.hidden = true;
  return true;
}

function applyAiFreePreset(presetId) {
  const preset = AI_FREE_PRESETS.find((item) => item.id === presetId);
  const textarea = els.wheelArea.querySelector("#aiFreeText");
  if (!preset || !textarea) return;
  const current = normalizeAiFreeText(textarea.value);
  textarea.value = current ? `${current} ${preset.text}`.slice(0, AI_FREE_MAX_TEXT_LENGTH) : preset.text;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.focus();
}

async function applyAiFreeSelection(task) {
  if (!canAiFreeTask(task) || state.isSpinning) return;
  const panel = els.wheelArea.querySelector("#aiFreePanel");
  const textarea = panel?.querySelector("#aiFreeText");
  const status = panel?.querySelector("#aiFreeStatus");
  const applyBtn = panel?.querySelector("#aiFreeApplyBtn");
  if (!panel || panel.dataset.aiFreeApplying === "true") return;
  const actionText = normalizeAiFreeText(textarea?.value || "");
  if (!actionText) {
    if (status) {
      status.textContent = "先写一段行动策略，或点击快速策略按钮。";
      status.classList.add("error-text");
    }
    textarea?.focus();
    return;
  }

  const option = state.pendingResult;
  const anchorText = normalizeAiFreeText(option?.text || "");
  if (!option || !anchorText || task !== state.currentTask) return;

  let remoteInfluence = getCachedAiFreeAnalysis(panel, actionText, anchorText);
  if (!remoteInfluence) {
    panel.dataset.aiFreeApplying = "true";
    if (applyBtn) applyBtn.disabled = true;
    if (status) {
      status.textContent = "正在请求远端 AI 解析行动策略，本次确认会使用该解析结果。";
      status.classList.remove("error-text");
    }
    try {
      remoteInfluence = await requestAiFreeInfluenceForTask(task, actionText, anchorText);
      cacheAiFreeAnalysis(panel, actionText, anchorText, remoteInfluence);
      renderAiFreeAnalysisForPanel(panel, remoteInfluence, { status: "remote" });
    } catch (error) {
      if (status) {
        status.textContent = buildAiFreeAnalysisFailureMessage(error);
        status.classList.add("error-text");
      }
      renderAiFreeAnalysisForPanel(panel, {
        text: actionText,
        tags: [],
        weightBias: createEmptyAiFreeBias(),
        summary: ""
      }, {
        status: "error",
        message: buildAiFreeAnalysisFailureMessage(error)
      });
      panel.dataset.aiFreeApplying = "false";
      if (applyBtn) applyBtn.disabled = false;
      return;
    }
  }

  const influence = buildAiFreeInfluence(task, actionText, anchorText, remoteInfluence);
  const aiFreeAssistTrace = buildAiFreeAssistTrace(influence, anchorText);
  const sourceSelectionMode = option.selectionMode || "random";
  const selectedIndexes = getPendingResultIndexes(option);
  state.isSpinning = true;
  state.pendingResult = {
    ...option,
    selectionMode: "aiFree",
    aiFreeInteraction: {
      text: actionText,
      anchorText,
      summary: influence.summary,
      analysis: aiFreeAssistTrace,
      sourceSelectionMode
    },
    aiFreeInfluence: influence,
    aiFreeAssistTrace
  };
  state.spinToken += 1;
  stopResultSpeech();
  const token = state.spinToken;
  const modeSnapshot = beginSpinModeSnapshot(token);
  els.drawBtn.disabled = true;
  els.drawBtn.textContent = "已写入";
  panel.querySelectorAll("select, textarea, button").forEach((item) => {
    item.disabled = true;
  });
  panel.dataset.aiFreeApplying = "false";
  showResult(formatAiFreeResultDisplay(anchorText, influence), selectedIndexes, {
    label: "行动策略结果",
    note: "行动策略已写入，进入下一步。"
  });
  window.setTimeout(() => {
    if (token !== state.spinToken) return;
    state.isSpinning = false;
    acceptAndAdvance();
  }, getResultHoldMs());
}

function formatAiFreeResultDisplay(anchorText, influence) {
  const summary = influence?.summary || "暂未识别出明确倾向";
  return `合法主线结果：${anchorText}\n后续倾向：${summary}`;
}

function canHalfCustomTask(task) {
  return state.playMode === "semi" && task?.type === "wheel" && HALF_CUSTOM_NODE_IDS.has(task.nodeId);
}

function getHalfCustomOptions(task, wheel = getTaskWheel(task)) {
  if (!wheel) return [];
  return getWeightedOptions(wheel, task);
}

function buildHalfCustomMarkup(task, wheel) {
  if (!canHalfCustomTask(task)) return "";
  const options = getHalfCustomOptions(task, wheel);
  if (options.length === 0) return "";
  const note = HALF_CUSTOM_NOTES[task.nodeId] || "仅影响人设记录，不直接改变强度或战斗结果。";
  return `
    <div class="half-custom-panel" id="halfCustomPanel">
      <label for="halfCustomSelect">半自定义自选</label>
      <select id="halfCustomSelect">
        ${options.map((item) => `<option value="${item.index}">${escapeHtml(item.text)}</option>`).join("")}
      </select>
      <button id="halfCustomApplyBtn" class="secondary" type="button">使用此选项</button>
      <span class="muted">${escapeHtml(note)} 也可以直接点击“抽取”按权重随机。</span>
    </div>
  `;
}

function buildComputedGradeMarkup(task) {
  const grade = task.computedGrade || resolveDeterministicGrade();
  const floorMarkup = grade.floorApplied
    ? `<p>保底修正：${escapeHtml(grade.floorLabel)} -> ${escapeHtml(grade.label)}</p>`
    : "";
  return `
    <div class="computed-grade-card">
      <span>等级有效分</span>
      <strong>${escapeHtml(formatNumber(grade.score))}</strong>
      <p>区间 ${escapeHtml(grade.rangeText)}：${escapeHtml(grade.baseLabel)}</p>
      ${floorMarkup}
    </div>
    <div id="resultCard"></div>
  `;
}

function bindHalfCustomControl(task) {
  const panel = els.wheelArea.querySelector("#halfCustomPanel");
  if (!panel) return;
  const button = panel.querySelector("#halfCustomApplyBtn");
  button?.addEventListener("click", () => applyHalfCustomSelection(task));
}

function applyHalfCustomSelection(task) {
  if (!canHalfCustomTask(task) || state.isSpinning) return;
  const select = els.wheelArea.querySelector("#halfCustomSelect");
  const index = Number(select?.value);
  const option = getHalfCustomOptions(task).find((item) => item.index === index);
  if (!option) return;

  state.isSpinning = true;
  state.pendingResult = {
    ...option,
    customSelected: true,
    selectionMode: "halfCustom"
  };
  state.spinToken += 1;
  stopResultSpeech();
  const token = state.spinToken;
  const modeSnapshot = beginSpinModeSnapshot(token);
  els.drawBtn.disabled = true;
  els.drawBtn.textContent = "已自选";
  els.wheelArea.querySelectorAll("#halfCustomSelect, #halfCustomApplyBtn").forEach((item) => {
    item.disabled = true;
  });
  const waitForAiFreeStrategy = shouldWaitForAiFreeStrategy(task, state.pendingResult, modeSnapshot);
  showResult(option.text, [option.index], {
    label: "自选结果",
    note: waitForAiFreeStrategy
      ? "AI辅助已开启：自选结果已固定，请填写或点击快速策略后确认。"
      : undefined
  });
  if (waitForAiFreeStrategy) {
    state.isSpinning = false;
    showAiFreePostDrawPanel(task, state.pendingResult, token, modeSnapshot);
    return;
  }
  window.setTimeout(() => {
    if (token !== state.spinToken) return;
    state.isSpinning = false;
    acceptAndAdvance();
  }, getResultHoldMs());
}

function normalizeAiFreeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, AI_FREE_MAX_TEXT_LENGTH);
}

function createEmptyAiFreeBias() {
  return Object.fromEntries(AI_FREE_BIAS_KEYS.map((key) => [key, 0]));
}

function scheduleAiFreeAnalysisPreview(task = state.currentTask) {
  const panel = els.wheelArea.querySelector("#aiFreePanel");
  if (!panel) return;
  window.clearTimeout(aiFreeAnalysisPreviewTimer);
  const actionText = normalizeAiFreeText(panel.querySelector("#aiFreeText")?.value || "");
  const anchorText = getSelectedAiFreeAnchorText(panel);
  if (!actionText) {
    clearCachedAiFreeAnalysis(panel);
    renderAiFreeAnalysisForPanel(panel, {
      text: "",
      tags: [],
      weightBias: createEmptyAiFreeBias(),
      summary: ""
    }, { status: "idle" });
    return;
  }

  const cached = getCachedAiFreeAnalysis(panel, actionText, anchorText);
  if (cached) {
    renderAiFreeAnalysisForPanel(panel, cached, { status: "remote" });
    return;
  }

  renderAiFreeAnalysisForPanel(panel, {
    text: actionText,
    tags: [],
    weightBias: createEmptyAiFreeBias(),
    summary: ""
  }, { status: "loading" });
  aiFreeAnalysisPreviewTimer = window.setTimeout(() => {
    refreshAiFreeAnalysisPreview(task, actionText, anchorText, panel);
  }, AI_FREE_ANALYSIS_DEBOUNCE_MS);
}

async function refreshAiFreeAnalysisPreview(task, actionText, anchorText, panel) {
  const requestSeq = ++aiFreeAnalysisRequestSeq;
  panel.dataset.aiFreeRequestSeq = String(requestSeq);
  try {
    const influence = await requestAiFreeInfluenceForTask(task, actionText, anchorText);
    const activePanel = els.wheelArea.querySelector("#aiFreePanel");
    if (activePanel !== panel || panel.dataset.aiFreeRequestSeq !== String(requestSeq)) return;
    cacheAiFreeAnalysis(panel, actionText, anchorText, influence);
    renderAiFreeAnalysisForPanel(panel, influence, { status: "remote" });
  } catch (error) {
    const activePanel = els.wheelArea.querySelector("#aiFreePanel");
    if (activePanel !== panel || panel.dataset.aiFreeRequestSeq !== String(requestSeq)) return;
    clearCachedAiFreeAnalysis(panel);
    renderAiFreeAnalysisForPanel(panel, {
      text: actionText,
      tags: [],
      weightBias: createEmptyAiFreeBias(),
      summary: ""
    }, {
      status: "error",
      message: buildAiFreeAnalysisFailureMessage(error)
    });
  }
}

function renderAiFreeAnalysisForPanel(panel, influence, meta = {}) {
  const analysisPanel = panel?.querySelector("#aiFreeAnalysisPanel");
  if (!analysisPanel) return;
  analysisPanel.innerHTML = renderAiFreeAnalysisPreview(influence, meta);
}

function cacheAiFreeAnalysis(panel, actionText, anchorText, influence) {
  if (!panel || !influence) return;
  panel.__aiFreeAnalysisCache = {
    actionText: normalizeAiFreeText(actionText),
    anchorText: normalizeAiFreeText(anchorText),
    influence
  };
}

function clearCachedAiFreeAnalysis(panel) {
  if (panel) panel.__aiFreeAnalysisCache = null;
}

function getCachedAiFreeAnalysis(panel, actionText, anchorText) {
  const cache = panel?.__aiFreeAnalysisCache;
  if (!cache) return null;
  return cache.actionText === normalizeAiFreeText(actionText) &&
    cache.anchorText === normalizeAiFreeText(anchorText)
    ? cache.influence
    : null;
}

function getSelectedAiFreeAnchorText(panel = els.wheelArea.querySelector("#aiFreePanel")) {
  const anchor = panel?.querySelector("#aiFreeAnchorText");
  if (anchor) return normalizeAiFreeText(anchor.textContent || "");
  const select = panel?.querySelector("#aiFreeAnchorSelect");
  return normalizeAiFreeText(select?.selectedOptions?.[0]?.textContent || "");
}

//--调试控件与转盘SVG音频UI--//
function renderDebugForceControl(task) {
  renderDebugEntryEditor(task);
  if (!els.debugForcePanel || !els.debugForcedOptionSelect) return;
  const options = getForceableOptions(task);
  const show = state.debugMode && options.length > 0 && task.type !== "end";
  els.debugForcePanel.hidden = !show;
  if (!show) {
    els.debugForcedOptionSelect.innerHTML = `<option value="">按权重随机</option>`;
    return;
  }

  els.debugForcedOptionSelect.innerHTML = `
    <option value="">按权重随机</option>
    ${options.map((item) => {
      const disabled = Number(item.weight ?? 1) <= 0 ? " disabled" : "";
      const weight = task.type === "choice" ? "选择项" : formatWeightDebug(item);
      return `<option value="${item.index}"${disabled}>${escapeHtml(item.text)}（${escapeHtml(weight)}）</option>`;
    }).join("")}
  `;
  const mode = task.type === "multiDraw" ? "多抽池会先抽指定项，后续次数继续按权重抽取。" : "只影响当前这一次抽取。";
  els.debugForcedOptionHint.textContent = `${mode} 权重为 0 的选项不能强制抽出。`;
}

function renderDebugEntryEditor(task) {
  if (!els.debugEntryPanel) return;
  const target = getDebugEditableEntryTarget(task);
  els.debugEntryPanel.hidden = !target;
  if (!target) return;

  const previousValue = els.debugEntrySelect?.value || "";
  const selectedValue = target.items[Number(previousValue)] ? previousValue : "";
  if (els.debugEntrySelect) {
    els.debugEntrySelect.innerHTML = `
      <option value="">新建词条</option>
      ${target.items.map((item, index) => `<option value="${index}">${escapeHtml(`${index + 1}. ${String(item.text || "").slice(0, 48)}`)}</option>`).join("")}
    `;
    els.debugEntrySelect.value = selectedValue;
  }
  loadDebugEntryEditorSelection();
  setDebugEntryStatus(`${target.label}；运行态编辑，不写回原始 JSON。`);
}

function getDebugEditableEntryTarget(task = state.currentTask) {
  if (!state.debugMode || !task) return null;
  if (task.type === "choice" && Array.isArray(task.options)) {
    return {
      kind: "choice",
      label: task.title || "当前选择项",
      items: task.options
    };
  }
  if (task.type !== "wheel" && task.type !== "multiDraw") return null;
  const wheel = getTaskWheel(task);
  if (!wheel || !Array.isArray(wheel.items)) return null;
  return {
    kind: "wheel",
    label: `W${wheel.dbId} ${wheel.title || task.title || "当前转盘"}`,
    items: wheel.items
  };
}

function loadDebugEntryEditorSelection() {
  const target = getDebugEditableEntryTarget();
  if (!target) return;
  const index = Number(els.debugEntrySelect?.value);
  const item = Number.isInteger(index) ? target.items[index] : null;
  if (els.debugEntryText) els.debugEntryText.value = item?.text || "";
  if (els.debugEntryWeight) els.debugEntryWeight.value = item ? String(parseWeight(item.weight)) : "1";
  if (els.debugEntrySaveBtn) els.debugEntrySaveBtn.disabled = !item;
  if (els.debugEntryDeleteBtn) els.debugEntryDeleteBtn.disabled = !item;
}

function addDebugEntry() {
  const target = getDebugEditableEntryTarget();
  if (!target || state.isSpinning) return;
  const draft = readDebugEntryDraft();
  if (!draft) return;
  const item = {
    text: draft.text,
    weight: draft.weight,
    debugCreated: true
  };
  target.items.push(item);
  refreshAfterDebugEntryMutation(target.items.length - 1, "已新增调试词条。");
}

function saveDebugEntry() {
  const target = getDebugEditableEntryTarget();
  if (!target || state.isSpinning) return;
  const index = Number(els.debugEntrySelect?.value);
  if (!Number.isInteger(index) || !target.items[index]) return;
  const draft = readDebugEntryDraft();
  if (!draft) return;
  target.items[index] = {
    ...target.items[index],
    text: draft.text,
    weight: draft.weight,
    debugEdited: true
  };
  refreshAfterDebugEntryMutation(index, "已保存调试词条。");
}

function deleteDebugEntry() {
  const target = getDebugEditableEntryTarget();
  if (!target || state.isSpinning) return;
  const index = Number(els.debugEntrySelect?.value);
  if (!Number.isInteger(index) || !target.items[index]) return;
  target.items.splice(index, 1);
  const nextIndex = target.items[index] ? index : target.items[index - 1] ? index - 1 : "";
  refreshAfterDebugEntryMutation(nextIndex, "已删除调试词条。");
}

function readDebugEntryDraft() {
  const text = String(els.debugEntryText?.value || "").replace(/\s+/g, " ").trim();
  if (!text) {
    setDebugEntryStatus("词条文本不能为空。", true);
    els.debugEntryText?.focus();
    return null;
  }
  const weight = Number(els.debugEntryWeight?.value || 1);
  return {
    text: text.slice(0, 220),
    weight: Number.isFinite(weight) && weight > 0 ? Number(weight.toFixed(3)) : 1
  };
}

function refreshAfterDebugEntryMutation(selectedIndex, message) {
  state.pendingResult = null;
  state.spinToken += 1;
  state.isSpinning = false;
  clearSpinModeSnapshot();
  renderAll();
  if (els.debugEntrySelect) {
    els.debugEntrySelect.value = selectedIndex === "" ? "" : String(selectedIndex);
  }
  loadDebugEntryEditorSelection();
  setDebugEntryStatus(message);
}

function setDebugEntryStatus(message, isError = false) {
  if (!els.debugEntryStatus) return;
  els.debugEntryStatus.textContent = message || "";
  els.debugEntryStatus.classList.toggle("error-text", Boolean(isError));
}

function buildWheelMarkup(wheel, task, context = {}) {
  const options = getWeightedOptions(wheel, task, context);
  const densityClass = getWheelDensityClass(options.length);
  return `
    <div class="wheel-layout ${densityClass}">
      <div class="wheel-stage" aria-hidden="true">
        <div class="wheel-pointer"></div>
        <div id="wheelRotor" class="wheel-rotor">
          <svg class="wheel-svg" viewBox="0 0 500 500" role="img" aria-label="${escapeHtml(wheel.title)}">
            <g class="wheel-slice-layer">
              ${buildWheelSlices(options)}
            </g>
            <circle class="wheel-inner-guide" cx="250" cy="250" r="118"></circle>
            <g class="wheel-label-layer">
              ${buildWheelLabels(options)}
            </g>
          </svg>
        </div>
        <div class="wheel-hub"></div>
      </div>
      <div class="wheel-debug-list debug-only">
        ${options.map((item, index) => `
          <div class="wheel-debug-row">
            <span class="swatch" style="background:${colorForIndex(index)}"></span>
            <span>${escapeHtml(item.text)}</span>
            <strong>${formatWeightDebug(item)}</strong>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function buildWheelSlices(options) {
  const drawable = getDrawableOptions(options);
  const total = drawable.reduce((sum, item) => sum + Number(item.weight ?? 1), 0);
  let cursor = 0;
  return drawable.map((item) => {
    const index = item.index ?? options.indexOf(item);
    const startAngle = (cursor / total) * 360;
    cursor += Number(item.weight ?? 1);
    const endAngle = (cursor / total) * 360;
    return `
      <path
        class="wheel-slice"
        data-option-index="${index}"
        fill="${colorForIndex(index)}"
        d="${sectorPath(250, 250, 250, startAngle, endAngle)}"
      ></path>
    `;
  }).join("");
}

function buildWheelLabels(options) {
  const drawable = getDrawableOptions(options);
  const total = drawable.reduce((sum, item) => sum + Number(item.weight ?? 1), 0);
  const metrics = getLabelMetrics(drawable.length);
  let cursor = 0;

  return drawable.map((item) => {
    const index = item.index ?? options.indexOf(item);
    const weight = Number(item.weight ?? 1);
    const midpoint = ((cursor + weight / 2) / total) * 360;
    cursor += weight;
    const sliceAngle = (weight / total) * 360;
    const readableAngle = getReadableLabelAngle(midpoint - 90);
    const localTextAngle = readableAngle - midpoint;
    const fontSize = getSliceFontSize(metrics.fontSize, sliceAngle, metrics.radius);
    const lines = formatWheelLabelLines(item.text, options.length);
    const lineHeight = fontSize * 1.04;
    const startY = metrics.y - ((lines.length - 1) * lineHeight) / 2;
    const tspans = lines.map((line, lineIndex) => (
      `<tspan x="250" y="${(startY + lineIndex * lineHeight).toFixed(2)}">${escapeHtml(line)}</tspan>`
    )).join("");
    return `
      <text
        class="wheel-label"
        data-option-index="${index}"
        font-size="${fontSize.toFixed(2)}"
        transform="rotate(${midpoint.toFixed(2)} 250 250) rotate(${localTextAngle.toFixed(2)} 250 ${metrics.y})"
      ><title>${escapeHtml(getWheelLabelTitle(item))}</title>${tspans}</text>
    `;
  }).join("");
}

function getDrawableOptions(options) {
  const drawable = options.filter((item) => Number(item.weight) > 0);
  return drawable.length ? drawable : options;
}

function getWheelLabelTitle(item) {
  return state.debugMode ? `${item.text}，${formatWeightDebug(item)}` : item.text;
}

function formatWeightDebug(item) {
  const base = Number(item.baseWeight ?? item.weight ?? 1);
  const adjusted = Number(item.weight ?? 1);
  if (!item.adjusted) return `权重 ${trimWeight(base)}`;
  return `基础 ${trimWeight(base)} / 调整 ${trimWeight(adjusted)}`;
}

function trimWeight(value) {
  return Number(value).toFixed(2).replace(/\.?0+$/, "");
}

function sectorPath(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${cx} ${cy}`,
    `L ${start.x.toFixed(3)} ${start.y.toFixed(3)}`,
    `A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`,
    "Z"
  ].join(" ");
}

function polarToCartesian(cx, cy, radius, angle) {
  const radians = (angle - 90) * Math.PI / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians)
  };
}

function colorForIndex(index) {
  return WHEEL_COLORS[index % WHEEL_COLORS.length];
}

function getReadableLabelAngle(visualAngle) {
  let angle = visualAngle;
  while (angle > 180) angle -= 360;
  while (angle < -180) angle += 360;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  return angle;
}

function getWheelDensityClass(count) {
  if (count > 32) return "wheel-ultra-dense";
  if (count > 18) return "wheel-dense";
  if (count > 10) return "wheel-medium";
  return "wheel-readable";
}

function getLabelMetrics(count) {
  if (count > 32) return { y: 62, radius: 188, fontSize: 10 };
  if (count > 18) return { y: 66, radius: 184, fontSize: 12 };
  if (count > 10) return { y: 72, radius: 178, fontSize: 16 };
  if (count > 6) return { y: 80, radius: 170, fontSize: 20 };
  return { y: 90, radius: 160, fontSize: 24 };
}

function getSliceFontSize(baseSize, sliceAngle, radius) {
  const arcWidth = (Math.PI * 2 * radius) * (sliceAngle / 360);
  const fitted = Math.max(7, Math.min(baseSize, arcWidth * 0.36));
  return fitted;
}

function formatWheelLabelLines(text, count) {
  const normalized = String(text)
    .replace(/\s+/g, "")
    .replace(/[，。！？、]/g, "")
    .trim();
  const compact = normalized.length > 4 ? normalized.replace(/[（(].*?[）)]/g, "") || normalized : normalized;
  const maxLength = count > 32 ? 3 : count > 18 ? 4 : count > 10 ? 6 : 8;
  const display = compact.length > maxLength ? compact.slice(0, maxLength) : compact;
  return [display];
}

function spinWheel(selectedIndex, durationMs, context = {}) {
  const rotor = els.wheelArea.querySelector("#wheelRotor");
  if (!rotor) return;

  const midpoint = getSegmentMidpoint(state.currentTask, selectedIndex, context);
  const turns = 7 + Math.floor(Math.random() * 3);
  const jitter = (Math.random() - 0.5) * 8;
  const targetRotation = turns * 360 + (360 - midpoint) + jitter;

  rotor.style.transition = "none";
  rotor.style.transform = "rotate(0deg)";
  rotor.getBoundingClientRect();
  rotor.style.transition = durationMs > 0
    ? `transform ${durationMs}ms cubic-bezier(.12,.74,.14,1)`
    : "none";
  rotor.style.transform = `rotate(${targetRotation.toFixed(2)}deg)`;
}

function getSegmentMidpoint(task, selectedIndex, context = {}) {
  const wheel = getTaskWheel(task);
  if (!wheel) return 0;

  const drawable = getDrawableOptions(getWeightedOptions(wheel, task, context));
  const total = drawable.reduce((sum, item) => sum + Number(item.weight ?? 1), 0);
  let cursor = 0;

  for (const item of drawable) {
    const weight = Number(item.weight ?? 1);
    if (item.index === selectedIndex) {
      return ((cursor + weight / 2) / total) * 360;
    }
    cursor += weight;
  }

  return 0;
}

function getPendingResultIndexes(result) {
  if (!result) return [];
  if (Array.isArray(result.results)) return result.results.map((item) => item.index);
  if (Number.isInteger(result.index)) return [result.index];
  return [];
}

async function primeWheelAudio() {
  if (!isWheelSoundEnabled()) return null;
  const audioContext = getWheelAudioContext();
  if (!audioContext) return null;

  try {
    await audioContext.resume?.();
  } catch {
    return null;
  }
  return audioContext;
}

function playSpinSound(durationMs, preparedAudioContext = null) {
  if (!isWheelSoundEnabled() || durationMs <= 0) {
    stopSpinSound();
    return;
  }

  const audioContext = preparedAudioContext || getWheelAudioContext();
  if (!audioContext) return;

  if (!preparedAudioContext) {
    const resumeResult = audioContext.resume?.();
    if (resumeResult?.catch) resumeResult.catch(() => {});
  }

  stopSpinSound(30);
  const token = state.spinSoundToken + 1;
  state.spinSoundToken = token;

  const durationSec = Math.max(0.12, durationMs / 1000);
  const startTime = audioContext.currentTime + 0.016;
  const endTime = startTime + durationSec;
  const masterGain = audioContext.createGain();
  masterGain.gain.setValueAtTime(0.0001, startTime);
  masterGain.gain.exponentialRampToValueAtTime(0.96, startTime + 0.018);
  masterGain.gain.setValueAtTime(0.96, endTime - 0.03);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, endTime + 0.05);
  masterGain.connect(audioContext.destination);
  state.spinSoundGain = masterGain;

  scheduleWheelTicks(audioContext, masterGain, startTime, endTime);
  window.setTimeout(() => {
    if (token !== state.spinSoundToken) return;
    try {
      masterGain.disconnect();
    } catch {
      // Already disconnected by a later spin or by disabling sound.
    }
    if (state.spinSoundGain === masterGain) state.spinSoundGain = null;
  }, durationMs + 450);
}

function stopSpinSound(fadeMs = 60) {
  state.spinSoundToken = (state.spinSoundToken || 0) + 1;
  const audioContext = state.audioContext;
  const gain = state.spinSoundGain;
  state.spinSoundGain = null;
  if (!audioContext || !gain) return;

  const now = audioContext.currentTime;
  try {
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(0.0001, now, Math.max(0.01, fadeMs / 1000));
    window.setTimeout(() => {
      try {
        gain.disconnect();
      } catch {
        // The node may already be disconnected after a natural fade-out.
      }
    }, fadeMs + 120);
  } catch {
    // Audio graph cleanup should never block the draw flow.
  }
}

function getWheelAudioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (state.audioContext) return state.audioContext;

  try {
    state.audioContext = new AudioContext();
  } catch {
    state.audioContext = null;
  }
  return state.audioContext;
}

function scheduleWheelTicks(audioContext, destination, startTime, endTime) {
  const tickIntervalSec = 0.036;
  for (let tickTime = startTime; tickTime < endTime - 0.018; tickTime += tickIntervalSec) {
    playWheelTick(audioContext, destination, tickTime);
  }
}

function playWheelTick(audioContext, destination, when = audioContext.currentTime) {
  const now = when;
  const tickPitch = 1180 + Math.random() * 28;
  const oscillator = audioContext.createOscillator();
  const toneGain = audioContext.createGain();

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(tickPitch, now);
  toneGain.gain.setValueAtTime(0.0001, now);
  toneGain.gain.exponentialRampToValueAtTime(0.18, now + 0.002);
  toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.024);
  oscillator.connect(toneGain);
  toneGain.connect(destination);
  oscillator.start(now);
  oscillator.stop(now + 0.04);

  const noise = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const noiseGain = audioContext.createGain();
  noise.buffer = createNoiseBuffer(audioContext, 0.018);
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(2800, now);
  filter.Q.setValueAtTime(7.5, now);
  noiseGain.gain.setValueAtTime(0.0001, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.12, now + 0.002);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(destination);
  noise.start(now);
  noise.stop(now + 0.024);
}

function createNoiseBuffer(audioContext, durationSec) {
  const length = Math.max(1, Math.floor(audioContext.sampleRate * durationSec));
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    const fade = 1 - index / length;
    data[index] = (Math.random() * 2 - 1) * fade * fade;
  }
  return buffer;
}

function speakResult(text, details = {}) {
  if (!isResultSpeechEnabled()) return;
  const synth = window.speechSynthesis;
  if (!synth || typeof window.SpeechSynthesisUtterance === "undefined") return;

  const resultText = normalizeSpeechText(text);
  if (!resultText) return;

  const utterance = new SpeechSynthesisUtterance(
    details.totalSteps
      ? `第${details.currentStep}次，${resultText}`
      : resultText
  );
  utterance.lang = "zh-CN";
  utterance.rate = 1.02;
  utterance.pitch = 1;
  utterance.volume = 1;

  const voice = getChineseSpeechVoice();
  if (voice) utterance.voice = voice;

  synth.resume?.();
  synth.speak(utterance);
}

function stopResultSpeech() {
  window.speechSynthesis?.cancel?.();
}

function getChineseSpeechVoice() {
  if (state.speechVoice) return state.speechVoice;
  const voices = window.speechSynthesis?.getVoices?.() || [];
  state.speechVoice =
    voices.find((voice) => /^zh[-_]?CN/i.test(voice.lang)) ||
    voices.find((voice) => /^zh/i.test(voice.lang)) ||
    voices.find((voice) => /Chinese|Mandarin|中文|普通话/i.test(voice.name)) ||
    null;
  return state.speechVoice;
}

function normalizeSpeechText(text) {
  return String(text || "")
    .replace(/【红字：(.+?)】/g, "$1")
    .replace(/[；;]+/g, "，")
    .replace(/[（(]/g, "，")
    .replace(/[）)]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

//--访问统计与强度摘要UI--//
function renderUsageStats() {
  if (!els.usageStats) return;
  const stats = state.usageStats || readUsageStats();
  const rows = [
    ["全站累计打开", formatUsageNumber(stats.global.totalCount)],
    ["今日打开", formatUsageNumber(stats.global.todayCount)],
    ["同步状态", stats.global.status || "未知"],
    ["统计服务", formatUsageProvider(stats.global)]
  ];
  if (state.debugMode) {
    rows.push(
      ["本地页面打开", formatUsageNumber(stats.local.pageLoads)],
      ["本地流程启动", formatUsageNumber(stats.local.flowStarts)],
      ["本地抽取/选择", formatUsageNumber(stats.local.draws)],
      ["本地流程完成", formatUsageNumber(stats.local.flowCompletions)],
      ["调试一键跑", formatUsageNumber(stats.local.debugRunAll)]
    );
  }
  const syncTime = formatUsageSyncTime(stats.global.lastSyncAt);
  if (syncTime) rows.push(["上次同步", syncTime]);
  if (stats.global.error) rows.push([state.debugMode ? "错误" : "降级说明", formatUsageErrorForDisplay(stats.global.error)]);
  els.usageStats.innerHTML = rows.map(([key, value]) => (
    `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(value))}</dd>`
  )).join("");
}

function formatUsageNumber(value) {
  if (!hasUsageNumber(value)) return "未同步";
  return Number(value).toLocaleString("zh-CN");
}

function formatUsageProvider(globalStats = {}) {
  const provider = globalStats.provider || "未配置";
  if (provider === GLOBAL_USAGE_COUNTER.fallbackProvider) return `${provider}（备用）`;
  return provider;
}

function formatUsageSyncTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return formatDateTime(date);
}

function formatUsageErrorForDisplay(message) {
  const text = String(message || "").trim();
  if (!text) return "";
  if (state.debugMode) return text;
  if (/Worker/i.test(text) && /备用统计/i.test(text)) return "主统计线路暂不可用，当前显示备用统计。";
  if (/Worker/i.test(text)) return "主统计线路暂不可用，已尝试备用统计。";
  if (/HTTP\s*\d+|统计请求超时|Failed to fetch|NetworkError/i.test(text)) {
    return "外部统计暂时连接失败，抽取流程不受影响。";
  }
  return text;
}

function formatRichText(text) {
  return callSiteModuleImplementation("JJKUIRenderHelpers", "formatRichText", [text]);
}

function renderState() {
  const rows = getStateSummaryRows();
  els.stateList.innerHTML = rows.map(([key, value]) => (
    `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(value))}</dd>`
  )).join("");
}

function renderStrength() {
  const strength = buildStrengthSnapshot();
  if (!strength) {
    els.strengthSummary.innerHTML = `<p class="muted">基础能力抽完后显示。</p>`;
    return;
  }
  const scores = strength;
  const buildBonus = strength.abilityBuildBonus;
  const gradeEffectiveScore = strength.gradeEffectiveScore;
  const techniqueSynergy = strength.techniqueSynergy;
  const domainQuality = strength.domainQuality;
  const flavorTotal = Object.values(scores.flavor || {}).reduce((sum, value) => sum + Math.abs(Number(value) || 0), 0);
  const items = [
    ["资源", scores.resource, "咒力总量 + 咒力效率：代表可用咒力量、续航和高消耗术式承载能力。"],
    ["操作", scores.control, "咒力操纵 + 咒力效率：代表反转、领域、黑闪与技巧稳定性。"],
    ["肉体", scores.body, "体术 + 体质：代表近战、耐久、存活和无术式情况下的下限。"],
    ["悟性", scores.growth, "原天赋字段：现在解释为学习、理解、钻研和兑现复杂构筑的能力。"],
    ["风味", flavorTotal, "性格、咒力性质、咒力颜色和束缚倾向带来的轻量隐藏修正。努力程度会额外修正面板。"],
    ["术式", techniqueSynergy.gradeBonus, techniqueSynergy.profile ? `${techniqueSynergy.displayName}：基础 ${techniqueSynergy.baseBonus} / 属性配合 ${techniqueSynergy.attributeBonus} / 经典组合 ${techniqueSynergy.classicBonus} / 领域 ${techniqueSynergy.domainBonus}。${techniqueSynergy.sourceNote}` : "未获得或尚未抽取生得术式。"],
    ["领域", domainQuality, "领域质量参考资源、操作、悟性、肉体和术式领域适配；只在已有领域展开后影响领域效果权重。"],
    ["构筑", buildBonus, "高级技巧、特殊天赋、领域/束缚、咒具、财富术式联动、努力程度和术式配合带来的等级修正。"],
    ["综合", gradeEffectiveScore, "等级有效分：基础属性包 + 高属性数量 + 构筑修正 + 身体系保底；用于直接区间判定等级。"]
  ];
  const scoreMarkup = items.map(([label, score, description]) => {
    const width = Math.max(0, Math.min(100, (score / 12) * 100));
    return `
      <div class="score-line">
        <span>${label}</span>
        <span class="bar"><span style="width:${width}%"></span></span>
        <strong>${score.toFixed(1)}</strong>
      </div>
      <p class="score-note">${escapeHtml(description)}</p>
    `;
  }).join("");
  els.strengthSummary.innerHTML = `${scoreMarkup}${renderInstantCombatProfile(strength.instantCombatProfile)}`;
}

//--结果记录、流程图谱与创作者预览UI--//
function renderResults() {
  const visibleRecords = state.debugMode ? state.records : state.records.filter((record) => !record.skipped);
  const customNotice = buildCustomRunNoticeMarkup(visibleRecords);
  if (visibleRecords.length === 0) {
    els.resultLog.innerHTML = `${customNotice}<div class="empty-state">还没有记录。</div>`;
    return;
  }
  els.resultLog.innerHTML = `${customNotice}${visibleRecords.map((record) => `
    <div class="log-row ${record.skipped ? "skipped" : ""} ${record.runType === "activationCustom" ? "custom-run-log-row" : ""}">
      <div>
        <div class="log-title">${escapeHtml(record.title)}</div>
        ${record.runType === "activationCustom" ? `<div class="custom-run-chip">激活码自定义局</div>` : ""}
        <div class="muted debug-only">${escapeHtml(record.stage || "流程")}</div>
      </div>
      <div>
        <strong>${formatRichText(record.result)}</strong>
        ${record.selectionMode === "aiFree" ? `<p class="muted">合法主线结果：${escapeHtml(record.aiFreeInteraction?.anchorText || record.result || "")}</p>` : ""}
        ${record.aiFreeInteraction?.text ? `<p class="muted">行动策略：${escapeHtml(record.aiFreeInteraction.text)}</p>` : ""}
        ${record.aiFreeInteraction?.summary ? `<p class="muted">后续倾向：${escapeHtml(record.aiFreeInteraction.summary)}</p>` : ""}
        ${record.selectionMode === "halfCustom" ? `<p class="muted">半自定义自选</p>` : ""}
        ${state.debugMode && record.optionEffects?.resultTags?.length ? `<p class="muted debug-only">结果标签：${escapeHtml(record.optionEffects.resultTags.join("、"))}</p>` : ""}
        <p class="muted debug-only">${escapeHtml(record.why || "")}</p>
        ${state.debugMode && record.optionsSnapshot ? `
          <p class="muted debug-only">候选选项 ${record.optionsSnapshot.options?.length || 0} 个；可抽 ${countSelectableOptions(record.optionsSnapshot)} 个</p>
        ` : ""}
        ${state.debugMode && !record.skipped && record.id ? `
          <button class="backtrack-btn debug-only" type="button" data-backtrack-id="${record.id}">回溯到此步</button>
        ` : ""}
      </div>
    </div>
  `).join("")}`;
}

function buildCustomRunNoticeMarkup(records = []) {
  const hasCustomRecord = records.some((record) => record.runType === "activationCustom");
  if (!isActivationCustomRun() && !hasCustomRecord) return "";
  const runProfile = getRunProfile({ runType: "activationCustom" });
  return `
    <div class="custom-run-banner">
      <strong>${escapeHtml(runProfile.publicLabel)}</strong>
      <span>${escapeHtml(runProfile.disclosure)}</span>
    </div>
  `;
}

function countSelectableOptions(snapshot) {
  return callSiteModuleImplementation("JJKLifeWheelResult", "countSelectableOptions", [snapshot]);
}

function renderFlowTree() {
  if (!els.flowTree || !state.flow) return;
  const mainNodes = buildMainFlowReviewRefs();
  const timelinePeriods = Object.entries(state.flow.timeline?.periods || {});
  const configuredWheelIds = getConfiguredWheelIds();
  const totalWheels = state.wheels?.wheels?.length || 0;
  const configuredWheelCount = [...configuredWheelIds].filter((id) => getWheel(id)).length;
  els.flowTree.innerHTML = `
    <div class="flow-review-summary">
      <span>流程 ${escapeHtml(state.flow.version || "unknown")}</span>
      <span>主流程 ${mainNodes.length} 节点</span>
      <span>剧情时期 ${timelinePeriods.length} 段</span>
      <span>接入转盘 ${configuredWheelCount}/${totalWheels}</span>
    </div>
    <section class="flow-review-section flow-review-critical">
      <div class="flow-review-heading">
        <h3>已锁关键分歧</h3>
        <span class="tag">P0 FINAL</span>
      </div>
      ${buildNightParadeReviewTree()}
    </section>
    <section class="flow-review-section">
      <div class="flow-review-heading">
        <h3>主流程骨架</h3>
        <span class="muted">按实际 mainFlow 顺序展示；每个转盘下列出全部选项。</span>
      </div>
      <ol class="flow-branch-list">
        ${mainNodes.map((ref, index) => buildFlowReviewNodeMarkup(ref, index + 1)).join("")}
      </ol>
    </section>
    <section class="flow-review-section">
      <div class="flow-review-heading">
        <h3>时间线分歧</h3>
        <span class="muted">从 W002 抽中的时期开始，按后续人生继续模拟。</span>
      </div>
      ${buildTimelineReviewMarkup()}
    </section>
    <section class="flow-review-section">
      <div class="flow-review-heading">
        <h3>特殊展开与待定池</h3>
        <span class="muted">自定义术式、彩蛋线、最终序列和当前只保留审阅的池。</span>
      </div>
      ${buildSpecialFlowReviewMarkup()}
    </section>
  `;
}

function renderFlowGraph() {
  if (!els.flowGraph || !state.flow) return;
  const mainNodes = buildMainFlowReviewRefs();
  const timelinePeriods = Object.entries(state.flow.timeline?.periods || {});
  const configuredWheelIds = getConfiguredWheelIds();
  const totalWheels = state.wheels?.wheels?.length || 0;
  const configuredWheelCount = [...configuredWheelIds].filter((id) => getWheel(id)).length;
  els.flowGraph.innerHTML = `
    <div class="flow-review-summary">
      <span>流程 ${escapeHtml(state.flow.version || "unknown")}</span>
      <span>主流程 ${mainNodes.length} 节点</span>
      <span>剧情时期 ${timelinePeriods.length} 段</span>
      <span>接入转盘 ${configuredWheelCount}/${totalWheels}</span>
    </div>
    <section class="flow-review-section flow-graph-section">
      <div class="flow-review-heading">
        <h3>路线图谱总览</h3>
        <div class="flow-graph-toolbar" aria-label="路线图谱控制">
          <div class="flow-graph-controls" aria-label="缩放">
            ${[0.08, 0.12, 0.2, 0.45, 0.72, 0.9, 1.1].map((zoom) => `
              <button class="secondary ${Math.abs(state.flowReviewZoom - zoom) < 0.01 ? "active" : ""}" type="button" data-flow-zoom="${zoom}">${Math.round(zoom * 100)}%</button>
            `).join("")}
          </div>
          <div class="flow-graph-controls" aria-label="视角移动">
            <button class="secondary" type="button" data-flow-pan="left" aria-label="向左移动">&larr;</button>
            <button class="secondary" type="button" data-flow-pan="up" aria-label="向上移动">&uarr;</button>
            <button class="secondary" type="button" data-flow-pan="down" aria-label="向下移动">&darr;</button>
            <button class="secondary" type="button" data-flow-pan="right" aria-label="向右移动">&rarr;</button>
            <button class="secondary" type="button" data-flow-view="origin">左上</button>
            <button class="secondary" type="button" data-flow-view="center">居中</button>
          </div>
        </div>
      </div>
      ${buildFlowGraphMarkup(mainNodes)}
    </section>
  `;
  bindFlowGraphControls();
}

function buildMainFlowReviewRefs() {
  return (state.flow.mainFlow || [])
    .map((nodeId) => normalizeReviewRefFromNode(nodeId, state.flow.nodes?.[nodeId]))
    .filter(Boolean);
}

function normalizeReviewRefFromNode(nodeId, node = {}) {
  if (!node) return null;
  return {
    source: "main",
    nodeId,
    type: node.type || "wheel",
    title: node.title || nodeId,
    stage: node.stage || "流程",
    condition: node.condition || "",
    why: node.why || "",
    wheelId: node.wheelId || node.contentWheelId || "",
    contentWheelId: node.contentWheelId || "",
    countFrom: node.countFrom || "",
    noRepeatScope: node.noRepeatScope || "",
    customNodeId: node.customNodeId || "",
    options: node.options || null,
    wheelSelection: node.wheelSelection || null,
    expand: node.type === "timelineSubflow" ? "timeline" : node.type === "subflow" ? nodeId : ""
  };
}

function normalizeReviewRefFromTimelineItem(period, item, index) {
  return {
    source: "timeline",
    nodeId: item.nodeId || `timeline-${period}-${item.wheelId || item.title || index}`,
    type: item.type || (item.options ? "wheel" : "wheel"),
    title: item.title || `剧情节点 ${index + 1}`,
    stage: `剧情：${periodLabel(period)}`,
    condition: item.condition || "",
    why: item.why || "",
    wheelId: item.wheelId || item.contentWheelId || "",
    contentWheelId: item.contentWheelId || "",
    countFrom: item.countFrom || "",
    noRepeatScope: item.noRepeatScope || "",
    options: item.options || null,
    period
  };
}

function buildNightParadeReviewTree() {
  const branches = [
    {
      title: "高专方",
      conditions: ["W002 到达 0卷", "W145-O1 是", "getoSide != true", "W169-O1 是"],
      target: "W078 百鬼夜行结果（高专方）",
      result: "只开高专方，不开夏油杰方。"
    },
    {
      title: "夏油杰方",
      conditions: ["W173-O2 夏油，或 W076-O4 和夏油杰一块黑化", "getoSide == true", "W169-O1 是"],
      target: "W079 百鬼夜行结果（夏油杰方）",
      result: "只开夏油杰方；W076-O4 会覆盖原高专方分流。"
    },
    {
      title: "旧盘星教侧",
      conditions: ["W173-O1 旧盘星教残党", "oldStarReligiousGroupSide == true", "getoSide == false"],
      target: "不进入 W079",
      result: "旧盘星教与夏油杰方二元对立。"
    },
    {
      title: "未加入高专/普通诅咒师",
      conditions: ["W145-O2 否，或 W001-O2 诅咒师但没有夏油杰方来源"],
      target: "不默认进入 W079",
      result: "仅记录身份或组织；等待后续独立阵营门。"
    }
  ];
  return `
    <ol class="flow-branch-list compact">
      ${branches.map((branch) => `
        <li class="flow-review-node">
          <details open>
            <summary>
              <span class="flow-node-title">${escapeHtml(branch.title)}</span>
              <span class="tag">${escapeHtml(branch.target)}</span>
            </summary>
            <div class="flow-node-body">
              <ul class="flow-route-notes">
                ${branch.conditions.map((item) => `<li><span class="route-kind">条件</span>${escapeHtml(item)}</li>`).join("")}
                <li><span class="route-kind route-next">结果</span>${escapeHtml(branch.result)}</li>
              </ul>
            </div>
          </details>
        </li>
      `).join("")}
    </ol>
  `;
}

function bindFlowGraphControls() {
  if (!els.flowGraph) return;
  const viewport = els.flowGraph.querySelector(".flow-graph-viewport");
  bindFlowGraphDragPan(viewport);
  bindFlowGraphKeyboardPan(viewport);
  els.flowGraph.querySelectorAll("[data-flow-zoom]").forEach((button) => {
    button.addEventListener("click", () => {
      const zoom = Number(button.dataset.flowZoom);
      if (!Number.isFinite(zoom)) return;
      state.flowGraphViewportAnchor = captureFlowGraphViewportAnchor(viewport);
      state.flowReviewZoom = zoom;
      renderFlowGraph();
    });
  });
  els.flowGraph.querySelectorAll("[data-flow-pan]").forEach((button) => {
    button.addEventListener("click", () => moveFlowGraphViewport(button.dataset.flowPan));
  });
  els.flowGraph.querySelectorAll("[data-flow-view]").forEach((button) => {
    button.addEventListener("click", () => setFlowGraphViewport(button.dataset.flowView));
  });
  restoreFlowGraphViewport(viewport);
}

function buildFlowGraphMarkup(mainNodes) {
  const graph = buildFlowGraphData(mainNodes);
  const zoom = Number(state.flowReviewZoom || 0.08);
  const displayWidth = Math.round(graph.width * zoom);
  const displayHeight = Math.round(graph.height * zoom);
  return `
    <div class="flow-graph-viewport" aria-label="流程路线图谱" tabindex="0">
      <svg
        class="flow-graph-svg"
        width="${displayWidth}"
        height="${displayHeight}"
        viewBox="0 0 ${graph.width} ${graph.height}"
        role="img"
        aria-label="流程路线图谱总览"
      >
        <defs>
          <marker id="flowArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z"></path>
          </marker>
          <marker id="flowArrowMuted" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z"></path>
          </marker>
        </defs>
        ${graph.bands.map((band) => renderFlowGraphBand(band, graph.width)).join("")}
        <g class="flow-graph-edges">
          ${graph.edges.map((edge) => renderFlowGraphEdge(edge, graph)).join("")}
        </g>
        <g class="flow-graph-nodes">
          ${graph.nodes.map(renderFlowGraphNode).join("")}
          ${graph.options.map(renderFlowGraphOption).join("")}
        </g>
      </svg>
    </div>
  `;
}

function captureFlowGraphViewportAnchor(viewport) {
  if (!viewport) return null;
  const scrollWidth = Math.max(1, viewport.scrollWidth);
  const scrollHeight = Math.max(1, viewport.scrollHeight);
  const canScrollX = scrollWidth > viewport.clientWidth + 4;
  const canScrollY = scrollHeight > viewport.clientHeight + 4;
  return {
    centerXRatio: canScrollX ? (viewport.scrollLeft + viewport.clientWidth / 2) / scrollWidth : 0,
    centerYRatio: canScrollY ? (viewport.scrollTop + viewport.clientHeight / 2) / scrollHeight : 0
  };
}

function restoreFlowGraphViewport(viewport) {
  if (!viewport || !state.flowGraphViewportAnchor) return;
  const anchor = state.flowGraphViewportAnchor;
  window.requestAnimationFrame(() => {
    viewport.scrollLeft = Math.max(0, anchor.centerXRatio * viewport.scrollWidth - viewport.clientWidth / 2);
    viewport.scrollTop = Math.max(0, anchor.centerYRatio * viewport.scrollHeight - viewport.clientHeight / 2);
  });
}

function bindFlowGraphDragPan(viewport) {
  if (!viewport) return;
  let activePointerId = null;
  let startX = 0;
  let startY = 0;
  let startScrollLeft = 0;
  let startScrollTop = 0;
  viewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    activePointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    startScrollLeft = viewport.scrollLeft;
    startScrollTop = viewport.scrollTop;
    viewport.classList.add("is-panning");
    viewport.setPointerCapture?.(event.pointerId);
  });
  viewport.addEventListener("pointermove", (event) => {
    if (activePointerId !== event.pointerId) return;
    viewport.scrollLeft = startScrollLeft - (event.clientX - startX);
    viewport.scrollTop = startScrollTop - (event.clientY - startY);
  });
  const stopPan = (event) => {
    if (activePointerId !== event.pointerId) return;
    activePointerId = null;
    viewport.classList.remove("is-panning");
    viewport.releasePointerCapture?.(event.pointerId);
    state.flowGraphViewportAnchor = captureFlowGraphViewportAnchor(viewport);
  };
  viewport.addEventListener("pointerup", stopPan);
  viewport.addEventListener("pointercancel", stopPan);
  viewport.addEventListener("scroll", () => {
    if (activePointerId == null) state.flowGraphViewportAnchor = captureFlowGraphViewportAnchor(viewport);
  }, { passive: true });
}

function bindFlowGraphKeyboardPan(viewport) {
  if (!viewport) return;
  viewport.addEventListener("keydown", (event) => {
    const keyToDirection = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down"
    };
    const direction = keyToDirection[event.key];
    if (!direction) return;
    event.preventDefault();
    moveFlowGraphViewport(direction);
  });
}

function moveFlowGraphViewport(direction) {
  const viewport = els.flowGraph?.querySelector(".flow-graph-viewport");
  if (!viewport) return;
  const stepX = Math.max(240, Math.round(viewport.clientWidth * 0.6));
  const stepY = Math.max(180, Math.round(viewport.clientHeight * 0.6));
  const deltas = {
    left: [-stepX, 0],
    right: [stepX, 0],
    up: [0, -stepY],
    down: [0, stepY]
  };
  const [left, top] = deltas[direction] || [0, 0];
  viewport.scrollLeft += left;
  viewport.scrollTop += top;
  state.flowGraphViewportAnchor = captureFlowGraphViewportAnchor(viewport);
  viewport.focus({ preventScroll: true });
}

function setFlowGraphViewport(view) {
  const viewport = els.flowGraph?.querySelector(".flow-graph-viewport");
  if (!viewport) return;
  if (view === "center") {
    viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
    viewport.scrollTop = Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2);
  } else {
    viewport.scrollLeft = 0;
    viewport.scrollTop = 0;
  }
  state.flowGraphViewportAnchor = captureFlowGraphViewportAnchor(viewport);
  viewport.focus({ preventScroll: true });
}

function buildFlowGraphData(mainNodes) {
  const graph = {
    nodes: [],
    options: [],
    edges: [],
    bands: [],
    nodeById: new Map(),
    optionById: new Map(),
    firstNodeByWheel: new Map(),
    nodesByTitle: new Map(),
    periodAnchors: new Map(),
    width: 1600,
    height: 900
  };
  const mainGap = 230;
  const rowGap = 430;
  const startX = 78;
  const mainY = 120;

  mainNodes.forEach((ref, index) => {
    addFlowGraphNode(graph, {
      id: `main:${ref.nodeId || index}`,
      ref,
      x: startX + index * mainGap,
      y: mainY,
      kind: "main"
    });
  });
  for (let index = 0; index < mainNodes.length - 1; index += 1) {
    graph.edges.push({ from: `main:${mainNodes[index].nodeId || index}`, to: `main:${mainNodes[index + 1].nodeId || index + 1}`, kind: "sequence" });
  }

  const periods = Object.entries(state.flow.timeline?.periods || {});
  const timelineStartY = mainY + 520;
  periods.forEach(([period, items], periodIndex) => {
    const y = timelineStartY + periodIndex * rowGap;
    const anchorId = `period:${period}`;
    addFlowGraphNode(graph, {
      id: anchorId,
      ref: {
        nodeId: anchorId,
        type: "period",
        title: periodLabel(period),
        stage: "剧情时期",
        why: "W002 时间点映射后的剧情时期。"
      },
      x: startX,
      y,
      kind: "period"
    });
    graph.periodAnchors.set(period, anchorId);
    graph.bands.push({ y: y - 70, height: rowGap - 18, title: periodLabel(period) });

    items.forEach((item, index) => {
      const ref = normalizeReviewRefFromTimelineItem(period, item, index);
      const nodeId = `timeline:${period}:${index}`;
      addFlowGraphNode(graph, {
        id: nodeId,
        ref,
        x: startX + 220 + index * mainGap,
        y,
        kind: "timeline"
      });
    });
    if (items.length) {
      graph.edges.push({ from: anchorId, to: `timeline:${period}:0`, kind: "sequence" });
      for (let index = 0; index < items.length - 1; index += 1) {
        graph.edges.push({ from: `timeline:${period}:${index}`, to: `timeline:${period}:${index + 1}`, kind: "sequence" });
      }
    }
  });

  const specialBaseY = timelineStartY + periods.length * rowGap + 50;
  const specialRows = buildFlowGraphSpecialRows();
  specialRows.forEach((row, rowIndex) => {
    const y = specialBaseY + rowIndex * rowGap;
    const anchorId = `special:${row.id}`;
    addFlowGraphNode(graph, {
      id: anchorId,
      ref: {
        nodeId: anchorId,
        type: "special",
        title: row.title,
        stage: "特殊展开",
        why: row.why || ""
      },
      x: startX,
      y,
      kind: "period"
    });
    graph.bands.push({ y: y - 70, height: rowGap - 18, title: row.title });
    row.refs.forEach((ref, index) => {
      const nodeId = `special:${row.id}:${index}`;
      addFlowGraphNode(graph, {
        id: nodeId,
        ref,
        x: startX + 220 + index * mainGap,
        y,
        kind: "special"
      });
    });
    if (row.refs.length) {
      graph.edges.push({ from: anchorId, to: `special:${row.id}:0`, kind: "sequence" });
      for (let index = 0; index < row.refs.length - 1; index += 1) {
        graph.edges.push({ from: `special:${row.id}:${index}`, to: `special:${row.id}:${index + 1}`, kind: "sequence" });
      }
    }
  });

  addFlowGraphOptionsAndRouteEdges(graph);
  addFlowGraphStartTimeEdges(graph);
  graph.width = Math.max(1600, ...graph.nodes.map((node) => node.x + node.w + 120), ...graph.options.map((node) => node.x + node.w + 120));
  graph.height = Math.max(900, ...graph.nodes.map((node) => node.y + node.h + 220), ...graph.options.map((node) => node.y + node.h + 120), ...graph.bands.map((band) => band.y + band.height + 80));
  return graph;
}

function buildFlowGraphSpecialRows() {
  const customRefs = [
    { wheelId: 85, title: "（自定义）术式类型数量", type: "wheel", stage: "自定义术式", why: "W011 抽到自定义后展开。" },
    { wheelId: 86, title: "（自定义）术式类型", type: "multiDraw", stage: "自定义术式", why: "按 W085 数量多抽。" },
    { wheelId: 87, title: "（自定义）术式风格", type: "wheel", stage: "自定义术式" },
    { wheelId: 88, title: "（自定义）术式属性", type: "wheel", stage: "自定义术式" },
    { wheelId: 89, title: "（自定义）术式来源", type: "wheel", stage: "自定义术式" },
    { wheelId: 90, title: "（自定义）术式咒力要求", type: "wheel", stage: "自定义术式" },
    { wheelId: 92, title: "（自定义）术式全方位威力", type: "wheel", stage: "自定义术式" }
  ].map((item) => ({ ...item, nodeId: `graph-custom-${item.wheelId}`, source: "special" }));
  const easterRefs = [105, 117, 118, 119, 120, 121, 122, 123, 124]
    .map((wheelId) => {
      const wheel = getWheel(wheelId);
      return {
        nodeId: `graph-easter-${wheelId}`,
        source: "special",
        type: "wheel",
        wheelId,
        title: wheel?.title || `彩蛋节点 ${wheelId}`,
        stage: "彩蛋",
        why: "彩蛋二元门接受后进入；彩蛋线独立。"
      };
    });
  const deferredRefs = (state.flow.deferredTriggerWheels || [])
    .map((item, index) => ({
      nodeId: `graph-deferred-${item.wheelId || index}`,
      source: "deferred",
      type: "deferred",
      wheelId: item.wheelId,
      title: item.title || getWheel(item.wheelId)?.title || `待定池 ${index + 1}`,
      stage: "待定触发",
      why: item.reason || "当前仅保留审阅，不主动接入。"
    }));
  return [
    { id: "custom", title: "自定义术式展开", refs: customRefs },
    { id: "easter", title: "彩蛋线展开", refs: easterRefs },
    { id: "deferred", title: "待定触发池", refs: deferredRefs }
  ];
}

function addFlowGraphNode(graph, node) {
  const normalized = {
    w: node.kind === "period" ? 126 : 166,
    h: node.kind === "period" ? 44 : 52,
    ...node
  };
  graph.nodes.push(normalized);
  graph.nodeById.set(normalized.id, normalized);
  const wheelId = normalized.ref?.wheelId || normalized.ref?.contentWheelId;
  if (wheelId && !graph.firstNodeByWheel.has(String(wheelId))) {
    graph.firstNodeByWheel.set(String(wheelId), normalized.id);
  }
  const title = normalized.ref?.title || "";
  if (title) {
    if (!graph.nodesByTitle.has(title)) graph.nodesByTitle.set(title, []);
    graph.nodesByTitle.get(title).push(normalized.id);
  }
}

function addFlowGraphOptionsAndRouteEdges(graph) {
  const nodes = [...graph.nodes];
  for (const node of nodes) {
    const groups = getFlowReviewOptionGroups(node.ref || {});
    const options = groups.flatMap((group) => group.options.map((option, index) => ({ group, option, index })));
    const visibleOptions = options.slice(0, 42);
    const columns = options.length > 18 ? 2 : 1;
    const optionW = columns === 2 ? 116 : 150;
    const optionH = 18;
    const rowGap = 23;
    visibleOptions.forEach(({ group, option, index }, optionIndex) => {
      const col = columns === 2 ? optionIndex % 2 : 0;
      const row = columns === 2 ? Math.floor(optionIndex / 2) : optionIndex;
      const optionId = `${node.id}:option:${optionIndex}`;
      const optionNode = {
        id: optionId,
        parentId: node.id,
        ref: node.ref,
        group,
        index,
        text: normalizeOptionText({ nodeId: node.ref?.nodeId || "" }, option.text || ""),
        code: formatReviewOptionCode(group.wheelId || node.ref?.wheelId, index),
        x: node.x + col * (optionW + 8),
        y: node.y + node.h + 24 + row * rowGap,
        w: optionW,
        h: optionH
      };
      graph.options.push(optionNode);
      graph.optionById.set(optionId, optionNode);
      graph.edges.push({ from: node.id, to: optionId, kind: "option" });
      for (const targetId of inferFlowGraphOptionTargets(graph, node, optionNode, option)) {
        graph.edges.push({ from: optionId, to: targetId, kind: "route" });
      }
    });
    if (options.length > visibleOptions.length) {
      const moreId = `${node.id}:option:more`;
      const moreNode = {
        id: moreId,
        parentId: node.id,
        ref: node.ref,
        group: {},
        index: visibleOptions.length,
        text: `还有 ${options.length - visibleOptions.length} 个选项`,
        code: "...",
        x: node.x,
        y: node.y + node.h + 24 + Math.ceil(visibleOptions.length / columns) * rowGap,
        w: 150,
        h: optionH,
        muted: true
      };
      graph.options.push(moreNode);
      graph.optionById.set(moreId, moreNode);
      graph.edges.push({ from: node.id, to: moreId, kind: "option" });
    }
  }
}

function addFlowGraphStartTimeEdges(graph) {
  const startTimeNode = findFlowGraphNodeByTitle(graph, "穿越后的时间点");
  if (!startTimeNode) return;
  const mapping = state.flow.timeline?.startMapping || {};
  for (const optionNode of graph.options.filter((item) => item.parentId === startTimeNode.id)) {
    const period = Object.entries(mapping).find(([key]) => optionNode.text.includes(key))?.[1];
    const targetId = period ? graph.periodAnchors.get(period) : "";
    if (targetId) graph.edges.push({ from: optionNode.id, to: targetId, kind: "route" });
  }
}

function inferFlowGraphOptionTargets(graph, parentNode, optionNode, rawOption) {
  const ref = parentNode.ref || {};
  const title = ref.title || "";
  const text = String(optionNode.text || rawOption?.text || "");
  const targets = new Set();
  const addWheel = (wheelId) => {
    const id = graph.firstNodeByWheel.get(String(wheelId));
    if (id && id !== parentNode.id) targets.add(id);
  };
  const addTitle = (targetTitle) => {
    const id = findFlowGraphNodeByTitle(graph, targetTitle)?.id;
    if (id && id !== parentNode.id) targets.add(id);
  };
  const addSpecial = (id) => {
    const node = graph.nodeById.get(id);
    if (node) targets.add(node.id);
  };

  if (title === "是否拥有生得术式" && text === "是") addTitle("生得术式");
  if (title === "生得术式") {
    if (text.includes("自定义")) addSpecial("special:custom");
    if (text.includes("进入彩蛋池")) addSpecial("special:easter");
    if (text.includes("十种影法术")) addTitle("调幅魔虚罗（十影）");
  }
  if (title === "是否为御三家" && text === "是") addTitle("三大家族");
  if (title === "是否遗传祖传术式" && text === "是") addTitle("祖传术式");
  if (title === "是否进入咒术高层" && text === "是") {
    addTitle("高专在哪个校");
    addTitle("决战宿傩入场顺序");
  }
  if (title === "是否加入高专" && text === "是") {
    addTitle("高专在哪个校");
    addWheel(169);
  }
  if (title === "属于组织（诅咒师）" && text.includes("夏油")) addWheel(169);
  if (title === "是否保卫理子（时间早加高专专属）" && text === "是") addTitle("保卫理子后");
  if (title === "保卫理子后" && text.includes("夏油杰一块黑化")) addWheel(169);
  if (title === "是否参加百鬼夜行" && text === "是") {
    addWheel(78);
    addWheel(79);
  }
  if (title === "是否参加交流会" && text === "是") addWheel(93);
  if (title.startsWith("参与幼鱼与逆罚")) {
    if (text.includes("虎杖") || text.includes("高专")) addWheel(96);
    if (text.includes("真人") || text.includes("顺平")) addWheel(97);
  }
  if (title === "是否参加涩谷事变" && text === "是") addWheel(132);
  if (title === "涩谷事变阵营") {
    if (text.includes("高专")) addTitle("涩谷事变经过·开场（高专）");
    else addWheel(98);
  }
  if (title === "是否参加死灭回游" && text === "是") {
    addWheel(55);
    addWheel(72);
    addWheel(127);
  }
  if (title.includes("决战阵营")) {
    const joinsSukunaSide = text === "宿傩" || text === "宿傩方" || text.includes("加入宿傩");
    const joinsHighSchoolSide = text === "高专" || text === "高专方" || text.includes("洗心革面") || text.includes("对抗宿傩");
    const joinsSelfTeam = text.includes("两不相帮") || text.includes("自己") || text.includes("第三方") || text.includes("全都打一遍");
    if (joinsSukunaSide) addWheel(56);
    if (joinsHighSchoolSide) addWheel(128);
    if (joinsSelfTeam) addWheel(65);
  }
  if (title === "宿傩方在哪里") {
    if (text.includes("宿傩") || text.includes("里梅")) addWheel(140);
    if (text.includes("羂索")) addWheel(57);
    if (text.includes("自己") || text.includes("单独")) addWheel(65);
  }
  if (title === "和宿傩一起战术（宿傩方）") {
    if (text.includes("五条")) addWheel(146);
    if (text.includes("等宿傩战败")) addWheel(141);
    else addWheel(57);
  }

  return [...targets];
}

function findFlowGraphNodeByTitle(graph, title) {
  const ids = graph.nodesByTitle.get(title) || [];
  return ids.map((id) => graph.nodeById.get(id)).find(Boolean) || null;
}

function renderFlowGraphBand(band, width) {
  return `
    <g class="flow-graph-band">
      <rect x="32" y="${band.y}" width="${Math.max(0, width - 64)}" height="${band.height}"></rect>
      <text x="48" y="${band.y + 24}">${escapeHtml(band.title)}</text>
    </g>
  `;
}

function renderFlowGraphNode(node) {
  const title = clipReviewGraphText(node.ref?.title || "", node.kind === "period" ? 8 : 13);
  const meta = node.ref?.wheelId ? formatReviewWheelId(node.ref.wheelId) : node.ref?.type || "";
  return `
    <g class="flow-graph-node ${node.kind || ""}" transform="translate(${node.x} ${node.y})">
      <title>${escapeHtml(node.ref?.title || "")}${node.ref?.condition ? `\n条件：${escapeHtml(node.ref.condition)}` : ""}</title>
      <rect width="${node.w}" height="${node.h}" rx="6"></rect>
      <text class="graph-node-title" x="10" y="21">${escapeHtml(title)}</text>
      <text class="graph-node-meta" x="10" y="39">${escapeHtml(meta)}</text>
    </g>
  `;
}

function renderFlowGraphOption(option) {
  return `
    <g class="flow-graph-option ${option.muted ? "muted" : ""}" transform="translate(${option.x} ${option.y})">
      <title>${escapeHtml(option.code)} ${escapeHtml(option.text)}</title>
      <rect width="${option.w}" height="${option.h}" rx="4"></rect>
      <text x="6" y="13">${escapeHtml(clipReviewGraphText(option.text, option.w < 130 ? 8 : 12))}</text>
    </g>
  `;
}

function renderFlowGraphEdge(edge, graph) {
  const from = graph.nodeById.get(edge.from) || graph.optionById.get(edge.from);
  const to = graph.nodeById.get(edge.to) || graph.optionById.get(edge.to);
  if (!from || !to) return "";
  const fromX = from.x + from.w;
  const fromY = from.y + from.h / 2;
  const toX = to.x;
  const toY = to.y + to.h / 2;
  const dx = Math.max(38, Math.abs(toX - fromX) * 0.42);
  const path = `M ${fromX} ${fromY} C ${fromX + dx} ${fromY}, ${toX - dx} ${toY}, ${toX} ${toY}`;
  return `<path class="flow-graph-edge ${edge.kind || ""}" d="${path}"></path>`;
}

function clipReviewGraphText(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, "");
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function buildTimelineReviewMarkup() {
  const periods = Object.entries(state.flow.timeline?.periods || {});
  if (!periods.length) return `<div class="empty-state">没有配置时间线。</div>`;
  return periods.map(([period, items]) => `
    <details class="flow-period" ${period === "volume0" ? "open" : ""}>
      <summary>
        <span class="flow-node-title">${escapeHtml(periodLabel(period))}</span>
        <span class="tag">${items.length} 节点</span>
      </summary>
      <ol class="flow-branch-list">
        ${items.map((item, index) => buildFlowReviewNodeMarkup(normalizeReviewRefFromTimelineItem(period, item, index), index + 1)).join("")}
      </ol>
    </details>
  `).join("");
}

function buildSpecialFlowReviewMarkup() {
  const customRefs = [
    { wheelId: 85, title: "（自定义）术式类型数量", type: "wheel", stage: "自定义术式", why: "W011 抽到自定义后展开。" },
    { wheelId: 86, title: "（自定义）术式类型", type: "multiDraw", stage: "自定义术式", why: "按 W085 数量多抽。" },
    { wheelId: 87, title: "（自定义）术式风格", type: "wheel", stage: "自定义术式" },
    { wheelId: 88, title: "（自定义）术式属性", type: "wheel", stage: "自定义术式" },
    { wheelId: 89, title: "（自定义）术式来源", type: "wheel", stage: "自定义术式" },
    { wheelId: 90, title: "（自定义）术式咒力要求", type: "wheel", stage: "自定义术式" },
    { wheelId: 92, title: "（自定义）术式全方位威力", type: "wheel", stage: "自定义术式" }
  ].map((item, index) => ({ ...item, nodeId: `review-custom-${item.wheelId}`, source: "special", order: index + 1 }));
  const easterRefs = [105, 117, 118, 119, 120, 121, 122, 123, 124]
    .map((wheelId, index) => {
      const wheel = getWheel(wheelId);
      return {
        nodeId: `review-easter-${wheelId}`,
        source: "special",
        type: "wheel",
        wheelId,
        title: wheel?.title || `彩蛋节点 ${index + 1}`,
        stage: "彩蛋",
        why: "彩蛋二元门接受后进入；彩蛋线独立。"
      };
    });
  const deferredRefs = (state.flow.deferredTriggerWheels || [])
    .map((item, index) => ({
      nodeId: `review-deferred-${item.wheelId || index}`,
      source: "deferred",
      type: "deferred",
      wheelId: item.wheelId,
      title: item.title || getWheel(item.wheelId)?.title || `待定池 ${index + 1}`,
      stage: "待定触发",
      why: item.reason || "当前仅保留审阅，不主动接入。"
    }));
  return `
    <details class="flow-period">
      <summary><span class="flow-node-title">自定义术式展开</span><span class="tag">${customRefs.length} 节点</span></summary>
      <ol class="flow-branch-list">${customRefs.map((ref, index) => buildFlowReviewNodeMarkup(ref, index + 1)).join("")}</ol>
    </details>
    <details class="flow-period">
      <summary><span class="flow-node-title">彩蛋线展开</span><span class="tag">${easterRefs.length} 节点</span></summary>
      <ol class="flow-branch-list">${easterRefs.map((ref, index) => buildFlowReviewNodeMarkup(ref, index + 1)).join("")}</ol>
    </details>
    <details class="flow-period">
      <summary><span class="flow-node-title">待定触发池</span><span class="tag">${deferredRefs.length} 节点</span></summary>
      <ol class="flow-branch-list">${deferredRefs.map((ref, index) => buildFlowReviewNodeMarkup(ref, index + 1)).join("")}</ol>
    </details>
  `;
}

function buildFlowReviewNodeMarkup(ref, order) {
  const optionGroups = getFlowReviewOptionGroups(ref);
  const condition = ref.condition ? `<span class="flow-condition">条件：${escapeHtml(ref.condition)}</span>` : "";
  const meta = [
    ref.type,
    ref.wheelId ? formatReviewWheelId(ref.wheelId) : "",
    ref.countFrom ? `数量源 ${ref.countFrom}` : "",
    ref.noRepeatScope ? "单池防重" : ""
  ].filter(Boolean);
  return `
    <li class="flow-review-node">
      <details ${shouldOpenReviewNode(ref) ? "open" : ""}>
        <summary>
          <span class="flow-node-order">${escapeHtml(order)}</span>
          <span class="flow-node-title">${escapeHtml(ref.title)}</span>
          ${meta.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}
        </summary>
        <div class="flow-node-body">
          <div class="flow-node-meta">
            <span>${escapeHtml(ref.stage || "流程")}</span>
            ${condition}
            ${ref.why ? `<span>${escapeHtml(ref.why)}</span>` : ""}
          </div>
          ${ref.wheelSelection ? buildDynamicWheelSelectionMarkup(ref) : ""}
          ${optionGroups.length ? optionGroups.map((group) => buildFlowOptionGroupMarkup(ref, group)).join("") : buildFlowNoOptionsMarkup(ref)}
        </div>
      </details>
    </li>
  `;
}

function shouldOpenReviewNode(ref) {
  return /百鬼夜行|是否加入高专|属于组织|保卫理子|穿越后的初始身份|穿越后的时间点|穿越后的地点/.test(ref.title || "");
}

function getFlowReviewOptionGroups(ref) {
  if (ref.wheelSelection?.length) {
    return ref.wheelSelection
      .map((candidate) => {
        const wheel = getWheel(candidate.wheelId);
        if (!wheel) return null;
        return {
          label: `${candidate.when || "candidate"} -> ${formatReviewWheelId(candidate.wheelId)} ${wheel.title}`,
          wheelId: candidate.wheelId,
          options: wheel.items || [],
          why: candidate.why || ""
        };
      })
      .filter(Boolean);
  }
  if (Array.isArray(ref.options) && ref.options.length) {
    return [{
      label: "虚拟选择项",
      wheelId: ref.wheelId || "",
      options: ref.options
    }];
  }
  if (ref.customNodeId) {
    const custom = state.flow.customNodes?.find((item) => item.id === ref.customNodeId);
    if (custom?.options?.length) {
      return [{
        label: custom.title || "自定义选择项",
        wheelId: "",
        options: custom.options
      }];
    }
  }
  const wheelId = ref.contentWheelId || ref.wheelId;
  const wheel = wheelId ? getWheel(wheelId) : null;
  if (!wheel?.items?.length) return [];
  return [{
    label: `${formatReviewWheelId(wheelId)} ${wheel.title}`,
    wheelId,
    options: wheel.items
  }];
}

function buildDynamicWheelSelectionMarkup(ref) {
  return `
    <div class="flow-dynamic-list">
      ${ref.wheelSelection.map((candidate) => `
        <span><strong>${escapeHtml(candidate.when || "候选")}</strong> ${escapeHtml(formatReviewWheelId(candidate.wheelId))} ${escapeHtml(candidate.why || "")}</span>
      `).join("")}
    </div>
  `;
}

function buildFlowOptionGroupMarkup(ref, group) {
  return `
    <div class="flow-option-group">
      <div class="flow-option-group-title">
        <strong>${escapeHtml(group.label)}</strong>
        ${group.why ? `<span class="muted">${escapeHtml(group.why)}</span>` : ""}
      </div>
      <ol class="flow-option-list">
        ${group.options.map((option, index) => buildFlowOptionMarkup(ref, group, option, index)).join("")}
      </ol>
    </div>
  `;
}

function buildFlowNoOptionsMarkup(ref) {
  if (ref.expand === "timeline") return `<p class="muted">该节点会展开“时间线分歧”区域。</p>`;
  if (ref.expand) return `<p class="muted">该节点会展开特殊子流程。</p>`;
  if (ref.type === "computedGrade") return `<p class="muted">该节点由隐藏强度算法直接判定等级，没有随机选项。</p>`;
  return `<p class="muted">该节点没有可枚举选项，或仅作为流程容器。</p>`;
}

function buildFlowOptionMarkup(ref, group, option, index) {
  const text = normalizeOptionText({ nodeId: ref.nodeId || "" }, option.text || "");
  const notes = describeFlowReviewOptionRoute(ref, group, { ...option, text }, index);
  return `
    <li class="flow-option-item">
      <div class="flow-option-head">
        <code>${escapeHtml(formatReviewOptionCode(group.wheelId || ref.wheelId, index))}</code>
        <span>${escapeHtml(text)}</span>
        <em>权重 ${escapeHtml(trimWeight(parseWeight(option.weight)))}</em>
      </div>
      <ul class="flow-route-notes">
        ${notes.map((note) => `<li><span class="route-kind ${note.kindClass || ""}">${escapeHtml(note.kind)}</span>${escapeHtml(note.text)}</li>`).join("")}
      </ul>
    </li>
  `;
}

function describeFlowReviewOptionRoute(ref, group, option, index) {
  const title = ref.title || "";
  const text = String(option.text || "");
  const notes = [];
  const add = (kind, routeText, kindClass = "") => notes.push({ kind, text: routeText, kindClass });

  if (title === "穿越后的初始身份") {
    const route = {
      咒术师: "人类术师线；日本现代后可判定是否加入高专。",
      诅咒师: "诅咒师线；日本时进入 W173 组织记录，但不默认进 W079。",
      普通人: "普通人线；可走普通人觉醒和日本人类事件。",
      咒术高层: "原始库保留项；正式流程权重为 0，改由御三家前置和“是否进入咒术高层”决定。",
      咒灵: "咒灵专属线；不进入人类高专/诅咒师组织池。"
    }[text];
    if (route) add("分流", route, "route-next");
  } else if (title === "穿越后的时间点") {
    const period = Object.entries(state.flow.timeline?.startMapping || {}).find(([key]) => text.includes(key))?.[1];
    add("时间", period ? `从 ${periodLabel(period)} 开始，并继续模拟后续时期。` : "未匹配到专属时期，默认按剧情开始处理。", "route-next");
  } else if (title === "穿越后的地点") {
    if (text.includes("日本")) add("开放", "允许御三家/高层前置、W145 是否加入高专；诅咒师可进入 W173 组织记录。", "route-next");
    else if (text.includes("西姆利亚星")) add("覆盖", "覆盖初始身份为西姆利亚星人，进入外星人相关线。", "route-block");
    else add("限制", "非日本地点不开放御三家/高层前置、W145/W173 这类日本组织前置。", "route-block");
  } else if (title === "是否为御三家") {
    if (text === "是") add("开放", "进入 W167 三大家族、W168 祖传术式、W174 御三家地位，再判定是否进入咒术高层。", "route-next");
    else add("排除", "跳过御三家与咒术高层适配门，继续普通身份线。", "route-block");
  } else if (title === "是否进入咒术高层") {
    if (text === "是") {
      add("锁定", "自动视作 W145=是，锁定高专/咒术界侧，并自动参加新宿决战；W172 不允许学生。", "route-next");
    } else {
      add("排除", "保留御三家/祖传术式/地位记录，但不进入咒术高层路线。", "route-block");
    }
  } else if (title === "是否加入高专") {
    if (text === "是") {
      add("开放", "进入高专校区/地位/主角小队等高专专属池；0卷参加百鬼后只开 W078。", "route-next");
    } else {
      add("排除", "跳过高专专属池；不能因“没加入高专”默认进入 W079。", "route-block");
    }
  } else if (title === "属于组织（诅咒师）") {
    if (text.includes("旧盘星教")) {
      add("锁定", "旧盘星教侧；与夏油杰方二元对立，getoSide == false。", "route-block");
    } else if (text.includes("夏油")) {
      add("开放", "设置 getoSide == true；0卷参加百鬼后只开 W079。", "route-next");
    } else {
      add("记录", "只记录诅咒师组织，不锁定夏油杰方。");
    }
  } else if (title === "是否保卫理子（时间早加高专专属）") {
    add(text === "是" ? "开放" : "跳过", text === "是" ? "进入 W076 保卫理子后。" : "跳过 W076。", text === "是" ? "route-next" : "route-block");
  } else if (title === "保卫理子后") {
    if (text.includes("夏油杰一块黑化")) {
      add("转向", "设置 getoSide == true，并在0卷百鬼分流中覆盖原高专方身份；只开 W079。", "route-next");
    } else {
      add("维持", "不设置 getoSide；后续仍按原阵营/高专状态判定。");
    }
  } else if (title === "是否参加百鬼夜行") {
    if (text === "是") {
      add("分流", "joinHighSchool == 是 且 getoSide != true 时进入 W078；getoSide == true 时进入 W079。", "route-next");
    } else {
      add("跳过", "不进入 W078/W079。", "route-block");
    }
  } else if (title === "百鬼夜行结果（高专方）") {
    add("结果池", "仅高专方使用；选项文本只影响结果叙事，不把角色自动改成夏油杰方。");
  } else if (title === "百鬼夜行结果（夏油杰方）") {
    add("结果池", "仅 getoSide == true 使用；后续是否诏安/牺牲/跑路按该结果记录。");
  } else if (title === "是否拥有生得术式") {
    add(text === "是" ? "开放" : "跳过", text === "是" ? "进入 W011 生得术式。" : "跳过 W011；后续特定时期可走无术式觉醒。", text === "是" ? "route-next" : "route-block");
  } else if (title === "生得术式") {
    if (text.includes("自定义")) add("展开", "进入完整自定义术式子流程 W085-W090/W092。", "route-next");
    if (text.includes("进入彩蛋池")) add("门控", "先进入彩蛋二元门；接受后进入彩蛋线。", "route-next");
    if (text.includes("十种影法术")) add("开放", "开放调幅魔虚罗（十影）相关池。", "route-next");
  } else if (title.includes("决战阵营")) {
    if (text.includes("加入宿傩")) add("阵营", "锁定宿傩方，进入宿傩方战术/结果线。", "route-next");
    else if (text.includes("洗心革面") || text.includes("对抗宿傩")) add("阵营", "转入高专方宿傩决战流程。", "route-next");
    else if (text.includes("两不相帮") || text.includes("第三方")) add("阵营", "第三方/旁观或主动介入分支。", "route-next");
    else if (text.includes("高专")) add("阵营", "进入高专方流程。", "route-next");
  } else if (title === "涩谷事变阵营") {
    add("阵营", parseFaction(text) ? `锁定 ${parseFaction(text)}。` : "记录涩谷阵营。", "route-next");
  } else if (/^是否/.test(title)) {
    add(text === "是" ? "通过" : "跳过", text === "是" ? "通过该二元门，开放后续对应池。" : "不进入对应后续池。", text === "是" ? "route-next" : "route-block");
  } else if (ref.type === "multiDraw") {
    add("多抽", `按 ${ref.countFrom || "数量门"} 抽取；${ref.noRepeatScope ? "同池防重。" : "允许按权重重复。"}`);
  }

  if (option.next) add("后继", `next: ${option.next}`, "route-next");
  if (!notes.length) add("默认", "记录该结果，继续按后续节点条件筛选。");
  return notes;
}

function formatReviewWheelId(wheelId) {
  const numeric = Number(String(wheelId || "").match(/\d+/)?.[0]);
  return Number.isFinite(numeric) && numeric > 0 ? `W${String(numeric).padStart(3, "0")}` : "";
}

function formatReviewOptionCode(wheelId, index) {
  const wheelCode = formatReviewWheelId(wheelId);
  return `${wheelCode || "选项"}-O${index + 1}`;
}

function renderWheelLibrary() {
  if (!els.wheelLibrary) return;
  const covered = getConfiguredWheelIds();
  const wheels = [...state.wheels.wheels].sort((a, b) => Number(a.dbId) - Number(b.dbId));
  const coveredCount = wheels.filter((wheel) => covered.has(String(wheel.dbId))).length;
  els.librarySummary.textContent = `${coveredCount}/${wheels.length} 个原始转盘已接入流程配置；全部转盘和选项在此完整保留。`;
  els.wheelLibrary.innerHTML = wheels.map((wheel) => {
    const isCovered = covered.has(String(wheel.dbId));
    return `
      <article class="library-wheel ${isCovered ? "" : "library-uncovered"}">
        <div class="library-heading">
          <h3>${escapeHtml(wheel.title)}</h3>
          <span class="tag">${isCovered ? "已接入" : "待定触发"}</span>
        </div>
        <ol>
          ${wheel.items.map((item) => `
            <li>
              <span>${escapeHtml(normalizeOptionText({ nodeId: wheel.dbId === 142 ? "grade" : "" }, item.text))}</span>
              <em class="debug-only">权重 ${trimWeight(parseWeight(item.weight))}</em>
            </li>
          `).join("")}
        </ol>
      </article>
    `;
  }).join("");
}

function getConfiguredWheelIds() {
  const ids = new Set();
  for (const node of Object.values(state.flow.nodes || {})) {
    if (node.wheelId) ids.add(String(node.wheelId));
    if (node.contentWheelId) ids.add(String(node.contentWheelId));
    if (node.wheelSelection) {
      node.wheelSelection.forEach((item) => ids.add(String(item.wheelId)));
    }
    if (node.wheels) node.wheels.forEach((id) => ids.add(String(id)));
  }
  for (const period of Object.values(state.flow.timeline?.periods || {})) {
    period.forEach((item) => {
      if (item.wheelId) ids.add(String(item.wheelId));
    });
  }
  for (const item of state.flow.deferredTriggerWheels || []) {
    ids.add(String(item.wheelId));
  }
  for (const id of [85, 86, 87, 88, 89, 90, 92, 105, 117, 118, 119, 120, 121, 122, 123, 124]) {
    ids.add(String(id));
  }
  return ids;
}

function renderCreatorTemplatePreview() {
  if (!els.templatePreview) return;
  els.templatePreview.textContent = JSON.stringify(buildCreatorTemplatePreview(), null, 2);
}

function buildCreatorTemplatePreview() {
  const params = getCreatorTemplateParams();
  const flow = [
    { id: "identity", type: "wheel", title: "身份/出身" },
    { id: "profile", type: "group", title: "人设补充", wheelCount: Math.max(1, Math.min(6, params.baseAttributeCount)) },
    { id: "attributes", type: "scoreGroup", title: "基础属性", attributeCount: params.baseAttributeCount },
    { id: "abilityFlavor", type: "group", title: "能力风味", hiddenWeight: params.hiddenWeight },
    { id: "grade", type: "computedGrade", title: "等级区间判定", gradeCount: params.gradeCount },
    { id: "events", type: "timeline", title: "大事件", eventCount: params.majorEventCount },
    { id: "ending", type: "final", title: params.finalEvaluation ? "后续评价 + 末尾固定事件" : "末尾固定事件" }
  ];
  if (params.factionMode) {
    flow.splice(4, 0, { id: "faction", type: "stateWheel", title: "阵营分歧" });
  }

  return {
    schema: "jjk-wheel-template-preview",
    version: 1,
    mode: "debug-prototype",
    note: "该 JSON 只用于创作者模式原型预览，不接入当前咒术转盘正式流程。",
    templateName: params.templateName,
    parameters: params,
    generated: {
      mainFlow: flow,
      hiddenState: [
        "strengthScore",
        "faction",
        "dead",
        "skipPeriods",
        "finalSequenceStarted"
      ],
      validationRules: [
        "每个节点必须有默认出口或终止出口。",
        "死亡结果只能进入最终序列，不能继续进入普通战斗节点。",
        "阵营锁定后不能被后续普通节点反复覆盖。",
        "所有条件引用的隐藏变量必须先由前置节点写入。",
        "最终固定事件必须排在评价之后。"
      ],
      suggestedWeights: {
        baseDeathRate: params.deathRate,
        highStrengthDeathMultiplier: params.hiddenWeight ? 0.35 : 1,
        lowStrengthDeathMultiplier: params.hiddenWeight ? 1.4 : 1
      }
    }
  };
}

function getCreatorTemplateParams() {
  return {
    templateName: (els.templateName?.value || "未命名模板").trim() || "未命名模板",
    baseAttributeCount: getClampedInputNumber(els.templateAttributeCount, 1, 12, 6),
    gradeCount: getClampedInputNumber(els.templateGradeCount, 2, 12, 7),
    majorEventCount: getClampedInputNumber(els.templateEventCount, 0, 12, 4),
    deathRate: getClampedInputNumber(els.templateDeathRate, 0, 95, 20),
    factionMode: els.templateFactionMode?.value !== "no",
    hiddenWeight: els.templateHiddenWeightMode?.value !== "no",
    finalEvaluation: els.templateFinalEvaluation?.value !== "no"
  };
}

function getClampedInputNumber(input, min, max, fallback) {
  const value = Number(input?.value);
  if (!Number.isFinite(value)) return fallback;
  return Math.round(clamp(value, min, max));
}

//--HTML转义桥接--//
function escapeHtml(value) {
  return callSiteModuleImplementation("JJKUIRenderHelpers", "escapeHtml", [value]);
}
