import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const actions = readFileSync(new URL("../modules/duel/duel-actions.js", import.meta.url), "utf8");

assert.match(
  actions,
  /function applyDuelSummonUpkeep/,
  "Summoned units should have battle-layer upkeep, not only preview text."
);

assert.match(
  actions,
  /maintenanceCeCost:\s*Math\.max\(1/,
  "Summoned units should store a positive maintenance CE cost."
);

assert.match(
  actions,
  /actor\.ce\s*=\s*Number\(\(beforeCe\s*-\s*cost\)\.toFixed\(1\)\)/,
  "Summon upkeep should actually consume the controller's CE."
);

assert.match(
  actions,
  /unit\.active\s*=\s*false;\s*[\s\S]*?maintenance-ce-shortage/,
  "Summoned units should leave the field when their controller cannot maintain them."
);

assert.match(
  actions,
  /guardRules\.protectOwner\s*=\s*guardRules\.protectOwner\s*!==\s*false/,
  "Friendly controlled summoned units should default to protecting their owner."
);

assert.match(
  actions,
  /guardRules\.interceptsOpponentAttacks\s*=\s*guardRules\.interceptsOpponentAttacks\s*!==\s*false/,
  "Friendly controlled summoned units should default to intercepting opponent attacks."
);

assert.match(
  actions,
  /function resolveDuelSummonUnitAttack/,
  "Summoned units should resolve independent attack events."
);

assert.match(
  actions,
  /var damage\s*=\s*Math\.round\(baseDamage\s*\*\s*Math\.max\(0,\s*Number\(profile\.damageScale\s*\|\|\s*1\)\)\)/,
  "Summoned unit attacks should start from full baseDamage instead of reduced pooled assist damage."
);

assert.match(
  actions,
  /calculateDuelSummonUnitHitRate/,
  "Summoned unit attacks should use the unit's own hit profile."
);

assert.match(
  actions,
  /resolveDuelDamageTarget\(action,\s*actor,\s*opponent,\s*battle,\s*{\s*damage:\s*evaded\s*\?\s*0\s*:\s*damage,\s*summonUnitAttack:\s*true\s*}\)/,
  "Summoned unit attacks should still respect battlefield target and guard interception."
);

assert.match(
  actions,
  /attacks:\s*attacks\.slice\(0,\s*12\)/,
  "Summon assist result should expose each independent summon attack."
);

assert.match(
  actions,
  /summonUpkeep:\s*summonUpkeepResult\s*\|\|\s*undefined/,
  "Action results should expose summon upkeep feedback."
);

assert.match(
  actions,
  /var passSummonAssistResult\s*=\s*applyDuelSummonAssist\(actor,\s*opponent,\s*battle\)/,
  "Passing a turn should still trigger controlled summon attacks for that round."
);

assert.match(
  actions,
  /summonAssist:\s*passSummonAssistResult\s*\|\|\s*undefined/,
  "Pass results should expose summon attack events."
);

console.log("Summon unit combat regression checks passed.");
