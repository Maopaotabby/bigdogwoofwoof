//--斗蛐蛐与角色对战运行时--//
function addCustomDuelCharacter() {
  const form = readCustomDuelForm();
  if (!form) return;
  const editingId = state.customDuelEditId;
  const card = buildCustomDuelCard(form, editingId);
  const existingIndex = editingId ? state.customDuelCards.findIndex((item) => item.characterId === editingId) : -1;
  if (existingIndex >= 0) {
    state.customDuelCards[existingIndex] = card;
    state.customDuelEditId = "";
  } else {
    state.customDuelCards.push(card);
  }
  state.pendingCustomDuelHandCards = [];
  state.pendingCustomDuelDomainScript = null;
  state.duelBattle = null;
  renderDuelCustomList();
  renderPendingCustomDuelHandList();
  syncCustomDuelEditMode();
  renderDuelMode();

  if (existingIndex >= 0) {
    if (els.duelLeftSelect?.value === editingId) els.duelLeftSelect.value = card.characterId;
    if (els.duelRightSelect?.value === editingId) els.duelRightSelect.value = card.characterId;
  } else if (state.customDuelCards.length === 1 && els.duelLeftSelect) {
    els.duelLeftSelect.value = card.characterId;
  } else if (els.duelRightSelect) {
    els.duelRightSelect.value = card.characterId;
  }
  renderDuelMode();
  notifyDuelCharacterPoolChanged();
}

function notifyDuelCharacterPoolChanged() {
  if (typeof document === "undefined") return;
  document.dispatchEvent(new CustomEvent("jjk-duel-character-pool-changed", {
    detail: {
      customCount: state.customDuelCards.length,
      totalCount: getDuelCharacterCards().length
    }
  }));
}

function readCustomDuelForm() {
  const name = normalizeCustomDuelText(els.duelCustomName?.value || "");
  if (!name) {
    window.alert("请先填写自定义角色名字。");
    els.duelCustomName?.focus();
    return null;
  }
  const stats = { ...DUEL_DEFAULT_CUSTOM_STATS };
  els.duelCustomRankSelects?.forEach((select) => {
    const stat = select.dataset.duelCustomRank;
    if (!stat) return;
    stats[stat] = DUEL_RANKS.includes(select.value) ? select.value : (DUEL_DEFAULT_CUSTOM_STATS[stat] || "B");
  });
  const librarySelection = readDuelLibrarySelection();

  return {
    name,
    visibleGrade: els.duelCustomGrade?.value || "grade2",
    stage: getValidDuelStage(els.duelCustomStage?.value || "custom"),
    techniquePower: els.duelCustomTechniquePower?.value || "B",
    technique: mergeDuelLocalList(splitCustomDuelList(els.duelCustomTechnique?.value || ""), librarySelection.techniques).join("、"),
    domain: mergeDuelLocalList(splitCustomDuelList(els.duelCustomDomain?.value || ""), librarySelection.domains).join("、"),
    tools: splitCustomDuelList(els.duelCustomTools?.value || ""),
    traits: mergeDuelLocalList(splitCustomDuelList(els.duelCustomTraits?.value || ""), librarySelection.advanced),
    mechanismTags: readSelectedDuelDefinitionValues(els.duelCustomMechanisms),
    toolTags: readSelectedDuelDefinitionValues(els.duelCustomToolTags),
    externalResource: mergeDuelLocalList(splitCustomDuelList(els.duelCustomResource?.value || ""), librarySelection.resources).join("、"),
    notes: normalizeCustomDuelText(els.duelCustomNotes?.value || ""),
    librarySelection,
    manualCombatScore: parseOptionalDuelNumber(els.duelCustomCombatScore?.value, 0, 12),
    manualCombatUnit: parseOptionalDuelNumber(els.duelCustomCombatUnit?.value, 1, 99999999),
    customHandCards: (state.pendingCustomDuelHandCards || []).map((card) => ({ ...card })),
    domainScript: state.pendingCustomDuelDomainScript ? { ...state.pendingCustomDuelDomainScript } : null,
    stats
  };
}

function buildCustomDuelCard(form, existingId = "") {
  if (!existingId) state.customDuelSeq += 1;
  const id = existingId || `custom_duel_${Date.now().toString(36)}_${state.customDuelSeq}`;
  const specialHandTag = buildCustomDuelSpecialHandTag(id);
  const selectedMechanisms = Array.from(new Set(form.mechanismTags || []));
  const selectedToolTags = Array.from(new Set(form.toolTags || []));
  const selectedLibrary = {
    techniques: mergeDuelLocalList(form.librarySelection?.techniques || []),
    domains: mergeDuelLocalList(form.librarySelection?.domains || []),
    advanced: mergeDuelLocalList(form.librarySelection?.advanced || []),
    resources: mergeDuelLocalList(form.librarySelection?.resources || [])
  };
  const traits = Array.from(new Set([form.technique, ...form.traits, ...selectedMechanisms].filter(Boolean)));
  const loadout = Array.from(new Set([...(form.tools || []), ...selectedToolTags].filter(Boolean)));
  const customHandCards = normalizeCustomDuelHandCardsForCharacter(form.customHandCards, id, specialHandTag, form.domain, form.domainScript);
  const hp = duelRankValue(form.stats.body);
  const mp = duelRankValue(form.stats.cursedEnergy);
  return {
    name: form.name,
    hp,
    mp,
    "四轴": buildCustomDuelCardAxes(form.stats, form.techniquePower, form.domain, loadout, traits),
    "特殊手札": [specialHandTag],
    specialHandTags: [specialHandTag],
    characterId: id,
    displayName: form.name,
    customDuel: true,
    stage: getValidDuelStage(form.stage || "custom"),
    baseStats: {
      cursedEnergy: form.stats.cursedEnergy,
      control: form.stats.control,
      efficiency: form.stats.efficiency,
      body: form.stats.body,
      martial: form.stats.martial,
      talent: form.stats.talent
    },
    innateTraits: traits,
    loadout,
    selectedMechanisms,
    selectedToolTags,
    selectedLibrary,
    externalResource: form.externalResource || "无",
    techniqueName: form.technique || "无",
    techniqueDescription: "无",
    techniquePower: form.techniquePower || "无",
    domainProfile: form.domain || "无",
    domainScript: form.domainScript || null,
    visibleGrade: DUEL_GRADE_OPTIONS.some((item) => item.value === form.visibleGrade) ? form.visibleGrade : "grade2",
    officialGrade: gradeLabel(form.visibleGrade),
    powerTier: form.visibleGrade === "specialGrade" ? "specialGrade" : "custom",
    debugManualCombatScore: form.manualCombatScore,
    debugManualCombatUnit: form.manualCombatUnit,
    customHandCards,
    notes: form.notes || "无"
  };
}

function buildCustomDuelSpecialHandTag(characterId) {
  return `custom_character_${String(characterId || "custom").replace(/[^\w-]+/g, "_")}`;
}

function buildCustomDuelCardAxes(stats = {}, techniquePower = "B", domain = "", loadout = [], traits = []) {
  const raw = {
    cursedEnergyScore: duelRankValue(stats.cursedEnergy),
    controlScore: duelRankValue(stats.control),
    efficiencyScore: duelRankValue(stats.efficiency),
    bodyScore: duelRankValue(stats.body),
    martialScore: duelRankValue(stats.martial),
    talentScore: duelRankValue(stats.talent)
  };
  const jujutsu = Number((raw.cursedEnergyScore * 0.5 + raw.controlScore * 0.27 + raw.efficiencyScore * 0.23).toFixed(2));
  const body = Number((raw.bodyScore * 0.54 + raw.martialScore * 0.46).toFixed(2));
  const insight = Number((raw.talentScore * 0.72 + raw.controlScore * 0.16 + raw.martialScore * 0.12).toFixed(2));
  const build = Number(Math.min(12, duelRankValue(techniquePower) * 0.38 + (domain ? 0.22 : 0) + Math.min(1.2, (loadout || []).length * 0.25) * 0.18 + Math.min(0.8, (traits || []).length * 0.18) * 0.1).toFixed(2));
  return { "咒术": jujutsu, "肉体": body, "悟性": insight, "构筑": build };
}

function normalizeCustomDuelHandCardsForCharacter(cards = [], characterId = "", specialHandTag = "", domainProfile = "", domainScript = null) {
  const forbiddenDomainNames = getCustomDuelDomainHandNames(domainProfile, domainScript);
  return (cards || [])
    .filter((card) => !isCustomDuelDomainNameHand(card, forbiddenDomainNames))
    .filter((card) => !isCustomDuelRuleSubphaseOnlyHand(card, domainScript))
    .map((card, index) => {
    const id = card.id || `custom_action_${String(characterId || "custom").replace(/[^\w-]+/g, "_")}_${index + 1}`;
    const tags = Array.from(new Set([...(card.tags || []), "自定义", "特殊手札", specialHandTag].filter(Boolean)));
    return {
      ...card,
      id,
      sourceActionId: id,
      cardId: card.cardId || `card_${id}`,
      status: "CANDIDATE",
      customDuelCard: true,
      customCharacterId: characterId,
      exclusiveToCharacters: [characterId],
      specialHandTags: [specialHandTag],
      "特殊手札": [specialHandTag],
      tags
    };
  });
}

function getCustomDuelDomainHandNames(domainProfile = "", domainScript = null) {
  const names = new Set();
  splitCustomDuelList(domainProfile || "").forEach((part) => {
    const cleaned = part.replace(/^(领域展开|开放领域|顶级领域|未完成领域|领域)[:：]?/, "").trim();
    if (cleaned && !/无明确领域|无领域|没有领域|不具备领域|未知|未公开/.test(cleaned)) names.add(cleaned);
  });
  const scriptName = normalizeCustomDuelText(domainScript?.domainName || "");
  if (scriptName && !/无明确领域|无领域|没有领域|不具备领域|未知|未公开/.test(scriptName)) names.add(scriptName);
  return names;
}

function isCustomDuelDomainNameHand(card = {}, forbiddenDomainNames = new Set()) {
  const name = normalizeCustomDuelText(card.name || card.label || "");
  const cardType = normalizeCustomDuelText(card.cardType || card.type || "");
  if (!name) return false;
  if (/^(领域展开|展开领域|domain expansion)$/i.test(name)) return true;
  if (/^(领域展开|展开领域)[·:：\-\s]/i.test(name)) return true;
  if (forbiddenDomainNames.has(name)) return true;
  if (cardType === "domain" && forbiddenDomainNames.size && Array.from(forbiddenDomainNames).some((domainName) => name.includes(domainName) || domainName.includes(name))) return true;
  return false;
}

function isCustomDuelRuleSubphaseOnlyHand(card = {}, domainScript = null) {
  const name = normalizeCustomDuelText(card.name || card.label || "");
  const text = [
    name,
    card.id,
    card.sourceActionId,
    card.description,
    card.effectSummary,
    ...(card.tags || [])
  ].filter(Boolean).join(" ");
  if (/处刑人之剑|死刑判决|请求判决|证据提出|指控推进|辩护|审判牌|trial-replacement|request_verdict|present_evidence|press_charge|advance_trial|rule_pressure|challenge_evidence|deny_charge|delay_trial/i.test(text)) return true;
  if ((domainScript?.scriptType === "rule_trial_execution" || (domainScript?.effectTags || []).includes("rule_trial")) && /审判|裁判|判决|证据|指控|没收|死刑|处刑/.test(text)) return true;
  return false;
}

function normalizeCustomDuelText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 160);
}

function normalizeCustomDuelLongText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 1200);
}

function splitCustomDuelList(value) {
  return String(value || "")
    .split(/[\n,，、;；]+/g)
    .map(normalizeCustomDuelText)
    .filter(Boolean)
    .slice(0, 12);
}

function readSelectedDuelDefinitionValues(select) {
  if (!select) return [];
  return Array.from(select.selectedOptions || [])
    .map((option) => normalizeCustomDuelText(option.value || option.textContent || ""))
    .filter(Boolean)
    .slice(0, 18);
}

function setSelectedDuelDefinitionValues(select, values = []) {
  if (!select) return;
  const selected = new Set((values || []).map(normalizeCustomDuelText).filter(Boolean));
  Array.from(select.options || []).forEach((option) => {
    option.selected = selected.has(normalizeCustomDuelText(option.value || option.textContent || ""));
  });
}

function parseOptionalDuelNumber(value, min, max) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  if (!Number.isFinite(number)) return null;
  return Number(clamp(number, min, max).toFixed(4));
}

function parseRequiredDuelInteger(input, label, min = 0, max = 9999) {
  const raw = typeof input === "object" ? input?.value : input;
  const text = String(raw ?? "").trim();
  if (!/^-?\d+$/.test(text)) {
    throw new Error(`${label}必须填写整数。`);
  }
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${label}必须在 ${min} 到 ${max} 之间。`);
  }
  return value;
}

function populateDuelCustomHandTypeSelect() {
  if (!els.duelCustomHandType) return;
  const labels = state.duelCardTemplateRules?.cardTypeLabels || {};
  const usedTypes = new Set(Object.keys(labels));
  (state.duelCardTemplateRules?.cards || []).forEach((card) => {
    if (card?.cardType) usedTypes.add(card.cardType);
  });
  const options = Array.from(usedTypes)
    .filter(Boolean)
    .sort()
    .map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(labels[type] || type)}（${escapeHtml(type)}）</option>`)
    .join("");
  if (els.duelCustomHandType.dataset.optionSignature === options) return;
  els.duelCustomHandType.innerHTML = options;
  els.duelCustomHandType.dataset.optionSignature = options;
}

function readCustomDuelHandForm() {
  const name = normalizeCustomDuelText(els.duelCustomHandName?.value || "").slice(0, 40);
  if (!name) throw new Error("请先填写手札名称。");
  const cardType = normalizeCustomDuelText(els.duelCustomHandType?.value || "");
  if (!cardType) throw new Error("请选择手札类型。");
  const risk = ["low", "medium", "high", "critical"].includes(els.duelCustomHandRisk?.value)
    ? els.duelCustomHandRisk.value
    : "medium";
  const apCost = parseRequiredDuelInteger(els.duelCustomHandApCost, "AP 消耗", 0, 9);
  const ceCost = parseRequiredDuelInteger(els.duelCustomHandCeCost, "咒力消耗", 0, 999);
  const damage = parseRequiredDuelInteger(els.duelCustomHandDamage, "伤害", 0, 999);
  const block = parseRequiredDuelInteger(els.duelCustomHandBlock, "防御", 0, 999);
  const stability = parseRequiredDuelInteger(els.duelCustomHandStability, "稳定修正", -100, 100);
  const domainLoad = parseRequiredDuelInteger(els.duelCustomHandDomainLoad, "领域负荷", 0, 999);
  const summary = normalizeCustomDuelText(els.duelCustomHandSummary?.value || "") || `${name}：自定义特殊手札。`;
  const tags = splitCustomDuelList(els.duelCustomHandTags?.value || "");
  state.customDuelHandSeq += 1;
  const draftId = `custom_hand_draft_${Date.now().toString(36)}_${state.customDuelHandSeq}`;
  const effects = {
    stabilityDelta: Number((stability / 100).toFixed(4)),
    domainLoadDelta: domainLoad,
    weightDeltas: buildCustomHandWeightDeltas(cardType, damage, block)
  };
  if (block > 0) effects.incomingHpScale = Math.max(0.35, Number((1 - Math.min(block, 80) / 160).toFixed(3)));
  return {
    id: draftId,
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
    baseStabilityRestore: Math.max(0, stability),
    baseDomainLoadDelta: domainLoad,
    durationRounds: 1,
    damageType: inferCustomHandDamageType(cardType),
    scalingProfile: inferCustomHandScalingProfile(cardType),
    rarity: "special",
    weight: 1,
    allowedContexts: ["normal", "domain", "trial_allowed"],
    effects,
    effectSummary: summary,
    risk,
    tags: Array.from(new Set(["自定义", "特殊手札", ...tags].filter(Boolean))),
    logTemplate: summary
  };
}

function buildCustomHandWeightDeltas(cardType, damage, block) {
  const deltas = {};
  if (damage > 0) {
    deltas.technique = cardType === "technique" || cardType === "special" ? 0.8 : 0.25;
    deltas.finisher = Math.min(1.2, damage / 40);
  }
  if (block > 0 || cardType === "defense") {
    deltas.sustain = Math.max(deltas.sustain || 0, 0.65);
    deltas.counter = Math.max(deltas.counter || 0, 0.25);
  }
  if (cardType === "domain") deltas.domain = 1.1;
  if (cardType === "resource") deltas.resource = 0.9;
  if (cardType === "curse_tool") deltas.melee = 0.7;
  return deltas;
}

function inferCustomHandDamageType(cardType) {
  if (cardType === "curse_tool") return "cursed_tool";
  if (cardType === "basic") return "melee";
  if (cardType === "defense" || cardType === "support" || cardType === "resource") return "none";
  return "technique";
}

function inferCustomHandScalingProfile(cardType) {
  if (cardType === "defense") return "defense";
  if (cardType === "domain") return "domain";
  if (cardType === "curse_tool" || cardType === "basic") return "physical";
  return "balanced";
}

function addCustomDuelHandCard() {
  try {
    const card = readCustomDuelHandForm();
    state.pendingCustomDuelHandCards.push(card);
    clearCustomDuelHandForm();
    renderPendingCustomDuelHandList();
    updateCustomDuelHandStatus(`已加入特殊手札：${card.name}`);
  } catch (error) {
    updateCustomDuelHandStatus(error?.message || "特殊手札格式不正确。", true);
    window.alert(error?.message || "特殊手札格式不正确。");
  }
}

function clearCustomDuelHandForm() {
  if (els.duelCustomHandName) els.duelCustomHandName.value = "";
  if (els.duelCustomHandSummary) els.duelCustomHandSummary.value = "";
  if (els.duelCustomHandTags) els.duelCustomHandTags.value = "";
  if (els.duelCustomHandApCost) els.duelCustomHandApCost.value = "1";
  if (els.duelCustomHandCeCost) els.duelCustomHandCeCost.value = "10";
  if (els.duelCustomHandDamage) els.duelCustomHandDamage.value = "10";
  if (els.duelCustomHandBlock) els.duelCustomHandBlock.value = "0";
  if (els.duelCustomHandStability) els.duelCustomHandStability.value = "0";
  if (els.duelCustomHandDomainLoad) els.duelCustomHandDomainLoad.value = "0";
}

function clearPendingCustomDuelHandCards() {
  state.pendingCustomDuelHandCards = [];
  renderPendingCustomDuelHandList();
  updateCustomDuelHandStatus("已清空待接入特殊手札。");
}

function updateCustomDuelHandStatus(message, isError = false) {
  if (!els.duelCustomHandStatus) return;
  els.duelCustomHandStatus.textContent = message;
  els.duelCustomHandStatus.classList.toggle("error-text", Boolean(isError));
}

function renderPendingCustomDuelHandList() {
  if (!els.duelCustomHandList) return;
  const cards = state.pendingCustomDuelHandCards || [];
  if (!cards.length) {
    els.duelCustomHandList.innerHTML = `<p class="muted">暂无待接入特殊手札。</p>`;
    return;
  }
  els.duelCustomHandList.innerHTML = cards.map((card, index) => `
    <article class="duel-custom-item">
      <div>
        <strong>${escapeHtml(card.name || card.label)}</strong>
        <span>${escapeHtml(card.cardType)} · AP ${escapeHtml(card.apCost)} · CE ${escapeHtml(card.baseCeCost)} · 伤害 ${escapeHtml(card.baseDamage)} · 防御 ${escapeHtml(card.baseBlock)}</span>
        <span>${escapeHtml(card.effectSummary || "")}</span>
      </div>
      <div class="duel-custom-actions">
        <button class="secondary danger" type="button" data-custom-hand-remove="${index}">移除</button>
      </div>
    </article>
  `).join("");
  els.duelCustomHandList.querySelectorAll("[data-custom-hand-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.customHandRemove);
      state.pendingCustomDuelHandCards.splice(index, 1);
      renderPendingCustomDuelHandList();
      updateCustomDuelHandStatus("已移除特殊手札。");
    });
  });
}

function editCustomDuelCharacter(characterId) {
  if (!state.debugMode) return;
  const card = state.customDuelCards.find((item) => item.characterId === characterId);
  if (!card) return;
  state.customDuelEditId = characterId;
  if (els.duelCustomName) els.duelCustomName.value = card.displayName || "";
  if (els.duelCustomGrade) els.duelCustomGrade.value = card.visibleGrade || "grade2";
  if (els.duelCustomStage) els.duelCustomStage.value = getValidDuelStage(card.stage || "custom");
  if (els.duelCustomTechniquePower) els.duelCustomTechniquePower.value = DUEL_RANKS.includes(card.techniquePower) ? card.techniquePower : "B";
  els.duelCustomRankSelects?.forEach((select) => {
    const stat = select.dataset.duelCustomRank;
    const value = card.baseStats?.[stat];
    select.value = DUEL_RANKS.includes(value) ? value : (DUEL_DEFAULT_CUSTOM_STATS[stat] || "B");
  });
  const selectedLibrary = card.selectedLibrary || {};
  setSelectedDuelDefinitionValues(els.duelCustomTechniqueTags, selectedLibrary.techniques || []);
  setSelectedDuelDefinitionValues(els.duelCustomDomainTags, selectedLibrary.domains || []);
  setSelectedDuelDefinitionValues(els.duelCustomAdvancedTags, selectedLibrary.advanced || []);
  setSelectedDuelDefinitionValues(els.duelCustomResourceTags, selectedLibrary.resources || []);
  if (["techniques", "domains", "advanced", "resources"].some((key) => (selectedLibrary[key] || []).length)) {
    setDuelCustomMode("library");
  }
  if (els.duelCustomTechnique) {
    els.duelCustomTechnique.value = splitCustomDuelList(card.techniqueName || "")
      .filter((item) => !(selectedLibrary.techniques || []).includes(item))
      .join("、");
  }
  if (els.duelCustomDomain) {
    els.duelCustomDomain.value = splitCustomDuelList(card.domainProfile || "")
      .filter((item) => !(selectedLibrary.domains || []).includes(item))
      .join("、");
  }
  const selectedMechanisms = card.selectedMechanisms || [];
  const selectedToolTags = card.selectedToolTags || [];
  if (els.duelCustomTools) els.duelCustomTools.value = (card.loadout || []).filter((item) => !selectedToolTags.includes(item)).join("、");
  if (els.duelCustomTraits) {
    const technique = card.techniqueName || "";
    els.duelCustomTraits.value = (card.innateTraits || [])
      .filter((item) => item && item !== technique && !selectedMechanisms.includes(item) && !(selectedLibrary.advanced || []).includes(item))
      .join("、");
  }
  setSelectedDuelDefinitionValues(els.duelCustomMechanisms, selectedMechanisms);
  setSelectedDuelDefinitionValues(els.duelCustomToolTags, selectedToolTags);
  if (els.duelCustomResource) {
    els.duelCustomResource.value = splitCustomDuelList(card.externalResource || "")
      .filter((item) => !(selectedLibrary.resources || []).includes(item))
      .join("、");
  }
  if (els.duelCustomNotes) els.duelCustomNotes.value = card.notes || "";
  if (els.duelCustomCombatScore) els.duelCustomCombatScore.value = card.debugManualCombatScore ?? "";
  if (els.duelCustomCombatUnit) els.duelCustomCombatUnit.value = card.debugManualCombatUnit ?? "";
  state.pendingCustomDuelHandCards = (card.customHandCards || []).map((item) => ({ ...item }));
  state.pendingCustomDuelDomainScript = card.domainScript ? { ...card.domainScript } : null;
  renderPendingCustomDuelHandList();
  syncCustomDuelEditMode();
  els.duelCustomName?.focus();
}

function syncCustomDuelEditMode() {
  if (!els.duelCustomAddBtn) return;
  els.duelCustomAddBtn.textContent = state.customDuelEditId ? "保存角色" : "加入角色池";
}

function renderDuelCustomList() {
  if (els.duelCustomCount) {
    els.duelCustomCount.textContent = `${state.customDuelCards.length} 个`;
  }
  syncCustomDuelEditMode();
  if (!els.duelCustomList) return;
  if (!state.customDuelCards.length) {
    els.duelCustomList.innerHTML = `<p class="muted">暂无自定义角色。</p>`;
    return;
  }
  els.duelCustomList.innerHTML = state.customDuelCards.map((card) => `
    <article class="duel-custom-item">
      <div>
        <strong>${escapeHtml(card.displayName)}</strong>
        <span>${escapeHtml(gradeLabel(card.visibleGrade))} · 术式 ${escapeHtml(card.techniquePower || "-")} · ${escapeHtml(formatDuelList(card.loadout))}</span>
        <span>特殊手札 ${escapeHtml((card.customHandCards || []).length)} 张 · 标签 ${escapeHtml((card.specialHandTags || [])[0] || "-")}</span>
      </div>
      <div class="duel-custom-actions">
        <button class="secondary" type="button" data-duel-custom-use="left" data-duel-custom-id="${escapeHtml(card.characterId)}">我方</button>
        <button class="secondary" type="button" data-duel-custom-use="right" data-duel-custom-id="${escapeHtml(card.characterId)}">对方</button>
        <button class="secondary debug-only" type="button" data-duel-custom-edit="${escapeHtml(card.characterId)}">编辑</button>
        <button class="secondary danger" type="button" data-duel-custom-delete="${escapeHtml(card.characterId)}">删除</button>
      </div>
    </article>
  `).join("");
}

function handleCustomDuelListClick(event) {
  const editButton = event.target.closest("[data-duel-custom-edit]");
  if (editButton) {
    editCustomDuelCharacter(editButton.dataset.duelCustomEdit);
    return;
  }
  const deleteButton = event.target.closest("[data-duel-custom-delete]");
  if (deleteButton) {
    removeCustomDuelCharacter(deleteButton.dataset.duelCustomDelete);
    return;
  }
  const useButton = event.target.closest("[data-duel-custom-use]");
  if (useButton) {
    useCustomDuelCharacter(useButton.dataset.duelCustomId, useButton.dataset.duelCustomUse);
  }
}

function useCustomDuelCharacter(characterId, side) {
  if (!state.customDuelCards.some((card) => card.characterId === characterId)) return;
  state.duelBattle = null;
  renderDuelMode();
  const target = side === "right" ? els.duelRightSelect : els.duelLeftSelect;
  if (target) target.value = characterId;
  renderDuelMode();
}

function removeCustomDuelCharacter(characterId) {
  const before = state.customDuelCards.length;
  state.customDuelCards = state.customDuelCards.filter((card) => card.characterId !== characterId);
  if (state.customDuelCards.length === before) return;
  if (state.customDuelEditId === characterId) {
    state.customDuelEditId = "";
    state.pendingCustomDuelHandCards = [];
    state.pendingCustomDuelDomainScript = null;
    renderPendingCustomDuelHandList();
  }
  state.duelBattle = null;
  renderDuelCustomList();
  renderDuelMode();
  notifyDuelCharacterPoolChanged();
}

function clearCustomDuelCharacters() {
  if (!state.customDuelCards.length) return;
  state.customDuelCards = [];
  state.customDuelEditId = "";
  state.pendingCustomDuelHandCards = [];
  state.pendingCustomDuelDomainScript = null;
  state.duelBattle = null;
  renderDuelCustomList();
  renderPendingCustomDuelHandList();
  renderDuelMode();
  notifyDuelCharacterPoolChanged();
}

function addDuelSpecialTerm() {
  const term = readDuelSpecialTermForm();
  if (!term) return;
  state.duelSpecialTermSeq += 1;
  state.duelSpecialTerms.push({
    ...term,
    id: `duel_special_${Date.now().toString(36)}_${state.duelSpecialTermSeq}`
  });
  state.duelBattle = null;
  if (els.duelSpecialTermName) els.duelSpecialTermName.value = "";
  if (els.duelSpecialTermRounds) els.duelSpecialTermRounds.value = "";
  if (els.duelSpecialTermDefinition) els.duelSpecialTermDefinition.value = "";
  renderDuelSpecialTermList();
  renderDuelMode();
}

function readDuelSpecialTermForm() {
  const name = normalizeCustomDuelText(els.duelSpecialTermName?.value || "").slice(0, 30);
  const definition = normalizeCustomDuelLongText(els.duelSpecialTermDefinition?.value || "").slice(0, 360);
  const roundValue = parseOptionalDuelNumber(els.duelSpecialTermRounds?.value, 1, DUEL_SPECIAL_TERM_MAX_ROUNDS);
  const rounds = roundValue == null ? null : Math.round(roundValue);
  const tags = inferDuelSpecialTermTags(name, definition);
  if (!name) {
    window.alert("请先填写特殊词条名。");
    els.duelSpecialTermName?.focus();
    return null;
  }
  if (!definition) {
    window.alert("请先写清特殊词条定义。");
    els.duelSpecialTermDefinition?.focus();
    return null;
  }
  if (tags.includes("survivalRounds") && !rounds) {
    window.alert("耐活/不死类词条需要填写保护回合数。");
    els.duelSpecialTermRounds?.focus();
    return null;
  }
  return {
    name,
    rounds,
    definition,
    category: inferDuelGeneratedCategoryFromTags(tags),
    calculationTemplate: normalizeDuelCalculationTemplate("", inferDuelGeneratedCategoryFromTags(tags)),
    params: rounds ? { rounds } : {},
    source: "manual",
    tags
  };
}

function inferDuelGeneratedCategoryFromTags(tags = []) {
  const set = new Set(tags || []);
  if (set.has("survivalRounds")) return "survival";
  if (set.has("curseAgeGrowth")) return "curseAgeGrowth";
  if (set.has("growthScaling")) return "growth";
  if (set.has("domainSpecialty")) return "domainSpecialty";
  if (set.has("techniqueDisruption")) return "techniqueDisruption";
  if (set.has("bodyBoost")) return "bodyBoost";
  if (set.has("resourceStock")) return "resourceStock";
  if (set.has("burstWindow")) return "burstWindow";
  if (set.has("recovery")) return "recovery";
  if (set.has("specialWeakness")) return "specialWeakness";
  return "growth";
}

