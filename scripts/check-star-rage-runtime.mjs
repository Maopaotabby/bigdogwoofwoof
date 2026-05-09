import fs from "node:fs";
import vm from "node:vm";

const actions = fs.readFileSync("modules/duel/duel-actions.js", "utf8");
const hand = fs.readFileSync("modules/duel/duel-hand.js", "utf8");
const cards = JSON.parse(fs.readFileSync("data/duel-special-card.json", "utf8")).cards || [];
const characters = JSON.parse(fs.readFileSync("data/character-cards-v0.1.json", "utf8")).cards || [];

const starCards = cards.filter((card) => (card.specialHandTags || []).includes("star_rage"));
const byName = new Map(starCards.map((card) => [card.name, card]));
const yuki = characters.find((card) => card.characterId === "yuki_tsukumo_culling") || {};

vm.runInThisContext(fs.readFileSync("modules/duel/duel-card-template.js", "utf8"));

function previewStarRageCard(card, mass = 7) {
  if (!card) return null;
  const runtime = {
    ...card,
    id: card.sourceActionId,
    label: card.name,
    effects: { ...(card.effects || {}) }
  };
  if (card.starRageEffect === "black_hole") {
    runtime.starRageRuntime = {
      active: true,
      massBefore: mass,
      massCost: 0,
      massGain: 0,
      consumeAllMass: true,
      blackHoleN: mass
    };
    runtime.baseDamage = Math.max(0, Number(card.starRageBlackHoleBaseDamagePerMass || 7) * mass);
    runtime.blockIgnoreRatio = Number(Math.max(0, mass * Number(card.starRageBlackHoleBlockIgnorePerMass || 0.1) - Number(card.starRageBlackHoleBlockIgnoreOffset || 0.2)).toFixed(4));
    runtime.effects.selfHpCostRatio = Number((Number(card.starRageBlackHoleSelfHpCostBaseRatio || 0.1) + mass * Number(card.starRageBlackHoleSelfHpCostPerMassRatio || 0.1)).toFixed(4));
    runtime.effects.selfHpCostNonlethal = true;
  }
  return globalThis.JJKDuelCardTemplate.calculateDuelCardFinalPreview(runtime, yuki);
}

const garudaPreview = previewStarRageCard(byName.get("凰轮"), 7);
const blackHolePreview = previewStarRageCard(byName.get("黑洞终局"), 7);

function registerStarRageProbeDependencies(battle) {
  globalThis.JJKDuelActions.registerDependencies({
    getDuelBattle: () => battle,
    getDuelCardTemplateIndex: () => ({ cards }),
    getDuelActionRules: () => ({ templates: [] }),
    getDuelMechanicTemplateRules: () => ({ mechanics: [] }),
    getDuelProfileForSide: () => ({}),
    getDuelDomainResponseProfile: () => ({ canExpandDomain: false, allowedDomainResponseActions: [] }),
    isDuelOpponentDomainThreat: () => false,
    hasDuelDomainCounterAccess: () => false,
    getDuelStatusEffectValue: () => 0,
    hashDuelSeed: () => 0,
    clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
    clampDuelResource: (resource) => {
      if (!resource) return;
      resource.hp = Math.max(0, Math.min(Number(resource.maxHp || resource.hp || 0), Number(resource.hp || 0)));
      resource.ce = Math.max(0, Math.min(Number(resource.maxCe || resource.ce || 0), Number(resource.ce || 0)));
    },
    getDuelBattlefieldUnits: (activeBattle) => activeBattle.battlefieldUnits,
    setDuelSpecialCounterEntries: () => {},
    syncDuelTrialSubPhaseLifecycle: () => {},
    updateDuelDomainTrialContext: () => {},
    normalizeDuelDomainSpecificAction: (action) => action,
    applyDuelDomainSpecificAction: () => null,
    applyDuelTrialAction: () => null,
    applyDuelJackpotAction: () => null,
    appendDuelActionLog: () => {}
  });
}

