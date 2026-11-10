import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../../../../");

describe("Membership revoke/burn policy documentation (#402)", () => {
  it("documents the contract audit decision and workarounds in ADR-001 and contracts/README.md", () => {
    const adr001 = fs.readFileSync(
      path.join(repoRoot, "docs/adr/001-nft-voting-model.md"),
      "utf8",
    );
    const contractsReadme = fs.readFileSync(
      path.join(repoRoot, "contracts/README.md"),
      "utf8",
    );

    expect(adr001).toContain("Membership Token Revocation and Burn Policy (#402)");
    expect(adr001).toContain("NonFungibleBurnable");
    expect(adr001).toContain("Operational Workarounds for Compromised Member Keys");
    expect(contractsReadme).toContain("FAQ: Membership Revocation & Burn");
  });

  it("ensures community NFT contract and web UI do not expose a no-op revoke/burn action", () => {
    const nftContract = fs.readFileSync(
      path.join(repoRoot, "contracts/contracts/community-nft/src/lib.rs"),
      "utf8",
    );
    const communityPage = fs.readFileSync(
      path.join(repoRoot, "apps/web/src/app/(app)/community/page.tsx"),
      "utf8",
    );

    expect(nftContract).not.toMatch(/pub fn (burn|revoke)\b/);
    expect(communityPage).not.toMatch(/Revoke membership|Burn NFT/i);
  });
});
