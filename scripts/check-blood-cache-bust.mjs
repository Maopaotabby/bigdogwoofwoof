import fs from "node:fs";

const index = fs.readFileSync("index.html", "utf8");
const main = fs.readFileSync("modules/main.js", "utf8");
const fight = fs.readFileSync("modules/fight.js", "utf8");
const runtimeCore = fs.readFileSync("wheel/runtime-core.js", "utf8");

const expectedVersion = "V3.1.5-tutorial-title-20260509";
const checks = [
  {
    name: "index loads fresh main entry",
    pass: index.includes(`modules/main.js?v=${expectedVersion}`)
  },
  {
    name: "main build version is bumped for runtime/data cache",
    pass: main.includes(`const APP_BUILD_VERSION = "${expectedVersion}"`)
  },
  {
    name: "runtime core build version is bumped for character cache",
    pass: runtimeCore.includes(`const APP_BUILD_VERSION = "${expectedVersion}"`)
  },
  {
    name: "fight module imports duel actions with fresh blood cache key",
    pass: fight.includes(`./duel/duel-actions.js?v=${expectedVersion}`)
  },
  {
    name: "fight module imports duel hand with fresh blood cache key",
    pass: fight.includes(`./duel/duel-hand.js?v=${expectedVersion}`)
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error("Blood cache-bust checks failed:");
  failed.forEach((check) => console.error("- " + check.name));
  process.exit(1);
}

console.log("Blood cache-bust checks passed.");



