import fs from "node:fs";

const runtimeApi = fs.readFileSync("api/runtime-api.js", "utf8");

const forbiddenHeaders = [
  "特殊手札制作规则：",
  "特殊领域制作规则：",
  "返回格式硬约束："
];

const requiredHeaders = [
  "Special hand rules:",
  "Domain rules:",
  "Return format constraints:"
];

const checks = [
  {
    name: "card prompt merge does not inject Chinese section headers",
    pass: forbiddenHeaders.every((header) => !runtimeApi.includes(header))
  },
  {
    name: "card prompt merge keeps ASCII section headers",
    pass: requiredHeaders.every((header) => runtimeApi.includes(header))
  }
];

for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}`);
}

if (checks.some((check) => !check.pass)) {
  process.exitCode = 1;
}