function createProbeActors() {
  return {
    actor: {
      side: "left",
      hp: 1000,
      maxHp: 1000,
      ce: 999,
      maxCe: 999,
      stability: 1,
      maxStability: 1,
      specialHandTags: ["star_rage"],
      innateTraits: ["star_rage"],
      statusEffects: []
    },
    opponent: {
      side: "right",
      hp: 1000,
      maxHp: 1000,
      ce: 999,
      maxCe: 999,
      stability: 1,
      maxStability: 1,
      statusEffects: []
    }
  };
}

function runStarRageExecutionProbe(actionId, mass = 7, options = {}) {
  if (!globalThis.JJKDuelActions) {
    vm.runInThisContext(actions);
  }
  const battle = {
    round: 1,
    selectedHandActions: {},
    battlefieldUnits: options.garudaInField ? [{
      id: "star_rage_garuda_unit_left_probe",
      cardId: "star_rage_garuda_unit",
      name: "凰轮",
      ownerSide: "left",
      active: true,
      starRageGaruda: true
    }] : [],
    starRageState: { left: { round: 2, mass, base: 1 } }
  };
  const { actor, opponent } = createProbeActors();
  registerStarRageProbeDependencies(battle);
  const action = globalThis.JJKDuelActions.buildDuelActionPool(actor, opponent, battle).find((item) => item.id === actionId);
  const result = globalThis.JJKDuelActions.applyDuelActionEffect(action, actor, opponent, battle);
  return {
    action,
    result,
    actor,
    opponent,
    mass: battle.starRageState.left.mass,
    unitCount: battle.battlefieldUnits.length
  };
}

function runStarRageRoundProgressProbe(options = {}) {
  if (!globalThis.JJKDuelActions) vm.runInThisContext(actions);
  const battle = {
    round: 1,
    selectedHandActions: {},
    battlefieldUnits: options.garudaInField ? [{
      id: "star_rage_garuda_unit_left_probe",
      cardId: "star_rage_garuda_unit",
      name: "凰轮",
      ownerSide: "left",
      active: true,
      starRageGaruda: true
    }] : [],
    starRageState: { left: { round: 2, mass: options.mass ?? 1, base: 1, autoProgress: options.autoProgress ?? 0 } }
  };
  const { actor, opponent } = createProbeActors();
  registerStarRageProbeDependencies(battle);
  battle.round = 2;
  globalThis.JJKDuelActions.buildDuelActionPool(actor, opponent, battle);
  const afterOne = battle.starRageState.left.mass;
  battle.round = 3;
  globalThis.JJKDuelActions.buildDuelActionPool(actor, opponent, battle);
  const afterTwo = battle.starRageState.left.mass;
  return { afterOne, afterTwo, state: battle.starRageState.left };
}

const massAttackExecution = runStarRageExecutionProbe("feature_star_rage_047", 7);
const massDefenseExecution = runStarRageExecutionProbe("feature_star_rage_048", 7);
const garudaExecution = runStarRageExecutionProbe("feature_star_rage_049", 7);
const garudaRecallExecution = runStarRageExecutionProbe("feature_star_rage_049", 5, { garudaInField: true });
const blackHoleExecution = runStarRageExecutionProbe("feature_star_rage_050", 7);
const naturalMassProgress = runStarRageRoundProgressProbe({ mass: 1 });
const garudaUpkeepProgress = runStarRageRoundProgressProbe({ mass: 7, garudaInField: true });
const garudaUpkeepBeforeAutoGain = runStarRageRoundProgressProbe({ mass: 7, autoProgress: 1, garudaInField: true });

