const fs = require("fs");
const path = require("path");

const sourcePath = process.argv[2] || "C:/Users/15164/Downloads/jjk_feature_hand_drafts_latest_20260501_1649_nonduplicate_v0.4_candidate.json";
const baselinePath = process.argv[3] || "";
const projectRoot = path.resolve(__dirname, "..");
const dataDir = path.join(projectRoot, "data");

const raw = fs.readFileSync(sourcePath, "utf8");
const source = JSON.parse(raw);
const sourceVersion = String(source.version || path.basename(sourcePath, ".json").match(/v\d+[_\-.]\d+/i)?.[0] || "v0.4");
const outputTag = sourceVersion
  .replace(/candidate$/i, "")
  .replace(/[-_]+$/g, "")
  .replace(/^(\d)/, "v$1")
  .replace(/_/g, "-")
  .replace(/[^a-zA-Z0-9.-]+/g, "-")
  .toLowerCase();
const outPath = path.join(dataDir, `technique-feature-hand-drafts-${outputTag}-reviewed.json`);
const deltaOutPath = path.join(dataDir, `technique-feature-hand-drafts-${outputTag}-delta-reviewed.json`);
const summaryPath = path.join(dataDir, `technique-feature-hand-drafts-${outputTag}-review-summary.txt`);

const baseline = baselinePath && fs.existsSync(baselinePath)
  ? JSON.parse(fs.readFileSync(baselinePath, "utf8"))
  : null;
const baselineCards = baseline?.draftCards || [];
const baselineById = new Map(baselineCards.map((card) => [card.draftCardId, card]));
const baselineByTechniqueName = new Map(baselineCards.map((card) => [`${card.techniqueId}::${String(card.cardName || "").trim()}`, card]));

