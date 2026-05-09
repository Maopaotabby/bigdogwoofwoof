//--AI服务配置与叙事请求--//
function getAiPromptBuilder() {
  return globalThis.JJKAiPromptBuilder || globalThis.JJKAiPromptApi || null;
}

function mergeCardPromptIntoPromptTemplates(promptTemplates, cardPrompt) {
  if (!cardPrompt || typeof cardPrompt !== "object") return promptTemplates;
  const templateId = String(cardPrompt.templateId || "duel_character_assist").trim();
  const systemPrompt = Array.isArray(cardPrompt.systemPrompt) ? cardPrompt.systemPrompt.map(String).filter(Boolean) : [];
  if (!templateId || !systemPrompt.length) return promptTemplates;
  const next = JSON.parse(JSON.stringify(promptTemplates || {}));
  next.templates = next.templates && typeof next.templates === "object" ? next.templates : {};
  const existing = next.templates[templateId] || {};
  next.templates[templateId] = {
    ...existing,
    label: existing.label || "斗蛐蛐角色卡辅助",
    staticPrefix: [
      ...systemPrompt,
      ...(Array.isArray(cardPrompt.specialHandRules) ? ["Special hand rules:", ...cardPrompt.specialHandRules] : []),
      ...(Array.isArray(cardPrompt.domainRules) ? ["Domain rules:", ...cardPrompt.domainRules] : []),
      ...(Array.isArray(cardPrompt.hardConstraints) ? ["Return format constraints:", ...cardPrompt.hardConstraints] : [])
    ],
    dynamicSections: Array.from(new Set([
      ...((Array.isArray(existing.dynamicSections) ? existing.dynamicSections : [])),
      "description",
      "draft",
      "allowedRanks",
      "allowedGrades",
      "allowedStages",
      "generatedTermTemplates",
      "customSpecialTerms",
      "mechanismHints"
    ])),
    maxOutputChars: Math.max(Number(existing.maxOutputChars || 0), 1800)
  };
  return next;
}

function registerAiPromptAssets(providerRules, promptTemplates, cardPrompt = null) {
  const builder = getAiPromptBuilder();
  const mergedPromptTemplates = mergeCardPromptIntoPromptTemplates(promptTemplates, cardPrompt);
  if (!builder || typeof builder.registerPromptAssets !== "function") {
    return { providerRules, promptTemplates: mergedPromptTemplates, loadedAt: "", buildVersion: APP_BUILD_VERSION };
  }
  return builder.registerPromptAssets({
    providerRules,
    promptTemplates: mergedPromptTemplates,
    buildVersion: APP_BUILD_VERSION
  });
}

function readSafeStorage(storage, key, fallback = "") {
  try {
    return storage?.getItem(key) || fallback;
  } catch (error) {
    return fallback;
  }
}

function writeSafeStorage(storage, key, value) {
  try {
    if (value) storage?.setItem(key, value);
    else storage?.removeItem(key);
    return true;
  } catch (error) {
    return false;
  }
}

function removeSafeStorage(storage, key) {
  try {
    storage?.removeItem(key);
    return true;
  } catch (error) {
    return false;
  }
}

