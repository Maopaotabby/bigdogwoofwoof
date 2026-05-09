import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const edgeCandidates = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"
];

const browserPath = edgeCandidates.find((candidate) => fs.existsSync(candidate));
if (!browserPath) {
  console.error("No Chromium-compatible browser found for modal layout check.");
  process.exit(1);
}

const projectRoot = process.cwd().replace(/\\/g, "/");
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "update-modal-mobile-"));
const port = 9341;
const url = `file:///${projectRoot}/index.html?v=${Date.now()}`;
const browser = spawn(browserPath, [
  "--headless=new",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userDataDir}`,
  "--disable-gpu",
  "--no-first-run",
  "--disable-cache",
  url
], { stdio: "ignore" });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJson(target) {
  const response = await fetch(target);
  if (!response.ok) throw new Error(`${response.status} ${target}`);
  return response.json();
}

async function connectCdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const handlers = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) handlers.reject(new Error(JSON.stringify(message.error)));
    else handlers.resolve(message.result);
  });
  return {
    send(method, params = {}) {
      const callId = ++id;
      socket.send(JSON.stringify({ id: callId, method, params }));
      return new Promise((resolve, reject) => pending.set(callId, { resolve, reject }));
    },
    close() {
      socket.close();
    }
  };
}

let client;
try {
  let pages = [];
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      pages = await readJson(`http://127.0.0.1:${port}/json`);
      if (pages.length) break;
    } catch {
      // Browser startup can take a moment.
    }
    await sleep(250);
  }
  if (!pages.length) throw new Error("Browser DevTools target not available.");
  const page = pages.find((item) => item.url.startsWith("file:///")) || pages[0];
  client = await connectCdp(page.webSocketDebuggerUrl);
  await client.send("Runtime.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 375,
    height: 667,
    deviceScaleFactor: 1,
    mobile: true
  });
  await sleep(1000);

  const expression = `(() => {
    const modal = document.querySelector("#v224UpdateModal");
    const card = document.querySelector(".update-modal-card");
    const list = document.querySelector(".update-modal-card ul");
    const close = document.querySelector("#v224UpdateModalClose");
    modal.hidden = false;
    document.body.classList.add("update-modal-open");
    const cardRect = card.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    const closeRect = close.getBoundingClientRect();
    const cardStyle = getComputedStyle(card);
    const listStyle = getComputedStyle(list);
    return {
      viewport: { width: innerWidth, height: innerHeight },
      card: { top: cardRect.top, bottom: cardRect.bottom, height: cardRect.height, maxHeight: cardStyle.maxHeight },
      list: { top: listRect.top, bottom: listRect.bottom, height: listRect.height, overflowY: listStyle.overflowY },
      close: { top: closeRect.top, bottom: closeRect.bottom, height: closeRect.height },
      closeFullyVisible: closeRect.top >= 0 && closeRect.bottom <= innerHeight - 12,
      cardWithinViewport: cardRect.top >= 12 && cardRect.bottom <= innerHeight - 12,
      listCanScroll: list.scrollHeight > list.clientHeight && ["auto", "scroll"].includes(listStyle.overflowY)
    };
  })()`;

  const result = await client.send("Runtime.evaluate", { expression, returnByValue: true });
  const value = result.result.value;
  console.log(JSON.stringify(value, null, 2));
  if (!value.closeFullyVisible || !value.cardWithinViewport || !value.listCanScroll) {
    console.error("Update modal mobile layout check failed.");
    process.exitCode = 1;
  }
} finally {
  try {
    client?.close();
  } catch {
    // Ignore cleanup failure.
  }
  browser.kill();
  await sleep(500);
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  } catch {
    // Ignore locked profile cleanup.
  }
}
