import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const run = (file) => vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file });

run("modules/duel/duel-card-template.js");
run("modules/duel/duel-resource.js");
run("modules/duel/duel-actions.js");

const specialCards = JSON.parse(fs.readFileSync(path.join(root, "data", "duel-special-card.json"), "utf8")).cards || [];
const bloodAttack = specialCards.find((card) => card.name === "百敛穿血");
const scaleJump = specialCards.find((card) => card.name === "赤鳞跃动");
const ceToHp = {
  id: "blood_ce_to_hp",
  sourceActionId: "blood_ce_to_hp",
  label: "咒力化血",
  name: "咒力化血",
  cardType: "resource",
  type: "blood_manipulation_conversion",
  tags: ["赤血操术", "blood_manipulation", "咒力化血", "resource"],
  specialHandTags: ["blood_manipulation"],
  apCost: 1,
  baseCeCost: 0,
  baseDamage: 0,
  baseBlock: 0,
  damageType: "none",
  scalingProfile: "blood_conversion",
  bloodConversion: "ce_to_hp",
  bloodCeCostRatio: 0.26,
  bloodCeToHpEfficiency: 0.82,
  effects: { weightDeltas: { resource: 0.8, sustain: 0.35 } }
};

if (!bloodAttack) throw new Error("missing 百敛穿血 special card");
if (!scaleJump) throw new Error("missing 赤鳞跃动 special card");

const battle = {
  round: 0,
  resourceState: { resourceLog: [], residualLog: [] },
  actionContexts: {},
  selectedHandActions: {},
  handState: {}
};

const actor = {
  id: "blood_actor",
  side: "left",
  name: "赤血测试",
  hp: 100,
  maxHp: 100,
  ce: 100,
  maxCe: 100,
  stability: 1,
  statusEffects: [],
  specialHandTags: ["blood_manipulation"],
  characterCardProfile: { characterId: "blood_actor", specialHandTags: ["blood_manipulation"] }
};

const opponent = {
  id: "target",
  side: "right",
  name: "目标",
  hp: 100,
  maxHp: 100,
  ce: 100,
  maxCe: 100,
  stability: 1,
  statusEffects: [],
  characterCardProfile: { characterId: "target" }
};

battle.resourceState.p1 = actor;
battle.resourceState.p2 = opponent;

const noop = () => {};
globalThis.JJKDuelActions.configure({
  state: { customDuelCards: [] },
  getDuelActionRules: () => ({ templates: [] }),
  getDuelMechanicTemplateRules: () => ({ mechanics: [] }),
  getDuelProfileForSide: (_battle, side) => side === "left" ? actor.characterCardProfile : opponent.characterCardProfile,
  getDuelDomainResponseProfile: () => ({ canExpandDomain: false, allowedDomainResponseActions: [] }),
  isDuelOpponentDomainThreat: () => false,
  hasDuelDomainCounterAccess: () => false,
  getDuelStatusEffectValue: () => 0,
  syncDuelTrialSubPhaseLifecycle: () => null,
  updateDuelDomainTrialContext: noop,
  normalizeDuelDomainSpecificAction: (template) => template,
  applyDuelDomainSpecificAction: () => null,
  applyDuelTrialAction: () => null,
  applyDuelJackpotAction: () => null,
  getDuelTrialOwnerActionTemplates: () => [],
  getDuelTrialDefenderActionTemplates: () => [],
  getDuelResourcePair: (_battle, side) => side === "left" ? actor : opponent,
  clampDuelResource: globalThis.JJKDuelResource.clampDuelResource,
  appendDuelActionLog: noop,
  recordDuelResourceChange: globalThis.JJKDuelResource.recordDuelResourceChange,
  getDuelResourceSideLabel: (side) => side,
  formatSignedDuelDelta: (value) => String(value)
});

const beforeHpCost = Number((actor.maxHp * Number(bloodAttack.bloodHpCostRatio || 0)).toFixed(1));
const conversion = globalThis.JJKDuelActions.applyDuelActionEffect(ceToHp, actor, opponent, battle);

if (!conversion?.bloodManipulation?.conversion || actor.hp <= actor.maxHp) {
  throw new Error(`CE-to-HP did not preserve over-cap HP: hp=${actor.hp}, max=${actor.maxHp}`);
}
if (Number(actor.temporaryHpOverCap || 0) <= 0) {
  throw new Error("CE-to-HP did not create temporaryHpOverCap");
}

const convertedHp = actor.hp;
globalThis.JJKDuelResource.clampDuelResource(actor);
if (actor.hp !== convertedHp || Number(actor.temporaryHpOverCap || 0) <= 0) {
  throw new Error(`no-op clamp lost CE-to-HP over-cap state: hp=${actor.hp}, converted=${convertedHp}, overCap=${actor.temporaryHpOverCap || 0}`);
}

