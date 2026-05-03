import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runtime = readFileSync(new URL("../tool/runtime-fight.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

assert.match(runtime, /function getDuelDisplayGrade/);
assert.match(runtime, /profile\.officialGrade \|\| gradeLabel\(profile\.visibleGrade\)/);
assert.match(runtime, /duel-match-summary-card/);

assert.doesNotMatch(runtime, /computeDuelRates/);
assert.doesNotMatch(runtime, /duelDebugLeftRate|duelDebugRightRate/);
assert.doesNotMatch(runtime, /duel-live-rate|当前结算倾向|胜率：调试直填|胜率填/);

assert.doesNotMatch(html, /duelDebugLeftRate|duelDebugRightRate|我方胜率|对方胜率|胜率填/);
assert.doesNotMatch(css, /duel-rate|duel-live-rate/);

console.log("duel rating UI static checks passed");
