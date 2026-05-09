import fs from "node:fs";

const styles = fs.readFileSync("styles.css", "utf8");

const checks = [
  {
    name: "tutorial title explicitly uses horizontal writing mode",
    pass:
      styles.includes(".login-tutorial-head h2") &&
      styles.includes("writing-mode: horizontal-tb") &&
      styles.includes("text-orientation: mixed")
  },
  {
    name: "tutorial title is protected from one-character vertical wrapping",
    pass:
      styles.includes("white-space: nowrap") &&
      styles.includes("word-break: keep-all") &&
      styles.includes("text-overflow: ellipsis")
  },
  {
    name: "tutorial action buttons no longer squeeze the title column",
    pass:
      styles.includes("grid-template-columns: auto minmax(180px, 1fr)") &&
      styles.includes(".login-tutorial-actions") &&
      styles.includes("grid-column: 1 / -1")
  },
  {
    name: "mobile tutorial title keeps horizontal layout",
    pass:
      styles.includes("grid-template-columns: auto minmax(160px, 1fr)") &&
      styles.includes("@media (max-width: 640px)") &&
      styles.includes("word-break: keep-all")
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error("Login tutorial title layout checks failed:");
  for (const check of failed) console.error(`- ${check.name}`);
  process.exit(1);
}

console.log(`Login tutorial title layout checks passed: ${checks.length}`);
