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
  /var damage\s*=\s*Math\.min\(36,\s*Math\.max\(3,\s*Math\.round\(rawDamage\s*\*\s*0\.35\)\)\)/,
  "Summoned unit baseDamage should produce visible automatic assist damage."
);

assert.match(
  actions,
  /summonUpkeep:\s*summonUpkeepResult\s*\|\|\s*undefined/,
  "Action results should expose summon upkeep feedback."
);

console.log("Summon unit combat regression checks passed.");
