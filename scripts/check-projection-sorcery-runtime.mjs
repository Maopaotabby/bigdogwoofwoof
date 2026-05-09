import fs from "node:fs";
import vm from "node:vm";

const actions = fs.readFileSync("modules/duel/duel-actions.js", "utf8");
const hand = fs.readFileSync("modules/duel/duel-hand.js", "utf8");
const cards = JSON.parse(fs.readFileSync("data/duel-special-card.json", "utf8")).cards || [];
const characters = JSON.parse(fs.readFileSync("data/character-cards-v0.1.json", "utf8")).cards || [];
const html = fs.readFileSync("index.html", "utf8");

const projectionCards = cards.filter((card) => (card.specialHandTags || []).includes("projection_sorcery"));
const byName = new Map(projectionCards.map((card) => [card.name, card]));
const names = ["二十四帧", "帧内闪击", "破帧刹那", "自缚帧", "帧盾", "帧率同步", "过帧驱动"];
const oldNames = ["帧路预演", "画格冻结", "二十四帧追击"];
let humanNaoya = characters.find((card) => card.characterId === "naoya_zenin_human_perfect_preparation_candidate");
if (!humanNaoya) {
  for (const file of fs.readdirSync("character")) {
    if (!file.endsWith(".json") || file === "manifest.json") continue;
    const card = JSON.parse(fs.readFileSync(`character/${file}`, "utf8"));
    if (card.characterId === "naoya_zenin_human_perfect_preparation_candidate") {
      humanNaoya = card;
      break;
    }
  }
}
const naoya = humanNaoya || {};
vm.runInThisContext(fs.readFileSync("modules/duel/duel-card-template.js", "utf8"));

function previewProjectionCard(card, actor, overrides = {}) {
  if (!card) return null;
  return globalThis.JJKDuelCardTemplate.calculateDuelCardFinalPreview({
    ...card,
    ...overrides,
    projectionSorcery: { ...(card.projectionSorcery || {}), ...(overrides.projectionSorcery || {}) }
  }, actor || {});
}

const soloTwentyFourFramesPreview = previewProjectionCard(byName.get("二十四帧"), naoya, { baseDamage: 17 });

const checks = [
  {
    name: "only new projection cards remain on old tag",
    pass:
      projectionCards.length === 7 &&
      names.every((name) => byName.has(name)) &&
      oldNames.every((name) => !cards.some((card) => card.name === name)) &&
      projectionCards.every((card) => (card.tags || []).includes("projection_sorcery"))
  },
  {
    name: "projection owner keeps old special hand tag",
    pass: (naoya.specialHandTags || []).includes("projection_sorcery")
  },
  {
    name: "runtime has frame state, out-of-frame trigger and sealed hand",
    pass:
      actions.includes("getProjectionFrameState") &&
      actions.includes("triggerProjectionOutOfFrameIfReady") &&
      actions.includes("applyProjectionRandomHandSeal") &&
      actions.includes("本手牌被对方效果封锁") &&
      actions.includes("lockoutUntilRound")
  },
  {
    name: "runtime records dealt damage and end-turn frame settlement",
    pass:
      actions.includes("recordProjectionTurnDamage") &&
      actions.includes("settleProjectionTurnFrameGain") &&
      actions.includes("projectionFrameDamageForSettlement") &&
      actions.includes("damage <= 0 ? -1") &&
      actions.includes("damage <= 100 ? 2") &&
      actions.includes("damage <= 300 ? 3") &&
      actions.includes("damage <= 600 ? 6 : 8")
  },
  {
    name: "special card data matches requested frame rules",
    pass:
      byName.get("二十四帧")?.projectionSorcery?.uniqueOnlyBaseDamageBonus === 7 &&
      byName.get("二十四帧")?.projectionSorcery?.martialDamageScale === 1.2 &&
      byName.get("二十四帧")?.projectionSorcery?.ceControlDamageScale === 0.3 &&
      byName.get("帧内闪击")?.projectionSorcery?.nonUniqueBaseDamageBonus === 10 &&
      byName.get("帧内闪击")?.projectionSorcery?.martialDamageScale === 1.2 &&
      byName.get("帧内闪击")?.projectionSorcery?.ceControlDamageScale === 0.3 &&
      byName.get("破帧刹那")?.projectionSorcery?.minFrame === 18 &&
      byName.get("破帧刹那")?.projectionSorcery?.frameCost === 5 &&
      byName.get("破帧刹那")?.projectionSorcery?.blockIgnoreRatio === 0.3 &&
      byName.get("破帧刹那")?.projectionSorcery?.martialDamageScale === 1.2 &&
      byName.get("破帧刹那")?.projectionSorcery?.ceControlDamageScale === 0.3 &&
      byName.get("自缚帧")?.projectionSorcery?.incomingHpScale === 0.65 &&
      byName.get("自缚帧")?.projectionSorcery?.incomingHpReductionCap === 150 &&
      byName.get("自缚帧")?.projectionSorcery?.frameGainPerDamage === 40 &&
      byName.get("自缚帧")?.projectionSorcery?.maxFrameGainOnDamage === 3 &&
      String(byName.get("自缚帧")?.effectSummary || "").includes("每40伤害帧率+1") &&
      byName.get("帧盾")?.projectionSorcery?.shieldMaxHpRatio === 0.15 &&
      byName.get("帧盾")?.projectionSorcery?.frameGain === 2 &&
      byName.get("帧盾")?.projectionSorcery?.reflectTrueDamageRatio === 0.1 &&
      byName.get("帧率同步")?.projectionSorcery?.frameGain === 1 &&
      byName.get("帧率同步")?.projectionSorcery?.damageScale === 1.1 &&
      byName.get("过帧驱动")?.projectionSorcery?.minFrame === 14 &&
      byName.get("过帧驱动")?.projectionSorcery?.requiresAnotherCard === true
  },
  {
    name: "card preview applies projection-specific martial damage scaling",
    pass:
      fs.readFileSync("modules/duel/duel-card-template.js", "utf8").includes("isProjectionSorceryCardAction") &&
      fs.readFileSync("modules/duel/duel-card-template.js", "utf8").includes("projectionSpec.martialDamageScale") &&
      fs.readFileSync("modules/duel/duel-card-template.js", "utf8").includes("Math.pow(m.speed, martialScale)") &&
      fs.readFileSync("modules/duel/duel-card-template.js", "utf8").includes("Math.max(1, m.ceControl)") &&
      fs.readFileSync("modules/duel/duel-card-template.js", "utf8").includes("projectionAdjusted ? 1")
  },
  {
    name: "human naoya solo twenty-four-frames preview lands in target range",
    pass:
      Number(soloTwentyFourFramesPreview?.finalDamage || 0) >= 80 &&
      Number(soloTwentyFourFramesPreview?.finalDamage || 0) <= 120
  },
  {
    name: "hand execution passes selected ordering for unique/combo cards",
    pass: hand.includes("selectedCount: selected.length") && hand.includes("selectedIndex: index") && hand.includes("selectedLast: index === selected.length - 1")
  },
  {
    name: "announcement and archive expose projection overview",
    pass: html.includes("特殊逻辑术式一览") && html.includes("投射术式") && html.includes("V3.0.9（投射术式与星之怒修复）")
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error("Projection sorcery runtime checks failed:");
  for (const check of failed) console.error("- " + check.name);
  process.exit(1);
}

console.log(`Projection sorcery runtime checks passed: ${checks.length}`);
