import fs from "node:fs";

const fightSource = fs.readFileSync("tool/runtime-fight.js", "utf8");
const skinCss = fs.readFileSync("assets/duel-dynamics/duel-card-dynamics.css", "utf8");

const renderStart = fightSource.indexOf("function renderDuelActionChoice(");
const renderEnd = fightSource.indexOf("function renderDuel", renderStart + 1);
const renderBlock = fightSource.slice(renderStart, renderEnd);

const checks = [
  {
    name: "battle cards carry current card skin mode class at render time",
    pass:
      renderBlock.includes("const visualSettings = getDuelVisualSettingsSnapshot();") &&
      renderBlock.includes("const cardSkinClass = ` duel-card-skin-${visualSettings.cardSkin}`;") &&
      renderBlock.includes("${cardSkinClass}")
  },
  {
    name: "battle cards carry skin category class at render time",
    pass:
      renderBlock.includes("const skinCategory = getDuelCardSkinCategory(view, action);") &&
      renderBlock.includes("const skinClass = ` duel-skin-${skinCategory}`;") &&
      renderBlock.includes("${skinClass}")
  }
];

const v3ButtonReset = skinCss.lastIndexOf("body button,\nbody .button,\nbody .primary");
const v3BadgeReset = skinCss.lastIndexOf("body :is(.badge, .duel-chip, .duel-action-cost");
const finalSkinOverride = skinCss.lastIndexOf("/* Battle hand card skin restore");
checks.push({
  name: "skin restore css wins over late V3 reset rules",
  pass:
    finalSkinOverride > -1 &&
    finalSkinOverride > v3ButtonReset &&
    finalSkinOverride > v3BadgeReset &&
    skinCss.slice(finalSkinOverride).includes("body:is(.duel-card-skin-v224, .duel-card-skin-custom, .duel-card-skin-champion-kashimo)") &&
    skinCss.slice(finalSkinOverride).includes(".duel-card-skin-champion-kashimo") &&
    skinCss.slice(finalSkinOverride).includes("background: var(--card-skin-bg) !important")
});

const finalRestoreBlock = skinCss.slice(finalSkinOverride);
const championBeforeStart = finalRestoreBlock.indexOf("body.duel-card-skin-champion-kashimo .duel-hand-card .duel-action-choice::before");
const championBeforeEnd = finalRestoreBlock.indexOf("body.duel-card-skin-champion-kashimo .duel-hand-card .duel-action-choice::after", championBeforeStart);
const championBeforeBlock = championBeforeStart > -1 ? finalRestoreBlock.slice(championBeforeStart, championBeforeEnd) : "";
checks.push({
  name: "champion kashimo battle skin has its own final face and no vertical scanline repeat",
  pass:
    finalRestoreBlock.includes("body.duel-card-skin-champion-kashimo .duel-hand-card.duel-skin-template") &&
    finalRestoreBlock.includes(".duel-hand-card.duel-card-skin-champion-kashimo .duel-action-choice::after") &&
    championBeforeBlock.includes("linear-gradient(150deg") &&
    !championBeforeBlock.includes("repeating-linear-gradient(90deg")
});

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error("Duel card skin checks failed:");
  for (const check of failed) console.error(`- ${check.name}`);
  process.exit(1);
}

console.log(`Duel card skin checks passed: ${checks.length}`);