function getEast8DateKey(date = new Date()) {
  const time = date instanceof Date ? date.getTime() : Date.now();
  return new Date(time + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const DUEL_CUSTOM_NAME_MAX_BYTES = 14;
const DUEL_CUSTOM_DOMAIN_MAX_BYTES = 14;
const DUEL_CUSTOM_TECHNIQUE_MAX_BYTES = 10;
const aiPendingRequestMap = new Map();

function utf8ByteLength(value) {
  return new TextEncoder().encode(String(value || "")).length;
}

function trimUtf8Bytes(value, maxBytes) {
  const limit = Math.max(0, Number(maxBytes || 0));
  let output = "";
  for (const char of String(value || "")) {
    if (utf8ByteLength(output + char) > limit) break;
    output += char;
  }
  return output;
}

function getLoginCardAiIdentity() {
  const payload = globalThis.JJKLoginCard?.getPayload?.() || {};
  const characters = Array.isArray(payload.characters) ? payload.characters : [];
  const activeCharacter = characters[0]?.card || characters[0] || {};
  const isAdmin = payload.admin === true || payload.admin?.enabled === true;
  return {
    nickname: String(payload.nickname || payload.ownerNickname || payload.displayName || "未命名登录卡").slice(0, 80),
    ownerId: String(payload.ownerId || payload.ipDerivedId || payload.creatorIp || payload.creationIp || "anonymous").slice(0, 120),
    loginCardIp: String(payload.creationIp || payload.creatorIp || payload.ipDerivedId || payload.ownerId || "").slice(0, 120),
    characterId: String(activeCharacter.characterId || activeCharacter.id || payload.ownerId || "default-character").slice(0, 120),
    isAdmin
  };
}

function getAiUsageKindForTemplate(templateId) {
  if (templateId === "duel_character_assist") return "character_generation";
  if (templateId === "life_narrative" || templateId === "article_summary") return "life_narrative";
  if (templateId === "battle_narration") return "battle_summary";
  return "other";
}

function hashAiRequestKey(value) {
  var text = String(value || "");
  var hash = 2166136261;
  for (var index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function buildAiGovernanceHeaders(templateId, context, promptPayload) {
  const identity = getLoginCardAiIdentity();
  const usageKind = getAiUsageKindForTemplate(templateId);
  const requestKey = hashAiRequestKey(JSON.stringify({
    templateId,
    usageKind,
    identity,
    context,
    model: promptPayload?.model || ""
  }));
  return {
    "X-JJK-AI-Kind": usageKind,
    "X-JJK-AI-Request-Key": requestKey,
    "X-JJK-Login-Card-Nickname": encodeAiGovernanceHeaderValue(identity.nickname),
    "X-JJK-Login-Card-Owner": encodeAiGovernanceHeaderValue(identity.ownerId),
    "X-JJK-Login-Card-IP": encodeAiGovernanceHeaderValue(identity.loginCardIp),
    "X-JJK-Character-Id": encodeAiGovernanceHeaderValue(identity.characterId),
    "X-JJK-Login-Card-Admin": identity.isAdmin ? "1" : "0"
  };
}

function encodeAiGovernanceHeaderValue(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    return encodeURIComponent(text).slice(0, 240);
  } catch {
    return "";
  }
}

function loginAiAdminMode() {
  const password = String(els.aiAdminPasswordInput?.value || "");
  const result = globalThis.JJKLoginCard?.unlockAdminMode?.(password) || {
    ok: false,
    message: "登录卡模块未加载，无法写入管理员模式。"
  };
  if (els.aiAdminStatus) {
    els.aiAdminStatus.textContent = result.message || (result.ok ? "管理员模式已开启。" : "管理员登录失败。");
    els.aiAdminStatus.classList.toggle("error-text", !result.ok);
  }
  if (result.ok && els.aiAdminPasswordInput) els.aiAdminPasswordInput.value = "";
  updateAiProviderUi();
  return result;
}

function readAiDailyUsage() {
  const today = getEast8DateKey();
  const fallback = { date: today, count: 0 };
  try {
    const parsed = JSON.parse(readSafeStorage(window.localStorage, AI_DAILY_USAGE_STORAGE_KEY, "{}")) || {};
    if (parsed.date !== today) return fallback;
    return {
      date: today,
      count: Math.max(0, Math.floor(Number(parsed.count || 0)))
    };
  } catch (error) {
    return fallback;
  }
}

function writeAiDailyUsage(usage) {
  return writeSafeStorage(window.localStorage, AI_DAILY_USAGE_STORAGE_KEY, JSON.stringify({
    date: usage.date || getEast8DateKey(),
    count: Math.max(0, Math.floor(Number(usage.count || 0)))
  }));
}

function createAiDailyQuotaError(usage = readAiDailyUsage()) {
  return createAiProviderError(AI_DAILY_LIMIT_MESSAGE, {
    reasonCode: "daily-quota-exceeded",
    stage: "quota",
    dailyLimit: AI_DAILY_LIMIT,
    dailyUsage: usage.count,
    timezone: "Asia/Shanghai"
  });
}

function assertAiDailyQuotaAvailable() {
  if (getLoginCardAiIdentity().isAdmin) return readAiDailyUsage();
  const usage = readAiDailyUsage();
  if (usage.count >= AI_DAILY_LIMIT) throw createAiDailyQuotaError(usage);
  return usage;
}

function hasLoginCardForAi() {
  return Boolean(globalThis.JJKLoginCard?.hasLogin?.());
}

function createLoginCardRequiredAiError() {
  return createAiProviderError("获取登录卡后才能用哦", {
    reasonCode: "login-card-required",
    stage: "login-card"
  });
}

function assertLoginCardForAi() {
  if (!hasLoginCardForAi()) throw createLoginCardRequiredAiError();
  return true;
}

function recordAiDailyCall() {
  if (getLoginCardAiIdentity().isAdmin) return readAiDailyUsage();
  const usage = assertAiDailyQuotaAvailable();
  const next = { date: usage.date, count: usage.count + 1 };
  writeAiDailyUsage(next);
  return next;
}

function getAiDefaultProviderMode() {
  const builder = getAiPromptBuilder();
  const mode = state.aiProviderRules?.defaultMode ||
    builder?.getAiProviderRules?.().defaultMode ||
    "default";
  return normalizeAiProviderMode(mode);
}

function normalizeAiProviderMode(mode) {
  const builder = getAiPromptBuilder();
  if (builder?.normalizeAiMode) return builder.normalizeAiMode(mode, state.aiProviderRules);
  const text = String(mode || "").trim();
  const legacyModes = {
    local_fallback: "off",
    openai_byok_direct: "custom",
    deepseek_byok_direct: "custom",
    openai_compatible_byok_direct: "default",
    user_proxy_endpoint: "custom"
  };
  return legacyModes[text] || (["off", "default", "custom"].includes(text) ? text : "default");
}

function getAiProviderList() {
  const builder = getAiPromptBuilder();
  if (builder?.listAiProviders) return builder.listAiProviders();
  return Array.isArray(state.aiProviderRules?.providers) ? state.aiProviderRules.providers : [];
}

function getAiProviderConfig(providerIdOrMode) {
  const builder = getAiPromptBuilder();
  if (builder?.getAiProviderConfig) return builder.getAiProviderConfig(providerIdOrMode);
  const text = String(providerIdOrMode || "").trim();
  const exact = getAiProviderList().find((provider) => provider.providerId === text);
  if (exact) return exact;
  const providerId = inferAiProviderIdForMode(text) || text;
  return getAiProviderList().find((provider) => provider.providerId === providerId) || null;
}

function inferAiProviderIdForMode(mode) {
  const normalized = normalizeAiProviderMode(mode);
  const defaultProviderId = String(state.aiProviderRules?.defaultProviderId || "").trim();
  if (defaultProviderId && getAiProviderList().some((provider) => provider.providerId === defaultProviderId && (!Array.isArray(provider.modes) || provider.modes.includes(normalized)))) {
    return defaultProviderId;
  }
  if (normalized === "default") return "ark_ai";
  if (normalized === "custom") return "openai_compatible";
  return "";
}

function getDirectAiModes() {
  return ["default", "custom"];
}

function getProviderModeForProviderId(providerId) {
  const id = String(providerId || "").trim();
  if (id === "ark_ai") return "default";
  if (id === "openai_compatible") return "custom";
  return getAiProviderMode();
}

function normalizeAiProviderModelName(value) {
  const model = String(value || "").trim();
  if (model === "doubao-seed-2-0-lite-260215") return "doubao-seed-2-0-mini-260215";
  return model;
}

function initializeAiNarrativePanel() {
  if (els.aiProviderMode) {
    els.aiProviderMode.value = getStoredAiProviderMode();
  }
  if (els.aiProviderIdInput) {
    els.aiProviderIdInput.value = readSafeStorage(window.localStorage, AI_PROVIDER_ID_STORAGE_KEY, inferAiProviderIdForMode(getStoredAiProviderMode()) || state.aiProviderRules?.defaultProviderId || "ark_ai");
  }
  syncAiProviderForMode(false);
  const activeProvider = getAiProviderConfig(els.aiProviderIdInput?.value || getStoredAiProviderMode());
  if (els.aiBaseUrlInput) {
    els.aiBaseUrlInput.value = readSafeStorage(window.localStorage, AI_BASE_URL_STORAGE_KEY, activeProvider?.baseUrl || "");
  }
  if (els.aiPathInput) {
    els.aiPathInput.value = activeProvider?.defaultPath || "/chat/completions";
  }
  if (els.aiModelInput) {
    els.aiModelInput.value = normalizeAiProviderModelName(readSafeStorage(window.localStorage, AI_MODEL_STORAGE_KEY, getAiProviderDefaultModel()));
  }
  if (els.aiOutputTokenInput) {
    els.aiOutputTokenInput.value = readSafeStorage(window.localStorage, AI_OUTPUT_TOKENS_STORAGE_KEY, String(getAiProviderMaxOutputTokens()));
  }
  if (els.aiByokPersistLocal) {
    els.aiByokPersistLocal.checked = readSafeStorage(window.localStorage, AI_BYOK_PERSIST_LOCAL_STORAGE_KEY, "no") === "yes";
  }
  if (els.aiByokKeyInput) {
    els.aiByokKeyInput.value = (readAiByokKey() || activeProvider?.defaultApiKey) ? "••••••••••••" : "";
  }
  updateAiProviderUi();
  updateAiNarrativeStatus(getAiEndpointModeHint());
}

function syncDuelAiAssistPanel() {
  if (!hasLoginCardForAi()) {
    if (els.duelAiAssistToggle) {
      els.duelAiAssistToggle.checked = false;
      els.duelAiAssistToggle.disabled = true;
    }
    if (els.duelAiDescription) els.duelAiDescription.disabled = true;
    if (els.duelAiAnalyzeBtn) els.duelAiAnalyzeBtn.disabled = true;
    updateDuelAiStatus("获取登录卡后才能用哦", true);
    return;
  }
  const enabled = isDuelAiAssistEnabled();
  if (els.duelAiAssistToggle) els.duelAiAssistToggle.checked = enabled;
  if (els.duelAiAssistToggle) els.duelAiAssistToggle.disabled = false;
  if (els.duelAiDescription) els.duelAiDescription.disabled = !enabled;
  if (els.duelAiAnalyzeBtn) els.duelAiAnalyzeBtn.disabled = !enabled;
  if (!enabled) updateDuelAiStatus("AI辅助已关闭，当前使用手填角色卡。");
  else updateDuelAiStatus("AI辅助已开启：可以只写自然语言设定，再让 AI 回填角色卡。");
}

function isDuelAiAssistEnabled() {
  if (els.duelAiAssistToggle) return els.duelAiAssistToggle.checked;
  return window.localStorage.getItem(DUEL_AI_ASSIST_STORAGE_KEY) === "yes";
}

function getAiProviderId() {
  const mode = getAiProviderMode();
  if (mode === "off") return "";
  if (mode === "default") return "ark_ai";
  const explicit = String(els.aiProviderIdInput?.value || readSafeStorage(window.localStorage, AI_PROVIDER_ID_STORAGE_KEY, "")).trim();
  return explicit || inferAiProviderIdForMode(mode);
}

function getAiProviderDefaultModel() {
  const provider = getAiProviderConfig(getAiProviderId() || getAiProviderMode());
  return normalizeAiProviderModelName(provider?.defaultModel || state.aiProviderRules?.defaultModel || "doubao-seed-2-0-mini-260215");
}

function getAiProviderMaxOutputTokens() {
  return Number(state.aiProviderRules?.maxOutputTokens || 700);
}

function getStoredAiProviderMode() {
  return normalizeAiProviderMode(readSafeStorage(window.localStorage, AI_PROVIDER_MODE_STORAGE_KEY, getAiDefaultProviderMode()));
}

function getAiProviderMode() {
  return normalizeAiProviderMode(els.aiProviderMode?.value || getStoredAiProviderMode());
}

function getAiProviderBaseUrl() {
  const mode = getAiProviderMode();
  const provider = getAiProviderConfig(getAiProviderId() || mode);
  const stored = readSafeStorage(window.localStorage, AI_BASE_URL_STORAGE_KEY, "");
  const input = String(els.aiBaseUrlInput?.value || stored || "").trim();
  if (mode === "custom") return normalizeAiEndpoint(input);
  return provider?.baseUrl || normalizeAiEndpoint(input);
}

function getAiProviderPath() {
  const provider = getAiProviderConfig(getAiProviderId() || getAiProviderMode());
  return String(provider?.defaultPath || "/chat/completions").trim();
}

function shouldUseServerAiProxy(aiMode, baseUrl) {
  if (aiMode === "default") return true;
  return false;
}

function syncAiProviderForMode(shouldUpdateModel = false) {
  const mode = getAiProviderMode();
  const currentProviderId = String(els.aiProviderIdInput?.value || "").trim();
  const currentProvider = getAiProviderConfig(currentProviderId);
  const currentSupportsMode = currentProvider && (!Array.isArray(currentProvider.modes) || currentProvider.modes.includes(mode));
  const providerId = currentSupportsMode ? currentProviderId : inferAiProviderIdForMode(mode);
  if (els.aiProviderIdInput && providerId && els.aiProviderIdInput.value !== providerId) els.aiProviderIdInput.value = providerId;
  const provider = getAiProviderConfig(providerId || mode);
  if (els.aiBaseUrlInput && provider?.baseUrl && mode !== "custom") {
    els.aiBaseUrlInput.value = provider.baseUrl;
  }
  if (els.aiPathInput && provider?.defaultPath && mode !== "custom") {
    els.aiPathInput.value = provider.defaultPath;
  }
  if (shouldUpdateModel && els.aiModelInput && provider?.defaultModel) {
    els.aiModelInput.value = provider.defaultModel;
  }
}

function syncAiModeForProvider() {
  if (!els.aiProviderMode || !els.aiProviderIdInput) return;
  const mode = getProviderModeForProviderId(els.aiProviderIdInput.value);
  els.aiProviderMode.value = mode;
  syncAiProviderForMode(true);
}

function readAiByokKey() {
  return readSafeStorage(window.sessionStorage, AI_BYOK_SESSION_KEY, "") ||
    readSafeStorage(window.localStorage, AI_BYOK_LOCAL_KEY, "");
}

function saveAiByokKey(rawValue, persistLocal) {
  const value = String(rawValue || "").trim();
  if (!value || /^•+$/.test(value)) return Boolean(readAiByokKey());
  if (persistLocal) {
    removeSafeStorage(window.sessionStorage, AI_BYOK_SESSION_KEY);
    writeSafeStorage(window.localStorage, AI_BYOK_LOCAL_KEY, value);
  } else {
    removeSafeStorage(window.localStorage, AI_BYOK_LOCAL_KEY);
    writeSafeStorage(window.sessionStorage, AI_BYOK_SESSION_KEY, value);
  }
  return true;
}

function clearAiByokKey() {
  removeSafeStorage(window.sessionStorage, AI_BYOK_SESSION_KEY);
  removeSafeStorage(window.localStorage, AI_BYOK_LOCAL_KEY);
  if (els.aiByokKeyInput) els.aiByokKeyInput.value = "";
  updateAiProviderUi();
  updateAiNarrativeStatus("已清除本机保存的 API Key。其他 AI 设置未被删除。");
}

function clearAllAiProviderSettings() {
  [
    AI_PROVIDER_MODE_STORAGE_KEY,
    AI_PROVIDER_ID_STORAGE_KEY,
    AI_BASE_URL_STORAGE_KEY,
    AI_PATH_STORAGE_KEY,
    AI_MODEL_STORAGE_KEY,
    AI_OUTPUT_TOKENS_STORAGE_KEY,
    AI_BYOK_PERSIST_LOCAL_STORAGE_KEY
  ].forEach((key) => removeSafeStorage(window.localStorage, key));
  clearAiByokKey();
  if (els.aiProviderMode) els.aiProviderMode.value = getAiDefaultProviderMode();
  if (els.aiProviderIdInput) els.aiProviderIdInput.value = inferAiProviderIdForMode(getAiProviderMode()) || state.aiProviderRules?.defaultProviderId || "ark_ai";
  if (els.aiModelInput) els.aiModelInput.value = getAiProviderDefaultModel();
  if (els.aiOutputTokenInput) els.aiOutputTokenInput.value = String(getAiProviderMaxOutputTokens());
  updateAiProviderUi();
  updateAiNarrativeStatus("已清除全部 AI Provider 设置；当前回到默认 ArkAI 路径。");
}

function saveAiProviderSettings() {
  const mode = getAiProviderMode();
  const providerId = getAiProviderId() || inferAiProviderIdForMode(mode);
  writeSafeStorage(window.localStorage, AI_PROVIDER_MODE_STORAGE_KEY, mode);
  writeSafeStorage(window.localStorage, AI_PROVIDER_ID_STORAGE_KEY, providerId);
  if (mode === "custom") {
    writeSafeStorage(window.localStorage, AI_BASE_URL_STORAGE_KEY, getAiProviderBaseUrl());
    writeSafeStorage(window.localStorage, AI_MODEL_STORAGE_KEY, normalizeAiProviderModelName(els.aiModelInput?.value || getAiProviderDefaultModel()) || getAiProviderDefaultModel());
    writeSafeStorage(window.localStorage, AI_OUTPUT_TOKENS_STORAGE_KEY, String(clamp(Number(els.aiOutputTokenInput?.value || getAiProviderMaxOutputTokens()), 64, 4000)));
    writeSafeStorage(window.localStorage, AI_BYOK_PERSIST_LOCAL_STORAGE_KEY, els.aiByokPersistLocal?.checked ? "yes" : "no");
  }
  if (mode === "custom" && els.aiByokKeyInput?.value && !/^•+$/.test(els.aiByokKeyInput.value.trim())) {
    saveAiByokKey(els.aiByokKeyInput.value, Boolean(els.aiByokPersistLocal?.checked));
    els.aiByokKeyInput.value = "••••••••••••";
  }
  updateAiProviderUi();
}

function getAiProviderSettings() {
  const maxOutputTokens = clamp(Number(els.aiOutputTokenInput?.value || readSafeStorage(window.localStorage, AI_OUTPUT_TOKENS_STORAGE_KEY, getAiProviderMaxOutputTokens())), 64, 4000);
  const aiMode = getAiProviderMode();
  const providerId = getAiProviderId() || inferAiProviderIdForMode(aiMode);
  const provider = getAiProviderConfig(providerId || aiMode);
  const model = aiMode === "default"
    ? normalizeAiProviderModelName(provider?.defaultModel || state.aiProviderRules?.defaultModel || getAiProviderDefaultModel())
    : normalizeAiProviderModelName(els.aiModelInput?.value || readSafeStorage(window.localStorage, AI_MODEL_STORAGE_KEY, ""));
  const providerBaseUrl = getAiProviderBaseUrl();
  const useServerProxy = shouldUseServerAiProxy(aiMode, providerBaseUrl);
  return {
    aiMode,
    providerId,
    endpointType: provider?.endpointType || "chat_completions",
    baseUrl: useServerProxy ? window.location.origin : providerBaseUrl,
    path: useServerProxy ? "/api/ai-provider/chat/completions" : getAiProviderPath(),
    model,
    maxOutputTokens,
    maxPromptTokens: Number(state.aiProviderRules?.maxPromptTokens || state.aiProviderRules?.tokenBudget?.maxPromptTokens || 6000),
    byokPersistLocal: Boolean(els.aiByokPersistLocal?.checked),
    apiKey: useServerProxy ? "server-proxy" : (aiMode === "default"
      ? (provider?.defaultApiKey || state.aiProviderRules?.defaultApiKey || "")
      : aiMode === "custom"
        ? readAiByokKey()
        : "")
  };
}

function shouldForceDuelAiAssistServerProxy(templateId) {
  return templateId === "duel_character_assist" && getAiProviderMode() === "default" && !getLoginCardAiIdentity().isAdmin;
}

function getAiProviderSettingsForTemplate(templateId) {
  const settings = getAiProviderSettings();
  if (settings.aiMode === "off" || !shouldForceDuelAiAssistServerProxy(templateId)) return settings;
  const provider = getAiProviderConfig("ark_ai") || getAiProviderConfig("default") || {};
  const model = normalizeAiProviderModelName(provider.defaultModel || state.aiProviderRules?.defaultModel || "doubao-seed-2-0-mini-260215");
  return {
    ...settings,
    aiMode: "default",
    providerId: "ark_ai",
    endpointType: provider.endpointType || "chat_completions",
    baseUrl: window.location.origin,
    path: "/api/ai-provider/chat/completions",
    model,
    apiKey: "server-proxy",
    serverProxy: true,
    forcedServerProxyForTemplate: templateId
  };
}

function isServerProxyAiSettings(settings) {
  return Boolean(settings?.serverProxy) ||
    (settings?.apiKey === "server-proxy" && settings?.path === "/api/ai-provider/chat/completions");
}

function toggleAiByokKeyVisibility() {
  if (!els.aiByokKeyInput) return;
  const shouldReveal = els.aiByokKeyInput.type === "password";
  els.aiByokKeyInput.type = shouldReveal ? "text" : "password";
  if (els.aiByokRevealToggle) els.aiByokRevealToggle.textContent = shouldReveal ? "隐藏 Key" : "显示 Key";
}

function updateAiProviderUi() {
  const mode = getAiProviderMode();
  const providerId = getAiProviderId() || inferAiProviderIdForMode(mode);
  const provider = getAiProviderConfig(providerId || mode);
  const isDirect = getDirectAiModes().includes(mode);
  const isCustom = mode === "custom";
  if (els.aiProviderWarning) {
    const warning = mode === "off"
      ? "AI 已关闭：三个 AI 入口都会使用本地 fallback，不调用远程服务。"
      : mode === "default"
        ? "默认模式：使用服务器代理的 Base URL、Model 和默认 Key；自定义窗口已隐藏。"
        : "自定义模式：请填写 Base URL、Model 和 API Key；会直接调用你的 OpenAI-compatible Provider。";
    els.aiProviderWarning.textContent = warning;
    els.aiProviderWarning.classList.toggle("error-text", isCustom);
  }
  document.querySelectorAll("[data-ai-mode-panel]").forEach((panel) => {
    const panelModes = String(panel.dataset.aiModePanel || "").split(/\s+/);
    panel.hidden = !panelModes.includes(mode);
  });
  document.querySelectorAll("[data-ai-custom-setting]").forEach((panel) => {
    panel.hidden = !isCustom;
  });
  document.querySelectorAll("[data-ai-provider-panel]").forEach((panel) => {
    const panelProviders = String(panel.dataset.aiProviderPanel || "").split(/\s+/);
    panel.hidden = !isCustom || !panelProviders.includes(providerId);
  });
  if (els.aiProviderIdInput && providerId && els.aiProviderIdInput.value !== providerId) {
    els.aiProviderIdInput.value = providerId;
  }
  if (els.aiBaseUrlInput) {
    els.aiBaseUrlInput.disabled = !isCustom || provider?.allowCustomBaseUrl === false;
    els.aiBaseUrlInput.placeholder = isCustom ? "https://your-compatible-provider.example/v1" : (provider?.baseUrl || "");
  }
  if (els.aiPathInput) {
    els.aiPathInput.value = provider?.defaultPath || "/chat/completions";
    els.aiPathInput.disabled = true;
  }
  if (els.aiModelInput) els.aiModelInput.disabled = !isCustom || provider?.allowCustomModel === false;
  if (els.aiOutputTokenInput) els.aiOutputTokenInput.disabled = !isCustom;
  if (els.aiFallbackStatus) {
    els.aiFallbackStatus.textContent = mode === "off"
      ? "AI 已关闭：AI生成对战过程、角色经历、自定义角色辅助都不会调用远程服务。"
      : mode === "default"
        ? "默认：三个 AI 入口统一走服务器代理。"
        : `自定义：三个 AI 入口统一走 ${provider?.label || providerId || "自定义 Provider"}，路径固定为 /chat/completions。`;
  }
  if (els.globalSettingsStatus) {
    els.globalSettingsStatus.textContent = hasLoginCardForAi()
      ? `当前 AI：${getAiEndpointModeHint()} 模型：${getAiProviderSettings().model || "未设置"}`
      : "获取登录卡后才能用哦";
    els.globalSettingsStatus.classList.toggle("error-text", !hasLoginCardForAi());
  }
  const loginLocked = !hasLoginCardForAi();
  if (els.testAiProviderBtn) els.testAiProviderBtn.disabled = loginLocked;
  if (els.generateAiNarrativeBtn) els.generateAiNarrativeBtn.disabled = loginLocked;
  if (els.aiFreeToggle) {
    els.aiFreeToggle.disabled = loginLocked || isDrawModeInteractionLocked();
    els.aiFreeToggle.setAttribute("aria-disabled", els.aiFreeToggle.disabled ? "true" : "false");
  }
  if (els.duelAiAssistToggle) els.duelAiAssistToggle.disabled = loginLocked;
  updateAiCostEstimate();
}

function updateAiCostEstimate(payload = null) {
  const builder = getAiPromptBuilder();
  const estimate = payload && builder?.estimatePromptTokenBudget
    ? builder.estimatePromptTokenBudget(payload)
    : state.lastAiPromptEstimate?.estimatedPromptTokens || 0;
  const maxOutputTokens = getAiProviderSettings().maxOutputTokens;
  if (els.aiPromptEstimate) {
    els.aiPromptEstimate.textContent = estimate
      ? `估算 prompt token：${estimate}；最大输出 token：${maxOutputTokens}${state.lastAiPromptEstimate?.trimmed ? "；已裁剪上下文" : ""}`
      : `估算 prompt token：待生成；最大输出 token：${maxOutputTokens}`;
  }
  if (els.aiCostNotice) {
    els.aiCostNotice.textContent = "关闭模式不消耗 token；默认 / 自定义模式会调用统一 AI Provider 路径。";
  }
}

async function testAiProviderConnection() {
  if (!hasLoginCardForAi()) {
    updateAiNarrativeStatus("获取登录卡后才能用哦", true);
    return;
  }
  saveAiProviderSettings();
  const settings = getAiProviderSettings();
  const builder = getAiPromptBuilder();
  const localCheck = builder?.testAiProviderConnection
    ? builder.testAiProviderConnection(settings, { providerRules: state.aiProviderRules })
    : null;
  if (settings.aiMode === "off") {
    updateAiNarrativeStatus("当前为关闭模式：不会发起远程连接测试。");
    return;
  }
  if (getDirectAiModes().includes(settings.aiMode) && !settings.apiKey) {
    updateAiNarrativeStatus("请先输入你自己的 Provider API Key。", true);
    return;
  }
  if (settings.aiMode === "custom" && (!settings.baseUrl || !settings.model)) {
    updateAiNarrativeStatus("请先填写自定义 Provider 的 Base URL 和 Model。", true);
    return;
  }
  if (localCheck?.ok === false) {
    updateAiNarrativeStatus(`连接设置不完整：${localCheck.message}`, true);
    return;
  }
  updateAiNarrativeStatus("正在发送轻量连通性测试...");
  try {
    const result = await testAiProviderReachability(settings, { timeoutMs: AI_PROVIDER_PREFLIGHT_TIMEOUT_MS });
    updateAiNarrativeStatus(`连接测试通过：${result.providerId || settings.providerId || settings.aiMode} / ${result.model || settings.model}。后续发送 prompt 前也会先做预检。`);
  } catch (error) {
    updateAiNarrativeStatus(formatAiProviderFailureMessage(error, { taskLabel: "连接测试" }), true);
  }
}

function createAiProviderError(message, details = {}) {
  const error = new Error(message || "AI Provider request failed.");
  Object.assign(error, details);
  return error;
}

function redactAiFailureText(value) {
  return String(value || "")
    .replace(/Bearer\s+[^\s"'，。；;]+/gi, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted-key]")
    .replace(/[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}/g, "[redacted-key]")
    .slice(0, 260);
}

function decorateAiProviderError(error, details = {}) {
  if (!error || typeof error !== "object") return createAiProviderError(String(error || "AI Provider request failed."), details);
  Object.assign(error, details);
  if (!error.reasonCode) {
    if (error.name === "AbortError") error.reasonCode = "timeout";
    else if (error.status === 401 || error.status === 403) error.reasonCode = "auth";
    else if (error.status === 404) error.reasonCode = "not-found";
    else if (error.status === 408 || error.status === 504) error.reasonCode = "timeout";
    else if (error.status === 409 || /duplicate-ai-request/i.test(error.message || "")) error.reasonCode = "duplicate-request";
    else if (error.status === 429) error.reasonCode = "rate-limit";
    else if (Number(error.status) >= 500) error.reasonCode = "provider-server";
    else if (/failed to fetch|network|cors/i.test(error.message || "")) error.reasonCode = "network";
  }
  return error;
}

function buildAiProviderPreflightPayload(settings = {}) {
  return {
    model: settings.model || getAiProviderDefaultModel(),
    input: [
      { role: "system", content: "Reply exactly OK." },
      { role: "user", content: "ping" }
    ],
    max_output_tokens: 8,
    temperature: 0,
    prompt_cache_key: "jjk-wheel-v1:provider_preflight",
    metadata: {
      templateId: "provider_preflight",
      estimatedPromptTokens: 8,
      trimmed: false,
      maxOutputTokens: 8
    }
  };
}

async function testAiProviderReachability(settings, options = {}) {
  const builder = getAiPromptBuilder();
  const providerId = settings?.providerId || getAiProviderId() || settings?.aiMode || "";
  const model = settings?.model || getAiProviderDefaultModel();
  const localCheck = builder?.testAiProviderConnection
    ? builder.testAiProviderConnection(settings, { providerRules: state.aiProviderRules })
    : null;
  if (settings?.aiMode === "off") {
    return { ok: true, remote: false, providerId, model };
  }
  if (localCheck?.ok === false) {
    throw createAiProviderError(localCheck.message || "AI Provider 设置不完整。", {
      reasonCode: localCheck.message === "missing api key" ? "missing-api-key" : "missing-provider-config",
      stage: "preflight",
      providerId,
      model
    });
  }
  if (!builder?.callAiProvider) {
    throw createAiProviderError("AI prompt builder 未加载。", {
      reasonCode: "builder-unavailable",
      stage: "preflight",
      providerId,
      model
    });
  }
  try {
    const preflightSettings = { ...settings, maxOutputTokens: 8, temperature: 0 };
    await callAiProviderWithTimeout(builder, preflightSettings, buildAiProviderPreflightPayload(settings), {
      promptTemplateId: "provider_preflight",
      localFallbackText: "OK",
      timeoutMs: options.timeoutMs || AI_PROVIDER_PREFLIGHT_TIMEOUT_MS
    });
    return { ok: true, remote: true, providerId, model };
  } catch (error) {
    throw decorateAiProviderError(error, {
      stage: "preflight",
      providerId,
      model,
      timeoutMs: options.timeoutMs || AI_PROVIDER_PREFLIGHT_TIMEOUT_MS
    });
  }
}

function formatAiProviderFailureMessage(error, options = {}) {
  if (error?.reasonCode === "daily-quota-exceeded") return AI_DAILY_LIMIT_MESSAGE;
  if (error?.reasonCode === "login-card-required") return "获取登录卡后才能用哦";
  const taskLabel = options.taskLabel || "AI请求";
  const stageLabel = error?.stage === "preflight"
    ? "连通性预检"
    : error?.stage === "response-parse"
      ? "返回解析"
      : "远程请求";
  const provider = error?.providerId || error?.provider || getAiProviderId() || getAiProviderMode() || "unknown";
  const model = error?.model || getAiProviderSettings().model || "未设置";
  const base = `${taskLabel}失败（${stageLabel}，Provider：${provider}，模型：${model}）`;
  const detail = redactAiFailureText(error?.message || "");
  if (error?.name === "AbortError" || error?.reasonCode === "timeout") {
    const seconds = Math.round(Number(error?.timeoutMs || AI_REQUEST_TIMEOUT_MS) / 1000);
    return `${base}：超过 ${seconds} 秒未响应。请重试，或缩短描述/减少特殊手札数量。`;
  }
  if (error?.reasonCode === "missing-api-key") return `${base}：缺少 API Key。请在 AI 设置中填写 Key；普通用户使用自定义角色卡时不需要填写 Key。`;
  if (error?.reasonCode === "missing-provider-config") return `${base}：Base URL 或 Model 未配置完整。`;
  if (error?.reasonCode === "builder-unavailable") return `${base}：前端 AI 模块未加载，请刷新页面后再试。`;
  if (error?.status === 401 || error?.status === 403 || error?.reasonCode === "auth") {
    if (error?.serverProxy || error?.forcedServerProxyForTemplate) {
      return `${base}：服务器代理 Key 无效、权限不足，或没有访问当前模型的权限；普通用户不需要填写 Key，请联系站长检查服务器配置。`;
    }
    return `${base}：Key 无效、权限不足，或该 Key 没有访问当前模型的权限。`;
  }
  if (error?.status === 404 || error?.reasonCode === "not-found") return `${base}：接口或模型不存在。请检查 Base URL 和模型名；接口路径固定为 /chat/completions。`;
  if (error?.status === 429 || error?.reasonCode === "rate-limit") return `${base}：触发限流或额度不足，请稍后重试或更换 Key/模型。${detail ? ` 原始信息：${detail}` : ""}`;
  if (error?.status === 409 || error?.reasonCode === "duplicate-request") {
    const seconds = Math.max(1, Math.ceil(Number(error?.data?.retryAfterMs || error?.retryAfterMs || 15000) / 1000));
    return `${base}：相同请求刚提交过或仍在处理中，请等待 ${seconds} 秒后重试。`;
  }
  if (Number(error?.status) >= 500 || error?.reasonCode === "provider-server") return `${base}：Provider 服务器返回 ${error.status}，通常是服务端繁忙或模型暂不可用。${detail ? ` 原始信息：${detail}` : ""}`;
  if (error?.reasonCode === "network") return `${base}：网络/CORS/域名连接失败。请检查 Base URL 是否可访问，或通过代理线路调用。`;
  if (error?.reasonCode === "invalid-structured-json") return `${base}：模型没有返回可解析的角色 JSON，或缺少 suggestion.specialHands。请重试；原始片段：${redactAiFailureText(error?.sample || detail)}`;
  return `${base}${detail ? `：${detail}` : "：服务暂时不可用。"}`;
}

function normalizeAiEndpoint(value) {
  return callSiteModuleImplementation("JJKAiWorkerClient", "normalizeEndpoint", [value]);
}

function updateAiNarrativeStatus(text, isError = false) {
  if (!els.aiNarrativeStatus) return;
  els.aiNarrativeStatus.textContent = text;
  els.aiNarrativeStatus.classList.toggle("error-text", Boolean(isError));
}

function toggleGlobalSettingsPanel(force) {
  if (!els.globalSettingsPanel) return;
  const shouldOpen = typeof force === "boolean" ? force : els.globalSettingsPanel.hidden;
  els.globalSettingsPanel.hidden = !shouldOpen;
  if (els.globalSettingsBtn) {
    els.globalSettingsBtn.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  }
  if (shouldOpen) {
    updateAiProviderUi();
    els.aiProviderMode?.focus();
  } else {
    els.globalSettingsBtn?.focus();
  }
}

async function generateAiNarrative() {
  if (!hasLoginCardForAi()) {
    renderAiNarrativeOutput("");
    updateAiNarrativeStatus("获取登录卡后才能用哦", true);
    return;
  }
  const kind = els.aiNarrativeKind?.value || "finalBiography";
  const narrativeContext = buildAiNarrativePayload(kind);
  if (narrativeContext.records.length === 0) {
    updateAiNarrativeStatus("当前还没有有效抽取记录，先跑完或至少抽取一段流程。", true);
    return;
  }

  els.generateAiNarrativeBtn.disabled = true;
  updateAiNarrativeStatus(getAiProviderMode() === "off"
    ? "正在使用本地 fallback 整理记录，不会调用 API。"
    : "正在通过统一 AI 路径构造 prompt 并调用当前 Provider。");
  renderAiNarrativeOutput("生成中...");

  try {
    const data = await requestAiGoverned("article_summary", narrativeContext, {
      timeoutMs: AI_REQUEST_TIMEOUT_MS,
      localFallbackText: buildLocalLifeNarrativeFallback(narrativeContext)
    });
    const markdown = data.markdown || data.text || "";
    renderAiNarrativeOutput(markdown || "后端没有返回叙事内容。");
    const incompleteText = data.incompleteReason ? "；注意：内容可能没有完整生成，可以重试一次" : "";
    const debugParts = [];
    if (state.debugMode) {
      debugParts.push(`服务：${data.provider || getAiProviderMode() || "unknown"}`);
      debugParts.push(`模型：${data.model || "unknown"}`);
      if (data.promptMetadata?.estimatedPromptTokens) debugParts.push(`估算 token：${data.promptMetadata.estimatedPromptTokens}`);
      if (data.promptMetadata?.trimmed) debugParts.push("上下文已裁剪");
      if (data.fallbackUsed) debugParts.push("已使用回退服务");
      if (data.narrativeQuality?.rewritten) debugParts.push("已做人话改写");
      if (data.styleGuard?.rewritten) debugParts.push("已做禁库清理");
      const remaining = data.styleGuard?.remainingViolations?.length || 0;
      if (remaining) debugParts.push(`禁库剩余 ${remaining}`);
    }
    const debugText = debugParts.length ? `；${debugParts.join("；")}` : "";
    const modeText = data.localFallback ? "本地 fallback，未消耗 API token" : "已调用玩家配置的 AI Provider";
    updateAiNarrativeStatus(`人生经历记录已生成。类型：${getAiNarrativeKindLabel(kind)}；${modeText}${debugText}${incompleteText}。`, Boolean(data.incompleteReason));
  } catch (error) {
    renderAiNarrativeOutput(["daily-quota-exceeded", "login-card-required"].includes(error?.reasonCode) ? "" : buildLocalLifeNarrativeFallback(narrativeContext));
    updateAiNarrativeStatus(buildAiFailureMessage(error), true);
  } finally {
    els.generateAiNarrativeBtn.disabled = !hasLoginCardForAi();
  }
}

async function requestAiNarrative(endpoint, payload) {
  return requestAiGoverned("article_summary", payload, {
    timeoutMs: AI_REQUEST_TIMEOUT_MS,
    localFallbackText: buildLocalLifeNarrativeFallback(payload)
  });
}

function buildAiPromptPayload(templateId, context, options = {}) {
  const builder = getAiPromptBuilder();
  const { providerSettings, ...builderOptions } = options;
  const settings = providerSettings || getAiProviderSettings();
  const promptOptions = {
    providerRules: state.aiProviderRules,
    model: settings.model,
    maxOutputTokens: settings.maxOutputTokens,
    siteVersion: APP_BUILD_VERSION,
    ...builderOptions
  };
  const payload = builder?.buildAiPromptPayload
    ? builder.buildAiPromptPayload(templateId, context, promptOptions)
    : {
      model: settings.model,
      input: [
        { role: "system", content: "你只能基于提供的数据进行叙事或解释，不得改写数值、胜负和流程。" },
        { role: "user", content: { templateId, dynamicContext: context } }
      ],
      max_output_tokens: settings.maxOutputTokens,
      prompt_cache_key: `jjk-wheel-v1:${templateId}`,
      metadata: {
        templateId,
        estimatedPromptTokens: Math.ceil(JSON.stringify(context || {}).length / 2),
        trimmed: false,
        maxOutputTokens: settings.maxOutputTokens
      }
    };
  state.lastAiPromptEstimate = payload.metadata || null;
  updateAiCostEstimate(payload);
  return payload;
}

async function requestAiGoverned(templateId, context, options = {}) {
  assertLoginCardForAi();
  assertAiDailyQuotaAvailable();
  const builder = getAiPromptBuilder();
  const settings = getAiProviderSettingsForTemplate(templateId);
  const promptPayload = buildAiPromptPayload(templateId, context, { ...options, providerSettings: settings });
  const requestKey = hashAiRequestKey(JSON.stringify({ templateId, context, model: promptPayload?.model || "" }));
  if (aiPendingRequestMap.has(requestKey)) return aiPendingRequestMap.get(requestKey);
  const localFallbackText = options.localFallbackText || buildLocalAiFallbackText(templateId, context);
  const localResponse = (reason) => ({
    provider: settings.aiMode || "off",
    model: settings.model,
    text: localFallbackText,
    markdown: localFallbackText,
    localFallback: true,
    fallbackUsed: true,
    fallbackReason: reason || "",
    promptMetadata: promptPayload.metadata || null
  });

  const execute = (async () => {
  if (settings.aiMode === "off") {
    return localResponse("mode:" + settings.aiMode);
  }
  if (getDirectAiModes().includes(settings.aiMode) && !settings.apiKey) {
    if (options.throwOnRemoteFailure) {
      throw createAiProviderError("missing api key", {
        reasonCode: "missing-api-key",
        stage: "preflight",
        providerId: settings.providerId,
        model: settings.model
      });
    }
    return localResponse("missing-byok-key");
  }
  if (settings.aiMode === "custom" && (!settings.baseUrl || !settings.model)) {
    if (options.throwOnRemoteFailure) {
      throw createAiProviderError("missing compatible provider config", {
        reasonCode: "missing-provider-config",
        stage: "preflight",
        providerId: settings.providerId,
        model: settings.model
      });
    }
    return localResponse("missing-compatible-provider-config");
  }
  try {
    if (!builder?.callAiProvider) throw new Error("AI prompt builder is unavailable.");
    if (options.preflight !== false && settings.aiMode === "custom") {
      await testAiProviderReachability(settings, {
        timeoutMs: options.preflightTimeoutMs || AI_PROVIDER_PREFLIGHT_TIMEOUT_MS
      });
    }
    const result = await callAiProviderWithTimeout(builder, settings, promptPayload, {
      promptTemplateId: templateId,
      localFallbackText,
      timeoutMs: options.timeoutMs || AI_REQUEST_TIMEOUT_MS
    });
    const text = result.text || result.response?.text || result.response?.markdown || "";
    return {
      ...(result.response || {}),
      provider: result.provider || settings.aiMode,
      model: promptPayload.model,
      text,
      markdown: result.response?.markdown || text,
      usage: result.usage || result.response?.usage || null,
      localFallback: false,
      promptMetadata: promptPayload.metadata || null
    };
  } catch (error) {
    const decorated = decorateAiProviderError(error, {
      stage: error?.stage || "request",
      providerId: settings.providerId,
      model: settings.model,
      serverProxy: isServerProxyAiSettings(settings),
      forcedServerProxyForTemplate: settings.forcedServerProxyForTemplate || "",
      timeoutMs: error?.timeoutMs || options.timeoutMs || AI_REQUEST_TIMEOUT_MS
    });
    if (decorated.reasonCode === "daily-quota-exceeded") throw decorated;
    if (options.throwOnRemoteFailure) throw decorated;
    return localResponse(decorated?.status ? `HTTP ${decorated.status}` : (decorated?.message || "provider-failed"));
  }
  })();
  aiPendingRequestMap.set(requestKey, execute);
  try {
    return await execute;
  } finally {
    aiPendingRequestMap.delete(requestKey);
  }
}

async function callAiProviderWithTimeout(builder, settings, promptPayload, options = {}) {
  recordAiDailyCall();
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || AI_REQUEST_TIMEOUT_MS;
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const fetchImpl = (url, request = {}) => {
    const headers = {
      ...(request.headers || {}),
      ...buildAiGovernanceHeaders(options.promptTemplateId, promptPayload?.input?.[1]?.content || {}, promptPayload)
    };
    return fetch(url, {
      ...request,
      headers,
      signal: controller.signal
    });
  };
  try {
    return await builder.callAiProvider(settings, promptPayload, {
      providerRules: state.aiProviderRules,
      promptTemplateId: options.promptTemplateId,
      siteVersion: APP_BUILD_VERSION,
      localFallbackText: options.localFallbackText,
      fetchImpl
    });
  } catch (error) {
    if (error && typeof error === "object") error.timeoutMs = timeoutMs;
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function buildLocalAiFallbackText(templateId, context) {
  if (templateId === "life_narrative" || templateId === "article_summary") return buildLocalLifeNarrativeFallback(context);
  if (templateId === "battle_narration") return buildLocalDuelBattleNarrativeAssist({ battle: context?.battle || context })?.battleText ||
    "AI 未调用。本地规则已完成战斗结算。";
  if (templateId === "combat_explanation") return "AI 未调用。本地解释：当前结果只来自战斗规则、资源变化、领域状态和已选择手札。";
  if (templateId === "beta_feedback_summary") return "AI 未调用。本地 feedback 摘要只保留测试备注、导出摘要和最近日志，不包含 API Key。";
  if (templateId === "ai_free_analysis" || templateId === "ai_assist") return "AI 未调用。本地 fallback 仅保留玩家行动文字，不改变当前合法结果。";
  if (templateId === "duel_analysis" || templateId === "duel_character_assist") return "AI 未调用。本地规则会尝试解析自定义角色或解释战斗，不决定胜负。";
  return "AI 未调用，已使用本地规则 fallback。";
}

function buildLocalLifeNarrativeFallback(context) {
  const builder = getAiPromptBuilder();
  if (builder?.buildLocalLifeNarrativeFallback) return builder.buildLocalLifeNarrativeFallback(context);
  const records = Array.isArray(context?.recentRecords) ? context.recentRecords : Array.isArray(context?.records) ? context.records.slice(-8) : [];
  if (!records.length) return "AI 未调用。当前还没有足够记录生成经历总结。";
  return `AI 未调用。本地摘要：${records.map((record) => `【${record.title || record.nodeId || "节点"}】${record.result || "已记录"}`).join("；")}。`;
}

function getAiEndpointModeHint() {
  const providerMode = getAiProviderMode();
  if (providerMode === "off") return "AI 已关闭：不会调用任何远程服务。";
  if (providerMode === "default") return "当前为默认模式：AI生成对战过程、角色经历、自定义角色辅助统一使用 ArkAI 路径。";
  if (providerMode === "custom") return "当前为自定义模式：三个 AI 入口统一使用你填写的 OpenAI-compatible Base URL、Model 和 Key。";
  return "当前 AI 模式未识别，已回退到默认 ArkAI 路径。";
}

function shouldTryNextAiEndpoint(error) {
  return callSiteModuleImplementation("JJKAiWorkerClient", "shouldTryNextEndpoint", [error]);
}

function buildAiFailureMessage(error) {
  const mode = getAiProviderMode();
  if (error?.name === "AbortError" || error?.status || error?.reasonCode) return formatAiProviderFailureMessage(error, { taskLabel: "AI生成" });
  if (mode === "custom" && !readAiByokKey()) return "未配置自定义 Provider API Key，已回退到本地叙事。";
  if (mode === "custom" && !getAiProviderSettings().baseUrl) return "未配置自定义 Provider 的 Base URL，已回退到本地叙事。";
  if (mode === "custom" && !getAiProviderSettings().model) return "未配置自定义 Provider 的 Model，已回退到本地叙事。";
  if (mode === "off") return "当前没有调用远程 AI。";
  if (state.debugMode) return error?.message || "人生经历记录生成失败。";
  return "AI Provider 暂时不可用，已回退到本地叙事。";
}

function renderAiNarrativeOutput(markdown) {
  if (!els.aiNarrativeOutput) return;
  const text = String(markdown || "").trim();
  if (!text) {
    els.aiNarrativeOutput.textContent = "";
    return;
  }
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let paragraph = [];
  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${escapeHtml(paragraph.join(" ").trim())}</p>`);
    paragraph = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      continue;
    }
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      flushParagraph();
      blocks.push(`<h3>${escapeHtml(heading[1])}</h3>`);
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      blocks.push(`<p class="ai-bullet">${escapeHtml(bullet[1])}</p>`);
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  els.aiNarrativeOutput.innerHTML = blocks.join("");
}

function buildAiNarrativePayload(kind) {
  const records = state.records
    .filter((record) => !record.skipped)
    .map((record) => ({
      id: record.id,
      nodeId: record.nodeId || "",
      title: record.title || "",
      stage: record.stage || "",
      result: record.result || "",
      selectionMode: record.selectionMode || "random",
      aiFreeInteraction: record.aiFreeInteraction || null,
      aiFreeInfluence: record.aiFreeInfluence || null,
      aiFreeAssistTrace: record.aiFreeAssistTrace || buildAiFreeAssistTraceFromRecord(record),
      aiFreeBridge: record.aiFreeBridge || null,
      resultTags: record.optionEffects?.resultTags || []
  }));
  const aiFreeAssistTimeline = records
    .filter((record) => record.selectionMode === "aiFree" && record.aiFreeAssistTrace)
    .map((record) => ({
      id: record.id,
      nodeId: record.nodeId,
      title: record.title,
      stage: record.stage,
      result: record.result,
      trace: record.aiFreeAssistTrace
    }));
  const strength = buildStrengthSnapshot();
  const capabilityLedger = buildAiCapabilityLedger(strength);
  return {
    schema: "jjk-life-ai-narrative-request",
    version: 1,
    buildVersion: APP_BUILD_VERSION,
    kind,
    kindLabel: getAiNarrativeKindLabel(kind),
    language: "zh-CN",
    runProfile: getRunProfile(),
    stateSummary: Object.fromEntries(getStateSummaryRows()),
    lifeState: buildAiLifeState(),
    capabilityLedger,
    strength: strength ? {
      resource: roundForPayload(strength.resource),
      control: roundForPayload(strength.control),
      body: roundForPayload(strength.body),
      growth: roundForPayload(strength.growth),
      abilityBuildBonus: roundForPayload(strength.abilityBuildBonus),
      gradeEffectiveScore: roundForPayload(strength.gradeEffectiveScore),
      gradeFloor: strength.gradeFloor,
      instantCombatProfile: strength.instantCombatProfile || null
    } : null,
    records,
    recentRecords: records.slice(-24),
    aiFreeAssistTimeline,
    aiFreeBridgeEvents: (state.flags.aiFreeBridgeEvents || []).slice(-16),
    loreIndex: selectRelevantLoreCards(records),
    generationRules: [
      "必须以咒术回战世界观机制为底层逻辑，而不是普通奇幻或通用超能力。",
      "写任何术式、领域、反转术式、咒具、天与咒缚、黑闪或战斗压制表现之前，必须先核对 capabilityLedger、strength、lifeState 和 records；payload 未确认的能力一律视为不可用。",
      "如果 capabilityLedger.hasInnateTechnique 为 false，不得描写玩家发动生得术式、术式反转、极之番或依赖术式的领域展开。",
      "如果 capabilityLedger.canUseDomainExpansion 为 false，不得描写玩家领域展开、必中领域或领域压制；若 canUseAntiDomain 为 false，也不得凭空写简易领域、弥虚葛笼等反领域手段。",
      "如果 capabilityLedger.hasCursedTools 为 false，不得凭空给玩家使用咒具；只能使用 capabilityLedger.cursedTools 中列出的咒具或 records 明确出现的资源。",
      "如果 capabilityLedger.canUseReverseCursedTechnique 为 false，不得写玩家使用反转术式治疗、反转输出或术式反转。",
      "不要改写规则引擎已经确定的结果、死亡、阵营、等级和胜负。",
      "可解释因果、补充心理和社会后果，但不得推翻 records 中的既定事实。",
      "AI自由辅助记录中的 aiFreeInteraction 是玩家行动策略；它可以扩写动机和后果，但主线事实仍以 result 与状态字段为准。",
      "AI自由桥接节点是关键节点之间的软扩展：可写准备、侦查、代价、保护、撤退、压制等过程，但必须收束回 records 已记录的正式结果。",
      "当 aiFreeAssistTimeline 非空时，最终总结必须吸收其中的行动策略、系统理解与后续倾向，把它们写成角色当时的意图、判断和连锁影响，避免像普通随机结果一样跳过玩家主动行动。",
      "aiFreeAssistTrace.boundary 是硬边界：不得把行动策略写成已经直接改变当前结果、角色生死、阵营或最终战胜负。",
      "术式、束缚、术式公开、咒力残秽、反转术式、领域、高专/高层关系必须按 payload 中出现的事实谨慎使用。",
      "不要长篇复述原作剧情；只围绕本局角色生成原创叙事。"
    ]
  };
}

function buildAiLifeState() {
  const strength = buildStrengthSnapshot();
  return clonePlain({
    flags: {
      identity: getEffectiveIdentity(),
      startTime: state.flags.startTime || "",
      location: state.flags.location || "",
      faction: state.flags.faction || "",
      sorcererGrade: state.flags.sorcererGradeLabel || gradeLabel(state.flags.sorcererGrade),
      dead: Boolean(state.flags.dead),
      hasInnateTechnique: Boolean(state.flags.hasInnateTechnique),
      hasDomain: Boolean(state.flags.hasDomain),
      hasCursedTool: Boolean(state.flags.hasCursedTool),
      shibuyaOutcome: state.flags.shibuyaOutcome || "",
      shinjukuOutcome: state.flags.shinjukuThirdPartyOutcome || state.flags.shinjukuSpectatorResult || "",
      sukunaEntryStage: state.flags.sukunaEntryStageLabel || "",
      sukunaNerfDetails: state.flags.sukunaNerfDetails || [],
      aiFreeInteractionCount: Number(state.flags.aiFreeInteractionCount || 0),
      aiFreeFactionHint: state.flags.aiFreeFactionHint || "",
      aiFreeLastInfluence: state.flags.aiFreeLastInfluence || ""
    },
    aiFreeInfluences: (state.flags.aiFreeInfluences || []).slice(-12),
    aiFreeAssistTimeline: (state.flags.aiFreeAssistTimeline || []).slice(-12),
    aiFreeBridgeEvents: (state.flags.aiFreeBridgeEvents || []).slice(-16),
    aiFreeWeightBias: state.flags.aiFreeWeightBias || createEmptyAiFreeBias(),
    capabilityLedger: buildAiCapabilityLedger(strength),
    answers: state.answers
  });
}

function buildAiCapabilityLedger(strength = buildStrengthSnapshot()) {
  const advanced = state.flags.advancedTechniques || [];
  const domainState = getDomainCombatState();
  const loadout = strength?.instantCombatProfile?.loadout || buildCurrentLoadoutProfile();
  const hasInnate = hasTechniqueNow();
  const hasRct = hasExactAdvancedTechniqueInContext("反转术式") ||
    hasAdvancedTechnique("反转术式外放") ||
    advanced.some((item) => String(item).includes("反转术式"));
  const hasTechniqueReverse = hasAdvancedTechnique("术式反转");
  const hasTools = hasCursedToolNow(loadout);
  const zeroCursedEnergy = isZeroCursedEnergyHeavenlyRestriction();
  const hiddenScores = strength ? {
    resource: roundForPayload(strength.resource),
    control: roundForPayload(strength.control),
    body: roundForPayload(strength.body),
    growth: roundForPayload(strength.growth),
    build: roundForPayload(strength.abilityBuildBonus),
    gradeEffectiveScore: roundForPayload(strength.gradeEffectiveScore),
    rawRanks: strength.rawRanks || {}
  } : null;
  const combatProfile = strength?.instantCombatProfile ? {
    instantPowerScore: roundForPayload(strength.instantCombatProfile.instantPowerScore),
    visibleGrade: gradeLabel(strength.instantCombatProfile.visibleGrade),
    combatPowerUnit: strength.instantCombatProfile.combatPowerUnit?.label || "",
    disruptionUnit: strength.instantCombatProfile.disruptionUnit?.label || "",
    pool: strength.instantCombatProfile.pool?.label || "",
    axisScores: strength.instantCombatProfile.axisScores || {},
    winPaths: strength.instantCombatProfile.winPaths || [],
    risks: strength.instantCombatProfile.risks || [],
    tags: strength.instantCombatProfile.tags || []
  } : null;
  const forbiddenClaims = [];
  if (!hasInnate) {
    forbiddenClaims.push("不得描写玩家发动生得术式、术式反转、极之番或依赖术式的领域展开。");
  }
  if (!domainState.hasDomain) {
    forbiddenClaims.push("不得描写玩家领域展开、必中领域或领域压制。");
  }
  if (!domainState.hasAntiDomain) {
    forbiddenClaims.push("不得凭空描写玩家使用简易领域、弥虚葛笼或其他反领域手段。");
  }
  if (!hasTools) {
    forbiddenClaims.push("不得凭空给玩家新增咒具或特殊武器。");
  }
  if (!hasRct) {
    forbiddenClaims.push("不得描写玩家使用反转术式治疗、反转输出或术式反转。");
  }
  if (zeroCursedEnergy) {
    forbiddenClaims.push("零咒力天与咒缚时，不得描写玩家主动释放咒力或术式；只能按体术、感官、咒具等已确认资源书写。");
  }

  return {
    schema: "jjk-ai-capability-ledger",
    version: 1,
    strictUse: true,
    unknownMeansUnavailable: true,
    identity: getEffectiveIdentity() || "",
    faction: state.flags.faction || "",
    visibleGrade: state.flags.sorcererGradeLabel || gradeLabel(state.flags.sorcererGrade),
    hasInnateTechnique: hasInnate,
    innateTechnique: hasInnate ? getCurrentTechniqueText() : "",
    techniqueProfile: hasInnate && strength?.techniqueSynergy?.profile ? {
      displayName: strength.techniqueSynergy.displayName,
      tags: strength.techniqueSynergy.profile.tags || [],
      sourceNote: strength.techniqueSynergy.sourceNote || ""
    } : null,
    canUseDomainExpansion: Boolean(domainState.hasDomain),
    canUseAntiDomain: Boolean(domainState.hasAntiDomain),
    canUseSimpleDomain: Boolean(domainState.hasSimpleDomain),
    canUseHollowWickerBasket: Boolean(domainState.hasHollowWickerBasket),
    canUseReverseCursedTechnique: Boolean(hasRct),
    canUseTechniqueReverse: Boolean(hasTechniqueReverse),
    hasCursedTools: hasTools,
    cursedToolCount: Number(loadout.toolCount || 0),
    cursedTools: loadout.matchedTools || [],
    loadoutTier: loadout.label || "",
    advancedTechniques: advanced,
    specialTalent: state.flags.specialTalent || "",
    heavenlyRestriction: state.flags.heavenlyRestrictionType || "",
    zeroCursedEnergy,
    hiddenScores,
    instantCombatProfile: combatProfile,
    currentSoftContext: {
      aiFreeWeightBias: state.flags.aiFreeWeightBias || createEmptyAiFreeBias(),
      aiFreeBridgeEvents: (state.flags.aiFreeBridgeEvents || []).slice(-8),
      selfCombatStatusTexts: (state.flags.selfCombatStatusTexts || []).slice(-8)
    },
    forbiddenClaims
  };
}

function hasCursedToolNow(loadout = buildCurrentLoadoutProfile()) {
  return getAnswerText("hasTool") === "是" ||
    Number(state.flags.toolCount || 0) > 0 ||
    (state.flags.tools || []).length > 0 ||
    Number(loadout?.toolCount || 0) > 0;
}

function selectRelevantLoreCards(records) {
  const searchText = buildLoreSearchText(records);
  const requiredTags = new Set([
    "cursedEnergy",
    "residue",
    "grade",
    "society",
    "innateTechnique"
  ]);
  return JJK_LORE_INDEX
    .map((card, index) => ({
      card,
      index,
      score: scoreLoreCard(card, searchText, requiredTags)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 18)
    .map(({ card }) => compactLoreCard(card));
}

function buildLoreSearchText(records) {
  const recordText = records
    .map((record) => `${record.title} ${record.stage} ${record.result}`)
    .join(" ");
  const summaryText = getStateSummaryRows()
    .map(([label, value]) => `${label} ${value}`)
    .join(" ");
  const strength = buildStrengthSnapshot();
  const strengthText = strength
    ? [
      strength.gradeFloor,
      state.flags.sorcererGradeLabel,
      state.flags.hasInnateTechnique ? "生得术式" : "",
      state.flags.hasDomain ? "领域" : "",
      state.flags.hasCursedTool ? "咒具" : "",
      strength.instantCombatProfile?.winPaths?.join(" ") || ""
    ].join(" ")
    : "";
  return `${recordText} ${summaryText} ${strengthText}`.toLowerCase();
}

function scoreLoreCard(card, searchText, requiredTags) {
  let score = 0;
  const tags = Array.isArray(card.tags) ? card.tags : [];
  const keywords = Array.isArray(card.keywords) ? card.keywords : [];

  for (const tag of tags) {
    if (requiredTags.has(tag)) score += 3;
    if (searchText.includes(String(tag).toLowerCase())) score += 2;
  }
  for (const keyword of keywords) {
    if (keyword && searchText.includes(String(keyword).toLowerCase())) score += 5;
  }
  if (card.id && searchText.includes(String(card.id).toLowerCase())) score += 2;
  if (!keywords.length && !tags.length) score += 1;
  return score;
}

function compactLoreCard(card) {
  return {
    id: card.id || "",
    title: limitPayloadText(card.title, 50),
    summary: limitPayloadText(card.summary, 260),
    tags: Array.isArray(card.tags) ? card.tags.slice(0, 8) : [],
    sourceIds: Array.isArray(card.sourceIds) ? card.sourceIds.slice(0, 4) : [],
    confidence: card.confidence || "unknown"
  };
}

function limitPayloadText(value, maxLength) {
  const text = String(value || "");
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function getAiNarrativeKindLabel(kind) {
  return {
    finalBiography: "完整人生经历",
    stageSummary: "当前阶段小结",
    logicAudit: "流程合理性检查"
  }[kind] || "完整人生经历";
}

function roundForPayload(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(3)) : null;
}

//--斗蛐蛐AI辅助请求--//
async function analyzeCustomDuelWithAi() {
  if (!hasLoginCardForAi()) {
    updateDuelAiStatus("获取登录卡后才能用哦", true);
    renderDuelAiOutput("获取登录卡后才能用哦");
    return;
  }
  if (!isDuelAiAssistEnabled()) {
    updateDuelAiStatus("请先开启 AI辅助。", true);
    return;
  }
  const rawDescription = String(els.duelAiDescription?.value || "").trim();
  const maxDescriptionChars = Number(DUEL_AI_DESCRIPTION_MAX_CHARS || 800);
  if (Array.from(rawDescription).length > maxDescriptionChars) {
    updateDuelAiStatus(`AI辅助自定义角色最多 ${maxDescriptionChars} 字，请压缩设定后再解析。`, true);
    els.duelAiDescription?.focus();
    return;
  }
  const description = normalizeCustomDuelLongText(rawDescription);
  const draft = readCustomDuelDraftForm();
  if (!description && !draft.name && !draft.technique && !draft.domain && !draft.tools.length && !draft.traits.length) {
    updateDuelAiStatus("先写一段角色设定，或至少填写部分术式、咒具、特质。", true);
    els.duelAiDescription?.focus();
    return;
  }

  els.duelAiAnalyzeBtn.disabled = true;
  if (typeof startDuelAiProgress === "function") startDuelAiProgress();
  updateDuelAiStatus("正在解析角色设定并回填角色卡...");
  renderDuelAiOutput("烧脑中。");
  try {
    const data = await requestDuelAiAssistWithFallback(buildDuelCharacterAssistPayload(description, draft), { requireRemote: true });
    logDuelAiRawResponse("duel-character-assist", data);
    const suggestion = normalizeDuelAiSuggestion(data.suggestion || data.cardSuggestion || {}, data.generatedTerms);
    if (!suggestion) throw new Error("解析服务没有返回可用角色卡。");
    if (!data.localFallback && !suggestion.specialHands?.length) {
      const fallbackHands = buildDuelAiTextFallbackSpecialHands(getDuelAiRawText(data), suggestion);
      if (fallbackHands.length) {
        suggestion.specialHands = fallbackHands;
        suggestion.notes = normalizeCustomDuelLongText([suggestion.notes, "远程模型未按 JSON 返回 specialHands，已从原始文本降级提取临时手札。"].filter(Boolean).join(" "));
      }
    }
    if (!data.localFallback && !suggestion.specialHands?.length) {
      throw createAiProviderError("模型返回了角色卡，但没有返回可用 specialHands。", {
        reasonCode: "invalid-structured-json",
        stage: "response-parse",
        providerId: data.provider,
        model: data.model
      });
    }
    applyDuelAiSuggestion(suggestion);
    const pieces = [
      data.analysis ? `解析：${data.analysis}` : "",
      suggestion.generatedTerms?.length ? `生成词条：${suggestion.generatedTerms.map(formatDuelGeneratedTermLine).join("；")}` : "",
      data.battleText ? `战斗短文：${data.battleText}` : ""
    ].filter(Boolean);
    renderDuelAiOutput(pieces.join("\n\n") || "已回填角色卡。你可以继续手动调整，再加入角色池。");
    updateDuelAiStatus(data.localFallback
      ? "AI线路不可用，已使用本地规则解析并回填到自定义角色表单。"
      : "AI解析完成，已回填到自定义角色表单。");
  } catch (error) {
    renderDuelAiOutput("AI解析失败。可以继续手动填写角色卡。");
    updateDuelAiStatus(buildDuelAiFailureMessage(error), true);
  } finally {
    if (typeof stopDuelAiProgress === "function") stopDuelAiProgress();
    els.duelAiAnalyzeBtn.disabled = !hasLoginCardForAi() || !isDuelAiAssistEnabled();
  }
}

function applyDuelManualDataInput() {
  const rawText = String(els.duelManualDataInput?.value || "").trim();
  if (!rawText) {
    if (els.duelManualDataStatus) {
      els.duelManualDataStatus.textContent = "先粘贴 JSON 或 AI 原文。";
      els.duelManualDataStatus.classList.add("error-text");
    }
    return;
  }
  logDuelAiRawResponse("duel-manual-input", { text: rawText, provider: "manual", model: "manual" });
  try {
    const parsed = parseDuelAiStructuredJson({ text: rawText, markdown: rawText, provider: "manual", model: "manual" });
    const draft = readCustomDuelDraftForm();
    const rawSuggestion = parsed.suggestion || parsed.cardSuggestion || buildLooseDuelAiSuggestionFromText(rawText, draft);
    if (!rawSuggestion) throw new Error("没有读取到 suggestion 或可用文本。");
    if (!Array.isArray(rawSuggestion.specialHands) || !rawSuggestion.specialHands.length) {
      rawSuggestion.specialHands = buildDuelAiTextFallbackSpecialHands(rawText, rawSuggestion);
    }
    const suggestion = normalizeDuelAiSuggestion(rawSuggestion, parsed.generatedTerms);
    if (!suggestion || !suggestion.specialHands?.length) throw new Error("没有读取到可用 specialHands。");
    applyDuelAiSuggestion(suggestion);
    renderDuelAiOutput(`已读取手动数据并回填角色卡。\n\n${suggestion.notes || ""}`.trim());
    updateDuelAiStatus("手动数据已读取并回填。");
    if (els.duelManualDataStatus) {
      els.duelManualDataStatus.textContent = "已读取。";
      els.duelManualDataStatus.classList.remove("error-text");
    }
  } catch (error) {
    const message = error?.message || "手动数据解析失败。";
    updateDuelAiStatus(message, true);
    if (els.duelManualDataStatus) {
      els.duelManualDataStatus.textContent = message;
      els.duelManualDataStatus.classList.add("error-text");
    }
  }
}

function readCustomDuelDraftForm() {
  const stats = { ...DUEL_DEFAULT_CUSTOM_STATS };
  els.duelCustomRankSelects?.forEach((select) => {
    const stat = select.dataset.duelCustomRank;
    if (!stat) return;
    stats[stat] = DUEL_RANKS.includes(select.value) ? select.value : (DUEL_DEFAULT_CUSTOM_STATS[stat] || "B");
  });
  const librarySelection = readDuelLibrarySelection();
  return {
    name: trimUtf8Bytes(normalizeCustomDuelText(els.duelCustomName?.value || ""), DUEL_CUSTOM_NAME_MAX_BYTES),
    visibleGrade: els.duelCustomGrade?.value || "grade2",
    stage: getValidDuelStage(els.duelCustomStage?.value || "custom"),
    techniquePower: els.duelCustomTechniquePower?.value || "B",
    technique: trimUtf8Bytes(mergeDuelLocalList(splitCustomDuelList(els.duelCustomTechnique?.value || ""), librarySelection.techniques).join("、"), DUEL_CUSTOM_TECHNIQUE_MAX_BYTES),
    domain: trimUtf8Bytes(mergeDuelLocalList(splitCustomDuelList(els.duelCustomDomain?.value || ""), librarySelection.domains).join("、"), DUEL_CUSTOM_DOMAIN_MAX_BYTES),
    tools: splitCustomDuelList(els.duelCustomTools?.value || ""),
    traits: mergeDuelLocalList(splitCustomDuelList(els.duelCustomTraits?.value || ""), librarySelection.advanced),
    mechanismTags: readSelectedDuelDefinitionValues(els.duelCustomMechanisms),
    toolTags: readSelectedDuelDefinitionValues(els.duelCustomToolTags),
    externalResource: mergeDuelLocalList(splitCustomDuelList(els.duelCustomResource?.value || ""), librarySelection.resources).join("、"),
    notes: normalizeCustomDuelText(els.duelCustomNotes?.value || ""),
    librarySelection,
    stats
  };
}

function buildDuelCharacterAssistPayload(description, draft) {
  return {
    schema: "jjk-duel-assist-request",
    version: 1,
    buildVersion: APP_BUILD_VERSION,
    mode: "characterBuild",
    language: "zh-CN",
    description,
    draft,
    allowedRanks: DUEL_RANKS,
    allowedGrades: DUEL_GRADE_OPTIONS.map((item) => ({ value: item.value, label: item.label })),
    allowedStages: DUEL_STAGE_OPTIONS.map((item) => ({ value: item.value, label: item.label })),
    generatedTermTemplates: getDuelGeneratedTermTemplatesForAi(),
    customSpecialTerms: getDuelSpecialTermsForAi(),
    mechanismHints: {
      cursedTools: (state.mechanisms?.cursedTools || []).slice(0, 12).map((item) => item.displayName || item.id),
      mechanisms: (state.mechanisms?.mechanisms || []).slice(0, 18).map((item) => item.displayName || item.id)
    }
  };
}

function getDuelGeneratedTermTemplatesForAi() {
  return [
    { category: "survival", calculationTemplate: "survivalWindow", params: ["rounds"] },
    { category: "growth", calculationTemplate: "stableGrowthScaling", params: [] },
    { category: "curseAgeGrowth", calculationTemplate: "curseAgeGrowthScaling", params: ["ageYears"] },
    { category: "domainSpecialty", calculationTemplate: "domainSpecialty", params: [] },
    { category: "techniqueDisruption", calculationTemplate: "techniqueDisruption", params: [] },
    { category: "bodyBoost", calculationTemplate: "bodyBoost", params: [] },
    { category: "resourceStock", calculationTemplate: "resourceStock", params: ["stock"] },
    { category: "burstWindow", calculationTemplate: "burstWindow", params: ["rounds"] },
    { category: "recovery", calculationTemplate: "recovery", params: [] },
    { category: "specialWeakness", calculationTemplate: "specialWeakness", params: [] }
  ];
}

async function requestDuelAiAssistWithFallback(payload, options = {}) {
  const failures = [];
  assertLoginCardForAi();
  assertAiDailyQuotaAvailable();
  if (getAiProviderMode() === "off") {
    const localOnly = buildLocalDuelAssistFallback(payload, [`mode:${getAiProviderMode()}`]);
    if (localOnly) return localOnly;
  }
  try {
    return await requestDuelAiAssist("", payload);
  } catch (error) {
    if (error?.reasonCode === "daily-quota-exceeded") throw error;
    failures.push(error?.message || String(error || "AI Provider failed"));
    if (options.requireRemote && getAiProviderMode() !== "off") throw error;
  }
  const localFallback = buildLocalDuelAssistFallback(payload, failures);
  if (localFallback) return localFallback;
  throw new Error(failures.join("；") || "AI服务不可用。");
}

async function requestDuelAiAssist(endpoint, payload) {
  const templateId = payload?.mode === "characterBuild" ? "duel_character_assist" : "battle_narration";
  const data = await requestAiGoverned(templateId, payload, {
    timeoutMs: templateId === "duel_character_assist" ? DUEL_AI_CHARACTER_TIMEOUT_MS : AI_REQUEST_TIMEOUT_MS,
    preflightTimeoutMs: AI_PROVIDER_PREFLIGHT_TIMEOUT_MS,
    throwOnRemoteFailure: templateId === "duel_character_assist",
    localFallbackText: buildLocalAiFallbackText(templateId, payload)
  });
  if (payload?.mode === "characterBuild") logDuelAiRawResponse("duel-character-assist-provider", data);
  const parsedData = payload?.mode === "characterBuild" ? parseDuelAiStructuredJson(data) : data;
  if (payload?.mode === "battleNarrative" && !data.battleText && (data.text || data.markdown)) {
    data.battleText = data.text || data.markdown;
  }
  if (payload?.mode === "characterBuild" && !parsedData.suggestion && !parsedData.cardSuggestion) {
    const looseSuggestion = buildLooseDuelAiSuggestionFromText(getDuelAiRawText(data), payload?.draft || {});
    if (looseSuggestion?.specialHands?.length) {
      return {
        ...parsedData,
        suggestion: looseSuggestion,
        analysis: parsedData.analysis || "模型没有返回严格 JSON，已从原始文本降级提取作战建议。",
        warnings: Array.isArray(parsedData.warnings) ? parsedData.warnings : ["远程返回不是严格 JSON，建议检查手动输入数据。"]
      };
    }
    if (!data.localFallback) {
      throw createAiProviderError("模型返回了非 JSON，或 JSON 缺少 suggestion 字段。", {
        reasonCode: "invalid-structured-json",
        stage: "response-parse",
        providerId: data.provider,
        model: data.model,
        sample: String(data.text || data.markdown || "").slice(0, 220)
      });
    }
    const fallback = buildLocalDuelAssistFallback(payload, [data.fallbackReason || "AI did not return structured suggestion"]);
    if (fallback) return fallback;
  }
  return parsedData;
}

function getDuelAiRawText(data) {
  if (!data || typeof data !== "object") return "";
  return String(data.text || data.markdown || data.rawText || data.content || "").trim();
}

function logDuelAiRawResponse(label, data) {
  try {
    const rawText = getDuelAiRawText(data);
    console.info("[JJK][AI raw response]", {
      label,
      provider: data?.provider || "",
      model: data?.model || "",
      localFallback: Boolean(data?.localFallback),
      text: rawText,
      data
    });
  } catch {
    // Console logging must never break AI parsing.
  }
}

function parseDuelAiStructuredJson(data) {
  if (!data || typeof data !== "object") return {};
  if (data.suggestion || data.cardSuggestion) return data;
  const text = String(data.text || data.markdown || "").trim();
  if (!text) return data;
  const cleaned = extractDuelAiJsonText(text);
  try {
    const parsed = JSON.parse(cleaned);
    return {
      ...data,
      ...parsed,
      text: data.text,
      markdown: data.markdown
    };
  } catch (error) {
    return {
      ...data,
      structuredParseError: error?.message || "invalid-json"
    };
  }
}

function extractDuelAiJsonText(text) {
  const source = String(text || "").trim();
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : source).trim();
  if (candidate.startsWith("{") && candidate.endsWith("}")) return candidate;
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first >= 0 && last > first) return candidate.slice(first, last + 1);
  return candidate;
}

function buildLooseDuelAiSuggestionFromText(text, draft = {}) {
  const source = normalizeCustomDuelLongText(text || "");
  if (!source) return null;
  const hands = buildDuelAiTextFallbackSpecialHands(source, draft);
  return {
    name: normalizeCustomDuelText(draft.name || "") || "",
    visibleGrade: draft.visibleGrade || "grade2",
    stage: draft.stage || "custom",
    techniquePower: draft.techniquePower || "B",
    technique: normalizeCustomDuelText(draft.technique || ""),
    domainProfile: normalizeCustomDuelText(draft.domain || ""),
    loadout: Array.isArray(draft.tools) ? draft.tools.slice(0, 8) : [],
    innateTraits: Array.isArray(draft.traits) ? draft.traits.slice(0, 8) : [],
    externalResource: normalizeCustomDuelText(draft.externalResource || ""),
    notes: source.slice(0, 720),
    baseStats: { ...(draft.stats || DUEL_DEFAULT_CUSTOM_STATS) },
    specialHands: hands,
    generatedTerms: []
  };
}

function buildDuelAiTextFallbackSpecialHands(text, context = {}) {
  const source = normalizeCustomDuelLongText(text || "");
  if (!source) return [];
  const lines = source
    .split(/\n+|(?:\d+[\.\、])|(?:[-*]\s+)/)
    .map((line) => normalizeCustomDuelText(line.replace(/^#+\s*/, "").replace(/\*\*/g, "")))
    .filter((line) => line && !/^作战建议|suggestion$/i.test(line))
    .slice(0, 12);
  const candidates = lines.length ? lines : [source];
  const seen = new Set();
  return candidates
    .map((line, index) => {
      const rawName = line.split(/[：:]/)[0] || line;
      const name = normalizeCustomDuelText(rawName)
        .replace(/^(技能优先级|风险规避|领域战术|特殊战术|建议|战术)\s*/g, "")
        .slice(0, 12) || `作战手札${index + 1}`;
      if (seen.has(name)) return null;
      seen.add(name);
      const type = /防御|规避|预留|回避|护盾|保护/.test(line)
        ? "defense"
        : /领域|必中|结界/.test(line)
          ? "domain"
          : /资源|召唤|库存|咒灵|式神|回复|预留/.test(line)
            ? "resource"
            : /优先|辅助|干扰|压制|战术/.test(line)
              ? "technique"
              : "attack";
      const risk = /核爆|自毁|牺牲|禁|无法再使用|最后/.test(line) ? "critical" : (/高消耗|领域|围困/.test(line) ? "high" : "medium");
      const damage = type === "attack" ? 16 : (type === "technique" || type === "domain" ? 12 : 0);
      const block = type === "defense" ? 18 : 0;
      return {
        id: `ai-text-fallback-${index + 1}`,
        name,
        type,
        risk,
        apCost: type === "domain" ? 2 : 1,
        ceCost: type === "domain" ? 34 : (risk === "critical" ? 36 : 22),
        damage,
        block,
        stabilityDelta: type === "defense" ? 8 : 0,
        domainLoadDelta: type === "domain" ? 12 : 0,
        summary: line.slice(0, 140),
        tags: ["自定义", "AI文本提取"],
        source: "ai_text_fallback"
      };
    })
    .filter(Boolean)
    .slice(0, 4);
}

function buildLocalDuelAssistFallback(payload, failures = []) {
  if (payload?.mode === "characterBuild") return buildLocalDuelCharacterAssist(payload, failures);
  if (payload?.mode === "battleNarrative") return buildLocalDuelBattleNarrativeAssist(payload, failures);
  return null;
}

function buildLocalDuelCharacterAssist(payload, failures = []) {
  const draft = payload.draft || {};
  const sourceText = normalizeCustomDuelLongText([
    payload.description,
    draft.name,
    draft.visibleGrade,
    draft.techniquePower,
    draft.technique,
    draft.domain,
    ...(draft.tools || []),
    ...(draft.traits || []),
    draft.externalResource,
    draft.notes
  ].filter(Boolean).join(" "));
  if (!sourceText) return null;

  const suggestion = {
    name: inferLocalDuelName(payload.description, draft.name),
    visibleGrade: inferLocalDuelGrade(sourceText, draft.visibleGrade),
    stage: getValidDuelStage(draft.stage || inferLocalDuelStage(sourceText)),
    techniquePower: inferLocalDuelTechniquePower(sourceText, draft.techniquePower),
    technique: draft.technique || inferLocalDuelTechnique(sourceText),
    domainProfile: draft.domain || inferLocalDuelDomain(sourceText),
    loadout: mergeDuelLocalList(draft.tools, inferLocalDuelTools(sourceText)),
    innateTraits: mergeDuelLocalList(draft.traits, inferLocalDuelTraits(sourceText, payload.customSpecialTerms)),
    externalResource: draft.externalResource || inferLocalDuelExternalResource(sourceText),
    notes: mergeLocalDuelNotes(draft.notes, failures),
    generatedTerms: inferLocalDuelGeneratedTerms(sourceText),
    specialHands: [],
    baseStats: inferLocalDuelBaseStats(sourceText, draft.stats || {})
  };

  return {
    localFallback: true,
    provider: "local-rule-fallback",
    model: "keyword-duel-assist-v1",
    suggestion,
    analysis: "远程 AI 解析线路不可用，已按本地关键词规则回填。该结果可参与战力计算，但复杂原创设定仍建议人工复核。"
  };
}

function inferLocalDuelName(description, draftName) {
  const existing = normalizeCustomDuelText(draftName || "");
  if (existing) return existing;
  const text = normalizeCustomDuelText(description || "");
  const named = text.match(/(?:名字|姓名|角色|名为|叫做)[:：]?\s*([\u4e00-\u9fa5A-Za-z0-9·（）()]{2,16})/);
  if (named) return normalizeCustomDuelText(named[1]);
  const firstSegment = normalizeCustomDuelText(text.split(/[，,。；;\s]/)[0] || "");
  if (firstSegment && firstSegment.length <= 12 && !/^(他|她|它|这个|该|一名|一个|某个)$/.test(firstSegment)) return firstSegment;
  return "本地解析角色";
}

function inferLocalDuelGrade(text, draftGrade) {
  if (/特级|宿傩|五条|乙骨|九十九|夏油|羂索|里香|漏瑚|真人|花御|陀艮|石流|乌鹭|鹿紫云/.test(text)) return "specialGrade";
  if (/超一级|特别一级|准一级|一级/.test(text)) return "grade1";
  if (/二级/.test(text)) return "grade2";
  if (/三级/.test(text)) return "grade3";
  if (/四级/.test(text)) return "grade4";
  return DUEL_GRADE_OPTIONS.some((item) => item.value === draftGrade) ? draftGrade : "grade2";
}

function inferLocalDuelStage(text) {
  if (/68年后|六十八年后|after68|外传/.test(text)) return "after68";
  if (/新宿|决战/.test(text)) return "shinjuku";
  if (/涩谷|涉谷/.test(text)) return "shibuya";
  if (/死灭回游|泳者|culling/i.test(text)) return "cullingGame";
  if (/怀玉|星浆体/.test(text)) return "hiddenInventory";
  if (/0卷|百鬼夜行/.test(text)) return "volume0";
  if (/平安|古代|千年前/.test(text)) return "heianToShinjuku";
  return "custom";
}

function getValidDuelStage(stage) {
  return DUEL_STAGE_OPTIONS.some((item) => item.value === stage) ? stage : "custom";
}

function inferLocalDuelTechniquePower(text, draftPower) {
  if (/宿傩|五条|六眼|无下限|无限|无量空处|伏魔御厨子|世界斩|魔虚罗|十种影法术|纯爱|里香|复制|星怒|咒灵操术|无为转变/.test(text)) return "SSS";
  if (/特级|领域|反转术式|极之番|术式反转|领域展延/.test(text)) return "SS";
  if (/一级|黑闪|简易领域|赤血操术|构筑术式/.test(text)) return "S";
  return DUEL_RANKS.includes(draftPower) ? draftPower : "B";
}

function inferLocalDuelTechnique(text) {
  if (/无下限|无限|六眼/.test(text)) return "无下限术式";
  if (/十种影法术|魔虚罗/.test(text)) return "十种影法术";
  if (/宿傩|御厨子|伏魔御厨子|世界斩/.test(text)) return "御厨子";
  if (/咒灵操术|咒灵库/.test(text)) return "咒灵操术";
  if (/复制|里香|纯爱/.test(text)) return "复制";
  if (/无为转变|真人/.test(text)) return "无为转变";
  if (/星怒|九十九/.test(text)) return "星怒";
  if (/反重力/.test(text)) return "反重力机构";
  if (/赤血操术|血液/.test(text)) return "赤血操术";
  if (/构筑术式|构筑/.test(text)) return "构筑术式";
  return "";
}

function inferLocalDuelDomain(text) {
  if (/无量空处/.test(text)) return "无量空处";
  if (/伏魔御厨子/.test(text)) return "伏魔御厨子";
  if (/自闭圆顿裹/.test(text)) return "自闭圆顿裹";
  if (/三重疾苦/.test(text)) return "三重疾苦";
  if (/领域/.test(text)) return "自定义领域";
  return "";
}

function inferLocalDuelTools(text) {
  const tools = [];
  if (/天逆鉾|天逆矛/.test(text)) tools.push("天逆鉾");
  if (/游云/.test(text)) tools.push("游云");
  if (/释魂刀|魂释刀/.test(text)) tools.push("释魂刀");
  if (/万里锁/.test(text)) tools.push("万里锁");
  if (/黑绳/.test(text)) tools.push("黑绳");
  if (/咒具/.test(text) && tools.length === 0) tools.push("自定义咒具");
  return tools;
}

function inferLocalDuelTraits(text, customSpecialTerms = []) {
  const traits = [];
  if (/六眼/.test(text)) traits.push("六眼");
  if (/无下限|无限/.test(text)) traits.push("无下限核心");
  if (/反转术式/.test(text)) traits.push("反转术式");
  if (/领域展延/.test(text)) traits.push("领域展延");
  if (/简易领域/.test(text)) traits.push("简易领域");
  if (/弥虚葛笼|彌虚葛籠| hollow wicker/i.test(text)) traits.push("弥虚葛笼");
  if (/黑闪/.test(text)) traits.push("黑闪");
  if (/天与暴君|零咒力|天与咒缚/.test(text)) traits.push("天与咒缚");
  if (/魔虚罗|适应/.test(text)) traits.push("魔虚罗适应");
  if (/世界斩/.test(text)) traits.push("世界斩");
  if (/束缚/.test(text)) traits.push("束缚");
  for (const term of customSpecialTerms || []) {
    const name = normalizeCustomDuelText(term.name || "");
    if (name && text.includes(name)) traits.push(name);
  }
  return traits;
}

function inferLocalDuelGeneratedTerms(text) {
  const terms = [];
  if (/耐活|锁血|不会死亡|不会死|不结算死亡/.test(text)) {
    terms.push({
      name: "耐活",
      category: "survival",
      rounds: 3,
      params: { rounds: 3 },
      calculationTemplate: "survivalWindow",
      definition: "在标注回合数内，即使承受足以结束战斗的攻击，也先表现为狼狈和重创，不直接结算死亡。"
    });
  }
  if (/僵尸|尸体操控|尸体|尸群/.test(text)) {
    terms.push({
      name: "僵尸军团",
      category: "resourceStock",
      params: {},
      calculationTemplate: "resourceStock",
      definition: "以可消耗尸体或僵尸群承担进攻、干扰和换命消耗，提供资源型扰动，但单体质量仍受角色操控能力限制。"
    });
  }
  if (/千年|百年|古老咒灵|长期存活|越活越强|实力.*增长|咒力.*增长/.test(text)) {
    terms.push({
      name: "长期存活成长",
      category: "curseAgeGrowth",
      params: inferDuelAgeGrowthParams(text),
      calculationTemplate: "curseAgeGrowthScaling",
      definition: "长期存活带来咒力沉淀、战斗经验和资源积累；作为稳定成长补正，不直接替代显性等级。"
    });
  }
  return terms;
}

function inferDuelAgeGrowthParams(text) {
  const match = String(text || "").match(/(\d{2,4})\s*年/);
  const ageYears = match ? Number(match[1]) : /千年/.test(text) ? 1000 : null;
  return Number.isFinite(ageYears) ? { ageYears } : {};
}

function inferLocalDuelExternalResource(text) {
  if (/里香|纯爱/.test(text)) return "里香资源";
  if (/咒灵操术|咒灵库/.test(text)) return "咒灵库";
  if (/魔虚罗|十种影法术|式神/.test(text)) return "式神资源";
  return "";
}

function inferLocalDuelBaseStats(text, draftStats = {}) {
  const stats = { ...DUEL_DEFAULT_CUSTOM_STATS, ...draftStats };
  if (/特级|领域|反转术式/.test(text)) {
    raiseLocalDuelRank(stats, "cursedEnergy", "S");
    raiseLocalDuelRank(stats, "control", "S");
    raiseLocalDuelRank(stats, "efficiency", "A");
    raiseLocalDuelRank(stats, "talent", "S");
  }
  if (/六眼/.test(text)) {
    raiseLocalDuelRank(stats, "control", "SSS");
    raiseLocalDuelRank(stats, "efficiency", "SSS");
    raiseLocalDuelRank(stats, "talent", "SS");
  }
  if (/无下限|无限|无量空处|顶级领域|顶尖领域|最高级领域/.test(text)) {
    raiseLocalDuelRank(stats, "control", "SSS");
    raiseLocalDuelRank(stats, "efficiency", "SSS");
    raiseLocalDuelRank(stats, "talent", "SS");
  }
  if (/宿傩|双面|四臂|伏魔御厨子|御厨子|世界斩/.test(text)) {
    raiseLocalDuelRank(stats, "cursedEnergy", "SSS");
    raiseLocalDuelRank(stats, "control", "SSS");
    raiseLocalDuelRank(stats, "efficiency", "SSS");
    raiseLocalDuelRank(stats, "body", "SSS");
    raiseLocalDuelRank(stats, "martial", "SSS");
    raiseLocalDuelRank(stats, "talent", "SSS");
  }
  if (/天与暴君|零咒力/.test(text)) {
    stats.cursedEnergy = "E-";
    stats.control = "E-";
    stats.efficiency = "E-";
    raiseLocalDuelRank(stats, "body", "SSS");
    raiseLocalDuelRank(stats, "martial", "SSS");
    raiseLocalDuelRank(stats, "talent", "S");
  }
  if (/肉体|体质|近战|体术|黑闪/.test(text)) {
    raiseLocalDuelRank(stats, "body", "S");
    raiseLocalDuelRank(stats, "martial", "S");
  }
  return stats;
}

function raiseLocalDuelRank(stats, key, rank) {
  if (!DUEL_RANKS.includes(rank)) return;
  const current = DUEL_RANKS.indexOf(stats[key]);
  const next = DUEL_RANKS.indexOf(rank);
  if (next > current) stats[key] = rank;
}

function mergeDuelLocalList(primary = [], fallback = []) {
  const seen = new Set();
  return [...(primary || []), ...(fallback || [])]
    .map(normalizeCustomDuelText)
    .filter((item) => {
      if (!item || seen.has(item)) return false;
      seen.add(item);
      return true;
    })
    .slice(0, 12);
}

function mergeLocalDuelNotes(existing, failures = []) {
  const notes = [existing, "本地规则解析：远程 AI 线路不可用时的保底回填，建议人工复核复杂设定。"].filter(Boolean);
  if (state.debugMode && failures.length) notes.push(`线路失败：${failures.join("；")}`);
  return normalizeCustomDuelText(notes.join(" "));
}

function buildLocalDuelBattleNarrativeAssist(payload, failures = []) {
  const battle = payload.battle || {};
  const winner = normalizeCustomDuelText(battle.winnerName || "胜者");
  const left = battle.left?.name || "左方";
  const right = battle.right?.name || "右方";
  const log = Array.isArray(battle.log) ? battle.log.slice(0, 3) : [];
  const leftHooks = buildDuelProfileCombatHooks(battle.left || {});
  const rightHooks = buildDuelProfileCombatHooks(battle.right || {});
  const context = [
    leftHooks.primary ? `${left}以${leftHooks.primary}作为主轴` : "",
    rightHooks.primary ? `${right}以${rightHooks.primary}应对` : "",
    battle.roundRule ? `本局按${battle.roundRule}推进` : ""
  ].filter(Boolean).join("，");
  const logText = log.map((entry) => `${entry.title || `第${entry.round || "?"}回合`}：${entry.detail || ""}`).join("；");
  const debugTail = state.debugMode && failures.length ? ` 线路失败：${failures.join("；")}` : "";
  return {
    localFallback: true,
    provider: "local-rule-fallback",
    model: "keyword-duel-assist-v1",
    battleText: `${left} 对 ${right} 的交战按当前阶段记录结算，${winner} 获胜。${context ? `${context}。` : ""}${logText || "胜负来自既有术式、领域、咒具资源与相性变化。"}${debugTail}`
  };
}

function normalizeDuelAiSuggestion(raw, externalGeneratedTerms = []) {
  if (!raw || typeof raw !== "object") return null;
  const baseStats = raw.baseStats && typeof raw.baseStats === "object" ? raw.baseStats : {};
  const generatedTerms = normalizeDuelGeneratedTerms(raw.generatedTerms || raw.mechanicDefinitions || externalGeneratedTerms);
  const specialHands = normalizeDuelAiSpecialHands(raw.specialHands || raw.specialHandCards || raw.cards || [], raw);
  const normalizedStats = {};
  for (const key of Object.keys(DUEL_DEFAULT_CUSTOM_STATS)) {
    normalizedStats[key] = DUEL_RANKS.includes(baseStats[key]) ? baseStats[key] : (DUEL_DEFAULT_CUSTOM_STATS[key] || "B");
  }
  const visibleGrade = DUEL_GRADE_OPTIONS.some((item) => item.value === raw.visibleGrade) ? raw.visibleGrade : "grade2";
  const techniquePower = DUEL_RANKS.includes(raw.techniquePower) ? raw.techniquePower : "B";
  return {
    name: trimUtf8Bytes(normalizeCustomDuelText(raw.name || raw.displayName || ""), DUEL_CUSTOM_NAME_MAX_BYTES),
    visibleGrade,
    stage: getValidDuelStage(raw.stage || ""),
    techniquePower,
    technique: trimUtf8Bytes(normalizeCustomDuelText(raw.technique || raw.techniqueName || ""), DUEL_CUSTOM_TECHNIQUE_MAX_BYTES),
    domain: trimUtf8Bytes(normalizeCustomDuelText(raw.domainProfile || raw.domain || ""), DUEL_CUSTOM_DOMAIN_MAX_BYTES),
    tools: Array.isArray(raw.loadout) ? raw.loadout.map(normalizeCustomDuelText).filter(Boolean).slice(0, 12) : splitCustomDuelList(raw.tools || ""),
    traits: Array.isArray(raw.innateTraits) ? raw.innateTraits.map(normalizeCustomDuelText).filter(Boolean).slice(0, 12) : splitCustomDuelList(raw.traits || ""),
    externalResource: normalizeCustomDuelText(raw.externalResource || ""),
    notes: normalizeCustomDuelText(raw.notes || ""),
    generatedTerms,
    domainScript: normalizeDuelAiDomainScript(raw.domainScript),
    specialHands,
    stats: normalizedStats
  };
}

function normalizeDuelAiDomainScript(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const serialized = JSON.stringify(raw);
  if (/\b(function|eval|new Function|=>|<script)\b/i.test(serialized)) return null;
  const allowedScriptTypes = new Set([
    "sure_hit",
    "auto_attack",
    "self_buff",
    "technique_buff",
    "soul_pressure",
    "hard_control",
    "rule_trial_execution",
    "jackpot_rule",
    "placeholder_damage"
  ]);
  const scriptType = allowedScriptTypes.has(String(raw.scriptType || "")) ? String(raw.scriptType) : "placeholder_damage";
  return {
    ...raw,
    id: normalizeCustomDuelText(raw.id || `ai_domain_${Date.now().toString(36)}`).toLowerCase().replace(/[^a-z0-9_-]+/g, "_"),
    language: "json-rule-v1",
    scriptType,
    activation: normalizeCustomDuelText(raw.activation || "onDomainResolved"),
    blockedBy: Array.isArray(raw.blockedBy) ? raw.blockedBy.map(normalizeCustomDuelText).filter(Boolean).slice(0, 12) : [
      "domain_clash",
      "simple_domain_guard",
      "hollow_wicker_basket_guard"
    ],
    source: "ai"
  };
}

const RISK_TAG_VALUES = new Set(["low", "medium", "high", "critical", "extreme"]);

function getDuelAiCharacterNameTag(context) {
  const name = normalizeCustomDuelText(context?.name || context?.displayName || "").slice(0, 20);
  return name ? `角色:${name}` : "";
}

function inferDuelAiSpecialHandMechanismTags(cardType, text) {
  const tags = [];
  const source = `${cardType} ${text || ""}`;
  if (/domain|领域/.test(source)) tags.push("领域");
  if (/counter|反击|应对/.test(source)) tags.push("反击");
  if (/defense|防御|护盾|格挡/.test(source)) tags.push("防御");
  if (/resource|资源|库存|召唤|式神|咒灵/.test(source)) tags.push("资源");
  if (/attack|damage|斩|打击|攻击|伤害/.test(source)) tags.push("攻击");
  if (/support|辅助|恢复|增益/.test(source)) tags.push("支援");
  return tags;
}

function filterDuelAiSpecialHandTags(tags = [], context = {}) {
  const characterTag = getDuelAiCharacterNameTag(context);
  const seen = new Set();
  return [characterTag, ...tags]
    .map(normalizeCustomDuelText)
    .filter((tag) => {
      const normalized = String(tag || "").trim();
      const lower = normalized.toLowerCase();
      if (!normalized || RISK_TAG_VALUES.has(lower) || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .slice(0, 14);
}

function normalizeDuelAiSpecialHands(rawHands = [], context = {}) {
  const source = Array.isArray(rawHands) ? rawHands : [];
  const allowedTypes = new Set(["attack", "technique", "ce_burst", "defense", "domain", "support", "resource", "counter", "rule", "soul_pressure"]);
  const allowedAccuracyProfiles = new Set(["melee", "weapon", "technique_projectile", "technique_area", "unavoidable", "none"]);
  const riskMap = { extreme: "critical", critical: "critical", high: "high", medium: "medium", low: "low" };
  const seen = new Set();
  return source
    .map((hand, index) => {
      if (!hand || typeof hand !== "object") return null;
      const name = normalizeCustomDuelText(hand.name || hand.label || "").slice(0, 40);
      if (!name) return null;
      const type = normalizeCustomDuelText(hand.type || hand.cardType || "technique").toLowerCase();
      const cardType = allowedTypes.has(type) ? type : "technique";
      const idSource = normalizeCustomDuelText(hand.id || `ai-special-hand-${index + 1}`).toLowerCase();
      const id = idSource.replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || `ai-special-hand-${index + 1}`;
      if (seen.has(id)) return null;
      seen.add(id);
      const apCost = clamp(Math.round(Number(hand.apCost ?? hand.ap ?? 1) || 1), 0, 9);
      const ceCost = clamp(Math.round(Number(hand.ceCost ?? hand.cost ?? 10) || 10), 0, 999);
      const damage = clamp(Math.round(Number(hand.damage ?? hand.baseDamage ?? 0) || 0), 0, 999);
      const block = clamp(Math.round(Number(hand.block ?? hand.baseBlock ?? 0) || 0), 0, 999);
      const stabilityDelta = clamp(Math.round(Number(hand.stabilityDelta ?? hand.stability ?? 0) || 0), -100, 100);
      const domainLoadDelta = clamp(Math.round(Number(hand.domainLoadDelta ?? hand.domainLoad ?? 0) || 0), -999, 999);
      const summary = normalizeCustomDuelText(hand.summary || hand.description || `${name}：AI 生成特殊手札。`);
      const rawAccuracyProfile = normalizeCustomDuelText(hand.accuracyProfile || hand.accuracy || "").toLowerCase();
      const inferredAccuracyProfile = cardType === "attack"
        ? "melee"
        : cardType === "defense" || cardType === "support" || cardType === "resource"
          ? "none"
          : cardType === "domain" || cardType === "rule"
            ? "unavoidable"
            : "technique_projectile";
      const accuracyProfile = allowedAccuracyProfiles.has(rawAccuracyProfile) ? rawAccuracyProfile : inferredAccuracyProfile;
      const evasionAllowed = typeof hand.evasionAllowed === "boolean"
        ? hand.evasionAllowed
        : (damage > 0 && !["unavoidable", "none"].includes(accuracyProfile));
      const hitRateModifier = clamp(Number(hand.hitRateModifier ?? hand.accuracyModifier ?? 0) || 0, -0.5, 0.5);
      const onMissSource = hand.onMiss && typeof hand.onMiss === "object" ? hand.onMiss : {};
      const onMiss = {
        damageScale: clamp(Number(onMissSource.damageScale ?? (accuracyProfile === "technique_area" ? 0.38 : accuracyProfile === "technique_projectile" ? 0.12 : 0)) || 0, 0, 1),
        ceDamageScale: clamp(Number(onMissSource.ceDamageScale ?? (accuracyProfile === "technique_area" ? 0.45 : accuracyProfile === "technique_projectile" ? 0.2 : 0)) || 0, 0, 1),
        stabilityScale: clamp(Number(onMissSource.stabilityScale ?? (accuracyProfile === "technique_area" ? 0.45 : accuracyProfile === "technique_projectile" ? 0.2 : 0)) || 0, 0, 1),
        keepCard: Boolean(onMissSource.keepCard)
      };
      const rawTags = Array.isArray(hand.tags) ? hand.tags.map(normalizeCustomDuelText).filter(Boolean).slice(0, 12) : splitCustomDuelList(hand.tags || "");
      const tags = filterDuelAiSpecialHandTags([
        "自定义",
        "特殊手札",
        "AI生成",
        ...inferDuelAiSpecialHandMechanismTags(cardType, `${name} ${summary}`),
        ...rawTags
      ], context);
      return {
        id,
        label: name,
        name,
        description: summary,
        cardType,
        apCost,
        baseCeCost: ceCost,
        ceCost,
        costType: "flat",
        cost: { flatCe: ceCost, minCe: ceCost },
        baseDamage: damage,
        baseBlock: block,
        baseStabilityRestore: Math.max(0, stabilityDelta),
        baseDomainLoadDelta: domainLoadDelta,
        durationRounds: 1,
        damageType: typeof inferCustomHandDamageType === "function" ? inferCustomHandDamageType(cardType) : (cardType === "defense" ? "none" : "technique"),
        scalingProfile: typeof inferCustomHandScalingProfile === "function" ? inferCustomHandScalingProfile(cardType) : "balanced",
        accuracyProfile,
        evasionAllowed,
        hitRateModifier,
        onMiss,
        rarity: "special",
        weight: 1,
        allowedContexts: ["normal", "domain", "trial_allowed"],
        effects: {
          stabilityDelta: Number((stabilityDelta / 100).toFixed(4)),
          domainLoadDelta,
          weightDeltas: typeof buildCustomHandWeightDeltas === "function" ? buildCustomHandWeightDeltas(cardType, damage, block) : {}
        },
        effectSummary: summary,
        risk: riskMap[String(hand.risk || "medium").trim().toLowerCase()] || "medium",
        tags,
        logTemplate: summary,
        source: normalizeCustomDuelText(hand.source || "ai")
      };
    })
    .filter(Boolean)
    .slice(0, 6);
}

function normalizeDuelGeneratedTerms(rawTerms = []) {
  const source = Array.isArray(rawTerms) ? rawTerms : [];
  const seen = new Set();
  return source
    .map((term) => {
      const name = normalizeCustomDuelText(term?.name || term?.title || "").slice(0, 30);
      const category = normalizeDuelGeneratedTermCategory(term?.category || term?.type || "");
      const calculationTemplate = normalizeDuelCalculationTemplate(term?.calculationTemplate || term?.template, category);
      const definition = normalizeCustomDuelLongText(term?.definition || term?.description || "").slice(0, 360);
      const params = normalizeDuelGeneratedTermParams(term?.params || {}, term);
      const roundsNumber = parseOptionalDuelNumber(params.rounds ?? term?.rounds ?? term?.roundCount, 1, DUEL_SPECIAL_TERM_MAX_ROUNDS);
      const rounds = roundsNumber == null ? null : Math.round(roundsNumber);
      const tags = inferDuelSpecialTermTags(name, `${category} ${calculationTemplate} ${definition}`);
      return {
        name,
        category,
        definition,
        rounds,
        params: { ...params, ...(rounds ? { rounds } : {}) },
        calculationTemplate,
        source: normalizeCustomDuelText(term?.source || "ai"),
        tags
      };
    })
    .filter((term) => {
      if (!term.name || !term.definition || seen.has(term.name)) return false;
      seen.add(term.name);
      if (term.tags.includes("survivalRounds") && !term.rounds) term.rounds = 3;
      return true;
    })
    .slice(0, 6);
}

function normalizeDuelGeneratedTermCategory(value) {
  const category = String(value || "").trim();
  const aliases = {
    domain: "domainSpecialty",
    disruption: "techniqueDisruption",
    weakness: "specialWeakness",
    burst: "burstWindow",
    growth: "growth",
    survival: "survival"
  };
  const normalized = aliases[category] || category;
  const allowed = new Set([
    "survival",
    "growth",
    "curseAgeGrowth",
    "domainSpecialty",
    "techniqueDisruption",
    "bodyBoost",
    "resourceStock",
    "burstWindow",
    "recovery",
    "specialWeakness"
  ]);
  return allowed.has(normalized) ? normalized : "growth";
}

function normalizeDuelCalculationTemplate(value, category) {
  const template = String(value || "").trim();
  const byCategory = {
    survival: "survivalWindow",
    growth: "stableGrowthScaling",
    curseAgeGrowth: "curseAgeGrowthScaling",
    domainSpecialty: "domainSpecialty",
    techniqueDisruption: "techniqueDisruption",
    bodyBoost: "bodyBoost",
    resourceStock: "resourceStock",
    burstWindow: "burstWindow",
    recovery: "recovery",
    specialWeakness: "specialWeakness"
  };
  const allowed = new Set(Object.values(byCategory));
  if (allowed.has(template)) return template;
  return byCategory[category] || "stableGrowthScaling";
}

function normalizeDuelGeneratedTermParams(params = {}, sourceTerm = {}) {
  const result = {};
  const rounds = parseOptionalDuelNumber(params.rounds ?? sourceTerm.rounds ?? sourceTerm.roundCount, 1, DUEL_SPECIAL_TERM_MAX_ROUNDS);
  if (rounds != null) result.rounds = Math.round(rounds);
  const ageYears = parseOptionalDuelNumber(params.ageYears ?? sourceTerm.ageYears, 1, 10000);
  if (ageYears != null) result.ageYears = Math.round(ageYears);
  const stock = parseOptionalDuelNumber(params.stock ?? params.count ?? sourceTerm.stock, 1, 9999);
  if (stock != null) result.stock = Math.round(stock);
  return result;
}

function addGeneratedDuelSpecialTerms(terms = []) {
  const normalized = normalizeDuelGeneratedTerms(terms);
  if (!normalized.length) return;
  let changed = false;
  for (const term of normalized) {
    const existing = state.duelSpecialTerms.find((item) => item.name === term.name);
    if (existing) {
      existing.definition = term.definition || existing.definition;
      existing.rounds = term.rounds || existing.rounds || null;
      existing.tags = Array.from(new Set([...(existing.tags || []), ...(term.tags || [])]));
      existing.source = existing.source || "ai";
      changed = true;
      continue;
    }
    state.duelSpecialTermSeq += 1;
    state.duelSpecialTerms.push({
      ...term,
      source: "ai",
      id: `duel_ai_term_${Date.now().toString(36)}_${state.duelSpecialTermSeq}`
    });
    changed = true;
  }
  if (!changed) return;
  state.duelBattle = null;
  renderDuelSpecialTermList();
  renderDuelMode();
}

function formatDuelGeneratedTermLine(term) {
  const category = term.category ? `/${term.category}` : "";
  const rounds = term.rounds ? `/${term.rounds}回合` : "";
  return `${term.name}${category}${rounds}`;
}

//--AI自由行动解析请求--//
async function requestAiFreeInfluenceForTask(task, actionText, anchorText) {
  assertLoginCardForAi();
  const payload = buildAiFreeAnalysisPayload(task, actionText, anchorText);
  const failures = [];
  const statuses = [];
  assertAiDailyQuotaAvailable();
  if (getAiProviderMode() === "off") {
    return buildLocalAiFreeInfluence(task, actionText, anchorText, [`mode:${getAiProviderMode()}`]);
  }
  try {
    const data = await requestAiFreeAnalysis("", payload);
    return normalizeRemoteAiFreeInfluence(data, task, actionText, anchorText);
  } catch (error) {
    if (error?.reasonCode === "daily-quota-exceeded") throw error;
    failures.push(error?.message || String(error || "AI Provider failed"));
    if (error?.status) statuses.push(error.status);
  }
  return buildLocalAiFreeInfluence(task, actionText, anchorText, failures, statuses);
}

function buildAiFreeAnalysisPayload(task, actionText, anchorText) {
  const wheel = getTaskWheel(task);
  const legalCandidates = wheel
    ? getWeightedOptions(wheel, task)
      .filter((item) => Number(item.weight) > 0)
      .slice(0, 24)
      .map((item) => ({
        index: item.index,
        text: item.text,
        weight: Number(item.weight || 0)
      }))
    : [];
  const strength = buildStrengthSnapshot();
  return {
    schema: "jjk-life-ai-free-analysis-request",
    version: 1,
    buildVersion: APP_BUILD_VERSION,
    language: "zh-CN",
    actionText: normalizeAiFreeText(actionText),
    anchorText: normalizeAiFreeText(anchorText),
    task: {
      nodeId: task?.nodeId || "",
      title: task?.title || "",
      stage: task?.stage || "",
      why: task?.why || ""
    },
    legalCandidates,
    selectedLegalResult: normalizeAiFreeText(anchorText),
    stateSummary: Object.fromEntries(getStateSummaryRows()),
    lifeState: buildAiLifeState(),
    capabilityLedger: buildAiCapabilityLedger(strength),
    strength: strength ? {
      resource: roundForPayload(strength.resource),
      control: roundForPayload(strength.control),
      body: roundForPayload(strength.body),
      growth: roundForPayload(strength.growth),
      abilityBuildBonus: roundForPayload(strength.abilityBuildBonus),
      gradeEffectiveScore: roundForPayload(strength.gradeEffectiveScore),
      gradeFloor: strength.gradeFloor,
      instantCombatProfile: strength.instantCombatProfile || null
    } : null,
    recentRecords: state.records.slice(-14).map((record) => ({
      id: record.id,
      nodeId: record.nodeId || "",
      title: record.title || "",
      stage: record.stage || "",
      result: record.result || "",
      selectionMode: record.selectionMode || "random",
      aiFreeInteraction: record.aiFreeInteraction || null,
      aiFreeInfluence: record.aiFreeInfluence || null,
      aiFreeBridge: record.aiFreeBridge || null
    })),
    allowedInfluenceKeys: AI_FREE_BIAS_KEYS.map((key) => ({
      key,
      displayName: getAiFreeInfluenceDisplayName(key),
      explanation: getAiFreeInfluenceExplanation(key)
    })),
    generationRules: [
      "AI自由解析必须只把玩家文字解析为行动倾向、软扩展钩子和后续权重影响。",
      "当前正式结果必须使用 selectedLegalResult / legalCandidates，不得由 AI 生成不存在的正式结果。",
      "必须核对 capabilityLedger、strength、lifeState、recentRecords 和 legalCandidates；玩家没有的术式、领域、反转术式、咒具或硬资源不得写成已使用。",
      "可以提出关键节点之间的侦查、撤退、保护、谈判、修炼准备、束缚代价等过程钩子，但必须能收束回合法主线结果。",
      "不得直接改写角色生死、阵营、最终战胜负、核心角色命运或当前节点结果。"
    ]
  };
}

async function requestAiFreeAnalysis(endpoint, payload) {
  return requestAiGoverned("ai_assist", payload, {
    timeoutMs: AI_FREE_ANALYSIS_TIMEOUT_MS,
    localFallbackText: "AI 未调用。本地 fallback 仅保留玩家行动文字，不改变当前合法结果。"
  });
}

function buildLocalAiFreeInfluence(task, actionText, anchorText, failures = [], statuses = []) {
  return {
    text: normalizeAiFreeText(actionText),
    tags: [],
    weightBias: createEmptyAiFreeBias(),
    summary: "AI 未调用：已保留玩家行动文字，正式结果仍按当前合法转盘结果结算。",
    anchorText: normalizeAiFreeText(anchorText),
    taskNodeId: task?.nodeId || "",
    taskTitle: task?.title || "",
    remoteAnalysis: {
      source: "local_fallback",
      provider: getAiProviderMode(),
      model: "local-rule-fallback",
      confidence: "low",
      systemUnderstanding: [],
      futureInfluence: [],
      expansionHooks: [],
      riskControl: "本地 fallback 不会改写当前结果。",
      boundary: AI_FREE_BOUNDARY_TEXT,
      rawSummary: "",
      failures: failures.slice(0, 3).map((item) => String(item || "").replace(/sk-[A-Za-z0-9_-]+/g, "[redacted-key]")),
      statuses: statuses.slice(0, 3)
    }
  };
}

function normalizeRemoteAiFreeInfluence(data, task, actionText, anchorText) {
  const remote = data?.influence || data?.analysis || data || {};
  const tags = normalizeRemoteAiFreeTags(remote.tags || remote.systemUnderstanding || []);
  const weightBias = createEmptyAiFreeBias();
  for (const tag of tags) {
    weightBias[tag.key] = clamp(Number(weightBias[tag.key] || 0) + Number(tag.amount || 0), 0, 6);
  }
  const summary = normalizeAiFreeText(remote.summary || formatAiFreeInfluenceSummary(tags));
  const systemUnderstanding = normalizeRemoteAiFreeUnderstanding(remote.systemUnderstanding || tags);
  const futureInfluence = normalizeRemoteAiFreeTextList(remote.futureInfluence || remote.futureImpact || []);
  const expansionHooks = normalizeRemoteAiFreeTextList(remote.expansionHooks || remote.bridgeHooks || remote.softExpansionHooks || []);
  const riskControl = normalizeAiFreeText(remote.riskControl || remote.boundaryNote || "");
  return {
    text: normalizeAiFreeText(actionText),
    tags,
    weightBias,
    summary,
    anchorText: normalizeAiFreeText(anchorText),
    taskNodeId: task?.nodeId || "",
    taskTitle: task?.title || "",
    remoteAnalysis: {
      source: "remote",
      provider: data?.provider || "",
      model: data?.model || "",
      confidence: remote.confidence || data?.confidence || "",
      systemUnderstanding,
      futureInfluence,
      expansionHooks,
      riskControl,
      boundary: remote.boundary || AI_FREE_BOUNDARY_TEXT,
      rawSummary: remote.summary || ""
    }
  };
}

function normalizeRemoteAiFreeTags(tags = []) {
  const merged = new Map();
  for (const item of Array.isArray(tags) ? tags : []) {
    const key = normalizeAiFreeInfluenceKey(item?.key || item?.id || item?.name);
    if (!key) continue;
    const amount = clamp(Number(item?.amount ?? item?.weight ?? item?.score ?? 1), 0, 3);
    if (amount <= 0) continue;
    merged.set(key, clamp(Number(merged.get(key) || 0) + amount, 0, 6));
  }
  return Array.from(merged.entries()).map(([key, amount]) => ({
    key,
    label: getAiFreeInfluenceDisplayName(key),
    amount
  }));
}

function normalizeAiFreeInfluenceKey(value) {
  const key = String(value || "").trim();
  if (AI_FREE_BIAS_KEYS.includes(key)) return key;
  const aliases = {
    highschool: "highSchool",
    high_school: "highSchool",
    school: "highSchool",
    rescue: "highSchool",
    protect: "highSchool",
    curse: "kenjaku",
    curses: "kenjaku",
    curseSpirit: "kenjaku",
    self: "selfTeam",
    independent: "selfTeam",
    investigate: "investigation",
    intel: "investigation",
    survive: "survival",
    retreat: "survival",
    attack: "aggression",
    aggressive: "aggression",
    bind: "binding",
    vow: "binding",
    heal: "healing",
    recovery: "healing"
  };
  return aliases[key] || "";
}

function normalizeRemoteAiFreeUnderstanding(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const key = normalizeAiFreeInfluenceKey(item?.key || item?.id || item?.name);
      if (!key) return null;
      const amount = clamp(Number(item?.amount ?? item?.weight ?? item?.score ?? 1), 0, 6);
      if (amount <= 0) return null;
      return {
        key,
        label: getAiFreeInfluenceDisplayName(key),
        amount,
        reason: normalizeAiFreeText(item?.reason || item?.evidence || item?.note || "")
      };
    })
    .filter(Boolean)
    .slice(0, 5);
}

function normalizeRemoteAiFreeTextList(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => normalizeAiFreeText(typeof item === "string" ? item : (item?.text || item?.summary || item?.hook || "")))
    .filter(Boolean)
    .slice(0, 5);
}

function buildAiFreeAnalysisFailureMessage(error) {
  if (error?.reasonCode === "daily-quota-exceeded") return AI_DAILY_LIMIT_MESSAGE;
  if (error?.reasonCode === "login-card-required") return "获取登录卡后才能用哦";
  if (error?.name === "AbortError") return "远端 AI 解析超过 60 秒，已中断。当前不会用本地关键词替代正式解析。";
  if (error?.status === 404) return "远端 Worker 尚未部署 /api/ai-free-analysis，AI自由辅助暂不能确认行动策略。";
  if (error?.status === 429) return error?.message || "远端 AI 解析请求达到限制，请稍后再试。";
  return error?.message || "远端 AI 解析失败。当前不会用本地关键词替代正式解析。";
}

//--外部访问统计请求--//
function readUsageStats() {
  const fallback = createDefaultUsageStats();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(USAGE_STATS_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return fallback;
    return {
      ...fallback,
      ...parsed,
      local: {
        ...fallback.local,
        ...(parsed.local || {})
      },
      global: {
        ...fallback.global,
        ...(parsed.global || {})
      }
    };
  } catch {
    return fallback;
  }
}

function createDefaultUsageStats() {
  return {
    schema: "jjk-wheel-usage-stats",
    version: 1,
    local: {
      pageLoads: 0,
      flowStarts: 0,
      draws: 0,
      flowCompletions: 0,
      debugRunAll: 0,
      lastUsedAt: ""
    },
    global: {
      provider: GLOBAL_USAGE_COUNTER.provider,
      domain: GLOBAL_USAGE_COUNTER.domain,
      totalCount: null,
      todayCount: null,
      dashboardUrl: "",
      status: "尚未同步",
      lastSyncAt: "",
      error: ""
    }
  };
}

function writeUsageStats() {
  try {
    window.localStorage.setItem(USAGE_STATS_KEY, JSON.stringify(state.usageStats));
  } catch {
    // localStorage can be unavailable in private or restricted contexts.
  }
}

function incrementUsageStat(key, options = {}) {
  state.usageStats ||= readUsageStats();
  state.usageStats.local[key] = Number(state.usageStats.local[key] || 0) + 1;
  state.usageStats.local.lastUsedAt = new Date().toISOString();
  writeUsageStats();
  if (options.global) syncGlobalUsageCounter({ increment: true });
  renderUsageStats();
}

function markFlowCompletion() {
  if (state.flags.usageCompletionRecorded) return;
  state.flags.usageCompletionRecorded = true;
  incrementUsageStat("flowCompletions");
}

async function syncGlobalUsageCounter(options = {}) {
  state.usageStats ||= readUsageStats();
  if (!shouldSyncGlobalUsageCounter()) {
    state.usageStats.global.status = "本地预览不写入全站统计";
    state.usageStats.global.error = "";
    state.usageStats.global.lastSyncAt = new Date().toISOString();
    writeUsageStats();
    renderUsageStats();
    return;
  }
  state.usageStats.global.status = "同步中";
  state.usageStats.global.error = "";
  renderUsageStats();

  try {
    const data = options.increment
      ? await recordGlobalVisit()
      : await fetchGlobalVisitStats();
    updateGlobalUsageStats(data);
  } catch (error) {
    markGlobalUsageStatsUnavailable(error);
  }
}

async function recordGlobalVisit() {
  try {
    return await requestWorkerUsageStats({ increment: true });
  } catch (workerError) {
    return requestFallbackUsageStats(workerError);
  }
}

async function fetchGlobalVisitStats() {
  try {
    return await requestWorkerUsageStats({ increment: false });
  } catch (workerError) {
    return requestFallbackUsageStats(workerError);
  }
}

async function requestFallbackUsageStats(workerError) {
  try {
    const fallback = await requestHitsCounterUsageStats();
    return {
      ...fallback,
      provider: GLOBAL_USAGE_COUNTER.fallbackProvider,
      fallbackUsed: true,
      fallbackReason: workerError?.message || "Worker 统计接口不可用"
    };
  } catch (fallbackError) {
    throw new Error([
      `Worker: ${workerError?.message || "统计接口不可用"}`,
      `备用统计: ${fallbackError?.message || "统计接口不可用"}`
    ].join("；"));
  }
}

async function requestWorkerUsageStats(options = {}) {
  const timeMeta = buildUsageCounterTimeMeta();
  const response = await fetchUsageStatsWithTimeout(buildWorkerUsageStatsUrl(), {
    method: options.increment ? "POST" : "GET",
    cache: "no-store",
    headers: options.increment ? { "content-type": "application/json" } : undefined,
    body: options.increment ? JSON.stringify({
      site: GLOBAL_USAGE_COUNTER.domain,
      url: GLOBAL_USAGE_COUNTER.canonicalUrl,
      label: GLOBAL_USAGE_COUNTER.label,
      timezone: timeMeta.timezone,
      utcOffsetMinutes: timeMeta.utcOffsetMinutes,
      dayKey: timeMeta.dayKey,
      increment: true
    }) : undefined
  });
  if (!response.ok) throw new Error(`Worker HTTP ${response.status}`);
  const data = await response.json();
  if (!Number.isFinite(Number(data.totalCount))) throw new Error("Worker 统计接口返回格式异常");
  return data;
}

async function requestHitsCounterUsageStats() {
  const response = await fetchUsageStatsWithTimeout(buildHitsCounterUrl(), {
    cache: "no-store",
    referrerPolicy: "no-referrer"
  });
  return parseHitsCounterUsageResponse(response);
}

async function fetchUsageStatsWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timeoutMs = Math.max(1000, Number(GLOBAL_USAGE_COUNTER.requestTimeoutMs || 12000));
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("统计请求超时");
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function parseHitsCounterUsageResponse(response) {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  const body = await response.text();
  if (contentType.includes("application/json")) {
    const data = JSON.parse(body);
    if (!Number.isFinite(Number(data.totalCount))) throw new Error("统计接口返回格式异常");
    return data;
  }
  const titleMatch = body.match(/<title>[^:]+:\s*([\d,]+)\s*\/\s*([\d,]+)<\/title>/i);
  if (!titleMatch) throw new Error("统计接口返回格式异常");
  return {
    todayCount: parseUsageNumber(titleMatch[1]),
    totalCount: parseUsageNumber(titleMatch[2]),
    dashboardUrl: "https://hitscounter.dev/"
  };
}

function updateGlobalUsageStats(data) {
  state.usageStats.global = {
    provider: data.provider || GLOBAL_USAGE_COUNTER.provider,
    domain: GLOBAL_USAGE_COUNTER.domain,
    totalCount: Number(data.totalCount),
    todayCount: Number(data.todayCount || 0),
    dashboardUrl: data.dashboardUrl || "",
    status: data.fallbackUsed ? "已同步（备用统计）" : "已同步",
    lastSyncAt: new Date().toISOString(),
    error: data.fallbackReason ? `Worker 统计不可用，已显示备用统计：${data.fallbackReason}` : ""
  };
  writeUsageStats();
  renderUsageStats();
}

function markGlobalUsageStatsUnavailable(error) {
  const current = state.usageStats.global || {};
  const hasCachedGlobalCount = hasUsageNumber(current.totalCount);
  state.usageStats.global = {
    ...current,
    provider: current.provider || GLOBAL_USAGE_COUNTER.provider,
    domain: GLOBAL_USAGE_COUNTER.domain,
    status: hasCachedGlobalCount
      ? "外部统计暂不可用（显示上次缓存）"
      : "全站统计暂不可用（不影响抽取）",
    error: normalizeUsageStatsError(error),
    lastSyncAt: new Date().toISOString()
  };
  writeUsageStats();
  renderUsageStats();
}

function shouldSyncGlobalUsageCounter() {
  const hostname = window.location.hostname;
  if (!hostname) return false;
  const allowedHosts = Array.isArray(GLOBAL_USAGE_COUNTER.allowedHosts)
    ? GLOBAL_USAGE_COUNTER.allowedHosts
    : ["maopaotabby.github.io"];
  return allowedHosts.includes(hostname);
}

function buildHitsCounterUrl() {
  const url = new URL(GLOBAL_USAGE_COUNTER.fallbackEndpoint);
  url.searchParams.set("url", GLOBAL_USAGE_COUNTER.canonicalUrl);
  url.searchParams.set("label", GLOBAL_USAGE_COUNTER.label);
  return url.toString();
}

function buildWorkerUsageStatsUrl() {
  const timeMeta = buildUsageCounterTimeMeta();
  const url = new URL(GLOBAL_USAGE_COUNTER.endpoint);
  url.searchParams.set("site", GLOBAL_USAGE_COUNTER.domain);
  url.searchParams.set("timezone", timeMeta.timezone);
  url.searchParams.set("utcOffsetMinutes", String(timeMeta.utcOffsetMinutes));
  url.searchParams.set("dayKey", timeMeta.dayKey);
  return url.toString();
}

function buildUsageCounterTimeMeta(date = new Date()) {
  const timezone = GLOBAL_USAGE_COUNTER.timezone || "Asia/Shanghai";
  const utcOffsetMinutes = Number.isFinite(Number(GLOBAL_USAGE_COUNTER.utcOffsetMinutes))
    ? Number(GLOBAL_USAGE_COUNTER.utcOffsetMinutes)
    : 480;
  const shifted = new Date(date.getTime() + utcOffsetMinutes * 60 * 1000);
  return {
    timezone,
    utcOffsetMinutes,
    dayKey: shifted.toISOString().slice(0, 10)
  };
}

function parseUsageNumber(value) {
  const parsed = Number(String(value).replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasUsageNumber(value) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
}

function normalizeUsageStatsError(error) {
  const message = String(error?.message || error || "同步失败").trim();
  return message || "同步失败";
}