function inferDuelSpecialTermTags(name, definition) {
  const text = `${name || ""} ${definition || ""}`;
  const tags = ["debugSpecialTerm"];
  if (/survival|耐活|不会死亡|不会死|不死|不会被杀|不会被击杀|不结算死亡|不结算击杀|不会倒下|锁血/.test(text)) {
    tags.push("survivalRounds");
  }
  if (/growth|curseAgeGrowth|成长|越活越强|长期存活|千年|百年|年限|沉淀|积累/i.test(text)) tags.push("growthScaling");
  if (/curseAgeGrowth|咒灵|咒物|受肉|半人半咒/.test(text) && tags.includes("growthScaling")) tags.push("curseAgeGrowth");
  if (/domain|领域|必中|结界|反领域/.test(text)) tags.push("domainSpecialty");
  if (/disruption|封锁|干扰|扰乱|压制|术式无效|破坏防御|关闭术式|限制行动/.test(text)) tags.push("techniqueDisruption");
  if (/bodyBoost|体质|肉体|力量|速度|耐久|暴君|强化/.test(text)) tags.push("bodyBoost");
  if (/resourceStock|资源|库存|军团|尸体|僵尸|式神|咒灵库存|召唤|傀儡/.test(text)) tags.push("resourceStock");
  if (/burst|爆发|一次性|超频|过载|全力|短时间/.test(text)) tags.push("burstWindow");
  if (/recovery|恢复|再生|反转术式|治疗|续航/.test(text)) tags.push("recovery");
  if (/weakness|弱点|代价|限制|副作用|容易被/.test(text)) tags.push("specialWeakness");
  return Array.from(new Set(tags));
}

function handleDuelSpecialTermListClick(event) {
  const deleteButton = event.target.closest("[data-duel-special-delete]");
  if (deleteButton) removeDuelSpecialTerm(deleteButton.dataset.duelSpecialDelete);
}

function removeDuelSpecialTerm(termId) {
  const before = state.duelSpecialTerms.length;
  state.duelSpecialTerms = state.duelSpecialTerms.filter((term) => term.id !== termId);
  if (state.duelSpecialTerms.length === before) return;
  state.duelBattle = null;
  renderDuelSpecialTermList();
  renderDuelMode();
}

function clearDuelSpecialTerms() {
  if (!state.duelSpecialTerms.length) return;
  state.duelSpecialTerms = [];
  state.duelBattle = null;
  renderDuelSpecialTermList();
  renderDuelMode();
}

function renderDuelSpecialTermList() {
  if (els.duelSpecialTermCount) {
    els.duelSpecialTermCount.textContent = `${state.duelSpecialTerms.length} 条；在角色特质/说明中写入词条名即可触发。`;
  }
  if (!els.duelSpecialTermList) return;
  if (!state.duelSpecialTerms.length) {
    els.duelSpecialTermList.innerHTML = `<p class="muted">暂无特殊词条。</p>`;
    return;
  }
  els.duelSpecialTermList.innerHTML = state.duelSpecialTerms.map((term) => `
    <article class="duel-custom-item">
      <div>
        <strong>${escapeHtml(formatDuelSpecialTermLabel(term))}</strong>
        <span>${escapeHtml(term.definition)} · ${escapeHtml(formatDuelList(term.tags))}</span>
      </div>
      <div class="duel-custom-actions">
        <button class="secondary danger" type="button" data-duel-special-delete="${escapeHtml(term.id)}">删除</button>
      </div>
    </article>
  `).join("");
}

function formatDuelSpecialTermLabel(term) {
  return term?.rounds ? `${term.name}（${term.rounds}回合）` : term?.name || "未命名词条";
}

function getDuelSpecialTermsForAi() {
  return state.duelSpecialTerms.map((term) => ({
    name: term.name,
    category: term.category || "",
    rounds: term.rounds || null,
    params: term.params || {},
    calculationTemplate: term.calculationTemplate || "",
    definition: term.definition,
    tags: term.tags || [],
    source: term.source || "manual"
  }));
}

function applyDuelSpecialTermsToProfile(profile) {
  if (!state.duelSpecialTerms.length) return profile;
  const text = getDuelProfileTermText(profile);
  const matched = state.duelSpecialTerms.filter((term) => term.name && text.includes(term.name));
  if (!matched.length) return profile;
  const survivalRounds = matched
    .filter((term) => (term.tags || []).includes("survivalRounds"))
    .reduce((max, term) => Math.max(max, Number(term.rounds || 0)), 0);
  const impact = summarizeDuelSpecialTermImpact(matched);
  const nextFlags = new Set([...(profile.flags || []), "debugSpecialTerm"]);
  if (survivalRounds > 0) nextFlags.add("survivalRounds");
  for (const term of matched) {
    for (const tag of term.tags || []) nextFlags.add(tag);
  }
  const nextScore = clamp(Number(profile.combatScore || 0) + impact.scoreBonus, 0, 12);
  const nextDisruption = clamp(Number(profile.disruptionScore || 0) + impact.disruptionBonus, 0, 12);
  return {
    ...profile,
    flags: Array.from(nextFlags),
    combatScore: nextScore,
    combatPowerUnit: buildCombatPowerUnit(nextScore),
    pool: classifyInstantCombatPool(nextScore).label,
    disruptionScore: nextDisruption,
    disruptionUnit: buildDuelDisruptionUnit(nextDisruption),
    specialTerms: matched.map((term) => ({
      name: term.name,
      category: term.category || "",
      rounds: term.rounds || null,
      params: term.params || {},
      calculationTemplate: term.calculationTemplate || "",
      definition: term.definition,
      tags: term.tags || [],
      source: term.source || "manual"
    })),
    specialTermImpact: impact,
    survivalRounds: Math.max(Number(profile.survivalRounds || 0), survivalRounds)
  };
}

function summarizeDuelSpecialTermImpact(terms = []) {
  let scoreBonus = 0;
  let disruptionBonus = 0;
  for (const term of terms) {
    const tags = new Set(term.tags || []);
    if (tags.has("growthScaling")) scoreBonus += 0.2;
    if (tags.has("curseAgeGrowth")) scoreBonus += 0.28;
    if (tags.has("domainSpecialty")) {
      scoreBonus += 0.14;
      disruptionBonus += 0.28;
    }
    if (tags.has("techniqueDisruption")) {
      scoreBonus += 0.16;
      disruptionBonus += 0.8;
    }
    if (tags.has("bodyBoost")) scoreBonus += 0.18;
    if (tags.has("resourceStock")) {
      scoreBonus += 0.18;
      disruptionBonus += 0.42;
    }
    if (tags.has("burstWindow")) {
      scoreBonus += 0.16;
      disruptionBonus += 0.36;
    }
    if (tags.has("recovery")) scoreBonus += 0.12;
    if (tags.has("specialWeakness")) {
      scoreBonus -= 0.18;
      disruptionBonus -= 0.12;
    }
  }
  return {
    scoreBonus: Number(clamp(scoreBonus, -0.8, 1.25).toFixed(4)),
    disruptionBonus: Number(clamp(disruptionBonus, -0.8, 2.4).toFixed(4))
  };
}

function getDuelProfileTermText(profile) {
  return [
    profile?.name,
    profile?.techniqueText,
    profile?.domainProfile,
    profile?.externalResource,
    profile?.notes,
    ...(profile?.innateTraits || []),
    ...(profile?.advancedTechniques || []),
    ...(profile?.loadout || [])
  ].filter(Boolean).join(" ");
}

function formatDuelProfileSpecialTerms(profile) {
  return formatDuelList((profile?.specialTerms || []).map(formatDuelSpecialTermLabel));
}

function swapDuelCharacters() {
  if (!els.duelLeftSelect || !els.duelRightSelect) return;
  const left = els.duelLeftSelect.value;
  els.duelLeftSelect.value = els.duelRightSelect.value;
  els.duelRightSelect.value = left;
  state.duelBattle = null;
  renderDuelMode();
}

function applyDuelSideDebugOverride(profile, side) {
  if (!state.debugMode) return profile;
  const scoreInput = side === "right" ? els.duelDebugRightScore : els.duelDebugLeftScore;
  const unitInput = side === "right" ? els.duelDebugRightUnit : els.duelDebugLeftUnit;
  return applyDuelManualCombatOverride(profile, {
    combatScore: parseOptionalDuelNumber(scoreInput?.value, 0, 12),
    combatUnit: parseOptionalDuelNumber(unitInput?.value, 1, 99999999),
    source: side === "right" ? "对方调试覆盖" : "我方调试覆盖"
  });
}

function applyDuelManualCombatOverride(profile, override = {}) {
  const score = override.combatScore;
  const unit = override.combatUnit;
  if (score == null && unit == null) return profile;
  const next = {
    ...profile,
    flags: Array.from(new Set([...(profile.flags || []), "debugManualPower"])),
    manualCombatSource: override.source || "调试直填"
  };
  if (score != null) {
    next.combatScore = clamp(Number(score), 0, 12);
    next.combatPowerUnit = buildCombatPowerUnit(next.combatScore);
    next.pool = classifyInstantCombatPool(next.combatScore).label;
  }
  if (unit != null) {
    const value = Math.max(1, Math.round(Number(unit) || 1));
    next.combatPowerUnit = {
      ...next.combatPowerUnit,
      value,
      label: formatCombatPowerUnit(value),
      band: getCombatPowerUnitBand(value),
      formula: "debug manual combat unit"
    };
  }
  return next;
}

function computeDuelRates(left, right) {
  const manualLeftRate = getDuelManualLeftRate();
  if (Number.isFinite(manualLeftRate)) {
    return {
      leftRate: manualLeftRate,
      rightRate: clamp(1 - manualLeftRate, 0.001, 0.999),
      manualRate: true
    };
  }
  return {
    leftRate: estimateWinRateByCombatUnit(left, right),
    rightRate: estimateWinRateByCombatUnit(right, left),
    manualRate: false
  };
}

function getDuelManualLeftRate() {
  if (!state.debugMode) return NaN;
  const leftRate = parseOptionalDuelRate(els.duelDebugLeftRate?.value);
  if (Number.isFinite(leftRate)) return leftRate;
  const rightRate = parseOptionalDuelRate(els.duelDebugRightRate?.value);
  if (Number.isFinite(rightRate)) return clamp(1 - rightRate, 0.001, 0.999);
  return NaN;
}

function parseOptionalDuelRate(value) {
  const text = String(value ?? "").trim();
  if (!text) return NaN;
  const raw = Number(text);
  if (!Number.isFinite(raw)) return NaN;
  const normalized = raw > 1 ? raw / 100 : raw;
  return clamp(normalized, 0.001, 0.999);
}

function renderDuelDebugStatus(left, right, rates) {
  if (!els.duelDebugStatus) return;
  if (!state.debugMode) {
    els.duelDebugStatus.textContent = "";
    return;
  }
  const pieces = [];
  if (left.manualCombatSource) pieces.push(`我方战力：${left.manualCombatSource}`);
  if (right.manualCombatSource) pieces.push(`对方战力：${right.manualCombatSource}`);
  if (rates.manualRate) pieces.push("胜率：调试直填");
  els.duelDebugStatus.textContent = pieces.length ? pieces.join("；") : "空白则使用公式；胜率填 0-100 或 0-1。";
}

function clearDuelDebugOverrides() {
  [
    els.duelDebugLeftScore,
    els.duelDebugLeftUnit,
    els.duelDebugLeftRate,
    els.duelDebugRightScore,
    els.duelDebugRightUnit,
    els.duelDebugRightRate
  ].forEach((input) => {
    if (input) input.value = "";
  });
  state.duelBattle = null;
  renderDuelMode();
}

function getBattlePageModule() {
  return globalThis.JJKBattlePage || null;
}

function getDuelBattleMode() {
  return state.duelModeState.mode || getBattlePageModule()?.getBattleMode?.() || "none";
}

function setDuelBattleMode(mode, patch = {}) {
  const normalizedMode = ["solo", "online"].includes(mode) ? mode : "none";
  state.duelModeState = {
    ...state.duelModeState,
    mode: normalizedMode,
    ...patch
  };
  getBattlePageModule()?.setBattleMode?.(normalizedMode, {
    activeBattleId: state.duelModeState.activeBattleId,
    activeRoomId: state.duelModeState.activeRoomId,
    playerSide: state.duelModeState.playerSide,
    localLocked: state.duelModeState.localLocked,
    activePage: patch.activePage
  });
  syncDuelModeIsolation();
  return state.duelModeState;
}

