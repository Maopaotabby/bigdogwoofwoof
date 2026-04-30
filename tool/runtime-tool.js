//--强度计算与战力工具--//
function computeScores() {
  const ids = {
    cursedEnergyScore: "cursedEnergy",
    controlScore: "control",
    martialScore: "martial",
    bodyScore: "body",
    efficiencyScore: "efficiency",
    talentScore: "talent"
  };
  const raw = {};
  const rawRanks = {};
  for (const [key, nodeId] of Object.entries(ids)) {
    const answer = state.answers[nodeId];
    if (!answer) return null;
    const wheelConfig = state.strength.baseAttributeWheels[key];
    const optionConfig = resolveBaseAttributeOptionConfig(wheelConfig, answer);
    const rank = optionConfig.rank || parseRank(answer.rawText || answer.text || "");
    const score = Number(optionConfig.score);
    raw[key] = Number.isFinite(score) ? score : Math.max(0, rankValue(rank));
    rawRanks[key] = rank;
  }
  applyHeavenlyRestrictionScoreEffects(raw, rawRanks);
  const rankCounts = countRawRanks(rawRanks);
  const rawBase = { ...raw };
  applyEffortScoreEffects(raw);
  const flavor = getFlavorScoreModifiers();
  const resource = clamp(0.6 * raw.cursedEnergyScore + 0.4 * raw.efficiencyScore + flavor.resource, 0, 10);
  const control = clamp(0.7 * raw.controlScore + 0.3 * raw.efficiencyScore + flavor.control, 0, 10);
  const body = clamp(0.55 * raw.martialScore + 0.45 * raw.bodyScore + flavor.body, 0, 10);
  const growth = clamp(raw.talentScore + flavor.growth, 0, 10);
  const basePowerScore = 0.25 * resource + 0.25 * control + 0.25 * body + 0.25 * growth;
  const rawValues = Object.values(raw);
  const highCounts = {
    aPlus: rawValues.filter((value) => value >= 5).length,
    sPlus: rawValues.filter((value) => value >= 6).length,
    ssPlus: rawValues.filter((value) => value >= 7).length,
    sssPlus: rawValues.filter((value) => value >= 8).length
  };
  return { raw, rawBase, rawRanks, rankCounts, highCounts, resource, control, body, growth, basePowerScore, flavor };
}

function resolveBaseAttributeOptionConfig(wheelConfig = {}, answer = {}) {
  const options = Object.values(wheelConfig.options || {});
  const answerText = normalizeBaseAttributeOptionText(answer.rawText || answer.text || "");
  const answerRank = parseRank(answer.rawText || answer.text || "");

  return options.find((option) => normalizeBaseAttributeOptionText(option.label) === answerText) ||
    options.find((option) => option.rank && option.rank === answerRank) ||
    {};
}

