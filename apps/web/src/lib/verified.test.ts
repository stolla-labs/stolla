import { afterEach, describe, expect, it, vi } from "vitest";
import { isVerifiedCommunity, verifiedCommunityIds } from "@/lib/verified";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("verifiedCommunityIds", () => {
  it("is empty without a configured allowlist", () => {
    vi.stubEnv("NEXT_PUBLIC_VERIFIED_COMMUNITY_IDS", "");
    expect(verifiedCommunityIds().size).toBe(0);
  });

  it("parses a comma-separated allowlist and trims whitespace", () => {
    vi.stubEnv("NEXT_PUBLIC_VERIFIED_COMMUNITY_IDS", "GABC1, GDEF2 , GHIJ3");
    const ids = verifiedCommunityIds();
    expect(ids.has("GABC1")).toBe(true);
    expect(ids.has("GDEF2")).toBe(true);
    expect(ids.has("GHIJ3")).toBe(true);
    expect(ids.size).toBe(3);
  });
});

describe("isVerifiedCommunity", () => {
  it("returns false for communities outside the allowlist", () => {
    vi.stubEnv("NEXT_PUBLIC_VERIFIED_COMMUNITY_IDS", "GABC1");
    expect(isVerifiedCommunity("GUNKNOWN")).toBe(false);
  });

  it("returns true for communities in the allowlist", () => {
    vi.stubEnv("NEXT_PUBLIC_VERIFIED_COMMUNITY_IDS", "GABC1,GDEF2");
    expect(isVerifiedCommunity("GDEF2")).toBe(true);
  });
});
