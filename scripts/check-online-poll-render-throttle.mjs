import fs from "node:fs";

const source = fs.readFileSync("modules/online.js", "utf8");
const startPolling = source.match(/function startPolling\(roomId, side\) \{[\s\S]*?\n\}/)?.[0] || "";

const checks = [
  ["poll render key exists", source.includes("let lastPollRenderKey") && source.includes("function buildOnlineRoomRenderKey")],
  ["poll render skip exists", source.includes("function renderPolledRoom") && source.includes("key === lastPollRenderKey")],
  ["poll does not render every response directly", !startPolling.includes(".then(render)")],
  ["next poll is scheduled after request completion", startPolling.includes(".finally(() =>")],
  ["poll render key resets on stop", source.includes('lastPollRenderKey = "";')]
];

const failed = checks.filter(([, pass]) => !pass);
for (const [name, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}

if (failed.length) process.exit(1);
