import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const onlineSource = readFileSync(new URL("../modules/online.js", import.meta.url), "utf8");
const runtimeFightSource = readFileSync(new URL("../tool/runtime-fight.js", import.meta.url), "utf8");

test("preparing online room sync does not force the battle page back to online", () => {
  const syncPreparingRoomView = onlineSource.match(/function syncPreparingRoomView\(room\) \{[\s\S]*?\n}\n/)?.[0] || "";

  assert.match(syncPreparingRoomView, /clearBattleMode\?\.\("none"\)/);
  assert.doesNotMatch(syncPreparingRoomView, /activateBattlePage\?\.\("online"/);
  assert.doesNotMatch(syncPreparingRoomView, /activePage !== "online"/);
});

test("online battle startup preserves the user's current battle subpage", () => {
  assert.match(runtimeFightSource, /const currentBattlePage = getBattlePageModule\(\)\?\.getBattlePageState\?\.\(\)\.activePage/);
  assert.match(runtimeFightSource, /activePage: mode === "online" \? \(currentBattlePage \|\| "online"\) : "solo"/);
});
