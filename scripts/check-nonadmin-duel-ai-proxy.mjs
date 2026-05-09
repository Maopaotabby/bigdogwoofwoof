import fs from "node:fs";

const runtimeApi = fs.readFileSync("api/runtime-api.js", "utf8");

const checks = [
  {
    name: "non-admin duel character assist is forced to server proxy",
    pass:
      runtimeApi.includes("function shouldForceDuelAiAssistServerProxy") &&
      runtimeApi.includes('templateId === "duel_character_assist"') &&
      runtimeApi.includes("!getLoginCardAiIdentity().isAdmin") &&
      runtimeApi.includes('forcedServerProxyForTemplate: templateId')
  },
  {
    name: "forced server proxy uses default ArkAI mini path",
    pass:
      runtimeApi.includes('providerId: "ark_ai"') &&
      runtimeApi.includes('path: "/api/ai-provider/chat/completions"') &&
      runtimeApi.includes('apiKey: "server-proxy"') &&
      runtimeApi.includes("doubao-seed-2-0-mini-260215")
  },
  {
    name: "prompt payload and request share template-specific settings",
    pass:
      runtimeApi.includes("providerSettings || getAiProviderSettings()") &&
      runtimeApi.includes("getAiProviderSettingsForTemplate(templateId)") &&
      runtimeApi.includes("{ ...options, providerSettings: settings }")
  },
  {
    name: "server proxy auth failures are not shown as user BYOK failures",
    pass:
      runtimeApi.includes("普通用户不需要填写 Key") &&
      runtimeApi.includes("请联系站长检查服务器配置") &&
      runtimeApi.includes("error?.serverProxy || error?.forcedServerProxyForTemplate")
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error("Non-admin duel AI proxy checks failed:");
  for (const check of failed) console.error(`- ${check.name}`);
  process.exit(1);
}

console.log(`Non-admin duel AI proxy checks passed: ${checks.length}`);
