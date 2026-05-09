#!/usr/bin/env node

import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const [html, loginCard, runtimeFight, runtimeApi, server, styles, reportScript] = await Promise.all([
  readFile("index.html", "utf8"),
  readFile("modules/login-card.js", "utf8"),
  readFile("tool/runtime-fight.js", "utf8"),
  readFile("api/runtime-api.js", "utf8"),
  readFile("server/lighthouse-server.js", "utf8"),
  readFile("styles.css", "utf8"),
  readFile("scripts/export-login-card-ai-log-report.mjs", "utf8")
]);

assert(html.includes("loginTutorialCollapseBtn"), "tutorial collapse button is present in HTML");
assert((html.match(/href="\.\/styles\.css\?v=/g) || []).length === 1, "page loads styles.css once so legacy tutorial rules cannot override current layout");
assert(html.includes("login-tutorial-actions"), "tutorial top actions group skip and collapse buttons");
assert(
  html.indexOf("login-tutorial-head") < html.indexOf("login-tutorial-actions")
    && html.indexOf("login-tutorial-actions") < html.indexOf("loginTutorialBody"),
  "tutorial actions live in the tutorial header row"
);
assert(loginCard.includes("function setTutorialCollapsed"), "tutorial collapse state is wired");
assert(loginCard.includes("open-custom-character") && loginCard.includes("open-login-manager"), "tutorial has cross-page actions");
assert(loginCard.includes("手动输入数据") && loginCard.includes("AI 返回"), "tutorial explains manual AI data fallback");
assert(loginCard.includes("Special hand tags") && loginCard.includes("星之怒") && loginCard.includes("赤血操术") && loginCard.includes("投射术式"), "tutorial covers current special hand mechanics");
assert(loginCard.includes("虚拟质量") && loginCard.includes("穿") && loginCard.includes("帧率"), "tutorial explains current special counters");
assert(loginCard.includes("修改角色面板") && loginCard.includes("不会清空角色已有手札"), "tutorial covers login-card character panel editing");
assert(styles.includes("login-tutorial-highlight") && styles.includes("login-tutorial-collapsed"), "tutorial highlight/collapse CSS exists");
assert(styles.includes(".login-tutorial-actions") && styles.includes("pointer-events: auto"), "tutorial top actions remain interactive");
assert(styles.includes("flex-wrap: nowrap"), "tutorial top actions stay on one horizontal row");
assert(styles.includes("grid-template-columns: auto minmax(180px, 1fr)"), "tutorial header reserves a usable horizontal title column");
assert(styles.includes(".login-tutorial-actions") && styles.includes("grid-column: 1 / -1"), "tutorial actions move below the title instead of squeezing it");
assert(styles.includes("grid-template-columns: repeat(2, minmax(0, 1fr))"), "mobile tutorial skip/collapse buttons stay side by side");
assert(styles.includes(".login-tutorial-head") && styles.includes("grid-template-columns: auto minmax(160px, 1fr)"), "mobile tutorial title keeps a usable horizontal column");
assert(styles.includes("word-break: keep-all") && styles.includes("text-overflow: ellipsis"), "tutorial title cannot wrap into one-character vertical text");
assert(styles.includes("body .login-tutorial-actions .login-tutorial-skip") && styles.includes("position: static !important"), "tutorial action buttons override legacy absolute positioning");
assert(runtimeFight.includes(">存入登陆卡</button>"), "custom character export button was renamed");
assert(runtimeFight.includes("请先用登录卡 PNG 登录"), "custom character store requires login card");
const addCharacterBody = loginCard.slice(
  loginCard.indexOf("async function addCharacterExportPayload"),
  loginCard.indexOf("async function handleManagerExport")
);
assert(!addCharacterBody.includes("exportCurrentLoginCard"), "storing a character no longer auto-downloads login card");
assert(loginCard.includes("formatLoginCardDownloadFilename") && loginCard.includes("泳者“") && loginCard.includes("”的登录卡.png"), "login card export filename follows swimmer nickname format");
assert(runtimeApi.includes("X-JJK-Login-Card-Nickname"), "AI requests include login-card nickname");
assert(server.includes("/api/ai-security") && server.includes("x-jjk-login-card-nickname"), "server exposes security status and records nickname");
assert(reportScript.includes("昵称") || reportScript.includes("nickname"), "report script aggregates nickname");
assert(reportScript.includes("今日AI请求次数") || reportScript.includes("entries.length"), "report script aggregates request count");
assert(reportScript.includes("总消费tokens数") || reportScript.includes("tokens"), "report script aggregates token cost");

if (!process.exitCode) console.log("login card tutorial/export checks passed");
