import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, "data");

function readJson(relativePath, fallback = null) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(relativePath, payload) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
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

function makeDedupeKey(parts) {
  return asList(parts).map(normalizeText).filter(Boolean).join("|");
}

function collectWheelTechniqueEntries() {
  const wheels = readJson("data/wheels.json", { wheels: [] });
  const wheel = (wheels.wheels || []).find((entry) => entry.title === "生得术式");
  return (wheel?.items || []).map((item, index) => ({
    source: "wheels.json:生得术式",
    order: index + 1,
    name: item.text || "",
    normalizedName: normalizeText(item.text),
    weight: item.weight ?? null
  }));
}

function collectCardEntries() {
  const cardTemplates = readJson("data/duel-card-templates-v0.1-candidate.json", { cards: [] });
  return (cardTemplates.cards || []).map((card) => ({
    source: "duel-card-templates-v0.1-candidate.json",
    sourceFile: "data/duel-card-templates-v0.1-candidate.json",
    cardId: card.cardId || "",
    cardName: card.name || "",
    sourceActionId: card.sourceActionId || "",
    name: card.name || "",
    normalizedName: normalizeText(card.name || card.cardId),
    dedupeKey: makeDedupeKey([card.sourceActionId, card.name, card.cardType]),
    techniqueName: card.techniqueName || "",
    ownerOrRepresentative: card.ownerOrRepresentative || "",
    cardType: card.cardType || "",
    tags: asList(card.tags),
    effectSummary: card.effectSummary || "",
    status: card.status || "",
    existingKind: "cardTemplate"
  }));
}

function collectCardCopyEntries() {
  const copy = readJson("data/duel-card-copy-v0.1-candidate.json", { cards: [] });
  return (copy.cards || copy.entries || copy.copy || []).map((entry) => ({
    source: "duel-card-copy-v0.1-candidate.json",
    sourceFile: "data/duel-card-copy-v0.1-candidate.json",
    cardId: "",
    cardName: entry.displayName || "",
    sourceActionId: entry.sourceActionId || "",
    name: entry.displayName || "",
    normalizedName: normalizeText(entry.displayName || entry.sourceActionId),
    dedupeKey: makeDedupeKey([entry.sourceActionId, entry.displayName]),
    techniqueName: entry.techniqueName || "",
    ownerOrRepresentative: entry.ownerOrRepresentative || "",
    cardType: "",
    tags: asList(entry.uiTags),
    effectSummary: entry.shortEffect || entry.longEffect || "",
    status: entry.status || "",
    existingKind: "cardCopy"
  }));
}

function collectActionEntries() {
  const actionTemplates = readJson("data/duel-action-templates-v0.1-candidate.json", { templates: [] });
  return (actionTemplates.templates || []).map((action) => ({
    source: "duel-action-templates-v0.1-candidate.json",
    sourceFile: "data/duel-action-templates-v0.1-candidate.json",
    actionId: action.id || "",
    cardName: action.label || "",
    sourceActionId: action.id || "",
    name: action.label || "",
    normalizedName: normalizeText(action.label || action.id),
    dedupeKey: makeDedupeKey([action.id, action.label]),
    techniqueName: action.techniqueName || "",
    ownerOrRepresentative: action.ownerOrRepresentative || "",
    cardType: action.cardType || "",
    tags: asList(action.tags).concat(asList(action.mechanicIds)),
    effectSummary: action.description || action.effectSummary || "",
    status: action.status || "",
    existingKind: "actionTemplate"
  }));
}

function collectDomainEntries() {
  const profiles = readJson("data/duel-domain-profiles-v0.1-candidate.json", { profiles: [] });
  const configs = readJson("data/domain-configs-v0.1-candidate.json", { domainConfigs: [] });
  const profileEntries = (profiles.profiles || profiles.domains || []).map((profile) => ({
    source: "duel-domain-profiles-v0.1-candidate.json",
    sourceFile: "data/duel-domain-profiles-v0.1-candidate.json",
    domainId: profile.domainId || profile.id || "",
    cardName: profile.domainName || profile.name || "",
    sourceActionId: "",
    name: profile.domainName || profile.name || "",
    techniqueName: profile.techniqueName || "",
    ownerOrRepresentative: profile.ownerOrRepresentative || profile.owner || "",
    normalizedName: normalizeText([profile.domainName, profile.techniqueName].filter(Boolean).join(" ")),
    dedupeKey: makeDedupeKey([profile.domainId || profile.id, profile.domainName, profile.techniqueName]),
    cardType: "domain",
    status: profile.status || "",
    existingKind: "domainProfile"
  }));
  const configEntries = (configs.domainConfigs || configs.configs || []).map((config) => ({
    source: "domain-configs-v0.1-candidate.json",
    sourceFile: "data/domain-configs-v0.1-candidate.json",
    techniqueKey: config.techniqueKey || "",
    cardName: config.domainName || "",
    sourceActionId: "",
    name: config.domainName || "",
    techniqueName: config.techniqueName || "",
    ownerOrRepresentative: config.ownerOrRepresentative || "",
    normalizedName: normalizeText([config.domainName, config.techniqueName].filter(Boolean).join(" ")),
    dedupeKey: makeDedupeKey([config.techniqueKey, config.domainName, config.techniqueName]),
    cardType: "domain",
    status: config.status || "",
    existingKind: "domainConfig"
  }));
  return profileEntries.concat(configEntries);
}