function normalizeBaseAttributeOptionText(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

function applyHeavenlyRestrictionScoreEffects(raw, rawRanks) {
  if (isCursedEnergyBoostHeavenlyRestriction()) {
    setExactScoreRank(raw, rawRanks, "bodyScore", 0, "E-");
    setMinimumScoreRank(raw, rawRanks, "cursedEnergyScore", 8, "SSS");
  }
  if (isZeroCursedEnergyHeavenlyRestriction()) {
    setExactScoreRank(raw, rawRanks, "cursedEnergyScore", 0, "E-");
    setExactScoreRank(raw, rawRanks, "controlScore", 0, "E-");
    setExactScoreRank(raw, rawRanks, "efficiencyScore", 0, "E-");
    setMinimumScoreRank(raw, rawRanks, "bodyScore", 8, "SSS");
    setMinimumScoreRank(raw, rawRanks, "martialScore", 8, "SSS");
  }
}

function setExactScoreRank(raw, rawRanks, field, score, rank) {
  raw[field] = score;
  rawRanks[field] = rank;
}

function setMinimumScoreRank(raw, rawRanks, field, score, rank) {
  if (Number(raw[field] || 0) < score) {
    raw[field] = score;
    rawRanks[field] = rank;
  }
}

function countRawRanks(rawRanks) {
  const rankCounts = { ex: 0, sss: 0, ss: 0, ssPlus: 0 };
  for (const rank of Object.values(rawRanks || {})) {
    if (rank === "EX") rankCounts.ex += 1;
    if (rank === "SSS") rankCounts.sss += 1;
    if (rank === "SS") rankCounts.ss += 1;
    if (["EX", "SSS", "SS"].includes(rank)) rankCounts.ssPlus += 1;
  }
  return rankCounts;
}

function buildStrengthSnapshot() {
  const scores = computeScores();
  if (!scores) return null;
  const snapshot = {
    ...scores,
    abilityBuildBonus: computeAbilityBuildBonus(),
    gradeEffectiveScore: computeGradeEffectiveScore(scores),
    gradeFloor: getGradeFloor(scores),
    techniqueSynergy: computeTechniqueSynergyBreakdown(scores),
    domainQuality: computeDomainQualityScore()
  };
  snapshot.instantCombatProfile = buildInstantCombatProfile(snapshot);
  return snapshot;
}

function renderInstantCombatProfile(profile) {
  if (!profile) return "";
  const axisRows = [
    ["咒术", profile.axisScores.jujutsu, "咒力总量为底，操纵/效率放大或衰减。"],
    ["肉体", profile.axisScores.body, "体质为底，体术决定兑现。"],
    ["悟性", profile.axisScores.insight, "学习理解与复杂构筑兑现。"],
    ["构筑", profile.axisScores.build, "术式、领域、反领域、咒具和特性。"]
  ].map(([label, value, note]) => {
    const width = Math.max(0, Math.min(100, (Number(value || 0) / 12) * 100));
    return `
      <div class="score-line instant-axis">
        <span>${label}</span>
        <span class="bar"><span style="width:${width}%"></span></span>
        <strong>${formatNumber(value)}</strong>
      </div>
      <p class="score-note">${escapeHtml(note)}</p>
    `;
  }).join("");
  const tags = profile.tags.length ? profile.tags.join(" / ") : "无";
  return `
    <div class="instant-combat-card">
      <div class="instant-combat-head">
        <span>即时战力</span>
        <strong>${formatNumber(profile.instantPowerScore)}</strong>
      </div>
      <dl class="instant-meta">
        <dt>显性</dt><dd>${escapeHtml(gradeLabel(profile.visibleGrade))}</dd>
        <dt>单位</dt><dd>${escapeHtml(profile.combatPowerUnit.label)}（${escapeHtml(profile.combatPowerUnit.band)}）</dd>
        <dt>扰动</dt><dd>${escapeHtml(profile.disruptionUnit.label)}（${escapeHtml(profile.disruptionUnit.band)}）</dd>
        <dt>池</dt><dd>${escapeHtml(profile.pool.label)}</dd>
        <dt>置信度</dt><dd>${escapeHtml(profile.confidence.label)}</dd>
        <dt>时间点</dt><dd>${escapeHtml(profile.stage.label)}</dd>
        <dt>咒具</dt><dd>${escapeHtml(profile.loadout.label)}</dd>
        ${profile.curseAgeGrowth?.applies ? `<dt>咒灵成长</dt><dd>${escapeHtml(profile.curseAgeGrowth.label)}</dd>` : ""}
      </dl>
      ${axisRows}
      <p class="score-note"><strong>胜路：</strong>${escapeHtml(profile.winPaths.join("；") || "暂无明显胜路")}</p>
      <p class="score-note"><strong>风险：</strong>${escapeHtml(profile.risks.join("；") || "暂无主要风险")}</p>
      <p class="score-note"><strong>机制：</strong>${escapeHtml(tags)}</p>
    </div>
  `;
}

function buildInstantCombatProfile(strength) {
  const activeMechanisms = getActiveCombatMechanisms();
  const mechanismImpact = summarizeCombatImpacts(activeMechanisms);
  const lockedRaw = applyCombatMechanismLocks(strength.raw, activeMechanisms);
  const loadout = buildCurrentLoadoutProfile();
  const domainState = getDomainCombatState();
  const stage = getCurrentCombatStage();
  const curseAgeGrowth = computeCurseAgeGrowthProfile();
  const technique = strength.techniqueSynergy || {};
  const axisConfig = state.mechanisms?.axisWeights || {};
  const axisScores = {
    jujutsu: weightedRawScore(lockedRaw, axisConfig.jujutsu || {
      cursedEnergyScore: 0.5,
      controlScore: 0.27,
      efficiencyScore: 0.23
    }),
    body: weightedRawScore(lockedRaw, axisConfig.body || {
      bodyScore: 0.54,
      martialScore: 0.46
    }),
    insight: weightedRawScore(lockedRaw, axisConfig.insight || {
      talentScore: 0.72,
      controlScore: 0.16,
      martialScore: 0.12
    }),
    build: 0
  };

  axisScores.jujutsu = clamp(axisScores.jujutsu + mechanismImpact.axisBonus.jujutsu + getTechniqueAxisBonus(technique, "jujutsu"), 0, 12);
  axisScores.body = clamp(axisScores.body + mechanismImpact.axisBonus.body + loadout.axisBonus.body + getTechniqueAxisBonus(technique, "body"), 0, 12);
  axisScores.insight = clamp(axisScores.insight + mechanismImpact.axisBonus.insight + getTechniqueAxisBonus(technique, "insight"), 0, 12);
  axisScores.build = clamp(
    strength.abilityBuildBonus * 1.75 +
      Number(technique.gradeBonus || 0) * 2.15 +
      strength.domainQuality * (domainState.hasDomain ? 0.16 : 0.04) +
      loadout.axisBonus.build +
      mechanismImpact.axisBonus.build +
      (domainState.hasAntiDomain ? 0.38 : 0),
    0,
    12
  );
  if (curseAgeGrowth.applies) {
    axisScores.jujutsu = clamp(axisScores.jujutsu + curseAgeGrowth.axisBonus.jujutsu, 0, 12);
    axisScores.insight = clamp(axisScores.insight + curseAgeGrowth.axisBonus.insight, 0, 12);
    axisScores.build = clamp(axisScores.build + curseAgeGrowth.axisBonus.build, 0, 12);
  }

  let instantPowerScore = (
    axisScores.jujutsu * 0.33 +
    axisScores.body * 0.29 +
    axisScores.insight * 0.16 +
    axisScores.build * 0.22
  );
  instantPowerScore += loadout.scoreBonus + mechanismImpact.scoreBonus + stage.scoreBonus + curseAgeGrowth.scoreBonus;
  instantPowerScore = clamp(instantPowerScore, 0, 12);

  const tags = Array.from(new Set([
    ...mechanismImpact.tags,
    ...loadout.tags,
    ...domainState.tags,
    ...curseAgeGrowth.tags,
    ...(technique.profile?.tags || [])
  ])).sort();
  const physicalCarryScore = clamp(
    axisScores.body * 0.6 +
      axisScores.insight * 0.18 +
      axisScores.build * 0.16 +
      loadout.scoreBonus +
      mechanismImpact.scoreBonus,
    0,
    12
  );
  if (axisScores.body >= 8.5 && tags.includes("zeroCE")) {
    instantPowerScore = Math.max(instantPowerScore, Math.min(physicalCarryScore, 8.15));
  }
  if (axisScores.body >= 7.2 && axisScores.jujutsu >= 6.6 && axisScores.insight >= 6.2) {
    instantPowerScore = Math.max(
      instantPowerScore,
      axisScores.body * 0.28 + axisScores.jujutsu * 0.34 + axisScores.insight * 0.18 + axisScores.build * 0.2
    );
  }
  instantPowerScore = clamp(instantPowerScore, 0, 12);

  const profile = {
    schema: "jjk-instant-combat-profile",
    version: 1,
    status: "APPROVED_FOR_PROTOTYPE",
    instantPowerScore: Number(instantPowerScore.toFixed(4)),
    combatPowerUnit: buildCombatPowerUnit(instantPowerScore),
    disruptionUnit: buildDisruptionUnit(tags, axisScores),
    pool: classifyInstantCombatPool(instantPowerScore),
    visibleGrade: getCurrentVisibleCombatGrade(strength),
    axisScores: Object.fromEntries(Object.entries(axisScores).map(([key, value]) => [key, Number(value.toFixed(4))])),
    stage,
    loadout,
    activeMechanisms: activeMechanisms.map((item) => item.displayName || item.id),
    domainState,
    curseAgeGrowth,
    tags,
    winPaths: [],
    risks: [],
    confidence: null,
    sourceVersions: {
      mechanisms: state.mechanisms?.version || "",
      characterCards: state.characterCards?.version || "",
      calibrationBattles: state.calibrationBattles?.version || ""
    }
  };
  profile.winPaths = buildWinPathProfile(profile, strength);
  profile.risks = buildRiskProfile(profile, strength);
  profile.confidence = estimateInstantCombatConfidence(profile, strength);
  return profile;
}

function getCurrentVisibleCombatGrade(strength) {
  const baseGrade = state.flags.sorcererGrade || getVisibleCombatGradeFromScore(strength.gradeEffectiveScore, strength.gradeFloor) || "support";
  const curseFloor = computeCurseAgeGrowthProfile().visibleGradeFloor;
  if (curseFloor && isGradeBelow(baseGrade, curseFloor)) return curseFloor;
  return baseGrade;
}

function getVisibleCombatGradeFromScore(score, floorKey = "support") {
  return callSiteModuleImplementation("JJKCharacter", "getVisibleGradeFromScore", [score, floorKey, { ranges: getDeterministicGradeRanges() }]);
}

function buildCombatPowerUnit(score) {
  return callSiteModuleImplementation("JJKCharacter", "buildCombatPowerUnit", [score]);
}

function formatCombatPowerUnit(value) {
  return callSiteModuleImplementation("JJKCharacter", "formatCombatPowerUnit", [value]);
}

function getCombatPowerUnitBand(value) {
  return callSiteModuleImplementation("JJKCharacter", "getCombatPowerUnitBand", [value]);
}

function buildDisruptionUnit(tags = [], axisScores = {}) {
  const tagSet = new Set(tags);
  let score = 0;
  if (tagSet.has("highDisruption") || tagSet.has("realityWarp")) score += 3.2;
  if (tagSet.has("techniqueNullification")) score += 1.6;
  if (tagSet.has("techniqueDisruption")) score += 1.4;
  if (tagSet.has("domainSureHitInvalid")) score += 1.2;
  if (tagSet.has("soulDamage")) score += 1.2;
  if (tagSet.has("ruleBased")) score += 1.0;
  if (tagSet.has("domain")) score += 0.9;
  if (tagSet.has("antiDomain")) score += 0.55;
  if (tagSet.has("blackFlashAtWill")) score += 0.55;
  score += Math.max(0, Number(axisScores.build || 0) - 6) * 0.18;
  score = clamp(score, 0, 12);
  const value = Math.round(100 * Math.pow(2, score / 1.85));
  return {
    score: Number(score.toFixed(4)),
    value,
    label: formatCombatPowerUnit(value),
    band: getCombatPowerUnitBand(value)
  };
}

function estimateWinRateByCombatUnit(attacker, defender, options = {}) {
  const attackUnit = Number(attacker?.combatPowerUnit?.value ?? attacker?.value ?? 0);
  const defenseUnit = Number(defender?.combatPowerUnit?.value ?? defender?.value ?? 0);
  if (attackUnit <= 0 || defenseUnit <= 0) return 0.5;
  const gradeBase = getVisibleGradeBaseWinRate(attacker, defender, attackUnit, defenseUnit);
  let rate = Number.isFinite(gradeBase)
    ? gradeBase + getCombatUnitWinRateCorrection(attackUnit, defenseUnit, attacker, defender)
    : attackUnit / (attackUnit + defenseUnit);
  const disruptionDelta = Number(attacker?.disruptionUnit?.score ?? attacker?.disruptionScore ?? 0) - Number(defender?.disruptionUnit?.score ?? defender?.disruptionScore ?? 0);
  rate += clamp(disruptionDelta * 0.012, -0.08, 0.08);
  rate += getAutomaticCombatMatchupDelta(attacker, defender);
  if (options.attackerMatchupBonus) rate += Number(options.attackerMatchupBonus) || 0;
  if (options.defenderMatchupBonus) rate -= Number(options.defenderMatchupBonus) || 0;
  rate = applySameSpecialGradeUnitGapPressure(rate, attacker, defender, attackUnit, defenseUnit);
  rate = applySorcererVsCurseMatchup(rate, attacker, defender);
  rate = applyExWinRateStability(rate, attacker, defender, options);
  return clamp(rate, 0.02, 0.98);
}

function applySameSpecialGradeUnitGapPressure(rate, attacker, defender, attackUnit, defenseUnit) {
  if (attacker?.visibleGrade !== "specialGrade" || defender?.visibleGrade !== "specialGrade") return rate;
  if (attackUnit <= 0 || defenseUnit <= 0) return rate;
  const ratio = attackUnit / defenseUnit;
  if (ratio >= 16) return Math.max(rate, 0.9);
  if (ratio >= 8) return Math.max(rate, 0.86);
  if (ratio >= 4) return Math.max(rate, 0.8);
  if (ratio >= 2.5) return Math.max(rate, 0.72);
  if (ratio <= 1 / 16) return Math.min(rate, 0.1);
  if (ratio <= 1 / 8) return Math.min(rate, 0.14);
  if (ratio <= 1 / 4) return Math.min(rate, 0.2);
  if (ratio <= 1 / 2.5) return Math.min(rate, 0.28);
  return rate;
}

function getAutomaticCombatMatchupDelta(attacker, defender) {
  const attackerFlags = getCombatFlagSet(attacker);
  const defenderFlags = getCombatFlagSet(defender);
  let delta = 0;
  if (attackerFlags.has("domainSureHitInvalid") && defenderFlags.has("sureHit")) delta += 0.22;
  if (defenderFlags.has("domainSureHitInvalid") && attackerFlags.has("sureHit")) delta -= 0.22;
  return clamp(delta, -0.28, 0.28);
}

function getCombatFlagSet(item) {
  return new Set([...(item?.tags || []), ...(item?.flags || []), ...(item?.matchupTags || [])]);
}

function applySorcererVsCurseMatchup(rate, attacker, defender) {
  const attackerFlags = getCombatFlagSet(attacker);
  const defenderFlags = getCombatFlagSet(defender);
  const attackerIsCurse = attackerFlags.has("curseBody") || attackerFlags.has("positiveEnergyWeakness");
  const defenderIsCurse = defenderFlags.has("curseBody") || defenderFlags.has("positiveEnergyWeakness");
  const attackerIsSpecialSorcerer = attacker?.visibleGrade === "specialGrade" && !attackerIsCurse;
  const defenderIsSpecialSorcerer = defender?.visibleGrade === "specialGrade" && !defenderIsCurse;
  const attackerHasRctOutput = attackerFlags.has("positiveEnergyOutput") || attackerFlags.has("antiCurse");
  const defenderHasRctOutput = defenderFlags.has("positiveEnergyOutput") || defenderFlags.has("antiCurse");
  const gradeGap = visibleGradeCategoryRank(attacker?.visibleGrade) - visibleGradeCategoryRank(defender?.visibleGrade);

  if (!attackerIsCurse && defenderIsCurse && gradeGap === 0) rate = Math.max(rate, 0.62);
  if (attackerIsCurse && !defenderIsCurse && gradeGap === 0) rate = Math.min(rate, 0.38);
  if (defenderIsCurse && attackerIsSpecialSorcerer) rate = Math.max(rate, 0.82);
  if (attackerIsCurse && defenderIsSpecialSorcerer) rate = Math.min(rate, 0.18);
  if (defenderIsCurse && attackerHasRctOutput && hasNoSevereBodyGap(attacker, defender)) rate = Math.max(rate, 0.88);
  if (attackerIsCurse && defenderHasRctOutput && hasNoSevereBodyGap(defender, attacker)) rate = Math.min(rate, 0.12);
  return rate;
}

function hasNoSevereBodyGap(attacker, defender) {
  const attackerBody = Number(attacker?.axes?.body ?? 0);
  const defenderBody = Number(defender?.axes?.body ?? 0);
  return defenderBody <= attackerBody + 2;
}

function visibleGradeCategoryRank(grade) {
  return {
    support: 0,
    grade4: 1,
    grade3: 2,
    grade2: 3,
    grade1: 4,
    semiSpecialGrade1: 4,
    specialGrade: 5
  }[grade] ?? NaN;
}

function getVisibleGradeBaseWinRate(attacker, defender, attackUnit = 0, defenseUnit = 0) {
  const attackerGrade = getVisibleGradeValue(attacker);
  const defenderGrade = getVisibleGradeValue(defender);
  const attackerRank = visibleGradeRank(attackerGrade);
  const defenderRank = visibleGradeRank(defenderGrade);
  if (!Number.isFinite(attackerRank) || !Number.isFinite(defenderRank)) return NaN;
  const adjustedCurseHumanDiff = getCurseHumanPressureDiff(attacker, defender);
  const diff = Number.isFinite(adjustedCurseHumanDiff) ? adjustedCurseHumanDiff : attackerRank - defenderRank;
  const magnitude = Math.abs(diff);
  if (!Number.isFinite(adjustedCurseHumanDiff) && shouldFlattenEliteVisibleGradeGap(magnitude, attackUnit, defenseUnit)) return 0.5;
  let base = 0.5;
  if (magnitude >= 3.5) base = 0.96;
  else if (magnitude >= 2.5) base = 0.91;
  else if (magnitude >= 1.5) base = 0.82;
  else if (magnitude >= 0.75) base = 0.66;
  else if (magnitude >= 0.25) base = 0.58;
  return diff >= 0 ? base : 1 - base;
}

function shouldFlattenEliteVisibleGradeGap(magnitude, attackUnit, defenseUnit) {
  if (magnitude < 1.5 || magnitude > 2.25) return false;
  const low = Math.min(Number(attackUnit) || 0, Number(defenseUnit) || 0);
  const high = Math.max(Number(attackUnit) || 0, Number(defenseUnit) || 0);
  if (low < 2200) return false;
  return high / low <= 1.45;
}

function getCombatUnitWinRateCorrection(attackUnit, defenseUnit, attacker, defender) {
  const ratio = Math.max(0.01, attackUnit / defenseUnit);
  const raw = Math.log2(ratio) * 0.085;
  const gradeGap = getEffectiveVisibleGradeGapMagnitude(attacker, defender);
  const limit = gradeGap >= 1.5 ? 0.08 : gradeGap >= 0.75 ? 0.11 : 0.16;
  return clamp(raw, -limit, limit);
}

function getEffectiveVisibleGradeGapMagnitude(attacker, defender) {
  const adjustedCurseHumanDiff = getCurseHumanPressureDiff(attacker, defender);
  if (Number.isFinite(adjustedCurseHumanDiff)) return Math.abs(adjustedCurseHumanDiff);
  const attackerGrade = getVisibleGradeValue(attacker);
  const defenderGrade = getVisibleGradeValue(defender);
  return Math.abs((visibleGradeRank(attackerGrade) || 0) - (visibleGradeRank(defenderGrade) || 0));
}

function getCurseHumanPressureDiff(attacker, defender) {
  if (!attacker || !defender || typeof attacker === "string" || typeof defender === "string") return NaN;
  const attackerFlags = getCombatFlagSet(attacker);
  const defenderFlags = getCombatFlagSet(defender);
  const attackerIsCurse = attackerFlags.has("curseBody") || attackerFlags.has("positiveEnergyWeakness");
  const defenderIsCurse = defenderFlags.has("curseBody") || defenderFlags.has("positiveEnergyWeakness");
  if (attackerIsCurse === defenderIsCurse) return NaN;
  const attackerRank = visibleGradeCategoryRank(attacker?.visibleGrade);
  const defenderRank = visibleGradeCategoryRank(defender?.visibleGrade);
  if (!Number.isFinite(attackerRank) || !Number.isFinite(defenderRank)) return NaN;
  if (attackerIsCurse) {
    const curseAdvantage = attackerRank - defenderRank;
    if (curseAdvantage <= 0) return NaN;
    return Math.max(0, curseAdvantage - 1);
  }
  const curseAdvantage = defenderRank - attackerRank;
  if (curseAdvantage <= 0) return NaN;
  return -Math.max(0, curseAdvantage - 1);
}

function getVisibleGradeValue(item) {
  return typeof item === "string" ? item : item?.visibleGrade;
}

function applyExWinRateStability(rate, attacker, defender, options = {}) {
  const attackerEx = hasExWinRateAnchor(attacker);
  const defenderEx = hasExWinRateAnchor(defender);
  if (attackerEx && !defenderEx) {
    const attackerRank = visibleGradeRank(attacker?.visibleGrade);
    const defenderRank = visibleGradeRank(defender?.visibleGrade);
    let floor = attackerRank > defenderRank ? 0.82 : 0.64;
    if (Number.isFinite(attackerRank) && Number.isFinite(defenderRank) && attackerRank - defenderRank >= 1.5) floor = 0.9;
    if (options.fullTenShadowsExCounter || hasMatchupTag(attacker, "fullTenShadowsExCounter")) floor = 0.72;
    return Math.max(rate, floor);
  }
  if (!attackerEx && defenderEx) return Math.min(rate, 0.36);
  return rate;
}

function hasExWinRateAnchor(item) {
  const tags = new Set([...(item?.tags || []), ...(item?.flags || []), ...(item?.matchupTags || [])]);
  return tags.has("exAnchor") || String(item?.tier || item?.powerTier || "").includes("postCanonException");
}

function hasMatchupTag(item, tag) {
  return [...(item?.matchupTags || []), ...(item?.flags || []), ...(item?.tags || [])].includes(tag);
}

function visibleGradeRank(grade) {
  return {
    support: 0,
    grade4: 1,
    grade3: 2,
    grade2: 3,
    grade1: 4,
    semiSpecialGrade1: 4.5,
    specialGrade: 6
  }[grade] ?? NaN;
}

function weightedRawScore(raw, weights = {}) {
  let totalWeight = 0;
  let total = 0;
  for (const [key, weight] of Object.entries(weights)) {
    if (!key.endsWith("Score")) continue;
    const numericWeight = Number(weight);
    if (!Number.isFinite(numericWeight) || numericWeight <= 0) continue;
    total += Number(raw[key] || 0) * numericWeight;
    totalWeight += numericWeight;
  }
  return totalWeight > 0 ? total / totalWeight : 0;
}

function getTechniqueAxisBonus(technique, axis) {
  const tags = technique.profile?.tags || [];
  const gradeBonus = Number(technique.gradeBonus || 0);
  if (!gradeBonus) return 0;
  if (axis === "jujutsu") {
    let multiplier = 0.42;
    if (tags.includes("resourceHungry") || tags.includes("controlHungry")) multiplier += 0.08;
    if (tags.includes("support") || tags.includes("lowCombat")) multiplier *= 0.45;
    return gradeBonus * multiplier;
  }
  if (axis === "body") {
    return tags.includes("bodyScaling") || tags.includes("speed") ? gradeBonus * 0.35 : 0;
  }
  if (axis === "insight") {
    return tags.includes("ruleBased") || tags.includes("strategic") || tags.includes("copy") ? gradeBonus * 0.32 : gradeBonus * 0.12;
  }
  return 0;
}

function getCurrentCombatTexts() {
  const texts = [
    state.flags.specialTalent,
    state.flags.heavenlyRestrictionType,
    state.flags.innateTechnique,
    state.flags.innateTechniqueRaw,
    state.flags.binding,
    state.flags.effortLevel,
    state.flags.identity,
    state.flags.identityOverride,
    ...(state.flags.advancedTechniques || []),
    ...(state.flags.domainEffects || []),
    ...(state.flags.tools || []),
    ...(state.flags.selfCombatStatusTexts || []),
    ...Object.values(state.answers || {}).flatMap((answer) => {
      if (!answer) return [];
      const values = [answer.text, answer.rawText];
      if (Array.isArray(answer.results)) values.push(...answer.results.map((item) => item.text));
      return values;
    })
  ];
  return texts.filter(Boolean).map((item) => String(item));
}

function getActiveCombatMechanisms() {
  const texts = getCurrentCombatTexts();
  return (state.mechanisms?.mechanisms || []).filter((mechanism) => {
    return (mechanism.match || []).some((keyword) => texts.some((text) => text.includes(keyword)));
  });
}

function applyCombatMechanismLocks(raw, mechanisms) {
  const locked = { ...raw };
  for (const mechanism of mechanisms || []) {
    for (const lock of mechanism.locks || []) {
      const current = Number(locked[lock.field] || 0);
      const minimum = Number(lock.minScore || 0);
      if (Number.isFinite(minimum)) locked[lock.field] = Math.max(current, minimum);
    }
  }
  return locked;
}

function summarizeCombatImpacts(items) {
  const summary = {
    axisBonus: { jujutsu: 0, body: 0, insight: 0, build: 0 },
    scoreBonus: 0,
    tags: []
  };
  for (const item of items || []) {
    const impact = item.instantCombatImpact || {};
    for (const axis of Object.keys(summary.axisBonus)) {
      summary.axisBonus[axis] += Number(impact.axisBonus?.[axis] || 0);
    }
    summary.scoreBonus += Number(impact.scoreBonus || 0);
    summary.tags.push(...(impact.tags || []));
  }
  for (const axis of Object.keys(summary.axisBonus)) {
    summary.axisBonus[axis] = clamp(summary.axisBonus[axis], -1.5, 1.8);
  }
  summary.scoreBonus = clamp(summary.scoreBonus, -0.5, 1.2);
  summary.tags = Array.from(new Set(summary.tags));
  return summary;
}

function buildCurrentLoadoutProfile() {
  const toolTexts = state.flags.tools || [];
  const toolCount = Math.max(Number(state.flags.toolCount || 0), toolTexts.length);
  const toolCards = state.mechanisms?.cursedTools || [];
  const matched = [];
  const matchedIds = new Set();
  for (const text of toolTexts) {
    const card = toolCards.find((item) => (item.match || []).some((keyword) => String(text).includes(keyword)));
    if (card && !matchedIds.has(card.id)) {
      matched.push(card);
      matchedIds.add(card.id);
    }
  }

  let scoreBonus = toolCount > 0 ? Math.min(0.2, toolCount * 0.04) : 0;
  const tags = [];
  const axisBonus = { body: 0, build: 0 };
  for (const card of matched) {
    const impact = card.instantCombatImpact || {};
    scoreBonus += Number(impact.scoreBonus || 0);
    tags.push(...(impact.tags || []));
  }
  if (tags.includes("physicalScaling")) axisBonus.body += 0.22;
  if (tags.includes("soulDamage") || tags.includes("techniqueNullification")) axisBonus.build += 0.38;
  if (tags.includes("techniqueDisruption")) axisBonus.build += 0.28;
  axisBonus.build += Math.min(0.65, scoreBonus * 0.75);

  let tier = "bodyOnly";
  if (toolCount > 0) tier = "basicWeapon";
  if (matched.some((item) => item.loadoutTier === "signatureTool")) tier = "signatureTool";
  if (matched.length >= 2) tier = "partialKit";
  if (matched.length >= 4) tier = "fullKit";
  if (matched.some((item) => item.loadoutTier === "consumableKit")) tier = "consumableKit";

  return {
    tier,
    label: loadoutTierLabel(tier, toolCount),
    toolCount,
    matchedTools: matched.map((item) => item.displayName || item.id),
    scoreBonus: Number(clamp(scoreBonus, 0, 1.1).toFixed(4)),
    axisBonus: {
      body: Number(clamp(axisBonus.body, 0, 0.6).toFixed(4)),
      build: Number(clamp(axisBonus.build, 0, 1.1).toFixed(4))
    },
    tags: Array.from(new Set(tags))
  };
}

function loadoutTierLabel(tier, count) {
  const labels = {
    bodyOnly: "无咒具/肉身",
    basicWeapon: `普通咒具 ${count} 件`,
    signatureTool: "标志咒具",
    partialKit: "组合咒具",
    fullKit: "完整武器库",
    consumableKit: "消耗型破术咒具",
    scenarioTool: "剧情型咒具",
    unknown: "未知咒具"
  };
  return labels[tier] || tier;
}

function getDomainCombatState() {
  const texts = getCurrentCombatTexts();
  const hasDomain = hasDomainExpansionTechnique() || texts.some((text) => isDomainExpansionTechniqueText(text));
  const hasSimpleDomain = hasAdvancedTechnique("简易领域") || texts.some((text) => text.includes("简易领域"));
  const hasHollowWickerBasket = texts.some((text) => text.includes("弥虚葛笼"));
  const tags = [];
  if (hasDomain) tags.push("domain");
  if (hasSimpleDomain) tags.push("antiDomain", "smallPenaltyInDomain");
  if (hasHollowWickerBasket) tags.push("antiDomain", "largePenaltyInDomain");
  return {
    hasDomain,
    hasSimpleDomain,
    hasHollowWickerBasket,
    hasAntiDomain: hasSimpleDomain || hasHollowWickerBasket,
    tags
  };
}

function getCurrentCombatStage() {
  const period = getStartPeriod();
  const scoreBonus = period === "after68" ? 0.12 : 0;
  return {
    period,
    label: periodLabel(period),
    scoreBonus
  };
}

function classifyInstantCombatPool(score) {
  const thresholds = state.mechanisms?.poolThresholds || {};
  if (score < Number(thresholds.weak?.instantScoreMax ?? 3.2)) {
    return { key: "weak", label: "weak / 弱者池", hardOutcome: true };
  }
  if (score < Number(thresholds.normal?.instantScoreMax ?? 5.8)) {
    return { key: "normal", label: "normal / 常规池", hardOutcome: false };
  }
  if (score < Number(thresholds.strong?.instantScoreMax ?? 7.8)) {
    return { key: "strong", label: "strong / 强者池", hardOutcome: false };
  }
  return { key: "special", label: "special / 特级或天灾池", hardOutcome: true };
}

function buildWinPathProfile(profile, strength) {
  const paths = [];
  const axes = profile.axisScores;
  const tags = new Set(profile.tags || []);
  if (axes.jujutsu >= 7.6) paths.push("咒力/术式正面压制");
  if (axes.body >= 7.5) paths.push("肉体与近战压制");
  if (axes.insight >= 7.2) paths.push("战斗理解和快速学习");
  if (axes.build >= 6.6) paths.push("构筑胜路");
  if (profile.domainState.hasDomain) paths.push("领域展开压制");
  if (profile.domainState.hasAntiDomain) paths.push("反领域拖延");
  if (tags.has("domainSureHitInvalid")) paths.push("零咒力规避领域必中");
  if (tags.has("techniqueNullification")) paths.push("接触破术");
  if (tags.has("techniqueDisruption")) paths.push("术式干扰");
  if (tags.has("soulDamage")) paths.push("灵魂伤害");
  if (tags.has("realityWarp") || tags.has("highDisruption")) paths.push("规则扰动");
  if (tags.has("ruleConfiscation")) paths.push("规则审判/没收");
  if (tags.has("mahoragaAdaptation")) paths.push("魔虚罗适应建立解法");
  if (tags.has("conditionalWorldSlash")) paths.push("束缚兑现世界斩");
  if (tags.has("bindingMastery")) paths.push("束缚换取关键回合优势");
  if (tags.has("longLivedCurse")) paths.push("长期存活积累咒力");
  if (tags.has("unboundedCurseGrowth")) paths.push("越久越强的咒灵成长");
  if ((strength.techniqueSynergy?.profile?.tags || []).includes("survival")) paths.push("持久战");
  return paths.slice(0, 7);
}

function buildRiskProfile(profile, strength) {
  const risks = [];
  const tags = new Set(profile.tags || []);
  const raw = strength.raw || {};
  if (profile.pool.key === "weak") risks.push("进入强因果战斗时高危");
  if (!profile.domainState.hasDomain && !profile.domainState.hasAntiDomain && !tags.has("domainSureHitInvalid")) {
    risks.push("领域战缺少硬防线");
  }
  if (profile.domainState.hasHollowWickerBasket) risks.push("弥虚葛笼抗领域时战力减益较重");
  if (tags.has("zeroCE") && profile.loadout.toolCount === 0) risks.push("天与咒缚缺咒具时输出兑现受限");
  if (tags.has("resourceHungry") && Number(raw.cursedEnergyScore || 0) < 5) risks.push("高消耗术式资源不足");
  if ((tags.has("controlHungry") || tags.has("precision")) && Number(raw.controlScore || 0) < 5) risks.push("高精密术式稳定性不足");
  if (tags.has("consumable")) risks.push("消耗型咒具不能长期硬算常驻战力");
  if (tags.has("unknown") || tags.has("unresolved")) risks.push("未知咒具效果需要人工反馈校准");
  if (tags.has("highDisruption")) risks.push("高扰动能力不等于稳定击杀能力");
  if (tags.has("dormantGrowthLimited")) risks.push("受肉/咒物路线的长期成长按非连续积累降权");
  if (tags.has("domainBurnout")) risks.push("领域熔断期间术式输出下降");
  if (tags.has("toolConfiscated")) risks.push("咒具被没收导致构筑下降");
  if (tags.has("techniqueConfiscated")) risks.push("术式被没收导致正面战力下降");
  if (tags.has("conditionalWorldSlash")) risks.push("世界斩依赖魔虚罗参照与束缚窗口，不能常态秒杀化");
  return risks.slice(0, 7);
}

function estimateInstantCombatConfidence(profile, strength) {
  let confidence = 0.86;
  const tags = new Set(profile.tags || []);
  if (!strength.techniqueSynergy?.profile && hasTechniqueNow()) confidence -= 0.08;
  if (tags.has("unknown") || tags.has("unresolved")) confidence -= 0.12;
  if (tags.has("highDisruption") || tags.has("realityWarp")) confidence -= 0.08;
  if (profile.loadout.tier === "scenarioTool") confidence -= 0.1;
  if (profile.stage.period === "after68") confidence -= 0.04;
  confidence = clamp(confidence, 0.52, 0.94);
  const label = confidence >= 0.8 ? "high" : confidence >= 0.66 ? "medium" : "low";
  return {
    value: Number(confidence.toFixed(4)),
    label
  };
}

function recordSkip(task, reason) {
  if (!task.title) return;
  state.records.push({
    id: ++state.recordSeq,
    nodeId: task.nodeId,
    title: task.title,
    stage: task.stage,
    result: "跳过",
    why: `${reason}${task.condition ? `：${task.condition}` : ""}`,
    skipped: true,
    type: task.type,
    runType: getRunProfile().type,
    runLabel: getRunProfile().publicLabel,
    aiFreeEnabled: state.aiFreeEnabled,
    customRunMeta: getActivationCustomRunMeta(),
    optionsSnapshot: createOptionsSnapshot(task)
  });
}

//--导出导入与通用格式工具--//
function toggleExport() {
  const payload = buildDebugExportPayload();
  els.exportBox.textContent = JSON.stringify(payload, null, 2);
  els.exportBox.hidden = !els.exportBox.hidden;
}

function exportCombatPowerCode() {
  const payload = buildCombatPowerExportPayload();
  if (!payload) {
    window.alert("基础能力尚未完整，暂时没有可导出的战力编码。");
    return;
  }
  const code = encodeCombatPowerPayload(payload);
  const exportText = buildCombatPowerExportText(payload, code);
  if (els.exportBox) {
    els.exportBox.textContent = exportText;
    els.exportBox.hidden = false;
  }
  downloadTextFile(exportText, `jjk-combat-power-code-${formatDateForFilename(new Date())}.txt`, "text/plain;charset=utf-8");
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(code).catch(() => {});
  }
}

