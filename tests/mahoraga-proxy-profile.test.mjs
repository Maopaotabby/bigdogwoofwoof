import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const actions = readFileSync(new URL("../modules/duel/duel-actions.js", import.meta.url), "utf8");

assert.match(
  actions,
  /MAHORAGA_PROXY_BASE_RAW/,
  "Mahoraga proxy should define its own raw attribute profile."
);

assert.match(
  actions,
  /martialScore:\s*8\.8/,
  "Mahoraga proxy should have an independent martialScore for hit/evasion checks."
);

assert.match(
  actions,
  /bodyScore:\s*8\.8/,
  "Mahoraga proxy should have an independent bodyScore instead of inheriting the summoner."
);

assert.match(
  actions,
  /raw:\s*{\s*\.\.\.MAHORAGA_PROXY_BASE_RAW\s*}/,
  "Mahoraga proxy profile should override inherited raw stats."
);

assert.match(
  actions,
  /axes:\s*{\s*\.\.\.MAHORAGA_PROXY_AXES\s*}/,
  "Mahoraga proxy profile should override inherited axes."
);

assert.match(
  actions,
  /actor\.characterCardProfile\s*=\s*proxyProfile/,
  "Activated Mahoraga proxy should replace the actor battle profile."
);

assert.match(
  actions,
  /actor\.raw\s*=\s*{\s*\.\.\.proxyProfile\.raw\s*}/,
  "Activated Mahoraga proxy should expose its independent raw stats on the actor resource."
);

assert.doesNotMatch(
  actions,
  /value:\s*Math\.max\(Number\(original\?\.combatPowerUnit\?\.value\s*\|\|\s*0\),\s*300\)/,
  "Mahoraga proxy combat unit should not be derived from the summoner profile."
);

console.log("Mahoraga proxy profile regression checks passed.");