function collectStrengthEntries() {
  const strength = readJson("data/strength-v0.2-candidate.json", {});
  const records = strength.records || strength.techniques || strength;
  if (!records || typeof records !== "object" || Array.isArray(records)) return [];
  return Object.entries(records)
    .filter(([, value]) => value && typeof value === "object" && !Array.isArray(value))
    .map(([name, value]) => ({
      source: "strength-v0.2-candidate.json",
      sourceFile: "data/strength-v0.2-candidate.json",
      cardId: "",
      cardName: value.displayName || name,
      sourceActionId: "",
      name,
      displayName: value.displayName || "",
      normalizedName: normalizeText(`${name} ${value.displayName || ""}`),
      dedupeKey: makeDedupeKey([name, value.displayName, value.category || value.classification]),
      techniqueName: value.displayName || name,
      ownerOrRepresentative: value.ownerOrRepresentative || value.owner || "",
      cardType: value.category || value.classification || "",
      effectSummary: value.sourceNote || value.notes || "",
      category: value.category || value.classification || "",
      tags: asList(value.tags),
      status: value.status || "CANDIDATE",
      existingKind: "strengthRecord"
    }));
}

function uniqueByKey(items, getKey) {
  const seen = new Set();
  return items.filter((item) => {
    const key = getKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const draftFile = readJson("data/technique-card-drafts-v0.1-candidate.json", {});
const schema = readJson("data/technique-card-draft-schema-v0.1-candidate.json", {});
const excludedNames = Array.from(new Set([
  ...asList(draftFile.ordinaryTechniquePolicy?.excludedFromOrdinaryDrafts),
  ...asList(schema.ordinaryDraftBoundary?.excludedFromOrdinaryDrafts)
]));
const excludedMatchers = excludedNames.map((name) => ({ name, normalizedName: normalizeText(name) }));

const existingCards = collectCardEntries();
const existingCardCopy = collectCardCopyEntries();
const existingActions = collectActionEntries();
const domainEntries = collectDomainEntries();
const strengthEntries = collectStrengthEntries();
const wheelEntries = collectWheelTechniqueEntries();
const existingAll = existingCards.concat(existingCardCopy, existingActions, domainEntries, strengthEntries);

const boundaryExcludedEntries = excludedMatchers.map((entry) => ({
  source: "technique-card-draft-schema/excludedFromOrdinaryDrafts",
  name: entry.name,
  normalizedName: entry.normalizedName,
  existingKind: "excludedBoundary",
  ordinaryDraftAllowed: false,
  exclusionReason: "Explicitly excluded from ordinary innate technique card drafts."
}));

const existingButExcluded = uniqueByKey(
  boundaryExcludedEntries.concat(existingAll
    .concat(wheelEntries.map((entry) => ({ ...entry, existingKind: "wheelEntry" })))
    .filter((entry) => {
      const normalized = entry.normalizedName || normalizeText(entry.name);
      return excludedMatchers.some((excluded) => normalized.includes(excluded.normalizedName) || excluded.normalizedName.includes(normalized));
    })
    .map((entry) => ({
      ...entry,
      ordinaryDraftAllowed: false,
      exclusionReason: "Excluded from ordinary innate technique card drafts; keep only as duplicate/index reference."
    }))),
  (entry) => `${entry.source}|${entry.name}|${entry.cardId || entry.actionId || entry.domainId || entry.order || ""}`
);

const byNormalizedName = {};
existingAll.forEach((entry) => {
  const key = entry.normalizedName || normalizeText(entry.name);
  if (!key) return;
  byNormalizedName[key] ||= [];
  byNormalizedName[key].push({
    source: entry.source,
    id: entry.cardId || entry.actionId || entry.domainId || entry.techniqueKey || "",
    name: entry.name || entry.displayName || "",
    existingKind: entry.existingKind || ""
  });
});

const payload = {
  schema: "jjk-technique-card-existing-index",
  version: "0.1.0-candidate",
  status: "CANDIDATE",
  generatedAt: new Date().toISOString(),
  generator: "scripts/build-technique-card-index.js",
  sourceFiles: [
    "data/duel-card-templates-v0.1-candidate.json",
    "data/duel-card-copy-v0.1-candidate.json",
    "data/duel-action-templates-v0.1-candidate.json",
    "data/duel-domain-profiles-v0.1-candidate.json",
    "data/domain-configs-v0.1-candidate.json",
    "data/strength-v0.2-candidate.json",
    "data/wheels.json"
  ],
  counts: {
    existingCards: existingCards.length,
    existingCardCopy: existingCardCopy.length,
    existingActions: existingActions.length,
    domainEntries: domainEntries.length,
    strengthEntries: strengthEntries.length,
    wheelTechniqueEntries: wheelEntries.length,
    existingButExcluded: existingButExcluded.length
  },
  existingCards,
  existingCardCopy,
  existingActions,
  domainEntries,
  strengthEntries,
  wheelTechniqueEntries: wheelEntries,
  existingButExcluded,
  byNormalizedName
};

writeJson("data/technique-card-existing-index-v0.1-candidate.json", payload);
console.log(`Wrote ${path.relative(root, path.join(dataDir, "technique-card-existing-index-v0.1-candidate.json"))}`);
console.log(JSON.stringify(payload.counts, null, 2));
