import fs from "node:fs";

const server = fs.readFileSync("server/lighthouse-server.js", "utf8");
const api = fs.readFileSync("api/runtime-api.js", "utf8");

const checks = [
  {
    name: "AI request dedupe has a short TTL instead of permanent request keys",
    pass:
      server.includes("AI_REQUEST_DEDUPE_TTL_MS") &&
      server.includes("pruneAiRequestKeys") &&
      server.includes("now - at > AI_REQUEST_DEDUPE_TTL_MS") &&
      server.includes("retryAfterMs")
  },
  {
    name: "failed AI requests release their request key for retry",
    pass:
      server.includes("delete state.requestKeys[identity.requestKey]") &&
      server.includes('status: "completed"')
  },
  {
    name: "default high-frequency window allows a few retries per minute",
    pass:
      server.includes("AI_HIGH_FREQUENCY_WINDOW_MS || 60000") &&
      server.includes("AI_HIGH_FREQUENCY_LIMIT || 3")
  },
  {
    name: "frontend explains duplicate request as short dedupe wait",
    pass:
      api.includes('reasonCode = "duplicate-request"') &&
      api.includes("相同请求刚提交过或仍在处理中")
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error("AI dedupe window checks failed:");
  for (const check of failed) console.error(`- ${check.name}`);
  process.exit(1);
}

console.log(`AI dedupe window checks passed: ${checks.length}`);
