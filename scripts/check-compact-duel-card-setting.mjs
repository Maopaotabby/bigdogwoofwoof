import fs from "node:fs";

const html = fs.readFileSync("index.html", "utf8");
const core = fs.readFileSync("wheel/runtime-core.js", "utf8");
const fight = fs.readFileSync("tool/runtime-fight.js", "utf8");
const styles = fs.readFileSync("styles.css", "utf8");

const checks = [
  [
    "settings expose compact hand card toggle",
    html.includes("duelCompactCardToggle") &&
      html.includes("启用简洁卡面")
  ],
  [
    "compact hand card setting is persisted and applied to body",
    core.includes("compactCards") &&
      core.includes("duelCompactCardToggle") &&
      core.includes('classList.toggle("duel-compact-cards"')
  ],
  [
    "compact cards show attack and cursed energy instead of AP",
    fight.includes("function getDuelCompactAttackValue") &&
      fight.includes("duel-action-compact-stats") &&
      fight.includes("攻击") &&
      fight.includes("咒力") &&
      !fight.includes('<span class="duel-action-cost">AP ')
  ],
  [
    "turn execution control renders below hand card lists",
    fight.indexOf('class="duel-action-choices duel-hand-choices"') < fight.indexOf("${renderDuelTurnExecuteControl(battle)}") &&
      fight.indexOf("${renderDuelTurnExecuteControl(battle)}") > fight.indexOf("duel-domain-hand-choices")
  ],
  [
    "compact card CSS only affects unselected cards, selected cards return to original",
    styles.includes("body.duel-compact-cards .duel-hand-card:not(.active):not(:focus-within) .duel-action-choice") &&
      styles.includes(".duel-action-compact-stats") &&
      styles.includes("body.duel-compact-cards .duel-hand-card:not(.active):not(:focus-within)") &&
      !styles.includes("body.duel-compact-cards .duel-action-choice {") &&
      !styles.includes("body.duel-compact-cards .duel-hand-card.active .duel-action-choice") &&
      !styles.includes("content-visibility: auto")
  ]
];

let failed = false;
for (const [name, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
  if (!pass) failed = true;
}

if (failed) process.exit(1);