function buildCombatPowerExportPayload(exportedAt = new Date()) {
  const strength = buildStrengthSnapshot();
  const profile = strength?.instantCombatProfile;
  if (!strength || !profile) return null;
  const character = buildCombatPowerExportCharacter(strength, profile);
  return {
    schema: "jjk-combat-power-code",
    version: 1,
    status: "CANDIDATE",
    sourceLayer: ["site_1.386", "instant_combat_profile", "duel_import_adapter"],
    exportedAt: exportedAt.toISOString(),
    siteVersion: APP_BUILD_VERSION,
    flowVersion: state.flow?.version || "",
    runProfile: {
      type: getRunProfile().type,
      publicLabel: getRunProfile().publicLabel
    },
    character,
    combatPowerTable: {
      visibleGrade: character.visibleGrade,
      instantPowerScore: profile.instantPowerScore,
      combatPowerUnit: profile.combatPowerUnit,
      disruptionUnit: profile.disruptionUnit,
      pool: profile.pool,
      axisScores: profile.axisScores,
      winPaths: profile.winPaths || [],
      risks: profile.risks || [],
      tags: profile.tags || []
    }
  };
}

function buildCombatPowerExportCharacter(strength, profile) {
  const baseStats = {
    cursedEnergy: normalizeDuelRankForImport(strength.rawRanks?.cursedEnergyScore),
    control: normalizeDuelRankForImport(strength.rawRanks?.controlScore),
    efficiency: normalizeDuelRankForImport(strength.rawRanks?.efficiencyScore),
    body: normalizeDuelRankForImport(strength.rawRanks?.bodyScore),
    martial: normalizeDuelRankForImport(strength.rawRanks?.martialScore),
    talent: normalizeDuelRankForImport(strength.rawRanks?.talentScore)
  };
  const stage = mapCombatPeriodToDuelStage(profile.stage?.period);
  return {
    displayName: buildCombatPowerExportName(),
    visibleGrade: profile.visibleGrade || "support",
    stage,
    baseStats,
    techniquePower: inferCombatPowerExportTechniquePower(strength, profile),
    techniqueName: buildCombatPowerExportTechniqueName(strength),
    domainProfile: buildCombatPowerExportDomainProfile(profile),
    innateTraits: buildCombatPowerExportTraits(strength, profile),
    loadout: buildCombatPowerExportLoadout(profile),
    externalResource: buildCombatPowerExportExternalResource(profile),
    notes: buildCombatPowerExportNotes(profile),
    debugManualCombatScore: Number(profile.instantPowerScore || 0),
    debugManualCombatUnit: Number(profile.combatPowerUnit?.value || 0),
    encodedCombatProfile: {
      instantPowerScore: profile.instantPowerScore,
      combatPowerUnit: profile.combatPowerUnit,
      disruptionUnit: profile.disruptionUnit,
      axisScores: profile.axisScores,
      pool: profile.pool,
      confidence: profile.confidence,
      sourceVersions: profile.sourceVersions
    }
  };
}

