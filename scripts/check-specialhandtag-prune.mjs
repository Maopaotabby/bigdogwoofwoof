import fs from "node:fs";

const chars = JSON.parse(fs.readFileSync("data/character-cards-v0.1.json", "utf8"));
const specialCards = JSON.parse(fs.readFileSync("data/duel-special-card.json", "utf8"));
const characterList = chars.characters || chars.cards || chars;
const cardList = specialCards.cards || specialCards;
const usedTags = new Set(characterList.flatMap((character) => [].concat(character.specialHandTags || [])));
const systemTags = new Set([
  "domain_access",
  "simple_domain",
  "falling_blossom_emotion",
  "trial_defender_common",
  "mahoraga_tuning_ritual",
  "zero_ce_heavenly_restriction"
]);

const requiredBindings = {
  megumi_fushiguro_culling: "ten_shadows",
  higuruma_hiromi_culling: "higuruma_trial_owner",
  hakari_kinji_jackpot: "idle_death_gamble",
  yuji_itadori_shinjuku: "yuji_soul_melee"
};

const missingBindings = Object.entries(requiredBindings).filter(([characterId, tag]) => {
  const character = characterList.find((item) => item.characterId === characterId);
  return ![].concat(character?.specialHandTags || []).includes(tag);
});

const danglingCards = cardList.filter((card) => {
  const tags = [].concat(card.specialHandTags || []).filter(Boolean);
  if (!tags.length) return false;
  return !tags.some((tag) => usedTags.has(tag) || systemTags.has(tag));
});

for (const [characterId, tag] of Object.entries(requiredBindings)) {
  console.log(`${missingBindings.some(([id]) => id === characterId) ? "FAIL" : "PASS"} ${characterId} has ${tag}`);
}
console.log(`${danglingCards.length ? "FAIL" : "PASS"} no cards remain with only unused specialHandTags`);

if (missingBindings.length || danglingCards.length) {
  if (danglingCards.length) console.error(danglingCards.slice(0, 20).map((card) => card.name || card.id).join("\n"));
  process.exit(1);
}
