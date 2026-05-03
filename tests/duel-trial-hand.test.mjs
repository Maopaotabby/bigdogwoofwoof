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

function loadDuelRuleSubphase() {
  delete globalThis.JJKDuelRuleSubphase;
  const source = fs.readFileSync("modules/duel/duel-rule-subphase.js", "utf8");
  vm.runInThisContext(source, { filename: "modules/duel/duel-rule-subphase.js" });
  return globalThis.JJKDuelRuleSubphase;
}
function loadDuelCardTemplate() {
  delete globalThis.JJKDuelCardTemplate;
  const source = fs.readFileSync("modules/duel/duel-card-template.js", "utf8");
  vm.runInThisContext(source, { filename: "modules/duel/duel-card-template.js" });
  return globalThis.JJKDuelCardTemplate;
}

function loadDuelActions() {
  delete globalThis.JJKDuelActions;
  const source = fs.readFileSync("modules/duel/duel-actions.js", "utf8");
  vm.runInThisContext(source, { filename: "modules/duel/duel-actions.js" });
  return globalThis.JJKDuelActions;
}

test("trial hand refresh keeps predealt trial cards instead of rebuilding from the action pool", () => {
  const hand = loadDuelHand();
  const battle = {
    round: 0,
    domainSubPhase: {
      type: "trial",
      owner: "left",
      defender: "right",
      domainId: "higuruma_deadly_sentencing",
      canDefend: true,
      canRemainSilent: true,
      verdictResolved: false
    },
    handState: {
      left: {
        round: 1,
        cards: [
          { id: "present_evidence", handSource: "trial-replacement", domainClass: "rule_trial" },
          { id: "request_verdict", handSource: "trial-replacement", domainClass: "rule_trial" }
        ]
      },
      right: {
        round: 1,
        cards: [
          { id: "defend", handSource: "trial-replacement", domainClass: "rule_trial", tags: ["anti-trial"] },
          { id: "remain_silent", handSource: "trial-replacement", domainClass: "rule_trial", tags: ["anti-trial"] }
        ]
      }
    }
  };
  const owner = { side: "left", ce: 100, maxCe: 100 };
  const defender = { side: "right", ce: 100, maxCe: 100 };
  hand.configure({
    buildDuelActionPool: () => [{ id: "forced_output", label: "normal attack", effects: { outgoingScale: 1 } }],
    getDuelActionAvailability: () => ({ available: true, reason: "", costCe: 0 }),
    getDuelActionCost: () => 0
  });

  assert.deepEqual(hand.pickDuelHandCandidates(owner, defender, battle, 5).map((card) => card.id), ["present_evidence", "request_verdict"]);
  assert.deepEqual(hand.pickDuelHandCandidates(defender, owner, battle, 5).map((card) => card.id), ["defend", "remain_silent"]);
});

