(function attachJJKAiPromptBuilder(global) {
  "use strict";

  var namespace = "JJKAiPromptBuilder";
  var version = "0.1.1-candidate";
  var validModes = Object.freeze([
    "off",
    "default",
    "custom"
  ]);
  var legacyModeMap = Object.freeze({
    local_fallback: "off",
    openai_byok_direct: "custom",
    deepseek_byok_direct: "custom",
    openai_compatible_byok_direct: "default",
    user_proxy_endpoint: "custom"
  });
  var defaultProviderRules = Object.freeze({
    version: "0.1.2",
    status: "CANDIDATE",
    defaultMode: "default",
    defaultProviderId: "ark_ai",
    providers: Object.freeze([
      Object.freeze({
        providerId: "ark_ai",
        label: "ArkAI / 火山方舟",
        modes: Object.freeze(["default"]),
        endpointType: "chat_completions",
        baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
        defaultPath: "/chat/completions",
        defaultModel: "doubao-seed-2-0-lite-260215",
        defaultApiKey: "09d6d696-dc76-4d99-a912-b15bec17c869",
        modelPresets: Object.freeze(["doubao-seed-2-0-lite-260215"]),
        allowCustomBaseUrl: false,
        allowCustomPath: false,
        allowCustomModel: false,
        securityWarningRequired: true,
        status: "CANDIDATE"
      }),
      Object.freeze({
        providerId: "openai_compatible",
        label: "自定义 AI（OpenAI-compatible）",
        modes: Object.freeze(["custom"]),
        endpointType: "chat_completions",
        baseUrl: "",
        defaultPath: "/chat/completions",
        defaultModel: "",
        modelPresets: Object.freeze([]),
        allowCustomBaseUrl: true,
        allowCustomPath: true,
        allowCustomModel: true,
        securityWarningRequired: true,
        status: "CANDIDATE"
      })
    ]),
    modes: Object.freeze({
      off: Object.freeze({ enabled: true, label: "关闭 AI" }),
      default: Object.freeze({ enabled: true, label: "默认", providerId: "ark_ai", defaultStorage: "sessionStorage", allowLocalStorage: false }),
      custom: Object.freeze({ enabled: true, label: "自定义", providerId: "openai_compatible", defaultStorage: "sessionStorage", allowLocalStorage: true })
    }),
    defaultModel: "doubao-seed-2-0-lite-260215",
    openAiResponsesEndpoint: "https://api.openai.com/v1/responses",
    tokenBudget: Object.freeze({
      maxPromptTokens: 6000,
      maxOutputTokens: 1800,
      recentLogLimit: 12,
      maxCardSummary: 10,
      maxActionSummary: 10,
      maxDomainSummary: 6,
      maxFeedbackLogEntries: 30
    }),
    maxPromptTokens: 6000,
    maxOutputTokens: 1800,
    temperature: 0.7,
    recentLogLimit: 12,
    maxCardSummary: 10,
    maxActionSummary: 10,
    maxDomainSummary: 6,
    maxFeedbackLogEntries: 30,
    promptCache: Object.freeze({
      enabled: true,
      staticPrefixFirst: true,
      promptCacheKeyPrefix: "jjk-wheel-v1"
    }),
    storage: Object.freeze({
      defaultKeyStorage: "sessionStorage",
      allowLocalStorage: true,
      neverExportSecrets: true
    })
  });
  var defaultPromptTemplates = Object.freeze({
    version: "0.1.0",
    status: "CANDIDATE",
    templates: Object.freeze({
      battle_narration: Object.freeze({
        label: "战斗叙事",
        staticPrefix: Object.freeze([
          "写一段中文咒术战斗叙事，只能使用用户给出的字段。",
          "必须依据 battleSummary、roundEvents、resources、domainState、handActions。",
          "不得改数值、胜负、技能或新增不存在的设定。",
          "300-600字，直接输出正文。"
        ]),
        dynamicSections: Object.freeze([
          "battleSummary",
          "roundEvents",
          "resources",
          "domainState",
          "handActions",
          "trialOrJackpotState"
        ]),
        maxOutputChars: 900
      }),
      article_summary: Object.freeze({
        label: "AI人生经历",
        staticPrefix: Object.freeze([
          "基于给定记录生成中文人生经历总结。",
          "只使用输入事实，不新增关键身份、胜负或能力。",
          "结构清晰，语言简洁。"
        ]),
        dynamicSections: Object.freeze(["records", "recentRecords", "summary", "kind", "timeline"]),
        maxOutputChars: 1200
      }),
      duel_character_assist: Object.freeze({
        label: "自定义角色卡",
        staticPrefix: Object.freeze([
          "把玩家描述整理成咒术角色卡 JSON。",
          "只输出 JSON；字段优先包含 suggestion/cardSuggestion。",
          "不要编造描述中没有的核心术式、领域或咒具；不确定则留空或保守。"
        ]),
        dynamicSections: Object.freeze(["mode", "description", "draft", "language"]),
        maxOutputChars: 1200
      }),
      ai_assist: Object.freeze({
        label: "AI辅助",
        staticPrefix: Object.freeze([
          "解析玩家行动文字为倾向建议。",
          "不能改变当前合法结果，只给后续权重、风险和叙事钩子。"
        ]),
        dynamicSections: Object.freeze(["task", "actionText", "anchorText", "selectedLegalResult", "legalCandidates", "recentRecords"]),
        maxOutputChars: 900
      })
    })
  });
  var assets = {
    providerRules: defaultProviderRules,
    promptTemplates: defaultPromptTemplates,
    loadedAt: "",
    buildVersion: ""
  };

  function hasOwn(source, key) {
    return Object.prototype.hasOwnProperty.call(source || {}, key);
  }

  function cloneJson(value) {
    if (value === null || typeof value === "undefined") return value;
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeAiMode(mode, rules) {
    var text = String(mode || "").trim();
    var fallback = rules?.defaultMode || defaultProviderRules.defaultMode;
    if (legacyModeMap[text]) return legacyModeMap[text];
    return validModes.indexOf(text) !== -1 ? text : fallback;
  }

  function inferProviderIdForMode(mode, rules) {
    var normalized = normalizeAiMode(mode, rules || assets.providerRules);
    var providerRules = rules || assets.providerRules || defaultProviderRules;
    var defaultProviderId = String(providerRules?.defaultProviderId || "").trim();
    var providers = providerRules?.providers || [];
    if (defaultProviderId && providers.some(function hasDefaultProvider(provider) {
      return provider?.providerId === defaultProviderId && (!Array.isArray(provider.modes) || provider.modes.indexOf(normalized) !== -1);
    })) {
      return defaultProviderId;
    }
    if (normalized === "default") return "ark_ai";
    if (normalized === "custom") return "openai_compatible";
    return "";
  }

  function normalizeProviderConfig(provider) {
    var source = provider && typeof provider === "object" ? provider : {};
    var id = String(source.providerId || "").trim();
    if (!id) return null;
    return {
      providerId: id,
      label: String(source.label || id),
      modes: Array.isArray(source.modes) ? source.modes.map(String).filter(Boolean) : [],
      endpointType: String(source.endpointType || ""),
      baseUrl: String(source.baseUrl || "").replace(/\/+$/, ""),
      defaultPath: String(source.defaultPath || ""),
      defaultModel: String(source.defaultModel || ""),
      defaultApiKey: String(source.defaultApiKey || ""),
      modelPresets: Array.isArray(source.modelPresets) ? source.modelPresets.map(String).filter(Boolean) : [],
      allowCustomBaseUrl: Boolean(source.allowCustomBaseUrl),
      allowCustomPath: Boolean(source.allowCustomPath),
      allowCustomModel: source.allowCustomModel !== false,
      securityWarningRequired: Boolean(source.securityWarningRequired),
      status: source.status || "CANDIDATE"
    };
  }

  function normalizeProviderRules(providerRules) {
    var input = providerRules && typeof providerRules === "object" ? providerRules : {};
    var next = Object.assign({}, cloneJson(defaultProviderRules), cloneJson(input));
    next.defaultMode = normalizeAiMode(next.defaultMode, defaultProviderRules);
    next.defaultProviderId = String(next.defaultProviderId || defaultProviderRules.defaultProviderId || "").trim();
    next.providers = (Array.isArray(input.providers) ? input.providers : defaultProviderRules.providers)
      .map(normalizeProviderConfig)
      .filter(Boolean);
    next.modes = Object.assign({}, cloneJson(defaultProviderRules.modes), cloneJson(input.modes || {}));
    validModes.forEach(function ensureMode(mode) {
      if (!next.modes[mode]) next.modes[mode] = { enabled: true, label: mode, providerId: inferProviderIdForMode(mode, next) };
      if (!next.modes[mode].providerId) next.modes[mode].providerId = inferProviderIdForMode(mode, next);
    });
    next.tokenBudget = Object.assign({}, cloneJson(defaultProviderRules.tokenBudget), cloneJson(input.tokenBudget || {}));
    next.maxPromptTokens = clampNumber(next.tokenBudget.maxPromptTokens || next.maxPromptTokens, 500, 30000, defaultProviderRules.maxPromptTokens);
    next.maxOutputTokens = clampNumber(next.tokenBudget.maxOutputTokens || next.maxOutputTokens, 64, 4000, defaultProviderRules.maxOutputTokens);
    next.temperature = clampNumber(next.temperature, 0, 2, defaultProviderRules.temperature);
    next.recentLogLimit = clampNumber(next.tokenBudget.recentLogLimit || next.recentLogLimit, 1, 60, defaultProviderRules.recentLogLimit);
    next.maxCardSummary = clampNumber(next.tokenBudget.maxCardSummary || next.maxCardSummary, 1, 60, defaultProviderRules.maxCardSummary);
    next.maxActionSummary = clampNumber(next.tokenBudget.maxActionSummary || next.maxActionSummary, 1, 60, defaultProviderRules.maxActionSummary);
    next.maxDomainSummary = clampNumber(next.tokenBudget.maxDomainSummary || next.maxDomainSummary, 1, 30, defaultProviderRules.maxDomainSummary);
    next.maxFeedbackLogEntries = clampNumber(next.tokenBudget.maxFeedbackLogEntries || next.maxFeedbackLogEntries, 1, 120, defaultProviderRules.maxFeedbackLogEntries);
    next.tokenBudget.maxPromptTokens = next.maxPromptTokens;
    next.tokenBudget.maxOutputTokens = next.maxOutputTokens;
    next.tokenBudget.recentLogLimit = next.recentLogLimit;
    next.tokenBudget.maxCardSummary = next.maxCardSummary;
    next.tokenBudget.maxActionSummary = next.maxActionSummary;
    next.tokenBudget.maxDomainSummary = next.maxDomainSummary;
    next.tokenBudget.maxFeedbackLogEntries = next.maxFeedbackLogEntries;
    next.promptCache = Object.assign({}, cloneJson(defaultProviderRules.promptCache), cloneJson(input.promptCache || {}));
    next.storage = Object.assign({}, cloneJson(defaultProviderRules.storage), cloneJson(input.storage || {}));
    return next;
  }

  function normalizePromptTemplates(promptTemplates) {
    var input = promptTemplates && typeof promptTemplates === "object" ? promptTemplates : {};
    var next = Object.assign({}, cloneJson(defaultPromptTemplates), cloneJson(input));
    next.templates = Object.assign({}, cloneJson(defaultPromptTemplates.templates), cloneJson(input.templates || {}));
    Object.keys(next.templates).forEach(function normalizeTemplate(templateId) {
      var template = next.templates[templateId] || {};
      template.staticPrefix = Array.isArray(template.staticPrefix) ? template.staticPrefix.map(String) : [];
      template.dynamicSections = Array.isArray(template.dynamicSections) ? template.dynamicSections.map(String) : [];
      template.maxOutputChars = clampNumber(template.maxOutputChars, 100, 4000, 900);
      next.templates[templateId] = template;
    });
    return next;
  }

  function registerPromptAssets(nextAssets) {
    var input = nextAssets || {};
    assets = {
      providerRules: normalizeProviderRules(input.providerRules),
      promptTemplates: normalizePromptTemplates(input.promptTemplates),
      loadedAt: new Date().toISOString(),
      buildVersion: String(input.buildVersion || "")
    };
    return getPromptAssets();
  }

  async function loadPromptAssets(options) {
    var config = options || {};
    var fetchImpl = config.fetchImpl || global.fetch;
    var baseUrl = config.baseUrl || "./data";
    var suffix = config.version ? "?v=" + encodeURIComponent(config.version) : "";
    var providerResponse;
    var templateResponse;

    if (typeof fetchImpl !== "function") throw new Error(namespace + ": fetch is unavailable");
    providerResponse = await fetchImpl(baseUrl + "/ai-provider-rules-v0.1-candidate.json" + suffix);
    templateResponse = await fetchImpl(baseUrl + "/ai-prompt-templates-v0.1-candidate.json" + suffix);
    return registerPromptAssets({
      providerRules: await providerResponse.json(),
      promptTemplates: await templateResponse.json(),
      buildVersion: config.version || ""
    });
  }

  function getPromptAssets() {
    return {
      providerRules: cloneJson(assets.providerRules),
      promptTemplates: cloneJson(assets.promptTemplates),
      loadedAt: assets.loadedAt,
      buildVersion: assets.buildVersion
    };
  }

  function getAiProviderRules() {
    return cloneJson(assets.providerRules);
  }

  function getAiPromptTemplates() {
    return cloneJson(assets.promptTemplates);
  }

  function listProviderRules() {
    var rules = assets.providerRules?.modes || {};
    return Object.keys(rules).map(function mapMode(mode) {
      return Object.assign({ id: mode }, cloneJson(rules[mode]));
    });
  }

  function getProviderRule(mode) {
    var normalized = normalizeAiMode(mode, assets.providerRules);
    return cloneJson((assets.providerRules.modes || {})[normalized] || null);
  }

  function listAiProviders() {
    return cloneJson(assets.providerRules.providers || []);
  }

  function getAiProviderConfig(providerIdOrMode) {
    var text = String(providerIdOrMode || "").trim();
    var providers = assets.providerRules.providers || [];
    for (var exactIndex = 0; exactIndex < providers.length; exactIndex += 1) {
      if (providers[exactIndex].providerId === text) return cloneJson(providers[exactIndex]);
    }
    var providerId = inferProviderIdForMode(text, assets.providerRules) || text;
    for (var index = 0; index < providers.length; index += 1) {
      if (providers[index].providerId === providerId) return cloneJson(providers[index]);
    }
    return null;
  }

  function getActiveAiProvider(settings, rules) {
    var normalizedRules = normalizeProviderRules(rules || assets.providerRules);
    var mode = normalizeAiMode(settings?.aiMode, normalizedRules);
    var explicitProviderId = String(settings?.providerId || "").trim();
    var providerId = explicitProviderId || normalizedRules.modes?.[mode]?.providerId || inferProviderIdForMode(mode, normalizedRules);
    var providers = normalizedRules.providers || [];
    var provider = providers.find(function findProvider(item) {
      return item.providerId === providerId;
    }) || null;
    return {
      mode: mode,
      providerId: providerId,
      provider: cloneJson(provider),
      endpointType: settings?.endpointType || provider?.endpointType || ""
    };
  }

  function listPromptTemplates() {
    var templates = assets.promptTemplates?.templates || {};
    return Object.keys(templates).map(function mapTemplate(templateId) {
      return Object.assign({ id: templateId }, cloneJson(templates[templateId]));
    });
  }

  function getPromptTemplate(templateId) {
    var templates = assets.promptTemplates?.templates || {};
    return cloneJson(templates[templateId] || templates.battle_narration || defaultPromptTemplates.templates.battle_narration);
  }

  function clampNumber(value, min, max, fallback) {
    var number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, number));
  }

  function estimatePromptTokenBudget(value) {
    var text = typeof value === "string" ? value : safeJsonStringify(value);
    return Math.ceil(text.length / 2);
  }

  function safeJsonStringify(value) {
    try {
      return JSON.stringify(value || {});
    } catch (error) {
      return String(value || "");
    }
  }

  function pickDynamicSections(context, template) {
    var source = context && typeof context === "object" ? context : {};
    var sections = Array.isArray(template?.dynamicSections) ? template.dynamicSections : [];
    var result = {};

    if (!sections.length) return cloneJson(source);
    sections.forEach(function copySection(key) {
      if (hasOwn(source, key)) result[key] = source[key];
    });
    return result;
  }

  function trimArray(value, limit) {
    if (!Array.isArray(value)) return value;
    if (value.length <= limit) return value.slice();
    return value.slice(value.length - limit);
  }

  function trimKnownCollections(context, rules, trimSteps) {
    var next = cloneJson(context || {});
    var recentLogLimit = rules.recentLogLimit || defaultProviderRules.recentLogLimit;
    var maxCardSummary = rules.maxCardSummary || defaultProviderRules.maxCardSummary;
    var maxActionSummary = rules.maxActionSummary || defaultProviderRules.maxActionSummary;
    var maxDomainSummary = rules.maxDomainSummary || defaultProviderRules.maxDomainSummary;

    [
      "logs",
      "log",
      "recentLogs",
      "recentRoundEvents",
      "recentRecords",
      "records",
      "aiFreeAssistTimeline",
      "resourceLog",
      "actionLog"
    ].forEach(function trimLogs(key) {
      if (Array.isArray(next[key]) && next[key].length > recentLogLimit) {
        next[key] = trimArray(next[key], recentLogLimit);
        trimSteps.push("trimmed " + key + " to " + recentLogLimit);
      }
    });

    ["cards", "cardSummary", "handCards"].forEach(function trimCards(key) {
      if (Array.isArray(next[key]) && next[key].length > maxCardSummary) {
        next[key] = trimArray(next[key], maxCardSummary);
        trimSteps.push("trimmed " + key + " to " + maxCardSummary);
      }
    });

    ["actions", "actionSummary", "handActions", "handActionSummary"].forEach(function trimActions(key) {
      if (Array.isArray(next[key]) && next[key].length > maxActionSummary) {
        next[key] = trimArray(next[key], maxActionSummary);
        trimSteps.push("trimmed " + key + " to " + maxActionSummary);
      }
    });

    ["domainResponses", "domainSnapshot", "domainState"].forEach(function trimDomain(key) {
      if (Array.isArray(next[key]) && next[key].length > maxDomainSummary) {
        next[key] = trimArray(next[key], maxDomainSummary);
        trimSteps.push("trimmed " + key + " to " + maxDomainSummary);
      }
    });

    if (next.debug) {
      delete next.debug;
      trimSteps.push("removed debug");
    }
    if (next.raw) {
      delete next.raw;
      trimSteps.push("removed raw");
    }
    return next;
  }

  function shrinkTextFields(context, trimSteps) {
    var next = cloneJson(context || {});
    Object.keys(next).forEach(function shrinkValue(key) {
      var value = next[key];
      if (typeof value === "string" && value.length > 2400) {
        next[key] = value.slice(0, 2200) + "\n[trimmed]";
        trimSteps.push("trimmed text field " + key);
      } else if (value && typeof value === "object" && !Array.isArray(value)) {
        next[key] = shrinkTextFields(value, trimSteps);
      } else if (Array.isArray(value)) {
        next[key] = value.map(function shrinkArrayItem(item) {
          return item && typeof item === "object" ? shrinkTextFields(item, trimSteps) : item;
        });
      }
    });
    return next;
  }

  function trimAiContextToBudget(context, options) {
    var config = options || {};
    var rules = normalizeProviderRules(config.providerRules || assets.providerRules);
    var maxPromptTokens = clampNumber(config.maxPromptTokens || rules.maxPromptTokens, 500, 30000, rules.maxPromptTokens);
    var trimSteps = [];
    var next = cloneJson(context || {});
    var estimatedTokens = estimatePromptTokenBudget(next);

    if (estimatedTokens > maxPromptTokens) {
      next = trimKnownCollections(next, rules, trimSteps);
      estimatedTokens = estimatePromptTokenBudget(next);
    }
    if (estimatedTokens > maxPromptTokens) {
      next = shrinkTextFields(next, trimSteps);
      estimatedTokens = estimatePromptTokenBudget(next);
    }
    return {
      context: next,
      metadata: {
        maxPromptTokens: maxPromptTokens,
        estimatedPromptTokens: estimatedTokens,
        trimmed: trimSteps.length > 0 || estimatedTokens > maxPromptTokens,
        trimSteps: trimSteps
      }
    };
  }

  function summarizeLogsForAi(logs, options) {
    var config = options || {};
    var limit = clampNumber(config.limit || assets.providerRules.recentLogLimit, 1, 120, defaultProviderRules.recentLogLimit);
    return trimArray(Array.isArray(logs) ? logs : [], limit).map(function mapLog(entry) {
      if (!entry || typeof entry !== "object") return { detail: String(entry || "") };
      return {
        round: entry.round,
        title: entry.title || entry.label || "",
        detail: entry.detail || entry.text || entry.message || "",
        delta: entry.delta || undefined
      };
    });
  }

  function summarizeBattleForAi(battle) {
    var source = battle || {};
    return {
      battleId: source.battleId || "",
      left: source.left?.name || source.leftName || "",
      right: source.right?.name || source.rightName || "",
      winnerSide: source.winnerSide || "",
      endReason: source.endReason || source.resolutionReason || "",
      round: source.endingRound || source.round || 0,
      finalRate: source.finalRate,
      recentRoundEvents: summarizeLogsForAi(source.log || source.roundEvents || [], { limit: assets.providerRules.recentLogLimit })
    };
  }

  function buildPromptCacheKey(templateId, options) {
    var rules = normalizeProviderRules(options?.providerRules || assets.providerRules);
    var prefix = rules.promptCache?.promptCacheKeyPrefix || defaultProviderRules.promptCache.promptCacheKeyPrefix;
    return prefix + ":" + String(templateId || "unknown");
  }

  function buildAiPromptPayload(templateId, context, options) {
    var config = options || {};
    var rules = normalizeProviderRules(config.providerRules || assets.providerRules);
    var template = getPromptTemplate(templateId);
    var selectedContext = pickDynamicSections(context, template);
    var trimmed = trimAiContextToBudget(selectedContext, {
      providerRules: rules,
      maxPromptTokens: config.maxPromptTokens || rules.maxPromptTokens
    });
    var systemContent = (template.staticPrefix || []).join("\n");
    var userContent = {
      templateId: templateId,
      templateLabel: template.label || templateId,
      dynamicContext: trimmed.context,
      metadata: {
        siteVersion: config.siteVersion || "",
        status: assets.promptTemplates.status || "CANDIDATE",
        trimmed: trimmed.metadata.trimmed,
        estimatedPromptTokens: trimmed.metadata.estimatedPromptTokens,
        maxPromptTokens: trimmed.metadata.maxPromptTokens,
        trimSteps: trimmed.metadata.trimSteps
      }
    };

    return {
      model: config.model || rules.defaultModel || defaultProviderRules.defaultModel,
      input: [
        { role: "system", content: systemContent },
        { role: "user", content: userContent }
      ],
      max_output_tokens: clampNumber(config.maxOutputTokens || rules.maxOutputTokens, 64, 4000, rules.maxOutputTokens),
      temperature: clampNumber(config.temperature ?? rules.temperature, 0, 2, rules.temperature),
      prompt_cache_key: buildPromptCacheKey(templateId, { providerRules: rules }),
      metadata: {
        templateId: templateId,
        cacheFriendly: true,
        staticPrefixFirst: true,
        trimmed: trimmed.metadata.trimmed,
        estimatedPromptTokens: trimmed.metadata.estimatedPromptTokens,
        maxPromptTokens: trimmed.metadata.maxPromptTokens,
        maxOutputTokens: clampNumber(config.maxOutputTokens || rules.maxOutputTokens, 64, 4000, rules.maxOutputTokens)
      }
    };
  }

  function buildBattleNarrationPrompt(context, options) {
    return buildAiPromptPayload("battle_narration", context, options);
  }

  function buildCombatExplanationPrompt(context, options) {
    return buildAiPromptPayload("combat_explanation", context, options);
  }

  function buildBetaFeedbackPrompt(context, options) {
    return buildAiPromptPayload("beta_feedback_summary", context, options);
  }

  function buildLocalBattleNarrationFallback(context) {
    var summary = context?.battleSummary || context?.battle || context || {};
    var left = summary.left || summary.leftName || summary.left?.name || "左侧";
    var right = summary.right || summary.rightName || summary.right?.name || "右侧";
    var endReason = summary.endReason || summary.resolutionReason || "规则结算";
    return "AI 未调用。本地记录：战斗由规则引擎结算，" + left + " 与 " + right + " 的局势已经固定；结束原因为 " + endReason + "。";
  }

  function buildLocalMechanicExplanationFallback(context) {
    var reason = context?.endReason || context?.result || "当前结果来自本地规则、资源变化和已选行动。";
    return "AI 未调用。本地解释：" + reason;
  }

  function buildLocalLifeNarrativeFallback(context) {
    var records = Array.isArray(context?.recentRecords) ? context.recentRecords : Array.isArray(context?.records) ? context.records.slice(-8) : [];
    if (!records.length) return "AI 未调用。当前还没有足够记录生成经历总结。";
    return "AI 未调用。本地摘要：" + records.map(function mapRecord(record) {
      return "【" + (record.title || record.nodeId || "节点") + "】" + (record.result || "已记录");
    }).join("；") + "。";
  }

  function sanitizeAiSettingsForExport(settings) {
    var copy = cloneJson(settings || {});
    ["apiKey", "byokKey", "authorization", "Authorization", "openAiApiKey"].forEach(function removeKey(key) {
      if (hasOwn(copy, key)) delete copy[key];
    });
    if (copy.headers) {
      delete copy.headers.Authorization;
      delete copy.headers.authorization;
    }
    return copy;
  }

  function parseProviderText(data) {
    if (!data) return "";
    if (typeof data === "string") return data;
    if (typeof data.text === "string") return data.text;
    if (typeof data.markdown === "string") return data.markdown;
    if (typeof data.output_text === "string") return data.output_text;
    if (Array.isArray(data.choices)) {
      return data.choices.map(function mapChoice(choice) {
        return choice?.message?.content || choice?.text || "";
      }).join("");
    }
    if (Array.isArray(data.output)) {
      return data.output.map(function mapOutput(item) {
        if (typeof item?.content === "string") return item.content;
        if (Array.isArray(item?.content)) {
          return item.content.map(function mapContent(content) {
            return content?.text || content?.content || "";
          }).join("");
        }
        return "";
      }).join("");
    }
    return "";
  }

  function normalizeAiProviderResponse(data, options) {
    var config = options || {};
    var response = data || {};
    return {
      provider: config.provider || response.provider || "",
      text: parseProviderText(response),
      usage: response.usage || null,
      raw: config.includeRaw ? response.raw || response : undefined,
      response: response
    };
  }

  function prepareOpenAiResponsesPayload(payload) {
    var copy = cloneJson(payload || {});
    if (Array.isArray(copy.input)) {
      copy.input = copy.input.map(function mapMessage(message) {
        var next = Object.assign({}, message || {});
        if (next.content && typeof next.content === "object") {
          next.content = JSON.stringify(next.content);
        }
        return next;
      });
    }
    return copy;
  }

  function promptPayloadToMessages(payload) {
    var input = Array.isArray(payload?.input) ? payload.input : [];
    return input.map(function mapInput(message) {
      var role = message?.role === "system" ? "system" : "user";
      var content = message?.content;
      if (content && typeof content === "object") content = JSON.stringify(content);
      return {
        role: role,
        content: String(content || "")
      };
    }).filter(function filterMessage(message) {
      return message.content;
    });
  }

  function buildProviderUrl(baseUrl, path) {
    var base = String(baseUrl || "").trim().replace(/\/+$/, "");
    var suffix = String(path || "").trim();
    if (!base) return "";
    if (!suffix) return base;
    return base + (suffix[0] === "/" ? suffix : "/" + suffix);
  }

  function getProviderEndpoint(settings, provider) {
    var baseUrl = String(settings?.baseUrl || provider?.baseUrl || "").trim();
    var path = String(settings?.path || settings?.defaultPath || provider?.defaultPath || "").trim();
    return buildProviderUrl(baseUrl, path);
  }

  function buildChatCompletionsPayload(settings, payload, provider) {
    var model = String(settings?.model || payload?.model || provider?.defaultModel || defaultProviderRules.defaultModel).trim();
    return {
      model: model,
      messages: promptPayloadToMessages(payload),
      max_tokens: clampNumber(settings?.maxOutputTokens || payload?.max_output_tokens, 64, 4000, payload?.max_output_tokens || defaultProviderRules.maxOutputTokens),
      temperature: clampNumber(settings?.temperature ?? payload?.temperature, 0, 2, payload?.temperature ?? defaultProviderRules.temperature)
    };
  }

  function buildAiProviderRequest(settings, payload, options) {
    var config = options || {};
    var rules = normalizeProviderRules(config.providerRules || assets.providerRules);
    var active = getActiveAiProvider(settings, rules);
    var mode = active.mode;
    var provider = active.provider;
    var apiKey = String(settings?.apiKey || "").trim();
    var endpoint;
    var body;

    if (mode === "off") {
      return { mode: mode, providerId: active.providerId, endpointType: "local", url: "", request: null, payload: null };
    }
    if (mode === "default" || mode === "custom") {
      if (!apiKey) throw new Error("API key is required for BYOK direct mode.");
      endpoint = getProviderEndpoint(settings, provider);
      if (!endpoint) throw new Error("OpenAI-compatible base URL is required.");
      body = buildChatCompletionsPayload(settings, payload, provider);
      return {
        mode: mode,
        providerId: active.providerId,
        endpointType: "chat_completions",
        url: endpoint,
        request: {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + apiKey
          },
          body: JSON.stringify(body)
        },
        payload: body
      };
    }
    throw new Error("Unsupported AI mode: " + mode);
  }

  async function fetchJson(url, options) {
    var fetchImpl = options?.fetchImpl || global.fetch;
    var response;
    var data;

    if (typeof fetchImpl !== "function") throw new Error(namespace + ": fetch is unavailable");
    response = await fetchImpl(url, options?.request || {});
    data = await response.json().catch(function fallbackJson() {
      return {};
    });
    if (!response.ok) {
      var error = new Error(data.error || "HTTP " + response.status);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  async function sendOpenAiCompatibleChatRequest(settings, payload, options) {
    var request = buildAiProviderRequest(settings || {}, payload, options);
    var data;

    data = await fetchJson(request.url, {
      fetchImpl: options?.fetchImpl,
      request: request.request
    });
    return Object.assign(normalizeAiProviderResponse(data, {
      provider: request.providerId || request.mode,
      includeRaw: options?.includeRaw
    }), {
      provider: request.providerId || request.mode
    });
  }

  async function sendAiProviderRequest(settings, payload, options) {
    var config = options || {};
    var rules = normalizeProviderRules(config.providerRules || assets.providerRules);
    var mode = normalizeAiMode(settings?.aiMode, rules);

    if (mode === "off") {
      return {
        provider: mode,
        localFallback: true,
        text: config.localFallbackText || buildLocalMechanicExplanationFallback(payload),
        usage: null
      };
    }
    if (mode === "default" || mode === "custom") return sendOpenAiCompatibleChatRequest(settings, payload, config);
    throw new Error("Unsupported AI mode: " + mode);
  }

  function callAiProvider(settings, payload, options) {
    return sendAiProviderRequest(settings, payload, options || {});
  }

  function testAiProviderConnection(settings, options) {
    var config = options || {};
    var rules = normalizeProviderRules(config.providerRules || assets.providerRules);
    var mode = normalizeAiMode(settings?.aiMode, rules);
    var active = getActiveAiProvider(settings, rules);
    if (mode === "off") {
      return { ok: true, remote: false, mode: mode, providerId: active.providerId, message: "local mode" };
    }
    if (!String(settings?.apiKey || "").trim()) {
      return { ok: false, remote: true, mode: mode, providerId: active.providerId, message: "missing api key" };
    }
    if ((mode === "default" || mode === "custom") && !getProviderEndpoint(settings, active.provider)) {
      return { ok: false, remote: true, mode: mode, providerId: active.providerId, message: "missing compatible endpoint" };
    }
    return { ok: true, remote: true, mode: mode, providerId: active.providerId, message: "settings configured" };
  }

  function getExpectedExports() {
    return expectedExports.slice();
  }

  function registerWithParent() {
    try {
      if (global.JJKApi && typeof global.JJKApi.registerSubmodule === "function") {
        global.JJKApi.registerSubmodule("aiPromptBuilder", api);
        return true;
      }
    } catch (error) {
      return false;
    }
    return false;
  }

  var expectedExports = Object.freeze([
    "loadPromptAssets",
    "registerPromptAssets",
    "getPromptAssets",
    "getAiProviderRules",
    "getAiPromptTemplates",
    "listProviderRules",
    "getProviderRule",
    "listAiProviders",
    "getAiProviderConfig",
    "getActiveAiProvider",
    "listPromptTemplates",
    "getPromptTemplate",
    "normalizeAiMode",
    "buildAiProviderRequest",
    "buildAiPromptPayload",
    "buildBattleNarrationPrompt",
    "buildCombatExplanationPrompt",
    "buildBetaFeedbackPrompt",
    "estimatePromptTokenBudget",
    "trimAiContextToBudget",
    "summarizeBattleForAi",
    "summarizeLogsForAi",
    "buildPromptCacheKey",
    "sanitizeAiSettingsForExport",
    "buildLocalBattleNarrationFallback",
    "buildLocalMechanicExplanationFallback",
    "buildLocalLifeNarrativeFallback",
    "callAiProvider",
    "sendAiProviderRequest",
    "sendOpenAiCompatibleChatRequest",
    "normalizeAiProviderResponse",
    "testAiProviderConnection"
  ]);

  var api = {
    namespace: namespace,
    version: version,
    metadata: Object.freeze({
      namespace: namespace,
      version: version,
      layer: "api-ai-prompt-builder",
      moduleFormat: "classic-script-iife",
      scriptType: "classic",
      behavior: "provider-prompt-budget-wrapper",
      ownsBehavior: true,
      mutatesCombat: false,
      decidesWinner: false,
      storesSecrets: false,
      defaultMode: "default",
      status: "CANDIDATE"
    }),
    expectedExports: expectedExports,
    getExpectedExports: getExpectedExports,
    loadPromptAssets: loadPromptAssets,
    registerPromptAssets: registerPromptAssets,
    getPromptAssets: getPromptAssets,
    getAiProviderRules: getAiProviderRules,
    getAiPromptTemplates: getAiPromptTemplates,
    listProviderRules: listProviderRules,
    getProviderRule: getProviderRule,
    listAiProviders: listAiProviders,
    getAiProviderConfig: getAiProviderConfig,
    getActiveAiProvider: getActiveAiProvider,
    listPromptTemplates: listPromptTemplates,
    getPromptTemplate: getPromptTemplate,
    normalizeAiMode: normalizeAiMode,
    buildAiProviderRequest: buildAiProviderRequest,
    buildAiPromptPayload: buildAiPromptPayload,
    buildBattleNarrationPrompt: buildBattleNarrationPrompt,
    buildCombatExplanationPrompt: buildCombatExplanationPrompt,
    buildBetaFeedbackPrompt: buildBetaFeedbackPrompt,
    estimatePromptTokenBudget: estimatePromptTokenBudget,
    trimAiContextToBudget: trimAiContextToBudget,
    summarizeBattleForAi: summarizeBattleForAi,
    summarizeLogsForAi: summarizeLogsForAi,
    buildPromptCacheKey: buildPromptCacheKey,
    sanitizeAiSettingsForExport: sanitizeAiSettingsForExport,
    buildLocalBattleNarrationFallback: buildLocalBattleNarrationFallback,
    buildLocalMechanicExplanationFallback: buildLocalMechanicExplanationFallback,
    buildLocalLifeNarrativeFallback: buildLocalLifeNarrativeFallback,
    callAiProvider: callAiProvider,
    sendAiProviderRequest: sendAiProviderRequest,
    sendOpenAiCompatibleChatRequest: sendOpenAiCompatibleChatRequest,
    normalizeAiProviderResponse: normalizeAiProviderResponse,
    testAiProviderConnection: testAiProviderConnection
  };

  global[namespace] = api;
  global.JJKAiPromptApi = api;
  registerWithParent();
})(globalThis);
