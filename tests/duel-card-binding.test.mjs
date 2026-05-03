import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

function loadDuelHand() {
  delete globalThis.JJKDuelHand;
  const source = fs.readFileSync("modules/duel/duel-hand.js", "utf8");
  vm.runInThisContext(source, { filename: "modules/duel/duel-hand.js" });
  return globalThis.JJKDuelHand;
}

function loadRules() {
  return JSON.parse(fs.readFileSync("data/duel-character-card-rules-v0.1-candidate.json", "utf8"));
}

function configureHand(hand, rules) {
  hand.clearDependencies();
  hand.registerDependencies({ state: { duelCharacterCardRules: rules } });
}

test("character variants gate signature hand cards beyond loose names and archetypes", () => {
  const hand = loadDuelHand();
  const rules = loadRules();
  configureHand(hand, rules);

  const tenShadowsCard = {
    sourceActionId: "shikigami_intercept",
    label: "式神牵制"
  };
  const limitlessCard = {
    sourceActionId: "infinity_guard",
    label: "无下限防线"
  };

  const toji = {
    characterId: "toji_fushiguro_hidden_inventory",
    displayName: "伏黑甚尔（怀玉，完整咒具）",
    traits: ["零咒力", "咒具"]
  };
  const heianSukuna = {
    characterId: "sukuna_heian_only",
    displayName: "两面宿傩（平安）",
    techniqueText: "御厨子、解、捌、开放领域。",
    notes: "没有十种影法术资源。"
  };
  const shinjukuTenShadowsSukuna = {
    characterId: "sukuna_shinjuku_ten_shadows",
    displayName: "两面宿傩（新宿十影）",
    techniqueText: "御厨子与十种影法术资源。",
    externalResource: "新宿决战十影资源：魔虚罗、嵌合兽顎吐。"
  };
  const gojo = {
    characterId: "gojo_satoru_shinjuku",
    displayName: "五条悟（新宿决战）",
    techniqueText: "无下限术式与六眼。"
  };

  assert.equal(hand.isDuelCardEligibleForCharacter(tenShadowsCard, toji), false, "伏黑甚尔不能因为姓伏黑获得十影手札");
  assert.equal(hand.isDuelCardEligibleForCharacter(tenShadowsCard, heianSukuna), false, "平安宿傩不能获得十影手札");
  assert.equal(hand.isDuelCardEligibleForCharacter(tenShadowsCard, shinjukuTenShadowsSukuna), true, "新宿十影宿傩可以获得十影手札");
  assert.equal(hand.isDuelCardEligibleForCharacter(limitlessCard, heianSukuna), false, "非五条无下限形态不能获得无下限手札");
  assert.equal(hand.isDuelCardEligibleForCharacter(limitlessCard, gojo), true, "五条无下限形态可以获得无下限手札");
});
