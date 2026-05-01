const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const dataDir = path.join(projectRoot, "data");

const defaultSources = [
  path.join(dataDir, "technique-feature-hand-drafts-v0.4-reviewed.json"),
  path.join(dataDir, "technique-feature-hand-drafts-v0.5-untouched-only-delta-reviewed.json")
];

const sourcePaths = process.argv.slice(2).length ? process.argv.slice(2) : defaultSources;

const outPath = path.join(dataDir, "technique-feature-hand-drafts-v0.6-merged-balanced.json");
const importPath = path.join(dataDir, "technique-feature-hand-drafts-v0.6-runtime-import-candidates.json");
const mergeMapPath = path.join(dataDir, "technique-feature-hand-drafts-v0.6-merge-map.json");
const summaryPath = path.join(dataDir, "technique-feature-hand-drafts-v0.6-merge-summary.txt");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function round(value) {
  return Math.round(Number(value) || 0);
}

function powerRank(card) {
  const map = { low: 0, medium: 1, high: 2, special: 3 };
  return map[String(card.powerHint || "").trim()] ?? 1;
}

function pickByPower(card, values) {
  const index = Math.max(0, Math.min(values.length - 1, powerRank(card)));
  return values[index];
}

function hasAny(card, patterns) {
  const haystack = [
    card.techniqueId,
    card.cardName,
    card.cardIntent,
    card.mechanicSubtype,
    ...(card.mechanicTags || []),
    card.effectDraft,
    card.shortEffect,
    card.longEffect
  ].join(" ");
  return patterns.some((pattern) => pattern.test(haystack));
}

function getOriginalStats(card) {
  return card.originalCandidateRuntimeStats || card.candidateRuntimeStats || card.balancedRuntimeStats || {};
}

function baseAp(card) {
  if (["finisher", "domain", "summon", "soul"].includes(card.cardIntent)) return 2;
  if (["attack", "control"].includes(card.cardIntent) && powerRank(card) >= 2) return 2;
  return 1;
}

function accuracyProfile(card, damage) {
  if (!damage) return "none";
  if (hasAny(card, [/area/i, /swarm/i, /domain/i, /sure_hit/i])) return "technique_area";
  if (hasAny(card, [/weapon/i, /sword/i, /blade/i, /slash/i, /fist/i, /punch/i, /melee/i])) return "melee";
  if (hasAny(card, [/projectile/i, /beam/i, /bullet/i, /ranged/i])) return "technique_projectile";
  return card.cardIntent === "attack" ? "technique_projectile" : "technique_area";
}

function statBinding(card, stats) {
  const primary = [];
  const secondary = [];
  const tags = new Set(card.mechanicTags || []);
  const physical = hasAny(card, [/fist/i, /punch/i, /kick/i, /melee/i, /weapon/i, /blade/i, /sword/i, /body/i]);

  if (stats.baseDamage > 0) {
    primary.push("techniquePower");
    secondary.push("baseStats.cursedEnergy", "baseStats.control");
    if (physical) secondary.push("baseStats.martial", "baseStats.body");
  }
  if (stats.baseBlock > 0) {
    primary.push("baseStats.body");
    secondary.push("baseStats.control", "baseStats.efficiency");
  }
  if (stats.controlValue > 0) {
    primary.push("baseStats.control");
    secondary.push("techniquePower", "baseStats.talent");
  }
  if (stats.soulDamage > 0 || tags.has("vessel_separation") || tags.has("soul_swap")) {
    primary.push("techniquePower");
    secondary.push("baseStats.talent", "baseStats.control");
  }
  if (stats.baseCeCost > 0) {
    secondary.push("baseStats.efficiency", "baseStats.cursedEnergy");
  }

  return {
    primaryStats: [...new Set(primary)],
    secondaryStats: [...new Set(secondary)],
    costModifierStats: ["baseStats.efficiency", "baseStats.cursedEnergy"],
    formulaHint: "final value = balancedRuntimeStats base anchor + character-stat modifier; ceCost is reduced by efficiency and constrained by cursedEnergy; damage effects are still subject to evasion unless accuracyProfile is unavoidable.",
    usesCharacterBaseStats: true
  };
}