test("Ten Shadows Mahoraga ritual is in the same template action pool as Max Elephant", () => {
  const cardTemplate = loadDuelCardTemplate();
  const actions = loadDuelActions();
  const megumi = {
    id: "megumi_fushiguro_culling",
    characterId: "megumi_fushiguro_culling",
    name: "Megumi Fushiguro",
    side: "left",
    hp: 100,
    maxHp: 100,
    specialHandTags: ["ten_shadows"],
    techniqueFamilies: ["ten_shadows"]
  };
  const opponent = { side: "right", hp: 100, maxHp: 100 };
  const maxElephant = {
    cardId: "card_ten_shadows_max_elephant",
    sourceActionId: "ten_shadows_max_elephant",
    name: "Max Elephant",
    cardType: "summon",
    apCost: 2,
    baseCeCost: 42,
    tags: ["ten_shadows"],
    specialHandTags: ["ten_shadows"],
    playableInHandBeta: true,
    weight: 0.6
  };
  const ritual = {
    cardId: "card_ten_shadows_mahoraga_tuning_ritual",
    sourceActionId: "ten_shadows_mahoraga_tuning_ritual",
    name: "Mahoraga Tuning Ritual",
    cardType: "summon",
    apCost: 3,
    baseCeCost: 70,
    tags: ["ten_shadows"],
    specialHandTags: ["ten_shadows", "mahoraga_tuning_ritual"],
    playableInHandBeta: true,
    weight: 0.6,
    effectSummary: "Mahoraga proxy takes over."
  };
  const state = {
    duelCardTemplateRules: { cards: [maxElephant, ritual] },
    duelBattle: { round: 0 }
  };
  cardTemplate.configure({ state });
  actions.configure({
    state,
    getDuelActionRules: () => ({ templates: [] }),
    getDuelActionAvailability: () => ({ available: true, reason: "", costCe: 0 }),
    getDuelActionCost: () => 0,
    getDuelProfileForSide: () => ({}),
    getDuelDomainResponseProfile: () => ({ allowedDomainResponseActions: [] }),
    isDuelOpponentDomainThreat: () => false,
    hashDuelSeed: () => 0,
    clamp: (value, min, max) => Math.max(min, Math.min(max, value))
  });

  const pool = actions.buildDuelActionPool(megumi, opponent, state.duelBattle);
  const ids = pool.map((action) => action.id);

  assert.ok(ids.includes("ten_shadows_max_elephant"));
  assert.ok(ids.includes("ten_shadows_mahoraga_tuning_ritual"));
  assert.equal(pool.find((action) => action.id === "ten_shadows_mahoraga_tuning_ritual").type, "card_template_runtime");
});
test("Higuruma domain activation clears both hands and deals trial cards to both sides", () => {
  const rule = loadDuelRuleSubphase();
  const owner = { side: "left", name: "Higuruma", ce: 100, maxCe: 100, domain: {} };
  const defender = { side: "right", name: "target", ce: 100, maxCe: 100, domain: {} };
  const profile = {
    id: "higuruma_deadly_sentencing",
    domainClass: "rule_trial",
    domainName: "Deadly Sentencing",
    domainActions: [
      { id: "present_evidence", label: "present evidence", role: "prosecution", effects: { evidencePressureDelta: 2 } },
      { id: "request_verdict", label: "request verdict", role: "prosecution", effects: { requestVerdict: true } }
    ],
    opponentActions: [
      { id: "defend", label: "defend", role: "defense", effects: { defensePressureDelta: 1 } },
      { id: "remain_silent", label: "remain silent", role: "defense", effects: { selfIncriminationRiskDelta: -0.6 } }
    ]
  };
  const battle = {
    round: 0,
    handState: {
      left: { round: 1, cards: [{ id: "old_left" }] },
      right: { round: 1, cards: [{ id: "old_right" }] }
    }
  };
  rule.configure({
    getDuelProfileForSide: (_battle, side) => side === "right" ? { trialSubjectType: "human" } : {},
    getDuelResourcePair: (_battle, side) => side === "left" ? owner : defender,
    clampDuelResource: (resource) => resource,
    invalidateDuelActionChoices: () => {}
  });

  rule.createDuelTrialSubPhase(profile, owner, defender, battle);

  assert.deepEqual(battle.handState.left.cards.map((card) => card.id), ["present_evidence", "request_verdict"]);
  assert.deepEqual(battle.handState.right.cards.map((card) => card.id), ["defend", "remain_silent"]);
  assert.equal(battle.handState.right.cards[0].tags.length, 1);
  assert.equal(battle.handState.left.cards[0].handSource, "trial-replacement");
  assert.equal(battle.handState.right.cards[0].handSource, "trial-replacement");
});

test("Higuruma still deals anti-trial cards to special target types", () => {
  const rule = loadDuelRuleSubphase();
  const owner = { side: "left", name: "Higuruma", ce: 100, maxCe: 100, domain: {} };
  const defender = { side: "right", name: "shikigami", ce: 100, maxCe: 100, domain: {} };
  const profile = {
    id: "higuruma_deadly_sentencing",
    domainClass: "rule_trial",
    domainName: "Deadly Sentencing",
    domainActions: [{ id: "present_evidence", label: "present evidence", role: "prosecution", effects: { evidencePressureDelta: 2 } }],
    opponentActions: [
      { id: "defend", label: "defend", role: "defense", effects: { defensePressureDelta: 1 } },
      { id: "remain_silent", label: "remain silent", role: "defense", effects: { selfIncriminationRiskDelta: -0.6 } }
    ]
  };
  const battle = { round: 0, handState: { left: { round: 1, cards: [{ id: "old_left" }] }, right: { round: 1, cards: [{ id: "old_right" }] } } };
  rule.configure({
    getDuelProfileForSide: (_battle, side) => side === "right" ? { trialSubjectType: "shikigami" } : {},
    getDuelResourcePair: (_battle, side) => side === "left" ? owner : defender,
    clampDuelResource: (resource) => resource,
    invalidateDuelActionChoices: () => {}
  });

  rule.createDuelTrialSubPhase(profile, owner, defender, battle);

  assert.deepEqual(battle.handState.right.cards.map((card) => card.id), ["defend", "remain_silent"]);
});

