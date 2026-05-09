import fs from "node:fs";

const fight = fs.readFileSync("tool/runtime-fight.js", "utf8");
const styles = fs.readFileSync("styles.css", "utf8");
const skin = fs.readFileSync("assets/duel-dynamics/duel-card-dynamics.css", "utf8");

const checks = [
  [
    "duel mode render requests can be coalesced into animation frames",
    fight.includes("let duelModeRenderFrame = 0") &&
      fight.includes("function requestDuelModeRender") &&
      fight.includes("window.requestAnimationFrame") &&
      fight.includes("requestDuelModeRender();")
  ],
  [
    "mobile portrait hand choices use a dedicated stacked layout",
    styles.includes("@media (max-width: 640px) and (orientation: portrait)") &&
      styles.includes(".duel-hand-choices") &&
      styles.includes("grid-template-columns: 1fr") &&
      styles.includes(".duel-hand-card:not(.active):not(:focus-within)")
  ],
  [
    "mobile compact cards keep card skin visuals instead of flattening them",
    styles.includes("body.duel-card-skin-v224 .duel-hand-card .duel-action-choice::before") &&
      styles.includes("display: block !important") &&
      skin.includes("body.duel-card-skin-v224 .duel-hand-card .duel-action-choice::before")
  ],
  [
    "mobile action panel is paint-contained without lazy viewport rendering",
    styles.includes("contain: layout paint") &&
      styles.includes("overflow-anchor: none") &&
      !styles.includes("content-visibility: auto") &&
      !styles.includes("contain-intrinsic-size")
  ]
];

let failed = false;
for (const [name, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
  if (!pass) failed = true;
}

if (failed) process.exit(1);