function rebalanceV2(card) {
  const original = getOriginalStats(card);
  const notes = [];
  const zeroedFields = [];
  const proposedEffectFields = {};
  const ap = baseAp(card);
  let baseDamage = 0;
  let baseBlock = 0;
  let controlValue = 0;
  let soulDamage = 0;
  let domainLoadDelta = 0;
  let durationRounds = 0;
  let baseCeCost = 8;

  switch (card.cardIntent) {
    case "attack":
      baseDamage = clamp(round(original.baseDamage || pickByPower(card, [8, 12, 18, 22])), 4, pickByPower(card, [10, 14, 22, 26]));
      controlValue = clamp(round(original.controlValue || 0), 0, pickByPower(card, [4, 6, 8, 10]));
      baseCeCost = clamp(round(baseDamage * 0.9 + controlValue * 0.45 + ap * 4), 6, 32);
      break;
    case "defense":
      baseBlock = clamp(round(original.baseBlock || pickByPower(card, [8, 14, 22, 28])), 6, pickByPower(card, [14, 20, 26, 32]));
      controlValue = clamp(round(original.controlValue || 0), 0, pickByPower(card, [4, 6, 8, 10]));
      baseCeCost = clamp(round(baseBlock * 0.55 + controlValue * 0.45 + ap * 3), 6, 24);
      durationRounds = original.durationRounds ? 1 : 0;
      break;
    case "control":
      baseDamage = clamp(round(original.baseDamage || 0), 0, pickByPower(card, [6, 8, 12, 16]));
      controlValue = clamp(round(original.controlValue || pickByPower(card, [12, 20, 28, 32])), 8, pickByPower(card, [18, 24, 32, 36]));
      baseCeCost = clamp(round(baseDamage * 0.7 + controlValue * 0.72 + ap * 3), 10, 36);
      durationRounds = 1;
      break;
    case "resource":
      baseBlock = original.baseBlock ? clamp(round(original.baseBlock), 0, pickByPower(card, [6, 8, 10, 12])) : 0;
      baseCeCost = clamp(round(original.baseCeCost || 4), 2, 12);
      durationRounds = 1;
      break;
    case "support":
      if (Number(original.baseDamage || 0) > 0) zeroedFields.push("baseDamage");
      baseBlock = original.baseBlock ? clamp(round(original.baseBlock), 0, pickByPower(card, [8, 12, 16, 20])) : 0;
      controlValue = original.controlValue ? clamp(round(original.controlValue), 0, pickByPower(card, [6, 10, 14, 18])) : 0;
      baseCeCost = clamp(round(baseBlock * 0.45 + controlValue * 0.45 + 4), 4, 22);
      durationRounds = 1;
      break;
    case "mobility":
      baseDamage = clamp(round(original.baseDamage || 0), 0, pickByPower(card, [4, 6, 8, 10]));
      baseBlock = clamp(round(original.baseBlock || 0), 0, pickByPower(card, [8, 12, 16, 18]));
      controlValue = clamp(round(original.controlValue || 0), 0, pickByPower(card, [4, 6, 8, 10]));
      baseCeCost = clamp(round(baseDamage * 0.55 + baseBlock * 0.45 + controlValue * 0.45 + 4), 6, 20);
      durationRounds = 1;
      break;
    case "summon":
      baseDamage = clamp(round(original.baseDamage || pickByPower(card, [8, 12, 16, 20])), 6, pickByPower(card, [12, 16, 20, 24]));
      baseBlock = clamp(round(original.baseBlock || 0), 0, pickByPower(card, [8, 12, 14, 16]));
      controlValue = clamp(round(original.controlValue || 0), 0, pickByPower(card, [12, 16, 20, 24]));
      baseCeCost = clamp(round(baseDamage * 0.58 + baseBlock * 0.35 + controlValue * 0.48 + 10), 14, 36);
      durationRounds = 1;
      break;
    case "domain":
      baseDamage = clamp(round(original.baseDamage || pickByPower(card, [8, 12, 16, 20])), 0, pickByPower(card, [12, 16, 20, 24]));
      controlValue = clamp(round(original.controlValue || pickByPower(card, [14, 20, 26, 32])), 10, pickByPower(card, [18, 24, 30, 36]));
      domainLoadDelta = clamp(round(original.domainLoadDelta || pickByPower(card, [4, 6, 8, 10])), 4, 12);
      baseCeCost = clamp(round(20 + baseDamage * 0.3 + controlValue * 0.35 + domainLoadDelta * 0.6), 24, 42);
      durationRounds = 1;
      break;
    case "finisher":
      baseDamage = clamp(round(original.baseDamage || pickByPower(card, [18, 20, 24, 26])), 14, pickByPower(card, [18, 22, 24, 26]));
      controlValue = clamp(round(original.controlValue || 0), 0, pickByPower(card, [8, 10, 12, 16]));
      baseCeCost = clamp(round(20 + baseDamage * 1.15 + controlValue * 0.5), 28, 60);
      if (original.domainLoadDelta) domainLoadDelta = clamp(round(original.domainLoadDelta * 0.35), 0, 8);
      break;
    case "rule":
      controlValue = clamp(round(original.controlValue || pickByPower(card, [16, 22, 28, 34])), 12, 34);
      baseCeCost = clamp(round(12 + controlValue * 0.45), 14, 30);
      durationRounds = 1;
      break;
    case "soul":
      baseDamage = clamp(round(original.baseDamage || pickByPower(card, [6, 10, 14, 18])), 4, pickByPower(card, [8, 12, 16, 20]));
      soulDamage = clamp(round(original.soulDamage || Math.max(4, baseDamage * 0.8)), 4, pickByPower(card, [10, 14, 18, 20]));
      controlValue = clamp(round(original.controlValue || 0), 0, pickByPower(card, [10, 14, 18, 20]));
      baseCeCost = clamp(round(baseDamage * 0.6 + soulDamage * 0.9 + controlValue * 0.35 + 8), 12, 36);
      break;
    default:
      baseDamage = clamp(round(original.baseDamage || 0), 0, 16);
      baseBlock = clamp(round(original.baseBlock || 0), 0, 18);
      controlValue = clamp(round(original.controlValue || 0), 0, 20);
      baseCeCost = clamp(round(original.baseCeCost || 8), 4, 24);
      durationRounds = original.durationRounds ? 1 : 0;
  }

  if (card.soulRelated && !soulDamage) {
    soulDamage = clamp(round(original.soulDamage || Math.max(4, baseDamage * 0.55 + controlValue * 0.18)), 4, pickByPower(card, [10, 14, 18, 20]));
  }

  if (card.antiDomainRelated || hasAny(card, [/anti_domain/i, /barrier/i, /simple_domain/i])) {
    if (card.cardIntent !== "domain") {
      domainLoadDelta = 0;
      proposedEffectFields.opponentDomainLoadDelta = -clamp(round(Math.abs(original.domainLoadDelta || 4)), 2, 8);
      notes.push("anti-domain pressure moved from self domainLoadDelta to proposed opponentDomainLoadDelta");
    }
  } else if (!["domain", "finisher"].includes(card.cardIntent) && !card.domainRelated) {
    if (Number(original.domainLoadDelta || 0) !== 0) zeroedFields.push("domainLoadDelta");
    domainLoadDelta = 0;
  } else if (card.domainRelated && !["domain", "finisher"].includes(card.cardIntent)) {
    domainLoadDelta = clamp(round((original.domainLoadDelta || 0) * 0.35), 0, 4);
  }

  if (Number(original.baseDamage || 0) > 26) notes.push("baseDamage capped to playable beta scale");
  if (Number(original.baseBlock || 0) > 32) notes.push("baseBlock capped to playable beta scale");
  if (Number(original.controlValue || 0) > 40) notes.push("controlValue capped to draft control scale");
  if (Number(original.baseCeCost || 0) > 60) notes.push("baseCeCost capped to CE budget");
  if (Number(original.soulDamage || 0) > 20) notes.push("soulDamage capped to soul effect scale");
  if (zeroedFields.length) notes.push(`zeroed non-runtime fields: ${zeroedFields.join(", ")}`);

  const stats = {
    apCost: ap,
    baseCeCost,
    baseDamage,
    baseBlock,
    controlValue,
    soulDamage,
    domainLoadDelta,
    durationRounds,
    accuracyProfile: accuracyProfile(card, baseDamage || soulDamage),
    evasionAllowed: Boolean(baseDamage || soulDamage),
    hitRateModifier: 0,
    meaningfulFields: Object.entries({ baseDamage, baseBlock, controlValue, soulDamage, domainLoadDelta })
      .filter(([, value]) => Number(value) !== 0)
      .map(([key]) => key),
    proposedEffectFields,
    balanceNotes: notes
  };

  return {
    stats,
    zeroedFields,
    statBinding: statBinding(card, stats)
  };
}

