import fs from "node:fs";

const api = fs.readFileSync("api/runtime-api.js", "utf8");
const core = fs.readFileSync("wheel/runtime-core.js", "utf8");
const ui = fs.readFileSync("UI/runtime-ui.js", "utf8");
const index = fs.readFileSync("index.html", "utf8");
const styles = fs.readFileSync("styles.css", "utf8");

const timeoutMatch = core.match(/const DUEL_AI_CHARACTER_TIMEOUT_MS = (\d+);/);
const timeout = Number(timeoutMatch?.[1] || 0);

const checks = [
  ["header values are URI encoded", api.includes("encodeAiGovernanceHeaderValue") && api.includes("X-JJK-Login-Card-Nickname")],
  ["card_prompt merged section headers stay ASCII", api.includes("Special hand rules:") && api.includes("Domain rules:") && api.includes("Return format constraints:")],
  ["AI character timeout is lengthened", timeout >= 420000],
  ["AI character progress elements exist", index.includes("duelAiProgress") && index.includes("duelAiProgressBar")],
  ["AI progress text is shown", index.includes("烧脑中。") && api.includes("烧脑中。")],
  ["AI progress has nonlinear timer", ui.includes("Math.pow(1 - t, 2.65)") && ui.includes("startDuelAiProgress") && ui.includes("stopDuelAiProgress")],
  ["AI progress is styled", styles.includes(".duel-ai-progress") && styles.includes("cubic-bezier")]
];

const failed = checks.filter(([, pass]) => !pass);
for (const [name, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}

if (failed.length) process.exit(1);
