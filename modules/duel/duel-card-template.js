(function attachDuelCardTemplate(global) {
  "use strict";

  var namespace = "JJKDuelCardTemplate";
  var version = "1.390A-combat-core-rationalization-pass";
  var expectedExports = [
    "getDuelCardTemplateRules",
    "getDuelCardTemplates",
    "getDuelCardTemplateForAction",
    "normalizeDuelCardTemplate",
    "buildDuelCardViewModel",
    "buildDuelCardEffectPreview",
    "getDuelCardCopyRules",
    "getDuelCardCopyForAction",
    "normalizeDuelCardCopy",
    "mergeDuelCardTemplateWithCopy",
    "buildDuelCardDisplayModel",
    "getDuelCardRiskLabel",
    "getDuelCardTypeDisplayLabel",
    "getDuelCardAvailabilityMessage",
    "getDuelCardTypeLabel",
    "getDuelCardRarityLabel",
    "auditDuelCardTemplateDrift",
    "getDuelCardTemplateCoverage",
    "getDuelCardTemplateForActionStrict",
    "validateDuelCardTemplateSchema",
    "getDuelCardTemplateFallbackStats",
    "getDuelCharacterCombatStats",
    "getDuelRankMultiplier",
    "getDuelEfficiencyCostMultiplier",
    "getDuelCardScalingProfile",
    "calculateDuelCardBaseEffect",
    "calculateDuelCardFinalPreview",
    "calculateDuelCardCeCost",
    "calculateDuelDamageFromCard",
    "calculateDuelBlockFromCard",
    "calculateDuelHealingFromCard",
    "calculateDuelDomainPressureFromCard",
    "buildDuelCardNumericPreview"
  ];
  var expectedDependencyNames = [
    "state",
    "getDuelCardTemplateRules",
    "getDuelCardCopyRules"
  ];
  var bindings = Object.create(null);
  var dependencies = Object.create(null);
  var cardTemplateIndexCache = null;
  var cardTemplateCacheStats = {
    lastInvalidatedAt: ""
  };

  var defaultTypeLabels = {
    basic: "基础",
    defense: "防御",
    technique: "术式",
    domain: "领域",
    domain_response: "领域应对",
    domain_maintenance: "领域维持",
    rule_trial: "审判推进",
    rule_defense: "审判防御",
    jackpot: "坐杀搏徒",
    resource: "资源",
    support: "支援",
    healing: "治疗",
    curse_tool: "咒具",
    special: "特殊"
  };

  var defaultRarityLabels = {
    common: "common",
    uncommon: "uncommon",
    rare: "rare",
    special: "special",
    domain: "domain",
    rule: "rule"
  };
  var requiredTemplateFields = [
    "cardId",
    "sourceActionId",
    "name",
    "cardType",
    "apCost",
    "ceCostMode",
    "tags",
    "rarity",
    "weight",
    "allowedContexts",
    "effectSummary",
    "risk",
    "status"
  ];
  var forbiddenEffectFields = [
    "effects",
    "requirements",
    "cost",
    "costCe",
    "applyEffect",
    "resolver",
    "resourceDelta",
    "hpDelta",
    "ceDelta",
    "outcome",
    "combatOverride"
  ];
  var rankMultipliers = Object.freeze({
    E: 0.45,
    D: 0.60,
    C: 0.80,
    B: 1.00,
    A: 1.35,
    S: 1.85,
    SS: 2.60,
    SSS: 3.60,
    "EX-": 4.25,
    EX: 5.00
  });
  var efficiencyCostMultipliers = Object.freeze({
    E: 1.45,
    D: 1.25,
    C: 1.10,
    B: 1.00,
    A: 0.88,
    S: 0.75,
    SS: 0.62,
    SSS: 0.50,
    "EX-": 0.45,
    EX: 0.40
  });
  var rankScores = Object.freeze({
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

  function hasOwn(source, key) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }

  function assertExpected(name) {
    if (!expectedExports.includes(name)) {
      throw new Error(namespace + " cannot bind unexpected export: " + name);
    }
  }

  function bind(name, value) {
    assertExpected(name);
    if (typeof value !== "function") {
      throw new Error(namespace + "." + name + " must be a function.");
    }
    bindings[name] = value;
  }

  function register(map) {
    Object.keys(map || {}).forEach(function bindExport(name) {
      bind(name, map[name]);
    });
  }

  function hasBinding(name) {
    if (name === undefined) {
      return expectedExports.every(function hasExport(exportName) {
        return hasOwn(bindings, exportName);
      });
    }
    return hasOwn(bindings, name);
  }

  function get(name) {
    assertExpected(name);
    if (hasOwn(bindings, name)) return bindings[name];
    if (typeof api?.[name] === "function") return api[name];
    throw new Error(namespace + "." + name + " is not bound.");
  }

  function getBinding(name) {
    return get(name);
  }

  function listBindings() {
    return expectedExports.reduce(function buildSnapshot(snapshot, name) {
      snapshot[name] = hasBinding(name);
      return snapshot;
    }, {});
  }

  function clearBindings() {
    expectedExports.forEach(function clearName(name) {
      delete bindings[name];
    });
  }

  function registerDependencies(map) {
    Object.keys(map || {}).forEach(function bindDependency(name) {
      if (!expectedDependencyNames.includes(name)) {
        throw new Error(namespace + " received unexpected dependency: " + name);
      }
      dependencies[name] = map[name];
    });
  }

  function configure(map) {
    registerDependencies(map);
  }

  function hasDependency(name) {
    return hasOwn(dependencies, name);
  }

  function listDependencies() {
    return expectedDependencyNames.reduce(function buildSnapshot(snapshot, name) {
      snapshot[name] = hasDependency(name);
      return snapshot;
    }, {});
  }

  function clearDependencies() {
    expectedDependencyNames.forEach(function clearName(name) {
      delete dependencies[name];
    });
  }

  function getOptionalFunction(name) {
    var value = dependencies[name];
    return typeof value === "function" ? value : null;
  }

  function getDuelCardTemplateRules() {
    var getter = getOptionalFunction("getDuelCardTemplateRules");
    if (getter && getter !== getDuelCardTemplateRules) return getter();
    return dependencies.state?.duelCardTemplateRules || {
      version: "0.1.0",
      status: "CANDIDATE",
      cards: [],
      cardTypeLabels: defaultTypeLabels,
      rarityLabels: defaultRarityLabels
    };
  }

  function getDuelCardTemplates() {
    var rules = getDuelCardTemplateRules();
    return Array.isArray(rules?.cards) ? rules.cards : [];
  }

  function getDuelCardCopyRules() {
    var getter = getOptionalFunction("getDuelCardCopyRules");
    if (getter && getter !== getDuelCardCopyRules) return getter();
    return dependencies.state?.duelCardCopyRules || {
      schema: "jjk-duel-card-copy",
      version: "0.1.0",
      status: "CANDIDATE",
      copy: []
    };
  }

  function getDuelCardCopyList() {
    var rules = getDuelCardCopyRules();
    return Array.isArray(rules?.copy) ? rules.copy : [];
  }

  function sanitizeDisplayText(value, fallback) {
    var text = typeof value === "string" ? value.trim() : "";
    return text || fallback || "";
  }

  function normalizeDisplayTags(value, fallback) {
    var source = Array.isArray(value) && value.length ? value : (Array.isArray(fallback) ? fallback : []);
    return Array.from(new Set(source.map(function normalizeTag(tag) {
      return typeof tag === "string" ? tag.trim() : "";
    }).filter(Boolean))).slice(0, 4);
  }

  function getDuelCardCopyForAction(actionOrCandidate, template) {
    var sourceActionId = getActionId(actionOrCandidate) || template?.sourceActionId || "";
    var cardId = actionOrCandidate?.cardId || template?.cardId || "";
    return getDuelCardCopyList().find(function matchCopy(copy) {
      return Boolean(copy) && (
        (sourceActionId && copy.sourceActionId === sourceActionId) ||
        (cardId && copy.cardId === cardId)
      );
    }) || null;
  }

  function normalizeDuelCardCopy(copy, actionOrCandidate, template) {
    var action = actionOrCandidate?.action || actionOrCandidate || {};
    var fallbackName = template?.name || action.label || action.id || "未命名手札";
    var fallbackShortEffect = template?.effectSummary || action.description || "按当前手法规则结算。";
    return {
      sourceActionId: copy?.sourceActionId || template?.sourceActionId || action.id || "",
      cardId: copy?.cardId || template?.cardId || "",
      displayName: sanitizeDisplayText(copy?.displayName, fallbackName),
      subtitle: sanitizeDisplayText(copy?.subtitle, ""),
      shortEffect: sanitizeDisplayText(copy?.shortEffect, fallbackShortEffect),
      longEffect: sanitizeDisplayText(copy?.longEffect, fallbackShortEffect),
      flavorLine: sanitizeDisplayText(copy?.flavorLine, ""),
      uiTags: normalizeDisplayTags(copy?.uiTags, template?.tags || action.tags || []),
      tone: sanitizeDisplayText(copy?.tone, "direct"),
      status: copy?.status || template?.status || "CANDIDATE"
    };
  }

  function mergeDuelCardTemplateWithCopy(actionOrCandidate, template, copy) {
    var normalizedCopy = normalizeDuelCardCopy(copy, actionOrCandidate, template);
    return {
      ...(template || {}),
      displayName: normalizedCopy.displayName,
      subtitle: normalizedCopy.subtitle,
      shortEffect: normalizedCopy.shortEffect,
      longEffect: normalizedCopy.longEffect,
      flavorLine: normalizedCopy.flavorLine,
      uiTags: normalizedCopy.uiTags,
      copyStatus: normalizedCopy.status,
      copyTone: normalizedCopy.tone
    };
  }

  function getDuelCardRiskLabel(risk) {
    var labels = {
      low: "低风险",
      medium: "中风险",
      normal: "中风险",
      high: "高风险",
      critical: "极高风险"
    };
    return labels[risk] || risk || "风险待判定";
  }

  function getDuelCardTypeDisplayLabel(cardType) {
    return getDuelCardTypeLabel(cardType);
  }

  function getDuelCardAvailabilityMessage(reason, available, selected) {
    if (selected) return "已选择，本回合将执行";
    if (available) return "可用";
    var text = typeof reason === "string" ? reason : "";
    var lower = text.toLowerCase();
    if (text.includes("行动点") || lower.includes("ap")) return "行动点不足";
    if (text.includes("咒力") || lower.includes("ce")) return "咒力不足";
    if (text.includes("己方领域") || text.includes("领域未展开") || lower.includes("domainactive")) return "需要己方领域处于展开状态";
    if (text.includes("对方领域") || text.includes("领域威胁") || lower.includes("opponentdomain")) return "需要对方领域威胁存在";
    if (text.includes("审判") || lower.includes("trial")) return "当前审判程序不适用";
    if (text.includes("中奖") || text.includes("jackpot") || lower.includes("jackpot")) return "中奖结算尚未就绪";
    if (text.includes("零咒力") || lower.includes("zero")) return "仅零咒力个体可用";
    if (text.includes("咒具") || lower.includes("tool")) return "需要咒具状态或咒具适性";
    if (text.includes("没收") || lower.includes("confiscat")) return "术式被暂时没收";
    if (text.includes("暴力") || lower.includes("violence")) return "审判规则限制直接暴力";
    if (text.includes("领域负荷") || text.includes("熔断") || lower.includes("load")) return "领域负荷过高，继续维持可能领域崩解并触发术式烧断";
    return text || "当前状态不可用";
  }

  function formatSignedPercent(value) {
    var numeric = Number(value || 0);
    if (!Number.isFinite(numeric) || numeric === 0) return "";
    var percent = Number((numeric * 100).toFixed(Math.abs(numeric) < 0.01 ? 1 : 0));
    return (percent > 0 ? "+" : "") + percent + "%";
  }

  function formatScalePercent(value) {
    var numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric === 1) return "";
    return formatSignedPercent(numeric - 1);
  }

  function formatPlainNumber(value) {
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) return "";
    return String(Number(numeric.toFixed(Math.abs(numeric) < 10 ? 2 : 0)));
  }

  function addPreviewLine(list, line) {
    if (!Array.isArray(list) || typeof line !== "string") return;
    var text = sanitizeDisplayText(line.trim(), "");
    if (!text || /undefined|null|TODO|NaN/i.test(text)) return;
    if (!list.includes(text)) list.push(text);
  }

  function getActionEffects(actionOrCandidate) {
    var action = actionOrCandidate?.action || actionOrCandidate || {};
    return action.effects || action.effectPatch || {};
  }

  function getActionRequirements(actionOrCandidate) {
    var action = actionOrCandidate?.action || actionOrCandidate || {};
    return action.requirements || action.availability || {};
  }

  function getMechanicIds(actionOrCandidate) {
    var action = actionOrCandidate?.action || actionOrCandidate || {};
    return Array.from(new Set([]
      .concat(actionOrCandidate?.mechanicIds || [])
      .concat(action?.mechanicIds || [])
      .filter(Boolean)));
  }

  function buildStatusLine(status, ownerText) {
    if (!status || typeof status !== "object") return "";
    var label = status.label || status.id || "状态候选";
    var rounds = Number(status.rounds || status.durationRounds || 0);
    var duration = rounds > 0 ? "，持续 " + rounds + " 回合" : "";
    return ownerText + "：" + label + duration + "。";
  }

  function buildDuelCardEffectPreview(actionOrCandidate, template, display, baseView) {
    var action = actionOrCandidate?.action || actionOrCandidate || {};
    var effects = getActionEffects(actionOrCandidate);
    var requirements = getActionRequirements(actionOrCandidate);
    var id = getActionId(actionOrCandidate) || template?.sourceActionId || action?.id || "";
    var cardType = template?.cardType || inferCardType(action);
    var tags = Array.from(new Set([].concat(template?.tags || [], action?.tags || [], baseView?.tags || []).filter(Boolean)));
    var tagText = tags.join(" ");
    var lower = (id + " " + cardType + " " + tagText).toLowerCase();
    var preview = {
      summary: "",
      resourceLines: [],
      combatLines: [],
      statusLines: [],
      conditionLines: [],
      riskLines: []
    };
    var ceCost = Number(baseView?.ceCost ?? baseView?.costCe ?? 0);
    var numericPreview = buildDuelCardNumericPreview(actionOrCandidate, baseView?.actor || baseView?.characterCardProfile || actionOrCandidate?.characterCardProfile || {});
    addPreviewLine(preview.resourceLines, "消耗：咒力 " + formatPlainNumber(ceCost || numericPreview.cost?.finalCost || 0) + "。");
    (numericPreview.lines || []).forEach(function addNumericLine(line) {
      addPreviewLine(preview.combatLines, line);
    });

    var outgoing = formatScalePercent(effects.outgoingScale);
    if (outgoing) addPreviewLine(preview.combatLines, "输出倍率：" + outgoing + "。");
    var incomingHp = formatScalePercent(effects.incomingHpScale);
    if (incomingHp) addPreviewLine(preview.combatLines, "受到体势伤害：" + incomingHp + "。");
    var incomingCe = formatScalePercent(effects.incomingCeScale);
    if (incomingCe) addPreviewLine(preview.combatLines, "受到咒力消耗压力：" + incomingCe + "。");
    var sureHit = formatScalePercent(effects.sureHitScale);
    if (sureHit) addPreviewLine(preview.combatLines, "必中组件影响：" + sureHit + "。");
    var domainPressure = formatScalePercent(effects.domainPressureScale);
    if (domainPressure) addPreviewLine(preview.combatLines, "领域压制影响：" + domainPressure + "。");
    var manualAttack = formatScalePercent(effects.manualAttackScale);
    if (manualAttack) addPreviewLine(preview.combatLines, "手动攻击影响：" + manualAttack + "。");
    var hpDamage = Number(effects.hpDamage ?? effects.flatHpDamage);
    if (Number.isFinite(hpDamage) && hpDamage) addPreviewLine(preview.combatLines, "预计体势伤害：" + formatPlainNumber(hpDamage) + "。");
    var stability = formatSignedPercent(effects.stabilityDelta);
    if (stability) addPreviewLine(preview.resourceLines, "稳定度：" + stability + "。");
    var opponentStability = formatSignedPercent(effects.opponentStabilityDelta);
    if (opponentStability) addPreviewLine(preview.combatLines, "对手稳定度：" + opponentStability + "。");
    var domainLoadDelta = Number(effects.domainLoadDelta);
    if (Number.isFinite(domainLoadDelta) && domainLoadDelta) addPreviewLine(preview.resourceLines, "领域负荷：" + (domainLoadDelta > 0 ? "+" : "") + formatPlainNumber(domainLoadDelta) + "。");
    var opponentDomainLoadDelta = Number(effects.opponentDomainLoadDelta);
    if (Number.isFinite(opponentDomainLoadDelta) && opponentDomainLoadDelta) addPreviewLine(preview.combatLines, "对手领域负荷：" + (opponentDomainLoadDelta > 0 ? "+" : "") + formatPlainNumber(opponentDomainLoadDelta) + "。");
    var domainLoadScale = formatScalePercent(effects.domainLoadScale);
    if (domainLoadScale) addPreviewLine(preview.resourceLines, "领域负荷增长：" + domainLoadScale + "。");
    if (effects.activateDomain) addPreviewLine(preview.statusLines, "状态变化：展开己方领域，并开始计算领域负荷。");
    if (effects.releaseDomain) addPreviewLine(preview.statusLines, "状态变化：解除己方领域，降低领域崩解风险。");
    addPreviewLine(preview.statusLines, buildStatusLine(effects.selfStatus, "可能获得"));
    addPreviewLine(preview.statusLines, buildStatusLine(effects.opponentStatus, "可能施加给对手"));
    var duration = Number(effects.durationRounds || effects.rounds || effects.duration || 0);
    if (Number.isFinite(duration) && duration > 0) addPreviewLine(preview.statusLines, "持续：" + formatPlainNumber(duration) + " 回合。");

    if (Array.isArray(template?.allowedContexts) && template.allowedContexts.length) {
      addPreviewLine(preview.conditionLines, "适用：" + template.allowedContexts.join(" / ") + "。");
    }
    if (requirements.domainActive === true) addPreviewLine(preview.conditionLines, "条件：需要己方领域处于展开状态。");
    if (requirements.domainActive === false) addPreviewLine(preview.conditionLines, "条件：需要己方尚未展开领域。");
    if (requirements.opponentDomainActive) addPreviewLine(preview.conditionLines, "条件：需要对方领域威胁存在。");
    if (requirements.requiresDomainAccess) addPreviewLine(preview.conditionLines, "条件：需要角色具备领域能力。");
    if (requirements.requiresZeroCeBypass || /zero_ce|零咒力/.test(lower)) {
      addPreviewLine(preview.resourceLines, "咒力消耗：0；依靠零咒力和体术路线。");
      addPreviewLine(preview.conditionLines, "条件：仅零咒力 / 天与咒缚路线适用。");
      addPreviewLine(preview.combatLines, "可规避必中捕捉，但不能免疫开放领域压制或手动攻击。");
    }
    if (requirements.blocksOnTechniqueImbalance) addPreviewLine(preview.conditionLines, "不适用：术式被没收、失衡或无法稳定输出时。");
    if (requirements.requiresSimpleDomain) addPreviewLine(preview.conditionLines, "条件：需要简易领域或等价反必中防线。");
    if (requirements.requiresHollowWickerBasket) addPreviewLine(preview.conditionLines, "条件：需要弥虚葛笼架势。");

    if (/trial|judgment|evidence|verdict|审判|证据|判决|没收/.test(lower)) {
      addPreviewLine(preview.combatLines, "审判关系：推进证据压力、辩护压力或判决准备，不直接重写胜负。");
      if (/verdict|判决/.test(lower)) addPreviewLine(preview.conditionLines, "判决准备：需审判程序推进到可申请判决的状态。");
      if (/confisc|没收/.test(lower)) addPreviewLine(preview.statusLines, "状态变化：可能联动术式没收或咒具没收候选。");
    }
    if (/jackpot|reach|probability|中奖|演出|期待/.test(lower)) {
      addPreviewLine(preview.combatLines, "jackpot 关系：影响期待度、演出稳定或中奖结算准备。");
      addPreviewLine(preview.conditionLines, "结算：期待度达到阈值后才可进入中奖结算。");
    }
    if (/black_flash|黑闪|impact_timing_window|爆发窗口/.test(lower)) {
      addPreviewLine(preview.statusLines, "建立 1 回合 strike 爆发窗口；这不是主动发动黑闪。");
      addPreviewLine(preview.conditionLines, "触发：下一次 strike / 近身打击类动作才可能吃到窗口修正。");
    }

    if (!preview.combatLines.length) addPreviewLine(preview.combatLines, "效果强度：随当前资源、体势、领域和审判状态动态结算。");
    if (!preview.statusLines.length) addPreviewLine(preview.statusLines, "状态变化：无固定状态；按当前 action effect 结算。");
    if (!preview.conditionLines.length) addPreviewLine(preview.conditionLines, "适用：按当前手札可用性、资源和场上状态判断。");
    addPreviewLine(preview.riskLines, "风险：" + getDuelCardRiskLabel(baseView?.risk || template?.risk || action?.risk || "medium") + "。连续使用可能增加资源、稳定度或领域负荷压力。");

    var summaryCandidates = [];
    if (outgoing) summaryCandidates.push("输出倍率 " + outgoing);
    if (incomingHp) summaryCandidates.push("受到体势伤害 " + incomingHp);
    if (stability) summaryCandidates.push("稳定度 " + stability);
    if (domainLoadDelta) summaryCandidates.push("领域负荷 " + (domainLoadDelta > 0 ? "+" : "") + formatPlainNumber(domainLoadDelta));
    var baseSummary = sanitizeDisplayText(display?.shortEffect || template?.effectSummary || action?.description, "按当前手法规则结算。");
    preview.summary = sanitizeDisplayText(
      summaryCandidates.length ? (baseSummary + "（" + summaryCandidates.slice(0, 2).join("，") + "）") : baseSummary,
      "效果会根据当前战斗状态结算。"
    );
    return preview;
  }

  function addIndexedItem(index, key, value) {
    if (!key) return;
    index[key] ||= [];
    index[key].push(value);
  }

  function buildDuelCardTemplateIndexes(rulesOrCards) {
    var rules = Array.isArray(rulesOrCards) ? { cards: rulesOrCards } : (rulesOrCards || getDuelCardTemplateRules());
    var cards = Array.isArray(rules?.cards) ? rules.cards : [];
    var index = {
      schema: "jjk-duel-card-template-index",
      version: rules?.version || "",
      total: cards.length,
      cards: cards,
      cardById: Object.create(null),
      cardBySourceActionId: Object.create(null),
      cardsByType: Object.create(null),
      cardsByTag: Object.create(null),
      cardsByContext: Object.create(null),
      cardsByCharacterHint: Object.create(null)
    };
    cards.forEach(function indexCard(card) {
      if (!card) return;
      if (card.cardId) index.cardById[card.cardId] = card;
      if (card.sourceActionId && card.playableInHandBeta !== false && !card.futureTemplate) {
        index.cardBySourceActionId[card.sourceActionId] = card;
      }
      addIndexedItem(index.cardsByType, card.cardType, card);
      (card.tags || []).forEach(function indexTag(tag) {
        addIndexedItem(index.cardsByTag, tag, card);
      });
      (card.allowedContexts || []).forEach(function indexContext(context) {
        addIndexedItem(index.cardsByContext, context, card);
      });
      [].concat(card.characterHints || card.characterIds || []).forEach(function indexCharacter(characterHint) {
        addIndexedItem(index.cardsByCharacterHint, characterHint, card);
      });
    });
    return index;
  }

  function getCardTemplateRulesStamp(rules) {
    var activeRules = rules || getDuelCardTemplateRules();
    return [
      activeRules?.version || "",
      Array.isArray(activeRules?.cards) ? activeRules.cards.length : 0
    ].join("|");
  }

  function getDuelCardTemplateIndex() {
    var rules = getDuelCardTemplateRules();
    var stamp = getCardTemplateRulesStamp(rules);
    if (!cardTemplateIndexCache || cardTemplateIndexCache.stamp !== stamp) {
      cardTemplateIndexCache = buildDuelCardTemplateIndexes(rules);
      cardTemplateIndexCache.stamp = stamp;
    }
    return cardTemplateIndexCache;
  }

  function warmDuelCardTemplateCache() {
    return getDuelCardTemplateIndex();
  }

  function invalidateDuelCardTemplateCache() {
    cardTemplateIndexCache = null;
    cardTemplateCacheStats.lastInvalidatedAt = new Date().toISOString();
  }

  function getDuelCardTemplateBySourceActionId(sourceActionId) {
    if (!sourceActionId) return null;
    return getDuelCardTemplateIndex().cardBySourceActionId[sourceActionId] || null;
  }

  function getActionId(actionOrCandidate) {
    var action = actionOrCandidate?.action || actionOrCandidate;
    return actionOrCandidate?.sourceActionId || actionOrCandidate?.actionId || actionOrCandidate?.id || action?.id || "";
  }

  function toNumber(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : Number(fallback || 0);
  }

  function roundPreviewNumber(value, digits) {
    return Number(toNumber(value, 0).toFixed(Number.isFinite(Number(digits)) ? Number(digits) : 2));
  }

  function asArray(value) {
    if (Array.isArray(value)) return value;
    if (value === undefined || value === null || value === "") return [];
    return [value];
  }

  function normalizeDuelRank(value, fallback) {
    var normalized = String(value || "").trim().toUpperCase();
    if (hasOwn(rankMultipliers, normalized)) return normalized;
    return fallback || "B";
  }

  function getDuelRankMultiplier(rank) {
    return rankMultipliers[normalizeDuelRank(rank, "B")] || 1;
  }

  function getDuelEfficiencyCostMultiplier(rankOrStats) {
    var rank = typeof rankOrStats === "object"
      ? rankOrStats?.ceEfficiency
      : rankOrStats;
    return efficiencyCostMultipliers[normalizeDuelRank(rank, "B")] || 1;
  }

  function getDuelRankScore(rank, fallbackRank) {
    return rankScores[normalizeDuelRank(rank, fallbackRank || "B")] ?? rankScores.B;
  }

  function scoreToDuelRank(score) {
    var value = toNumber(score, 4);
    if (value >= 11.1) return "EX";
    if (value >= 9.5) return "EX-";
    if (value >= 8.3) return "SSS";
    if (value >= 7.0) return "SS";
    if (value >= 5.8) return "S";
    if (value >= 4.7) return "A";
    if (value >= 3.3) return "B";
    if (value >= 2.3) return "C";
    if (value >= 1.3) return "D";
    return "E";
  }

  function rankFromVisibleGrade(value) {
    var text = String(value || "").toLowerCase();
    if (/特级|special|ex/.test(text)) return "SS";
    if (/1|一级|grade\s*1|semi.?grade\s*1/.test(text)) return "A";
    if (/2|二级|grade\s*2/.test(text)) return "B";
    if (/3|三级|grade\s*3/.test(text)) return "C";
    if (/4|四级|grade\s*4/.test(text)) return "D";
    return "B";
  }

  function getDuelCharacterCombatStats(characterOrActor) {
    var source = characterOrActor?.characterCardProfile || characterOrActor?.profile || characterOrActor || {};
    var baseStats = source.baseStats || {};
    var raw = source.raw || {};
    var axes = source.axes || {};
    var text = [
      source.characterId,
      source.id,
      source.displayName,
      source.name,
      source.visibleGrade,
      source.officialGrade,
      source.notes,
      source.techniqueText,
      source.domainProfile,
      asArray(source.innateTraits).join(" "),
      asArray(source.advancedTechniques).join(" "),
      asArray(source.flags).join(" "),
      asArray(source.traits).join(" "),
      asArray(source.archetypes).join(" "),
      asArray(source.tags).join(" "),
      asArray(source.techniqueFamilies).join(" ")
    ].filter(Boolean).join(" ");
    var baseRank = rankFromVisibleGrade(source.visibleGrade || source.officialGrade || source.grade || "");
    var stats = {
      cePool: normalizeDuelRank(source.cePool || source.maxCeRank || source.cursedEnergy || baseStats.cursedEnergy || baseRank, baseRank),
      ceOutput: normalizeDuelRank(source.ceOutput || source.cursedEnergyOutput || source.output || baseStats.cursedEnergy || baseRank, baseRank),
      ceControl: normalizeDuelRank(source.ceControl || source.control || baseStats.control || baseRank, baseRank),
      ceEfficiency: normalizeDuelRank(source.ceEfficiency || source.efficiency || baseStats.efficiency || baseRank, baseRank),
      techniquePower: normalizeDuelRank(source.techniquePower || source.technique || baseRank, baseRank),
      physicalPower: normalizeDuelRank(source.physicalPower || source.body || source.physical || baseStats.body || baseRank, baseRank),
      speed: normalizeDuelRank(source.speed || source.mobility || baseStats.martial || baseRank, baseRank),
      weaponMastery: normalizeDuelRank(source.weaponMastery || source.cursedToolMastery || "C", "C"),
      domainSkill: normalizeDuelRank(source.domainSkill || source.domainRank || (source.hasDomainAccess ? baseRank : "C"), source.hasDomainAccess ? baseRank : "C"),
      isZeroCe: Boolean(source.isZeroCe || source.hasCe === false || /zero_ce|零咒力|天与咒缚|甚尔|真希/i.test(text)),
      hasCe: source.hasCe === undefined ? !/zero_ce|零咒力|天与咒缚|甚尔|真希/i.test(text) : Boolean(source.hasCe),
      hasInnateTechnique: source.hasInnateTechnique === undefined ? !/无术式|no_innate_technique|零咒力/i.test(text) : Boolean(source.hasInnateTechnique),
      hasDomainAccess: Boolean(source.hasDomainAccess || /领域|domain|伏魔御厨子|无量空处|诛伏赐死|坐杀搏徒|自闭圆顿裹/i.test(text)),
      usesCursedTools: Boolean(source.usesCursedTools || /咒具|cursed_tool|释魂刀|天逆|游云|黑绳|万里锁/i.test(text))
    };
    if (/五条|gojo|limitless|无下限|无量空处/i.test(text)) {
      Object.assign(stats, { cePool: "EX", ceOutput: "EX", ceControl: "EX", ceEfficiency: "SS", techniquePower: "EX", physicalPower: "A", speed: "SS", weaponMastery: "B", domainSkill: "EX", hasDomainAccess: true });
    } else if (/宿傩|sukuna|伏魔御厨子|shrine/i.test(text)) {
      Object.assign(stats, { cePool: "EX", ceOutput: "EX", ceControl: "SSS", ceEfficiency: "SS", techniquePower: "EX", physicalPower: "S", speed: "S", weaponMastery: "A", domainSkill: "EX", hasDomainAccess: true });
    } else if (/日车|higuruma|诛伏赐死|judgment|trial/i.test(text)) {
      Object.assign(stats, { cePool: "A", ceOutput: "A", ceControl: "S", ceEfficiency: "A", techniquePower: "S", physicalPower: "B", speed: "B", weaponMastery: "C", domainSkill: "S", hasDomainAccess: true });
    } else if (/秤|hakari|jackpot|坐杀搏徒/i.test(text)) {
      Object.assign(stats, { cePool: "S", ceOutput: "A", ceControl: "A", ceEfficiency: "A", techniquePower: "A", physicalPower: "A", speed: "A", weaponMastery: "C", domainSkill: "S", hasDomainAccess: true });
    } else if (/真希|甚尔|maki|toji|zero_ce|零咒力|天与咒缚/i.test(text)) {
      Object.assign(stats, { cePool: "E", ceOutput: "E", ceControl: "E", ceEfficiency: "E", techniquePower: "E", physicalPower: "SS", speed: "S", weaponMastery: "SS", domainSkill: "E", isZeroCe: true, hasCe: false, hasInnateTechnique: false, hasDomainAccess: false, usesCursedTools: true });
    }
    var cePoolScore = Number.isFinite(Number(raw.cursedEnergyScore)) ? Number(raw.cursedEnergyScore) : getDuelRankScore(stats.cePool);
    var ceControlScore = Number.isFinite(Number(raw.controlScore)) ? Number(raw.controlScore) : getDuelRankScore(stats.ceControl);
    var ceEfficiencyScore = Number.isFinite(Number(raw.efficiencyScore)) ? Number(raw.efficiencyScore) : getDuelRankScore(stats.ceEfficiency);
    var techniqueScore = getDuelRankScore(stats.techniquePower);
    var axisBoost = Math.max(0, toNumber(axes.jujutsu, cePoolScore) - cePoolScore) * 0.14;
    var specialBoost = 0;
    if (/石流|granite blast|最大出力|最大输出|純愛砲|纯爱炮|茈|虚式|world slash|世界斩/i.test(text)) specialBoost += 0.65;
    if (/六眼/i.test(text) && !/无下限|limitless|五条|gojo/i.test(text)) specialBoost += 0.12;
    var ceMaxOutputScore = Math.min(12, cePoolScore * 0.45 + ceControlScore * 0.25 + ceEfficiencyScore * 0.10 + techniqueScore * 0.20 + axisBoost + specialBoost);
    stats.ceMaxOutput = normalizeDuelRank(source.ceMaxOutput || source.maxCeOutput || scoreToDuelRank(ceMaxOutputScore), scoreToDuelRank(ceMaxOutputScore));
    return {
      characterId: source.characterId || source.id || "",
      displayName: source.displayName || source.name || "",
      ...stats,
      ceMaxOutputScore: roundPreviewNumber(ceMaxOutputScore, 2),
      multipliers: {
        cePool: getDuelRankMultiplier(stats.cePool),
        ceOutput: getDuelRankMultiplier(stats.ceOutput),
        ceMaxOutput: getDuelRankMultiplier(stats.ceMaxOutput),
        ceControl: getDuelRankMultiplier(stats.ceControl),
        ceEfficiency: getDuelRankMultiplier(stats.ceEfficiency),
        techniquePower: getDuelRankMultiplier(stats.techniquePower),
        physicalPower: getDuelRankMultiplier(stats.physicalPower),
        speed: getDuelRankMultiplier(stats.speed),
        weaponMastery: getDuelRankMultiplier(stats.weaponMastery),
        domainSkill: getDuelRankMultiplier(stats.domainSkill)
      },
      source: "combat-stat-profile-candidate"
    };
  }

  function getDuelCardScalingProfile(actionOrCandidate) {
    var action = actionOrCandidate?.action || actionOrCandidate || {};
    var template = getDuelCardTemplateForAction(actionOrCandidate);
    var declared = action.scalingProfile || template?.scalingProfile || "";
    var tags = [].concat(action.tags || [], template?.tags || []).join(" ").toLowerCase();
    if (declared) {
      var normalized = normalizeScalingProfile(declared);
      if (normalized) return normalized;
    }
    if (action.requiresZeroCe || /zero_ce|零咒力|heavenly/.test(tags)) return "zero_ce";
    if (action.requiresCursedTool || /cursed_tool|咒具|tool/.test(tags)) return "cursed_tool";
    if (/domain|领域|barrier/.test(tags) || template?.cardType === "domain") return "domain";
    if (/trial|evidence|verdict|审判|证据|判决/.test(tags) || template?.cardType === "rule_trial") return "trial_rule";
    if (/jackpot|reach|probability|坐杀|中奖|演出/.test(tags) || template?.cardType === "jackpot") return "jackpot_rule";
    if (/反转术式|rct|reverse|healing|治疗|疗伤|正能量/.test(tags) || template?.cardType === "healing") return "healing";
    if (/defense|guard|防御|守势/.test(tags) || template?.cardType === "defense") return "defense";
    if (/physical|melee|strike|体术|近身|打击/.test(tags)) return "physical";
    if (/burst|爆发|forced_output/.test(action.id || "")) return "ce_burst";
    if (/technique|术式|blue|red|limitless|slash|shrine/.test(tags + " " + (action.id || ""))) return "technique";
    return "balanced";
  }

  function normalizeScalingProfile(value) {
    var key = String(value || "").toLowerCase();
    if (!key) return "";
    if (["ce_burst", "burst", "output_burst", "forced_output"].includes(key)) return "ce_burst";
    if (["domain", "domain_pressure", "domain_sustain", "domain_control"].includes(key)) return "domain";
    if (["trial", "trial_rule", "rule_trial", "evidence"].includes(key)) return "trial_rule";
    if (["jackpot", "jackpot_rule", "probability"].includes(key)) return "jackpot_rule";
    if (["healing", "rct", "rct_healing", "reverse", "reverse_cursed_technique", "reverse_cursed_technique_heal"].includes(key)) return "healing";
    if (["zero_ce", "heavenly_restriction"].includes(key)) return "zero_ce";
    if (["cursed_tool", "tool"].includes(key)) return "cursed_tool";
    if (["guard", "defense", "shield", "block"].includes(key)) return "defense";
    if (["melee", "strike", "physical"].includes(key)) return "physical";
    if (["technique", "innate_technique"].includes(key)) return "technique";
    if (["balanced", "support", "resource"].includes(key)) return key;
    return key;
  }

  function calculateDuelCardBaseEffect(actionOrCandidate) {
    var action = actionOrCandidate?.action || actionOrCandidate || {};
    var template = getDuelCardTemplateForAction(actionOrCandidate);
    function pick(field) {
      return toNumber(action[field] ?? template?.[field], 0);
    }
    return {
      baseDamage: pick("baseDamage"),
      baseBlock: pick("baseBlock"),
      baseShield: pick("baseShield"),
      baseStabilityDamage: pick("baseStabilityDamage"),
      baseStabilityRestore: pick("baseStabilityRestore"),
      baseCeDamage: pick("baseCeDamage"),
      baseDomainPressure: pick("baseDomainPressure"),
      baseDomainLoadDelta: pick("baseDomainLoadDelta"),
      baseHealing: pick("baseHealing"),
      baseEvidencePressure: pick("baseEvidencePressure"),
      baseDefensePressure: pick("baseDefensePressure"),
      baseJackpotGauge: pick("baseJackpotGauge"),
      durationRounds: pick("durationRounds"),
      damageType: action.damageType || template?.damageType || "dynamic",
      scalingProfile: getDuelCardScalingProfile(actionOrCandidate)
    };
  }

  function getRiskCostMultiplier(risk) {
    return { low: 0.95, medium: 1, high: 1.08, critical: 1.18 }[String(risk || "medium")] || 1;
  }

  function isZeroCeCostCard(actionOrCandidate, actorStats) {
    var action = actionOrCandidate?.action || actionOrCandidate || {};
    var template = getDuelCardTemplateForAction(actionOrCandidate);
    var text = [
      action.costType,
      template?.costType,
      action.scalingProfile,
      template?.scalingProfile,
      asArray(action.tags).join(" "),
      asArray(template?.tags).join(" ")
    ].join(" ").toLowerCase();
    return Boolean(action.requiresZeroCe || template?.requiresZeroCe || text.includes("zero_ce") || text.includes("零咒力"));
  }

  function calculateDuelCardCeCost(actionOrCandidate, characterOrActor) {
    var action = actionOrCandidate?.action || actionOrCandidate || {};
    var template = getDuelCardTemplateForAction(actionOrCandidate);
    var stats = getDuelCharacterCombatStats(characterOrActor || actionOrCandidate?.actor || actionOrCandidate?.characterCardProfile || {});
    if (isZeroCeCostCard(actionOrCandidate, stats)) {
      return { baseCost: 0, finalCost: 0, efficiencyCostMultiplier: 1, costType: "zero_ce", source: "1.390A-zero-ce" };
    }
    var cost = action.cost || {};
    var rawBaseCost = action.baseCeCost ?? template?.baseCeCost ?? action.costCe ?? action.ceCost;
    var baseCost = Number(rawBaseCost);
    if (!Number.isFinite(baseCost)) {
      baseCost = Math.max(
        toNumber(cost.flatCe, 0),
        toNumber(cost.minCe, 0),
        toNumber(characterOrActor?.maxCe, 0) * toNumber(cost.ceRatio, 0)
      );
    }
    var efficiency = getDuelEfficiencyCostMultiplier(stats.ceEfficiency);
    var risk = getRiskCostMultiplier(action.risk || template?.risk || "medium");
    var finalCost = baseCost <= 0 ? 0 : Math.max(1, Math.round(baseCost * efficiency * risk));
    return {
      baseCost: roundPreviewNumber(Math.max(0, baseCost), 1),
      finalCost: finalCost,
      efficiencyCostMultiplier: efficiency,
      riskCostMultiplier: risk,
      costType: action.costType || template?.costType || "ce",
      source: "1.390A-ce-efficiency"
    };
  }

  function calculateDuelDamageFromCard(actionOrCandidate, characterOrActor, options) {
    var base = calculateDuelCardBaseEffect(actionOrCandidate);
    var stats = getDuelCharacterCombatStats(characterOrActor || {});
    var m = stats.multipliers;
    var contextMultiplier = toNumber(options?.contextMultiplier, 1) || 1;
    var riskMultiplier = toNumber(options?.riskMultiplier, 1) || 1;
    var value = base.baseDamage;
    if (base.scalingProfile === "technique") value *= Math.pow(m.ceOutput, 0.72) * Math.pow(m.ceMaxOutput, 0.28) * Math.pow(m.ceControl, 0.5) * Math.pow(m.techniquePower, 0.7) * contextMultiplier;
    else if (base.scalingProfile === "ce_burst") value *= Math.pow(m.ceMaxOutput, 1.15) * Math.pow(m.ceControl, 0.35) * riskMultiplier;
    else if (base.scalingProfile === "zero_ce" || base.scalingProfile === "physical") value *= m.physicalPower * Math.pow(m.speed, 0.4) * Math.pow(m.weaponMastery, 0.6) * (stats.isZeroCe ? 1.15 : 1);
    else if (base.scalingProfile === "cursed_tool") value *= Math.pow(m.physicalPower, 0.6) * m.weaponMastery * Math.pow(m.speed, 0.3);
    else value *= Math.max(0.7, (m.ceOutput + m.physicalPower) / 2);
    return roundPreviewNumber(value, 1);
  }

  function calculateDuelBlockFromCard(actionOrCandidate, characterOrActor, options) {
    var base = calculateDuelCardBaseEffect(actionOrCandidate);
    var stats = getDuelCharacterCombatStats(characterOrActor || {});
    var m = stats.multipliers;
    var stabilityMultiplier = toNumber(options?.stabilityMultiplier, 1) || 1;
    var raw = Math.max(base.baseBlock, base.baseShield);
    var value = raw * Math.pow(m.ceControl, 0.7) * Math.pow(m.ceEfficiency, 0.5) * stabilityMultiplier;
    if (base.scalingProfile === "zero_ce" || base.scalingProfile === "physical" || base.scalingProfile === "cursed_tool") {
      value = raw * Math.max(m.physicalPower, m.weaponMastery) * Math.pow(m.speed, 0.25);
    }
    return roundPreviewNumber(value, 1);
  }

  function calculateDuelHealingFromCard(actionOrCandidate, characterOrActor, options) {
    var base = calculateDuelCardBaseEffect(actionOrCandidate);
    if (!base.baseHealing) return 0;
    var action = actionOrCandidate?.action || actionOrCandidate || {};
    var template = getDuelCardTemplateForAction(actionOrCandidate);
    var stats = getDuelCharacterCombatStats(characterOrActor || {});
    var m = stats.multipliers;
    var tags = []
      .concat(asArray(action.tags))
      .concat(asArray(template?.tags))
      .concat([action.id, action.label, action.description, base.scalingProfile])
      .join(" ")
      .toLowerCase();
    var contextMultiplier = toNumber(options?.contextMultiplier, 1) || 1;
    var value = base.baseHealing;
    if (base.scalingProfile === "healing" || /反转术式|rct|reverse|正能量|疗伤|治疗/.test(tags)) {
      var healingMultiplier = (
        Math.pow(m.ceControl, 0.55) * 0.42 +
        Math.pow(m.ceEfficiency, 0.5) * 0.28 +
        Math.pow(m.techniquePower, 0.35) * 0.18 +
        Math.pow(m.ceOutput, 0.3) * 0.12
      );
      value *= Math.max(0.55, Math.min(2.35, healingMultiplier)) * contextMultiplier;
    } else if (base.scalingProfile === "jackpot_rule") {
      value *= Math.max(m.ceEfficiency, m.domainSkill) * Math.pow(m.ceControl, 0.35) * contextMultiplier;
    } else {
      value *= Math.max(0.7, (m.ceControl + m.ceEfficiency) / 2) * contextMultiplier;
    }
    return roundPreviewNumber(value, 1);
  }

  function calculateDuelDomainPressureFromCard(actionOrCandidate, characterOrActor) {
    var base = calculateDuelCardBaseEffect(actionOrCandidate);
    var stats = getDuelCharacterCombatStats(characterOrActor || {});
    var m = stats.multipliers;
    return roundPreviewNumber(base.baseDomainPressure * m.domainSkill * Math.pow(m.ceMaxOutput, 0.25) * Math.pow(m.ceOutput, 0.35) * Math.pow(m.ceControl, 0.4), 1);
  }

  function calculateDuelCardFinalPreview(actionOrCandidate, characterOrActor, options) {
    var base = calculateDuelCardBaseEffect(actionOrCandidate);
    var stats = getDuelCharacterCombatStats(characterOrActor || {});
    var cost = calculateDuelCardCeCost(actionOrCandidate, characterOrActor || {});
    return {
      base: base,
      stats: stats,
      cost: cost,
      finalDamage: calculateDuelDamageFromCard(actionOrCandidate, characterOrActor || {}, options || {}),
      finalBlock: calculateDuelBlockFromCard(actionOrCandidate, characterOrActor || {}, options || {}),
      finalHealing: calculateDuelHealingFromCard(actionOrCandidate, characterOrActor || {}, options || {}),
      finalDomainPressure: calculateDuelDomainPressureFromCard(actionOrCandidate, characterOrActor || {}),
      finalEvidencePressure: roundPreviewNumber(base.baseEvidencePressure * getDuelRankMultiplier(stats.techniquePower), 1),
      finalDefensePressure: roundPreviewNumber(base.baseDefensePressure * getDuelRankMultiplier(stats.ceControl), 1),
      finalJackpotGauge: roundPreviewNumber(base.baseJackpotGauge * Math.max(getDuelRankMultiplier(stats.domainSkill), getDuelRankMultiplier(stats.ceEfficiency)), 1),
      previewOnly: true,
      source: "1.390A-combat-preview"
    };
  }

  function buildDuelCardNumericPreview(actionOrCandidate, characterOrActor, options) {
    var preview = calculateDuelCardFinalPreview(actionOrCandidate, characterOrActor || {}, options || {});
    var lines = [];
    var base = preview.base;
    if (base.baseDamage) lines.push("基础伤害：" + formatPlainNumber(base.baseDamage) + "，最终预估：" + formatPlainNumber(preview.finalDamage) + "。");
    if (base.baseBlock || base.baseShield) lines.push("基础防御：" + formatPlainNumber(Math.max(base.baseBlock, base.baseShield)) + "，最终防御：" + formatPlainNumber(preview.finalBlock) + "。");
    if (base.baseHealing) lines.push("基础治疗：" + formatPlainNumber(base.baseHealing) + "，最终恢复：" + formatPlainNumber(preview.finalHealing) + "。");
    if (base.baseDomainPressure) lines.push("基础领域压制：" + formatPlainNumber(base.baseDomainPressure) + "，最终领域压制：" + formatPlainNumber(preview.finalDomainPressure) + "。");
    if (base.baseEvidencePressure) lines.push("证据压力：" + formatPlainNumber(base.baseEvidencePressure) + " → " + formatPlainNumber(preview.finalEvidencePressure) + "。");
    if (base.baseJackpotGauge) lines.push("jackpot 期待度：" + formatPlainNumber(base.baseJackpotGauge) + " → " + formatPlainNumber(preview.finalJackpotGauge) + "。");
    if (base.baseStabilityDamage) lines.push("稳定冲击：" + formatPlainNumber(base.baseStabilityDamage) + "。");
    if (base.baseStabilityRestore) lines.push("稳定恢复：" + formatPlainNumber(base.baseStabilityRestore) + "。");
    if (base.baseDomainLoadDelta) lines.push("领域负荷变化：" + (base.baseDomainLoadDelta > 0 ? "+" : "") + formatPlainNumber(base.baseDomainLoadDelta) + "。");
    lines.push("基础咒力消耗：" + formatPlainNumber(preview.cost.baseCost) + "，效率修正后：" + formatPlainNumber(preview.cost.finalCost) + "。");
    lines.push("属性修正：" + [
      "咒力输出 " + preview.stats.ceOutput,
      "最大输出 " + preview.stats.ceMaxOutput,
      "咒力操控 " + preview.stats.ceControl,
      "术式 " + preview.stats.techniquePower,
      "体术 " + preview.stats.physicalPower,
      "速度 " + preview.stats.speed,
      "咒具 " + preview.stats.weaponMastery
    ].join(" / ") + "。");
    return { ...preview, lines: cleanPreviewLines(lines) };
  }

  function inferCardType(action) {
    var id = action?.id || "";
    if (action?.domainSpecific) {
      if (["defend", "remain_silent", "deny_charge", "challenge_evidence", "delay_trial"].includes(id)) return "rule_defense";
      if (["present_evidence", "press_charge", "advance_trial", "rule_pressure", "request_verdict"].includes(id)) return "rule_trial";
      if (["advance_jackpot", "raise_probability", "risk_spin", "stabilize_cycle", "claim_jackpot"].includes(id)) return "jackpot";
      return "special";
    }
    if (id === "domain_expand") return "domain";
    if (["domain_compress", "domain_force_sustain", "domain_release"].includes(id)) return "domain_maintenance";
    if (id.includes("domain") || id.includes("basket") || id.includes("blossom") || id.includes("bypass")) return "domain_response";
    if (id === "defensive_frame") return "defense";
    if (id === "ce_compression") return "resource";
    if (id === "residue_reading") return "support";
    if (id.includes("technique") || id.includes("forced")) return "technique";
    return "basic";
  }

  function inferRarity(action, cardType) {
    if (["domain", "domain_maintenance", "domain_response"].includes(cardType)) return "domain";
    if (["rule_trial", "rule_defense", "jackpot"].includes(cardType)) return "rule";
    if (action?.risk === "critical") return "special";
    if (action?.risk === "high") return "rare";
    if (action?.risk === "medium") return "uncommon";
    return "common";
  }

  function inferTags(action, cardType) {
    var tags = [];
    if (cardType.includes("domain")) tags.push("领域");
    if (cardType.includes("rule")) tags.push("审判");
    if (cardType === "jackpot") tags.push("坐杀搏徒");
    if (cardType === "resource") tags.push("咒力");
    if (cardType === "defense") tags.push("防御");
    if (cardType === "technique") tags.push("术式");
    if (action?.risk) tags.push(action.risk);
    return Array.from(new Set(tags.filter(Boolean)));
  }

  function normalizeDuelCardTemplate(template, action) {
    var activeAction = action || {};
    var sourceActionId = template?.sourceActionId || activeAction.id || "";
    var cardType = template?.cardType || inferCardType(activeAction);
    var rarity = template?.rarity || inferRarity(activeAction, cardType);
    return {
      cardId: template?.cardId || ("card_" + sourceActionId),
      sourceActionId: sourceActionId,
      name: template?.name || activeAction.label || sourceActionId || "未命名卡牌",
      cardType: cardType,
      apCost: Number(template?.apCost || activeAction.apCost || 1),
      ceCostMode: template?.ceCostMode || "from_action",
      tags: Array.isArray(template?.tags) && template.tags.length ? template.tags.slice() : inferTags(activeAction, cardType),
      rarity: rarity,
      weight: Number(template?.weight ?? activeAction.weight ?? 1),
      allowedContexts: Array.isArray(template?.allowedContexts) ? template.allowedContexts.slice() : ["normal"],
      effectSummary: template?.effectSummary || activeAction.description || "沿用既有手法效果。",
      risk: template?.risk || activeAction.risk || "medium",
      status: template?.status || "CANDIDATE"
    };
  }

  function getDuelCardTemplateForAction(actionOrCandidate) {
    var action = actionOrCandidate?.action || actionOrCandidate;
    var sourceActionId = getActionId(actionOrCandidate);
    var template = getDuelCardTemplateBySourceActionId(sourceActionId) ||
      getDuelCardTemplateBySourceActionId(action?.id);
    return normalizeDuelCardTemplate(template, action || { id: sourceActionId });
  }

  function getDuelCardTypeLabel(cardType) {
    var rules = getDuelCardTemplateRules();
    return rules?.cardTypeLabels?.[cardType] || defaultTypeLabels[cardType] || cardType || "未知";
  }

  function getDuelCardRarityLabel(rarity) {
    var rules = getDuelCardTemplateRules();
    return rules?.rarityLabels?.[rarity] || defaultRarityLabels[rarity] || rarity || "common";
  }

  function isReadablePreviewText(value) {
    if (typeof value !== "string") return false;
    var text = value.trim();
    return Boolean(text) && !/(undefined|null|TODO|NaN)/i.test(text);
  }

  function cleanPreviewLines(lines) {
    return Array.from(new Set((lines || []).filter(isReadablePreviewText)));
  }

  function readFiniteNumber(sources, key) {
    for (var index = 0; index < sources.length; index += 1) {
      var source = sources[index];
      if (!source || !hasOwn(source, key)) continue;
      var value = Number(source[key]);
      if (Number.isFinite(value)) return value;
    }
    return null;
  }

  function formatSignedNumber(value) {
    var rounded = Number(value.toFixed(4));
    return (rounded > 0 ? "+" : "") + String(rounded);
  }

  function formatScaleNumber(value) {
    return Number(value.toFixed(2)).toString();
  }

  function pushKnownNumericPreview(preview, field, value) {
    if (!Number.isFinite(value)) return;
    if (field === "outgoingScale" && value !== 1) {
      preview.riskPreview.push("输出倍率：" + formatScalePercent(value));
      return;
    }
    if (field === "incomingHpScale" && value !== 1) {
      preview.statusPreview.push("受到体势伤害：" + formatScalePercent(value));
      return;
    }
    if (field === "stabilityDelta" && value !== 0) {
      preview.statusPreview.push("稳定度：" + formatSignedPercent(value));
      return;
    }
    if (field === "domainLoadDelta" && value !== 0) {
      preview.resourcePreview.push("己方领域负荷 " + formatSignedNumber(value));
      return;
    }
    if (field === "ceCost" && value > 0) {
      preview.resourcePreview.push("消耗咒力 " + formatSignedNumber(value).replace(/^\+/, ""));
      return;
    }
    if (field === "hpDamage" && value !== 0) {
      preview.riskPreview.push("预计体势伤害 " + formatSignedNumber(value).replace(/^\+/, ""));
      return;
    }
    if (field === "durationRounds" && value > 0) {
      preview.statusPreview.push("持续 " + formatSignedNumber(value).replace(/^\+/, "") + " 回合");
    }
  }

  function buildEffectPreview(actionOrCandidate, template, baseView, display, availabilityMessage) {
    var action = actionOrCandidate?.action || actionOrCandidate || {};
    var richPreview = buildDuelCardEffectPreview(actionOrCandidate, template, display, baseView);
    var numericPreview = buildDuelCardNumericPreview(
      actionOrCandidate,
      baseView?.actor || baseView?.characterCardProfile || actionOrCandidate?.characterCardProfile || {}
    );
    var preview = {
      resourcePreview: cleanPreviewLines(richPreview.resourceLines || []),
      statusPreview: cleanPreviewLines([].concat(richPreview.combatLines || []).concat(richPreview.statusLines || [])),
      riskPreview: cleanPreviewLines(richPreview.riskLines || []),
      conditionPreview: cleanPreviewLines(richPreview.conditionLines || []),
      debugFields: []
    };
    if (isReadablePreviewText(availabilityMessage) && availabilityMessage !== "可用") {
      preview.conditionPreview = cleanPreviewLines(preview.conditionPreview.concat([availabilityMessage]));
    }
    var resolvedEffectLines = cleanPreviewLines([]
      .concat(preview.resourcePreview)
      .concat(preview.statusPreview)
      .concat(preview.riskPreview)
      .concat(preview.conditionPreview));
    var summary = richPreview.summary || resolvedEffectLines[0] || display?.shortEffect || template?.effectSummary || action?.description || "沿用既有手法效果。";
    if (!isReadablePreviewText(summary)) summary = "沿用既有手法效果。";
    preview.debugFields = cleanPreviewLines([
      template?.cardId ? "cardId:" + template.cardId : "",
      template?.sourceActionId || action?.id ? "sourceActionId:" + (template?.sourceActionId || action?.id) : "",
      action?.id ? "actionId:" + action.id : ""
    ]);
    return {
      schema: "jjk-duel-effect-preview",
      version: "1.390A-combat-core-rationalization-pass",
      summary: summary,
      lines: resolvedEffectLines,
      resolvedEffectLines: resolvedEffectLines,
      combatPreview: cleanPreviewLines(richPreview.combatLines || []),
      resourcePreview: preview.resourcePreview,
      statusPreview: preview.statusPreview,
      riskPreview: preview.riskPreview,
      conditionPreview: preview.conditionPreview,
      debugFields: preview.debugFields,
      numericPreview: numericPreview
    };
  }

  function buildDuelCardViewModel(actionOrCandidate, baseView) {
    var action = actionOrCandidate?.action || actionOrCandidate;
    var template = getDuelCardTemplateForAction(actionOrCandidate);
    var copy = getDuelCardCopyForAction(actionOrCandidate, template);
    var display = mergeDuelCardTemplateWithCopy(actionOrCandidate, template, copy);
    var tags = Array.from(new Set([].concat(template.tags || [], baseView?.tags || []).filter(Boolean)));
    var uiTags = normalizeDisplayTags(display.uiTags, tags);
    var displayName = display.displayName || template.name;
    var shortEffect = display.shortEffect || template.effectSummary;
    var availabilityMessage = getDuelCardAvailabilityMessage(
      baseView?.unavailableReason || baseView?.reason || "",
      Boolean(baseView?.available),
      Boolean(baseView?.selected)
    );
    var effectPreview = buildEffectPreview(actionOrCandidate, template, baseView, display, availabilityMessage);
    var finalPreview = effectPreview.numericPreview || buildDuelCardNumericPreview(actionOrCandidate, baseView?.actor || baseView?.characterCardProfile || {});
    return {
      ...template,
      id: baseView?.id || action?.id || template.sourceActionId,
      actionId: baseView?.actionId || action?.id || template.sourceActionId,
      label: displayName,
      name: template.name,
      displayName: displayName,
      subtitle: display.subtitle || "",
      apCost: Number(baseView?.apCost ?? template.apCost ?? 1),
      ceCost: Number(baseView?.ceCost ?? baseView?.costCe ?? 0),
      effectText: shortEffect,
      shortEffect: shortEffect,
      longEffect: display.longEffect || shortEffect,
      flavorLine: display.flavorLine || "",
      risk: baseView?.risk || template.risk,
      riskLabel: getDuelCardRiskLabel(baseView?.risk || template.risk),
      tags: tags,
      uiTags: uiTags,
      cardTypeLabel: getDuelCardTypeDisplayLabel(template.cardType),
      rarityLabel: getDuelCardRarityLabel(template.rarity),
      status: template.status || baseView?.status || "CANDIDATE",
      availabilityMessage: availabilityMessage,
      copyStatus: display.copyStatus || "CANDIDATE",
      effectPreview: effectPreview,
      numericPreview: finalPreview,
      finalPreview: finalPreview,
      previewCeCost: finalPreview.cost,
      scalingProfile: finalPreview.base?.scalingProfile || getDuelCardScalingProfile(actionOrCandidate),
      resolvedEffectLines: effectPreview.resolvedEffectLines,
      resourcePreview: effectPreview.resourcePreview,
      statusPreview: effectPreview.statusPreview,
      riskPreview: effectPreview.riskPreview,
      conditionPreview: effectPreview.conditionPreview,
      debugFields: effectPreview.debugFields,
      source: "card-template"
    };
  }

  function buildDuelCardDisplayModel(actionOrCandidate, baseView) {
    return buildDuelCardViewModel(actionOrCandidate, baseView);
  }

  function getDuelCardTemplateForActionStrict(actionOrCandidate, options) {
    var action = actionOrCandidate?.action || actionOrCandidate;
    var sourceActionId = getActionId(actionOrCandidate);
    var cards = Array.isArray(options?.cards) ? options.cards : null;
    var template = cards
      ? cards.find(function findCard(item) {
        return item?.sourceActionId === sourceActionId || item?.sourceActionId === action?.id;
      })
      : (getDuelCardTemplateBySourceActionId(sourceActionId) || getDuelCardTemplateBySourceActionId(action?.id));
    if (!template) {
      return {
        found: false,
        reason: "missing_card_template",
        sourceActionId: sourceActionId || action?.id || "",
        template: null
      };
    }
    return {
      found: true,
      reason: "",
      sourceActionId: template.sourceActionId || sourceActionId || action?.id || "",
      template: normalizeDuelCardTemplate(template, action || { id: sourceActionId })
    };
  }

  function validateDuelCardTemplateSchema(cardRulesOrCards, options) {
    var cards = Array.isArray(cardRulesOrCards)
      ? cardRulesOrCards
      : (Array.isArray(cardRulesOrCards?.cards) ? cardRulesOrCards.cards : getDuelCardTemplates());
    var requiredFields = Array.isArray(options?.requiredFields) ? options.requiredFields : requiredTemplateFields;
    var forbiddenFields = Array.isArray(options?.forbiddenFields) ? options.forbiddenFields : forbiddenEffectFields;
    var missingFields = [];
    var forbiddenFieldHits = [];
    var statusIssues = [];
    cards.forEach(function validateCard(card, index) {
      requiredFields.forEach(function checkField(field) {
        if (!hasRequiredCardField(card, field)) {
          missingFields.push({
            cardId: card?.cardId || "",
            sourceActionId: card?.sourceActionId || "",
            index: index,
            field: field
          });
        }
      });
      forbiddenFields.forEach(function checkForbidden(field) {
        if (hasOwn(card || {}, field)) {
          forbiddenFieldHits.push({
            cardId: card?.cardId || "",
            sourceActionId: card?.sourceActionId || "",
            index: index,
            field: field
          });
        }
      });
      if (card?.status !== "CANDIDATE") {
        statusIssues.push({
          cardId: card?.cardId || "",
          sourceActionId: card?.sourceActionId || "",
          index: index,
          status: card?.status || ""
        });
      }
    });
    return {
      ok: missingFields.length === 0 && forbiddenFieldHits.length === 0 && statusIssues.length === 0,
      totalCards: cards.length,
      requiredFields: requiredFields.slice(),
      forbiddenFields: forbiddenFields.slice(),
      missingFields: missingFields,
      forbiddenFieldHits: forbiddenFieldHits,
      statusIssues: statusIssues
    };
  }

  function getDuelCardTemplateCoverage(options) {
    var cards = Array.isArray(options?.cards) ? options.cards : getDuelCardTemplates();
    var playableCards = cards.filter(function keepPlayable(card) {
      return card?.futureTemplate !== true && card?.playableInHandBeta !== false;
    });
    var sourceActions = collectDuelCardAuditActions(options);
    var sourceIds = new Set(sourceActions.map(function getId(action) { return action.id; }).filter(Boolean));
    var cardSourceIds = playableCards.map(function getSource(card) { return card?.sourceActionId || ""; }).filter(Boolean);
    var cardIdDuplicates = findDuplicateValues(cards.map(function getCardId(card) { return card?.cardId || ""; }).filter(Boolean));
    var sourceActionIdDuplicates = findDuplicateValues(cardSourceIds);
    var missingCardTemplates = sourceActions
      .filter(function missingAction(action) { return !cardSourceIds.includes(action.id); })
      .map(compactAuditAction);
    var orphanCardTemplates = playableCards
      .filter(function orphanCard(card) { return card?.sourceActionId && !sourceIds.has(card.sourceActionId); })
      .map(function mapOrphan(card) {
        return {
          cardId: card.cardId || "",
          sourceActionId: card.sourceActionId || "",
          name: card.name || ""
        };
      });
    var matchedSourceActionIds = cardSourceIds.filter(function isMatched(id) { return sourceIds.has(id); });
    return {
      actionTemplateTotal: sourceActions.length,
      cardTemplateTotal: cards.length,
      matchedSourceActionIdCount: matchedSourceActionIds.length,
      matchedSourceActionIds: matchedSourceActionIds,
      missingCardTemplates: missingCardTemplates,
      orphanCardTemplates: orphanCardTemplates,
      duplicateCardIds: cardIdDuplicates,
      duplicateSourceActionIds: sourceActionIdDuplicates,
      sourceActions: sourceActions.map(compactAuditAction),
      ok: missingCardTemplates.length === 0 &&
        orphanCardTemplates.length === 0 &&
        cardIdDuplicates.length === 0 &&
        sourceActionIdDuplicates.length === 0
    };
  }

  function getDuelCardTemplateFallbackStats(actionsOrOptions, maybeOptions) {
    var options = Array.isArray(actionsOrOptions)
      ? { ...(maybeOptions || {}), actions: actionsOrOptions }
      : (actionsOrOptions || {});
    var actions = Array.isArray(options.actions) ? options.actions : collectDuelCardAuditActions(options);
    var threshold = Number.isFinite(Number(options.maxFallbackRatio)) ? Number(options.maxFallbackRatio) : 0.05;
    var fallbackActionIds = [];
    actions.forEach(function checkAction(action) {
      var strict = getDuelCardTemplateForActionStrict(action, options);
      if (!strict.found) fallbackActionIds.push(action?.id || "");
    });
    var totalActions = actions.length;
    var fallbackCount = fallbackActionIds.filter(Boolean).length;
    var fallbackRatio = totalActions ? Number((fallbackCount / totalActions).toFixed(4)) : 0;
    return {
      totalActions: totalActions,
      explicitTemplateCount: Math.max(0, totalActions - fallbackCount),
      fallbackCount: fallbackCount,
      fallbackRatio: fallbackRatio,
      fallbackActionIds: fallbackActionIds.filter(Boolean),
      maxFallbackRatio: threshold,
      overThreshold: fallbackRatio > threshold
    };
  }

  function auditDuelCardTemplateDrift(options) {
    var cardRules = options?.cardRules || getDuelCardTemplateRules();
    var cards = Array.isArray(options?.cards) ? options.cards : (Array.isArray(cardRules?.cards) ? cardRules.cards : getDuelCardTemplates());
    var auditOptions = { ...(options || {}), cards: cards };
    var schema = validateDuelCardTemplateSchema(cards, auditOptions);
    var coverage = getDuelCardTemplateCoverage(auditOptions);
    var fallback = getDuelCardTemplateFallbackStats({
      ...auditOptions,
      actions: coverage.sourceActions
    });
    var highRiskMappings = findHighRiskCardMappings(cards, coverage.sourceActions);
    var blockingDrift = []
      .concat(coverage.missingCardTemplates.map(function asIssue(item) { return { type: "missing_template", sourceActionId: item.id, name: item.label || "" }; }))
      .concat(coverage.orphanCardTemplates.map(function asIssue(item) { return { type: "orphan_template", sourceActionId: item.sourceActionId, cardId: item.cardId }; }))
      .concat(coverage.duplicateCardIds.map(function asIssue(id) { return { type: "duplicate_cardId", cardId: id }; }))
      .concat(coverage.duplicateSourceActionIds.map(function asIssue(id) { return { type: "duplicate_sourceActionId", sourceActionId: id }; }))
      .concat(schema.missingFields.map(function asIssue(item) { return { type: "missing_field", cardId: item.cardId, field: item.field }; }))
      .concat(schema.forbiddenFieldHits.map(function asIssue(item) { return { type: "forbidden_field", cardId: item.cardId, field: item.field }; }))
      .concat(schema.statusIssues.map(function asIssue(item) { return { type: "status_not_candidate", cardId: item.cardId, status: item.status }; }));
    if (fallback.overThreshold) {
      blockingDrift.push({
        type: "fallback_overuse",
        fallbackCount: fallback.fallbackCount,
        fallbackRatio: fallback.fallbackRatio,
        maxFallbackRatio: fallback.maxFallbackRatio
      });
    }
    return {
      version: version,
      status: "CANDIDATE",
      ok: blockingDrift.length === 0,
      result: blockingDrift.length ? "DRIFT_FOUND" : "NO_BLOCKING_DRIFT",
      cardRulesVersion: cardRules?.version || "",
      coverage: coverage,
      schema: schema,
      fallback: fallback,
      highRiskMappings: highRiskMappings,
      blockingDrift: blockingDrift,
      notes: blockingDrift.length ? "Review blocking drift before expanding card templates." : "No blocking drift found."
    };
  }

  function hasRequiredCardField(card, field) {
    if (!hasOwn(card || {}, field)) return false;
    var value = card[field];
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "string") return value.trim().length > 0;
    return value !== null && value !== undefined;
  }

  function collectDuelCardAuditActions(options) {
    var state = dependencies.state || {};
    var actionRules = options?.actionRules || options?.duelActionRules || state.duelActionRules || {};
    var domainRules = options?.domainRules || options?.duelDomainProfiles || state.duelDomainProfiles || {};
    var trialRules = options?.trialRules || options?.duelTrialTargetRules || state.duelTrialTargetRules || {};
    var sourceActions = [];
    appendAuditActions(sourceActions, actionRules.templates || options?.actionTemplates || [], "action_template");
    (domainRules.profiles || options?.domainProfiles || []).forEach(function collectProfile(profile) {
      appendAuditActions(sourceActions, profile?.domainActions || [], "domain_profile");
      appendAuditActions(sourceActions, profile?.opponentActions || [], "domain_profile");
    });
    (trialRules.targetClassProfiles || options?.targetClassProfiles || []).forEach(function collectTarget(profile) {
      appendAuditActions(sourceActions, profile?.choices || [], "trial_target");
    });
    return dedupeAuditActions(sourceActions);
  }

  function appendAuditActions(target, actions, source) {
    (actions || []).forEach(function appendAction(action) {
      if (!action?.id || !action?.label) return;
      target.push({
        id: action.id,
        label: action.label,
        risk: action.risk || "",
        role: action.role || action.domainRole || "",
        source: source,
        action: action
      });
    });
  }

  function dedupeAuditActions(actions) {
    var seen = new Set();
    var result = [];
    actions.forEach(function keepFirst(action) {
      if (!action?.id || seen.has(action.id)) return;
      seen.add(action.id);
      result.push(action);
    });
    return result;
  }

  function compactAuditAction(item) {
    return {
      id: item.id || "",
      label: item.label || "",
      risk: item.risk || "",
      role: item.role || "",
      source: item.source || ""
    };
  }

  function findDuplicateValues(values) {
    var seen = new Set();
    var duplicates = new Set();
    values.forEach(function inspectValue(value) {
      if (!value) return;
      if (seen.has(value)) duplicates.add(value);
      seen.add(value);
    });
    return Array.from(duplicates);
  }

  function findHighRiskCardMappings(cards, sourceActions) {
    var actionMap = sourceActions.reduce(function buildMap(map, action) {
      map[action.id] = action;
      return map;
    }, {});
    return (cards || []).reduce(function collectRisk(issues, card) {
      var action = actionMap[card?.sourceActionId];
      if (!action) return issues;
      if (action.risk && card.risk && action.risk !== card.risk) {
        issues.push({
          type: "risk_mismatch",
          cardId: card.cardId || "",
          sourceActionId: card.sourceActionId || "",
          actionRisk: action.risk,
          cardRisk: card.risk
        });
      }
      if (["domain", "domain_maintenance", "domain_response", "rule_trial", "rule_defense", "jackpot", "curse_tool"].includes(card.cardType) && (!Array.isArray(card.allowedContexts) || !card.allowedContexts.length)) {
        issues.push({
          type: "context_gap",
          cardId: card.cardId || "",
          sourceActionId: card.sourceActionId || "",
          cardType: card.cardType || ""
        });
      }
      return issues;
    }, []);
  }

  var api = {
    metadata: Object.freeze({
      namespace: namespace,
      version: version,
      layer: "duel-card-template",
      moduleFormat: "classic-script-iife",
      scriptType: "classic",
      behavior: "metadata",
      ownsBehavior: false,
      status: "CANDIDATE"
    }),
    expectedExports: Object.freeze(expectedExports.slice()),
    expectedDependencies: Object.freeze(expectedDependencyNames.slice()),
    bind: bind,
    register: register,
    hasBinding: hasBinding,
    get: get,
    getBinding: getBinding,
    listBindings: listBindings,
    clearBindings: clearBindings,
    registerDependencies: registerDependencies,
    configure: configure,
    hasDependency: hasDependency,
    listDependencies: listDependencies,
    clearDependencies: clearDependencies,
    getDuelCardTemplateRules: getDuelCardTemplateRules,
    getDuelCardTemplates: getDuelCardTemplates,
    getDuelCardTemplateForAction: getDuelCardTemplateForAction,
    normalizeDuelCardTemplate: normalizeDuelCardTemplate,
    buildDuelCardViewModel: buildDuelCardViewModel,
    buildDuelCardEffectPreview: buildDuelCardEffectPreview,
    getDuelCardCopyRules: getDuelCardCopyRules,
    getDuelCardCopyForAction: getDuelCardCopyForAction,
    normalizeDuelCardCopy: normalizeDuelCardCopy,
    mergeDuelCardTemplateWithCopy: mergeDuelCardTemplateWithCopy,
    buildDuelCardDisplayModel: buildDuelCardDisplayModel,
    getDuelCardRiskLabel: getDuelCardRiskLabel,
    getDuelCardTypeDisplayLabel: getDuelCardTypeDisplayLabel,
    getDuelCardAvailabilityMessage: getDuelCardAvailabilityMessage,
    getDuelCardTypeLabel: getDuelCardTypeLabel,
    getDuelCardRarityLabel: getDuelCardRarityLabel,
    auditDuelCardTemplateDrift: auditDuelCardTemplateDrift,
    getDuelCardTemplateCoverage: getDuelCardTemplateCoverage,
    getDuelCardTemplateForActionStrict: getDuelCardTemplateForActionStrict,
    validateDuelCardTemplateSchema: validateDuelCardTemplateSchema,
    getDuelCardTemplateFallbackStats: getDuelCardTemplateFallbackStats,
    getDuelCharacterCombatStats: getDuelCharacterCombatStats,
    getDuelRankMultiplier: getDuelRankMultiplier,
    getDuelEfficiencyCostMultiplier: getDuelEfficiencyCostMultiplier,
    getDuelCardScalingProfile: getDuelCardScalingProfile,
    calculateDuelCardBaseEffect: calculateDuelCardBaseEffect,
    calculateDuelCardFinalPreview: calculateDuelCardFinalPreview,
    calculateDuelCardCeCost: calculateDuelCardCeCost,
    calculateDuelDamageFromCard: calculateDuelDamageFromCard,
    calculateDuelBlockFromCard: calculateDuelBlockFromCard,
    calculateDuelHealingFromCard: calculateDuelHealingFromCard,
    calculateDuelDomainPressureFromCard: calculateDuelDomainPressureFromCard,
    buildDuelCardNumericPreview: buildDuelCardNumericPreview,
    buildDuelCardTemplateIndexes: buildDuelCardTemplateIndexes,
    getDuelCardTemplateIndex: getDuelCardTemplateIndex,
    getDuelCardTemplateBySourceActionId: getDuelCardTemplateBySourceActionId,
    warmDuelCardTemplateCache: warmDuelCardTemplateCache,
    invalidateDuelCardTemplateCache: invalidateDuelCardTemplateCache,
    getDuelCardTemplateCacheStats: function getDuelCardTemplateCacheStats() {
      return {
        cardIndexReady: Boolean(cardTemplateIndexCache),
        lastInvalidatedAt: cardTemplateCacheStats.lastInvalidatedAt
      };
    }
  };

  global[namespace] = api;
})(globalThis);
