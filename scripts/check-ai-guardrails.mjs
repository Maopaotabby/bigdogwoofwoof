import fs from "node:fs";

const server = fs.readFileSync("server/lighthouse-server.js", "utf8");
const api = fs.readFileSync("api/runtime-api.js", "utf8");
const builder = fs.readFileSync("modules/api/ai-prompt-builder.js", "utf8");

const checks = [
  {
    name: "server exposes governed AI proxy with login-card logs",
    pass:
      server.includes("AI_REQUEST_LOG_FILE") &&
      server.includes("handleAiProviderProxy") &&
      server.includes("appendAiRequestLog") &&
      server.includes("/api/ai-logs")
  },
  {
    name: "server blocks blacklisted login-card IPs with required message",
    pass:
      server.includes("AI讨厌你，拒绝了连接。") &&
      server.includes("blockedAiIps") &&
      server.includes("isAiIdentityBlocked")
  },
  {
    name: "server enforces per-card daily category quota",
    pass:
      server.includes("AI_DAILY_CATEGORY_LIMIT") &&
      server.includes("assertAiQuotaAvailable") &&
      server.includes("x-jjk-ai-usage-kind") &&
      server.includes("character_generation") &&
      server.includes("life_narrative") &&
      server.includes("battle_summary")
  },
  {
    name: "front end routes default AI through same-origin governed proxy",
    pass:
      api.includes("/api/ai-provider") &&
      api.includes("buildAiGovernanceHeaders") &&
      api.includes("aiPendingRequestMap") &&
      api.includes("getAiUsageKindForTemplate")
  },
  {
    name: "battle history is capped and compacted before AI transmission",
    pass:
      builder.includes("MAX_AI_BATTLE_HISTORY") &&
      builder.includes("compactBattleHistoryForAi") &&
      builder.includes("slice(-MAX_AI_BATTLE_HISTORY)")
  },
  {
    name: "custom character fields have byte limits",
    pass:
      api.includes("DUEL_CUSTOM_NAME_MAX_BYTES") &&
      api.includes("DUEL_CUSTOM_TECHNIQUE_MAX_BYTES") &&
      api.includes("DUEL_CUSTOM_DOMAIN_MAX_BYTES") &&
      api.includes("trimUtf8Bytes")
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error("AI guardrail checks failed:");
  for (const check of failed) console.error(`- ${check.name}`);
  process.exit(1);
}

console.log(`AI guardrail checks passed: ${checks.length}`);