function buildCombatPowerExportName() {
  const identity = getEffectiveIdentity() || "网站角色";
  const grade = state.flags.sorcererGradeLabel || gradeLabel(state.flags.sorcererGrade);
  const period = periodLabel(getStartPeriod());
  const shortGrade = grade && grade !== "未定" ? grade : "未定等级";
  return normalizeCustomDuelText(`战力导入：${identity} / ${shortGrade} / ${period}`).slice(0, 30);
}

function buildCombatPowerExportTechniqueName(strength) {
  return normalizeCustomDuelText(
    getCurrentTechniqueText() ||
    strength.techniqueSynergy?.displayName ||
    "网站导出术式"
  );
}

function buildCombatPowerExportDomainProfile(profile) {
  const domain = profile.domainState || {};
  if (domain.hasDomain) {
    const effects = (state.flags.domainEffects || []).filter(Boolean).join("、");
    return normalizeCustomDuelText(effects ? `领域展开：${effects}` : "领域展开：网站导出领域");
  }
  if (domain.hasSimpleDomain) return "简易领域";
  if (domain.hasHollowWickerBasket) return "弥虚葛笼";
  return "";
}

function buildCombatPowerExportTraits(strength, profile) {
  const traits = [
    state.flags.specialTalent,
    state.flags.heavenlyRestrictionType,
    state.flags.binding,
    state.flags.effortLevel,
    ...(state.flags.advancedTechniques || []),
    ...(profile.activeMechanisms || [])
  ];
  const tags = new Set(profile.tags || []);
  if (tags.has("zeroCE") || tags.has("domainSureHitInvalid")) traits.push("零咒力天与咒缚");
  if (tags.has("techniqueNullification")) traits.push("破术咒具适性");
  if (tags.has("soulDamage")) traits.push("灵魂伤害");
  if (tags.has("highDisruption") || tags.has("realityWarp")) traits.push("规则扰动");
  if (strength.techniqueSynergy?.sourceNote) traits.push(strength.techniqueSynergy.sourceNote);
  return mergeDuelLocalList(traits).slice(0, 12);
}