function clonePlain(value) {
  if (value == null) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function createDuelPassTurnAction(side = "left", battle = state.duelBattle) {
  const turn = Number(battle?.round || 0) + 1;
  const action = {
    id: "duel_pass_turn",
    label: "本回合待机",
    name: "本回合待机",
    type: "pass",
    cardType: "pass",
    risk: "low",
    costCe: 0,
    ceCost: 0,
    baseCeCost: 0,
    apCost: 0,
    effects: {},
    description: "无法或不选择手札时，保守待机并推进回合。"
  };
  return {
    id: action.id,
    actionId: action.id,
    label: action.label,
    action,
    apCost: 0,
    ceCost: 0,
    source: "pass_turn",
    status: "CANDIDATE",
    selectedRound: turn,
    side
  };
}

function getSelectedOnlineActionSnapshots(side = state.duelModeState.playerSide || "left") {
  const battle = state.duelBattle;
  if (!battle) return [];
  const actorSide = side === "right" ? "right" : "left";
  return getDuelSelectedHandActions(battle, actorSide).map((entry, index) => {
    const action = entry?.action || entry;
    return {
      actionId: entry?.actionId || entry?.id || action?.id || `action_${index + 1}`,
      displayName: entry?.label || action?.label || action?.name || entry?.actionId || `手札 ${index + 1}`,
      cardType: entry?.cardType || action?.cardType || action?.type || "",
      apCost: Number(entry?.apCost ?? action?.apCost ?? 0),
      ceCost: Number(entry?.ceCost ?? action?.ceCost ?? action?.costCe ?? 0),
      selectedRound: Number(entry?.selectedRound || battle.round + 1),
      action: clonePlain(action)
    };
  });
}

function normalizeOnlineResolvedActions(actions = [], side = "left", battle = state.duelBattle) {
  return (Array.isArray(actions) ? actions : []).map((entry, index) => {
    const action = entry?.action || entry?.actionSnapshot || entry;
    const actionId = entry?.actionId || entry?.id || action?.id || `online_${side}_${index + 1}`;
    return {
      ...entry,
      id: actionId,
      actionId,
      label: entry?.label || entry?.displayName || action?.label || action?.name || actionId,
      action: {
        ...(action || {}),
        id: action?.id || actionId,
        label: action?.label || entry?.displayName || entry?.label || actionId
      },
      apCost: Number(entry?.apCost ?? action?.apCost ?? 0),
      ceCost: Number(entry?.ceCost ?? action?.ceCost ?? action?.costCe ?? 0),
      selectedRound: Number(entry?.selectedRound || battle?.round + 1 || 1),
      side
    };
  });
}

function getDuelControlledSide(battle = state.duelBattle) {
  if (battle?.mode === "online" || isOnlineDuelModeActive()) {
    return (battle?.onlinePlayerSide || state.duelModeState.playerSide) === "right" ? "right" : "left";
  }
  return "left";
}

function getDuelSideResources(battle = state.duelBattle, side = getDuelControlledSide(battle)) {
  const actorSide = side === "right" ? "right" : "left";
  return {
    actorSide,
    actor: actorSide === "right" ? battle?.resourceState?.p2 : battle?.resourceState?.p1,
    opponent: actorSide === "right" ? battle?.resourceState?.p1 : battle?.resourceState?.p2
  };
}

function applyOnlineResolvedTurnToBattle(battle, room = {}) {
  const turn = room.reviewState?.lastResolvedTurn || null;
  if (!battle?.resourceState || !turn?.turn) return false;
  battle.onlineAppliedTurns ||= [];
  const turnKey = `${room.roomId || battle.onlineRoomId || "room"}:${turn.turn}`;
  if (battle.onlineAppliedTurns.includes(turnKey)) return true;
  const expectedLocalTurn = battle.round + 1;
  if (Number(turn.turn) !== expectedLocalTurn) return false;

  const leftActions = normalizeOnlineResolvedActions(turn.actions?.left, "left", battle);
  const rightActions = normalizeOnlineResolvedActions(turn.actions?.right, "right", battle);
  appendDuelHandBatchLog(battle, "left", leftActions, { phase: "selected" });
  appendDuelHandBatchLog(battle, "right", rightActions, { phase: "selected" });
  const leftResult = applyDuelSelectedHandActions(battle.resourceState.p1, battle.resourceState.p2, battle, { side: "left", actions: leftActions, clearAfter: false });
  const rightResult = applyDuelSelectedHandActions(battle.resourceState.p2, battle.resourceState.p1, battle, { side: "right", actions: rightActions, clearAfter: false });
  appendDuelHandBatchLog(battle, "left", leftActions, { phase: "executed", result: leftResult });
  appendDuelHandBatchLog(battle, "right", rightActions, { phase: "executed", result: rightResult });

  battle.currentActions = leftResult.actions || [];
  battle.cpuActions = rightResult.actions || [];
  battle.currentAction = battle.currentActions[0] || null;
  battle.cpuAction = battle.cpuActions[0] || null;
  battle.opponentTactic = pickDuelOpponentTactic(battle);
  const domainActivationPairs = [
    ...battle.currentActions.map((action) => ({ action, actor: battle.resourceState.p1, opponent: battle.resourceState.p2, responseAction: battle.cpuActions[0] || null })),
    ...battle.cpuActions.map((action) => ({ action, actor: battle.resourceState.p2, opponent: battle.resourceState.p1, responseAction: battle.currentActions[0] || null }))
  ];
  resolveDuelDomainProfileActivations(battle, domainActivationPairs);
  battle.currentOptions = buildDuelRoundOptions(battle);
  const result = drawWeightedDuelOption(battle.currentOptions, () => duelRandom(battle, "onlineRoundEvent"));
  if (!result) return false;
  battle.operations.push(`online:${room.roomId || battle.onlineRoomId || "room"}:turn:${turn.turn}:left:${leftActions.map((action) => action.actionId).join("+") || "none"}:right:${rightActions.map((action) => action.actionId).join("+") || "none"}:event:${result.index}`);
  applyDuelRoundResult(battle, result);
  if (turn.result?.summary) {
    recordDuelResourceChange(battle, {
      side: turn.result?.winnerHint === "right" ? "right" : turn.result?.winnerHint === "left" ? "left" : "neutral",
      title: `服务器结算摘要 R${turn.turn}`,
      detail: turn.result.summary,
      type: "system",
      delta: { aiSource: turn.source || turn.result?.source || "", leftEffect: turn.result?.leftEffect || "", rightEffect: turn.result?.rightEffect || "" }
    });
  }
  battle.onlineAppliedTurns.push(turnKey);
  battle.currentOptions = [];
  battle.pendingAction = null;
  maybeResolveDuelBattle(battle);
  updateDuelResourceReplayKey(battle);
  return true;
}

function syncOnlineRoomState(room = {}, playerSide = state.duelModeState.playerSide || "left") {
  const battle = state.duelBattle;
  if (!battle || battle.mode !== "online" || !room?.roomId) return null;
  const roomId = String(room.roomId || "");
  if (battle.onlineRoomId && battle.onlineRoomId !== roomId) return battle;
  const side = playerSide === "right" ? "right" : "left";
  const localLocked = room.phase === "turn_selecting" && Boolean(room.turnState?.locks?.[side]);
  const serverRound = Math.max(1, Number(room.round) || 1);
  const targetBattleRound = Math.max(0, serverRound - 1);
  const previousRound = battle.round;
  const activePage = getBattlePageModule()?.getBattlePageState?.().activePage || state.duelModeState.activePage || "online";
  battle.onlineRoomId = roomId;
  battle.onlinePlayerSide = side;
  setDuelBattleMode("online", {
    activeBattleId: battle.battleId,
    activeRoomId: roomId,
    playerSide: side,
    localLocked,
    activePage
  });
  if (targetBattleRound > battle.round) {
    const appliedResolvedTurn = applyOnlineResolvedTurnToBattle(battle, room);
    if (!appliedResolvedTurn || battle.round < targetBattleRound) battle.round = targetBattleRound;
    if (battle.resourceState) battle.resourceState.round = battle.round;
    clearDuelSelectedHandActions(battle, side, { refund: false });
    battle.pendingAction = null;
    battle.currentAction = null;
    battle.currentActions = [];
    battle.cpuAction = null;
    battle.cpuActions = [];
    battle.actionChoices = [];
    battle.handCandidates = [];
    updateDuelActionAvailability(battle);
    battle.actionUiMessage = `服务器已进入第 ${serverRound} 回合，请选择本回合手札。`;
  } else if (room.phase === "turn_resolving") {
    battle.actionUiMessage = "双方已锁定，服务器正在同步结算。";
  } else if (localLocked) {
    battle.actionUiMessage = "行动已锁定，等待对方锁定或服务器结算。";
  } else if (battle.actionUiMessage === "正在提交联机行动..." || battle.actionUiMessage === "正在发送联机行动...") {
    battle.actionUiMessage = previousRound !== battle.round ? "" : "服务器已同步，请选择或锁定本回合手札。";
  }
  renderDuelMode();
  return battle;
}

function isOnlineDuelModeActive() {
  return getDuelBattleMode() === "online" && Boolean(state.duelModeState.activeRoomId);
}

function forceOnlineBattleInterface(playerSide = state.duelModeState.playerSide || "left") {
  const roomId = state.duelModeState.activeRoomId || "";
  const side = playerSide === "right" ? "right" : "left";
  getBattlePageModule()?.activateBattlePage?.("online", { primeMode: "online" });
  return setDuelBattleMode("online", {
    activeRoomId: roomId,
    playerSide: side,
    activePage: "online"
  });
}

function isSoloDuelModeActive() {
  return getDuelBattleMode() === "solo" && Boolean(state.duelModeState.activeBattleId);
}

function syncDuelModeIsolation() {
  const onlineActive = isOnlineDuelModeActive();
  if (els.duelStartBtn) {
    els.duelStartBtn.disabled = onlineActive;
    els.duelStartBtn.setAttribute("aria-disabled", onlineActive ? "true" : "false");
    els.duelStartBtn.textContent = onlineActive ? "联机进行中" : "开始单人对战";
  }
  if (els.duelSwapBtn) {
    els.duelSwapBtn.disabled = onlineActive;
    els.duelSwapBtn.setAttribute("aria-disabled", onlineActive ? "true" : "false");
  }
  if (els.duelModeStatus) {
    const mode = getDuelBattleMode();
    if (mode === "online") {
      const sideText = state.duelModeState.playerSide === "right" ? "右方" : "左方";
      els.duelModeStatus.textContent = `当前为联机对战；你控制：${sideText}；房间：${state.duelModeState.activeRoomId || "未加入"}。`;
    } else if (mode === "solo") {
      els.duelModeStatus.textContent = isSoloDuelModeActive()
        ? "当前为单人对战；手札执行会推进本地战斗。"
        : "当前为单人对战页；开始后显示手札、AP、领域和日志。";
    } else {
      els.duelModeStatus.textContent = "尚未进入对战。";
    }
  }
}

function getDuelCharacterCardById(characterId) {
  const id = String(characterId || "");
  return getDuelCharacterCards().find((card) => card.characterId === id || card.id === id) || null;
}

function evaluateDuelCharacterById(characterId, fallbackSide = "left") {
  const cards = getDuelCharacterCards();
  const fallbackValue = fallbackSide === "right" ? els.duelRightSelect?.value : els.duelLeftSelect?.value;
  const card = getDuelCharacterCardById(characterId) ||
    getDuelCharacterCardById(fallbackValue) ||
    cards[fallbackSide === "right" ? 1 : 0] ||
    cards[0];
  if (!card) return null;
  return applyDuelSideDebugOverride(evaluateDuelCharacterCard(card), fallbackSide);
}

function renderDuelMode() {
  if (!els.duelLeftSelect || !els.duelRightSelect || !state.characterCards) return;
  const cards = getDuelCharacterCards();
  if (!cards.length) {
    if (els.duelSummary) els.duelSummary.innerHTML = `<p class="muted">暂无可用角色卡。</p>`;
    if (els.duelCards) els.duelCards.innerHTML = "";
    syncDuelModeIsolation();
    return;
  }

  syncDuelSelectOptions(cards);
  const leftCard = cards.find((item) => item.characterId === els.duelLeftSelect.value) || cards[0];
  const rightCard = cards.find((item) => item.characterId === els.duelRightSelect.value) || cards[1] || cards[0];
  const left = applyDuelSideDebugOverride(evaluateDuelCharacterCard(leftCard), "left");
  const right = applyDuelSideDebugOverride(evaluateDuelCharacterCard(rightCard), "right");
  const rates = computeDuelRates(left, right);

  els.duelSummary.innerHTML = `
    <div class="duel-rate">
      <span>${escapeHtml(left.name)} 胜率</span>
      <strong>${formatPercent(rates.leftRate)}</strong>
      <small class="muted">${escapeHtml(gradeLabel(left.visibleGrade))} · ${escapeHtml(left.combatPowerUnit.label)}</small>
    </div>
    <div class="duel-versus">VS</div>
    <div class="duel-rate right">
      <span>${escapeHtml(right.name)} 胜率</span>
      <strong>${formatPercent(rates.rightRate)}</strong>
      <small class="muted">${escapeHtml(gradeLabel(right.visibleGrade))} · ${escapeHtml(right.combatPowerUnit.label)}</small>
    </div>
  `;
  renderDuelDebugStatus(left, right, rates);
  renderDuelBattlePanel(left, right, rates.leftRate);
  els.duelCards.innerHTML = `${renderDuelCharacterCard(left, "我方")}${renderDuelCharacterCard(right, "对方")}`;
  syncDuelModeIsolation();
}

function getCurrentDuelProfiles() {
  const cards = getDuelCharacterCards();
  const leftCard = cards.find((item) => item.characterId === els.duelLeftSelect?.value) || cards[0];
  const rightCard = cards.find((item) => item.characterId === els.duelRightSelect?.value) || cards[1] || cards[0];
  if (!leftCard || !rightCard) return null;
  const left = applyDuelSideDebugOverride(evaluateDuelCharacterCard(leftCard), "left");
  const right = applyDuelSideDebugOverride(evaluateDuelCharacterCard(rightCard), "right");
  const rates = computeDuelRates(left, right);
  return {
    left,
    right,
    leftRate: rates.leftRate
  };
}

function startDuelBattle(options = {}) {
  if (isOnlineDuelModeActive() && options.mode !== "online" && !options.allowOnline) {
    forceOnlineBattleInterface(state.duelModeState.playerSide);
    window.alert("当前为联机对战，请在联机战斗界面操作。");
    renderDuelMode();
    return;
  }
  const profiles = options.left && options.right
    ? { left: options.left, right: options.right, leftRate: computeDuelRates(options.left, options.right).leftRate }
    : getCurrentDuelProfiles();
  if (!profiles) return;
  const mode = options.mode === "online" ? "online" : "solo";
  state.duelSpinToken += 1;
  const seed = options.snapshot?.battleSeed || createDuelBattleSeed(profiles.left, profiles.right);
  const battleId = createDuelBattleId(profiles.left, profiles.right, seed);
  const battle = {
    battleId,
    seed,
    replayKey: "",
    operations: ["strategy:balanced"],
    randomLog: [],
    rng: createDuelSeededRng(seed),
    left: profiles.left,
    right: profiles.right,
    baseRate: profiles.leftRate,
    round: 0,
    maxRounds: getDuelMaxRounds(profiles.left, profiles.right),
    legacyMaxRounds: getDuelMaxRounds(profiles.left, profiles.right),
    safetyRoundCap: getDuelSafetyRoundCap(),
    battleEnded: false,
    endReason: "ongoing",
    endingRound: 0,
    finalSnapshot: null,
    finalResourceSnapshot: null,
    finalHandState: null,
    finalDomainState: null,
    leftScore: 0,
    rightScore: 0,
    momentum: 0,
    selectedTactic: "balanced",
    opponentTactic: "balanced",
    currentOptions: [],
    selectedIndex: null,
    phase: "strategy",
    autoRunning: false,
    spinning: false,
    resolved: false,
    winnerSide: "",
    finalRate: null,
    aiNarrative: "",
    aiNarrativeLoading: false,
    aiNarrativeError: "",
    actionChoices: [],
    actionRound: 1,
    selectedHandActions: { left: [], right: [] },
    pendingAction: null,
    actionUiMessage: "",
    currentAction: null,
    currentActions: [],
    cpuAction: null,
    cpuActions: [],
    actionContext: null,
    domainProfileStates: {},
    domainProfileActivations: [],
    domainTrialContext: null,
    domainSubPhase: null,
    log: []
  };
  battle.mode = mode;
  battle.onlineRoomId = options.snapshot?.roomId || "";
  battle.onlineBattleSeed = options.snapshot?.battleSeed || "";
  battle.onlinePlayerSide = options.snapshot ? (state.duelModeState.playerSide || "left") : "";
  battle.resourceState = initializeDuelResourceState(battle);
  battle.resourceLog = battle.resourceState.resourceLog;
  battle.residualLog = battle.resourceState.residualLog;
  initializeDuelHandState(battle);
  battle.replayKey = buildDuelReplayKey(battle);
  battle.resourceState.replayKey = battle.replayKey;
  updateDuelActionAvailability(battle);
  state.duelBattle = battle;
  setDuelBattleMode(mode, {
    activeBattleId: battle.battleId,
    activeRoomId: battle.onlineRoomId || state.duelModeState.activeRoomId || "",
    playerSide: battle.onlinePlayerSide || state.duelModeState.playerSide || null,
    activePage: mode === "online" ? "online" : "solo"
  });
  renderDuelMode();
}

globalThis.startDuelBattle = startDuelBattle;
globalThis.JJKDuelRuntime = {
  ...(globalThis.JJKDuelRuntime || {}),
  startDuelBattle,
  renderDuelMode,
  syncOnlineRoomState,
  getSelectedOnlineActionSnapshots,
  getDuelBattle: () => state.duelBattle,
  getDuelModeState: () => ({ ...state.duelModeState })
};

function getDuelMaxRoundsByGrade(left, right) {
  const leftRank = visibleGradeCategoryRank(left?.visibleGrade);
  const rightRank = visibleGradeCategoryRank(right?.visibleGrade);
  if (!Number.isFinite(leftRank) || !Number.isFinite(rightRank)) return 5;
  const gradeGap = Math.abs(leftRank - rightRank);
  if (gradeGap === 0) return 10;
  if (gradeGap === 1) return 5;
  return 1;
}

function getDuelRoundRuleText(left, right) {
  const leftRank = visibleGradeCategoryRank(left?.visibleGrade);
  const rightRank = visibleGradeCategoryRank(right?.visibleGrade);
  if (!Number.isFinite(leftRank) || !Number.isFinite(rightRank)) return `等级未知：以体势归零或特殊规则结算；技术安全上限 ${formatNumber(getDuelSafetyRoundCap())} 回合`;
  const gradeGap = Math.abs(leftRank - rightRank);
  const baseText = gradeGap === 0 ? "旧节奏参考：同级约 10 回合" : (gradeGap === 1 ? "旧节奏参考：相差一级约 5 回合" : "旧节奏参考：等级差过大约 1 回合");
  const baseRounds = getDuelMaxRoundsByGrade(left, right);
  const survivalFloor = Math.max(getDuelSurvivalRoundFloor(left), getDuelSurvivalRoundFloor(right));
  const survivalText = survivalFloor > baseRounds ? `；特殊词条保护：至少 ${survivalFloor} 回合前不收束` : "";
  return `${baseText}${survivalText}；当前正常终局以体势归零 / 特殊规则为准，技术安全上限 ${formatNumber(getDuelSafetyRoundCap())} 回合`;
}

function getDuelMaxRounds(left, right) {
  return Math.max(
    getDuelMaxRoundsByGrade(left, right),
    getDuelSurvivalRoundFloor(left),
    getDuelSurvivalRoundFloor(right)
  );
}

function getDuelSurvivalRoundFloor(profile) {
  return clamp(Math.round(Number(profile?.survivalRounds || 0)), 0, DUEL_SPECIAL_TERM_MAX_ROUNDS);
}

function getDuelBattleSurvivalFloor(battle) {
  if (!battle) return 0;
  return Math.max(getDuelSurvivalRoundFloor(battle.left), getDuelSurvivalRoundFloor(battle.right));
}

function getDuelEndRules() {
  return callDuelEndConditionImplementation(
    "getDuelEndRules",
    [state.duelEndRules],
    globalThis.JJKDuelEndCondition?.getDuelEndRules
  );
}

function getDuelSafetyRoundCap(battle = state.duelBattle) {
  const rules = getDuelEndRules();
  const debugCap = Number(rules.safety?.debugSafetyRoundCap || 120);
  const normalCap = Number(rules.safety?.normalSafetyRoundCap || 80);
  return state.debugMode || battle?.debugSafetyCap ? debugCap : normalCap;
}

function checkDuelHpEndCondition(battle) {
  return callDuelEndConditionImplementation(
    "checkDuelHpEndCondition",
    [battle, { survivalFloor: getDuelBattleSurvivalFloor(battle) }],
    globalThis.JJKDuelEndCondition?.checkDuelHpEndCondition
  );
}

function checkDuelSafetyCap(battle) {
  return callDuelEndConditionImplementation(
    "checkDuelSafetyCap",
    [battle, getDuelEndRules(), { debugMode: state.debugMode || battle?.debugSafetyCap }],
    globalThis.JJKDuelEndCondition?.checkDuelSafetyCap
  );
}

function resolveDuelBattleEnd(battle) {
  return callDuelEndConditionImplementation(
    "resolveDuelBattleEnd",
    [battle, getDuelEndRules(), { survivalFloor: getDuelBattleSurvivalFloor(battle), debugMode: state.debugMode || battle?.debugSafetyCap }],
    globalThis.JJKDuelEndCondition?.resolveDuelBattleEnd
  );
}

function buildDuelFinalSnapshot(battle) {
  return callDuelEndConditionImplementation(
    "buildDuelFinalSnapshot",
    [battle],
    globalThis.JJKDuelEndCondition?.buildDuelFinalSnapshot
  );
}

function getDuelEndReasonLabel(reason) {
  return callDuelEndConditionImplementation(
    "getDuelEndReasonLabel",
    [reason],
    globalThis.JJKDuelEndCondition?.getDuelEndReasonLabel
  );
}

function getDuelResourceRules() {
  return state.duelResourceRules || {
    status: "CANDIDATE",
    hp: { base: 118, bodyScale: 15.5, martialScale: 10.5, visibleGradeScale: 18, combatUnitScale: 0.012, zeroCeBodyBonus: 22, physicalTagBonus: 14, min: 80, max: 460 },
    ce: { base: 82, cursedEnergyScale: 20, techniqueScale: 9, visibleGradeScale: 22, jujutsuAxisScale: 7.5, zeroCeCap: 32, min: 36, max: 560 },
    regen: { baseRatio: 0.065, controlScale: 0.004, efficiencyScale: 0.006, talentScale: 0.002, efficiencyLockBonus: 0.012, minRatio: 0.035, maxRatio: 0.18 },
    stability: { base: 0.38, controlScale: 0.034, efficiencyScale: 0.028, talentScale: 0.018, topDomainBonus: 0.055, efficiencyLockBonus: 0.045, haxVolatilityPenalty: 0.055, min: 0.2, max: 0.96 },
    domain: { baseThreshold: 58, controlScale: 5.5, efficiencyScale: 4, talentScale: 3.2, visibleGradeScale: 7, topDomainBonus: 24, openDomainBonus: 32, customDomainBonus: 12, domainSustainBonus: 14, activationLoad: 16, eventLoad: 18, maintainLoad: 8, oppositionLoad: 10, lowCeLoad: 8, stabilityRelief: 9, meltdownCeLossRatio: 0.28, meltdownStabilityPenalty: 0.08 },
    events: {
      initiative: { actorCeCost: 5, targetHpDamage: 7, targetCeDamage: 2 },
      technique: { actorCeCost: 15, targetHpDamage: 14, targetCeDamage: 4 },
      melee: { actorCeCost: 4, actorHpRecoil: 2, targetHpDamage: 13, targetCeDamage: 1 },
      resource: { actorCeCost: 9, targetHpDamage: 10, targetCeDamage: 8, targetRegenInterference: 0.18 },
      domain: { actorCeCost: 24, targetHpDamage: 11, targetCeDamage: 8 },
      counter: { actorCeCost: 8, targetHpDamage: 8, targetCeDamage: 13, domainLoadInterference: 12 },
      finisher: { actorCeCost: 22, actorHpRecoil: 4, targetHpDamage: 21, targetCeDamage: 6 },
      backfire: { actorCeCost: 5, targetHpDamage: 12, targetCeDamage: 9 },
      neutral: { actorCeCost: 0, targetHpDamage: 0, targetCeDamage: 0 }
    },
    statusEffects: {
      techniqueImbalance: { label: "术式失衡", rounds: 2, weightPenalty: 1.45, outputScale: 0.72, affectedEvents: ["technique", "domain", "finisher"] },
      ceRegenBlocked: { label: "咒力回流断裂", rounds: 1, regenScale: 0 }
    },
    limits: { minHp: 0, minCe: 0 }
  };
}

function getDuelActionRules() {
  return state.duelActionRules || {
    schema: "jjk-duel-action-templates",
    version: "0.1.0-candidate",
    status: "CANDIDATE",
    choiceCount: 3,
    riskLabels: { low: "低风险", medium: "中风险", high: "高风险", critical: "极高风险" },
    templates: [
      { id: "ce_reinforcement", label: "咒力强化", status: "CANDIDATE", description: "将咒力贴合肉体与近身节奏。", cost: { ceRatio: 0.045, minCe: 10 }, requirements: { domainActive: "any" }, effects: { outgoingScale: 1.12, weightDeltas: { initiative: 0.8, melee: 1.15, finisher: 0.35 }, stabilityDelta: -0.012, domainLoadDelta: 1.5 }, risk: "medium", logTemplate: "你将咒力集中于近身压制，本回合体术与直接输出上升。" },
      { id: "defensive_frame", label: "防御构筑", status: "CANDIDATE", description: "用咒力构成防线。", cost: { ceRatio: 0.035, minCe: 8 }, requirements: { domainActive: "any" }, effects: { incomingHpScale: 0.76, incomingCeScale: 0.88, stabilityDelta: 0.018, weightDeltas: { counter: 0.45, sustain: 0.65 } }, risk: "low", logTemplate: "你先补足防御构筑，减少本回合体势损耗。" },
      { id: "technique_interference", label: "术式干涉", status: "CANDIDATE", description: "干扰对方术式与回流节奏。", cost: { ceRatio: 0.07, minCe: 14 }, requirements: { domainActive: "any" }, effects: { weightDeltas: { counter: 1.15, technique: 0.35 }, opponentWeightDeltas: { technique: -0.7, domain: -0.55 }, opponentStabilityDelta: -0.026, opponentDomainLoadDelta: 7, opponentRegenInterference: 0.22 }, risk: "medium", logTemplate: "你把咒力打入对方术式节奏，干扰其咒力回流与领域维持。" },
      { id: "residue_reading", label: "残秽读解", status: "CANDIDATE", description: "读取对方咒力流向。", cost: { ceRatio: 0.018, minCe: 4 }, requirements: { domainActive: "any" }, effects: { stabilityDelta: 0.024, weightDeltas: { counter: 0.8, initiative: 0.25 }, selfStatus: { id: "residueReading", label: "残秽读解", rounds: 2, value: 1 } }, risk: "low", logTemplate: "你压低输出读取残秽，对方咒力流向被记录。" },
      { id: "forced_output", label: "强制输出", status: "CANDIDATE", description: "强行拉高术式输出。", cost: { ceRatio: 0.11, minCe: 22 }, requirements: { domainActive: "any", blocksOnTechniqueImbalance: true }, effects: { outgoingScale: 1.26, weightDeltas: { technique: 1.15, finisher: 1.35 }, stabilityDelta: -0.045, domainLoadDelta: 6 }, risk: "high", logTemplate: "你强行拉高术式输出，本回合上限提高。" },
      { id: "ce_compression", label: "压缩咒力", status: "CANDIDATE", description: "收束咒力流动。", cost: { ceRatio: 0.028, minCe: 6 }, requirements: { domainActive: "any" }, effects: { outgoingScale: 0.9, stabilityDelta: 0.042, domainLoadDelta: -5, domainLoadScale: 0.72, weightDeltas: { sustain: 0.9, counter: 0.35, finisher: -0.55 } }, risk: "low", logTemplate: "你主动压缩咒力输出，降低领域负荷增长。" },
      { id: "domain_expand", label: "领域展开", status: "CANDIDATE", description: "展开领域进入高压结界。", cost: { ceRatio: 0.18, minCe: 34 }, requirements: { requiresDomainAccess: true, domainActive: false, blocksOnTechniqueImbalance: true }, effects: { activateDomain: true, domainLoadDelta: 18, weightDeltas: { domain: 2.4, technique: 0.7 }, outgoingScale: 1.12, stabilityDelta: -0.018 }, risk: "high", logTemplate: "你展开领域，结界压制启动，领域负荷同步上升。" },
      { id: "domain_compress", label: "压缩领域", status: "CANDIDATE", description: "主动收束领域边界。", cost: { ceRatio: 0.045, minCe: 10 }, requirements: { domainActive: true }, effects: { domainLoadDelta: -10, domainLoadScale: 0.45, outgoingScale: 0.88, stabilityDelta: 0.03, weightDeltas: { domain: -0.5, sustain: 1 } }, risk: "low", logTemplate: "你主动收束领域边界，换取负荷回落。" },
      { id: "domain_force_sustain", label: "强行维持领域", status: "CANDIDATE", description: "不顾负荷继续扩大领域压制。", cost: { ceRatio: 0.13, minCe: 24 }, requirements: { domainActive: true }, effects: { domainLoadDelta: 16, domainLoadScale: 1.45, outgoingScale: 1.2, stabilityDelta: -0.038, weightDeltas: { domain: 1.8, finisher: 0.6 } }, risk: "critical", logTemplate: "你强行维持领域压制，领域收益提高，但负荷逼近熔断线。" },
      { id: "domain_release", label: "主动解除领域", status: "CANDIDATE", description: "主动撤去领域避免熔断。", cost: { ceRatio: 0, minCe: 0 }, requirements: { domainActive: true }, effects: { releaseDomain: true, stabilityDelta: 0.035, domainLoadDelta: -8, weightDeltas: { sustain: 0.75, domain: -1.4 } }, risk: "low", logTemplate: "你主动解除领域，避免领域熔断。" },
      { id: "domain_clash", label: "领域对抗", status: "CANDIDATE", description: "以真正领域展开或高阶领域干涉正面对撞对方领域。", cost: { ceRatio: 0.14, minCe: 28 }, requirements: { opponentDomainActive: true, requiresDomainClash: true }, effects: { weightDeltas: { counter: 1.1, domain: 1.05 }, opponentWeightDeltas: { domain: -1.35, technique: -0.35 }, opponentDomainLoadDelta: 16, domainLoadDelta: 8, sureHitScale: 0.46, domainPressureScale: 0.72, manualAttackScale: 0.92, stabilityDelta: -0.024, lowStabilityHpRecoil: 5 }, risk: "high", logTemplate: "你以领域或高阶结界干涉正面对抗对方领域，推高对方领域负荷，但自身也承受领域负担。" },
      { id: "simple_domain_guard", label: "简易领域防御", status: "CANDIDATE", description: "以简易领域削弱必中，拖住对方领域压制。", cost: { ceRatio: 0.065, minCe: 12 }, requirements: { opponentDomainActive: true, requiresSimpleDomain: true }, effects: { sureHitScale: 0.35, domainPressureScale: 0.72, manualAttackScale: 0.95, incomingHpScale: 0.82, incomingCeScale: 0.9, opponentWeightDeltas: { domain: -0.35 }, opponentDomainLoadDelta: 2, stabilityDelta: -0.006, selfStatus: { id: "simpleDomainWearing", label: "简易领域磨损", rounds: 1, value: 1 } }, risk: "medium", logTemplate: "你展开简易领域削弱必中，结界边界被对方领域持续压缩并开始磨损。" },
      { id: "hollow_wicker_basket_guard", label: "弥虚葛笼", status: "CANDIDATE", description: "以弥虚葛笼抵消必中，但行动和输出受到明显限制。", cost: { ceRatio: 0.055, minCe: 10 }, requirements: { opponentDomainActive: true, requiresHollowWickerBasket: true }, effects: { sureHitScale: 0.28, domainPressureScale: 0.78, manualAttackScale: 1, incomingHpScale: 0.86, outgoingScale: 0.68, weightDeltas: { technique: -0.7, finisher: -0.8, melee: -0.35 }, opponentDomainLoadDelta: 1, selfStatus: { id: "hollowWickerBasketPosture", label: "弥虚葛笼架势受限", rounds: 1, value: 1 } }, risk: "medium", logTemplate: "你维持弥虚葛笼抵消必中，架势被迫固定，输出和机动同步受限。" },
      { id: "falling_blossom_emotion", label: "落花之情", status: "CANDIDATE", description: "以自动迎击削弱必中，是预留的反必中防线而非领域对撞。", cost: { ceRatio: 0.05, minCe: 10 }, requirements: { opponentDomainActive: true, requiresFallingBlossomEmotion: true }, effects: { sureHitScale: 0.48, domainPressureScale: 0.82, manualAttackScale: 0.95, incomingHpScale: 0.88, weightDeltas: { counter: 0.4 }, stabilityDelta: -0.004 }, risk: "medium", logTemplate: "你以落花之情自动迎击必中，削弱命中伤害，但这不是领域对撞。" },
      { id: "zero_ce_domain_bypass", label: "零咒力必中规避", status: "CANDIDATE", description: "零咒力个体不被领域必中正常捕捉，但仍会承受领域压制和手动攻击。", cost: { ceRatio: 0, minCe: 0 }, requirements: { opponentDomainActive: true, requiresZeroCeBypass: true }, effects: { sureHitScale: 0.08, domainPressureScale: 0.82, manualAttackScale: 1, incomingHpScale: 0.88, outgoingScale: 1.02, weightDeltas: { melee: 0.9, initiative: 0.55, counter: 0.35 } }, risk: "low", logTemplate: "零咒力个体不被领域必中正常捕捉，转而寻找近身突入、破坏结界锚点或脱出的机会。" },
      { id: "domain_survival_guard", label: "域内求生", status: "CANDIDATE", description: "缺少硬防线时以体势和咒力硬扛领域，只能争取一回合窗口。", cost: { ceRatio: 0.045, minCe: 0 }, requirements: { opponentDomainActive: true, requiresNoDomainResponse: true }, effects: { sureHitScale: 0.86, domainPressureScale: 0.93, manualAttackScale: 1, incomingHpScale: 0.92, stabilityDelta: -0.025, weightDeltas: { sustain: 0.55, counter: 0.15 } }, risk: "high", logTemplate: "你缺少领域或反领域硬防线，只能以体势和咒力硬扛，等待领域崩解、咒力耗尽或近身机会。" }
    ]
  };
}

function getDuelHandRules() {
  return state.techniqueHandRules || {
    schema: "jjk-duel-hand-rules",
    version: "0.1.0",
    status: "CANDIDATE",
    hand: {
      defaultChoiceCount: 8,
      minChoiceCount: 3,
      maxChoiceCount: 8,
      maxHandSize: 8,
      drawPerTurn: 5,
      overflowDiscardMode: "auto_low_priority_candidate",
      discardFromRemainingAndNew: true,
      selectionMode: "multi_action_ap_beta",
      allowMultipleSelectionsPerTurn: true,
      maxSelectionsPerTurn: 3,
      disableSelectedCandidate: true,
      requireManualResolve: true
    },
    domainHand: {
      enabled: true,
      maxHandSize: 3,
      refreshEachRound: true,
      excludeFromNormalHandLimit: true,
      specialDomainWeightBonus: 2,
      domainAccessWeightBonus: 1
    },
    ap: {
      basePerTurn: 2,
      maxPerTurn: 3,
      carryOver: false
    },
    cardLikeDisplay: {
      enabled: true,
      showApCost: true,
      showCeCost: true,
      showRisk: true,
      showTags: true
    },
    notes: "Hand-like candidates wrap existing duel actions only."
  };
}

function getDuelCharacterCardRules() {
  return state.duelCharacterCardRules || {
    schema: "jjk-duel-character-card-rules",
    version: "0.1.0",
    status: "CANDIDATE",
    description: "Character eligibility and weighting governance for duel hand candidates.",
    defaults: { enabled: false },
    archetypes: {},
    characters: {},
    sourceActionRules: {}
  };
}

function getDuelBetaCopy() {
  return state.duelBetaCopy || {
    version: "0.1.0",
    status: "CANDIDATE",
    title: "术式手札 Beta 反馈",
    summary: "当前为 CANDIDATE / Beta 反馈包，用于复现手札候选与 AP 多行动体验。",
    buttons: {
      export: "导出本场反馈",
      copy: "复制反馈 JSON"
    },
    notePlaceholder: "可选：记录本场试玩反馈。",
    publicHints: [
      "反馈包只用于复现与体验反馈，不参与战斗结算。",
      "当前规则仍为 CANDIDATE / Beta。"
    ]
  };
}

function getDuelCardTemplateRules() {
  return state.duelCardTemplateRules || {
    schema: "jjk-duel-card-templates",
    version: "0.1.0",
    status: "CANDIDATE",
    description: "Card-like template metadata layered over existing duel action templates.",
    cardTypeLabels: {},
    rarityLabels: {},
    cards: []
  };
}

function getDuelCardCopyRules() {
  return state.duelCardCopyRules || {
    schema: "jjk-duel-card-copy",
    version: "0.1.0",
    status: "CANDIDATE",
    description: "Display copy layer for duel hand/card templates. This file does not define combat effects.",
    copy: []
  };
}

function getDuelMechanicTemplateRules() {
  return state.duelMechanicRules || {
    schema: "jjk-duel-mechanic-templates",
    version: "0.1.0-candidate",
    status: "CANDIDATE",
    mechanics: []
  };
}

function getDuelActionTemplates() {
  return callDuelActionsImplementation("getDuelActionTemplates", [], globalThis.JJKDuelActions?.getDuelActionTemplates);
}

function getDuelDomainProfiles() {
  return callDuelDomainProfileImplementation("getDuelDomainProfiles", [], globalThis.JJKDuelDomainProfile?.getDuelDomainProfiles);
}

function normalizeDuelDomainBarrierProfile(domainProfile = {}) {
  return callDuelDomainProfileImplementation(
    "normalizeDuelDomainBarrierProfile",
    [domainProfile],
    globalThis.JJKDuelDomainProfile?.normalizeDuelDomainBarrierProfile
  );
}

function inferDuelDomainBarrierType(domainProfile = {}) {
  return callDuelDomainProfileImplementation(
    "inferDuelDomainBarrierType",
    [domainProfile],
    globalThis.JJKDuelDomainProfile?.inferDuelDomainBarrierType
  );
}

function inferDuelDomainCompletion(domainProfile = {}, barrierType = "unknown") {
  return callDuelDomainProfileImplementation(
    "inferDuelDomainCompletion",
    [domainProfile, barrierType],
    globalThis.JJKDuelDomainProfile?.inferDuelDomainCompletion
  );
}

function getDuelTrialTargetRules() {
  return callDuelRuleSubphaseImplementation("getDuelTrialTargetRules", [], globalThis.JJKDuelRuleSubphase?.getDuelTrialTargetRules);
}

function normalizeDuelTrialEligibility(value = "", fallback = "partial") {
  return callDuelRuleSubphaseImplementation("normalizeDuelTrialEligibility", [value, fallback], globalThis.JJKDuelRuleSubphase?.normalizeDuelTrialEligibility);
}

function getDuelTrialTargetRuleClassId(trialSubjectType = "unknown") {
  return callDuelRuleSubphaseImplementation("getDuelTrialTargetRuleClassId", [trialSubjectType], globalThis.JJKDuelRuleSubphase?.getDuelTrialTargetRuleClassId);
}

function getDuelTrialTargetRuleProfile(trialSubjectType = "unknown") {
  return callDuelRuleSubphaseImplementation("getDuelTrialTargetRuleProfile", [trialSubjectType], globalThis.JJKDuelRuleSubphase?.getDuelTrialTargetRuleProfile);
}

function getDuelTrialTargetLabel(type = "unknown") {
  return callDuelRuleSubphaseImplementation("getDuelTrialTargetLabel", [type], globalThis.JJKDuelRuleSubphase?.getDuelTrialTargetLabel);
}

function getDuelTrialEligibilityLabel(eligibility = "partial") {
  return callDuelRuleSubphaseImplementation("getDuelTrialEligibilityLabel", [eligibility], globalThis.JJKDuelRuleSubphase?.getDuelTrialEligibilityLabel);
}

function getDuelTrialPhaseLabel(eligibility = "partial") {
  return callDuelRuleSubphaseImplementation("getDuelTrialPhaseLabel", [eligibility], globalThis.JJKDuelRuleSubphase?.getDuelTrialPhaseLabel);
}

function normalizeDuelTrialSubjectType(value = "") {
  return callDuelRuleSubphaseImplementation("normalizeDuelTrialSubjectType", [value], globalThis.JJKDuelRuleSubphase?.normalizeDuelTrialSubjectType);
}

function inferDuelTrialSubjectType(profile = {}, resource = null) {
  return callDuelRuleSubphaseImplementation("inferDuelTrialSubjectType", [profile, resource], globalThis.JJKDuelRuleSubphase?.inferDuelTrialSubjectType);
}

function normalizeDuelTrialEligibilityOverride(value, type) {
  return callDuelRuleSubphaseImplementation("normalizeDuelTrialEligibilityOverride", [value, type], globalThis.JJKDuelRuleSubphase?.normalizeDuelTrialEligibilityOverride);
}

function buildDuelTrialTargetProfile(profile = {}, resource = null, domainProfile = {}) {
  return callDuelRuleSubphaseImplementation("buildDuelTrialTargetProfile", [profile, resource, domainProfile], globalThis.JJKDuelRuleSubphase?.buildDuelTrialTargetProfile);
}

function isDuelTrialSubjectEligible(targetProfile = {}) {
  return callDuelRuleSubphaseImplementation("isDuelTrialSubjectEligible", [targetProfile], globalThis.JJKDuelRuleSubphase?.isDuelTrialSubjectEligible);
}

function getDuelTrialVerdictLabel(subPhase, key, fallback) {
  return callDuelRuleSubphaseImplementation("getDuelTrialVerdictLabel", [subPhase, key, fallback], globalThis.JJKDuelRuleSubphase?.getDuelTrialVerdictLabel);
}

function getDuelDomainBarrierModifiers(domainProfile, actor = null, opponent = null, duelState = state.duelBattle) {
  return callDuelDomainProfileImplementation(
    "getDuelDomainBarrierModifiers",
    [domainProfile, actor, opponent, duelState],
    globalThis.JJKDuelDomainProfile?.getDuelDomainBarrierModifiers
  );
}

function applyDuelDomainBarrierModifiers(actor, opponent, event = {}, context = {}) {
  const battle = context.battle || state.duelBattle;
  const stateEntry = context.profileState || battle?.domainProfileStates?.[actor?.side || ""];
  const rawProfile = stateEntry?.profile || getDuelDomainProfileForCharacter(getDuelProfileForSide(battle, actor?.side || ""), null, battle);
  if (!rawProfile) {
    return getDuelDomainBarrierModifiers({ barrierType: "unknown", domainCompletion: "unknown" }, actor, opponent, battle);
  }
  return getDuelDomainBarrierModifiers(rawProfile, actor, opponent, battle);
}

function getDuelDomainBarrierSummary(profile = {}) {
  return callDuelDomainProfileImplementation(
    "getDuelDomainBarrierSummary",
    [profile],
    globalThis.JJKDuelDomainProfile?.getDuelDomainBarrierSummary
  );
}

function getDuelProfileForSide(battle, side) {
  if (side === "left") return battle?.left || null;
  if (side === "right") return battle?.right || null;
  return null;
}

function getDuelActionCost(action, actor) {
  const costPreview = globalThis.JJKDuelCardTemplate?.calculateDuelCardCeCost;
  if (typeof costPreview === "function") {
    const preview = costPreview(action, actor || {});
    if (Number.isFinite(Number(preview?.finalCost))) return Number(preview.finalCost);
  }
  if (action?.costType === "zero_ce" || action?.zeroCeCostOverride) return 0;
  if (Number.isFinite(Number(action?.baseCeCost))) return Math.max(0, Number(action.baseCeCost));
  const cost = action?.cost || {};
  const ratioCost = Number(actor?.maxCe || 0) * Number(cost.ceRatio || 0);
  return Number(Math.max(Number(cost.flatCe || 0), Number(cost.minCe || 0), ratioCost).toFixed(1));
}

function getDuelDomainResponseProfile(profile, actor = null, opponent = null, duelState = state.duelBattle) {
  return callDuelDomainResponseImplementation(
    "getDuelDomainResponseProfile",
    [profile, actor, opponent, duelState],
    globalThis.JJKDuelDomainResponse?.getDuelDomainResponseProfile
  );
}

function hasDuelDomainCounterAccess(profile) {
  return callDuelDomainResponseImplementation(
    "hasDuelDomainCounterAccess",
    [profile],
    globalThis.JJKDuelDomainResponse?.hasDuelDomainCounterAccess
  );
}

function isDuelOpponentDomainThreat(opponent, actor = null, battle = state.duelBattle) {
  return callDuelDomainResponseImplementation(
    "isDuelOpponentDomainThreat",
    [opponent, actor, battle],
    globalThis.JJKDuelDomainResponse?.isDuelOpponentDomainThreat
  );
}

function isDuelDomainActivationAction(action) {
  return callDuelDomainResponseImplementation(
    "isDuelDomainActivationAction",
    [action],
    globalThis.JJKDuelDomainResponse?.isDuelDomainActivationAction
  );
}

function getDuelDomainProfileForCharacter(profile, card = null, duelState = state.duelBattle) {
  return callDuelDomainProfileImplementation(
    "getDuelDomainProfileForCharacter",
    [profile, card, duelState],
    globalThis.JJKDuelDomainProfile?.getDuelDomainProfileForCharacter
  );
}

function buildDuelDomainSpecificActions(actor, opponent, duelState = state.duelBattle) {
  return callDuelActionsImplementation("buildDuelDomainSpecificActions", [actor, opponent, duelState], globalThis.JJKDuelActions?.buildDuelDomainSpecificActions);
}

function invalidateDuelActionChoices(battle = state.duelBattle) {
  return callDuelActionsImplementation("invalidateDuelActionChoices", [battle], globalThis.JJKDuelActions?.invalidateDuelActionChoices);
}

function buildDuelDomainTrialContext(profile, actor, opponent, battle = state.duelBattle, response = {}, options = {}) {
  return callDuelRuleSubphaseImplementation("buildDuelDomainTrialContext", [profile, actor, opponent, battle, response, options], globalThis.JJKDuelRuleSubphase?.buildDuelDomainTrialContext);
}

function updateDuelDomainTrialContext(battle = state.duelBattle, patch = {}) {
  return callDuelRuleSubphaseImplementation("updateDuelDomainTrialContext", [battle, patch], globalThis.JJKDuelRuleSubphase?.updateDuelDomainTrialContext);
}

function getDuelActiveTrialContext(battle = state.duelBattle, subPhase = battle?.domainSubPhase) {
  return callDuelRuleSubphaseImplementation("getDuelActiveTrialContext", [battle, subPhase], globalThis.JJKDuelRuleSubphase?.getDuelActiveTrialContext);
}

function getDuelTrialStatusLabel(status = "pending") {
  return callDuelRuleSubphaseImplementation("getDuelTrialStatusLabel", [status], globalThis.JJKDuelRuleSubphase?.getDuelTrialStatusLabel);
}

function getDuelTrialEndReasonLabel(reason = "") {
  return callDuelRuleSubphaseImplementation("getDuelTrialEndReasonLabel", [reason], globalThis.JJKDuelRuleSubphase?.getDuelTrialEndReasonLabel);
}

function syncDuelTrialSubPhaseLifecycle(battle = state.duelBattle) {
  return callDuelRuleSubphaseImplementation("syncDuelTrialSubPhaseLifecycle", [battle], globalThis.JJKDuelRuleSubphase?.syncDuelTrialSubPhaseLifecycle);
}

function getDuelTrialTargetChoiceTemplates(subPhase = {}, roleFilter = null) {
  return callDuelRuleSubphaseImplementation("getDuelTrialTargetChoiceTemplates", [subPhase, roleFilter], globalThis.JJKDuelRuleSubphase?.getDuelTrialTargetChoiceTemplates);
}

function getDuelTrialOwnerActionTemplates(profile, subPhase = {}) {
  return callDuelRuleSubphaseImplementation("getDuelTrialOwnerActionTemplates", [profile, subPhase], globalThis.JJKDuelRuleSubphase?.getDuelTrialOwnerActionTemplates);
}

function getDuelTrialDefenderActionTemplates(profile, subPhase = {}) {
  return callDuelRuleSubphaseImplementation("getDuelTrialDefenderActionTemplates", [profile, subPhase], globalThis.JJKDuelRuleSubphase?.getDuelTrialDefenderActionTemplates);
}

function getDuelJackpotActionTemplates(profile, subPhase = {}) {
  return callDuelRuleSubphaseImplementation("getDuelJackpotActionTemplates", [profile, subPhase], globalThis.JJKDuelRuleSubphase?.getDuelJackpotActionTemplates);
}

function normalizeDuelDomainSpecificAction(template, profile, actor, opponent, stateEntry = {}, duelState = state.duelBattle) {
  const normalized = {
    id: template.id,
    label: template.label,
    status: "CANDIDATE",
    description: template.description || profile?.domainName || "领域专属手法",
    cost: template.cost || { ceRatio: 0.03, minCe: 0 },
    requirements: { domainSpecific: true },
    effects: template.effects || {},
    risk: template.risk || "medium",
    logTemplate: `${profile?.domainName || "领域"}：${template.description || template.label}`,
    domainSpecific: true,
    domainProfileId: profile?.id || "",
    domainName: profile?.domainName || "",
    domainClass: profile?.domainClass || "",
    domainRole: template.role || "",
    trialEligibility: template.trialEligibility || profile?.trialEligibility || null,
    trialSubjectType: template.trialSubjectType || profile?.trialSubjectType || "",
    hasLegalAgency: template.hasLegalAgency ?? profile?.hasLegalAgency,
    hasSelfAwareness: template.hasSelfAwareness ?? profile?.hasSelfAwareness,
    canDefend: template.canDefend ?? profile?.canDefend,
    canRemainSilent: template.canRemainSilent ?? profile?.canRemainSilent,
    verdictVocabulary: template.verdictVocabulary || profile?.verdictVocabulary || null,
    notes: template.notes || "",
    domainOwnerSide: stateEntry.ownerSide || ""
  };
  const availability = getDuelActionAvailability(normalized, actor, opponent, duelState);
  return {
    ...normalized,
    costCe: availability.costCe,
    available: availability.available,
    unavailableReason: availability.reason,
    riskLabel: getDuelActionRiskLabel(normalized, actor, opponent)
  };
}

function getDuelDomainProfileResponseImpact(responseAction, domainProfile = null) {
  return callDuelDomainResponseImplementation(
    "getDuelDomainProfileResponseImpact",
    [responseAction, domainProfile],
    globalThis.JJKDuelDomainResponse?.getDuelDomainProfileResponseImpact
  );
}

function addOrRefreshDuelStatusEffect(resource, effect = {}) {
  if (!resource || !effect.id) return;
  const normalized = {
    ...effect,
    rounds: Math.max(1, Number(effect.rounds || 1)),
    value: Number(effect.value ?? 1)
  };
  const existing = resource.statusEffects?.find((item) => item.id === normalized.id);
  if (existing) {
    existing.rounds = Math.max(Number(existing.rounds || 0), normalized.rounds);
    existing.value = Math.max(Number(existing.value || 0), normalized.value);
    existing.label = normalized.label || existing.label;
    return;
  }
  resource.statusEffects ||= [];
  resource.statusEffects.push(normalized);
}

function resolveDuelDomainProfileActivations(battle, pairs = []) {
  return callDuelDomainProfileImplementation(
    "resolveDuelDomainProfileActivations",
    [battle, pairs],
    globalThis.JJKDuelDomainProfile?.resolveDuelDomainProfileActivations
  );
}

function applyDuelDomainProfileOnActivation(actor, opponent, duelState = state.duelBattle, context = {}) {
  return callDuelDomainProfileImplementation(
    "applyDuelDomainProfileOnActivation",
    [actor, opponent, duelState, context],
    globalThis.JJKDuelDomainProfile?.applyDuelDomainProfileOnActivation
  );
}

function createDuelTrialSubPhase(profile, actor, opponent, battle = state.duelBattle, context = {}) {
  return callDuelRuleSubphaseImplementation("createDuelTrialSubPhase", [profile, actor, opponent, battle, context], globalThis.JJKDuelRuleSubphase?.createDuelTrialSubPhase);
}

function updateDuelTrialVerdictState(subPhase) {
  return callDuelRuleSubphaseImplementation("updateDuelTrialVerdictState", [subPhase], globalThis.JJKDuelRuleSubphase?.updateDuelTrialVerdictState);
}

function createDuelJackpotSubPhase(profile, actor, opponent, battle = state.duelBattle) {
  return callDuelRuleSubphaseImplementation("createDuelJackpotSubPhase", [profile, actor, opponent, battle], globalThis.JJKDuelRuleSubphase?.createDuelJackpotSubPhase);
}

function updateDuelJackpotState(subPhase) {
  return callDuelRuleSubphaseImplementation("updateDuelJackpotState", [subPhase], globalThis.JJKDuelRuleSubphase?.updateDuelJackpotState);
}

function applyDuelDomainSpecificAction(action, actor, opponent, duelState = state.duelBattle) {
  const battle = duelState || state.duelBattle;
  if (!action?.domainSpecific || !battle) return null;
  const subPhase = battle.domainSubPhase;
  if (subPhase?.type === "trial" && action.domainProfileId === subPhase.domainId && !subPhase.verdictResolved) {
    return applyDuelTrialAction(action, actor, opponent, battle);
  }
  if (subPhase?.type === "jackpot" && action.domainProfileId === subPhase.domainId && !subPhase.jackpotResolved) {
    return applyDuelJackpotAction(action, actor, opponent, battle);
  }
  const effects = action.effects || {};
  const stateEntry = battle.domainProfileStates?.[action.domainOwnerSide || actor.side];
  if (Number(effects.ownerDomainLoadDelta || 0) && stateEntry?.ownerSide) {
    const owner = getDuelResourcePair(battle, stateEntry.ownerSide);
    if (owner?.domain) {
      owner.domain.load += Number(effects.ownerDomainLoadDelta || 0);
      clampDuelResource(owner);
    }
  }
  appendDuelDomainProfileLog(battle, {
    side: actor.side,
    title: `${action.domainName || "领域"}手法`,
    type: action.domainClass === "rule_trial" || action.domainRole ? "subphase" : "domain",
    detail: `${actor.name} 选择${action.label}，${action.description || "专属领域规则继续推进"}。`
  });
  return { domainActionId: action.id, domainProfileId: action.domainProfileId };
}

function applyDuelTrialAction(action, actor, opponent, battle = state.duelBattle) {
  return callDuelRuleSubphaseImplementation("applyDuelTrialAction", [action, actor, opponent, battle], globalThis.JJKDuelRuleSubphase?.applyDuelTrialAction);
}

function applyDuelJackpotAction(action, actor, opponent, battle = state.duelBattle) {
  return callDuelRuleSubphaseImplementation("applyDuelJackpotAction", [action, actor, opponent, battle], globalThis.JJKDuelRuleSubphase?.applyDuelJackpotAction);
}

function resolveDuelJackpot(action, actor, opponent, battle = state.duelBattle, before = {}) {
  return callDuelRuleSubphaseImplementation("resolveDuelJackpot", [action, actor, opponent, battle, before], globalThis.JJKDuelRuleSubphase?.resolveDuelJackpot);
}

function resolveDuelTrialVerdict(action, actor, opponent, battle = state.duelBattle, before = {}) {
  return callDuelRuleSubphaseImplementation("resolveDuelTrialVerdict", [action, actor, opponent, battle, before], globalThis.JJKDuelRuleSubphase?.resolveDuelTrialVerdict);
}

function appendDuelDomainProfileLog(battle, entry = {}) {
  if (!battle) return;
  recordDuelResourceChange(battle, {
    side: entry.side || "neutral",
    title: entry.title || "领域资料层",
    detail: entry.detail || "",
    type: entry.type || entry.category || "domain",
    delta: {
      domainProfile: true,
      status: "CANDIDATE",
      ...(entry.delta || {})
    }
  });
}

function getDuelActionAvailability(action, actor, opponent, duelState) {
  return callDuelActionsImplementation("getDuelActionAvailability", [action, actor, opponent, duelState], globalThis.JJKDuelActions?.getDuelActionAvailability);
}

function buildDuelActionPool(actor, opponent, duelState) {
  return callDuelActionsImplementation("buildDuelActionPool", [actor, opponent, duelState], globalThis.JJKDuelActions?.buildDuelActionPool);
}

function pickDuelActionChoices(actor, opponent, duelState, count = 3) {
  return callDuelActionsImplementation("pickDuelActionChoices", [actor, opponent, duelState, count], globalThis.JJKDuelActions?.pickDuelActionChoices);
}

function initializeDuelHandState(battle = state.duelBattle) {
  return callDuelHandImplementation("initializeDuelHandState", [battle], globalThis.JJKDuelHand?.initializeDuelHandState);
}

function buildDuelHandCandidates(actor, opponent, duelState = state.duelBattle, options = {}) {
  return callDuelHandImplementation("buildDuelHandCandidates", [actor, opponent, duelState, options], globalThis.JJKDuelHand?.buildDuelHandCandidates);
}

function pickDuelHandCandidates(actor, opponent, duelState = state.duelBattle, count) {
  return callDuelHandImplementation("pickDuelHandCandidates", [actor, opponent, duelState, count], globalThis.JJKDuelHand?.pickDuelHandCandidates);
}

function pickDuelDomainHandCandidates(actor, opponent, duelState = state.duelBattle, count) {
  return callDuelHandImplementation("pickDuelDomainHandCandidates", [actor, opponent, duelState, count], globalThis.JJKDuelHand?.pickDuelDomainHandCandidates);
}

function buildDuelCharacterCardProfile(characterOrActor, options = {}) {
  return callDuelHandImplementation("buildDuelCharacterCardProfile", [characterOrActor, options], globalThis.JJKDuelHand?.buildDuelCharacterCardProfile);
}

function isDuelCardEligibleForCharacter(actionOrCandidate, characterOrActor, options = {}) {
  return callDuelHandImplementation("isDuelCardEligibleForCharacter", [actionOrCandidate, characterOrActor, options], globalThis.JJKDuelHand?.isDuelCardEligibleForCharacter);
}

function applyDuelCharacterCardWeights(candidates, characterOrActor, options = {}) {
  return callDuelHandImplementation("applyDuelCharacterCardWeights", [candidates, characterOrActor, options], globalThis.JJKDuelHand?.applyDuelCharacterCardWeights);
}

function filterDuelHandCandidatesByCharacter(candidates, characterOrActor, options = {}) {
  return callDuelHandImplementation("filterDuelHandCandidatesByCharacter", [candidates, characterOrActor, options], globalThis.JJKDuelHand?.filterDuelHandCandidatesByCharacter);
}

function explainDuelCardIneligibility(actionOrCandidate, characterOrActor, options = {}) {
  return callDuelHandImplementation("explainDuelCardIneligibility", [actionOrCandidate, characterOrActor, options], globalThis.JJKDuelHand?.explainDuelCardIneligibility);
}

function getDuelHandCardViewModel(candidate, actor = state.duelBattle?.resourceState?.p1, opponent = state.duelBattle?.resourceState?.p2, duelState = state.duelBattle) {
  return callDuelHandImplementation("getDuelHandCardViewModel", [candidate, actor, opponent, duelState], globalThis.JJKDuelHand?.getDuelHandCardViewModel);
}

function applyDuelHandSelection(actionOrId, actor, opponent, duelState = state.duelBattle, options = {}) {
  return callDuelHandImplementation("applyDuelHandSelection", [actionOrId, actor, opponent, duelState, options], globalThis.JJKDuelHand?.applyDuelHandSelection);
}

function getDuelSelectedHandActions(battle = state.duelBattle, side = "left") {
  return callDuelHandImplementation("getDuelSelectedHandActions", [battle, side], globalThis.JJKDuelHand?.getDuelSelectedHandActions);
}

function canSelectDuelHandCandidate(actionOrId, actor = state.duelBattle?.resourceState?.p1, opponent = state.duelBattle?.resourceState?.p2, duelState = state.duelBattle, options = {}) {
  return callDuelHandImplementation("canSelectDuelHandCandidate", [actionOrId, actor, opponent, duelState, options], globalThis.JJKDuelHand?.canSelectDuelHandCandidate);
}

function selectDuelHandCandidate(actionOrId, actor = state.duelBattle?.resourceState?.p1, opponent = state.duelBattle?.resourceState?.p2, duelState = state.duelBattle, options = {}) {
  return callDuelHandImplementation("selectDuelHandCandidate", [actionOrId, actor, opponent, duelState, options], globalThis.JJKDuelHand?.selectDuelHandCandidate);
}

function unselectDuelHandCandidate(actionOrId, actor = state.duelBattle?.resourceState?.p1, opponent = state.duelBattle?.resourceState?.p2, duelState = state.duelBattle, options = {}) {
  return callDuelHandImplementation("unselectDuelHandCandidate", [actionOrId, actor, opponent, duelState, options], globalThis.JJKDuelHand?.unselectDuelHandCandidate);
}

function discardDuelHandCandidate(actionOrId, actor = state.duelBattle?.resourceState?.p1, duelState = state.duelBattle, options = {}) {
  return callDuelHandImplementation("discardDuelHandCandidate", [actionOrId, actor, duelState, options], globalThis.JJKDuelHand?.discardDuelHandCandidate);
}

function applyDuelSelectedHandActions(actor, opponent, duelState = state.duelBattle, options = {}) {
  return callDuelHandImplementation("applyDuelSelectedHandActions", [actor, opponent, duelState, options], globalThis.JJKDuelHand?.applyDuelSelectedHandActions);
}

function resolveDuelHandTurn(battle = state.duelBattle, options = {}) {
  return callDuelHandImplementation("resolveDuelHandTurn", [battle, options], globalThis.JJKDuelHand?.resolveDuelHandTurn);
}

function clearDuelSelectedHandActions(battle = state.duelBattle, side = "left", options = {}) {
  return callDuelHandImplementation("clearDuelSelectedHandActions", [battle, side, options], globalThis.JJKDuelHand?.clearDuelSelectedHandActions);
}

function pickDuelCpuHandActions(actor = state.duelBattle?.resourceState?.p2, opponent = state.duelBattle?.resourceState?.p1, duelState = state.duelBattle, options = {}) {
  return callDuelHandImplementation("pickDuelCpuHandActions", [actor, opponent, duelState, options], globalThis.JJKDuelHand?.pickDuelCpuHandActions);
}

function getDuelActionApCost(action, actor = state.duelBattle?.resourceState?.p1, opponent = state.duelBattle?.resourceState?.p2, duelState = state.duelBattle) {
  return callDuelHandImplementation("getDuelActionApCost", [action, actor, opponent, duelState], globalThis.JJKDuelHand?.getDuelActionApCost);
}

function getDuelApState(battle = state.duelBattle, side = "left") {
  return callDuelHandImplementation("getDuelApState", [battle, side], globalThis.JJKDuelHand?.getDuelApState);
}

function spendDuelAp(battle = state.duelBattle, side = "left", amount = 1, options = {}) {
  return callDuelHandImplementation("spendDuelAp", [battle, side, amount, options], globalThis.JJKDuelHand?.spendDuelAp);
}

function resetDuelApForTurn(battle = state.duelBattle, side = "left") {
  return callDuelHandImplementation("resetDuelApForTurn", [battle, side], globalThis.JJKDuelHand?.resetDuelApForTurn);
}

function getDuelActionRiskLabel(action, actor, opponent) {
  const helper = globalThis.JJKDuelActions?.getDuelActionRiskLabel;
  if (typeof helper === "function") return helper(action, actor, opponent);
  const rules = getDuelActionRules();
  return rules.riskLabels?.[action?.risk] || action?.risk || "风险未知";
}

function updateDuelActionAvailability(battle = state.duelBattle) {
  if (!battle?.resourceState || battle.resolved) return [];
  syncDuelTrialSubPhaseLifecycle(battle);
  const { actorSide, actor, opponent } = getDuelSideResources(battle);
  const isNewActionRound = battle.actionRound !== battle.round + 1;
  if (isNewActionRound) {
    resetDuelApForTurn(battle, actorSide);
    clearDuelSelectedHandActions(battle, actorSide, { refund: false });
    battle.pendingAction = null;
    battle.actionUiMessage = "";
  }
  const handRules = getDuelHandRules();
  const handChoiceCount = handRules.hand?.maxHandSize || handRules.hand?.defaultChoiceCount || getDuelActionRules().choiceCount || 8;
  const domainHandCount = handRules.domainHand?.enabled === false ? 0 : Number(handRules.domainHand?.maxHandSize || 3);
  battle.actionChoices = pickDuelHandCandidates(actor, opponent, battle, handChoiceCount);
  battle.handCandidates = battle.actionChoices;
  battle.domainHandCandidates = domainHandCount > 0 ? pickDuelDomainHandCandidates(actor, opponent, battle, domainHandCount) : [];
  battle.actionRound = battle.round + 1;
  const selected = getDuelSelectedHandActions(battle, actorSide);
  battle.pendingAction = selected[0]?.action || null;
  const visibleChoices = [...(battle.actionChoices || []), ...(battle.domainHandCandidates || [])];
  if (battle.pendingAction && !visibleChoices.some((action) => action.id === battle.pendingAction.id || action.actionId === battle.pendingAction.id)) {
    battle.pendingAction = null;
  }
  return battle.actionChoices;
}

function selectDuelAction(actionId) {
  const battle = state.duelBattle;
  if (!battle || battle.autoRunning || battle.resolved) return;
  if (isOnlineDuelModeActive() && state.duelModeState.localLocked) {
    battle.actionUiMessage = "联机行动已锁定；如尚未结算，请先取消锁定。";
    renderDuelMode();
    return;
  }
  if (!battle.actionChoices?.length || battle.actionRound !== battle.round + 1) updateDuelActionAvailability(battle);
  const action = [...(battle.actionChoices || []), ...(battle.domainHandCandidates || [])].find((item) => item.id === actionId || item.actionId === actionId);
  if (!action) return;
  const { actorSide, actor, opponent } = getDuelSideResources(battle);
  const selection = selectDuelHandCandidate(action, actor, opponent, battle, { side: actorSide });
  if (!selection.selected) {
    battle.actionUiMessage = selection.reason || "不可执行";
    updateDuelResourceReplayKey(battle);
    renderDuelMode();
    return;
  }
  const selected = getDuelSelectedHandActions(battle, actorSide);
  battle.pendingAction = selected[0]?.action || null;
  battle.actionUiMessage = "";
  updateDuelResourceReplayKey(battle);
  renderDuelMode();
}

function getDuelActionContext(battle, side) {
  const helper = globalThis.JJKDuelResource?.getDuelActionContext || globalThis.JJKDuelActions?.getDuelActionContext;
  if (typeof helper === "function") return helper(battle, side);
  return { outgoingScale: 1, incomingHpScale: 1, incomingCeScale: 1, sureHitScale: 1, domainPressureScale: 1, manualAttackScale: 1, domainLoadScale: 1, weightDeltas: {}, actionLabels: [] };
}

function applyDuelActionEffect(action, actor, opponent, duelState) {
  return callDuelActionsImplementation("applyDuelActionEffect", [action, actor, opponent, duelState], globalThis.JJKDuelActions?.applyDuelActionEffect);
}

function appendDuelActionLog(action, actor, opponent, result, battle = state.duelBattle) {
  if (!battle) return;
  const sideLabel = getDuelResourceSideLabel(actor.side);
  const actionType = DUEL_DOMAIN_RESPONSE_ACTION_IDS.has(action.id)
    ? "response"
    : ((action.effects?.activateDomain || action.effects?.releaseDomain || action.id?.startsWith("domain_")) ? "domain" : (action.domainSpecific ? "subphase" : "action"));
  const costText = result.costCe ? `咒力 ${formatSignedDuelDelta(-result.costCe)}` : "无额外咒力消耗";
  const parts = [
    action.logTemplate || `${sideLabel}${actor.name} 选择${action.label}。`,
    costText
  ];
  if (result.actorStability) parts.push(`稳定 ${formatSignedDuelDelta(result.actorStability * 100)}%`);
  if (result.opponentHp) parts.push(`${opponent.name} 体势 ${formatSignedDuelDelta(result.opponentHp)}`);
  if (result.opponentStability) parts.push(`${opponent.name} 稳定 ${formatSignedDuelDelta(result.opponentStability * 100)}%`);
  if (result.actorDomainLoad) parts.push(`领域负荷 ${formatSignedDuelDelta(result.actorDomainLoad)}`);
  if (result.opponentDomainLoad) parts.push(`${opponent.name} 领域负荷 ${formatSignedDuelDelta(result.opponentDomainLoad)}`);
  if (result.domainActivated) parts.push("领域进入维持状态");
  if (result.domainReleased) parts.push("主动解除领域，未触发领域崩解");
  if (result.blackFlashTriggered) {
    parts.push(result.blackFlashLabel === "极限打击窗口"
      ? "【极限打击窗口】触发！对手体势剧烈崩坏。"
      : "【黑闪】触发！打击与冲击在临界点重合，对手体势剧烈崩坏。");
  }
  (result.mechanicsApplied || []).forEach((mechanic) => {
    const text = mechanic?.logTemplate || mechanic?.label || mechanic?.id || "";
    if (text) parts.push(text);
  });
  if (action.id === "residue_reading") parts.push(`${opponent.name} 的咒力流向被记录`);
  recordDuelResourceChange(battle, {
    side: actor.side,
    title: `${sideLabel}手法：${action.label}`,
    detail: `${sideLabel}${actor.name}：${parts.join("；")}。`,
    type: actionType,
    delta: { actionId: action.id, ...result }
  });
}

function getDuelHandLogSideLabel(side) {
  return side === "right" ? "对手" : "你";
}

function normalizeDuelHandLogEntries(entries = []) {
  return entries
    .map((entry) => {
      const action = entry?.action || entry;
      return {
        id: entry?.actionId || entry?.id || action?.id || "",
        label: entry?.label || action?.label || entry?.actionId || entry?.id || "未命名手札",
        apCost: Number(entry?.apCost ?? action?.apCost ?? 0),
        ceCost: Number(entry?.ceCost ?? entry?.costCe ?? action?.costCe ?? 0)
      };
    })
    .filter((entry) => entry.id || entry.label);
}

function formatDuelHandLogOrder(entries = []) {
  const normalized = normalizeDuelHandLogEntries(entries);
  if (!normalized.length) return "无可执行手札";
  return normalized.map((entry, index) => `${index + 1}. ${entry.label}`).join("；");
}

function appendDuelHandBatchLog(battle, side, entries = [], options = {}) {
  if (!battle) return;
  const normalized = normalizeDuelHandLogEntries(entries);
  const sideLabel = getDuelHandLogSideLabel(side);
  const phase = options.phase || "selected";
  const result = options.result || null;
  const totalAp = normalized.reduce((total, entry) => total + Number(entry.apCost || 0), 0);
  const totalCe = normalized.reduce((total, entry) => total + Number(entry.ceCost || 0), 0);
  const title = phase === "executed"
    ? `${sideLabel}执行术式手札`
    : `${sideLabel}本回合已选择手札`;
  const resultParts = Array.isArray(result?.results)
    ? result.results.map((item, index) => `${index + 1}. ${(item.action?.label || item.action?.id || "未知手札")}${item.applied ? "成功" : `失败：${item.reason || "未结算"}`}`)
    : [];
  const detailParts = [
    normalized.length
      ? `${sideLabel}本回合${phase === "executed" ? "执行" : "选择"} ${normalized.length} 张手札：${formatDuelHandLogOrder(normalized)}。`
      : `${sideLabel}本回合未选择可执行手札。`,
    normalized.length ? `预留 AP ${formatNumber(totalAp)} / CE ${formatNumber(totalCe)}。` : "",
    result?.reason ? `结果：${result.reason}。` : "",
    resultParts.length ? `执行顺序：${resultParts.join("；")}。` : ""
  ].filter(Boolean);
  recordDuelResourceChange(battle, {
    side: side || "neutral",
    title,
    detail: detailParts.join(" "),
    type: "hand",
    delta: {
      handSelection: true,
      phase,
      actionIds: normalized.map((entry) => entry.id),
      totalAp,
      totalCe,
      status: "CANDIDATE"
    }
  });
}

function getDuelCpuAction(actor, opponent, duelState) {
  return callDuelActionsImplementation("getDuelCpuAction", [actor, opponent, duelState], globalThis.JJKDuelActions?.getDuelCpuAction);
}

function createDuelBattleSeed(left, right) {
  const source = [
    DUEL_SYSTEM_VERSION,
    left?.id || left?.name || "",
    right?.id || right?.name || "",
    Date.now(),
    state.duelSpinToken
  ].join("|");
  return hashDuelSeed(source).toString(36);
}

function createDuelBattleId(left, right, seed) {
  const source = [DUEL_SYSTEM_VERSION, left?.id || left?.name || "", right?.id || right?.name || "", seed].join("|");
  return `duel_${Date.now().toString(36)}_${hashDuelSeed(source).toString(36)}`;
}

function hashDuelSeed(value) {
  let hash = 2166136261;
  const text = String(value || "duel-seed");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createDuelSeededRng(seed) {
  let cursor = hashDuelSeed(seed) || 1;
  return () => {
    cursor += 0x6D2B79F5;
    let value = cursor;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function duelRandom(battle, label = "duel") {
  const value = typeof battle?.rng === "function" ? battle.rng() : Math.random();
  if (battle) {
    battle.randomLog = battle.randomLog || [];
    battle.randomLog.push({
      round: battle.round + 1,
      label,
      value: Number(value.toFixed(8))
    });
  }
  return value;
}

function buildDuelReplayKey(battle) {
  const operations = (battle?.operations || []).join(",");
  return `${DUEL_SYSTEM_VERSION}:${battle?.battleId || "duel"}:${battle?.seed || "seed"}:${battle?.left?.id || "left"}>${battle?.right?.id || "right"}:${operations}`;
}

function initializeDuelResourceState(duelState) {
  return callDuelResourceImplementation("initializeDuelResourceState", [duelState], globalThis.JJKDuelResource?.initializeDuelResourceState);
}

function deriveDuelResourcesFromProfile(profile, card = null, side = "") {
  return callDuelResourceImplementation("deriveDuelResourcesFromProfile", [profile, card, side], globalThis.JJKDuelResource?.deriveDuelResourcesFromProfile);
}

function getDuelResourcePair(battle, side) {
  return callDuelResourceImplementation("getDuelResourcePair", [battle, side], globalThis.JJKDuelResource?.getDuelResourcePair);
}

function getDuelOpponentSide(side) {
  return side === "left" ? "right" : "left";
}

function getDuelResourceSideLabel(side) {
  const helper = globalThis.JJKDuelResource?.getDuelResourceSideLabel;
  if (typeof helper === "function") return helper(side);
  return side === "left" ? "我方" : side === "right" ? "对方" : "战场";
}

function recordDuelResourceChange(battle, entry) {
  const helper = globalThis.JJKDuelResource?.recordDuelResourceChange;
  if (typeof helper !== "function") throw new Error("JJKDuelResource.recordDuelResourceChange helper is not available.");
  return helper(battle, entry);
}

function clampDuelResource(resource) {
  return callDuelResourceImplementation("clampDuelResource", [resource], globalThis.JJKDuelResource?.clampDuelResource);
}

function getDuelStatusEffectValue(resource, id) {
  const helper = globalThis.JJKDuelResource?.getDuelStatusEffectValue;
  if (typeof helper === "function") return helper(resource, id);
  if (!resource?.statusEffects?.length) return 0;
  return Math.max(0, ...resource.statusEffects.filter((effect) => effect.id === id).map((effect) => Number(effect.value || 1)));
}

function applyDuelRoundResourceRegen(actor, battle = state.duelBattle, side = actor?.side) {
  return callDuelResourceImplementation("applyDuelRoundResourceRegen", [actor, battle, side], globalThis.JJKDuelResource?.applyDuelRoundResourceRegen);
}

function applyDuelEventResourceDelta(event, actor, opponent, battle = state.duelBattle) {
  if (!event || !actor || !opponent || !battle) return null;
  const rules = getDuelResourceRules();
  const kind = event.kind || "neutral";
  const config = rules.events?.[kind] || rules.events?.neutral || {};
  const actorSide = actor.side;
  const opponentSide = opponent.side;
  const before = {
    actorHp: actor.hp,
    actorCe: actor.ce,
    opponentHp: opponent.hp,
    opponentCe: opponent.ce
  };
  const scorePressure = Math.max(0, Number(event.score || 0) - 1) * 1.8;
  const ceCost = Number(config.actorCeCost || 0);
  const actualCeCost = Math.min(actor.ce, ceCost);
  actor.ce -= actualCeCost;
  const actorActionContext = getDuelActionContext(battle, actorSide);
  const opponentActionContext = getDuelActionContext(battle, opponentSide);
  let outputScale = (ceCost > 0 ? clamp(actualCeCost / ceCost, 0.58, 1) : 1) * Number(actorActionContext.outgoingScale || 1);
  const executionStateCandidate = getDuelStatusEffectValue(actor, "executionStateCandidate");
  if (executionStateCandidate > 0) outputScale *= 1 + executionStateCandidate * 0.22;
  const techniqueImbalance = getDuelStatusEffectValue(actor, "techniqueImbalance");
  const imbalanceConfig = rules.statusEffects?.techniqueImbalance || {};
  const imbalanceAffectedEvents = imbalanceConfig.affectedEvents || ["technique", "domain", "finisher"];
  if (techniqueImbalance > 0 && imbalanceAffectedEvents.includes(kind)) {
    outputScale *= Number(imbalanceConfig.outputScale || 0.72);
  }
  if (actualCeCost < ceCost) {
    actor.stability = Number(clamp(actor.stability - 0.035, 0, 1).toFixed(4));
    actor.statusEffects.push({ id: "ceStrain", label: "咒力见底", rounds: 1, value: ceCost - actualCeCost });
  }
  const trialViolenceScale = getDuelTrialViolenceScale(battle, kind, actorSide);
  if (trialViolenceScale < 1) outputScale *= trialViolenceScale;

  const baseTargetHpDamage = Number(config.targetHpDamage || 0) + scorePressure;
  let targetHpDamage = baseTargetHpDamage * outputScale * Number(opponentActionContext.incomingHpScale || 1);
  let domainDamageText = "";
  if (kind === "domain") {
    const barrierModifiers = applyDuelDomainBarrierModifiers(actor, opponent, event, { battle });
    const sureHitDamage = baseTargetHpDamage * 0.52 * Number(opponentActionContext.sureHitScale || 1) * Number(barrierModifiers.sureHitScale || 1);
    const domainPressureDamage = baseTargetHpDamage * 0.3 * Number(opponentActionContext.domainPressureScale || 1) * Number(barrierModifiers.pressureScale || 1);
    const manualAttackDamage = baseTargetHpDamage * 0.18 * Number(opponentActionContext.manualAttackScale || 1) * Number(barrierModifiers.manualAttackScale || 1);
    targetHpDamage = (sureHitDamage + domainPressureDamage + manualAttackDamage) *
      outputScale *
      Number(opponentActionContext.incomingHpScale || 1);
    const shape = DUEL_DOMAIN_BARRIER_LABELS[barrierModifiers.barrierType] || barrierModifiers.barrierType || "未知形态";
    const completion = DUEL_DOMAIN_COMPLETION_LABELS[barrierModifiers.domainCompletion] || barrierModifiers.domainCompletion || "未知";
    domainDamageText = `领域形态：${shape}，完成度：${completion}。领域伤害拆分：必中 ${formatNumber(sureHitDamage)}、领域压制 ${formatNumber(domainPressureDamage)}、手动攻击/环境 ${formatNumber(manualAttackDamage)}。`;
  }
  const targetCeDamage = Number(config.targetCeDamage || 0) * outputScale * Number(opponentActionContext.incomingCeScale || 1);
  const actorHpRecoil = Number(config.actorHpRecoil || 0) * (kind === "finisher" ? clamp(1.15 - actor.stability, 0.25, 0.9) : 1);
  const jackpotDefense = getDuelStatusEffectValue(opponent, "jackpotStateCandidate");
  if (jackpotDefense > 0 && targetHpDamage > 0) {
    targetHpDamage *= clamp(1 - jackpotDefense * 0.32, 0.45, 1);
  }
  const verdictDefenseShake = getDuelStatusEffectValue(opponent, "defenseShakenByVerdict");
  if (verdictDefenseShake > 0 && targetHpDamage > 0) {
    targetHpDamage *= 1 + verdictDefenseShake * 0.12;
  }
  opponent.hp -= targetHpDamage;
  opponent.ce -= targetCeDamage;
  actor.hp -= actorHpRecoil;

  if (config.targetRegenInterference) {
    opponent.statusEffects.push({
      id: "ceRegenInterference",
      label: "咒力回流受扰",
      rounds: 1,
      value: Number(config.targetRegenInterference)
    });
  }

  if (kind === "domain") {
    updateDuelDomainLoad(actor, opponent, { battle, side: actorSide, event, domainEvent: true });
  }
  if (kind === "counter" && opponent.domain?.active) {
    opponent.domain.load += Number(config.domainLoadInterference || 0);
    recordDuelResourceChange(battle, {
      side: opponentSide,
      title: "领域受扰",
      detail: `${getDuelResourceSideLabel(opponentSide)}${opponent.name} 的领域受到干涉，负荷 +${formatNumber(config.domainLoadInterference || 0)}。`,
      type: "domain",
      delta: { domainLoad: Number(config.domainLoadInterference || 0) }
    });
  }

  clampDuelResource(actor);
  clampDuelResource(opponent);
  const delta = {
    actorHp: Number((actor.hp - before.actorHp).toFixed(1)),
    actorCe: Number((actor.ce - before.actorCe).toFixed(1)),
    opponentHp: Number((opponent.hp - before.opponentHp).toFixed(1)),
    opponentCe: Number((opponent.ce - before.opponentCe).toFixed(1))
  };
  const imbalanceText = techniqueImbalance > 0 && imbalanceAffectedEvents.includes(kind)
    ? "术式失衡压低了本次术式输出。"
    : "";
  const trialText = trialViolenceScale < 1 ? "审判规则限制了本次暴力输出。" : "";
  const jackpotText = jackpotDefense > 0 ? "jackpot 状态候选降低了承伤。" : "";
  const executionText = executionStateCandidate > 0 ? "处刑状态候选提高了本次收束压迫。" : "";
  const detail = `${getDuelResourceSideLabel(actorSide)}${actor.name} 咒力 ${formatSignedDuelDelta(delta.actorCe)}；${getDuelResourceSideLabel(opponentSide)}${opponent.name} 体势 ${formatSignedDuelDelta(delta.opponentHp)}、咒力 ${formatSignedDuelDelta(delta.opponentCe)}。${domainDamageText}${imbalanceText}${trialText}${jackpotText}${executionText}`;
  recordDuelResourceChange(battle, {
    side: actorSide,
    title: `${event.label}资源结算`,
    detail,
    type: kind === "domain" ? "domain" : "resource",
    delta
  });
  return delta;
}

function getDuelTrialViolenceScale(battle, kind, actorSide) {
  return callDuelResourceImplementation("getDuelTrialViolenceScale", [battle, kind, actorSide], globalThis.JJKDuelResource?.getDuelTrialViolenceScale);
}

function updateDuelDomainLoad(actor, opponent, context = {}) {
  return callDuelResourceImplementation("updateDuelDomainLoad", [actor, opponent, context], globalThis.JJKDuelResource?.updateDuelDomainLoad);
}

function checkDuelDomainMeltdown(actor) {
  return Boolean(actor?.domain?.active && actor.domain.threshold > 0 && actor.domain.load >= actor.domain.threshold);
}

function triggerDuelDomainMeltdown(actor, battle = state.duelBattle, side = actor?.side) {
  return callDuelResourceImplementation("triggerDuelDomainMeltdown", [actor, battle, side], globalThis.JJKDuelResource?.triggerDuelDomainMeltdown);
}

function updateDuelResourceReplayKey(battle) {
  if (!battle) return;
  battle.replayKey = buildDuelReplayKey(battle);
  if (battle.resourceState) battle.resourceState.replayKey = battle.replayKey;
}

function formatSignedDuelDelta(value) {
  const number = Number(value || 0);
  if (Math.abs(number) < 0.05) return "+0";
  return `${number > 0 ? "+" : ""}${formatNumber(Number(number.toFixed(1)))}`;
}

function getDuelResourceWinner(battle) {
  const p1 = battle?.resourceState?.p1;
  const p2 = battle?.resourceState?.p2;
  if (!p1 || !p2) return "";
  if (p1.hp <= 0 && p2.hp <= 0) return "draw";
  if (p1.hp <= 0) return "right";
  if (p2.hp <= 0) return "left";
  return "";
}

function computeDuelResourceWinRateDelta(battle) {
  const p1 = battle?.resourceState?.p1;
  const p2 = battle?.resourceState?.p2;
  if (!p1 || !p2) return 0;
  const leftHpRatio = p1.maxHp ? p1.hp / p1.maxHp : 0;
  const rightHpRatio = p2.maxHp ? p2.hp / p2.maxHp : 0;
  const leftCeRatio = p1.maxCe ? p1.ce / p1.maxCe : 0;
  const rightCeRatio = p2.maxCe ? p2.ce / p2.maxCe : 0;
  const leftDomainRisk = p1.domain?.active ? Number(p1.domain.meltdownRisk || 0) : 0;
  const rightDomainRisk = p2.domain?.active ? Number(p2.domain.meltdownRisk || 0) : 0;
  return clamp((leftHpRatio - rightHpRatio) * 0.22 + (leftCeRatio - rightCeRatio) * 0.08 - (leftDomainRisk - rightDomainRisk) * 0.06, -0.22, 0.22);
}

function renderDuelResourcePanel(battle = state.duelBattle) {
  if (!battle?.resourceState) return "";
  return `
    <section class="duel-resource-panel">
      ${renderDuelResourceSide(battle.resourceState.p1, battle.left)}
      <details class="duel-replay-meta">
        <summary>复现标识</summary>
        <dl>
          <dt>battleId</dt><dd>${escapeHtml(battle.battleId)}</dd>
          <dt>seed</dt><dd>${escapeHtml(battle.seed)}</dd>
          <dt>replayKey</dt><dd>${escapeHtml(battle.replayKey)}</dd>
        </dl>
      </details>
      ${renderDuelResourceSide(battle.resourceState.p2, battle.right)}
    </section>
  `;
}

function getDuelSubPhaseProfile(battle, side) {
  if (!battle || !side) return null;
  return side === "left" ? battle.left : side === "right" ? battle.right : null;
}

function getDuelTrialTextParts(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map((item) => String(item));
  if (value instanceof Set) return Array.from(value).filter(Boolean).map((item) => String(item));
  return [String(value)];
}

function getDuelTrialDisplayMeta(battle, subPhase = null, trialContext = getDuelActiveTrialContext(battle, subPhase)) {
  const ownerSide = subPhase?.owner || trialContext?.owner;
  const defenderSide = subPhase?.defender || trialContext?.target;
  const defender = getDuelSubPhaseProfile(battle, defenderSide);
  const owner = getDuelSubPhaseProfile(battle, ownerSide);
  const targetType = subPhase?.trialSubjectType || trialContext?.trialSubjectType || trialContext?.trialTargetProfile?.trialSubjectType || "unknown";
  const eligibility = normalizeDuelTrialEligibility(subPhase?.trialEligibility || trialContext?.trialEligibility || trialContext?.trialTargetProfile?.trialEligibility, "partial");
  const vocabulary = subPhase?.verdictVocabulary || trialContext?.verdictVocabulary || trialContext?.trialTargetProfile?.verdictVocabulary || "legal";
  const isCursedSpirit = vocabulary === "exorcism";
  const isNonHumanTool = vocabulary === "object" || vocabulary === "controller";
  const responseStatus = trialContext?.responseStatus || {};
  const responseEffective = Boolean(subPhase?.responseEffective || responseStatus.responseEffective);
  const responseLabel = subPhase?.responseLabel || responseStatus.responseLabel || (responseEffective ? "已削弱" : "无硬防线");
  const responseDetail = subPhase?.responseDetail || responseStatus.responseDetail || "";
  const trialEndReason = subPhase?.trialEndReason
    || trialContext?.trialEndReason
    || (subPhase?.endedByMeltdown ? "domainMeltdown" : "")
    || (subPhase?.endedByRelease ? "domainManuallyEnded" : "")
    || (subPhase?.verdictResolved && subPhase?.verdict ? "verdictResolved" : "")
    || (subPhase?.verdictResolved ? "domainResponseDisrupted" : "ongoing");
  const verdictState = subPhase?.verdictResolved
    ? (subPhase.verdict || "已结算")
    : (subPhase ? (subPhase.verdictReady ? "可申请判决" : "未就绪") : (trialContext?.trialStatus === "resolved" ? "已结束" : "目标已识别"));
  const activeStage = subPhase?.verdictResolved
    ? "规则子阶段结束"
    : (subPhase ? (subPhase.verdictReady ? getDuelTrialPhaseLabel(eligibility) : `${getDuelTrialPhaseLabel(eligibility)} R${subPhase.trialRound || 1}`) : getDuelTrialStatusLabel(trialContext?.trialStatus || "pending"));
  const currentStage = responseEffective && !subPhase?.verdictResolved
    ? `${activeStage}（被削弱）`
    : activeStage;
  const responseResult = responseEffective
    ? `目标已识别但审判规则未完整成立；${responseDetail || "领域应对削弱了完整审判推进。"}`
    : "完整审判规则持续推进。";
  return {
    ownerName: owner?.name || trialContext?.ownerName || getDuelResourceSideLabel(ownerSide),
    targetName: defender?.name || trialContext?.targetName || getDuelResourceSideLabel(defenderSide),
    targetLabel: `审判对象：${getDuelTrialTargetLabel(targetType)}`,
    verdictType: getDuelTrialEligibilityLabel(eligibility),
    evidenceLabel: isCursedSpirit ? "残秽证据 / 咒力罪证" : (isNonHumanTool ? "操控链 / 物件记录" : "残秽证据 / 行动记录"),
    vocabulary,
    verdictState,
    currentStage,
    responseLabel,
    responseResult,
    trialEndReason,
    trialEndReasonLabel: getDuelTrialEndReasonLabel(trialEndReason),
    isCursedSpirit,
    isNonHumanTool
  };
}

function renderDuelTrialLogContext(entry, battle = state.duelBattle) {
  const subPhase = battle?.domainSubPhase;
  const trialContext = getDuelActiveTrialContext(battle, subPhase);
  const category = entry?.category || entry?.type || inferDuelLogCategory(entry);
  if (!["subphase", "trialTarget", "verdict", "response", "system", "exorcismRuling", "objectConfiscation", "controllerRedirect"].includes(category) || !trialContext) return "";
  const meta = getDuelTrialDisplayMeta(battle, subPhase?.type === "trial" ? subPhase : null, trialContext);
  const evidencePressure = subPhase?.type === "trial" ? formatNumber(subPhase.evidencePressure || 0) : "未进入";
  const defensePressure = subPhase?.type === "trial" ? formatNumber(subPhase.defensePressure || 0) : "未进入";
  return `
    <div class="duel-log-context">
      <span>${escapeHtml(meta.targetLabel)}：${escapeHtml(meta.targetName)}</span>
      <span>裁定类型：${escapeHtml(meta.verdictType)}</span>
      <span>当前阶段：${escapeHtml(meta.currentStage)}</span>
      <span>应对：${escapeHtml(meta.responseLabel)}</span>
      <span>证据 / 辩护：${escapeHtml(evidencePressure)} / ${escapeHtml(defensePressure)}</span>
      <span>判决状态：${escapeHtml(meta.verdictState)}</span>
      <span>结束原因：${escapeHtml(meta.trialEndReasonLabel)}</span>
    </div>
  `;
}

function renderDuelDomainProfilePanel(battle = state.duelBattle) {
  const states = Object.values(battle?.domainProfileStates || {});
  const subPhase = battle?.domainSubPhase;
  const trialContext = getDuelActiveTrialContext(battle, subPhase);
  if (!states.length && !subPhase && !trialContext) return "";
  const stateItems = states.map((entry) => {
    const normalizedProfile = normalizeDuelDomainBarrierProfile(entry.profile || entry);
    const barrierSummary = getDuelDomainBarrierSummary(normalizedProfile);
    const resource = getDuelResourcePair(battle, entry.ownerSide);
    const ownerLabel = entry.ownerSide === "left" ? "我方" : "对方";
    const loadText = resource?.domain?.threshold
      ? `${formatNumber(resource.domain.load)} / ${formatNumber(resource.domain.threshold)}`
      : "无领域负荷";
    const responseText = entry.responseLabel || (entry.weakened ? "已削弱" : "无硬防线");
    const responseResult = entry.weakened
      ? (entry.responseDetail || "专属领域完整展开被削弱。")
      : "专属领域效果完整进入战场。";
    const effects = (entry.profile?.domainEffects || [])
      .slice(0, 2)
      .map((effect) => effect.label || effect.description || effect.id)
      .filter(Boolean)
      .join("、") || "通用领域效果";
    const tags = (entry.effectTags || []).slice(0, 5).join("、");
    return `
      <article class="duel-domain-profile-card">
        <div class="duel-domain-profile-card-head">
          <span>当前领域：${escapeHtml(ownerLabel)}</span>
          <strong>${escapeHtml(entry.domainName)}</strong>
        </div>
        <dl class="duel-domain-core">
          <div><dt>领域形态</dt><dd>${escapeHtml(barrierSummary.shape)}</dd></div>
          <div><dt>完成度</dt><dd>${escapeHtml(barrierSummary.completion)}</dd></div>
          <div><dt>当前负荷</dt><dd>${escapeHtml(loadText)}</dd></div>
          <div><dt>当前应对</dt><dd>${escapeHtml(responseText)}</dd></div>
        </dl>
        <p class="duel-domain-profile-result">应对结果：${escapeHtml(responseResult)}</p>
        <details class="duel-domain-profile-details">
          <summary>领域详情</summary>
          <p>领域类型：${escapeHtml(DUEL_DOMAIN_CLASS_LABELS[entry.domainClass] || entry.domainClass || "未知")}</p>
          <p>领域效果：${escapeHtml(effects)}</p>
          <p>形态风险：${escapeHtml(entry.barrierHint || barrierSummary.hint)}</p>
          <p>反制难度：${escapeHtml(barrierSummary.risk)}；切换性：${escapeHtml(barrierSummary.switchability)}</p>
          <p>效果标签：${escapeHtml(tags || "未记录")}</p>
          <em>${escapeHtml(entry.status || "CANDIDATE")}</em>
        </details>
      </article>
    `;
  }).join("");
  const trialSubPhase = subPhase?.type === "trial" ? subPhase : null;
  const trialMeta = trialContext ? getDuelTrialDisplayMeta(battle, trialSubPhase, trialContext) : null;
  const evidencePressureText = trialSubPhase ? formatNumber(trialSubPhase.evidencePressure || 0) : "未进入";
  const defensePressureText = trialSubPhase ? formatNumber(trialSubPhase.defensePressure || 0) : "未进入";
  const trialRoundText = trialSubPhase ? (trialSubPhase.trialRound || 1) : "-";
  const violenceRestrictionText = trialSubPhase
    ? (trialSubPhase.violenceRestricted && !trialSubPhase.verdictResolved ? "生效" : "解除")
    : (trialContext?.responseStatus?.responseEffective ? "被削弱" : "未生效");
  const trial = trialMeta ? `
    <article class="duel-domain-profile-card trial">
      <div class="duel-domain-profile-card-head">
        <span>${escapeHtml(trialMeta.targetLabel)}</span>
        <strong>${escapeHtml(trialMeta.targetName)}</strong>
      </div>
      <dl class="duel-domain-core">
        <div><dt>裁定类型</dt><dd>${escapeHtml(trialMeta.verdictType)}</dd></div>
        <div><dt>当前阶段</dt><dd>${escapeHtml(trialMeta.currentStage)}</dd></div>
        <div><dt>当前应对</dt><dd>${escapeHtml(trialMeta.responseLabel)}</dd></div>
        <div><dt>应对结果</dt><dd>${escapeHtml(trialMeta.responseResult)}</dd></div>
        <div><dt>证据口径</dt><dd>${escapeHtml(trialMeta.evidenceLabel)}</dd></div>
        <div><dt>证据压力</dt><dd>${escapeHtml(evidencePressureText)}</dd></div>
        <div><dt>辩护压力</dt><dd>${escapeHtml(defensePressureText)}</dd></div>
        <div><dt>审判轮次</dt><dd>${escapeHtml(trialRoundText)}</dd></div>
        <div><dt>裁定状态</dt><dd>${escapeHtml(trialMeta.verdictState)}</dd></div>
        <div><dt>暴力限制</dt><dd>${escapeHtml(violenceRestrictionText)}</dd></div>
        <div><dt>结束原因</dt><dd>${escapeHtml(trialMeta.trialEndReasonLabel)}</dd></div>
      </dl>
      <em>${escapeHtml(`${trialMeta.ownerName} 发起；${trialMeta.isCursedSpirit ? "以咒灵裁定 / 祓除令候选展示。" : (trialMeta.isNonHumanTool ? "不作为完整被告，转为操控链或对象没收判定。" : "仅显示规则裁定与术式限制，不追加罪名判断。")}`)}</em>
    </article>
  ` : "";
  const jackpot = subPhase?.type === "jackpot" ? `
    <article class="duel-domain-profile-card trial">
      <div class="duel-domain-profile-card-head">
        <span>规则子阶段</span>
        <strong>坐杀搏徒</strong>
      </div>
      <dl class="duel-domain-core">
        <div><dt>jackpot 期待度</dt><dd>${escapeHtml(formatNumber(subPhase.jackpotGauge || 0))} / 100</dd></div>
        <div><dt>循环回合</dt><dd>${escapeHtml(subPhase.jackpotRound || 1)}</dd></div>
        <div><dt>结算状态</dt><dd>${escapeHtml(subPhase.jackpotResolved ? "已中奖" : (subPhase.jackpotReady ? "可结算" : "推进中"))}</dd></div>
        <div><dt>候选规则</dt><dd>CANDIDATE</dd></div>
      </dl>
      <em>${escapeHtml(subPhase.jackpotResolved ? "jackpot 状态候选生效" : "未中奖前会累积领域负荷与咒力压力")}</em>
    </article>
  ` : "";
  return `
    <section class="duel-domain-profile-panel">
      <div class="duel-domain-profile-head">
        <h4>领域状态 / 原著领域 Profile</h4>
        <span class="duel-chip">CANDIDATE</span>
      </div>
      <div class="duel-domain-profile-grid">
        ${stateItems}
        ${trial}
        ${jackpot}
      </div>
    </section>
  `;
}

function getDuelHandPoolInfluenceText(battle = state.duelBattle) {
  const subPhase = battle?.domainSubPhase;
  if (subPhase?.type === "trial") {
    return "手札池：审判子阶段优先，审判 / 辩护手札不会被普通输出挤掉。";
  }
  if (subPhase?.type === "jackpot") {
    return "手札池：jackpot 子阶段优先，推进演出 / 稳定循环 / 结算中奖保持可见。";
  }
  const leftDomain = battle?.resourceState?.p1?.domain;
  const rightDomain = battle?.resourceState?.p2?.domain;
  if (leftDomain?.active || rightDomain?.active) {
    return "手札池：普通手札上限 8；领域展开、维持、对抗与反领域牌进入独立领域操控位，不占普通手札。";
  }
  return "手札池：普通手牌上限 8，每回合补 5 张；领域操控手札独立上限 3，每轮随机刷新，不占普通手牌。";
}

function renderDuelActionChoices(battle = state.duelBattle) {
  if (!battle?.resourceState || battle.resolved) return "";
  if (!battle.actionChoices?.length || battle.actionRound !== battle.round + 1) updateDuelActionAvailability(battle);
  const choices = battle.actionChoices || [];
  const domainChoices = battle.domainHandCandidates || [];
  const { actorSide, actor } = getDuelSideResources(battle);
  const selectedEntries = getDuelSelectedHandActions(battle, actorSide);
  const selectedIds = new Set(selectedEntries.map((entry) => entry.actionId || entry.id));
  const selectedOrderMap = new Map(selectedEntries.map((entry, index) => [entry.actionId || entry.id, index + 1]));
  const handRules = getDuelHandRules();
  const maxSelections = handRules.hand?.maxSelectionsPerTurn || 1;
  const sideHandState = battle.handState?.[actorSide] || {};
  const maxHandSize = handRules.hand?.maxHandSize || 8;
  const drawPerTurn = handRules.hand?.drawPerTurn || 5;
  const pendingDiscardCount = Math.max(0, Number(sideHandState.pendingDiscardCount || 0));
  const maxDomainHandSize = handRules.domainHand?.enabled === false ? 0 : Number(handRules.domainHand?.maxHandSize || 3);
  const selectedTotalCe = selectedEntries.reduce((total, entry) => total + Number(entry?.ceCost || 0), 0);
  const actorCe = Number(actor?.ce || 0);
  const actorMaxCe = Number(actor?.maxCe || 0);
  const projectedCe = Math.max(0, actorCe - selectedTotalCe);
  const lastSelected = selectedEntries[selectedEntries.length - 1];
  const onlineMode = isOnlineDuelModeActive();
  const onlineLocked = onlineMode && state.duelModeState.localLocked;
  const lockEntry = battle.handLockMessages?.[actorSide];
  const handLockMessage = lockEntry && Number(lockEntry.round || 0) === battle.round + 1 ? String(lockEntry.message || "") : "";
  const selectedOrder = selectedEntries.length ? `
    <ol class="duel-selected-hand-list">
      ${selectedEntries.map((entry, index) => `
        <li><span>${escapeHtml(formatNumber(index + 1))}</span><strong>${escapeHtml(entry.label || entry.actionId || "未命名手札")}</strong><em>AP ${escapeHtml(formatNumber(entry.apCost || 0))} / CE ${escapeHtml(formatNumber(entry.ceCost || 0))}</em></li>
      `).join("")}
    </ol>
  ` : `<p class="duel-selected-hand-empty">尚未选择本回合手札</p>`;
  const selectionHint = pendingDiscardCount > 0
    ? `手牌超过上限，请先弃置 ${formatNumber(pendingDiscardCount)} 张。弃牌范围包含原有手牌与本轮新增手牌。`
    : onlineLocked
    ? "联机行动已锁定；等待对方锁定或结算。"
    : onlineMode
      ? (!selectedEntries.length
        ? "未选择手札时也可以锁定待机，用于咒力归零或没有可用手札的回合。"
        : "可以锁定行动；若继续选择手札，主要受咒力和状态限制。")
      : (!selectedEntries.length
        ? "未选择手札时将以 0 咒力待机行动推进回合。"
        : "可以执行回合，也可以继续选择咒力足够且状态允许的手札。");
  const regenBlocked = getDuelStatusEffectValue(actor, "ceRegenBlocked") > 0;
  const domainRisk = actor?.domain?.threshold
    ? actor.domain.load / actor.domain.threshold
    : 0;
  const warning = regenBlocked
    ? "咒力回流断裂，慎用高消耗手法。"
    : (domainRisk > 0.72 ? "领域负荷接近阈值，强行维持可能触发领域崩解和术式烧断。" : "");
  return `
    <section class="duel-action-panel">
      <div class="duel-action-head">
        <div class="duel-action-toolbar-buttons">
          <h4>${onlineMode ? "联机手札" : "术式手札"}</h4>
          <p class="muted">${onlineMode ? "选择手札后点击锁定行动；双方锁定前不会展示对方具体手札。" : "以咒力为主要资源选择 1 到多张手札，点击执行回合后统一结算。"}</p>
        </div>
        <div class="duel-action-meta">
          <span class="duel-chip">R${escapeHtml(battle.round + 1)}</span>
          <span class="duel-chip">当前咒力：${escapeHtml(formatNumber(actorCe))} / ${escapeHtml(formatNumber(actorMaxCe))}</span>
          <span class="duel-chip">已选 CE：${escapeHtml(formatNumber(selectedTotalCe))}，预计剩余：${escapeHtml(formatNumber(projectedCe))}</span>
          <span class="duel-chip${pendingDiscardCount > 0 ? " warning" : ""}">普通手牌：${escapeHtml(formatNumber(choices.length))} / ${escapeHtml(formatNumber(maxHandSize))}</span>
          <span class="duel-chip">领域操控：${escapeHtml(formatNumber(domainChoices.length))} / ${escapeHtml(formatNumber(maxDomainHandSize))}</span>
          <span class="duel-chip">每回合补牌：${escapeHtml(formatNumber(drawPerTurn))}</span>
          <span class="duel-chip">已选择手札：${escapeHtml(formatNumber(selectedEntries.length))} / ${escapeHtml(formatNumber(maxSelections))}</span>
        </div>
      </div>
      <p class="duel-hand-pool-hint">${escapeHtml(getDuelHandPoolInfluenceText(battle))}</p>
      ${pendingDiscardCount > 0 ? `<p class="duel-action-warning">手牌溢出：请在下方手牌中选择 ${escapeHtml(formatNumber(pendingDiscardCount))} 张弃置，弃到 ${escapeHtml(formatNumber(maxHandSize))} 张或更少后才能出牌。</p>` : ""}
      ${sideHandState.lastInjected?.length ? `<p class="duel-action-message">本轮额外加入手牌：${escapeHtml(sideHandState.lastInjected.map((item) => item.label || item.actionId).join("、"))}</p>` : ""}
      ${sideHandState.lastDiscarded?.length ? `<p class="duel-action-message">已弃置：${escapeHtml(sideHandState.lastDiscarded.map((item) => item.label || item.actionId).join("、"))}</p>` : ""}
      ${warning ? `<p class="duel-action-warning">${escapeHtml(warning)}</p>` : ""}
      ${battle.actionUiMessage ? `<p class="duel-action-message">${escapeHtml(battle.actionUiMessage)}</p>` : ""}
      ${handLockMessage ? `<div class="duel-hand-lock-message">${escapeHtml(handLockMessage)}</div>` : ""}
      <div class="duel-action-toolbar">
        <div class="duel-selected-hand-summary">
          <strong>已选择手札</strong>
          ${selectedOrder}
          <span class="duel-action-hint">${escapeHtml(selectionHint)}</span>
        </div>
        <div class="duel-hand-control-buttons">
          <button class="secondary mini" data-duel-hand-undo type="button" ${selectedEntries.length && !onlineLocked ? "" : "disabled"}>${selectedEntries.length ? `撤销：${escapeHtml(lastSelected?.label || lastSelected?.actionId || "上一张")}` : "撤销上一张"}</button>
          <button class="secondary mini" data-duel-hand-clear type="button" ${selectedEntries.length && !onlineLocked ? "" : "disabled"}>清空选择</button>
        </div>
      </div>
      <div class="duel-action-choices duel-hand-choices">
        ${choices.length
          ? choices.map((action) => renderDuelActionChoice(action, selectedIds, battle, selectedOrderMap, { discardMode: pendingDiscardCount > 0 })).join("")
          : (handLockMessage ? `<p class="duel-selected-hand-empty">${escapeHtml(handLockMessage)}</p>` : "")}
      </div>
      ${maxDomainHandSize ? `
        <div class="duel-domain-hand-head">
          <strong>领域操控手札</strong>
          <span>独立 ${escapeHtml(formatNumber(maxDomainHandSize))} 位，每轮刷新；特色领域角色更容易抽到领域展开 / 维持牌。</span>
        </div>
        <div class="duel-action-choices duel-domain-hand-choices">
          ${domainChoices.length
            ? domainChoices.map((action) => renderDuelActionChoice(action, selectedIds, battle, selectedOrderMap)).join("")
            : `<p class="duel-selected-hand-empty">当前没有可用领域操控手札。</p>`}
        </div>
      ` : ""}
    </section>
  `;
}

function renderDuelBetaFeedbackPanel(battle = state.duelBattle) {
  if (!battle) return "";
  const copy = getDuelBetaCopy();
  const hints = Array.isArray(copy.publicHints) ? copy.publicHints.slice(0, 3) : [];
  return `
    <details class="duel-beta-feedback-panel">
      <summary>
        <strong>${escapeHtml(copy.title || "术式手札 Beta 反馈")}</strong>
        <span>CANDIDATE / Beta</span>
      </summary>
      <div class="duel-beta-feedback-body">
        <p>${escapeHtml(copy.summary || "当前为手札 Beta，可导出本场反馈用于复现。")}</p>
        ${hints.length ? `<ul>${hints.map((hint) => `<li>${escapeHtml(hint)}</li>`).join("")}</ul>` : ""}
        <label class="duel-beta-feedback-note">
          <span>反馈备注</span>
          <textarea id="duelBetaFeedbackNotes" rows="3" placeholder="${escapeHtml(copy.notePlaceholder || "可选：记录本场试玩反馈。")}"></textarea>
        </label>
        <div class="duel-beta-feedback-actions">
          <button class="secondary mini" data-duel-feedback-export type="button">${escapeHtml(copy.buttons?.export || "导出本场反馈")}</button>
          <button class="secondary mini" data-duel-feedback-copy type="button">${escapeHtml(copy.buttons?.copy || "复制反馈 JSON")}</button>
          <span class="duel-action-hint" data-duel-feedback-status>反馈包不会改变战斗结果。</span>
        </div>
        <pre class="duel-beta-feedback-output" data-duel-feedback-output hidden></pre>
      </div>
    </details>
  `;
}

function buildDuelBetaFeedbackPackageFromUi() {
  const notes = els.duelBattle?.querySelector("#duelBetaFeedbackNotes")?.value || "";
  return callDuelFeedbackImplementation(
    "buildDuelBetaFeedbackPackage",
    [state.duelBattle, { version: APP_BUILD_VERSION, notes, aiPromptEstimate: state.lastAiPromptEstimate }],
    globalThis.JJKDuelFeedback?.buildDuelBetaFeedbackPackage
  );
}

function writeDuelBetaFeedbackOutput(json, message) {
  const output = els.duelBattle?.querySelector("[data-duel-feedback-output]");
  const status = els.duelBattle?.querySelector("[data-duel-feedback-status]");
  if (output) {
    output.textContent = json;
    output.hidden = false;
  }
  if (status) status.textContent = message;
}

function exportDuelBetaFeedbackPackage(options = {}) {
  if (!state.duelBattle) {
    window.alert("当前没有可导出的对局反馈。");
    return;
  }
  const payload = buildDuelBetaFeedbackPackageFromUi();
  const json = callDuelFeedbackImplementation(
    "serializeDuelBetaFeedbackPackage",
    [payload],
    globalThis.JJKDuelFeedback?.serializeDuelBetaFeedbackPackage
  );
  const filename = callDuelFeedbackImplementation(
    "getDuelBetaFeedbackFilename",
    [payload],
    globalThis.JJKDuelFeedback?.getDuelBetaFeedbackFilename
  );
  writeDuelBetaFeedbackOutput(json, options.copy ? "反馈 JSON 已生成，正在尝试复制。" : "反馈 JSON 已生成并下载。");
  if (options.copy) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(json)
        .then(() => writeDuelBetaFeedbackOutput(json, "反馈 JSON 已复制。"))
        .catch(() => {
          writeDuelBetaFeedbackOutput(json, "复制失败，已在下方显示 JSON。");
        });
    } else {
      writeDuelBetaFeedbackOutput(json, "当前浏览器不支持自动复制，已在下方显示 JSON。");
    }
    return;
  }
  downloadTextFile(json, filename, "application/json;charset=utf-8");
}

function getDuelReadableEffectPreview(view = {}, actionOrCandidate = {}) {
  const action = actionOrCandidate?.action || actionOrCandidate || {};
  const preview = view.effectPreview && typeof view.effectPreview === "object" ? view.effectPreview : {};
  const effects = action.effects && typeof action.effects === "object" ? action.effects : {};
  const requirements = {
    ...(action.requirements && typeof action.requirements === "object" ? action.requirements : {}),
    ...(action.availability && typeof action.availability === "object" ? action.availability : {})
  };
  const descriptionRows = normalizeDuelReadableItems([
    preview.effectDescription,
    preview.effectSummary,
    preview.summary,
    view.longEffect,
    view.shortEffect,
    view.effectText,
    action.description,
    view.flavorLine ? `风味：${view.flavorLine}` : ""
  ]);
  const numericRows = normalizeDuelReadableItems([
    ...normalizeDuelReadableItems(preview.numericPreview || preview.valuePreview || preview.values),
    ...buildDuelReadableEffectNumbers(effects)
  ]);
  const statusRows = normalizeDuelReadableItems([
    ...normalizeDuelReadableItems(preview.statusChanges || preview.statusPreview),
    ...buildDuelReadableStatusChanges(effects)
  ]);
  const conditionRows = normalizeDuelReadableItems([
    view.available ? "当前状态：可以执行。" : (view.availabilityMessage || view.unavailableReason || "当前状态：暂不可执行。"),
    ...normalizeDuelReadableItems(preview.conditions || preview.requirements),
    ...buildDuelReadableConditions(requirements)
  ]);
  const riskRows = normalizeDuelReadableItems([
    preview.riskDescription,
    preview.riskSummary,
    view.riskNote,
    view.riskLabel ? `风险等级：${view.riskLabel}` : "",
    action.riskNote
  ]);
  return {
    descriptions: descriptionRows.length ? descriptionRows : ["沿用既有手法效果。"],
    numbers: numericRows.length ? numericRows : ["没有额外数值预览。"],
    statuses: statusRows.length ? statusRows : ["不直接添加持续状态。"],
    conditions: conditionRows.length ? conditionRows : ["按当前战斗阶段与资源状态判定。"],
    risks: riskRows.length ? riskRows : ["风险待判定。"]
  };
}

function normalizeDuelReadableItems(value) {
  const unique = (items) => Array.from(new Set(items));
  if (Array.isArray(value)) {
    return unique(value.flatMap((item) => normalizeDuelReadableItems(item)));
  }
  if (value && typeof value === "object") {
    return unique(Object.values(value).flatMap((item) => normalizeDuelReadableItems(item)));
  }
  const text = String(value || "").trim();
  return text ? [text] : [];
}

function buildDuelReadableEffectNumbers(effects = {}) {
  const rows = [];
  const addScale = (key, label) => {
    if (effects[key] === undefined) return;
    const value = Number(effects[key]);
    if (!Number.isFinite(value)) return;
    rows.push(`${label}：${formatDuelEffectMultiplier(value)}`);
  };
  const addDelta = (key, label, suffix = "") => {
    if (effects[key] === undefined) return;
    const value = Number(effects[key]);
    if (!Number.isFinite(value) || value === 0) return;
    rows.push(`${label}：${formatSignedDuelDelta(value)}${suffix}`);
  };
  addScale("outgoingScale", "本回合输出");
  addScale("incomingHpScale", "承受体势损耗");
  addScale("incomingCeScale", "承受咒力损耗");
  addScale("sureHitScale", "必中压力");
  addScale("domainPressureScale", "领域压力");
  addScale("manualAttackScale", "手动攻击压力");
  addScale("domainLoadScale", "领域负荷增长");
  addDelta("domainLoadDelta", "领域负荷");
  addDelta("opponentDomainLoadDelta", "对方领域负荷");
  if (effects.stabilityDelta !== undefined) {
    const value = Number(effects.stabilityDelta);
    if (Number.isFinite(value) && value !== 0) rows.push(`自身稳定：${formatSignedDuelDelta(value * 100)}%`);
  }
  if (effects.opponentStabilityDelta !== undefined) {
    const value = Number(effects.opponentStabilityDelta);
    if (Number.isFinite(value) && value !== 0) rows.push(`对方稳定：${formatSignedDuelDelta(value * 100)}%`);
  }
  return rows;
}

function formatDuelEffectMultiplier(value) {
  const percent = Math.round((Number(value) - 1) * 100);
  if (!Number.isFinite(percent) || percent === 0) return "不变";
  return `${percent > 0 ? "+" : ""}${percent}%`;
}

function buildDuelReadableStatusChanges(effects = {}) {
  const rows = [];
  if (effects.activateDomain) rows.push("展开领域，进入维持状态。");
  if (effects.releaseDomain) rows.push("主动解除领域。");
  addDuelReadableStatusRow(rows, effects.selfStatus, "自身");
  addDuelReadableStatusRow(rows, effects.opponentStatus, "对方");
  return rows;
}

function addDuelReadableStatusRow(rows, status, targetLabel) {
  if (!status || typeof status !== "object") return;
  const label = status.label || status.name || "";
  const rounds = Number(status.rounds || 0);
  const duration = Number.isFinite(rounds) && rounds > 0 ? `，持续 ${formatNumber(rounds)} 回合` : "";
  if (label) rows.push(`${targetLabel}获得「${label}」${duration}。`);
}

function buildDuelReadableConditions(requirements = {}) {
  const rows = [];
  const domainActive = requirements.domainActive;
  if (domainActive === true) rows.push("需要我方领域已经展开。");
  else if (domainActive === false) rows.push("需要我方尚未展开领域。");
  else if (domainActive === "any") rows.push("领域展开与否均可使用。");
  if (requirements.opponentDomainActive) rows.push("需要对方领域正在压制。");
  if (requirements.requiresDomainAccess) rows.push("需要角色具备领域展开条件。");
  if (requirements.blocksOnTechniqueImbalance) rows.push("术式失衡时不可使用。");
  if (requirements.requiresZeroCeBypass) rows.push("需要零咒力或绕过必中捕捉的条件。");
  if (requirements.requiresNoDomainResponse) rows.push("缺少稳定反领域手段时才会进入该选择。");
  if (requirements.handBeta) rows.push("手札测试模式可用。");
  return rows;
}

function renderDuelReadableSection(title, rows) {
  const items = normalizeDuelReadableItems(rows);
  return `
    <section class="duel-card-detail-section">
      <h5>${escapeHtml(title)}</h5>
      <ul>
        ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </section>
  `;
}

function renderDuelDeveloperDetails(view = {}, debug = {}) {
  return `
    <details class="duel-hand-debug">
      <summary>开发者详情</summary>
      <dl>
        <dt>cardId</dt><dd>${escapeHtml(debug.cardId || view.cardId || "n/a")}</dd>
        <dt>sourceActionId</dt><dd>${escapeHtml(debug.sourceActionId || view.sourceActionId || view.actionId || "n/a")}</dd>
        <dt>mechanicIds</dt><dd>${escapeHtml((debug.mechanicIds || view.mechanicIds || []).join(" / ") || "none")}</dd>
        <dt>allowedContexts</dt><dd>${escapeHtml((debug.allowedContexts || view.allowedContexts || []).join(" / ") || "normal")}</dd>
        <dt>longEffect</dt><dd>${escapeHtml(view.longEffect || "n/a")}</dd>
        <dt>flavorLine</dt><dd>${escapeHtml(view.flavorLine || "n/a")}</dd>
        <dt>actionId</dt><dd>${escapeHtml(debug.actionId || view.actionId || "n/a")}</dd>
        <dt>cardType</dt><dd>${escapeHtml(debug.cardType || view.cardType || "n/a")}</dd>
        <dt>rarity</dt><dd>${escapeHtml(debug.rarity || view.rarity || "n/a")}</dd>
        <dt>effectTags</dt><dd>${escapeHtml((debug.effectTags || []).join(" / ") || "none")}</dd>
        <dt>status</dt><dd>${escapeHtml(debug.status || view.status || "n/a")}</dd>
        <dt>copyStatus</dt><dd>${escapeHtml(view.copyStatus || "n/a")}</dd>
        <dt>source</dt><dd>${escapeHtml(debug.source || view.source || "existing-action-pool")}</dd>
        <dt>weight</dt><dd>${escapeHtml(debug.weight || "n/a")}</dd>
      </dl>
    </details>
  `;
}

function getDuelCardNumericBrief(view = {}) {
  const preview = view.numericPreview || view.finalPreview || {};
  const base = preview.base || {};
  const finalDamage = Number(preview.finalDamage || 0);
  const finalBlock = Number(preview.finalBlock || 0);
  const finalCost = Number(preview.cost?.finalCost ?? view.previewCeCost?.finalCost ?? view.ceCost ?? 0);
  const baseDamage = Number(base.baseDamage || 0);
  const baseBlock = Math.max(Number(base.baseBlock || 0), Number(base.baseShield || 0));
  const modifiers = [];
  if (baseDamage > 0 && finalDamage > 0) modifiers.push(finalDamage / baseDamage);
  if (baseBlock > 0 && finalBlock > 0) modifiers.push(finalBlock / baseBlock);
  const modifier = modifiers.length
    ? modifiers.reduce((total, value) => total + value, 0) / modifiers.length
    : null;
  const modifierText = modifier
    ? `x${formatNumber(Number(modifier.toFixed(2)))}（浮动 x${formatNumber(Number((modifier * 0.92).toFixed(2)))}~x${formatNumber(Number((modifier * 1.08).toFixed(2)))})`
    : "特殊效果";
  return `攻 ${formatNumber(finalDamage)}｜防 ${formatNumber(finalBlock)}｜消耗 AP ${formatNumber(view.apCost || 0)} / CE ${formatNumber(finalCost)}｜数值修正 ${modifierText}`;
}

function renderDuelActionChoice(action, selectedIds, battle = state.duelBattle, selectedOrderMap = new Map(), options = {}) {
  const { actor, opponent } = getDuelSideResources(battle);
  const view = getDuelHandCardViewModel(action, actor, opponent, battle);
  const onlineLocked = isOnlineDuelModeActive() && state.duelModeState.localLocked;
  const selected = Boolean(selectedIds?.has(view.actionId || view.id));
  const discardMode = Boolean(options.discardMode);
  const selectedOrder = selectedOrderMap?.get(view.actionId || view.id) || 0;
  const tags = Array.isArray(view.uiTags) && view.uiTags.length ? view.uiTags.filter(Boolean) : (Array.isArray(view.tags) ? view.tags.filter(Boolean) : []);
  const visibleTags = tags.slice(0, 4);
  const tagText = visibleTags.join(" / ") || "未标记";
  const tagSuffix = tags.length > visibleTags.length ? ` / +${tags.length - visibleTags.length}` : "";
  const fullTagText = (Array.isArray(view.tags) ? view.tags.filter(Boolean) : tags).join(" / ") || "未标记";
  const debug = view.debug || {};
  const cardTypeText = view.cardTypeLabel || view.cardType || "基础";
  const titleText = view.displayName || view.label || "未命名手札";
  const subtitleText = view.subtitle || "";
  const shortEffectText = view.shortEffect || view.effectText || "沿用既有手法效果。";
  const riskText = view.riskLabel || view.risk || "风险待判定";
  const availabilityText = view.availabilityMessage || view.unavailableReason || "不可用";
  const statusText = onlineLocked
    ? "状态：已锁定，等待联机同步"
    : discardMode
      ? "状态：请先完成弃牌"
    : selected
      ? "状态：已选择，本回合将执行"
      : (view.available ? `风险：${riskText}` : availabilityText);
  const statusClass = selected ? "selected" : (view.available ? "available" : "blocked");
  const readablePreview = getDuelReadableEffectPreview(view, action);
  const numericBrief = getDuelCardNumericBrief(view);
  return `
    <article class="duel-hand-card${selected ? " active" : ""}${!view.available ? " disabled" : ""}">
      <button class="duel-action-choice duel-hand-main${selected ? " active" : ""}" data-duel-action="${escapeHtml(view.actionId)}" type="button" ${onlineLocked || discardMode || selected || !view.available ? "disabled" : ""}>
        <span class="duel-action-title">${escapeHtml(titleText)}</span>
        ${subtitleText ? `<span class="duel-action-subtitle">${escapeHtml(subtitleText)}</span>` : ""}
        ${selected ? `<span class="duel-selected-order-badge">第 ${escapeHtml(formatNumber(selectedOrder))} 手</span>` : ""}
        <span class="duel-action-card-meta">
          <i class="duel-action-card-type">类型：${escapeHtml(cardTypeText)}</i>
          <i class="duel-action-risk">风险：${escapeHtml(riskText)}</i>
        </span>
        <span class="duel-action-cost">AP ${escapeHtml(formatNumber(view.apCost))}｜咒力 ${escapeHtml(formatNumber(view.ceCost || 0))}</span>
        <span class="duel-action-numeric-brief">${escapeHtml(numericBrief)}</span>
        <span class="duel-action-effect">效果：${escapeHtml(shortEffectText)}</span>
        <span class="duel-action-tags" title="${escapeHtml(fullTagText)}">标签：${escapeHtml(tagText + tagSuffix)}</span>
        <em class="duel-action-status ${escapeHtml(statusClass)}">${escapeHtml(statusText)}</em>
      </button>
      ${discardMode ? `<button class="secondary mini duel-hand-discard-btn" data-duel-discard="${escapeHtml(view.actionId)}" type="button">弃置</button>` : ""}
      <details class="duel-hand-detail">
        <summary>卡牌详情</summary>
        <div class="duel-card-detail-grid">
          ${renderDuelReadableSection("效果说明", readablePreview.descriptions)}
          ${renderDuelReadableSection("数值预览", readablePreview.numbers)}
          ${renderDuelReadableSection("状态变化", readablePreview.statuses)}
          ${renderDuelReadableSection("适用条件", readablePreview.conditions)}
          ${renderDuelReadableSection("风险说明", readablePreview.risks)}
        </div>
        ${renderDuelDeveloperDetails(view, debug)}
      </details>
    </article>
  `;
}

function renderDuelResourceSide(resource, profile) {
  if (!resource) return "";
  const hpRatio = resource.maxHp ? clamp(resource.hp / resource.maxHp, 0, 1) : 0;
  const ceRatio = resource.maxCe ? clamp(resource.ce / resource.maxCe, 0, 1) : 0;
  const domainRatio = resource.domain?.threshold ? clamp(resource.domain.load / resource.domain.threshold, 0, 1) : 0;
  const status = resource.statusEffects?.length
    ? resource.statusEffects.map((effect) => effect.label || effect.id).join("、")
    : "无";
  const domainText = resource.domain?.threshold
    ? `${resource.domain.active ? "维持中" : "未展开"} · ${formatNumber(resource.domain.load)} / ${formatNumber(resource.domain.threshold)}`
    : "无领域负荷";
  return `
    <article class="duel-resource-side${resource.side === "right" ? " right" : ""}">
      <div class="duel-resource-head">
        <strong>${escapeHtml(resource.name)}</strong>
        <span>${escapeHtml(gradeLabel(profile?.visibleGrade))}</span>
      </div>
      ${renderDuelResourceBar("体势", resource.hp, resource.maxHp, hpRatio, "hp")}
      ${renderDuelResourceBar("咒力", resource.ce, resource.maxCe, ceRatio, "ce")}
      <div class="duel-resource-meta">
        <span>咒力回流 <strong>+${escapeHtml(formatNumber(resource.ceRegen))}</strong> / 回合</span>
        <span>咒力稳定 <strong>${escapeHtml(formatPercent(resource.stability))}</strong></span>
      </div>
      <div class="duel-domain-load">
        <span>领域负荷</span>
        <strong>${escapeHtml(domainText)}</strong>
        <div class="duel-resource-bar domain"><i style="width:${domainRatio * 100}%"></i></div>
      </div>
      <div class="duel-status-effects">状态：${escapeHtml(status)}</div>
    </article>
  `;
}

function renderDuelResourceBar(label, value, max, ratio, kind) {
  return `
    <div class="duel-resource-row ${escapeHtml(kind)}">
      <div><span>${escapeHtml(label)}</span><strong>${escapeHtml(formatNumber(value))} / ${escapeHtml(formatNumber(max))}</strong></div>
      <div class="duel-resource-bar"><i style="width:${clamp(ratio, 0, 1) * 100}%"></i></div>
    </div>
  `;
}

function renderDuelResidualLog(battle = state.duelBattle) {
  const entries = battle?.resourceState?.residualLog || [];
  if (!entries.length) return `<div class="duel-residual-log empty">残秽记录等待第一回合资源变化。</div>`;
  const visibleEntries = entries.slice(0, 10);
  const categoryCounts = visibleEntries.reduce((acc, entry) => {
    const category = entry.category || entry.type || inferDuelLogCategory(entry);
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});
  const categoryBadges = Object.entries(DUEL_LOG_CATEGORY_LABELS)
    .filter(([category]) => categoryCounts[category])
    .map(([category, label]) => `<span class="duel-log-filter ${escapeHtml(category)}">${escapeHtml(label)} ${escapeHtml(categoryCounts[category])}</span>`)
    .join("");
  return `
    <section class="duel-residual-log">
      <div class="duel-residual-log-head">
        <h4>残秽记录</h4>
        <div class="duel-log-filters">${categoryBadges}</div>
      </div>
      <ol>
        ${visibleEntries.map((entry) => {
          const category = entry.category || entry.type || inferDuelLogCategory(entry);
          return `
          <li class="duel-log-entry ${escapeHtml(category)}">
            <span class="duel-log-round">R${escapeHtml(entry.round)}</span>
            <span class="duel-log-type">${escapeHtml(DUEL_LOG_CATEGORY_LABELS[category] || entry.categoryLabel || "记录")}</span>
            <strong>${escapeHtml(entry.title)}</strong>
            <p>${escapeHtml(entry.detail)}</p>
            ${renderDuelTrialLogContext(entry, battle)}
          </li>
        `;
        }).join("")}
      </ol>
    </section>
  `;
}

function renderDuelBattlePanel(left, right, baseRate) {
  if (!els.duelBattle) return;
  const battle = state.duelBattle;
  if (!battle || battle.left.id !== left.id || battle.right.id !== right.id) {
    if (isOnlineDuelModeActive()) {
      els.duelBattle.innerHTML = `
        <div class="duel-battle-empty">
          <div>
            <strong>联机战斗初始化中</strong>
            <p class="muted">双方锁定角色后会自动进入联机手札界面；不需要点击单人开战按钮。</p>
          </div>
        </div>
      `;
      els.duelStartBtn.textContent = "联机进行中";
      els.duelStartBtn.disabled = true;
      return;
    }
    els.duelBattle.innerHTML = `
      <div class="duel-battle-empty">
        <div>
          <strong>赛前情报已生成</strong>
          <p class="muted">点击“开战”后先选赛前策略，再逐阶段推进战斗。${escapeHtml(getDuelRoundRuleText(left, right))}；战力只改变事件权重，不直接跳过战斗。</p>
        </div>
        <button class="primary" id="duelInlineStartBtn" type="button">开战</button>
      </div>
    `;
    els.duelStartBtn.textContent = "开战";
    els.duelStartBtn.disabled = false;
    els.duelBattle.querySelector("#duelInlineStartBtn")?.addEventListener("click", startDuelBattle);
    return;
  }

  const leftTactic = getDuelTacticDefinition(battle.selectedTactic);
  const rightTactic = getDuelTacticDefinition(battle.opponentTactic);
  const finalRate = computeDuelBattleFinalRate(battle);
  const safetyRoundCap = battle.safetyRoundCap || getDuelSafetyRoundCap(battle);
  const roundBadge = battle.resolved
    ? `第 ${formatNumber(battle.round)} 回合结束`
    : `第 ${formatNumber(battle.round + 1)} 回合 / 安全上限 ${formatNumber(safetyRoundCap)}`;
  const statusRows = renderDuelBattleStatus(battle, finalRate);
  const tacticButtons = getDuelTactics().map((tactic) => `
    <button class="duel-tactic${battle.selectedTactic === tactic.id ? " active" : ""}" data-duel-tactic="${escapeHtml(tactic.id)}" type="button" ${battle.autoRunning || battle.resolved || battle.round > 0 ? "disabled" : ""}>
      <strong>${escapeHtml(tactic.label)}</strong>
      <span>${escapeHtml(tactic.description)}</span>
    </button>
  `).join("");
  const resultMarkup = battle.resolved ? renderDuelBattleResult(battle) : renderDuelAutoPanel(battle, leftTactic, rightTactic);

  els.duelStartBtn.textContent = battle.resolved ? "再打一场" : battle.autoRunning ? "阶段生成中" : "重开";
  els.duelStartBtn.disabled = battle.autoRunning;
  els.duelBattle.innerHTML = `
    <div class="duel-battle-stage">
      <div class="duel-battle-head">
        <div>
          <span class="badge">${escapeHtml(roundBadge)}</span>
          <h3>${escapeHtml(battle.left.name)} 对 ${escapeHtml(battle.right.name)}</h3>
          <p class="muted">${escapeHtml(getDuelRoundRuleText(battle.left, battle.right))}</p>
        </div>
        <button class="secondary" id="duelResetBtn" type="button">清空战局</button>
      </div>
      ${statusRows}
      ${renderDuelResourcePanel(battle)}
      ${renderDuelDomainProfilePanel(battle)}
      ${renderDuelActionChoices(battle)}
      ${renderDuelBetaFeedbackPanel(battle)}
      <div class="duel-interaction">
        <details class="duel-tactic-panel" ${battle.round === 0 && !battle.resolved ? "open" : ""}>
          <summary>
            <strong>战斗倾向</strong>
            <span>整场倾向；术式手札才影响当前回合</span>
          </summary>
          <div class="duel-tactics">${tacticButtons}</div>
        </details>
        <section class="duel-round-panel">
          <h4>阶段战斗推演</h4>
          ${resultMarkup}
        </section>
      </div>
      ${renderDuelBattleLog(battle)}
      ${renderDuelResidualLog(battle)}
    </div>
  `;
  bindDuelBattleControls();
}

function renderDuelAutoPanel(battle, leftTactic, rightTactic) {
  const latest = battle.log[0];
  const safetyRoundCap = battle.safetyRoundCap || getDuelSafetyRoundCap(battle);
  const progress = safetyRoundCap ? clamp((battle.round / safetyRoundCap) * 100, 0, 100) : 0;
  const actorSide = getDuelControlledSide(battle);
  const selectedCount = getDuelSelectedHandActions(battle, actorSide).length;
  const pendingDiscardCount = Math.max(0, Number(battle.handState?.[actorSide]?.pendingDiscardCount || 0));
  const apState = getDuelApState(battle, actorSide);
  const onlineMode = isOnlineDuelModeActive();
  const needsAction = false;
  const onlineLocked = onlineMode && state.duelModeState.localLocked;
  const buttonText = onlineLocked
    ? "已锁定，等待对手"
    : pendingDiscardCount > 0
      ? `先弃牌 ${formatNumber(pendingDiscardCount)} 张`
    : onlineMode
      ? (selectedCount ? "锁定行动" : "锁定待机")
      : battle.autoRunning
    ? "生成阶段中..."
    : (selectedCount ? "执行回合" : "待机过回合");
  const resolveHint = onlineLocked
    ? "联机行动已锁定；等待对方锁定后结算。"
    : pendingDiscardCount > 0
      ? "手牌超过上限；必须先从现有手牌和新增手牌中弃牌。"
    : onlineMode
      ? (selectedCount
        ? "锁定后会提交到新版联机回合状态，不会触发单人结算。"
        : "当前没有选择手札；将以 0 咒力待机行动锁定本回合，避免流程卡死。")
      : needsAction
        ? "未选择手札时不会推进战斗。"
        : !selectedCount
          ? "当前没有选择手札；将以 0 咒力待机行动推进回合，避免流程卡死。"
        : "将按顺序结算已选手札；普通出牌以咒力预算为主。";
  return `
    <div class="duel-auto-stage">
      <div class="duel-current-choice">
        <span>我方策略：<strong>${escapeHtml(leftTactic.label)}</strong></span>
        <span>对方倾向：<strong>${escapeHtml(rightTactic.label)}</strong></span>
      </div>
      <div class="duel-auto-meter" aria-label="战斗推演进度">
        <span style="width:${progress}%"></span>
      </div>
      ${latest ? `
        <article class="duel-auto-latest">
          <span>R${escapeHtml(latest.round)}</span>
          <strong>${escapeHtml(latest.title)}</strong>
          <p>${escapeHtml(latest.detail)}</p>
        </article>
      ` : `
        <div class="duel-auto-empty">${onlineMode ? "选择联机手札后，点击锁定行动等待对方。" : "选择术式手札后，点击执行回合推进战斗阶段。"}</div>
      `}
      <p class="duel-action-hint">${escapeHtml(resolveHint)}</p>
      <button class="primary" id="${onlineMode ? "duelOnlineLockFromHandBtn" : "duelAutoRunBtn"}" type="button" ${battle.autoRunning || battle.resolved || needsAction || onlineLocked || pendingDiscardCount > 0 ? "disabled" : ""} title="${escapeHtml(resolveHint)}">
        ${escapeHtml(buttonText)}
      </button>
    </div>
  `;
}

function bindDuelBattleControls() {
  if (!els.duelBattle || !state.duelBattle) return;
  els.duelBattle.querySelector("#duelResetBtn")?.addEventListener("click", () => {
    state.duelSpinToken += 1;
    state.duelBattle = null;
    renderDuelMode();
  });
  els.duelBattle.querySelector("#duelAutoRunBtn")?.addEventListener("click", runDuelAutoBattle);
  els.duelBattle.querySelector("#duelOnlineLockFromHandBtn")?.addEventListener("click", () => {
    if (globalThis.JJKOnline?.lockSelectedTurnFromBattle) {
      state.duelBattle.actionUiMessage = "正在发送联机行动...";
      renderDuelMode();
      Promise.resolve().then(() => globalThis.JJKOnline.lockSelectedTurnFromBattle()).then((room) => {
        if (!state.duelBattle) return;
        if (room) {
          syncOnlineRoomState(room, room.viewerSide || state.duelModeState.playerSide || "left");
          return;
        }
        state.duelBattle.actionUiMessage = "行动已发送，等待服务器同步。";
        renderDuelMode();
      }).catch((error) => {
        if (state.duelBattle) {
          state.duelBattle.actionUiMessage = `联机行动提交失败：${error?.message || "请检查房间状态后重试。"}`;
          renderDuelMode();
        }
      });
      return;
    }
    document.querySelector("#onlineLockTurnBtn")?.click();
  });
  els.duelBattle.querySelector("#duelAiBattleTextBtn")?.addEventListener("click", generateDuelBattleNarrative);
  els.duelBattle.querySelector("[data-duel-hand-clear]")?.addEventListener("click", () => {
    const { actorSide } = getDuelSideResources(state.duelBattle);
    clearDuelSelectedHandActions(state.duelBattle, actorSide);
    if (state.duelBattle) {
      state.duelBattle.pendingAction = null;
      state.duelBattle.actionUiMessage = "";
    }
    updateDuelResourceReplayKey(state.duelBattle);
    renderDuelMode();
  });
  els.duelBattle.querySelector("[data-duel-hand-undo]")?.addEventListener("click", () => {
    const { actorSide, actor, opponent } = getDuelSideResources(state.duelBattle);
    const selected = getDuelSelectedHandActions(state.duelBattle, actorSide);
    const last = selected[selected.length - 1];
    if (last) unselectDuelHandCandidate(last.actionId || last.id, actor, opponent, state.duelBattle, { side: actorSide });
    if (state.duelBattle) {
      const remaining = getDuelSelectedHandActions(state.duelBattle, actorSide);
      state.duelBattle.pendingAction = remaining[0]?.action || null;
      state.duelBattle.actionUiMessage = "";
    }
    updateDuelResourceReplayKey(state.duelBattle);
    renderDuelMode();
  });
  els.duelBattle.querySelectorAll("[data-duel-action]").forEach((button) => {
    button.addEventListener("click", () => selectDuelAction(button.dataset.duelAction || ""));
  });
  els.duelBattle.querySelectorAll("[data-duel-discard]").forEach((button) => {
    button.addEventListener("click", () => {
      const { actorSide, actor } = getDuelSideResources(state.duelBattle);
      const result = discardDuelHandCandidate(button.dataset.duelDiscard || "", actor, state.duelBattle, { side: actorSide });
      if (state.duelBattle) {
        state.duelBattle.actionUiMessage = result.discarded
          ? (result.pendingDiscardCount > 0 ? `已弃置，仍需弃牌 ${formatNumber(result.pendingDiscardCount)} 张。` : "弃牌完成，可以选择手札。")
          : (result.reason || "弃牌失败");
        state.duelBattle.actionChoices = state.duelBattle.handState?.[actorSide]?.cards || state.duelBattle.actionChoices || [];
      }
      updateDuelResourceReplayKey(state.duelBattle);
      renderDuelMode();
    });
  });
  els.duelBattle.querySelector("[data-duel-feedback-export]")?.addEventListener("click", () => {
    exportDuelBetaFeedbackPackage({ copy: false });
  });
  els.duelBattle.querySelector("[data-duel-feedback-copy]")?.addEventListener("click", () => {
    exportDuelBetaFeedbackPackage({ copy: true });
  });
  els.duelBattle.querySelectorAll("[data-duel-tactic]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!state.duelBattle || state.duelBattle.autoRunning || state.duelBattle.resolved || state.duelBattle.round > 0) return;
      state.duelBattle.selectedTactic = button.dataset.duelTactic || "balanced";
      state.duelBattle.operations = [`strategy:${state.duelBattle.selectedTactic}`];
      updateDuelResourceReplayKey(state.duelBattle);
      state.duelBattle.currentOptions = [];
      state.duelBattle.selectedIndex = null;
      renderDuelMode();
    });
  });
}