const checks = [
  {
    name: "runtime state exists",
    pass: actions.includes("getStarRageMassState") && actions.includes("setDuelSpecialCounterEntries(battle, side, \"star_rage\"")
  },
  {
    name: "round auto gain and star-rage single-card bonus exist",
    pass: actions.includes("starRageRound") && actions.includes("singleCardBonus") && actions.includes("grantStarRageSingleCardTurnBonus") && !actions.includes("passiveSingleCardBonus")
  },
  {
    name: "runtime wrapper reads CE-control correction from card data",
    pass: actions.includes("getStarRageRuntimeAction") && actions.includes("starRageCeControlDamageScale") && actions.includes("starRageCeControlDamageScaleLimit") && actions.includes("starRageCeControlMaxMultiplier")
  },
  {
    name: "availability checks mass and black-hole exclusivity",
    pass: actions.includes("getStarRageActionAvailability") && actions.includes("黑洞终局需要虚拟质量至少 5") && actions.includes("黑洞终局本回合不能与其他手札并用")
  },
  {
    name: "mass spend and gain are settled after play",
    pass: actions.includes("applyStarRageResolution") && actions.includes("consumeAllMass")
  },
  {
    name: "garuda summon/recall uses battlefield units",
    pass:
      actions.includes("findStarRageGarudaUnit") &&
      actions.includes("summonStarRageGaruda") &&
      actions.includes("recallStarRageGaruda") &&
      actions.includes("starRageGarudaUnit") &&
      !actions.includes("reduceStarRageMaxHp") &&
      !actions.includes("maxHpLost")
  },
  {
    name: "feature-card import preserves star-rage runtime fields",
    pass:
      actions.includes("starRageEffect: card?.starRageEffect") &&
      actions.includes("blockIgnoreRatio: Math.max(0, Math.min(0.9, Number(card?.blockIgnoreRatio || 0)))") &&
      actions.includes("starRageGarudaUnit: card?.starRageGarudaUnit") &&
      actions.includes("starRageBlackHoleBaseDamagePerMass: card?.starRageBlackHoleBaseDamagePerMass") &&
      actions.includes("starRageCeControlDamageScale: card?.starRageCeControlDamageScale")
  },
  {
    name: "card-template import preserves star-rage runtime fields",
    pass:
      actions.includes("starRageEffect: card.starRageEffect") &&
      actions.includes("blockIgnoreRatio: Math.max(0, Math.min(0.9, Number(card.blockIgnoreRatio || 0)))") &&
      actions.includes("starRageConsumeAllMass: card.starRageConsumeAllMass") &&
      actions.includes("starRageBlackHoleSelfHpCostBaseRatio: card.starRageBlackHoleSelfHpCostBaseRatio") &&
      actions.includes("starRageBlackHoleSelfHpCostPerMassRatio: card.starRageBlackHoleSelfHpCostPerMassRatio") &&
      actions.includes("starRageGarudaUnit: card.starRageGarudaUnit")
  },
  {
    name: "star-rage access reads actor tags as well as profile tags",
    pass:
      actions.includes("toFeatureList(actor.specialHandTags)") &&
      actions.includes("toFeatureList(actor.innateTraits)") &&
      actions.includes("toFeatureList(profile.specialHandTags)")
  },
  {
    name: "hand execution passes selected count for single-card bonus",
    pass: hand.includes("selectedCount: selected.length")
  },
  {
    name: "cards expose required star rage kit",
    pass:
      byName.get("虚拟质量")?.starRageEffect === "mass_gain" &&
      byName.get("质量附加")?.starRageEffect === "mass_attack" &&
      byName.get("质量防御")?.starRageEffect === "mass_defense" &&
      byName.get("凰轮")?.starRageEffect === "garuda" &&
      byName.get("黑洞终局")?.starRageEffect === "black_hole"
  },
  {
    name: "mass attack, defense, black hole and garuda numbers match spec",
    pass:
      [byName.get("虚拟质量"), byName.get("质量附加"), byName.get("质量防御"), byName.get("凰轮"), byName.get("黑洞终局")]
        .reduce((total, card) => total + Number(card?.baseCeCost || 0), 0) / 5 === 40 &&
      byName.get("质量附加")?.starRageOutgoingScale === 1.18 &&
      byName.get("质量防御")?.starRageIncomingScale === 0.8 &&
      byName.get("质量防御")?.starRageIncomingReductionCap === 100 &&
      !("starRageMaxHpCost" in (byName.get("质量防御") || {})) &&
      byName.get("凰轮")?.baseDamage === 10 &&
      byName.get("凰轮")?.starRageMassCost === 2 &&
      byName.get("凰轮")?.starRageSummonMassCost === 2 &&
      byName.get("凰轮")?.starRageRecallMassGain === 1 &&
      byName.get("凰轮")?.blockIgnoreRatio === 0.2 &&
      byName.get("凰轮")?.starRageGarudaUnit?.maxHp === 150 &&
      byName.get("凰轮")?.starRageGarudaUnit?.baseDamage === 100 &&
      byName.get("凰轮")?.starRageGarudaUnit?.baseBlock === 50 &&
      byName.get("凰轮")?.starRageGarudaUnit?.blockIgnoreRatio === 0.2 &&
      byName.get("凰轮")?.starRageGarudaUnit?.damageReductionRatio === 0.5 &&
      byName.get("黑洞终局")?.baseDamage === 35 &&
      byName.get("黑洞终局")?.starRageBlackHoleBaseDamagePerMass === 7 &&
      byName.get("黑洞终局")?.requirements?.minVirtualMass === 5 &&
      byName.get("黑洞终局")?.starRageConsumeAllMass === true &&
      byName.get("黑洞终局")?.exclusiveHandSelection === true &&
      actions.includes("starRageBlackHoleBaseDamagePerMass")
  },
  {
    name: "garuda penetration is carried into summoned unit attacks",
    pass:
      actions.includes("unitStats: { maxHp: maxHp, currentHp: maxHp, baseDamage: baseDamage, baseBlock: baseBlock, damageReductionRatio: damageReductionRatio, blockIgnoreRatio: blockIgnoreRatio") &&
      actions.includes("unit?.blockIgnoreRatio ?? unit?.unitStats?.blockIgnoreRatio ?? profile.blockIgnoreRatio") &&
      actions.includes("applyDuelHpDamageToTarget(target, damage, battle, { blockIgnoreRatio: blockIgnoreRatio })")
  },
  {
    name: "star rage CE-control multiplier is data-tunable above old cap",
    pass:
      byName.get("凰轮")?.starRageCeControlDamageScale === 1 &&
      byName.get("凰轮")?.starRageCeControlMaxMultiplier === 3.6 &&
      byName.get("黑洞终局")?.starRageCeControlDamageScale === 2.35 &&
      byName.get("黑洞终局")?.starRageCeControlDamageScaleLimit === 3 &&
      byName.get("黑洞终局")?.starRageCeControlMaxMultiplier === 7
  },
  {
    name: "yuki star rage card-face damage stays in requested bands at 7 mass",
    pass:
      Number(blackHolePreview?.finalDamage || 0) >= 1000 &&
      Number(blackHolePreview?.finalDamage || 0) < 10000 &&
      Number(garudaPreview?.finalDamage || 0) >= 100 &&
      Number(garudaPreview?.finalDamage || 0) <= 280
  },
  {
    name: "star-rage spend cards deduct virtual mass during execution",
    pass:
      massAttackExecution.mass === 6 &&
      massAttackExecution.result?.starRage?.consumed === 1 &&
      massDefenseExecution.mass === 6 &&
      massDefenseExecution.result?.starRage?.consumed === 1
  },
  {
    name: "star-rage garuda and black hole settle execution resources",
    pass:
      garudaExecution.mass === 5 &&
      garudaExecution.result?.starRage?.consumed === 2 &&
      garudaExecution.unitCount === 1 &&
      garudaRecallExecution.mass === 6 &&
      garudaRecallExecution.result?.starRage?.gained === 1 &&
      blackHoleExecution.actor.hp === 200 &&
      blackHoleExecution.mass === 0 &&
      blackHoleExecution.result?.hpCost === 800 &&
      blackHoleExecution.result?.starRage?.consumed === 7 &&
      actions.includes('action.starRageEffect !== "garuda"')
  },
  {
    name: "star-rage natural mass gain is every two rounds and garuda costs upkeep",
    pass:
      naturalMassProgress.afterOne === 1 &&
      naturalMassProgress.afterTwo === 2 &&
      garudaUpkeepProgress.afterOne === 6 &&
      garudaUpkeepProgress.afterTwo === 6 &&
      garudaUpkeepBeforeAutoGain.afterOne === 7 &&
      actions.includes("massAfterUpkeep") &&
      actions.includes("autoProgress") &&
      actions.includes("garudaUpkeep")
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error("Star rage runtime checks failed:");
  for (const check of failed) console.error("- " + check.name);
  process.exit(1);
}

console.log(`Star rage runtime checks passed: ${checks.length}`);
