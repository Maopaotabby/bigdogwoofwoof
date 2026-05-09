import fs from "node:fs";
import path from "node:path";

const characterDir = "character";
const manifestPath = path.join(characterDir, "manifest.json");

const normalizeTags = (...sources) => {
  const seen = new Set();
  return sources
    .flatMap((source) => Array.isArray(source) ? source : [])
    .map((tag) => String(tag || "").trim())
    .filter((tag) => {
      if (!tag || seen.has(tag)) return false;
      seen.add(tag);
      return true;
    });
};

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const jsonByCharacterId = new Map();

for (const file of fs.readdirSync(characterDir)) {
  if (file === "manifest.json" || !file.endsWith(".json")) continue;
  const fullPath = path.join(characterDir, file);
  const card = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  if (!card.characterId) continue;
  jsonByCharacterId.set(card.characterId, {
    file,
    tags: normalizeTags(card.specialHandTags, card["特殊手札"])
  });
}

let updated = 0;
manifest.characters = (manifest.characters || []).map((entry) => {
  if (!entry || typeof entry === "string") return entry;
  const match = jsonByCharacterId.get(entry.characterId);
  if (!match) return entry;
  const nextTags = match.tags;
  const currentTags = normalizeTags(entry.specialHandTags, entry["特殊手札"]);
  const same = currentTags.length === nextTags.length && currentTags.every((tag, index) => tag === nextTags[index]);
  if (same) return entry;
  updated += 1;
  return {
    ...entry,
    file: entry.file || match.file,
    specialHandTags: nextTags
  };
});

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Synced manifest specialHandTags for ${updated} character entries.`);