test("trial hand refresh rebuilds trial cards after the round changes", () => {
  const hand = loadDuelHand();
  const profile = {
    id: "higuruma_deadly_sentencing",
    domainClass: "rule_trial",
    domainName: "Deadly Sentencing",
    opponentActions: [
      { id: "defend", label: "defend", role: "defense", effects: { defensePressureDelta: 1 } },
      { id: "remain_silent", label: "remain silent", role: "defense", effects: { selfIncriminationRiskDelta: -0.6 } }
    ]
  };
  const battle = {
    round: 1,
    domainSubPhase: {
      type: "trial",
      owner: "left",
      defender: "right",
      domainId: "higuruma_deadly_sentencing",
      domainName: "Deadly Sentencing",
      trialEligibility: "full",
      canDefend: true,
      canRemainSilent: true,
      verdictResolved: false
    },
    domainProfileStates: { left: { ownerSide: "left", profile } },
    handState: {
      right: {
        round: 1,
        cards: [{ id: "defend", handSource: "trial-replacement", domainClass: "rule_trial" }]
      }
    }
  };
  const defender = { side: "right", ce: 100, maxCe: 100 };
  const owner = { side: "left", ce: 100, maxCe: 100 };
  hand.configure({
    buildDuelActionPool: () => [{ id: "forced_output", label: "normal attack", effects: { outgoingScale: 1 } }],
    getDuelActionAvailability: () => ({ available: true, reason: "", costCe: 0 }),
    getDuelActionCost: () => 0
  });

  const cards = hand.pickDuelHandCandidates(defender, owner, battle, 5);

  assert.deepEqual(cards.map((card) => card.id), ["defend", "remain_silent"]);
  assert.equal(battle.handState.right.round, 2);
});

test("Higuruma receives execution sword at a lower verdict pressure", () => {
  const rule = loadDuelRuleSubphase();
  const owner = { side: "left", name: "Higuruma", ce: 100, maxCe: 100, domain: {} };
  const defender = { side: "right", name: "target", ce: 100, maxCe: 100, domain: {} };
  const battle = {
    round: 0,
    handState: { left: { round: 1, cards: [] }, right: { round: 1, cards: [] } },
    domainSubPhase: {
      type: "trial",
      owner: "left",
      defender: "right",
      domainId: "higuruma_deadly_sentencing",
      domainName: "Deadly Sentencing",
      trialEligibility: "full",
      verdictVocabulary: "legal",
      verdictLabels: { insufficient: "insufficient", light: "light", confiscation: "confiscation", execution: "execution" },
      trialSubjectType: "human",
      hasLegalAgency: true,
      hasSelfAwareness: true,
      evidencePressure: 5.2,
      defensePressure: 0,
      heavyVerdictRisk: 0,
      selfIncriminationRisk: 0,
      verdictResolved: false
    }
  };
  rule.configure({
    getDuelResourcePair: (_battle, side) => side === "left" ? owner : defender,
    clampDuelResource: (resource) => resource,
    invalidateDuelActionChoices: () => {}
  });

  const result = rule.resolveDuelTrialVerdict({ id: "request_verdict", label: "request verdict" }, owner, defender, battle, {
    evidencePressure: 5.2,
    defensePressure: 0
  });

  assert.equal(result.trial.verdictKey, "execution");
  assert.equal(battle.handState.left.cards[0].id, "execution_sword");
});

test("Higuruma anti-trial profile actions are tagged as anti-trial", () => {
  const data = JSON.parse(fs.readFileSync("data/duel-domain-profiles-v0.1-candidate.json", "utf8"));
  const profiles = Array.isArray(data) ? data : (data.profiles || data.domainProfiles || []);
  const profile = profiles.find((item) => item.id === "higuruma_deadly_sentencing");
  const ids = ["defend", "remain_silent", "deny_charge", "challenge_evidence", "delay_trial"];
  const tagsById = Object.fromEntries((profile.opponentActions || []).map((action) => [action.id, action.tags]));

  for (const id of ids) {
    assert.equal(tagsById[id]?.length, 1);
  }
});

