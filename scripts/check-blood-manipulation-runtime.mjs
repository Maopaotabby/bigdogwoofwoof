import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = {
  actions: path.join(root, "modules", "duel", "duel-actions.js"),
  hand: path.join(root, "modules", "duel", "duel-hand.js"),
  template: path.join(root, "modules", "duel", "duel-card-template.js"),
  resource: path.join(root, "modules", "duel", "duel-resource.js"),
  domainProfile: path.join(root, "modules", "duel", "duel-domain-profile.js"),
  ruleSubphase: path.join(root, "modules", "duel", "duel-rule-subphase.js")
};

const source = Object.fromEntries(
  Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, "utf8")])
);
const bloodCards = JSON.parse(fs.readFileSync(path.join(root, "data", "duel-special-card.json"), "utf8")).cards
  .filter((card) => (card.specialHandTags || []).includes("blood_manipulation"));
const bloodByName = new Map(bloodCards.map((card) => [card.name, card]));

const checks = [
  ["actions", "buildBloodManipulationCoreActions", "missing blood conversion hand builder"],
  ["actions", "blood_ce_to_hp", "missing CE-to-HP conversion action"],
  ["actions", "blood_hp_to_ce", "missing HP-to-CE conversion action"],
  ["actions", "getBloodManipulationRuntimeAction", "missing blood runtime action wrapper"],
  ["actions", "applyBloodManipulationConversion", "missing blood resource conversion settlement"],
  ["actions", "recordBloodManipulationConversionChange", "missing visible blood conversion resource change log"],
  ["actions", "temporaryHpOverCap", "missing temporary HP over-cap grant for CE-to-HP conversion"],
  ["actions", "temporaryCeOverCap", "missing temporary CE over-cap grant for HP-to-CE conversion"],
  ["actions", "actor.hp = bloodConversionResult.afterHp", "missing post-clamp HP over-cap restoration"],
  ["actions", "syncBloodManipulationTemporaryOverCap(actor)", "missing post-restore over-cap marker sync"],
  ["actions", "getDuelActionTemporaryResourceCap(actor, \"hp\", \"maxHp\", \"temporaryHpOverCap\")", "direct healing should not erase blood HP over-cap"],
  ["actions", "bloodPierceRatio", "missing pierce coefficient field"],
  ["actions", "bloodBoostRatio", "missing blood coefficient field"],
  ["actions", "blockIgnoreRatio", "missing block ignore field"],
  ["actions", "resetBloodManipulationRoundState", "missing round reset for blood counters"],
  ["actions", "bloodCeControlDamageScale", "missing reduced CE control correction scale for blood"],
  ["actions", "bloodCeToBaseDamageScale", "missing CE-to-baseDamage scale field"],
  ["actions", "bloodHpToBaseDamageScale", "missing HP-to-baseDamage scale field"],
  ["actions", "ceCostBase = Math.max(maxCe, currentCe)", "over-cap CE should participate in blood CE cost base"],
  ["actions", "actualHpCost", "missing actual HP spent override for blood damage"],
  ["actions", "bloodCeCostReduction", "missing data-driven blood CE cost reduction"],
  ["actions", "bloodHpCostContributesDamage", "missing data-driven HP-cost damage contribution toggle"],
  ["actions", "action.bloodHpCostContributesDamage === false ? 0 : hpCost", "missing runtime HP-cost damage suppression"],
  ["actions", "incomingHpReductionCapFromBloodHpCostMultiplier", "missing HP-spent based incoming damage reduction cap"],
  ["actions", "bloodHpCostRatio: card?.bloodHpCostRatio", "special-card import does not preserve blood HP ratio"],
  ["actions", "bloodCeCostReduction: card?.bloodCeCostReduction", "special-card import does not preserve blood CE reduction"],
  ["hand", "guaranteedPerTurn", "missing fixed action injection support"],
  ["hand", "getFixedActionInjectionsFromPool", "missing fixed injection reader"],
  ["template", "bloodAdjusted", "missing blood CE-control correction marker"],
  ["resource", "getDuelTemporaryResourceCap(actor, \"temporaryHpOverCap\", \"maxHp\")", "round regen should preserve temporary HP over-cap"],
  ["resource", "getDuelTemporaryResourceCap(actor, \"temporaryCeOverCap\", \"maxCe\")", "round regen should preserve temporary CE over-cap"],
  ["domainProfile", "requireDependency(\"clampDuelResource\")(opponent)", "domain profile damage should preserve temporary over-cap state"],
  ["ruleSubphase", "temporaryHpOverCap", "jackpot subphase should not erase temporary HP over-cap"]
];

