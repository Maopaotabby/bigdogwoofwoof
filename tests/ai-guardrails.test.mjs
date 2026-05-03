import assert from "node:assert/strict";
import test from "node:test";
import worker from "../server/online-battle-worker.js";

function makeRequest(path, body) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

test("V2 downgraded worker no longer exposes AI proxy guardrail endpoints", async () => {
  const aiResponse = await worker.fetch(makeRequest("/ai", {
    promptTemplateId: "duel_character_assist",
    payload: { input: [{ role: "user", content: "character settings" }] }
  }), {});
  const aiStatusResponse = await worker.fetch(makeRequest("/ai/status", {
    promptTemplateId: "duel_character_assist"
  }), {});

  assert.equal(aiResponse.status, 400);
  assert.equal(aiStatusResponse.status, 400);

  const aiBody = await aiResponse.json();
  const statusBody = await aiStatusResponse.json();
  assert.equal(aiBody.ok, false);
  assert.equal(statusBody.ok, false);
  assert.doesNotMatch(JSON.stringify(aiBody), /rateLimit|AI_ADMIN|adminAuth|ip_daily_limit/);
  assert.doesNotMatch(JSON.stringify(statusBody), /rateLimit|AI_ADMIN|adminAuth|ip_daily_limit/);
});