function buildCombatPowerExportLoadout(profile) {
  return mergeDuelLocalList([
    ...(state.flags.tools || []),
    ...(profile.loadout?.matchedTools || [])
  ]).slice(0, 12);
}

function buildCombatPowerExportExternalResource(profile) {
  if (profile.curseAgeGrowth?.applies) return normalizeCustomDuelText(profile.curseAgeGrowth.label);
  if ((profile.tags || []).includes("jackpotSustain")) return "坐杀搏徒中奖状态";
  if ((profile.tags || []).includes("trueRikaResource")) return "真里香资源";
  return "";
}

function buildCombatPowerExportNotes(profile) {
  const parts = [
    "由本站战力编码导入",
    `战力 ${profile.combatPowerUnit?.label || "-"}`,
    `扰动 ${profile.disruptionUnit?.label || "-"}`,
    profile.confidence?.label ? `置信度 ${profile.confidence.label}` : ""
  ].filter(Boolean);
  return normalizeCustomDuelText(parts.join("；"));
}

function inferCombatPowerExportTechniquePower(strength, profile) {
  const techniqueBonus = Number(strength.techniqueSynergy?.gradeBonus || 0);
  const buildAxis = Number(profile.axisScores?.build || 0);
  const score = techniqueBonus + buildAxis * 0.12;
  if (score >= 1.75 || Number(profile.instantPowerScore || 0) >= 9.2) return "SSS";
  if (score >= 1.35 || buildAxis >= 7.6) return "SS";
  if (score >= 0.95 || buildAxis >= 6.2) return "S";
  if (score >= 0.55 || buildAxis >= 4.2) return "A";
  if (score >= 0.25 || hasTechniqueNow()) return "B";
  return "C";
}

