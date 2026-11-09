import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

test("community-nft omits unilateral owner burn/revoke and docs record ADR-001 decision and FAQ", () => {
  const nftLib = fs.readFileSync(
    path.join(rootDir, "contracts", "contracts", "community-nft", "src", "lib.rs"),
    "utf8",
  );
  const adr001 = fs.readFileSync(
    path.join(rootDir, "docs", "adr", "001-nft-voting-model.md"),
    "utf8",
  );
  const contractsReadme = fs.readFileSync(
    path.join(rootDir, "contracts", "README.md"),
    "utf8",
  );
  const rootReadme = fs.readFileSync(path.join(rootDir, "README.md"), "utf8");

  assert.doesNotMatch(nftLib, /pub fn revoke\b|pub fn burn\b|NonFungibleBurnable/);
  assert.match(adr001, /No unilateral owner revoke or burn/);
  assert.match(adr001, /Workaround for compromised or departing members/);
  assert.match(contractsReadme, /Membership revocation and burn policy/);
  assert.match(rootReadme, /### FAQ: Can a community owner revoke or burn a membership NFT\?/);
});
