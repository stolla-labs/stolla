import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const ciWorkflowPath = path.join(rootDir, ".github", "workflows", "ci.yml");
const readmePath = path.join(rootDir, "README.md");

function extractJobSection(workflowText, jobName) {
  const lines = workflowText.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line === `  ${jobName}:`);
  assert.notEqual(startIndex, -1, `Expected job "${jobName}" in ci.yml`);

  const section = [];
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^  [a-zA-Z0-9_-]+:\s*$/.test(line)) {
      break;
    }
    section.push(line);
  }
  return section.join("\n");
}

test("ci.yml enables push, pull_request, and workflow_dispatch triggers", () => {
  const workflow = fs.readFileSync(ciWorkflowPath, "utf8");

  assert.doesNotMatch(workflow, /^# Passive: not run on push\/PR/m);
  assert.match(workflow, /^\s*push:\s*$/m);
  assert.match(workflow, /^\s*pull_request:\s*$/m);
  assert.match(workflow, /^\s*workflow_dispatch:\s*$/m);
});

test("contracts and frontend jobs are required gates with dbus-safe Stellar CLI setup", () => {
  const workflow = fs.readFileSync(ciWorkflowPath, "utf8");
  const contractsJob = extractJobSection(workflow, "contracts");
  const frontendJob = extractJobSection(workflow, "frontend");
  const e2eJob = extractJobSection(workflow, "e2e");

  assert.doesNotMatch(contractsJob, /^\s*continue-on-error:\s*true\s*$/m);
  assert.doesNotMatch(frontendJob, /^\s*continue-on-error:\s*true\s*$/m);
  assert.match(e2eJob, /^\s*continue-on-error:\s*true\s*$/m);

  assert.match(
    contractsJob,
    /libdbus-1-dev|stellar-cli-.*-x86_64-unknown-linux-gnu\.tar\.gz/,
  );
  assert.match(contractsJob, /cd contracts && cargo test/);
  assert.match(
    contractsJob,
    /cd contracts && CARGO_TARGET_DIR=target stellar contract build/,
  );

  assert.match(frontendJob, /npm run check:workspace/);
  assert.match(frontendJob, /npm run lint/);
  assert.match(frontendJob, /npm run typecheck --workspace=web/);
  assert.match(frontendJob, /npm run test --workspace=web/);
  assert.match(frontendJob, /npm run build --workspace=web/);
});

test("README documents Continuous Integration gates and local verification commands", () => {
  const readme = fs.readFileSync(readmePath, "utf8");

  assert.match(readme, /## Continuous Integration \(CI\)/);
  assert.match(readme, /pull_request/);
  assert.match(readme, /npm run test:contracts/);
  assert.match(readme, /npm run build:contracts/);
  assert.match(readme, /npm run check:workspace/);
});