function mapCombatPeriodToDuelStage(period) {
  if (period === "ancient") return "heianToShinjuku";
  if (period === "mainStart") return "custom";
  return getValidDuelStage(period || "custom");
}

function normalizeDuelRankForImport(rank) {
  return callSiteModuleImplementation("JJKCharacter", "normalizeDuelRankForImport", [rank, DUEL_RANKS]);
}

function buildCombatPowerExportText(payload, code) {
  const character = payload.character || {};
  const table = payload.combatPowerTable || {};
  const lines = [
    "# 咒术转盘战力编码导出",
    "",
    "该编码为本站端战力导入格式，仅用于本网站咒术回战对战模块的自定义角色导入；不是通用加密文件。",
    "",
    "## 导入编码",
    "",
    code,
    "",
    "## 战力表",
    "",
    `- 名称：${character.displayName || "-"}`,
    `- 显性等级：${gradeLabel(character.visibleGrade)}`,
    `- 即时战力：${formatNumber(table.instantPowerScore)}`,
    `- 战力单位：${table.combatPowerUnit?.label || "-"}（${table.combatPowerUnit?.band || "-"}）`,
    `- 扰动单位：${table.disruptionUnit?.label || "-"}（${table.disruptionUnit?.band || "-"}）`,
    `- 四轴：咒术 ${formatNumber(table.axisScores?.jujutsu)} / 肉体 ${formatNumber(table.axisScores?.body)} / 悟性 ${formatNumber(table.axisScores?.insight)} / 构筑 ${formatNumber(table.axisScores?.build)}`,
    `- 胜路：${(table.winPaths || []).join("；") || "无"}`,
    `- 风险：${(table.risks || []).join("；") || "无"}`,
    `- 机制标签：${(table.tags || []).join(" / ") || "无"}`,
    "",
    "## 咒术回战对战导入说明",
    "",
    "复制上方 JJKCP1 编码，到“咒术回战 > 自定义角色 > 战力编码导入”中解码。"
  ];
  return `${lines.join("\n").trim()}\n`;
}

function encodeCombatPowerPayload(payload) {
  return callSiteModuleImplementation("JJKCharacter", "encodeCombatPowerPayload", [payload, {
    prefix: COMBAT_POWER_CODE_PREFIX,
    key: COMBAT_POWER_CODE_KEY
  }]);
}

function decodeCombatPowerImportCode(value) {
  return callSiteModuleImplementation("JJKCharacter", "decodeCombatPowerImportCode", [value, {
    prefix: COMBAT_POWER_CODE_PREFIX,
    key: COMBAT_POWER_CODE_KEY
  }]);
}

function extractCombatPowerCode(value) {
  return callSiteModuleImplementation("JJKCharacter", "extractCombatPowerCode", [value, {
    prefix: COMBAT_POWER_CODE_PREFIX
  }]);
}

function mixCombatPowerCodeBytes(bytes) {
  return callSiteModuleImplementation("JJKCharacter", "mixCombatPowerEnvelopeBytes", [bytes, {
    prefix: COMBAT_POWER_CODE_PREFIX,
    key: COMBAT_POWER_CODE_KEY
  }]);
}

function base64UrlEncodeBytes(bytes) {
  return callSiteModuleImplementation("JJKCharacter", "base64UrlEncodeBytes", [bytes]);
}

function base64UrlDecodeToBytes(value) {
  return callSiteModuleImplementation("JJKCharacter", "base64UrlDecodeToBytes", [value]);
}

function importCombatPowerCodeToDuel() {
  const raw = els.duelImportCode?.value || "";
  try {
    const payload = decodeCombatPowerImportCode(raw);
    applyCombatPowerImportToDuelForm(payload);
    if (els.duelImportStatus) {
      const unit = payload.character?.encodedCombatProfile?.combatPowerUnit?.label || "-";
      els.duelImportStatus.textContent = `已解码：${payload.character?.displayName || "未命名"}；战力 ${unit}。检查后点击“加入角色池”。`;
      els.duelImportStatus.classList.remove("error-text");
    }
  } catch (error) {
    if (els.duelImportStatus) {
      els.duelImportStatus.textContent = error?.message || "战力编码解码失败。";
      els.duelImportStatus.classList.add("error-text");
    }
    window.alert(error?.message || "战力编码解码失败。");
  }
}

