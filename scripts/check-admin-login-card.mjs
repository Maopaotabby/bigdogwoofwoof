import fs from "node:fs";

const html = fs.readFileSync("index.html", "utf8");
const loginCard = fs.readFileSync("modules/login-card.js", "utf8");
const api = fs.readFileSync("api/runtime-api.js", "utf8");
const server = fs.readFileSync("server/lighthouse-server.js", "utf8");

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

assert(html.includes("aiAdminPasswordInput") && html.includes("aiAdminLoginBtn"), "AI settings expose admin login controls");
assert(loginCard.includes("ADMIN_LOGIN_PASSWORD") && loginCard.includes("unlockAdminMode"), "login card can store admin flag after password login");
assert(loginCard.includes("admin: true") && loginCard.includes("payload.admin"), "login card payload supports optional admin field");
assert(api.includes("X-JJK-Login-Card-Admin") && api.includes("isAdmin"), "AI requests include admin header from login card");
assert(server.includes("isAdminLoginCard") && server.includes("x-jjk-login-card-admin"), "server recognizes admin login-card header");
assert(server.includes("if (!isAdminLoginCard(identity) && isAiIdentityBlocked") || server.includes("if (!identity.isAdmin && isAiIdentityBlocked"), "admin bypasses blacklist check");
assert(server.includes("if (!isAdminLoginCard(identity) && promptTokens > AI_MAX_PROMPT_TOKENS") || server.includes("if (!identity.isAdmin && promptTokens > AI_MAX_PROMPT_TOKENS"), "admin bypasses prompt limit");
assert(server.includes("if (!isAdminLoginCard(identity))") || server.includes("if (!identity.isAdmin)"), "admin bypasses quota and high-frequency guards");

if (!process.exitCode) console.log("admin login-card checks passed");