function mechanismKey(card) {
  if (card.techniqueId === "deadly_sentencing") return "local_deadly_sentencing_trial_subphase";
  if (hasAny(card, [/jacobs_ladder/i, /technique_extinguish/i])) return "mechanism:technique_extinguishment";
  if (hasAny(card, [/world_slash/i])) return "mechanism:conditionalWorldSlash";
  return "";
}

function mergeStatus(card, existingStatus, key) {
  const warnings = [];
  let reviewStatus = existingStatus || card.reviewStatus || "accepted_candidate";
  let runtimeImportStatus = "ready_for_manual_mapping";
  let importable = reviewStatus === "accepted_candidate";
  let variantOf = card.variantOf || "";
  let variantReason = card.variantReason || "";
  let migrationDirective = card.migrationDirective || "candidate_name_copy_pool_balance_recomputed";

  if (card.techniqueId === "deadly_sentencing") {
    reviewStatus = "needs_merge";
    importable = false;
    runtimeImportStatus = "local_trial_subphase_only";
    variantOf = "local_deadly_sentencing_trial_subphase";
    variantReason = "Higuruma trial, confiscation, and execution sword must be generated by the local Deadly Sentencing subphase.";
    migrationDirective = hasAny(card, [/executioner_sword/i])
      ? "execution_sword_flow_only_do_not_draw_before_death_verdict"
      : "rule_trial_subphase_only_do_not_draw_before_domain";
    warnings.push("not a normal hand card; generated only inside Deadly Sentencing flow");
  }

  if (key === "mechanism:technique_extinguishment") {
    reviewStatus = "needs_merge";
    importable = false;
    runtimeImportStatus = "merge_into_technique_extinguishment_mechanism";
    variantOf = "mechanism:technique_extinguishment";
    variantReason = "Jacob's Ladder must resolve as technique/barrier/incarnation extinguishment, not raw damage.";
    migrationDirective = "merge_into_anti_technique_targeting_logic";
    warnings.push("merge with anti-technique/barrier/incarnation targeting mechanism");
  }

  if (key === "mechanism:conditionalWorldSlash") {
    reviewStatus = "needs_merge";
    importable = false;
    runtimeImportStatus = "merge_into_conditional_world_slash";
    variantOf = "mechanism:conditionalWorldSlash";
    variantReason = "World slash must remain a conditional Mahoraga-reference/binding mechanism, not a repeatable normal attack.";
    migrationDirective = "merge_into_conditional_world_slash_logic";
    warnings.push("not a normal repeatable hand card");
  }

  if (card.ruleRelated && reviewStatus === "accepted_candidate") warnings.push("ruleRelated card still needs local rule script before final runtime import");
  if (card.soulRelated && reviewStatus === "accepted_candidate") warnings.push("soulRelated card needs soul/vessel handling before final runtime import");
  if (hasAny(card, [/hard_control/i]) && reviewStatus === "accepted_candidate") warnings.push("hard_control must be gated or downgraded before final runtime import");

  return { reviewStatus, runtimeImportStatus, importable, variantOf, variantReason, migrationDirective, warnings };
}