function renderDuelBattleStatus(battle, finalRate) {
  const diff = battle.leftScore - battle.rightScore;
  const leftWidth = clamp(50 + diff * 5, 8, 92);
  const rightWidth = 100 - leftWidth;
  return `
    <div class="duel-battle-status">
      <div class="duel-side-score">
        <strong>${escapeHtml(battle.left.name)}</strong>
        <span>${formatNumber(battle.leftScore)} 点</span>
      </div>
      <div class="duel-score-track" aria-label="战局优势">
        <span style="width:${leftWidth}%"></span>
        <span style="width:${rightWidth}%"></span>
      </div>
      <div class="duel-side-score right">
        <strong>${escapeHtml(battle.right.name)}</strong>
        <span>${formatNumber(battle.rightScore)} 点</span>
      </div>
      <div class="duel-live-rate">
        <span>当前结算倾向</span>
        <strong>${formatPercent(finalRate)}</strong>
      </div>
    </div>
  `;
}

function renderDuelBattleLog(battle) {
  if (!battle.log.length) {
    return `<div class="duel-log empty">等待第一回合。</div>`;
  }
  return `
    <ol class="duel-log">
      ${battle.log.map((entry) => `
        <li>
          <span>R${entry.round}</span>
          <strong>${escapeHtml(entry.title)}</strong>
          <p>${escapeHtml(entry.detail)}</p>
        </li>
      `).join("")}
    </ol>
  `;
}

