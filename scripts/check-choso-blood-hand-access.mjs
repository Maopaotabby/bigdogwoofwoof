import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const choso = readJson("character/胀相（涩谷／死灭）.json");

for (const file of [
  "modules/duel/duel-card-template.js",
  "modules/duel/duel-actions.js",
  "modules/duel/duel-hand.js"
]) {
  vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file });
}

const battle = {
  round: 0,
  resourceState: {},
  actionContexts: {},
  handState: {},
  selectedHandActions: {},
  actionPoints: {}
};

const actor = {
  ...choso,
  id: choso.characterId,
  profileId: choso.characterId,
  side: "left",
  hp: 140,
  maxHp: 140,
  ce: 120,
  maxCe: 120,
  statusEffects: [],
  characterCardProfile: choso
};
const opponent = {
  id: "dummy_target",
  side: "right",
  hp: 140,
  maxHp: 140,
  ce: 100,
  maxCe: 100,
  statusEffects: [],
  characterCardProfile: { characterId: "dummy_target", displayName: "Dummy Target" }
};
battle.resourceState.left = actor;
battle.resourceState.right = opponent;

const noop = () => {};
globalThis.JJKDuelActions.configure({
  state: { customDuelCards: [] },
  getDuelActionRules: () => ({ templates: [] }),
  getDuelMechanicTemplateRules: () => ({ mechanics: [] }),
  getDuelProfileForSide: (_battle, side) => side === "left" ? choso : opponent.characterCardProfile,
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
  getDuelResourcePair: () => ({ resource: actor }),
  clampDuelResource: noop,
  appendDuelActionLog: noop,
  recordDuelResourceChange: noop,
  getDuelResourceSideLabel: (side) => side,
  formatSignedDuelDelta: (value) => String(value)
});

globalThis.JJKDuelHand.configure({
  state: { customDuelCards: [] },
  getDuelBattle: () => battle,
  buildDuelActionPool: globalThis.JJKDuelActions.buildDuelActionPool,
  pickDuelActionChoices: null,
  getDuelActionAvailability: globalThis.JJKDuelActions.getDuelActionAvailability,
  getDuelCardTemplateForAction: globalThis.JJKDuelCardTemplate.getDuelCardTemplateForAction,
  buildDuelCardViewModel: globalThis.JJKDuelCardTemplate.buildDuelCardViewModel,
  applyDuelActionEffect: globalThis.JJKDuelActions.applyDuelActionEffect,
  getDuelActionCost: globalThis.JJKDuelActions.getDuelActionCost,
  getDuelResourcePair: () => ({ resource: actor }),
  clampDuelResource: noop,
  appendDuelActionLog: noop,
  recordDuelResourceChange: noop
});

const pool = globalThis.JJKDuelActions.buildDuelActionPool(actor, opponent, battle);
const ids = new Set(pool.map((action) => action.id));
const hand = globalThis.JJKDuelHand.pickDuelHandCandidates(actor, opponent, battle, 8);
const handIds = new Set(hand.map((candidate) => candidate.id || candidate.actionId));

const required = ["blood_ce_to_hp", "blood_hp_to_ce"];
const missingFromPool = required.filter((id) => !ids.has(id));
const missingFromHand = required.filter((id) => !handIds.has(id));

if (!Array.isArray(choso.specialHandTags) || !choso.specialHandTags.includes("blood_manipulation")) {
  throw new Error("Choso character JSON does not declare blood_manipulation specialHandTags.");
}

if (missingFromPool.length || missingFromHand.length) {
  throw new Error([
    missingFromPool.length ? `Missing from action pool: ${missingFromPool.join(", ")}` : "",
    missingFromHand.length ? `Missing from hand: ${missingFromHand.join(", ")}` : ""
  ].filter(Boolean).join("; "));
}

console.log("Choso blood manipulation hand access checks passed.");
