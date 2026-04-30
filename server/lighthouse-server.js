import http from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import worker from "./online-battle-worker.js";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), "server-data");
const ROOMS_FILE = path.join(DATA_DIR, "online-rooms.json");

class FileRoomStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.cache = null;
    this.writeQueue = Promise.resolve();
  }

  async load() {
    if (this.cache) return this.cache;
    await mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const raw = await readFile(this.filePath, "utf8");
      this.cache = JSON.parse(raw || "{}");
    } catch {
      this.cache = {};
    }
    return this.cache;
  }

  async get(key) {
    const data = await this.load();
    const entry = data[key];
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      delete data[key];
      await this.flush();
      return null;
    }
    return entry.value || null;
  }

  async put(key, value, options = {}) {
    const data = await this.load();
    const ttlMs = Number(options.expirationTtl || 0) * 1000;
    data[key] = {
      value,
      updatedAt: Date.now(),
      expiresAt: ttlMs > 0 ? Date.now() + ttlMs : 0
    };
    await this.flush();
  }

  async flush() {
    this.writeQueue = this.writeQueue.then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const tmp = `${this.filePath}.tmp`;
      await writeFile(tmp, JSON.stringify(this.cache || {}, null, 2), "utf8");
      await rename(tmp, this.filePath);
    });
    return this.writeQueue;
  }
}

const roomStore = new FileRoomStore(ROOMS_FILE);

function buildEnv() {
  return {
    JJK_ONLINE_ROOMS: roomStore,
    AI_PROVIDER: process.env.AI_PROVIDER || "openai_compatible",
    AI_BASE_URL: process.env.AI_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3",
    AI_MODEL: process.env.AI_MODEL || "doubao-seed-2-0-mini-260215",
    AI_MAX_TOKENS: process.env.AI_MAX_TOKENS || "700",
    AI_TEMPERATURE: process.env.AI_TEMPERATURE || "0.4",
    AI_TIMEOUT_MS: process.env.AI_TIMEOUT_MS || "30000",
    AI_API_KEY: process.env.AI_API_KEY || ""
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(Object.assign(new Error("请求体过大。"), { status: 413 }));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function sendWorkerResponse(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && (req.url === "/" || req.url === "/health")) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({
        ok: true,
        service: "jjk_online_battle_lighthouse",
        protocol: "jjk_online_battle_v1",
        time: new Date().toISOString()
      }));
      return;
    }

    const body = req.method === "POST" ? await readBody(req) : "";
    const request = new Request(`http://localhost${req.url || "/"}`, {
      method: req.method,
      headers: req.headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : body
    });
    const response = await worker.fetch(request, buildEnv());
    await sendWorkerResponse(res, response);
  } catch (error) {
    res.statusCode = Number(error?.status || 500);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(JSON.stringify({ ok: false, error: String(error?.message || error || "服务器错误。") }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`JJK online battle backend listening on http://${HOST}:${PORT}`);
  console.log(`Room data file: ${ROOMS_FILE}`);
});
