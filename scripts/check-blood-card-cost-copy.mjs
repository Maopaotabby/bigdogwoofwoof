import fs from "node:fs";

const cardTemplate = fs.readFileSync("modules/duel/duel-card-template.js", "utf8");

const checks = [
  {
    name: "blood card copy helper exists",
    pass: cardTemplate.includes("appendBloodManipulationCostCopy")
  },
  {
    name: "blood card copy reads ce and hp percent ratios",
    pass: cardTemplate.includes("bloodCeCostRatio") &&
      cardTemplate.includes("bloodHpCostRatio") &&
      cardTemplate.includes("0.08") &&
      cardTemplate.includes("0.055")
  },
  {
    name: "blood card short effect is enhanced before render",
    pass: cardTemplate.includes("shortEffect = appendBloodManipulationCostCopy")
  },
  {
    name: "blood card preview summary is enhanced",
    pass: cardTemplate.includes("summary = appendBloodManipulationCostCopy")
  },
  {
    name: "copy uses visible percent labels for both resources",
    pass: cardTemplate.includes("消耗咒力") &&
      cardTemplate.includes("最大体势")
  }
];

const failed = checks.filter((check) => !check.pass);
for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}`);
}

if (failed.length) {
  process.exitCode = 1;
}