function renderDuelBattleResult(battle) {
  const isDraw = battle.winnerSide === "draw" || !battle.winnerSide;
  const winner = battle.winnerSide === "left" ? battle.left : battle.winnerSide === "right" ? battle.right : null;
  const loser = battle.winnerSide === "left" ? battle.right : battle.winnerSide === "right" ? battle.left : null;
  const endReason = battle.endReason || battle.resolutionReason || "ongoing";
  const endReasonLabel = getDuelEndReasonLabel(endReason);
  const resultTitle = isDraw ? "战斗未自然分出胜负" : `${winner.name} 胜出`;
  const resultDetail = isDraw
    ? `第 ${formatNumber(battle.endingRound || battle.round)} 回合：战斗没有被旧回合数胜率开奖收束。结束原因：${endReasonLabel}。当前结算倾向 ${formatPercent(battle.finalRate)} 仅作局势参考。`
    : `第 ${formatNumber(battle.endingRound || battle.round)} 回合：${loser.name} 体势被压到无法继续战斗。胜者：${winner.name}。结束原因：${endReasonLabel}。当前结算倾向 ${formatPercent(battle.finalRate)} 仅作局势参考。`;
  const aiMarkup = `
    <div class="duel-ai-battle">
      <button class="secondary" id="duelAiBattleTextBtn" type="button" ${battle.aiNarrativeLoading ? "disabled" : ""}>${battle.aiNarrativeLoading ? "生成中..." : "AI生成对战过程"}</button>
      ${battle.aiNarrativeError ? `<p class="error-text">${escapeHtml(battle.aiNarrativeError)}</p>` : ""}
      ${battle.aiNarrative ? `<p>${escapeHtml(battle.aiNarrative)}</p>` : ""}
    </div>
  `;
  return `
    <div class="duel-result">
      <span>结算结果</span>
      <strong>${escapeHtml(resultTitle)}</strong>
      <p>${escapeHtml(resultDetail)}</p>
      ${aiMarkup}
    </div>
  `;
}

