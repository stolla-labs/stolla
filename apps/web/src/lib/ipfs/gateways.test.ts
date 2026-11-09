import { describe, expect, it } from "vitest";
import {
  DEFAULT_IPFS_FALLBACK_GATEWAYS,
  resolveCommunityResourceCandidates,
  resolveConfiguredIpfsGateways,
  selectActiveGatewayCandidate,
} from "./gateways";

describe("IPFS gateway failover helpers", () => {
  it("builds ordered, deduplicated gateway URLs with primary first", () => {
    const gateways = resolveConfiguredIpfsGateways({
      NEXT_PUBLIC_IPFS_GATEWAY_URL: "https://gateway.pinata.cloud/ipfs",
    });

    expect(gateways[0]).toBe("https://gateway.pinata.cloud/ipfs/");
    expect(gateways).toContain("https://ipfs.io/ipfs/");
    expect(gateways).toContain("https://cloudflare-ipfs.com/ipfs/");
  });

  it("supports custom NEXT_PUBLIC_IPFS_FALLBACK_GATEWAY_URLS list and ignores non-https entries", () => {
    const gateways = resolveConfiguredIpfsGateways({
      NEXT_PUBLIC_IPFS_GATEWAY_URL: "https://primary.example/ipfs/",
      NEXT_PUBLIC_IPFS_FALLBACK_GATEWAY_URLS:
        "http://insecure.example/ipfs/, https://backup1.example/ipfs, https://primary.example/ipfs/, https://backup2.example/ipfs/",
    });

    expect(gateways).toEqual([
      "https://primary.example/ipfs/",
      "https://backup1.example/ipfs/",
      "https://backup2.example/ipfs/",
    ]);
  });

  it("resolves ipfs:// logo URIs across primary and fallback gateways and fails over to null after total failure", () => {
    const candidates = resolveCommunityResourceCandidates(
      "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi/logo.png",
      {
        NEXT_PUBLIC_IPFS_GATEWAY_URL: "https://primary.example/ipfs/",
        NEXT_PUBLIC_IPFS_FALLBACK_GATEWAY_URLS:
          "https://secondary.example/ipfs/,https://tertiary.example/ipfs/",
      },
    );

    expect(candidates).toEqual([
      "https://primary.example/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi/logo.png",
      "https://secondary.example/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi/logo.png",
      "https://tertiary.example/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi/logo.png",
    ]);

    // Primary succeeds initially
    expect(selectActiveGatewayCandidate(candidates, 0)).toBe(candidates[0]);
    // Primary fails -> failover to secondary
    expect(selectActiveGatewayCandidate(candidates, 1)).toBe(candidates[1]);
    // Secondary fails -> failover to tertiary
    expect(selectActiveGatewayCandidate(candidates, 2)).toBe(candidates[2]);
    // All gateways fail -> returns null so CommunityAvatar renders placeholder
    expect(selectActiveGatewayCandidate(candidates, 3)).toBeNull();
  });

  it("preserves direct https:// URLs as a single candidate and rejects unsupported schemes", () => {
    expect(
      resolveCommunityResourceCandidates("https://cdn.example.org/logo.png"),
    ).toEqual(["https://cdn.example.org/logo.png"]);

    expect(
      resolveCommunityResourceCandidates("javascript:alert(1)"),
    ).toEqual([]);
    expect(resolveCommunityResourceCandidates("")).toEqual([]);
    expect(DEFAULT_IPFS_FALLBACK_GATEWAYS.length).toBeGreaterThanOrEqual(2);
  });
});