const loadedSources = sourcePaths.map((sourcePath, sourceIndex) => {
  const source = readJson(sourcePath);
  return {
    sourcePath,
    sourceIndex,
    sourceSchema: source.schema,
    sourceVersion: source.version,
    cards: source.draftCards || []
  };
});

const seenIds = new Map();
const seenTechniqueNames = new Map();
const merged = [];
const duplicateRecords = [];

for (const source of loadedSources) {
  source.cards.forEach((card, index) => {
    const idDuplicate = seenIds.get(card.draftCardId);
    const techNameKey = `${card.techniqueId}::${String(card.cardName || "").trim()}`;
    const techNameDuplicate = seenTechniqueNames.get(techNameKey);
    const duplicateOf = idDuplicate || techNameDuplicate || null;
    const key = mechanismKey(card);
    const balance = rebalanceV2(card);
    const status = mergeStatus(card, card.reviewStatus, key);
    const sourceTag = source.sourceVersion || path.basename(source.sourcePath, ".json");
    const next = {
      ...card,
      sourcePackage: {
        path: source.sourcePath,
        version: source.sourceVersion || "",
        schema: source.sourceSchema || "",
        index: index + 1
      },
      mergeVersion: "v0.6-merged-balanced",
      mergeKey: key,
      mergeDuplicateOf: duplicateOf ? duplicateOf.draftCardId : "",
      priorBalancedRuntimeStats: card.balancedRuntimeStats || null,
      balancedRuntimeStats: balance.stats,
      statBinding: balance.statBinding,
      reviewStatus: duplicateOf ? "skip_duplicate_previous_review" : status.reviewStatus,
      runtimeImportStatus: duplicateOf ? "skip_duplicate_previous_review" : status.runtimeImportStatus,
      importableFromMergedPackage: duplicateOf ? false : status.importable,
      variantOf: status.variantOf,
      variantReason: status.variantReason,
      migrationDirective: duplicateOf ? "skip_duplicate_already_present_in_merged_package" : status.migrationDirective,
      duplicateStatus: duplicateOf ? "confirmed" : (status.reviewStatus === "needs_merge" ? "possible" : "none"),
      duplicateOf: duplicateOf ? duplicateOf.draftCardId : (status.variantOf || ""),
      duplicateWarning: [
        card.duplicateWarning,
        duplicateOf ? `duplicate in merged package: ${duplicateOf.draftCardId}` : "",
        ...status.warnings
      ].filter(Boolean).join("; "),
      sourceActionId: card.sourceActionId || `merged_${source.sourceIndex + 1}_${String(index + 1).padStart(3, "0")}`,
      existingCardRefs: Array.isArray(card.existingCardRefs) ? card.existingCardRefs : [],
      draftRole: duplicateOf ? "duplicate_reference" : (status.reviewStatus === "needs_merge" ? "variant" : (card.draftRole || "new_candidate")),
      draftVariantType: card.draftVariantType || (key ? "migration_only" : "ordinary"),
      reviewedAt: "2026-05-01"
    };
    delete next.candidateRuntimeStats;
    next.originalCandidateRuntimeStats = getOriginalStats(card);
    merged.push(next);
    if (duplicateOf) duplicateRecords.push({ source: next.draftCardId, duplicateOf: duplicateOf.draftCardId, key: techNameKey, sourcePackage: sourceTag });
    if (!idDuplicate) seenIds.set(card.draftCardId, next);
    if (!techNameDuplicate) seenTechniqueNames.set(techNameKey, next);
  });
}

