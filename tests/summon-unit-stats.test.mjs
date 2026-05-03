import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const templates = JSON.parse(readFileSync(new URL("../data/duel-card-templates-v0.1-candidate.json", import.meta.url), "utf8"));
const cards = Array.isArray(templates.cards) ? templates.cards : [];
const summonUnitIds = new Set(cards.map((card) => card.summonSpec?.unitCardId).filter(Boolean));
const unitCards = cards.filter((card) => card.unitStats && (summonUnitIds.has(card.cardId) || card.cardType === "unit"));

assert.ok(unitCards.length >= 8, "Expected summon unit templates to be discoverable.");

for (const card of unitCards) {
  assert.ok(card.unitStats.baseStats, `${card.cardId} should define baseStats.`);
  assert.ok(card.unitStats.raw, `${card.cardId} should define raw numeric stats.`);
  assert.ok(card.unitStats.axes, `${card.cardId} should define axes.`);
  assert.ok(card.unitStats.attackProfile, `${card.cardId} should define attackProfile.`);
  assert.equal(typeof card.unitStats.raw.martialScore, "number", `${card.cardId} should have martialScore.`);
  assert.equal(typeof card.unitStats.raw.bodyScore, "number", `${card.cardId} should have bodyScore.`);
  assert.equal(typeof card.unitStats.axes.body, "number", `${card.cardId} should have body axis.`);
  assert.equal(typeof card.unitStats.attackProfile.accuracyProfile, "string", `${card.cardId} should have accuracyProfile.`);
}

console.log("Summon unit stat template checks passed.");