function lineOf(id) {
  const needle = `"draftCardId": "${id}"`;
  const at = raw.indexOf(needle);
  return at < 0 ? 0 : raw.slice(0, at).split(/\r?\n/).length;
}

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function round(value) {
  return Math.round(Number(value) || 0);
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function hasTag(card, pattern) {
  const haystack = [card.mechanicSubtype, ...(card.mechanicTags || [])].join(" ");
  return pattern.test(haystack);
}

function powerRank(card) {
  const map = { low: 0, medium: 1, high: 2, special: 3 };
  return map[String(card.powerHint || "").trim()] ?? 1;
}

function maxForPower(card, values) {
  return values[Math.max(0, Math.min(values.length - 1, powerRank(card)))] || values[1];
}

function baseAp(card) {
  if (card.cardIntent === "finisher") return 3;
  if (["domain", "summon", "soul"].includes(card.cardIntent)) return 2;
  if (card.cardIntent === "attack" && powerRank(card) >= 2) return 2;
  if (card.cardIntent === "control" && powerRank(card) >= 2) return 2;
  return 1;
}

function rebalance(card) {
  const original = card.candidateRuntimeStats || {};
  const ap = baseAp(card);
  const p = powerRank(card);
  const notes = [];
  let damage = 0;
  let block = 0;
  let control = 0;
  let soulDamage = 0;
  let domainLoadDelta = 0;
  let durationRounds = Number(original.durationRounds || 0) > 0 ? 1 : 0;
  let ce = 8;

  switch (card.cardIntent) {
    case "attack":
      damage = clamp(round(original.baseDamage || maxForPower(card, [8, 12, 18, 24])), 6, maxForPower(card, [12, 18, 24, 26]));
      control = clamp(round(original.controlValue || 0), 0, maxForPower(card, [4, 7, 10, 12]));
      ce = clamp(round(damage * 0.72 + control * 0.45 + 4 + (ap - 1) * 4), 8, 32);
      break;
    case "finisher":
      damage = clamp(round(original.baseDamage || 42), 32, maxForPower(card, [42, 48, 54, 60]));
      control = clamp(round(original.controlValue || 0), 0, 16);
      ce = clamp(round(damage * 0.9 + control * 0.35 + 8), 36, 60);
      domainLoadDelta = clamp(round((original.domainLoadDelta || 0) * 0.45), 0, 10);
      break;
    case "defense":
      block = clamp(round(original.baseBlock || maxForPower(card, [10, 16, 22, 28])), 6, maxForPower(card, [18, 24, 30, 32]));
      control = clamp(round(original.controlValue || 0), 0, maxForPower(card, [4, 6, 8, 10]));
      ce = clamp(round(block * 0.45 + control * 0.4 + 3), 6, 20);
      domainLoadDelta = original.domainLoadDelta < 0 ? clamp(round(original.domainLoadDelta * 0.5), -3, 0) : 0;
      break;
    case "control":
      damage = clamp(round(original.baseDamage || 0), 0, maxForPower(card, [8, 12, 16, 18]));
      control = clamp(round(original.controlValue || maxForPower(card, [12, 20, 28, 34])), 8, maxForPower(card, [20, 28, 34, 40]));
      ce = clamp(round(damage * 0.5 + control * 0.58 + 5), 10, 36);
      domainLoadDelta = clamp(round((original.domainLoadDelta || 0) * 0.45), 0, 6);
      durationRounds = 1;
      break;
    case "resource":
      block = clamp(round(original.baseBlock || 0), 0, 14);
      ce = clamp(round(original.baseCeCost || 6), 2, 10);
      durationRounds = 1;
      break;
    case "support":
      damage = clamp(round(original.baseDamage || 0), 0, 12);
      block = clamp(round(original.baseBlock || 0), 0, 16);
      control = clamp(round(original.controlValue || 0), 0, 14);
      ce = clamp(round((damage + block + control) * 0.45 + 4), 4, 22);
      durationRounds = 1;
      break;
    case "mobility":
      damage = clamp(round(original.baseDamage || 0), 0, 8);
      block = clamp(round(original.baseBlock || 0), 0, 18);
      control = clamp(round(original.controlValue || 0), 0, 12);
      ce = clamp(round((damage + block + control) * 0.42 + 4), 6, 18);
      durationRounds = 1;
      break;
    case "summon":
      damage = clamp(round(original.baseDamage || 18), 10, maxForPower(card, [16, 20, 24, 26]));
      block = clamp(round(original.baseBlock || 0), 0, 16);
      control = clamp(round(original.controlValue || 0), 0, maxForPower(card, [14, 18, 22, 26]));
      ce = clamp(round(damage * 0.52 + block * 0.35 + control * 0.45 + 10), 18, 34);
      domainLoadDelta = clamp(round((original.domainLoadDelta || 0) * 0.4), 0, 6);
      durationRounds = 1;
      break;
    case "domain":
      damage = clamp(round(original.baseDamage || 18), 0, maxForPower(card, [18, 22, 26, 30]));
      control = clamp(round(original.controlValue || 16), 10, maxForPower(card, [18, 24, 30, 36]));
      ce = clamp(round(28 + p * 5 + damage * 0.2 + control * 0.25), 28, 52);
      domainLoadDelta = clamp(round(original.domainLoadDelta || 8), 4, 12);
      durationRounds = 1;
      break;
    case "rule":
      control = clamp(round(original.controlValue || 24), 16, 34);
      ce = clamp(round(14 + control * 0.35), 16, 28);
      domainLoadDelta = clamp(round((original.domainLoadDelta || 0) * 0.35), 0, 8);
      durationRounds = 1;
      break;
    case "soul":
      damage = clamp(round(original.baseDamage || 10), 6, 18);
      soulDamage = clamp(round(original.soulDamage || Math.max(4, damage * 0.5)), 4, 20);
      control = clamp(round(original.controlValue || 0), 0, 20);
      ce = clamp(round(damage * 0.5 + soulDamage * 0.8 + control * 0.4 + 8), 14, 34);
      break;
    default:
      damage = clamp(round(original.baseDamage || 0), 0, 18);
      block = clamp(round(original.baseBlock || 0), 0, 18);
      control = clamp(round(original.controlValue || 0), 0, 20);
      ce = clamp(round(original.baseCeCost || 10), 4, 28);
  }

  if (card.soulRelated && card.cardIntent !== "soul") {
    const soulMax = card.cardIntent === "finisher" ? 22 : 18;
    const soulBasis = soulDamage || original.soulDamage || Math.max(4, damage * 0.4 + control * 0.12);
    soulDamage = clamp(round(soulBasis), 4, soulMax);
    if (original.soulDamage > soulMax) notes.push("soulDamage capped to current soul effect scale");
  }

  if (original.baseDamage > 26 && !["finisher", "domain"].includes(card.cardIntent)) notes.push("baseDamage capped to current non-finisher hand scale");
  if (original.baseBlock > 32) notes.push("baseBlock capped to current hand scale");
  if (original.controlValue > 50) notes.push("controlValue capped to current control scale");
  if (original.baseCeCost > 60) notes.push("baseCeCost capped to current CE budget");

  return { apCost: ap, baseCeCost: ce, baseDamage: damage, baseBlock: block, controlValue: control, soulDamage, domainLoadDelta, durationRounds, balanceNotes: notes };
}

function conflictInfo(card) {
  const warnings = [];
  let reviewStatus = "accepted_candidate";
  let duplicateStatus = "none";
  let draftRole = "new_candidate";
  let draftVariantType = "ordinary";
  let variantOf = "";
  let variantReason = "";
  let playableAsNormalHand = true;
  let migrationDirective = "candidate_name_copy_pool_balance_recomputed";

  if (card.ruleRelated) draftVariantType = "rule_variant";
  if (card.domainRelated) draftVariantType = "domain_variant";
  if (card.soulRelated) draftVariantType = "soul_variant";

  if (card.techniqueId === "deadly_sentencing") {
    reviewStatus = "needs_merge";
    duplicateStatus = "possible";
    draftRole = "migration_placeholder";
    playableAsNormalHand = false;
    migrationDirective = hasTag(card, /executioner_sword/) ? "execution_sword_flow_only_do_not_draw_before_death_verdict" : "rule_trial_subphase_only_do_not_draw_before_domain";
    variantOf = "local_deadly_sentencing_trial_subphase";
    variantReason = "Higuruma trial and execution sword are generated by local domain rule flow.";
    warnings.push("deadly_sentencing cards must be injected by local trial subphase, not normal hand draw.");
  }

  if (hasTag(card, /world_slash/i)) {
    reviewStatus = reviewStatus === "accepted_candidate" ? "needs_merge" : reviewStatus;
    duplicateStatus = "possible";
    draftRole = "variant";
    variantOf = variantOf || "mechanism:conditionalWorldSlash";
    variantReason = variantReason || "World slash already exists as Mahoraga-reference/binding mechanism and must not become a normal guaranteed kill card.";
    warnings.push("world_slash should merge into conditional mechanism, not normal repeatable hand card.");
  }

  if (hasTag(card, /jacobs_ladder|technique_extinguish/i)) {
    reviewStatus = reviewStatus === "accepted_candidate" ? "needs_merge" : reviewStatus;
    duplicateStatus = "possible";
    draftRole = "variant";
    variantOf = variantOf || "mechanism:technique_extinguishment";
    variantReason = variantReason || "Jacob ladder should be migrated as technique/barrier/incarnation counter, not pure damage.";
    warnings.push("jacobs_ladder requires anti-technique targeting logic before playable import.");
  }

  if (card.ruleRelated && card.techniqueId !== "deadly_sentencing") warnings.push("ruleRelated card requires local subphase script before becoming playable.");
  if (card.possibleDomainEffectTypes?.includes("hard_control") && card.cardIntent !== "domain") warnings.push("hard_control must be downgraded or gated by domain-hit checks.");
  if (card.soulRelated) warnings.push("soul damage requires soul/vessel target handling before finalization.");

  return { reviewStatus, duplicateStatus, draftRole, draftVariantType, variantOf, variantReason, duplicateWarning: warnings, playableAsNormalHand, migrationDirective };
}

function baselineDuplicate(card) {
  if (!baselineCards.length) return null;
  const byId = baselineById.get(card.draftCardId);
  if (byId) return { type: "exact_id", card: byId };
  const byTechniqueName = baselineByTechniqueName.get(`${card.techniqueId}::${String(card.cardName || "").trim()}`);
  if (byTechniqueName) return { type: "exact_technique_name", card: byTechniqueName };
  return null;
}

const reviewed = source.draftCards.map((card, index) => {
  const conflict = conflictInfo(card);
  const duplicateInBaseline = baselineDuplicate(card);
  if (duplicateInBaseline) {
    const ref = duplicateInBaseline.card.draftCardId || `${duplicateInBaseline.card.techniqueId}:${duplicateInBaseline.card.cardName}`;
    conflict.duplicateStatus = duplicateInBaseline.type;
    conflict.variantOf = conflict.variantOf || `baseline:${ref}`;
    conflict.variantReason = conflict.variantReason || "Already present in the baseline reviewed package; keep this package entry for traceability only.";
    conflict.duplicateWarning.unshift(`duplicate in baseline reviewed package (${duplicateInBaseline.type}): ${ref}`);
    if (conflict.reviewStatus === "accepted_candidate") {
      conflict.reviewStatus = "skip_duplicate_previous_review";
      conflict.draftRole = "duplicate_reference";
      conflict.migrationDirective = "skip_duplicate_already_in_baseline_review";
    }
  }
  const originalStats = card.candidateRuntimeStats || {};
  const balanced = rebalance(card);
  const next = {
    ...card,
    sourceActionId: `feature_${slug(card.techniqueId || "technique")}_${String(index + 1).padStart(3, "0")}`,
    existingCardRefs: [],
    duplicateOf: conflict.duplicateStatus === "none" ? "" : conflict.variantOf,
    duplicateStatus: conflict.duplicateStatus,
    draftRole: conflict.draftRole,
    reviewStatus: conflict.reviewStatus,
    duplicateWarning: conflict.duplicateWarning.join("; "),
    variantOf: conflict.variantOf,
    variantReason: conflict.variantReason,
    draftVariantType: conflict.draftVariantType
  };
  delete next.candidateRuntimeStats;
  next.originalCandidateRuntimeStats = originalStats;
  next.balancedRuntimeStats = balanced;
  next.playableAsNormalHand = conflict.playableAsNormalHand;
  next.importableFromThisPackage = conflict.reviewStatus === "accepted_candidate";
  next.migrationDirective = conflict.migrationDirective;
  next.reviewLineInSource = lineOf(card.draftCardId);
  next.reviewedAt = "2026-05-01";
  return next;
});

const counts = reviewed.reduce((acc, card) => {
  acc.total += 1;
  acc.byReviewStatus[card.reviewStatus] = (acc.byReviewStatus[card.reviewStatus] || 0) + 1;
  acc.byIntent[card.cardIntent] = (acc.byIntent[card.cardIntent] || 0) + 1;
  if (!card.playableAsNormalHand) acc.notNormalHand += 1;
  if (card.importableFromThisPackage) acc.importableFromThisPackage += 1;
  if (card.balancedRuntimeStats.balanceNotes.length) acc.rebalancedOutliers += 1;
  return acc;
}, { total: 0, notNormalHand: 0, importableFromThisPackage: 0, rebalancedOutliers: 0, byReviewStatus: {}, byIntent: {} });

function countCards(cards) {
  return cards.reduce((acc, card) => {
    acc.total += 1;
    acc.byReviewStatus[card.reviewStatus] = (acc.byReviewStatus[card.reviewStatus] || 0) + 1;
    acc.byIntent[card.cardIntent] = (acc.byIntent[card.cardIntent] || 0) + 1;
    if (!card.playableAsNormalHand) acc.notNormalHand += 1;
    if (card.importableFromThisPackage) acc.importableFromThisPackage += 1;
    if (card.balancedRuntimeStats.balanceNotes.length) acc.rebalancedOutliers += 1;
    return acc;
  }, { total: 0, notNormalHand: 0, importableFromThisPackage: 0, rebalancedOutliers: 0, byReviewStatus: {}, byIntent: {} });
}

const deltaReviewed = baselineCards.length
  ? reviewed.filter((card) => card.reviewStatus !== "skip_duplicate_previous_review")
  : [];
const deltaCounts = countCards(deltaReviewed);

const output = {
  schema: `jjk.technique.feature.hand.drafts.reviewed.${outputTag}`,
  version: `${outputTag}-reviewed`,
  status: "CANDIDATE_REVIEWED",
  generatedAt: "2026-05-01T00:00:00-04:00",
  sourceFile: sourcePath,
  sourceSchema: source.schema,
  baselineFile: baselinePath || "",
  reviewBasis: {
    currentProjectDataDir: dataDir,
    existingCardTemplates: "duel-card-templates-v0.1-candidate.json",
    existingActionTemplates: "duel-action-templates-v0.1-candidate.json",
    draftSchema: "technique-card-draft-schema-v0.1-candidate.json",
    balancePolicy: "Do not import raw candidateRuntimeStats. Preserve names/copy, add migration fields, cap values to current hand beta scale."
  },
  balanceCaps: {
    nonFinisherAttackDamageMax: 26,
    defenseBlockMax: 32,
    controlValueSoftMax: 40,
    finisherDamageMax: 60,
    ceCostMax: 60,
    normalHandApMax: 2,
    finisherAp: 3
  },
  counts,
  notes: [
    "Original candidateRuntimeStats moved to originalCandidateRuntimeStats for traceability.",
    "balancedRuntimeStats is recomputed candidate balance for current hand beta; it is not final runtime import.",
    "Mechanism conflicts such as deadly_sentencing, world_slash, and jacobs_ladder are marked as needs_merge or non-normal-hand.",
    "This file does not overwrite current playable hand templates."
  ],
  draftCards: reviewed
};

fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

if (baselineCards.length) {
  fs.writeFileSync(deltaOutPath, JSON.stringify({
    ...output,
    schema: `jjk.technique.feature.hand.drafts.reviewed.${outputTag}.delta`,
    version: `${outputTag}-delta-reviewed`,
    status: "CANDIDATE_REVIEWED_DELTA",
    counts: deltaCounts,
    notes: [
      ...output.notes,
      "This delta file excludes entries already present in the supplied baseline reviewed package."
    ],
    draftCards: deltaReviewed
  }, null, 2), "utf8");
}

const summaryLines = [
  `JJK feature hand drafts ${outputTag} review/migration summary`,
  "generatedAt: 2026-05-01",
  `sourceFile: ${sourcePath}`,
  `baselineFile: ${baselinePath || "(none)"}`,
  `outputFile: ${outPath}`,
  ...(baselineCards.length ? [`deltaOutputFile: ${deltaOutPath}`] : []),
  "",
  "counts:",
  `- total: ${counts.total}`,
  `- accepted_candidate: ${counts.byReviewStatus.accepted_candidate || 0}`,
  `- needs_merge: ${counts.byReviewStatus.needs_merge || 0}`,
  `- skip_duplicate_previous_review: ${counts.byReviewStatus.skip_duplicate_previous_review || 0}`,
  `- importableFromThisPackage: ${counts.importableFromThisPackage}`,
  `- notNormalHand: ${counts.notNormalHand}`,
  `- rebalancedOutliers: ${counts.rebalancedOutliers}`,
  ...(baselineCards.length ? [
    "",
    "delta counts:",
    `- total: ${deltaCounts.total}`,
    `- accepted_candidate: ${deltaCounts.byReviewStatus.accepted_candidate || 0}`,
    `- needs_merge: ${deltaCounts.byReviewStatus.needs_merge || 0}`,
    `- importableFromThisPackage: ${deltaCounts.importableFromThisPackage}`,
    `- rebalancedOutliers: ${deltaCounts.rebalancedOutliers}`
  ] : []),
  "",
  "policy:",
  "- Original file was not modified.",
  "- Raw candidateRuntimeStats are preserved as originalCandidateRuntimeStats.",
  "- balancedRuntimeStats caps current beta scale: non-finisher damage <= 26, block <= 32, finisher damage <= 60, CE <= 60.",
  "- Migration fields were added: sourceActionId, existingCardRefs, duplicateStatus, draftRole, reviewStatus, variantOf, variantReason, draftVariantType.",
  "- deadly_sentencing trial/execution cards are subphase-only and must not enter normal hand draw.",
  "- world_slash is marked as conditionalWorldSlash mechanism variant.",
  "- jacobs_ladder is marked as technique_extinguishment targeting variant.",
  "",
  "next:",
  "1. Manually review needs_merge items before runtime import.",
  "2. Map balancedRuntimeStats to action/card template fields only after review.",
  "3. soul/rule/hard_control/domain_variant cards still need local script hooks."
];
fs.writeFileSync(summaryPath, summaryLines.join("\n"), "utf8");

console.log(JSON.stringify({ outPath, deltaOutPath: baselineCards.length ? deltaOutPath : "", summaryPath, counts, deltaCounts: baselineCards.length ? deltaCounts : null }, null, 2));
