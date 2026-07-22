import { existsSync } from "node:fs";

const checks = [
  {
    invalid: existsSync("apps/web/package-lock.json"),
    message:
      "apps/web/package-lock.json must not exist. Install dependencies from the repository root.",
  },
  {
    invalid: !existsSync("node_modules/next/package.json"),
    message:
      "Root dependencies are missing or not hoisted. Run `npm ci` from the repository root.",
  },
  {
    invalid: !existsSync("node_modules/@swc/helpers/package.json"),
    message:
      "@swc/helpers is not available at the workspace root. Run `npm ci` from the repository root.",
  },
];

const failures = checks.filter((check) => check.invalid);

if (failures.length > 0) {
  console.error("Invalid npm workspace layout:\n");
  for (const failure of failures) {
    console.error(`- ${failure.message}`);
  }
  process.exit(1);
}

console.log("Workspace layout is valid.");