async function generateDuelBattleNarrative() {
  const battle = state.duelBattle;
  if (!battle || !battle.resolved || battle.aiNarrativeLoading) return;

  battle.aiNarrativeLoading = true;
  battle.aiNarrativeError = "";
  renderDuelMode();
  try {
    const data = await requestDuelAiAssistWithFallback(buildDuelBattleAssistPayload(battle));
    battle.aiNarrative = normalizeCustomDuelLongText(data.markdown || data.battleText || "");
    if (!battle.aiNarrative) throw new Error("AI 没有返回战斗短文。");
  } catch (error) {
    battle.aiNarrativeError = buildDuelAiFailureMessage(error);
  } finally {
    battle.aiNarrativeLoading = false;
    renderDuelMode();
  }
}

function buildDuelBattleAssistPayload(battle) {
  const winner = battle.winnerSide === "left" ? battle.left : battle.winnerSide === "right" ? battle.right : null;
  const leftTactic = getDuelTacticDefinition(battle.selectedTactic);
  const rightTactic = getDuelTacticDefinition(battle.opponentTactic);
  return {
    schema: "jjk-duel-assist-request",
    version: 1,
    buildVersion: APP_BUILD_VERSION,
    mode: "battleNarrative",
    language: "zh-CN",
    customSpecialTerms: getDuelSpecialTermsForAi(),
    battle: {
      left: summarizeDuelProfileForAi(battle.left),
      right: summarizeDuelProfileForAi(battle.right),
      winnerSide: battle.winnerSide,
      winnerName: winner?.name || (battle.winnerSide === "draw" ? "平局 / 长期僵持" : ""),
      battleEnded: Boolean(battle.resolved || battle.battleEnded),
      endReason: battle.endReason || battle.resolutionReason || "ongoing",
      endingRound: battle.endingRound || battle.round,
      finalRate: roundForPayload(battle.finalRate),
      leftScore: roundForPayload(battle.leftScore),
      rightScore: roundForPayload(battle.rightScore),
      legacyMaxRounds: battle.legacyMaxRounds || battle.maxRounds,
      safetyRoundCap: battle.safetyRoundCap || getDuelSafetyRoundCap(battle),
      battleId: battle.battleId,
      seed: battle.seed,
      replayKey: battle.replayKey,
      resources: summarizeDuelResourceStateForAi(battle),
      roundRule: getDuelRoundRuleText(battle.left, battle.right),
      tactics: {
        left: { id: leftTactic.id, label: leftTactic.label, description: leftTactic.description },
        right: { id: rightTactic.id, label: rightTactic.label, description: rightTactic.description }
      },
      log: battle.log.slice().reverse().map((entry) => ({
        round: entry.round,
        title: entry.title,
        detail: entry.detail
      })),
      resourceLog: (battle.resourceState?.resourceLog || []).slice(0, 12).reverse().map((entry) => ({
        round: entry.round,
        title: entry.title,
        detail: entry.detail,
        delta: entry.delta
      })),
      actionLog: (battle.resourceState?.resourceLog || [])
        .filter((entry) => String(entry.title || "").includes("手法"))
        .slice(0, 12)
        .reverse()
        .map((entry) => ({
          round: entry.round,
          title: entry.title,
          detail: entry.detail,
          delta: entry.delta
        }))
    }
  };
}