function applyCombatPowerImportToDuelForm(payload) {
  const character = payload?.character || {};
  if (!character.displayName || !character.encodedCombatProfile?.combatPowerUnit) {
    throw new Error("战力编码缺少角色战力表。");
  }
  setDuelCustomMode("library");
  state.customDuelEditId = "";
  if (els.duelCustomName) els.duelCustomName.value = normalizeCustomDuelText(character.displayName);
  if (els.duelCustomGrade) els.duelCustomGrade.value = DUEL_GRADE_OPTIONS.some((item) => item.value === character.visibleGrade) ? character.visibleGrade : "support";
  if (els.duelCustomStage) els.duelCustomStage.value = getValidDuelStage(character.stage || "custom");
  if (els.duelCustomTechniquePower) els.duelCustomTechniquePower.value = normalizeDuelRankForImport(character.techniquePower);
  els.duelCustomRankSelects?.forEach((select) => {
    const stat = select.dataset.duelCustomRank;
    const value = character.baseStats?.[stat];
    select.value = normalizeDuelRankForImport(value);
  });
  if (els.duelCustomTechnique) els.duelCustomTechnique.value = normalizeCustomDuelText(character.techniqueName || "");
  if (els.duelCustomDomain) els.duelCustomDomain.value = normalizeCustomDuelText(character.domainProfile || "");
  if (els.duelCustomTools) els.duelCustomTools.value = mergeDuelLocalList(character.loadout || []).join("、");
  if (els.duelCustomTraits) els.duelCustomTraits.value = mergeDuelLocalList(character.innateTraits || []).join("、");
  if (els.duelCustomResource) els.duelCustomResource.value = normalizeCustomDuelText(character.externalResource || "");
  if (els.duelCustomNotes) els.duelCustomNotes.value = normalizeCustomDuelText(character.notes || "由本站战力编码导入");
  if (els.duelCustomCombatScore) els.duelCustomCombatScore.value = character.debugManualCombatScore ?? "";
  if (els.duelCustomCombatUnit) els.duelCustomCombatUnit.value = character.debugManualCombatUnit ?? "";
  setSelectedDuelDefinitionValues(els.duelCustomTechniqueTags, []);
  setSelectedDuelDefinitionValues(els.duelCustomDomainTags, []);
  setSelectedDuelDefinitionValues(els.duelCustomAdvancedTags, []);
  setSelectedDuelDefinitionValues(els.duelCustomResourceTags, []);
  setSelectedDuelDefinitionValues(els.duelCustomMechanisms, []);
  setSelectedDuelDefinitionValues(els.duelCustomToolTags, []);
  syncCustomDuelEditMode();
  state.duelBattle = null;
  renderDuelMode();
}

