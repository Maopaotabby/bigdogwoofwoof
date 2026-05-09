import fs from "node:fs";

const html = fs.readFileSync("index.html", "utf8");
const runtime = fs.readFileSync("wheel/runtime-core.js", "utf8");
const mainEntry = fs.readFileSync("modules/main.js", "utf8");
const loginCard = fs.readFileSync("modules/login-card.js", "utf8");
const styles = fs.readFileSync("styles.css", "utf8");
const uploadTool = fs.readFileSync("../Helper/Update/UpdateTool-GUI.ps1", "utf8");

const checks = [
  {
    name: "changelog includes V3.0.1 hand and Kashimo fix",
    pass:
      html.includes("V3.0.1") &&
      html.includes("\u9e7f\u7d2b\u4e91\u4e00\u89d2\u8272\u5361\u8865\u5165") &&
      html.includes("\u9886\u57df\u624b\u672d\u533a\u7ee7\u7eed\u6536\u7eb3\u9886\u57df/\u53cd\u9886\u57df\u724c")
  },
  {
    name: "entry notice announces current fast notice release",
    pass:
      html.includes("V3.1.5") &&
      html.includes("\u6218\u6597\u903b\u8f91\u5feb\u901f\u516c\u544a") &&
      html.includes("\u5355\u4eba\u5bf9\u6218\u65b0\u589e\u7535\u8111\u96be\u5ea6\u9009\u62e9") &&
      html.includes("\u65b0\u624b\u6559\u7a0b\u5df2\u540c\u6b65\u5f53\u524d\u7248\u672c") &&
      html.includes("AI \u624b\u52a8\u8f93\u5165\u6570\u636e") &&
      html.includes("\u975e\u7ba1\u7406\u5458\u4f7f\u7528 AI \u81ea\u5b9a\u4e49\u89d2\u8272\u5361\u89e3\u6790\u65f6") &&
      html.includes("doubao-seed-2-0-mini") &&
      html.includes("\u7279\u6b8a\u624b\u672d\u72b6\u6001\u680f") &&
      html.includes("\u5492\u529b\u5316\u8840") &&
      html.includes("\u8d85\u4e0a\u9650\u4f53\u52bf") &&
      html.includes("\u6263\u8840\u8f6c\u4f24\u5bb3\u7cfb\u6570\u8c03\u4e3a 0.9") &&
      html.includes("\u8d64\u9cde\u8dc3\u52a8") &&
      html.includes("\u4e0d\u518d\u8f6c\u5316\u4e3a\u4f24\u5bb3\u6216\u8840\u7cfb\u6570") &&
      html.includes("\u516c\u544a\u73b0\u5728\u4f1a\u5728\u8fd0\u884c\u65f6\u5f00\u59cb\u52a0\u8f7d\u65f6\u7acb\u5373\u663e\u793a") &&
      html.includes("V3.1.5-tutorial-title-20260509&esm=39") &&
      runtime.includes('APP_BUILD_VERSION = "V3.1.5-tutorial-title-20260509"')
  },
  {
    name: "upload GUI resolves current project directory before legacy projet",
    pass:
      uploadTool.includes('"project"') &&
      uploadTool.includes('"projet"') &&
      uploadTool.includes('"assets/images"') &&
      uploadTool.includes("sudo -n mkdir -p") &&
      uploadTool.includes("$projectRootCandidate") &&
      uploadTool.indexOf('"project"') < uploadTool.indexOf('"projet"') &&
      uploadTool.includes("$maxAttempts") &&
      uploadTool.includes("RedirectStandardError = $true")
  },
  {
    name: "login gate waits for runtime while update notice is independent",
    pass:
      html.indexOf('id="v224UpdateModal"') < html.indexOf('id="loginCardGate"') &&
      html.indexOf("window.JJKUpdateNotice") < html.indexOf('id="loginCardGate"') &&
      runtime.includes("globalThis.JJKUpdateNotice") &&
      runtime.includes("jjk-update-notice-ready") &&
      runtime.includes("jjk-runtime-ready") &&
      runtime.indexOf("showV224UpdateModal();") < runtime.indexOf("Promise.all([") &&
      runtime.includes("bindUpdateNoticeEvents") &&
      mainEntry.indexOf("const registry = initializeModules();") < mainEntry.indexOf("await startRuntimeBootstrap();") &&
      loginCard.includes('els.status.textContent = "请选择登录方式。"') &&
      loginCard.includes("canDismissLoginGate") &&
      loginCard.includes("pendingAppEntry") &&
      loginCard.includes("jjk-update-notice-ready") &&
      loginCard.includes("jjk-runtime-ready") &&
      loginCard.includes("return runtimeReady && isUpdateNoticeReady()") &&
      loginCard.includes("canUseLoginGateControls") &&
      loginCard.includes("els.useBtn) els.useBtn.disabled = true") &&
      loginCard.includes("正在加载网站资源和公告") &&
      styles.includes("login-card-status-loading")
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error("Release notice/upload checks failed:");
  for (const check of failed) console.error(`- ${check.name}`);
  process.exit(1);
}

console.log(`Release notice/upload checks passed: ${checks.length}`);