function summarizeDuelResourceStateForAi(battle) {
  const summarize = (resource) => resource ? {
    name: resource.name,
    hp: roundForPayload(resource.hp),
    maxHp: roundForPayload(resource.maxHp),
    ce: roundForPayload(resource.ce),
    maxCe: roundForPayload(resource.maxCe),
    ceRegen: roundForPayload(resource.ceRegen),
    stability: roundForPayload(resource.stability),
    domain: {
      active: Boolean(resource.domain?.active),
      load: roundForPayload(resource.domain?.load || 0),
      threshold: roundForPayload(resource.domain?.threshold || 0),
      meltdownRisk: roundForPayload(resource.domain?.meltdownRisk || 0),
      turnsActive: resource.domain?.turnsActive || 0
    },
    statusEffects: (resource.statusEffects || []).map((effect) => effect.label || effect.id)
  } : null;
  return {
    status: "CANDIDATE",
    p1: summarize(battle.resourceState?.p1),
    p2: summarize(battle.resourceState?.p2)
  };
}

function summarizeDuelProfileForAi(profile) {
  return {
    name: profile.name,
    visibleGrade: gradeLabel(profile.visibleGrade),
    stage: getDuelStageLabel(profile.stage),
    tier: profile.tier || "",
    pool: profile.pool || "",
    combatPowerUnit: profile.combatPowerUnit?.label || "",
    disruptionUnit: profile.disruptionUnit?.label || "",
    axes: profile.axes,
    techniqueText: profile.techniqueText,
    domainProfile: profile.domainProfile,
    loadout: profile.loadout,
    innateTraits: profile.innateTraits,
    externalResource: profile.externalResource,
    notes: profile.notes,
    specialTerms: profile.specialTerms || [],
    survivalRounds: profile.survivalRounds || 0,
    winPaths: profile.winPaths || [],
    risks: profile.risks || [],
    flags: profile.flags || []
  };
}

function getDuelStageLabel(value) {
  return DUEL_STAGE_OPTIONS.find((item) => item.value === value)?.label || value || "自定义";
}

function getDuelTactics() {
  return [
    { id: "balanced", label: "稳扎稳打", description: "小幅降低极端波动。", initiative: 0, technique: 0, melee: 0, domain: 0, counter: 0, sustain: 0, finisher: 0, risk: 0 },
    { id: "assault", label: "抢攻压制", description: "提高先手和近身权重，失误也更疼。", initiative: 2.1, technique: 0.2, melee: 1.1, domain: 0, counter: -0.3, sustain: -0.4, finisher: 0.4, risk: 1.2 },
    { id: "technique", label: "术式主导", description: "提高术式、规则和资源事件。", initiative: 0.2, technique: 2.1, melee: -0.4, domain: 0.5, counter: 0, sustain: 0, finisher: 0.2, risk: 0.5 },
    { id: "domain", label: "抢领域", description: "押注领域/反领域拉扯。", initiative: -0.2, technique: 0.8, melee: -0.7, domain: 3.0, counter: -0.2, sustain: 0, finisher: 0.4, risk: 0.8 },
    { id: "counter", label: "反制拆招", description: "提高相性、扰动和对方反噬事件。", initiative: -0.4, technique: 0.2, melee: 0, domain: 0.2, counter: 2.2, sustain: 0.4, finisher: -0.2, risk: -0.2 },
    { id: "delay", label: "拖入消耗", description: "适合续航、咒具和资源型角色。", initiative: -0.9, technique: 0, melee: -0.2, domain: 0.1, counter: 0.4, sustain: 2.3, finisher: -0.5, risk: -0.4 },
    { id: "finish", label: "赌命收割", description: "后半段更强，波动最大。", initiative: 0.4, technique: 0.6, melee: 0.5, domain: 0.2, counter: -0.5, sustain: -0.7, finisher: 3.0, risk: 1.8 }
  ];
}

function getDuelTacticDefinition(id) {
  return getDuelTactics().find((item) => item.id === id) || getDuelTactics()[0];
}

function pickDuelOpponentTactic(battle) {
  const profile = battle.right;
  const opponent = battle.left;
  if (battle.round >= 3 && battle.rightScore + 2 < battle.leftScore) return "finish";
  if (hasDuelDomainAccess(profile) && profile.combatPowerUnit.value >= opponent.combatPowerUnit.value * 0.72) return "domain";
  if (profile.disruptionScore >= 7) return "counter";
  if (profile.flags.includes("jackpotSustain") || profile.flags.includes("trueRikaResource")) return "delay";
  if (profile.axes.body > profile.axes.jujutsu + 0.8) return "assault";
  if (profile.axes.jujutsu >= profile.axes.body) return "technique";
  return "balanced";
}

function runDuelAutoBattle() {
  const battle = state.duelBattle;
  if (!battle || battle.autoRunning || battle.resolved) return;
  maybeResolveDuelBattle(battle);
  if (battle.resolved) {
    renderDuelMode();
    return;
  }
  battle.autoRunning = true;
  battle.phase = "stage";
  battle.currentOptions = [];
  battle.selectedIndex = null;
  state.duelSpinToken += 1;
  const token = state.duelSpinToken;
  renderDuelMode();

  window.setTimeout(() => {
    if (token !== state.duelSpinToken || !state.duelBattle) return;
    const activeBattle = state.duelBattle;
    maybeResolveDuelBattle(activeBattle);
    if (activeBattle.resolved) {
      activeBattle.autoRunning = false;
      renderDuelMode();
      return;
    }

    activeBattle.opponentTactic = pickDuelOpponentTactic(activeBattle);
    const leftSelections = getDuelSelectedHandActions(activeBattle, "left").length
      ? getDuelSelectedHandActions(activeBattle, "left")
      : [createDuelPassTurnAction("left", activeBattle)];
    const pickedRightSelections = pickDuelCpuHandActions(activeBattle.resourceState?.p2, activeBattle.resourceState?.p1, activeBattle, { side: "right" });
    const rightSelections = pickedRightSelections.length ? pickedRightSelections : [createDuelPassTurnAction("right", activeBattle)];
    appendDuelHandBatchLog(activeBattle, "left", leftSelections, { phase: "selected" });
    appendDuelHandBatchLog(activeBattle, "right", rightSelections, { phase: "selected" });
    activeBattle.actionContext = null;
    const leftHandResult = applyDuelSelectedHandActions(activeBattle.resourceState.p1, activeBattle.resourceState.p2, activeBattle, { side: "left", actions: leftSelections });
    if (!leftHandResult?.applied) {
      appendDuelHandBatchLog(activeBattle, "left", leftSelections, { phase: "executed", result: leftHandResult });
      activeBattle.autoRunning = false;
      activeBattle.pendingAction = null;
      activeBattle.actionUiMessage = leftHandResult?.reason || "手札无法执行";
      updateDuelActionAvailability(activeBattle);
      renderDuelMode();
      return;
    }
    const rightHandResult = applyDuelSelectedHandActions(activeBattle.resourceState.p2, activeBattle.resourceState.p1, activeBattle, { side: "right", actions: rightSelections });
    appendDuelHandBatchLog(activeBattle, "left", leftSelections, { phase: "executed", result: leftHandResult });
    appendDuelHandBatchLog(activeBattle, "right", rightSelections, { phase: "executed", result: rightHandResult });
    const leftActions = leftHandResult.actions || [];
    const rightActions = rightHandResult.actions || [];
    activeBattle.currentActions = leftActions;
    activeBattle.cpuActions = rightActions;
    activeBattle.currentAction = leftActions[0] || null;
    activeBattle.cpuAction = rightActions[0] || null;
    const domainActivationPairs = [
      ...leftActions.map((action) => ({
        action,
        actor: activeBattle.resourceState.p1,
        opponent: activeBattle.resourceState.p2,
        responseAction: rightActions[0] || null
      })),
      ...rightActions.map((action) => ({
        action,
        actor: activeBattle.resourceState.p2,
        opponent: activeBattle.resourceState.p1,
        responseAction: leftActions[0] || null
      }))
    ];
    resolveDuelDomainProfileActivations(activeBattle, domainActivationPairs);
    activeBattle.currentOptions = buildDuelRoundOptions(activeBattle);
    const result = drawWeightedDuelOption(activeBattle.currentOptions, () => duelRandom(activeBattle, "roundEvent"));
    if (!result) {
      activeBattle.autoRunning = false;
      renderDuelMode();
      return;
    }

    activeBattle.operations.push(`round:${activeBattle.round + 1}:action:${leftActions.map((action) => action.id).join("+") || "none"}:cpuAction:${rightActions.map((action) => action.id).join("+") || "none"}:opponent:${activeBattle.opponentTactic}:event:${result.index}`);
    updateDuelResourceReplayKey(activeBattle);
    applyDuelRoundResult(activeBattle, result);
    activeBattle.currentOptions = [];
    activeBattle.selectedIndex = null;
    activeBattle.pendingAction = null;
    activeBattle.actionUiMessage = "";
    maybeResolveDuelBattle(activeBattle);
    if (!activeBattle.resolved) updateDuelActionAvailability(activeBattle);
    activeBattle.autoRunning = false;
    renderDuelMode();
  }, 220);
}

function buildDuelRoundOptions(battle) {
  const leftTactic = getDuelTacticDefinition(battle.selectedTactic);
  const rightTactic = getDuelTacticDefinition(battle.opponentTactic);
  const left = getDuelRoundFactors(battle.left, battle.right, leftTactic, battle, "left");
  const right = getDuelRoundFactors(battle.right, battle.left, rightTactic, battle, "right");
  const options = [
    createDuelOption("left", "先手压制", buildDuelRoundDetail(battle.left, battle.right, "initiative"), 9 + left.power + left.initiative, 1.6, "initiative"),
    createDuelOption("right", "先手压制", buildDuelRoundDetail(battle.right, battle.left, "initiative"), 9 + right.power + right.initiative, 1.6, "initiative"),
    createDuelOption("left", "术式命中", buildDuelRoundDetail(battle.left, battle.right, "technique"), 7 + left.jujutsu + left.technique, 2.2, "technique"),
    createDuelOption("right", "术式命中", buildDuelRoundDetail(battle.right, battle.left, "technique"), 7 + right.jujutsu + right.technique, 2.2, "technique"),
    createDuelOption("left", "近身交换", buildDuelRoundDetail(battle.left, battle.right, "melee"), 7 + left.body + left.melee, 1.8, "melee"),
    createDuelOption("right", "近身交换", buildDuelRoundDetail(battle.right, battle.left, "melee"), 7 + right.body + right.melee, 1.8, "melee"),
    createDuelOption("left", "资源介入", buildDuelRoundDetail(battle.left, battle.right, "resource"), 4 + left.resource + left.sustain, 2.0, "resource"),
    createDuelOption("right", "资源介入", buildDuelRoundDetail(battle.right, battle.left, "resource"), 4 + right.resource + right.sustain, 2.0, "resource"),
    createDuelOption("left", "领域拉扯", buildDuelRoundDetail(battle.left, battle.right, "domain"), 2 + left.domain, 2.8, "domain"),
    createDuelOption("right", "领域拉扯", buildDuelRoundDetail(battle.right, battle.left, "domain"), 2 + right.domain, 2.8, "domain"),
    createDuelOption("left", "相性异变", buildDuelRoundDetail(battle.left, battle.right, "counter"), 3 + left.disruption + left.counter, 2.4, "counter"),
    createDuelOption("right", "相性异变", buildDuelRoundDetail(battle.right, battle.left, "counter"), 3 + right.disruption + right.counter, 2.4, "counter"),
    createDuelOption("left", "临场爆发", buildDuelRoundDetail(battle.left, battle.right, "finisher"), 2 + left.finisher, 3.0, "finisher"),
    createDuelOption("right", "临场爆发", buildDuelRoundDetail(battle.right, battle.left, "finisher"), 2 + right.finisher, 3.0, "finisher"),
    createDuelOption("neutral", "互相试探", buildDuelNeutralRoundDetail(battle.left, battle.right), 7, 0, "neutral")
  ];

  if (leftTactic.risk > 0) {
    options.push(createDuelOption("right", "战术反噬", buildDuelTacticBackfireDetail(battle.left, battle.right, leftTactic), 2 + leftTactic.risk + right.counter, 1.9, "backfire"));
  }
  if (rightTactic.risk > 0) {
    options.push(createDuelOption("left", "战术反噬", buildDuelTacticBackfireDetail(battle.right, battle.left, rightTactic), 2 + rightTactic.risk + left.counter, 1.9, "backfire"));
  }

  return options
    .map((option, index) => ({ ...option, index, weight: Math.max(0.05, Number(option.weight) || 0.05) }))
    .filter((option) => option.weight > 0);
}

function buildDuelRoundDetail(actor, opponent, kind) {
  const actorHooks = buildDuelProfileCombatHooks(actor);
  const opponentHooks = buildDuelProfileCombatHooks(opponent);
  switch (kind) {
    case "initiative":
      return `${actor.name} 以${actorHooks.primary || "咒力节奏"}抢先铺开攻势，迫使${opponent.name}用${opponentHooks.defense || "防守和走位"}拆解第一波压制。`;
    case "technique":
      return `${actor.name} 把${actorHooks.technique || "术式"}压进有效距离，利用${actorHooks.rule || "咒力操作"}撬开${opponent.name}的防线。`;
    case "melee":
      return `${actor.name} 靠${actorHooks.body || "体术和咒力强化"}贴身交换，逼得${opponent.name}的${opponentHooks.primary || "主轴"}难以完整展开。`;
    case "resource":
      return `${actor.name} 调动${actorHooks.resource || "装备、式神或外部资源"}介入战场，把一次正面交换改成多点压迫。`;
    case "domain":
      return `${actor.name} 围绕${actorHooks.domain || "领域/反领域手段"}争夺结界主动权，压缩${opponent.name}的行动路线。`;
    case "counter":
      return `${actor.name} 借${actorHooks.counter || "相性、扰动或反制手段"}抓到空档，让${opponent.name}的${opponentHooks.primary || "攻势"}出现偏差。`;
    case "finisher":
      return `${actor.name} 把${actorHooks.winPath || actorHooks.primary || "既有胜路"}压到收束点，试图在对手调整前结束交换。`;
    default:
      return `${actor.name} 依靠${actorHooks.primary || "既有战斗配置"}拿到阶段优势。`;
  }
}

function buildDuelNeutralRoundDetail(left, right) {
  const leftHooks = buildDuelProfileCombatHooks(left);
  const rightHooks = buildDuelProfileCombatHooks(right);
  return `${left.name} 的${leftHooks.primary || "战斗主轴"}与${right.name}的${rightHooks.primary || "应对手段"}互相试探，双方都没有把情报交换成决定性收益。`;
}

function buildDuelTacticBackfireDetail(actor, opponent, tactic) {
  const actorHooks = buildDuelProfileCombatHooks(actor);
  const opponentHooks = buildDuelProfileCombatHooks(opponent);
  return `${actor.name} 选择${tactic.label}时暴露节奏，${opponent.name}用${opponentHooks.counter || opponentHooks.primary || "反制"}绕开${actorHooks.primary || "主攻路线"}。`;
}

function buildDuelProfileCombatHooks(profile = {}) {
  const technique = cleanDuelNarrativeHook(profile.techniqueText, ["未记录"]);
  const domain = cleanDuelNarrativeHook(profile.domainProfile, ["无领域", "未记录"]);
  const loadout = cleanDuelNarrativeHook([...(profile.loadout || []), profile.externalResource].filter(Boolean).join("、"), ["无"]);
  const traits = cleanDuelNarrativeHook(profile.innateTraits?.join("、"), []);
  const specialTerms = cleanDuelNarrativeHook((profile.specialTerms || []).map((term) => term.name || term).join("、"), []);
  const winPath = cleanDuelNarrativeHook(profile.winPaths?.[0], []);
  const risk = cleanDuelNarrativeHook(profile.risks?.[0], []);
  const flags = new Set(profile.flags || []);
  const body = traits && /天与|体术|黑闪|肉体|暴君|速度|力量|甚尔|真希/.test(traits)
    ? traits
    : Number(profile.axes?.body || 0) >= 7 ? "高强度肉体与近身压迫" : "";
  const counter = specialTerms ||
    (flags.has("techniqueNullification") ? "接触破术" : "") ||
    (flags.has("techniqueDisruption") ? "术式干扰" : "") ||
    (flags.has("domainSureHitInvalid") ? "规避领域必中" : "") ||
    (flags.has("soulDamage") ? "灵魂伤害" : "") ||
    winPath;
  const defense = domain ||
    (flags.has("antiDomain") ? "反领域手段" : "") ||
    (profile.survivalRounds ? `耐活 ${profile.survivalRounds} 回合` : "") ||
    risk;
  const primary = technique || domain || loadout || traits || winPath;
  return {
    primary,
    technique,
    domain,
    resource: loadout,
    traits,
    body,
    counter,
    defense,
    rule: specialTerms || traits || winPath,
    winPath,
    risk
  };
}

function cleanDuelNarrativeHook(value, blocked = []) {
  const text = normalizeCustomDuelLongText(value || "");
  if (!text) return "";
  if (blocked.some((item) => item && text.includes(item))) return "";
  return text.length > 42 ? `${text.slice(0, 42)}...` : text;
}

function createDuelOption(actor, label, detail, weight, score, kind = "neutral") {
  return { actor, label, detail, weight, score, kind };
}

function getDuelRoundFactors(profile, opponent, tactic, battle, side) {
  const unitRatio = Math.log2((profile.combatPowerUnit.value + 180) / (opponent.combatPowerUnit.value + 180));
  const scoreLead = side === "left"
    ? battle.leftScore - battle.rightScore
    : battle.rightScore - battle.leftScore;
  const comeback = scoreLead < -2 ? Math.min(1.4, Math.abs(scoreLead) * 0.18) : 0;
  const hasResources = profile.loadout.length || Boolean(profile.externalResource && profile.externalResource !== "无");
  const domainAccess = hasDuelDomainAccess(profile);
  const resource = getDuelResourcePair(battle, side);
  const techniqueImbalance = getDuelStatusEffectValue(resource, "techniqueImbalance");
  const imbalancePenalty = techniqueImbalance *
    Number(getDuelResourceRules().statusEffects?.techniqueImbalance?.weightPenalty || 1.45);
  const actionContext = getDuelActionContext(battle, side);
  const actionWeight = actionContext.weightDeltas || {};
  const residueReading = getDuelStatusEffectValue(resource, "residueReading");
  const domainActionSuppression = getDuelStatusEffectValue(resource, "domainActionSuppression");
  const domainScriptNoCard = getDuelStatusEffectValue(resource, "domainScriptNoCard");
  const techniqueConfiscated = getDuelStatusEffectValue(resource, "techniqueConfiscated");
  const curseTechniqueBound = getDuelStatusEffectValue(resource, "curseTechniqueBound");
  const incarnatedSuppressed = getDuelStatusEffectValue(resource, "incarnatedSuppressed") + getDuelStatusEffectValue(resource, "incarnatedStabilityDown");
  const summonSuppressed = getDuelStatusEffectValue(resource, "summonSuppressed") + getDuelStatusEffectValue(resource, "controllerRedirectPressure");
  const toolLocked = getDuelStatusEffectValue(resource, "cursedToolConfiscated") + getDuelStatusEffectValue(resource, "toolFunctionLocked");
  const exorcismOrderCandidate = getDuelStatusEffectValue(resource, "exorcismOrderCandidate");
  const trialRulePressure = getDuelStatusEffectValue(resource, "trialRulePressure");
  const executionStateCandidate = getDuelStatusEffectValue(resource, "executionStateCandidate");
  const jackpotStateCandidate = getDuelStatusEffectValue(resource, "jackpotStateCandidate");
  const openSlashPressure = getDuelStatusEffectValue(resource, "openSlashPressure");
  const soulTouchPressure = getDuelStatusEffectValue(resource, "soulTouchPressure");
  const shikigamiAutoAttack = getDuelStatusEffectValue(resource, "shikigamiAutoAttack");
  const jackpotCycleCandidate = getDuelStatusEffectValue(resource, "jackpotCycleCandidate");
  const domainProfilePenalty = domainActionSuppression * 0.75 + domainScriptNoCard * 2.4 + techniqueConfiscated * 1.25 + curseTechniqueBound * 1.05 + incarnatedSuppressed * 0.55 + summonSuppressed * 0.65 + toolLocked * 0.55 + trialRulePressure * 0.45 + exorcismOrderCandidate * 0.75;
  const domainPressurePenalty = openSlashPressure * 0.55 + soulTouchPressure * 0.5 + shikigamiAutoAttack * 0.45 + summonSuppressed * 0.25 + toolLocked * 0.18;
  return {
    power: clamp(unitRatio * 2.1, -3.2, 4.2),
    jujutsu: clamp((profile.axes.jujutsu - 5) * 0.75, -1.5, 3.2),
    body: clamp((profile.axes.body - 5) * 0.72, -1.5, 3.2),
    initiative: tactic.initiative + clamp(profile.axes.insight - 6, -1, 2) * 0.22 + comeback - domainActionSuppression * 0.45 - domainScriptNoCard * 1.6 - domainPressurePenalty * 0.2 + Number(actionWeight.initiative || 0),
    technique: tactic.technique + clamp(profile.axes.build - 1.5, -0.8, 2.4) + profile.disruptionScore * 0.08 - imbalancePenalty - domainProfilePenalty + executionStateCandidate * 0.35 + Number(actionWeight.technique || 0),
    melee: tactic.melee + clamp(profile.axes.body - opponent.axes.body, -2.4, 2.4) * 0.35 + executionStateCandidate * 0.45 + jackpotStateCandidate * 0.25 + Number(actionWeight.melee || 0),
    domain: tactic.domain + (domainAccess ? 2.6 : -1.4) + clamp(profile.axes.jujutsu - opponent.axes.jujutsu, -2, 2) * 0.35 - imbalancePenalty - domainProfilePenalty * 0.85 + Number(actionWeight.domain || 0),
    counter: tactic.counter + profile.disruptionScore * 0.16 + clamp(profile.axes.insight - opponent.axes.insight, -2, 2) * 0.26 + residueReading * 0.65 + Number(actionWeight.counter || 0),
    sustain: tactic.sustain + (profile.flags.includes("jackpotSustain") ? 2.2 : 0) + (hasResources ? 0.7 : 0) + jackpotCycleCandidate * 0.8 + jackpotStateCandidate * 1.7 - domainPressurePenalty * 0.35 - exorcismOrderCandidate * 0.55 + Number(actionWeight.sustain || 0),
    resource: (hasResources ? 1.4 : -0.6) + (profile.flags.includes("trueRikaResource") ? 2 : 0) + jackpotCycleCandidate * 0.45 + jackpotStateCandidate * 1.25 - summonSuppressed * 0.9 - toolLocked * 1.05 + Number(actionWeight.resource || 0),
    disruption: clamp(profile.disruptionScore - 3, 0, 6) * 0.36,
    finisher: tactic.finisher + (battle.round >= 3 ? 1.3 : 0) + clamp(profile.axes.body + profile.axes.jujutsu - 13, -1.2, 2.4) - imbalancePenalty - techniqueConfiscated * 1.1 - curseTechniqueBound * 0.95 - toolLocked * 0.75 - domainActionSuppression * 0.5 - exorcismOrderCandidate * 0.35 + executionStateCandidate * 1.4 + Number(actionWeight.finisher || 0)
  };
}