const jacobPreferredByName = new Map(
  merged
    .filter((card) => card.mergeKey === "mechanism:technique_extinguishment" && card.techniqueId === "angel_jacobs_ladder")
    .map((card) => [String(card.cardName || "").trim(), card])
);

for (const card of merged) {
  if (card.mergeKey !== "mechanism:technique_extinguishment") continue;
  if (card.techniqueId !== "technique_extinguishment") continue;
  const preferred = jacobPreferredByName.get(String(card.cardName || "").trim());
  if (!preferred) continue;
  card.reviewStatus = "skip_duplicate_previous_review";
  card.runtimeImportStatus = "superseded_by_latest_angel_jacobs_ladder_mapping";
  card.importableFromMergedPackage = false;
  card.duplicateStatus = "confirmed";
  card.duplicateOf = preferred.draftCardId;
  card.mergeDuplicateOf = preferred.draftCardId;
  card.migrationDirective = "skip_duplicate_superseded_by_angel_jacobs_ladder";
  card.duplicateWarning = [
    card.duplicateWarning,
    `superseded by latest angel_jacobs_ladder mapping: ${preferred.draftCardId}`
  ].filter(Boolean).join("; ");
}

const mergeGroups = {};
for (const card of merged) {
  if (!card.mergeKey) continue;
  mergeGroups[card.mergeKey] ||= {
    mergeKey: card.mergeKey,
    representative: "",
    action: "",
    cards: []
  };
  mergeGroups[card.mergeKey].cards.push({
    draftCardId: card.draftCardId,
    techniqueId: card.techniqueId,
    cardName: card.cardName,
    reviewStatus: card.reviewStatus,
    runtimeImportStatus: card.runtimeImportStatus,
    migrationDirective: card.migrationDirective
  });
}

