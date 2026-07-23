import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Removes only known generated Next.js / Turbopack cache directories for the
 * web workspace. Does not touch source, env files, node_modules, or lockfiles.
 */
const targets = [
  "apps/web/.next",
  "apps/web/.turbo",
  "apps/web/node_modules/.cache",
];

const root = resolve(import.meta.dirname, "..");
let removed = 0;

for (const relative of targets) {
  const absolute = resolve(root, relative);
  if (!existsSync(absolute)) {
    console.log(`skip (missing): ${relative}`);
    continue;
  }

  rmSync(absolute, { recursive: true, force: true });
  console.log(`removed: ${relative}`);
  removed += 1;
}

console.log(
  removed === 0
    ? "No web cache directories to remove. Safe to run npm run dev."
    : `Cleaned ${removed} path(s). You can restart with npm run dev.`
);
