import fs from "node:fs";
import path from "node:path";

const domainResponseSource = fs.readFileSync("modules/duel/duel-domain-response.js", "utf8");
const handSource = fs.readFileSync("modules/duel/duel-hand.js", "utf8");
const fightSource = fs.readFileSync("tool/runtime-fight.js", "utf8");
const skinCss = fs.readFileSync("assets/duel-dynamics/duel-card-dynamics.css", "utf8");

const characterDir = "character";
const kashimoFile = fs.readdirSync(characterDir).find((file) => {
  if (!file.endsWith(".json")) return false;
  const content = fs.readFileSync(path.join(characterDir, file), "utf8");
  if (!content.includes('"characterId": "kashimo_hajime_ancient"')) return false;
  try {
    return JSON.parse(content).characterId === "kashimo_hajime_ancient";
  } catch {
    return false;
  }
});

if (!kashimoFile) {
  console.error("Kashimo profile file was not found.");
  process.exit(1);
}

const kashimoProfile = JSON.parse(fs.readFileSync(path.join(characterDir, kashimoFile), "utf8"));

const getFunctionBlock = (source, functionName) => {
  const start = source.indexOf(`function ${functionName}`);
  if (start < 0) return "";
  const signatureEnd = source.indexOf(")", start);
  const bodyStart = source.indexOf("{", signatureEnd);
  if (bodyStart < 0) return "";
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  return source.slice(start);
};

const responseTextBlock = getFunctionBlock(domainResponseSource, "getDuelDomainResponseText");
const handDomainControlBlock = getFunctionBlock(handSource, "isDomainControlHandCandidate");
const handDomainSplitBlock = getFunctionBlock(handSource, "isDomainHandCandidate");
const fightDomainControlBlock = getFunctionBlock(fightSource, "isDuelDomainControlSkinChoice");
const fightPureDomainBlock = getFunctionBlock(fightSource, "isDuelPureDomainChoice");
const finalSkinBlock = skinCss.slice(skinCss.lastIndexOf("/* Battle hand card skin restore"));

const responseActionIds = [
  "simple_domain_guard",
  "hollow_wicker_basket_guard",
  "falling_blossom_emotion",
  "zero_ce_domain_bypass",
  "domain_survival_guard"
];

const checks = [
  {
    name: "Kashimo profile declares hollow wicker basket hand access",
    pass:
      kashimoProfile.characterId === "kashimo_hajime_ancient" &&
      Array.isArray(kashimoProfile.innateTraits) &&
      kashimoProfile.innateTraits.includes("\u62e5\u6709\u5f25\u987b\u845b\u7b3c") &&
      Array.isArray(kashimoProfile["\u7279\u6b8a\u624b\u672d"]) &&
      kashimoProfile["\u7279\u6b8a\u624b\u672d"].includes("hollow_wicker_basket") &&
      Array.isArray(kashimoProfile.specialHandTags) &&
      kashimoProfile.specialHandTags.includes("hollow_wicker_basket")
  },
  {
    name: "domain response detection reads special hand tags and Hollow Wicker Basket aliases",
    pass:
      responseTextBlock.includes("profile?.specialHandTags") &&
      domainResponseSource.includes("hollow_wicker_basket") &&
      domainResponseSource.includes("\u5f25\u865a\u845b\u7b3c") &&
      domainResponseSource.includes("\u5f25\u987b\u845b\u7b3c")
  },
  {
    name: "known anti-domain response cards stay in the domain hand lane",
    pass: responseActionIds.every((id) => handSource.includes(id)) &&
      responseActionIds.every((id) => fightSource.includes(id))
  },
  {
    name: "generic domain_response cards do not enter the domain lane by card type alone",
    pass:
      handDomainControlBlock.includes("domainControlHandActionIds.has") &&
      !handDomainControlBlock.includes('cardType === "domain_response"') &&
      fightDomainControlBlock.includes("DUEL_DOMAIN_CONTROL_SKIN_IDS.has") &&
      !fightDomainControlBlock.includes('cardType === "domain_response"')
  },
  {
    name: "non-domain rule and jackpot phase cards are excluded from domain hand split",
    pass:
      handDomainSplitBlock.includes("rule_trial") &&
      handDomainSplitBlock.includes("rule_defense") &&
      handDomainSplitBlock.includes("jackpot") &&
      fightPureDomainBlock.includes("rule_trial") &&
      fightPureDomainBlock.includes("jackpot")
  },
  {
    name: "Kashimo champion skin uses the source image avatar instead of drawn gradients",
    pass:
      finalSkinBlock.includes("kashimo-avatar.jpg") &&
      finalSkinBlock.includes("background-position") &&
      !finalSkinBlock.includes("radial-gradient(circle at 38% 48%")
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error("Duel domain hand checks failed:");
  for (const check of failed) console.error(`- ${check.name}`);
  process.exit(1);
}

console.log(`Duel domain hand checks passed: ${checks.length}`);
