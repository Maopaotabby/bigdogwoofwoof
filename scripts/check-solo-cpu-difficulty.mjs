import fs from "node:fs";

const html = fs.readFileSync("index.html", "utf8");
const runtimeCore = fs.readFileSync("wheel/runtime-core.js", "utf8");
const runtimeFight = fs.readFileSync("tool/runtime-fight.js", "utf8");
const duelHand = fs.readFileSync("modules/duel/duel-hand.js", "utf8");
const handRules = JSON.parse(fs.readFileSync("data/duel-hand-rules-v0.1-candidate.json", "utf8"));

const checks = [
  {
    name: "solo page exposes a CPU difficulty selector",
    pass:
      html.includes('id="duelCpuDifficultySelect"') &&
      html.includes('value="easy"') &&
      html.includes('value="normal" selected') &&
      html.includes('value="hard"')
  },
  {
    name: "runtime stores and syncs selected CPU difficulty",
    pass:
      runtimeCore.includes("duelCpuDifficulty: \"normal\"") &&
      runtimeCore.includes("DUEL_CPU_DIFFICULTY_STORAGE_KEY") &&
      runtimeCore.includes("updateDuelCpuDifficultyFromControls") &&
      runtimeCore.includes("duelCpuDifficultySelect")
  },
  {
    name: "solo battle snapshots the selected CPU difficulty",
    pass:
      runtimeFight.includes("const cpuDifficulty = mode === \"solo\"") &&
      runtimeFight.includes("cpuDifficultyLabel") &&
      runtimeFight.includes("电脑难度：") &&
      runtimeFight.includes("difficulty: activeBattle.cpuDifficulty")
  },
  {
    name: "CPU planner maps difficulty to beam width, noise, and mistake rate",
    pass:
      duelHand.includes("getDuelCpuDifficultyConfig") &&
      duelHand.includes("beamWidth: 1") &&
      duelHand.includes("beamWidth: 3") &&
      duelHand.includes("beamWidth: 5") &&
      duelHand.includes("scoreNoise") &&
      duelHand.includes("mistakeRate") &&
      duelHand.includes("mistakeApplied")
  },
  {
    name: "hand rules file documents CPU difficulty parameters",
    pass:
      handRules.cpuDifficulty?.default === "normal" &&
      handRules.cpuDifficulty?.options?.easy?.beamWidth === 1 &&
      handRules.cpuDifficulty?.options?.normal?.beamWidth === 3 &&
      handRules.cpuDifficulty?.options?.hard?.beamWidth === 5
  },
  {
    name: "update announcement mentions CPU difficulty",
    pass:
      html.includes("单人对战新增电脑难度选择") &&
      html.includes("困难使用更宽的 Beam Search")
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error("Solo CPU difficulty checks failed:");
  for (const check of failed) console.error(`- ${check.name}`);
  process.exit(1);
}

console.log(`Solo CPU difficulty checks passed: ${checks.length}`);
