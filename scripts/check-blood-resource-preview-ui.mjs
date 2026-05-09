import fs from "node:fs";

const runtimeFight = fs.readFileSync("tool/runtime-fight.js", "utf8");
const styles = fs.readFileSync("styles.css", "utf8");

const checks = [
  ["selected resource preview helper exists", runtimeFight.includes("function getDuelSelectedResourcePreview")],
  ["preview reads selected hand actions", runtimeFight.includes("getDuelSelectedHandActions(battle, resource.side)")],
  ["preview supports CE to HP conversion", runtimeFight.includes('action.bloodConversion === "ce_to_hp"')],
  ["preview supports HP to CE conversion", runtimeFight.includes('action.bloodConversion === "hp_to_ce"')],
  ["resource bar displays preview arrow", runtimeFight.includes("→") && runtimeFight.includes("preview-value")],
  ["resource bar styles preview changed segment", styles.includes("preview-loss") && styles.includes("preview-gain")]
];

const failed = checks.filter(([, pass]) => !pass);
for (const [name, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}

if (failed.length) process.exit(1);
