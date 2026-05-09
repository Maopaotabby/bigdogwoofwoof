import fs from "node:fs";

const runtimeFight = fs.readFileSync("tool/runtime-fight.js", "utf8");
const duelActions = fs.readFileSync("modules/duel/duel-actions.js", "utf8");
const styles = fs.readFileSync("styles.css", "utf8");
const index = fs.readFileSync("index.html", "utf8");

const statusBody = runtimeFight.match(/function renderDuelBattleStatus\(battle\) \{[\s\S]*?\n\}/)?.[0] || "";

const checks = [
  {
    name: "generic counter window can render by side",
    pass: runtimeFight.includes("function renderDuelBattleSpecialCounterWindow(battle, side = \"\")") &&
      runtimeFight.includes("renderDuelBattleSpecialCounterWindow(battle, resource.side)")
  },
  {
    name: "battle top status no longer renders both sides' counters together",
    pass: !statusBody.includes("renderDuelBattleSpecialCounterWindow")
  },
  {
    name: "runtime reads generic duel special counter state",
    pass: runtimeFight.includes("getDuelSpecialCounterEntries") &&
      runtimeFight.includes("duelSpecialCounterState")
  },
  {
    name: "blood manipulation exposes pierce and blood counter labels",
    pass: duelActions.includes('label: "穿"') && duelActions.includes('label: "血"')
  },
  {
    name: "blood counters are stored in the generic state container",
    pass: duelActions.includes("duelSpecialCounterState") &&
      duelActions.includes("blood_manipulation")
  },
  {
    name: "counter window has dedicated styling",
    pass: styles.includes(".duel-battle-special-counters") &&
      styles.includes(".duel-special-counter-chip") &&
      styles.includes(".duel-special-counter-row.no-label")
  },
  {
    name: "announcement mentions the blood manipulation update",
    pass: index.includes("赤血操术") && index.includes("穿") && index.includes("血")
  }
];

const failed = checks.filter((check) => !check.pass);
for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}`);
}

if (failed.length) {
  process.exitCode = 1;
}
