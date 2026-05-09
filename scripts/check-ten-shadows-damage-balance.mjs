import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const templatePath = path.join(root, "modules", "duel", "duel-card-template.js");
vm.runInThisContext(fs.readFileSync(templatePath, "utf8"), { filename: templatePath });

const api = globalThis.JJKDuelCardTemplate;
if (!api?.calculateDuelCardFinalPreview) {
  throw new Error("JJKDuelCardTemplate preview API is not available.");
}

const actor = {
  characterCardProfile: {
    displayName: "十影平衡测试",
    visibleGrade: "EX",
    ceControl: "EX",
    ceOutput: "S",
    ceMaxOutput: "S",
    techniquePower: "S",
    physicalPower: "B",
    speed: "B",
    specialHandTags: ["ten_shadows"],
    techniqueFamilies: ["ten_shadows"]
  }
};

const action = {
  id: "ten_shadows_balance_probe",
  sourceActionId: "ten_shadows_balance_probe",
  label: "十影平衡探针",
  cardType: "technique",
  tags: ["ten_shadows", "十影"],
  specialHandTags: ["ten_shadows"],
  baseDamage: 28,
  scalingProfile: "technique",
  risk: "medium"
};

const preview = api.calculateDuelCardFinalPreview(action, actor);
const correction = preview.ceControlDamageCorrection || {};

if (preview.base.baseDamage <= action.baseDamage) {
  throw new Error(`Expected ten shadows baseDamage boost above ${action.baseDamage}, got ${preview.base.baseDamage}.`);
}

if (!correction.applies || correction.tenShadowsAdjusted !== true) {
  throw new Error("Expected ten shadows CE-control correction adjustment to be marked.");
}

if (Number(correction.multiplier || 0) > 2.15) {
  throw new Error(`Expected ten shadows CE-control correction <= 2.15, got ${correction.multiplier}.`);
}

console.log("Ten shadows damage balance checks passed.");