if (mergeGroups.local_deadly_sentencing_trial_subphase) {
  mergeGroups.local_deadly_sentencing_trial_subphase.representative = "local Deadly Sentencing rule subphase";
  mergeGroups.local_deadly_sentencing_trial_subphase.action = "Do not import as ordinary hands; inject during domain trial flow only.";
}
if (mergeGroups["mechanism:technique_extinguishment"]) {
  mergeGroups["mechanism:technique_extinguishment"].representative = "angel_jacobs_ladder / technique_extinguishment";
  mergeGroups["mechanism:technique_extinguishment"].action = "Merge Jacob's Ladder variants into one anti-technique/barrier/incarnation targeting mechanism.";
}
if (mergeGroups["mechanism:conditionalWorldSlash"]) {
  mergeGroups["mechanism:conditionalWorldSlash"].representative = "conditionalWorldSlash";
  mergeGroups["mechanism:conditionalWorldSlash"].action = "Keep as conditional world-slash mechanism, not repeatable normal hand draw.";
}

function countCards(cards) {
  return cards.reduce((acc, card) => {
    acc.total += 1;
    acc.byReviewStatus[card.reviewStatus] = (acc.byReviewStatus[card.reviewStatus] || 0) + 1;
    acc.byIntent[card.cardIntent] = (acc.byIntent[card.cardIntent] || 0) + 1;
    if (card.importableFromMergedPackage) acc.importableFromMergedPackage += 1;
    if (card.balancedRuntimeStats.balanceNotes.length) acc.rebalancedOutliers += 1;
    if (card.statBinding?.usesCharacterBaseStats) acc.statBoundCards += 1;
    return acc;
  }, { total: 0, importableFromMergedPackage: 0, rebalancedOutliers: 0, statBoundCards: 0, byReviewStatus: {}, byIntent: {} });
}

const importCandidates = merged.filter((card) => card.importableFromMergedPackage);
const counts = countCards(merged);
const importCounts = countCards(importCandidates);

const output = {
  schema: "jjk.technique.feature.hand.drafts.v0.6.merged-balanced",
  version: "v0.6-merged-balanced",
  status: "CANDIDATE_REVIEWED_MERGED",
  generatedAt: "2026-05-01T00:00:00-04:00",
  sourceFiles: loadedSources.map((source) => ({
    path: source.sourcePath,
    schema: source.sourceSchema,
    version: source.sourceVersion,
    cardCount: source.cards.length
  })),
  mergePolicy: {
    preserveSourceCards: true,
    directImportRequires: "importableFromMergedPackage === true",
    rawStatsField: "originalCandidateRuntimeStats",
    previousBalanceField: "priorBalancedRuntimeStats",
    recomputedBalanceField: "balancedRuntimeStats",
    balancePolicy: "Universal damage cap <= 26, block <= 32, ce <= 60, normal AP <= 2. Non-runtime fields are zeroed and recorded in balanceNotes. Values are base anchors and must be modified by character stats at runtime.",
    characterStatBinding: "Every card receives statBinding with primaryStats, secondaryStats, costModifierStats, and formulaHint."
  },
  counts,
  importCounts,
  duplicateRecords,
  mergeGroups: Object.values(mergeGroups),
  draftCards: merged
};

