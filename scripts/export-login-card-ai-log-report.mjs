#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_BASE_URL = "http://119.91.224.223";
const baseUrl = String(process.argv[2] || process.env.JJK_AI_LOG_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
const logLimit = Math.min(5000, Math.max(1, Number(process.argv[3] || process.env.JJK_AI_LOG_LIMIT || 5000)));

function east8DateKey(date = new Date()) {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function sanitizeField(value) {
  return String(value ?? "-").replace(/[\r\n\t]+/g, " ").trim() || "-";
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "未知";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}m`;
}

async function readJson(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  const text = await response.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${pathname} returned non-JSON response: ${text.slice(0, 120)}`);
  }
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || `${pathname} failed with HTTP ${response.status}`);
  }
  return data;
}

function parseLogLines(lines) {
  return (Array.isArray(lines) ? lines : []).flatMap((line) => {
    try {
      const entry = JSON.parse(line);
      return entry && typeof entry === "object" ? [entry] : [];
    } catch {
      return [];
    }
  });
}

function buildFrequency(entries) {
  const times = entries
    .map((entry) => new Date(entry.at || 0).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (times.length <= 1) return "单次";
  const avgInterval = (times[times.length - 1] - times[0]) / Math.max(1, times.length - 1);
  const perMinute = avgInterval > 0 ? 60000 / avgInterval : 0;
  return `平均间隔${formatDuration(avgInterval)}(${perMinute.toFixed(2)}次/分)`;
}

const today = east8DateKey();
const [{ lines }, security] = await Promise.all([
  readJson(`/api/ai-logs?limit=${logLimit}`).catch(() => readJson("/api/ai-logs")),
  readJson("/api/ai-security").catch(() => ({ blockedAiIps: {} }))
]);

const blockedAiIps = security?.blockedAiIps && typeof security.blockedAiIps === "object"
  ? new Set(Object.keys(security.blockedAiIps))
  : new Set();

const grouped = new Map();
for (const entry of parseLogLines(lines)) {
  if (!entry?.at || east8DateKey(new Date(entry.at)) !== today) continue;
  const identity = entry.identity || {};
  const ip = sanitizeField(identity.loginCardIp || identity.clientIp || entry.loginCardIp || entry.clientIp);
  if (ip === "-") continue;
  if (!grouped.has(ip)) {
    grouped.set(ip, {
      nickname: sanitizeField(identity.nickname || identity.ownerNickname || identity.ownerId || "未命名登录卡"),
      ip,
      entries: [],
      tokens: 0
    });
  }
  const item = grouped.get(ip);
  item.nickname = sanitizeField(identity.nickname || item.nickname);
  item.entries.push(entry);
  item.tokens += Number(entry.totalTokens ?? entry.promptTokens ?? 0) || 0;
}

const rows = [...grouped.values()]
  .sort((a, b) => b.entries.length - a.entries.length || b.tokens - a.tokens || a.ip.localeCompare(b.ip))
  .map((item) => [
    item.nickname,
    item.ip,
    item.entries.length,
    item.tokens,
    buildFrequency(item.entries),
    blockedAiIps.has(item.ip) ? "是" : "否"
  ].join("  "));

const outputPath = path.resolve(process.cwd(), `login-card-ai-log-report-${today}.txt`);
await writeFile(outputPath, rows.join("\n") + (rows.length ? "\n" : ""), "utf8");
console.log(`Wrote ${rows.length} rows to ${outputPath}`);