actor.hp -= 10;
globalThis.JJKDuelResource.clampDuelResource(actor);
if (actor.hp <= actor.maxHp) {
  throw new Error(`temporary over-cap did not absorb damage before normal HP: hp=${actor.hp}, max=${actor.maxHp}`);
}

actor.statusEffects.push({ id: "jackpotStateCandidate", label: "jackpot 状态候选", rounds: 1, value: 1 });
const beforeRegenHp = actor.hp;
globalThis.JJKDuelResource.applyDuelRoundResourceRegen(actor, battle, "left");
if (actor.hp < beforeRegenHp || actor.hp > actor.maxHp + Number(actor.temporaryHpOverCap || 0)) {
  throw new Error(`round regen did not preserve temporary over-cap HP: before=${beforeRegenHp}, after=${actor.hp}, max=${actor.maxHp}, overCap=${actor.temporaryHpOverCap || 0}`);
}

const afterHpCost = Number((actor.hp * Number(bloodAttack.bloodHpCostRatio || 0)).toFixed(1));
if (!(afterHpCost > beforeHpCost)) {
  throw new Error(`blood attack actual HP cost did not increase after over-cap HP: before=${beforeHpCost}, after=${afterHpCost}`);
}

function runBloodAttackCostProbe(ce, roundOffset) {
  const probeBattle = {
    ...battle,
    round: Number(battle.round || 0) + roundOffset,
    resourceState: { resourceLog: [], residualLog: [] },
    actionContexts: {},
    bloodManipulationState: {}
  };
  const probeActor = { ...actor, hp: 100, ce, temporaryCeOverCap: Math.max(0, ce - actor.maxCe), statusEffects: [] };
  const probeOpponent = { ...opponent, hp: 100, ce: 100, statusEffects: [] };
  probeBattle.resourceState.p1 = probeActor;
  probeBattle.resourceState.p2 = probeOpponent;
  globalThis.JJKDuelActions.configure({
    getDuelResourcePair: (_battle, side) => side === "left" ? probeActor : probeOpponent,
    getDuelBattle: () => probeBattle
  });
  const action = {
    ...bloodAttack,
    id: bloodAttack.sourceActionId,
    label: bloodAttack.name,
    effects: { ...(bloodAttack.effects || {}) }
  };
  return Number(globalThis.JJKDuelActions.applyDuelActionEffect(action, probeActor, probeOpponent, probeBattle)?.costCe || 0);
}

const normalCeCost = runBloodAttackCostProbe(actor.maxCe, 10);
const overCapCeCost = runBloodAttackCostProbe(140, 20);
if (!(overCapCeCost > normalCeCost)) {
  throw new Error(`over-cap CE did not increase blood CE cost: normal=${normalCeCost}, overCap=${overCapCeCost}`);
}

const scaleBattle = {
  ...battle,
  round: 88,
  resourceState: { resourceLog: [], residualLog: [] },
  actionContexts: {},
  bloodManipulationState: {}
};
const scaleActor = { ...actor, hp: 100, maxHp: 100, ce: 100, maxCe: 100, statusEffects: [] };
const scaleOpponent = { ...opponent, hp: 100, ce: 100, statusEffects: [] };
scaleBattle.resourceState.p1 = scaleActor;
scaleBattle.resourceState.p2 = scaleOpponent;
globalThis.JJKDuelActions.configure({
  getDuelResourcePair: (_battle, side) => side === "left" ? scaleActor : scaleOpponent,
  getDuelBattle: () => scaleBattle
});
const scaleAction = {
  ...scaleJump,
  id: scaleJump.sourceActionId,
  label: scaleJump.name,
  effects: { ...(scaleJump.effects || {}) },
  bloodCeToBaseDamageScale: 0,
  bloodHpToBaseDamageScale: 0.9,
  bloodCeControlDamageScale: 0
};
const scaleResult = globalThis.JJKDuelActions.applyDuelActionEffect(scaleAction, scaleActor, scaleOpponent, scaleBattle);
if (Number(scaleResult?.bloodManipulation?.roundState?.blood || 0) !== 0) {
  throw new Error(`赤鳞跃动 HP cost should not add blood coefficient: ${scaleResult?.bloodManipulation?.roundState?.blood}`);
}
if (Number(scaleResult?.directDamage || 0) > 0 || Number(scaleOpponent.hp || 0) < Number(scaleOpponent.maxHp || 0)) {
  throw new Error(`赤鳞跃动 HP cost should not convert into damage: direct=${scaleResult?.directDamage || 0}, opponentHp=${scaleOpponent.hp}`);
}

console.log(`Blood conversion over-cap checks passed: hp=${actor.hp}, max=${actor.maxHp}, hpCost ${beforeHpCost} -> ${afterHpCost}, ceCost ${normalCeCost} -> ${overCapCeCost}`);