const importOutput = {
  schema: "jjk.technique.feature.hand.drafts.v0.6.runtime-import-candidates",
  version: "v0.6-runtime-import-candidates",
  status: "CANDIDATE_RUNTIME_IMPORT_POOL",
  generatedAt: output.generatedAt,
  sourceFile: outPath,
  counts: importCounts,
  policy: {
    note: "This is still a candidate pool. It excludes needs_merge and duplicate references but does not write into playable templates.",
    requiredManualSteps: [
      "Map each candidate to formal duel action/card fields.",
      "Wire soul/rule/hard-control cards to local scripts before final runtime import.",
      "Keep character-stat scaling active; do not treat balancedRuntimeStats as final absolute values."
    ]
  },
  draftCards: importCandidates
};

const mergeMapOutput = {
  schema: "jjk.technique.feature.hand.drafts.v0.6.merge-map",
  version: "v0.6-merge-map",
  generatedAt: output.generatedAt,
  duplicateRecords,
  mergeGroups: Object.values(mergeGroups)
};

fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
fs.writeFileSync(importPath, JSON.stringify(importOutput, null, 2), "utf8");
fs.writeFileSync(mergeMapPath, JSON.stringify(mergeMapOutput, null, 2), "utf8");

const max = (cards, getter) => Math.max(0, ...cards.map(getter));
const summaryLines = [
  "JJK feature hand drafts v0.6 merged balance summary",
  "generatedAt: 2026-05-01",
  "",
  "sources:",
  ...loadedSources.map((source) => `- ${source.sourcePath} (${source.cards.length} cards)`),
  "",
  "outputs:",
  `- merged: ${outPath}`,
  `- runtime import candidates: ${importPath}`,
  `- merge map: ${mergeMapPath}`,
  "",
  "counts:",
  `- total source cards preserved: ${counts.total}`,
  `- importableFromMergedPackage: ${counts.importableFromMergedPackage}`,
  `- accepted_candidate: ${counts.byReviewStatus.accepted_candidate || 0}`,
  `- needs_merge: ${counts.byReviewStatus.needs_merge || 0}`,
  `- skip_duplicate_previous_review: ${counts.byReviewStatus.skip_duplicate_previous_review || 0}`,
  `- rebalancedOutliers: ${counts.rebalancedOutliers}`,
  `- statBoundCards: ${counts.statBoundCards}`,
  "",
  "balance caps verified on import candidates:",
  `- max baseDamage: ${max(importCandidates, (card) => Number(card.balancedRuntimeStats.baseDamage || 0))}`,
  `- max baseBlock: ${max(importCandidates, (card) => Number(card.balancedRuntimeStats.baseBlock || 0))}`,
  `- max baseCeCost: ${max(importCandidates, (card) => Number(card.balancedRuntimeStats.baseCeCost || 0))}`,
  `- max apCost: ${max(importCandidates, (card) => Number(card.balancedRuntimeStats.apCost || 0))}`,
  "",
  "merge decisions:",
  ...Object.values(mergeGroups).map((group) => `- ${group.mergeKey}: ${group.action} (${group.cards.length} source cards)`),
  "",
  "not done:",
  "- No playable template file was overwritten.",
  "- No git commit, push, or deployment was performed."
];
fs.writeFileSync(summaryPath, summaryLines.join("\n"), "utf8");

console.log(JSON.stringify({ outPath, importPath, mergeMapPath, summaryPath, counts, importCounts }, null, 2));
