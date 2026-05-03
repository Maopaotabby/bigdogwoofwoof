import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const css = await read("styles.css");
const html = await read("index.html");
const mainJs = await read("modules/main.js");
const runtimeUi = await read("UI/runtime-ui.js");
const mobileUi = await read("modules/ui/ui-mobile.js");

const topbarRule = css.match(/\.topbar\s*\{[\s\S]*?\n\}/)?.[0] || "";

assert.doesNotMatch(topbarRule, /position\s*:\s*(sticky|fixed)\s*;/i, "topbar should not float while scrolling");
assert.doesNotMatch(css, /body\.mobile-topbar-hidden\s+\.topbar\s*\{[\s\S]*?transform\s*:/i, "mobile-topbar-hidden should not translate the topbar away");
assert.doesNotMatch(runtimeUi, /window\.addEventListener\(["']scroll["'],\s*updateMobileTopbarOnScroll/i, "runtime should not install topbar scroll-hide listener");
assert.doesNotMatch(runtimeUi, /document\.body\.classList\.toggle\(["']mobile-topbar-hidden["']/i, "runtime should not toggle the mobile topbar hidden class");
assert.equal(/installsListeners:\s*false/.test(mobileUi), true, "mobile helper should remain passive and not own listeners");
assert.match(html, /styles\.css\?v=20260503-v2\.2-ai-route-cleanup/, "stylesheet URL should be cache-busted for the current release");
assert.match(html, /modules\/main\.js\?v=20260503-v2\.2-ai-route-cleanup&esm=8/, "main module URL should be cache-busted for the current release");
assert.match(mainJs, /APP_BUILD_VERSION\s*=\s*"20260503-v2\.2-ai-route-cleanup"/, "runtime chunk URLs should use the current build version");
