import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const flow = readFileSync(new URL("../wheel/runtime-flow.js", import.meta.url), "utf8");
const characterStrength = readFileSync(new URL("../modules/character/character-strength.js", import.meta.url), "utf8");
const strengthConfig = JSON.parse(readFileSync(new URL("../data/strength-v0.2-candidate.json", import.meta.url), "utf8"));

const ranges = strengthConfig.deterministicGradeRanges.ranges;
const byGrade = Object.fromEntries(ranges.map((range) => [range.grade, range]));

assert.equal(byGrade.grade1.min, 4.6);
assert.equal(byGrade.grade1.max, 6.8);
assert.equal(byGrade.semiSpecialGrade1.min, 6.8);
assert.equal(byGrade.semiSpecialGrade1.max, 8.6);
assert.equal(byGrade.specialGrade.min, 8.6);

assert.match(flow, /scores\.highCounts\.aPlus \* 0\.08/);
assert.doesNotMatch(flow, /scores\.highCounts\.aPlus \* 0\.20/);
assert.match(characterStrength, /grade: "grade1", min: 4\.6, max: 6\.8/);
assert.match(characterStrength, /grade: "specialGrade", min: 8\.6, max: null/);

const aAverageEffectiveScore = 5 + 6 * 0.08;
assert.ok(aAverageEffectiveScore >= byGrade.grade1.min);
assert.ok(aAverageEffectiveScore < byGrade.grade1.max);

console.log("grade balance anchor checks passed");
