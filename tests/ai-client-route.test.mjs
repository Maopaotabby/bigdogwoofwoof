import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runtimeApi = readFileSync(new URL("../api/runtime-api.js", import.meta.url), "utf8");
const promptBuilder = readFileSync(new URL("../modules/api/ai-prompt-builder.js", import.meta.url), "utf8");

test("duel character assist uses the same prompt payload route as life narrative", () => {
  const duelFunction = runtimeApi.match(/async function requestDuelAiAssist\(endpoint, payload\) \{[\s\S]*?\n}\n/)?.[0] || "";
  const narrativeFunction = runtimeApi.match(/async function requestAiNarrative[\s\S]*?\n}\n/)?.[0] || "";

  assert.match(duelFunction, /requestAiGoverned\(templateId, payload/);
  assert.match(narrativeFunction, /requestAiGoverned\("article_summary", payload/);
  assert.doesNotMatch(duelFunction, /clientRequest/);
  assert.doesNotMatch(duelFunction, /uploadedText/);
});

test("AI route uses one governed provider path without the old explicit proxy branch", () => {
  const duelFunction = runtimeApi.match(/async function requestDuelAiAssist\(endpoint, payload\) \{[\s\S]*?\n}\n/)?.[0] || "";
  const aiFreeFunction = runtimeApi.match(/async function requestAiFreeAnalysis\(endpoint, payload\) \{[\s\S]*?\n}\n/)?.[0] || "";

  assert.match(duelFunction, /requestAiGoverned\(templateId, payload/);
  assert.doesNotMatch(duelFunction, /requestUserProxyAiPayload/);
  assert.match(aiFreeFunction, /requestAiGoverned\("ai_assist", payload/);
  assert.doesNotMatch(aiFreeFunction, /requestUserProxyAiPayload/);
});

test("battle narration prompt asks for the fields actually sent by the duel payload", () => {
  assert.match(promptBuilder, /battleSummary/);
  assert.match(promptBuilder, /roundEvents/);
  assert.match(promptBuilder, /resources/);
  assert.match(promptBuilder, /domainState/);
  assert.match(promptBuilder, /handActions/);
});

test("provider modes are limited to off/default/custom and omit guardrail payloads", () => {
  const providerModes = promptBuilder.match(/var validModes = Object\.freeze\(\[[\s\S]*?\]\);/)?.[0] || "";

  assert.match(providerModes, /"off"/);
  assert.match(providerModes, /"default"/);
  assert.match(providerModes, /"custom"/);
  assert.doesNotMatch(runtimeApi, /requestUserProxyAiPayload/);
  assert.doesNotMatch(promptBuilder, /adminAuth|clientRequest/);
});
