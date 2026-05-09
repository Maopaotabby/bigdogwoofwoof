import fs from "node:fs";

const runtimeFight = fs.readFileSync("tool/runtime-fight.js", "utf8");
const api = fs.readFileSync("api/runtime-api.js", "utf8");
const index = fs.readFileSync("index.html", "utf8");

const expectedTypes = ["attack", "technique", "ce_burst", "defense", "domain", "support", "resource", "counter", "rule", "soul_pressure"];
const checks = [
  ["default custom hand type label map exists", runtimeFight.includes("const defaultLabels = {")],
  ["expected card types are offered", expectedTypes.every((type) => runtimeFight.includes(`${type}:`))],
  ["options render English tag before Chinese translation", runtimeFight.includes("${escapeHtml(type)}（${escapeHtml(labels[type] || type)}）")],
  ["AI generated card allowed types stay consistent", expectedTypes.every((type) => api.includes(`\"${type}\"`) || api.includes(`'${type}'`))],
  ["HTML editor shows CE cost and hides legacy AP cost", index.includes("CE（咒力）消耗") && !index.includes("AP（行动点）消耗")]
];

const failed = checks.filter(([, pass]) => !pass);
for (const [name, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}

if (failed.length) process.exit(1);