const missing = checks
  .filter(([key, needle]) => !source[key].includes(needle))
  .map(([, , message]) => message);

if (source.actions.includes("disableCeControlDamageCorrection: true")) {
  missing.push("blood runtime still disables CE-control damage correction completely");
}

if (bloodByName.get("超新星")?.bloodCeControlDamageScale !== 0.36) {
  missing.push("supernova should use the updated blood CE-control scale");
}

const expectedHpRatios = new Map([
  ["超新星", 0.12],
  ["百敛穿血", 0.08],
  ["血刃缠臂", 0.06],
  ["赤鳞跃动", 0.10],
  ["苅祓", 0.06]
]);

const expectedBaseDamage = new Map([
  ["超新星", 0],
  ["百敛穿血", 0],
  ["血刃缠臂", 0],
  ["赤鳞跃动", 0],
  ["苅祓", 0]
]);

for (const [name, ratio] of expectedHpRatios) {
  const card = bloodByName.get(name);
  if (card?.bloodHpCostRatio !== ratio) {
    missing.push(`${name} should use blood HP cost ratio ${ratio}`);
  }
  if (card?.bloodCeCostReduction !== 8) {
    missing.push(`${name} should reduce runtime CE cost by 8`);
  }
  if (card?.baseDamage !== expectedBaseDamage.get(name)) {
    missing.push(`${name} should use baseDamage ${expectedBaseDamage.get(name)}`);
  }
  if (card?.bloodHpToBaseDamageScale !== 0.9) {
    missing.push(`${name} should use reduced HP-to-baseDamage scale 0.9`);
  }
  if (card?.bloodCeToBaseDamageScale !== 0.56) {
    missing.push(`${name} should expose CE-to-baseDamage scale 0.56`);
  }
}

for (const name of ["百敛穿血", "血刃缠臂", "赤鳞跃动", "苅祓"]) {
  if (bloodByName.get(name)?.bloodCeControlDamageScale !== 0.24) {
    missing.push(`${name} should use the raised blood CE-control scale`);
  }
}

const scaleJump = bloodByName.get("赤鳞跃动");
if (scaleJump?.baseDamage !== 0 || scaleJump?.baseBlock !== 0) {
  missing.push("赤鳞跃动 should be a zero-damage support card without base block");
}
if (scaleJump?.effects?.outgoingScale !== 1.1 || scaleJump?.effects?.incomingHpScale !== 0.4) {
  missing.push("赤鳞跃动 should apply 10% outgoing damage and 60% incoming HP damage reduction");
}
if (scaleJump?.effects?.incomingHpReductionCapFromBloodHpCostMultiplier !== 3) {
  missing.push("赤鳞跃动 should cap prevented damage at 3x actual HP spent");
}
if (scaleJump?.bloodHpCostContributesDamage !== false) {
  missing.push("赤鳞跃动 HP cost should not convert into blood damage or blood coefficient");
}

for (const name of ["超新星", "百敛穿血", "血刃缠臂", "赤鳞跃动", "苅祓"]) {
  const summary = String(bloodByName.get(name)?.effectSummary || "");
  if (!summary.includes("当前体势") || !summary.includes("实际")) {
    missing.push(`${name} should describe current-HP and actual-cost blood settlement`);
  }
}

if (!source.template.includes("当前体势") || !source.template.includes("按实际消耗咒力转化体势")) {
  missing.push("blood card surface copy should mention current HP and conversion settlement");
}

if (!fs.readFileSync(path.join(root, "modules", "duel", "duel-resource.js"), "utf8").includes("temporaryHpOverCap")) {
  missing.push("resource clamp should preserve temporary HP over-cap from blood conversion");
}

if (missing.length) {
  console.error("Blood manipulation runtime check failed:");
  missing.forEach((message) => console.error("- " + message));
  process.exit(1);
}

console.log("Blood manipulation runtime markers are present.");