function downloadTextFile(text, filename, type = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadMarkdown() {
  const markdown = buildMarkdownExport();
  downloadTextFile(markdown, `${getRunProfile().filenamePrefix}-${formatDateForFilename(new Date())}.md`, "text/markdown;charset=utf-8");
}

function buildMarkdownExport() {
  const exportedAt = new Date();
  if (!state.debugMode) return buildPublicMarkdownExport(exportedAt);

  const visibleRecords = state.debugMode ? state.records : state.records.filter((record) => !record.skipped);
  const resultRecords = visibleRecords.filter((record) => !record.skipped);
  const skippedRecords = visibleRecords.filter((record) => record.skipped);
  const strength = buildStrengthSnapshot();
  const runProfile = getRunProfile();
  const lines = [];

  lines.push(`# ${runProfile.exportTitle}`);
  lines.push("");
  lines.push(`- 导出时间：${formatDateTime(exportedAt)}`);
  lines.push(`- 流程版本：${state.flow?.version || "unknown"}`);
  lines.push(`- 导出模式：${state.debugMode ? "调试模式（含跳过节点与候选池摘要）" : "普通模式（仅含有效结果）"}`);
  lines.push(`- 游玩模式：${runProfile.publicLabel}`);
  if (runProfile.type === "activationCustom") {
    lines.push(`- 公开标记：${markdownInline(runProfile.disclosure)}`);
  }
  lines.push(`- 有效结果数：${resultRecords.length}`);
  if (state.debugMode) lines.push(`- 跳过节点数：${skippedRecords.length}`);
  lines.push("");

  lines.push("## 当前状态");
  lines.push("");
  for (const [label, value] of getStateSummaryRows()) {
    lines.push(`- ${label}：${markdownInline(value || "未定")}`);
  }
  if (state.flags.joinMainTeamTitle) {
    lines.push(`- 主角小队说明：${markdownInline(state.flags.joinMainTeamTitle)}`);
  }
  lines.push("");

  if (strength) {
    lines.push("## 隐藏强度");
    lines.push("");
    lines.push(`- 资源：${formatNumber(strength.resource)}`);
    lines.push(`- 操作：${formatNumber(strength.control)}`);
    lines.push(`- 肉体：${formatNumber(strength.body)}`);
    lines.push(`- 悟性：${formatNumber(strength.growth)}`);
    lines.push(`- 构筑修正：${formatNumber(strength.abilityBuildBonus)}`);
    lines.push(`- 等级有效分：${formatNumber(strength.gradeEffectiveScore)}`);
    lines.push(`- 等级保底：${markdownInline(gradeLabel(strength.gradeFloor))}`);
    if (strength.instantCombatProfile) {
      lines.push(`- 显性战力：${markdownInline(gradeLabel(strength.instantCombatProfile.visibleGrade))}`);
      lines.push(`- 即时战力：${formatNumber(strength.instantCombatProfile.instantPowerScore)}（${markdownInline(strength.instantCombatProfile.pool.label)}）`);
      lines.push(`- 战力单位：${markdownInline(strength.instantCombatProfile.combatPowerUnit.label)}（${markdownInline(strength.instantCombatProfile.combatPowerUnit.band)}）`);
      lines.push(`- 扰动单位：${markdownInline(strength.instantCombatProfile.disruptionUnit.label)}（${markdownInline(strength.instantCombatProfile.disruptionUnit.band)}）`);
      lines.push(`- 即时战力置信度：${markdownInline(strength.instantCombatProfile.confidence.label)}`);
      lines.push(`- 即时胜路：${markdownInline(strength.instantCombatProfile.winPaths.join("；") || "暂无明显胜路")}`);
      lines.push(`- 即时风险：${markdownInline(strength.instantCombatProfile.risks.join("；") || "暂无主要风险")}`);
    }
    lines.push("");
  }

  lines.push("## 流程结果");
  lines.push("");
  if (visibleRecords.length === 0) {
    lines.push("尚无抽取记录。");
  } else {
    for (const record of visibleRecords) {
      lines.push(`### ${record.id || "-"}. ${markdownInline(record.title)}`);
      lines.push("");
      lines.push(`- 阶段：${markdownInline(record.stage || "流程")}`);
      lines.push(`- 结果：${record.skipped ? "**跳过**" : markdownInline(record.result || "")}`);
      if (record.runType === "activationCustom") lines.push("- 公开标记：激活码自定义局");
      if (record.selectionMode === "aiFree") {
        lines.push("- 来源：AI自由辅助锚定合法主线");
        lines.push(`- 合法主线结果：${markdownInline(record.aiFreeInteraction?.anchorText || record.result || "")}`);
      }
      if (record.aiFreeInteraction?.text) lines.push(`- 行动策略：${markdownInline(record.aiFreeInteraction.text)}`);
      if (record.aiFreeInteraction?.summary) lines.push(`- 后续倾向：${markdownInline(record.aiFreeInteraction.summary)}`);
      if (record.aiFreeAssistTrace?.analysisText) lines.push(`- AI解析输出：${markdownInline(record.aiFreeAssistTrace.analysisText.replace(/\r?\n/g, "；"))}`);
      if (record.aiFreeBridge) lines.push(`- AI桥接：${markdownInline(record.aiFreeBridge.phase || "bridge")}；${markdownInline((record.aiFreeBridge.tags || []).map(getAiFreeInfluenceDisplayName).join("、") || "收束")}`);
      if (record.selectionMode === "halfCustom") lines.push("- 来源：半自定义自选");
      const reason = record.why || record.reason || "";
      if (reason) lines.push(`- 说明：${markdownInline(reason)}`);
      if (state.debugMode && record.optionsSnapshot?.condition) {
        lines.push(`- 条件：\`${record.optionsSnapshot.condition}\``);
      }
      if (state.debugMode && record.optionEffects?.resultTags?.length) {
        lines.push(`- 结果标签：${markdownInline(record.optionEffects.resultTags.join("、"))}`);
      }
      if (state.debugMode && record.optionsSnapshot?.options?.length) {
        lines.push(`- 候选池：${record.optionsSnapshot.options.length} 个选项，可抽 ${countSelectableOptions(record.optionsSnapshot)} 个。`);
        lines.push("");
        lines.push("| 选中 | 选项 | 标签 | 基础权重 | 实际权重 | 概率 |");
        lines.push("| --- | --- | --- | ---: | ---: | ---: |");
        for (const option of record.optionsSnapshot.options) {
          lines.push(`| ${option.selected ? "是" : ""} | ${markdownTableCell(option.text)} | ${markdownTableCell((option.resultTags || []).join("、"))} | ${formatNumber(option.baseWeight)} | ${formatNumber(option.adjustedWeight)} | ${formatPercent(option.probability)} |`);
        }
      }
      lines.push("");
    }
  }

  return `${lines.join("\n").trim()}\n`;
}

function buildPublicMarkdownExport(exportedAt) {
  const resultRecords = state.records.filter((record) => !record.skipped);
  const runProfile = getRunProfile();
  const lines = [];

  lines.push(`# ${runProfile.exportTitle}`);
  lines.push("");
  lines.push(`- 导出时间：${formatDateTime(exportedAt)}`);
  lines.push(`- 流程版本：${state.flow?.version || "unknown"}`);
  lines.push(`- 游玩模式：${runProfile.publicLabel}`);
  if (runProfile.type === "activationCustom") {
    lines.push(`- 公开标记：${markdownInline(runProfile.disclosure)}`);
  }
  lines.push(`- 有效结果数：${resultRecords.length}`);
  lines.push("");

  lines.push("## 当前摘要");
  lines.push("");
  for (const [label, value] of getStateSummaryRows()) {
    lines.push(`- ${label}：${markdownInline(value || "未定")}`);
  }
  if (state.flags.joinMainTeamTitle) {
    lines.push(`- 主角小队说明：${markdownInline(state.flags.joinMainTeamTitle)}`);
  }
  lines.push("");

  lines.push("## 抽取结果");
  lines.push("");
  if (resultRecords.length === 0) {
    lines.push("尚无抽取记录。");
  } else {
    for (const [index, record] of resultRecords.entries()) {
      const modeLabel = record.runType === "activationCustom"
        ? "（激活码自定义局）"
        : record.selectionMode === "aiFree"
          ? "（行动策略）"
        : record.selectionMode === "halfCustom"
          ? "（自选）"
          : "";
      lines.push(`${index + 1}. **${markdownInline(record.title)}**${modeLabel}：${markdownInline(record.result || "")}`);
      if (record.aiFreeInteraction?.text) {
        lines.push(`   - 合法主线结果：${markdownInline(record.aiFreeInteraction.anchorText || record.result || "")}`);
        lines.push(`   - 行动策略：${markdownInline(record.aiFreeInteraction.text)}`);
        if (record.aiFreeInteraction.summary) {
          lines.push(`   - 后续倾向：${markdownInline(record.aiFreeInteraction.summary)}`);
        }
        if (record.aiFreeAssistTrace?.analysisText) {
          lines.push(`   - AI解析输出：${markdownInline(record.aiFreeAssistTrace.analysisText.replace(/\r?\n/g, "；"))}`);
        }
      }
      if (record.aiFreeBridge) {
        lines.push(`   - AI桥接：${markdownInline((record.aiFreeBridge.tags || []).map(getAiFreeInfluenceDisplayName).join("、") || "收束")}`);
      }
    }
  }

  return `${lines.join("\n").trim()}\n`;
}

function getStateSummaryRows() {
  const rows = [
    ["模式", getRunProfile().publicLabel],
    ["身份", getEffectiveIdentity() || "未定"],
    ["时间点", state.flags.startTime || "未定"],
    ["地点", state.flags.location || "未定"],
    ["性别认同", state.flags.genderIdentity || "未定"],
    ["术师等级", state.flags.sorcererGradeLabel || gradeLabel(state.flags.sorcererGrade)],
    ["阵营", state.flags.faction || "未定"],
    ["特殊", state.flags.isAlien ? "西姆利亚星人" : "无"]
  ];
  if (state.flags.effortLevel) {
    rows.push(["努力程度", state.flags.effortLevel]);
    rows.push(["努力修正", state.flags.effortEffectText || "无修正"]);
  }
  if (Number(state.flags.aiFreeInteractionCount || 0) > 0) {
    rows.push(["AI自由互动", `${state.flags.aiFreeInteractionCount} 次；${state.flags.aiFreeLastInfluence || "已影响后续权重"}`]);
  }
  if (state.flags.aiFreeFactionHint && !state.flags.factionLocked) {
    rows.push(["AI自由阵营倾向", state.flags.aiFreeFactionHint]);
  }
  if (state.debugMode && state.flags.appearanceMiguelDebuff) {
    rows.push(["容貌彩蛋", "米格尔相关战斗胜利权重 +20%"]);
  }
  if (state.flags.shinjukuSpectatorResult) {
    rows.push(["新宿旁观结局", state.flags.shinjukuSpectatorResult]);
  }
  if (state.flags.shinjukuThirdPartyOutcome) {
    rows.push(["新宿第三方结局", state.flags.shinjukuThirdPartyOutcome]);
  }
  if (state.flags.shibuyaOutcome) {
    rows.push(["涩谷战局结局", state.flags.shibuyaOutcome]);
  }
  if (state.flags.gojoShibuyaState) {
    rows.push(["涩谷五条状态", shibuyaGojoStateLabel(state.flags.gojoShibuyaState)]);
  }
  if (state.flags.kenjakuPlanState) {
    rows.push(["羂索计划状态", kenjakuPlanStateLabel(state.flags.kenjakuPlanState)]);
  }
  if (state.flags.sukunaRevivalState) {
    rows.push(["宿傩复活状态", sukunaRevivalStateLabel(state.flags.sukunaRevivalState)]);
  }
  if (state.flags.sukunaEntryStageLabel) {
    rows.push(["宿傩削弱阶段", state.flags.sukunaEntryStageLabel]);
  }
  if ((state.flags.sukunaNerfDetails || []).length) {
    rows.push(["宿傩削弱项", state.flags.sukunaNerfDetails.join("、")]);
  }
  return rows;
}

function shibuyaGojoStateLabel(value) {
  return {
    unsealed: "五条未被封印",
    prisonRealmSecured: "五条被封印但狱门疆被高专夺回",
    sealedCanon: "五条仍被封印"
  }[value] || value;
}

function kenjakuPlanStateLabel(value) {
  return {
    stopped: "羂索计划中断",
    damaged: "羂索计划受损",
    canon: "原著大体继续",
    fallback: "备用方案继续"
  }[value] || value;
}

function sukunaRevivalStateLabel(value) {
  return {
    blocked: "宿傩暂时无法复活",
    nerfed: "宿傩复活但削弱",
    recovered: "宿傩恢复决战实力",
    gojoSuppressed: "宿傩被五条提前压制"
  }[value] || value;
}

function formatDateForFilename(date) {
  return callSiteModuleImplementation("JJKExportUtils", "formatDateForFilename", [date]);
}

function formatDateTime(date) {
  return callSiteModuleImplementation("JJKExportUtils", "formatDateTime", [date]);
}

function formatNumber(value) {
  return callSiteModuleImplementation("JJKExportUtils", "formatNumber", [value]);
}

function formatPercent(value) {
  return callSiteModuleImplementation("JJKExportUtils", "formatPercent", [value]);
}

function markdownInline(value) {
  return callSiteModuleImplementation("JJKExportUtils", "markdownInline", [value]);
}

function markdownTableCell(value) {
  return callSiteModuleImplementation("JJKExportUtils", "markdownTableCell", [value]);
}

function buildDebugExportPayload() {
  const payload = {
    schema: "jjk-wheel-debug-logic-chain",
    version: 2,
    exportedAt: new Date().toISOString(),
    flowVersion: state.flow?.version || "",
    playMode: state.playMode,
    aiFreeEnabled: state.aiFreeEnabled,
    runProfile: getRunProfile(),
    activationCustomRun: getActivationCustomRunMeta(),
    note: "records 包含每一步当时的完整候选池 optionsSnapshot；adjustedWeight/probability 为隐藏权重调整后的实际抽取口径。",
    records: state.records,
    logicChain: state.records.map((record) => ({
      id: record.id || null,
      nodeId: record.nodeId || "",
      title: record.title || "",
      stage: record.stage || "",
      result: record.result || "",
      selectionMode: record.selectionMode || "random",
      skipped: Boolean(record.skipped),
      reason: record.why || "",
      condition: record.optionsSnapshot?.condition || "",
      selectedText: record.optionsSnapshot?.selectedText || "",
      selectedIndexes: record.optionsSnapshot?.selectedIndexes || [],
      aiFreeAssistTrace: record.aiFreeAssistTrace || null,
      aiFreeBridge: record.aiFreeBridge || null,
      optionEffects: record.optionEffects || null,
      options: record.optionsSnapshot?.options || []
    })),
    flags: {
      ...state.flags,
      skipPeriods: Array.from(state.flags.skipPeriods || [])
    },
    strength: buildStrengthSnapshot(),
    usageStats: state.usageStats || readUsageStats()
  };
  return payload;
}

function periodLabel(period) {
  return {
    ancient: "古代",
    hiddenInventory: "怀玉",
    volume0: "0卷",
    mainStart: "剧情开始",
    shibuya: "涩谷",
    cullingGame: "死灭回游",
    shinjuku: "新宿决战",
    after68: "68年后"
  }[period] || period;
}
