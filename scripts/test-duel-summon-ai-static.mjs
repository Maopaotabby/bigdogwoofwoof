import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const read = (file) => readFile(path.join(root, file), "utf8");
const parseJson = async (file) => JSON.parse(await read(file));

const [
  duelHandSource,
  duelActionsSource,
  runtimeApiSource,
  indexHtml,
  runtimeCoreSource,
  serverSource,
  onlineWorkerSource,
  runtimeFightSource,
  characterRules,
  cardTemplates,
  cardPrompt
] = await Promise.all([
  read("modules/duel/duel-hand.js"),
  read("modules/duel/duel-actions.js"),
  read("api/runtime-api.js"),
  read("index.html"),
  read("wheel/runtime-core.js"),
  read("server/lighthouse-server.js"),
  read("server/online-battle-worker.js"),
  read("tool/runtime-fight.js"),
  parseJson("data/duel-character-card-rules-v0.1-candidate.json"),
  parseJson("data/duel-card-templates-v0.1-candidate.json"),
  parseJson("data/card_prompt.json")
]);

assert(
  !duelHandSource.includes("伏黑|十种影|式神|嵌合暗翳庭"),
  "generic 式神 or 伏黑 must not infer ten_shadows; only Megumi/Ten Shadows-specific evidence may do that"
);

assert(
  !/ten_shadows:\s*\[[^\]]*"shikigami"/.test(duelActionsSource),
  "ten_shadows feature aliases must not include generic shikigami"
);

assert(
  duelActionsSource.includes("FEATURE_TECHNIQUE_ARCHETYPE_REQUIREMENTS")
    && /limitless:\s*\[[^\]]*"gojo_limitless"/.test(duelActionsSource),
  "runtime feature cards for limitless must require the gojo_limitless archetype"
);

assert(
  duelHandSource.includes("getFixedHandInjectionsForActor") && duelHandSource.includes("injectFixedHandCards"),
  "persistent hand logic must support fixed character hand injections"
);

assert(
  duelActionsSource.includes("applyDuelSummonAssist") && duelActionsSource.includes("cleanupExpiredDuelBattlefieldUnits"),
  "summoned battlefield units must have upkeep/expiry and a once-per-round assist path"
);

const megumiEntry = characterRules.characters?.megumi_fushiguro_culling || {};
const megumiRules = megumiEntry.rules || megumiEntry;
const mahoragaRitualIds = new Set(["ten_shadows_mahoraga_tuning_ritual", "mahoraga_tuning_ritual"]);
assert(
  (megumiRules.fixedHandInjections || []).some((entry) =>
    mahoragaRitualIds.has(entry.sourceActionId)
      && Number(entry.condition?.hpBelowRatio) === 0.5
      && entry.retainedPermanent === false
  ),
  "Megumi must force-draw the Mahoraga tuning ritual only when HP is below half"
);

assert(
  duelHandSource.includes("shouldApplyFixedHandInjection") && duelHandSource.includes("hpBelowRatio"),
  "fixed hand injections must support HP-threshold conditions"
);

const mahoragaCard = (cardTemplates.cards || []).find((card) => mahoragaRitualIds.has(card.sourceActionId));
assert.equal(mahoragaCard?.risk, "critical", "Mahoraga tuning ritual risk must use supported critical risk value");

const gojoExclusiveIds = new Set(["infinity_guard", "lapse_blue_pressure", "reversal_red_burst", "unlimited_void_suppression"]);
const looseGojoCards = (cardTemplates.cards || [])
  .filter((card) => gojoExclusiveIds.has(card.sourceActionId))
  .filter((card) => !(card.exclusiveToArchetypes || []).includes("gojo_limitless") || !(card.specialHandTags || []).includes("gojo_limitless"));
assert.deepEqual(
  looseGojoCards.map((card) => card.sourceActionId),
  [],
  "Gojo limitless hand cards must carry gojo_limitless exclusivity on the card template itself"
);

const forbiddenTagValues = new Set(["low", "medium", "high", "critical", "extreme"]);
const badCardTags = [];
for (const card of cardTemplates.cards || []) {
  for (const tag of [...(card.tags || []), ...(card.specialHandTags || [])]) {
    if (forbiddenTagValues.has(String(tag).trim().toLowerCase())) badCardTags.push(`${card.sourceActionId || card.cardId}:${tag}`);
  }
}
assert.deepEqual(badCardTags, [], "card template tags/specialHandTags must not contain risk words");

assert(
  runtimeApiSource.includes("RISK_TAG_VALUES") && runtimeApiSource.includes("filterDuelAiSpecialHandTags"),
  "AI generated special hand tags must filter risk words and infer mechanism tags"
);

assert(
  runtimeApiSource.includes("getDuelAiCharacterNameTag") && runtimeApiSource.includes("getDuelAiCharacterNameTag(context)"),
  "AI generated custom special hand tags must include the custom character name"
);

const promptText = JSON.stringify(cardPrompt);
assert(
  /low\/medium\/high\/critical/.test(promptText) && /risk only|not tags|tags.*risk/i.test(promptText),
  "prompt must explicitly forbid using risk values as specialHands.tags"
);

assert(
  !indexHtml.includes("duelAiRateLimitStatus") && !runtimeCoreSource.includes("duelAiRateLimitStatus"),
  "custom AI UI must not expose stale rate-limit status after removing IP guardrails"
);

assert(
  !serverSource.includes("/ai-assist-status") && !runtimeApiSource.includes("refreshAiAssistRateLimitStatus"),
  "server and client must not keep AI assist rate-limit/admin status checks"
);

assert(
  !serverSource.includes("AI_ASSIST_RATE_LIMIT_PRECHECKED") && !onlineWorkerSource.includes("AI_ASSIST_RATE_LIMIT_PRECHECKED"),
  "AI assist route must not keep stale precheck flags after IP guardrails are removed"
);

assert(
  !serverSource.includes("ai_audit:") && !onlineWorkerSource.includes("compactAiAuditRequest"),
  "removed AI proxy guardrails must not leave stale audit storage paths"
);

assert(
  /function applyOnlineResolvedTurnToBattle[\s\S]+const beforeMemoSnapshot = snapshotDuelMemoState\(battle\)[\s\S]+battle\.lastRoundMemo = buildDuelRoundMemo/.test(runtimeFightSource),
  "online resolved turns must rebuild the previous-round memo so the round memo panel stays visible"
);

console.log("duel summon and AI static checks passed");
