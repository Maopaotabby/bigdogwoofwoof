import fs from "node:fs";

const source = fs.readFileSync("wheel/runtime-core.js", "utf8");

const getFunctionBlock = (text, functionName) => {
  const start = text.indexOf(`function ${functionName}`);
  if (start < 0) return "";
  const signatureEnd = text.indexOf(")", start);
  const bodyStart = text.indexOf("{", signatureEnd);
  if (bodyStart < 0) return "";
  let depth = 0;
  for (let index = bodyStart; index < text.length; index += 1) {
    if (text[index] === "{") depth += 1;
    if (text[index] === "}") depth -= 1;
    if (depth === 0) return text.slice(start, index + 1);
  }
  return "";
};

const block = getFunctionBlock(source, "normalizeCharacterRecord");
if (!block) {
  console.error("normalizeCharacterRecord was not found.");
  process.exit(1);
}

const normalizeCharacterRecord = new Function(`${block}; return normalizeCharacterRecord;`)();
const normalized = normalizeCharacterRecord({
  characterId: "special_tag_test",
  displayName: "Special Tag Test",
  specialHandTags: ["json_special_hand"]
});

const tags = normalized.specialHandTags || [];
if (!tags.includes("json_special_hand")) {
  console.error("normalizeCharacterRecord does not preserve character JSON specialHandTags.");
  process.exit(1);
}

if (!source.includes("mergeCharacterManifestEntryRecord")) {
  console.error("loadCharacterCards does not merge manifest entry tags with character JSON tags.");
  process.exit(1);
}

console.log("Character specialTag sync checks passed.");