function hasDuelDomainAccess(profile) {
  return Boolean(getDuelDomainResponseProfile(profile)?.canExpandDomain);
}

function drawWeightedDuelOption(options, rng = Math.random) {
  const total = options.reduce((sum, item) => sum + Number(item.weight || 0), 0);
  if (!options.length || total <= 0) return null;
  let cursor = rng() * total;
  for (const option of options) {
    cursor -= Number(option.weight || 0);
    if (cursor <= 0) return option;
  }
  return options[options.length - 1];
}

function applyDuelRoundResult(battle, result) {
  battle.round += 1;
  if (battle.resourceState) battle.resourceState.round = battle.round;
  let leftGain = 0;
  let rightGain = 0;
  if (result.actor === "left") leftGain = result.score;
  if (result.actor === "right") rightGain = result.score;
  if (result.actor === "neutral") {
    leftGain = 0.45;
    rightGain = 0.45;
  }
  const actorResource = getDuelResourcePair(battle, result.actor);
  const opponentResource = getDuelResourcePair(battle, getDuelOpponentSide(result.actor));
  if (actorResource && opponentResource) {
    applyDuelEventResourceDelta(result, actorResource, opponentResource, battle);
  } else {
    recordDuelResourceChange(battle, {
      side: "neutral",
      title: "互相试探",
      detail: "双方压低输出交换情报，体势与咒力没有明显变化。",
      type: "system",
      delta: {}
    });
  }
  updateDuelDomainLoad(battle.resourceState?.p1, battle.resourceState?.p2, { battle, side: "left", maintain: true });
  updateDuelDomainLoad(battle.resourceState?.p2, battle.resourceState?.p1, { battle, side: "right", maintain: true });
  if (checkDuelDomainMeltdown(battle.resourceState?.p1)) triggerDuelDomainMeltdown(battle.resourceState.p1, battle, "left");
  if (checkDuelDomainMeltdown(battle.resourceState?.p2)) triggerDuelDomainMeltdown(battle.resourceState.p2, battle, "right");
  syncDuelTrialSubPhaseLifecycle(battle);
  applyDuelRoundResourceRegen(battle.resourceState?.p1, battle, "left");
  applyDuelRoundResourceRegen(battle.resourceState?.p2, battle, "right");
  const latestResource = battle.resourceState?.residualLog?.[0]?.detail || "";
  battle.leftScore = Number((battle.leftScore + leftGain).toFixed(3));
  battle.rightScore = Number((battle.rightScore + rightGain).toFixed(3));
  battle.momentum = clamp(battle.momentum + leftGain - rightGain, -8, 8);
  battle.log.unshift({
    round: battle.round,
    title: result.label,
    detail: latestResource ? `${result.detail} 残秽记录：${latestResource}` : result.detail
  });
}

function maybeResolveDuelBattle(battle) {
  if (battle.resolved) return;
  const result = resolveDuelBattleEnd(battle);
  if (!result?.ended) return;
  applyDuelBattleEndResult(battle, result);
}

function applyDuelBattleEndResult(battle, result) {
  if (!battle || battle.resolved || !result?.ended) return;
  battle.finalRate = computeDuelBattleFinalRate(battle);
  battle.winnerSide = result.winnerSide || "draw";
  battle.battleEnded = true;
  battle.endReason = result.endReason || "special_rule";
  battle.endingRound = battle.round;
  battle.resolutionReason = battle.endReason;
  battle.resolutionRoll = null;
  const snapshot = buildDuelFinalSnapshot(battle);
  battle.finalSnapshot = snapshot;
  battle.finalResourceSnapshot = snapshot.finalResourceSnapshot;
  battle.finalHandState = snapshot.finalHandState;
  battle.finalDomainState = snapshot.finalDomainState;
  const reasonLabel = result.endReasonLabel || getDuelEndReasonLabel(battle.endReason);
  const winnerLabel = battle.winnerSide === "left"
    ? battle.left.name
    : battle.winnerSide === "right"
      ? battle.right.name
      : "无胜者";
  const loserLabel = result.loserSide === "left"
    ? battle.left.name
    : result.loserSide === "right"
      ? battle.right.name
      : "双方";
  const detail = battle.endReason === "safety_cap_reached"
    ? `第 ${formatNumber(battle.round)} 回合：战斗达到技术安全上限，未自然结束。系统判定为长期僵持，请导出反馈。结束原因：${reasonLabel}。`
    : battle.endReason === "mutual_collapse"
      ? `第 ${formatNumber(battle.round)} 回合：双方体势同时归零，无法继续战斗。结束原因：${reasonLabel}。`
      : `第 ${formatNumber(battle.round)} 回合：${loserLabel}体势归零，无法继续战斗。胜者：${winnerLabel}。结束原因：${reasonLabel}。`;
  const logSide = battle.winnerSide === "left" || battle.winnerSide === "right" ? battle.winnerSide : "neutral";
  recordDuelResourceChange(battle, {
    side: logSide,
    title: reasonLabel,
    detail,
    type: "system",
    delta: {
      battleEnded: true,
      winnerSide: battle.winnerSide,
      endReason: battle.endReason,
      finalRateReference: Number(battle.finalRate.toFixed(4))
    }
  });
  if (battle.domainSubPhase?.type === "trial" && !battle.domainSubPhase.verdictResolved) {
    battle.domainSubPhase.verdictResolved = true;
    battle.domainSubPhase.violenceRestricted = false;
    battle.domainSubPhase.trialEndReason = "battleEnded";
    battle.domainSubPhase.trialStatus = "resolved";
    updateDuelDomainTrialContext(battle, { trialStatus: "resolved", trialEndReason: "battleEnded" });
    invalidateDuelActionChoices(battle);
  }
  battle.resolved = true;
  updateDuelResourceReplayKey(battle);
}

function computeDuelBattleFinalRate(battle) {
  const scoreDelta = battle.leftScore - battle.rightScore;
  const momentumDelta = Number(battle.momentum || 0);
  const resourceDelta = computeDuelResourceWinRateDelta(battle);
  const raw = Number(battle.baseRate || 0.5) + scoreDelta * 0.052 + momentumDelta * 0.018 + resourceDelta;
  return clamp(raw, 0.03, 0.97);
}

function getDuelCharacterCards() {
  const officialCards = (state.characterCards?.cards || [])
    .slice()
    .sort((left, right) => String(left.displayName).localeCompare(String(right.displayName), "zh-Hans-CN"));
  return [
    ...state.customDuelCards,
    ...officialCards
  ];
}

function syncDuelSelectOptions(cards) {
  const leftValue = els.duelLeftSelect.value;
  const rightValue = els.duelRightSelect.value;
  const options = cards.map((card) => `<option value="${escapeHtml(card.characterId)}">${escapeHtml(getDuelCardOptionLabel(card))}</option>`).join("");
  if (els.duelLeftSelect.options.length !== cards.length || els.duelLeftSelect.dataset.optionSignature !== options) {
    els.duelLeftSelect.innerHTML = options;
    els.duelLeftSelect.dataset.optionSignature = options;
  }
  if (els.duelRightSelect.options.length !== cards.length || els.duelRightSelect.dataset.optionSignature !== options) {
    els.duelRightSelect.innerHTML = options;
    els.duelRightSelect.dataset.optionSignature = options;
  }
  els.duelLeftSelect.value = cards.some((card) => card.characterId === leftValue) ? leftValue : (cards[0]?.characterId || "");
  const defaultRight = cards[1]?.characterId || cards[0]?.characterId || "";
  els.duelRightSelect.value = cards.some((card) => card.characterId === rightValue) ? rightValue : defaultRight;
  if (els.duelLeftSelect.value === els.duelRightSelect.value && cards.length > 1) {
    els.duelRightSelect.value = cards.find((card) => card.characterId !== els.duelLeftSelect.value)?.characterId || defaultRight;
  }
}

function getDuelCardOptionLabel(card) {
  return card.customDuel ? `自定义 · ${card.displayName}` : card.displayName;
}

function renderDuelCharacterCard(profile, sideLabel) {
  const statRows = [
    ["咒力总量", profile.baseStats.cursedEnergy, profile.raw.cursedEnergyScore],
    ["咒力操纵", profile.baseStats.control, profile.raw.controlScore],
    ["咒力效率", profile.baseStats.efficiency, profile.raw.efficiencyScore],
    ["体质", profile.baseStats.body, profile.raw.bodyScore],
    ["体术", profile.baseStats.martial, profile.raw.martialScore],
    ["悟性", profile.baseStats.talent, profile.raw.talentScore]
  ].map(([label, rank, score]) => `
    <div class="duel-stat">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(rank || "-")}</strong>
      <small class="muted">${formatNumber(score)}</small>
    </div>
  `).join("");

  const axisText = `咒术 ${formatNumber(profile.axes.jujutsu)} / 肉体 ${formatNumber(profile.axes.body)} / 悟性 ${formatNumber(profile.axes.insight)} / 构筑 ${formatNumber(profile.axes.build)}`;
  return `
    <article class="duel-card">
      <span class="badge">${escapeHtml(sideLabel)}</span>
      <h3>${escapeHtml(profile.name)}</h3>
      <div class="duel-meta">
        <span class="duel-chip">${escapeHtml(gradeLabel(profile.visibleGrade))}</span>
        <span class="duel-chip">${escapeHtml(profile.pool)}</span>
        <span class="duel-chip">战力 ${escapeHtml(profile.combatPowerUnit.label)}</span>
        <span class="duel-chip">扰动 ${escapeHtml(profile.disruptionUnit.label)}</span>
      </div>
      <div class="duel-stats">${statRows}</div>
      <dl class="duel-block">
        <dt>四轴</dt><dd>${escapeHtml(axisText)}</dd>
        <dt>特质</dt><dd>${escapeHtml(formatDuelList(profile.innateTraits))}</dd>
        <dt>术式/强度</dt><dd>${escapeHtml(profile.techniqueText)}</dd>
        <dt>领域</dt><dd>${escapeHtml(profile.domainProfile || "未记录")}</dd>
        <dt>装备/外部资源</dt><dd>${escapeHtml(formatDuelList([...profile.loadout, profile.externalResource].filter(Boolean)))}</dd>
        <dt>特殊词条</dt><dd>${escapeHtml(formatDuelProfileSpecialTerms(profile))}</dd>
        <dt class="debug-only">机制标签</dt><dd class="debug-only">${escapeHtml(formatDuelList(profile.flags))}</dd>
        <dt>说明</dt><dd>${escapeHtml(profile.notes || "无")}</dd>
      </dl>
    </article>
  `;
}

function evaluateDuelCharacterCard(card) {
  const raw = {
    cursedEnergyScore: duelRankValue(card.baseStats?.cursedEnergy),
    controlScore: duelRankValue(card.baseStats?.control),
    efficiencyScore: duelRankValue(card.baseStats?.efficiency),
    bodyScore: duelRankValue(card.baseStats?.body),
    martialScore: duelRankValue(card.baseStats?.martial),
    talentScore: duelRankValue(card.baseStats?.talent)
  };
  const activeMechanisms = getDuelActiveMechanisms(card);
  const lockedRaw = applyDuelMechanismLocks(raw, activeMechanisms);
  const mechanismImpact = summarizeDuelMechanisms(activeMechanisms);
  const loadout = summarizeDuelLoadout(card.loadout || []);
  const technique = summarizeDuelTechnique(card);
  const external = summarizeDuelExternalResource(card);
  const domain = summarizeDuelDomain(card);
  const axisConfig = state.mechanisms?.axisWeights || {};

  const jujutsu = clamp(
    weightedDuelScore(lockedRaw, axisConfig.jujutsu) + mechanismImpact.axisBonus.jujutsu + technique.axisBonus.jujutsu + external.axisBonus.jujutsu,
    0,
    12
  );
  const body = clamp(weightedDuelScore(lockedRaw, axisConfig.body) + mechanismImpact.axisBonus.body + loadout.axisBonus.body, 0, 12);
  const insight = clamp(weightedDuelScore(lockedRaw, axisConfig.insight) + mechanismImpact.axisBonus.insight + technique.axisBonus.insight, 0, 12);
  const build = clamp(
    technique.axisBonus.build + loadout.axisBonus.build + mechanismImpact.axisBonus.build + external.axisBonus.build + domain.axisBonus.build,
    0,
    12
  );

  const baseScore = jujutsu * 0.33 + body * 0.29 + insight * 0.16 + build * 0.22;
  let combatScore = clamp(
    baseScore + mechanismImpact.scoreBonus + loadout.scoreBonus + technique.scoreBonus + external.scoreBonus + domain.scoreBonus + duelStageBonus(card.stage),
    0,
    12
  );
  const physicalCarryScore = clamp(body * 0.6 + insight * 0.18 + build * 0.16 + loadout.scoreBonus + mechanismImpact.scoreBonus + loadout.disruption * 0.08, 0, 12);
  if (body >= 9 && mechanismImpact.tags.includes("zeroCE")) {
    combatScore = Math.max(combatScore, Math.min(physicalCarryScore, 8.15));
  }
  if (body >= 7.2 && jujutsu >= 6.8 && insight >= 6.6) {
    combatScore = Math.max(combatScore, body * 0.28 + jujutsu * 0.34 + insight * 0.18 + build * 0.2);
  }

  const disruptionScore = clamp(technique.disruption + loadout.disruption + mechanismImpact.disruption + external.disruption + domain.disruption, 0, 12);
  const combatPowerUnit = buildCombatPowerUnit(combatScore);
  const profile = {
    id: card.characterId,
    name: card.displayName,
    visibleGrade: getDuelVisibleGrade(card),
    tier: card.powerTier || "",
    powerTier: card.powerTier || "",
    officialGrade: card.officialGrade || "",
    stage: card.stage || "",
    trialSubjectType: card.trialSubjectType || "",
    trialEligibility: card.trialEligibility || "",
    verdictVocabulary: card.verdictVocabulary || "",
    hasLegalAgency: card.hasLegalAgency,
    hasSelfAwareness: card.hasSelfAwareness,
    canDefend: card.canDefend,
    canRemainSilent: card.canRemainSilent,
    techniquePower: card.techniquePower || "",
    baseStats: card.baseStats || {},
    raw: lockedRaw,
    axes: { jujutsu, body, insight, build },
    combatScore,
    combatPowerUnit,
    pool: classifyInstantCombatPool(combatScore).label,
    disruptionScore,
    disruptionUnit: buildDuelDisruptionUnit(disruptionScore),
    innateTraits: card.innateTraits || [],
    advancedTechniques: card.advancedTechniques || [],
    loadout: loadout.matchedTools.length ? loadout.matchedTools : (card.loadout || []),
    externalResource: card.externalResource || "",
    techniqueText: formatDuelTechniqueText(card),
    domainProfile: card.domainProfile || "",
    domainScript: card.domainScript || null,
    customDuel: Boolean(card.customDuel),
    characterCardProfile: card,
    flags: Array.from(new Set([...(technique.tags || []), ...(loadout.tags || []), ...(mechanismImpact.tags || []), ...(external.tags || []), ...(domain.tags || [])])),
    notes: card.notes || ""
  };
  if (!state.debugMode) return applyDuelSpecialTermsToProfile(profile);
  const withManualOverride = applyDuelManualCombatOverride(profile, {
    combatScore: card.debugManualCombatScore,
    combatUnit: card.debugManualCombatUnit,
    source: "自定义角色直填"
  });
  return applyDuelSpecialTermsToProfile(withManualOverride);
}

function formatDuelTechniqueText(card) {
  const details = [];
  if (card.techniqueName) details.push(card.techniqueName);
  if (card.techniqueDescription) details.push(card.techniqueDescription);
  if (card.techniquePower) details.push(`强度 ${card.techniquePower}`);
  return details.length ? details.join(" / ") : "未记录";
}

function duelRankValue(rank) {
  const curve = state.mechanisms?.rankGrowthModel?.numericCurve || state.mechanisms?.rankScale || state.strength?.rankScale || {};
  const value = callSiteModuleImplementation("JJKCharacter", "characterRankValue", [rank, { rankScale: curve }]);
  return Number(value >= 0 ? value : 0);
}

function weightedDuelScore(raw, weights = {}) {
  let total = 0;
  let weightSum = 0;
  for (const [key, value] of Object.entries(weights || {})) {
    if (!key.endsWith("Score")) continue;
    const weight = Number(value);
    if (!Number.isFinite(weight) || weight <= 0) continue;
    total += Number(raw[key] || 0) * weight;
    weightSum += weight;
  }
  return weightSum ? total / weightSum : 0;
}

function getDuelActiveMechanisms(card) {
  const texts = [
    card.displayName,
    card.techniqueName,
    card.techniqueDescription,
    ...(card.innateTraits || []),
    ...(card.advancedTechniques || []),
    ...(card.loadout || []),
    card.domainProfile,
    card.externalResource,
    card.notes
  ].filter(Boolean).map(String);
  return (state.mechanisms?.mechanisms || []).filter((mechanism) => {
    return (mechanism.match || []).some((keyword) => texts.some((text) => text.includes(keyword)));
  });
}

function applyDuelMechanismLocks(raw, activeMechanisms) {
  const locked = { ...raw };
  for (const mechanism of activeMechanisms) {
    for (const lock of mechanism.locks || []) {
      locked[lock.field] = Math.max(Number(locked[lock.field] || 0), Number(lock.minScore || 0));
    }
  }
  return locked;
}

function summarizeDuelMechanisms(activeMechanisms) {
  const result = emptyDuelImpact();
  for (const mechanism of activeMechanisms) mergeDuelImpact(result, mechanism.instantCombatImpact || {});
  result.disruption += result.tags.includes("domainSureHitInvalid") ? 1.2 : 0;
  result.disruption += result.tags.includes("efficiencyLock") ? 0.5 : 0;
  return normalizeDuelImpact(result);
}

function summarizeDuelLoadout(loadout) {
  const result = emptyDuelImpact();
  const matched = [];
  for (const item of loadout) {
    const card = (state.mechanisms?.cursedTools || []).find((tool) => {
      return (tool.match || []).some((keyword) => String(item).includes(keyword));
    });
    if (!card) continue;
    matched.push(card.displayName || card.id);
    mergeDuelImpact(result, card.instantCombatImpact || {});
  }
  if (loadout.length >= 4) result.scoreBonus += 0.36;
  if (loadout.length >= 2) result.scoreBonus += 0.18;
  if (result.tags.includes("physicalScaling")) result.axisBonus.body += 0.22;
  if (result.tags.includes("soulDamage") || result.tags.includes("techniqueNullification")) result.axisBonus.build += 0.42;
  if (result.tags.includes("techniqueDisruption")) result.axisBonus.build += 0.3;
  result.disruption += result.tags.includes("techniqueNullification") ? 1.6 : 0;
  result.disruption += result.tags.includes("soulDamage") ? 1.2 : 0;
  result.disruption += result.tags.includes("techniqueDisruption") ? 1.4 : 0;
  result.matchedTools = matched;
  return normalizeDuelImpact(result);
}

function summarizeDuelTechnique(card) {
  const result = emptyDuelImpact();
  const text = getDuelCardMechanicText(card);
  const score = duelRankValue(card.techniquePower);
  if (score) {
    const scalar = (score - 4) / 8;
    result.axisBonus.jujutsu += scalar * 0.95;
    result.axisBonus.insight += scalar * 0.38;
    result.axisBonus.build += scalar * 2.45;
    result.scoreBonus += scalar * 0.42;
    result.disruption += scalar * 1.45;
    result.tags.push("techniquePower");
  }
  if (card.powerTier === "haxException") {
    result.axisBonus.build += 1.45;
    result.scoreBonus += 0.48;
    result.disruption += 7.35;
    result.tags.push("haxLimitedCombat");
  }
  if (card.powerTier === "supportHax") {
    result.axisBonus.build += 1.35;
    result.scoreBonus -= 0.18;
    result.disruption += 7.3;
    result.tags.push("supportHax");
  }
  if (isDuelSixEyesLimitless(card, text)) {
    result.axisBonus.build += 0.75;
    result.scoreBonus += 1.22;
    result.disruption += 1.1;
    result.tags.push("limitlessDefense", "sixEyesExecution", "reproducibleGojoCore", "customGojoFamilyCore");
  } else if (isDuelLimitless(card, text)) {
    result.axisBonus.build += 0.42;
    result.scoreBonus += 0.45;
    result.disruption += 0.55;
    result.tags.push("limitlessDefense", "customLimitless");
  }
  if (/Modulo天花板|基础数值接近宿傩|术式强度高于宿傩|达布拉/.test(text)) {
    result.scoreBonus += 1.26;
    result.disruption += 1.45;
    result.tags.push("postCanonTechniqueCeiling");
  }
  if (/400年前最强|古代最强.*无领域|电荷咒力.*强度来源|鹿紫云/.test(text)) {
    result.axisBonus.build += 0.35;
    result.scoreBonus += 0.72;
    result.disruption += 0.95;
    result.tags.push("ancientStrongestNoDomain");
  }
  if (/与秤金次长期相持|秤金次长期相持|秤.*长期相持|里梅/.test(text)) {
    result.axisBonus.build += 0.38;
    result.scoreBonus += 0.72;
    result.disruption += 0.7;
    result.tags.push("hakariAdjacentStall");
  }
  if (/五条长期缠斗|长期缠斗.*五条|黑绳构筑|米格尔/.test(text)) {
    result.axisBonus.body += 0.45;
    result.axisBonus.insight += 0.35;
    result.axisBonus.build += 0.85;
    result.scoreBonus += 1.22;
    result.disruption += 0.65;
    result.tags.push("gojoStallSpecialGrade");
  }
  if (/咒灵操术库存|百鬼夜行不兵分两路|不兵分两路|夏油杰/.test(text)) {
    result.axisBonus.build += 0.55;
    result.scoreBonus += 0.42;
    result.disruption += 0.8;
    result.tags.push("curseInventory");
  }
  return normalizeDuelImpact(result);
}

function getDuelCardMechanicText(card) {
  return [
    card.displayName,
    card.techniqueName,
    card.techniqueDescription,
    card.domainProfile,
    card.externalResource,
    card.notes,
    ...(card.innateTraits || []),
    ...(card.advancedTechniques || []),
    ...(card.loadout || [])
  ].filter(Boolean).join(" ");
}

function isCustomDuelSixEyesLimitless(card, text = getDuelCardMechanicText(card)) {
  if (!card?.customDuel) return false;
  return isDuelSixEyesLimitless(card, text);
}

function isCustomDuelLimitless(card, text = getDuelCardMechanicText(card)) {
  if (!card?.customDuel) return false;
  return isDuelLimitless(card, text);
}

function isDuelSixEyesLimitless(card, text = getDuelCardMechanicText(card)) {
  return text.includes("六眼") && isDuelLimitless(card, text);
}

function isDuelLimitless(card, text = getDuelCardMechanicText(card)) {
  if (/无下限|不可侵|苍|赫|茈|无量空处/.test(text)) return true;
  return text.includes("六眼") && /无限/.test(text);
}

function summarizeDuelExternalResource(card) {
  const result = emptyDuelImpact();
  const text = [card.externalResource, card.notes, ...(card.loadout || [])].filter(Boolean).join(" ");
  if (String(card.externalResource || "").includes("真里香")) {
    result.axisBonus.jujutsu += 1.8;
    result.axisBonus.build += 1.65;
    result.scoreBonus += 1.15;
    result.disruption += 1.7;
    result.tags.push("trueRikaResource");
  }
  if (text.includes("咒灵操术") || text.includes("库存")) {
    result.axisBonus.build += 0.5;
    result.scoreBonus += 0.06;
    result.disruption += 0.7;
    result.tags.push("externalCurseStock");
  }
  if (text.includes("坐杀搏徒中奖")) {
    result.axisBonus.build += 1.45;
    result.scoreBonus += 0.78;
    result.disruption += 0.7;
    result.tags.push("jackpotSustain");
  }
  if (text.includes("乙骨戒指") || text.includes("里香资源")) {
    result.axisBonus.jujutsu += 0.6;
    result.axisBonus.build += 0.55;
    result.scoreBonus += 0.38;
    result.disruption += 0.45;
    result.tags.push("rikaResidualResource");
  }
  if (text.includes("不老") || text.includes("咒物沉淀") || text.includes("随意黑闪")) {
    result.axisBonus.insight += 1.25;
    result.axisBonus.build += 1.45;
    result.scoreBonus += 0.95;
    result.disruption += 1.4;
    result.tags.push("blackFlashAtWill", "curseObjectSedimentation");
  }
  return normalizeDuelImpact(result);
}

function summarizeDuelDomain(card) {
  const result = emptyDuelImpact();
  const text = getDuelCardMechanicText(card);
  if (text.includes("无领域")) {
    result.tags.push("noDomain");
    return normalizeDuelImpact(result);
  }
  if (/开放领域|伏魔御厨子/.test(text)) {
    result.axisBonus.build += 2.3;
    result.scoreBonus += 0.95;
    result.disruption += 2.7;
    result.tags.push("topDomain", "openDomainExecution", "reproducibleSukunaDomain");
  } else if (/无量空处|顶级领域|顶尖领域|顶格领域|最高级领域/.test(text)) {
    result.axisBonus.build += 1.3;
    result.scoreBonus += 0.5;
    result.disruption += 1.5;
    result.tags.push("topDomain", "customTopDomain");
  } else if (/真赝相爱|真里香|领域可用假定|达布拉|Modulo/.test(text)) {
    result.axisBonus.build += 0.6;
    result.scoreBonus += 0.18;
    result.disruption += 0.55;
    result.tags.push("domainCapableAssumption");
  } else if (/坐杀搏徒|中奖状态|领域续航/.test(text)) {
    result.axisBonus.build += 0.85;
    result.scoreBonus += 0.32;
    result.disruption += 0.8;
    result.tags.push("domainSustainEngine");
  } else if (/领域展开|领域|domain|Domain/.test(text)) {
    result.axisBonus.build += 0.45;
    result.scoreBonus += 0.12;
    result.disruption += 0.4;
    result.tags.push("domainCapableAssumption", "customDomain");
  }
  return normalizeDuelImpact(result);
}

function duelStageBonus(stage) {
  return {
    after68: 0.12,
    modulo: 0.04,
    shinjuku: 0.03,
    heianToShinjuku: 0.03
  }[stage] || 0;
}

function getDuelVisibleGrade(card) {
  if (card.visibleGrade) return card.visibleGrade;
  const official = String(card.officialGrade || "");
  if (official.includes("特级")) return "specialGrade";
  if (official.includes("特别一级") || official.includes("一级")) return "grade1";
  if (official.includes("二级")) return "grade2";
  if (official.includes("三级")) return "grade3";
  if (official.includes("四级")) return "grade4";
  const tier = String(card.powerTier || "");
  if (["canonCeiling", "postCanonException", "postCanonCeiling", "specialGrade"].includes(tier)) return "specialGrade";
  if (["topTierPhysical", "topTier", "topTierSustain", "topTierMinus", "newGenerationTop", "haxException"].includes(tier)) return "grade1";
  if (tier === "supportHax") return "grade2";
  return "support";
}

function buildDuelDisruptionUnit(score) {
  const normalized = clamp(Number(score) || 0, 0, 12);
  const value = Math.round(100 * Math.pow(2, normalized / 1.85));
  return {
    score: Number(normalized.toFixed(4)),
    value,
    label: formatCombatPowerUnit(value),
    band: getCombatPowerUnitBand(value)
  };
}

function emptyDuelImpact() {
  return {
    axisBonus: { jujutsu: 0, body: 0, insight: 0, build: 0 },
    scoreBonus: 0,
    disruption: 0,
    tags: [],
    matchedTools: []
  };
}

function mergeDuelImpact(target, impact) {
  for (const axis of Object.keys(target.axisBonus)) target.axisBonus[axis] += Number(impact.axisBonus?.[axis] || 0);
  target.scoreBonus += Number(impact.scoreBonus || 0);
  target.disruption += Number(impact.disruption || 0);
  target.tags.push(...(impact.tags || []));
}

function normalizeDuelImpact(impact) {
  impact.tags = Array.from(new Set(impact.tags));
  impact.matchedTools = Array.from(new Set(impact.matchedTools || []));
  for (const axis of Object.keys(impact.axisBonus)) impact.axisBonus[axis] = clamp(impact.axisBonus[axis], -2, 4);
  impact.scoreBonus = clamp(impact.scoreBonus, -1, 2.4);
  impact.disruption = clamp(impact.disruption, 0, 12);
  return impact;
}

function formatDuelList(values) {
  const list = (values || []).filter(Boolean);
  return list.length ? list.join("、") : "无";
}
