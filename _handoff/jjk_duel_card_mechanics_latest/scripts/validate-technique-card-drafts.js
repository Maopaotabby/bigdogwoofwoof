import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function asList(value) {
  if (Array.isArray(value)) return value.filter((item) => item != null && item !== "");
  if (value == null || value === "") return [];
  return [value];
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[\/／|｜·・:：,，()（）\[\]【】"'“”‘’\-—_]/g, "");
}

function fail(message, details = {}) {
  errors.push({ message, ...details });
}

function warn(message, details = {}) {
  warnings.push({ message, ...details });
}

const errors = [];
const warnings = [];

const schema = readJson("data/technique-card-draft-schema-v0.1-candidate.json");
const drafts = readJson("data/technique-card-drafts-v0.1-candidate.json");
const existingIndex = readJson("data/technique-card-existing-index-v0.1-candidate.json");

const requiredFields = schema.requiredFields || [];
const enumMap = schema.enums || {};
const draftCards = drafts.draftCards || [];
const allowlist = drafts.ordinaryTechniqueAllowlist || [];
const allowlistIds = new Set(allowlist.map((entry) => entry.techniqueId).filter(Boolean));
const allowlistNames = new Set(allowlist.map((entry) => normalizeText(entry.techniqueName)).filter(Boolean));
const excludedNames = Array.from(new Set([
  ...asList(drafts.ordinaryTechniquePolicy?.excludedFromOrdinaryDrafts),
  ...asList(schema.ordinaryDraftBoundary?.excludedFromOrdinaryDrafts)
]));
const excludedMatchers = excludedNames.map((name) => ({ name, normalizedName: normalizeText(name) }));
const forbiddenFinalFields = schema.forbiddenFinalFields || [];
const soulTags = schema.soulRelatedRequirement?.requiredAnyMechanicTag || [
  "soul_damage",
  "soul_boundary",
  "incarnated_sorcerer_counter",
  "vessel_separation",
  "soul_resonance"
];
const ruleRequiredNotes = schema.ruleRelatedRequirement?.requiredMigrationNoteIncludes || [
  "self_buff",
  "sure_hit",
  "auto_attack",
  "soul_damage",
  "hard_control"
];

if (drafts.status !== "CANDIDATE") fail("Draft library status must be CANDIDATE.");
if (schema.status !== "CANDIDATE") fail("Draft schema status must be CANDIDATE.");
if (Number(drafts.ordinaryTechniquePolicy?.declaredSourcePoolCount || 0) !== 60) {
  fail("ordinaryTechniquePolicy.declaredSourcePoolCount must remain 60 until the user changes the pool contract.");
}
if (allowlist.length !== 60) {
  warn("ordinaryTechniqueAllowlist should contain 60 entries for the current pool contract.", { actual: allowlist.length });
}

const draftIds = new Set();
const sourceActionIds = new Set();
const draftNameKeys = new Set();

draftCards.forEach((card, index) => {
  const label = card.draftCardId || `draftCards[${index}]`;
  requiredFields.forEach((field) => {
    if (!(field in card)) fail("Draft card missing required field.", { draftCardId: label, field });
  });
  forbiddenFinalFields.forEach((field) => {
    if (field in card) fail("Draft card must not hard-code final combat field.", { draftCardId: label, field });
  });

  if (card.status !== "CANDIDATE") fail("Draft card status must be CANDIDATE.", { draftCardId: label });
  if (!allowlistIds.has(card.techniqueId) && !allowlistNames.has(normalizeText(card.techniqueName))) {
    fail("Draft card technique is not in the ordinary technique allowlist.", {
      draftCardId: label,
      techniqueId: card.techniqueId,
      techniqueName: card.techniqueName
    });
  }

  const techniqueNameNormalized = normalizeText(card.techniqueName);
  const excluded = excludedMatchers.find((item) =>
    techniqueNameNormalized.includes(item.normalizedName) ||
    item.normalizedName.includes(techniqueNameNormalized)
  );
  if (excluded) {
    fail("Excluded non-ordinary technique/mechanism appears in ordinary draft cards.", {
      draftCardId: label,
      techniqueName: card.techniqueName,
      excludedName: excluded.name
    });
  }

  Object.entries(enumMap).forEach(([field, allowed]) => {
    if (!(field in card)) return;
    const value = card[field];
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (!allowed.includes(item)) fail("Draft card enum array contains invalid value.", { draftCardId: label, field, value: item });
      });
      return;
    }
    if (!allowed.includes(value)) fail("Draft card enum contains invalid value.", { draftCardId: label, field, value });
  });

  ["mechanicTags", "riskTags", "possibleDomainEffectTypes", "existingCardRefs"].forEach((field) => {
    if (!Array.isArray(card[field])) fail("Draft card field must be an array.", { draftCardId: label, field });
  });
  ["domainRelated", "soulRelated", "ruleRelated", "summonRelated", "antiDomainRelated"].forEach((field) => {
    if (typeof card[field] !== "boolean") fail("Draft card field must be boolean.", { draftCardId: label, field });
  });

  if (draftIds.has(card.draftCardId)) fail("Duplicate draftCardId.", { draftCardId: card.draftCardId });
  draftIds.add(card.draftCardId);

  if (card.sourceActionId) {
    if (sourceActionIds.has(card.sourceActionId)) fail("Duplicate draft sourceActionId.", { draftCardId: label, sourceActionId: card.sourceActionId });
    sourceActionIds.add(card.sourceActionId);
  }

  const nameKey = `${normalizeText(card.techniqueId)}|${normalizeText(card.cardName)}`;
  if (draftNameKeys.has(nameKey)) fail("Duplicate techniqueId + cardName draft.", { draftCardId: label, cardName: card.cardName });
  draftNameKeys.add(nameKey);

  const existingNameMatches = existingIndex.byNormalizedName?.[normalizeText(card.cardName)] || [];
  if (existingNameMatches.length && card.duplicateStatus === "none") {
    warn("Draft card name matches existing index but duplicateStatus is none.", {
      draftCardId: label,
      cardName: card.cardName,
      matches: existingNameMatches.slice(0, 3)
    });
  }
  if (card.duplicateStatus === "confirmed" && !card.duplicateOf) {
    fail("Confirmed duplicate must set duplicateOf.", { draftCardId: label });
  }
  if (card.draftRole === "variant" && card.duplicateStatus === "none") {
    warn("Variant draft should usually use duplicateStatus possible or confirmed.", { draftCardId: label });
  }
  if ((card.variantOf || card.draftVariantType !== "ordinary") && !card.variantReason) {
    fail("Variant or non-ordinary draftVariantType must set variantReason.", { draftCardId: label });
  }
  if (card.domainRelated && !card.possibleDomainEffectTypes.length) {
    fail("domainRelated draft must set possibleDomainEffectTypes.", { draftCardId: label });
  }
  if (card.ruleRelated) {
    const note = String(card.migrationNotes || "");
    if (!note) fail("ruleRelated draft must include migrationNotes.", { draftCardId: label });
    ruleRequiredNotes.forEach((needle) => {
      if (!note.includes(needle)) {
        fail("ruleRelated migrationNotes must state rule_based compatibility boundaries.", { draftCardId: label, missing: needle });
      }
    });
  }
  if (card.soulRelated && !card.mechanicTags.some((tag) => soulTags.includes(tag))) {
    fail("soulRelated draft must include at least one soul mechanic tag.", { draftCardId: label, requiredAny: soulTags });
  }
});

const existingButExcludedNames = new Set((existingIndex.existingButExcluded || []).map((entry) => normalizeText(entry.name || entry.displayName || entry.techniqueName)));
excludedMatchers.forEach((excluded) => {
  if (![...existingButExcludedNames].some((name) => name.includes(excluded.normalizedName) || excluded.normalizedName.includes(name))) {
    warn("Excluded boundary entry is not represented in existingButExcluded index; this may be fine if no existing source contains it.", {
      excludedName: excluded.name
    });
  }
});

if (warnings.length) {
  console.warn("Technique draft validation warnings:");
  warnings.forEach((entry) => console.warn(`- ${entry.message} ${JSON.stringify(entry)}`));
}

if (errors.length) {
  console.error("Technique draft validation failed:");
  errors.forEach((entry) => console.error(`- ${entry.message} ${JSON.stringify(entry)}`));
  process.exit(1);
}

console.log(`Technique draft validation passed with ${warnings.length} warning(s).`);
