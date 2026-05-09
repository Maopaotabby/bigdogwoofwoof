import fs from "node:fs";

const actions = fs.readFileSync("modules/duel/duel-actions.js", "utf8");
const cards = JSON.parse(fs.readFileSync("data/duel-special-card.json", "utf8")).cards || [];
const supernova = cards.find((card) => card.name === "超新星") || {};

const requiredMarkers = [
  "bloodCeToBaseDamageScale",
  "bloodHpToBaseDamageScale",
  "ceCost * ceToBaseDamageScale",
  "hpCostForDamage * hpToBaseDamageScale",
  "originalBase * originalBaseDamageScale",
  "bloodBoostRatio * bloodBoostDamageScale",
  "ceCostBase = Math.max(maxCe, currentCe)",
  "(hpCostForDamage / maxHp) * 1.25",
  "actualHpCost",
  "Math.min(0.65"
];

const missing = requiredMarkers.filter((marker) => !actions.includes(marker));

const maxCe = 413;
const maxHp = 357;
const currentHp = 260;
const ceCost = Math.max(1, Math.round(maxCe * 0.08 - 8));
const hpCost = Math.max(1, Number((currentHp * 0.12).toFixed(1)));
const bloodGain = Math.min(0.45, (hpCost / maxHp) * 1.25);
const bloodBoostRatio = Math.min(0.65, bloodGain);
const ceToBaseDamageScale = Number(supernova.bloodCeToBaseDamageScale ?? 0.56);
const hpToBaseDamageScale = Number(supernova.bloodHpToBaseDamageScale ?? 0.9);
const dynamicBaseDamage = (ceCost * ceToBaseDamageScale + hpCost * hpToBaseDamageScale + Number(supernova.baseDamage || 0) * 0.55) * (1 + bloodBoostRatio * 1.35);

const chosoBalancedMultiplier = (2.6 + 1.85) / 2;
const chosoBloodCeControlCorrection = 1.46;
const expectedActualDamage = Math.round(dynamicBaseDamage * chosoBalancedMultiplier * chosoBloodCeControlCorrection * 0.45);

console.log(`calibrated choso supernova damage estimate: ${expectedActualDamage}`);

if (missing.length) {
  console.error("Missing blood damage tuning markers:");
  missing.forEach((marker) => console.error("- " + marker));
  process.exit(1);
}

if (expectedActualDamage < 65 || expectedActualDamage > 90) {
  console.error("Choso supernova calibration is outside the reduced blood HP damage band.");
  process.exit(1);
}
