import fs from "node:fs";

const styles = fs.readFileSync("styles.css", "utf8");

const checks = [
  {
    name: "online collapsible open label is readable Chinese",
    pass: styles.includes('content: "收起";')
  },
  {
    name: "online collapsible closed label is readable Chinese",
    pass: styles.includes('content: "展开";')
  },
  {
    name: "online collapsible labels do not contain mojibake",
    pass: !styles.includes("鏀惰捣") && !styles.includes("灞曞紑")
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error("Online collapse label checks failed:");
  for (const check of failed) console.error(`- ${check.name}`);
  process.exit(1);
}

console.log(`Online collapse label checks passed: ${checks.length}`);
