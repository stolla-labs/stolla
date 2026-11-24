import { describe, expect, it } from "vitest";
import {
  buildProposalShareText,
  buildWarpcastIntentUrl,
  buildXIntentUrl,
  truncateShareText,
} from "@/lib/shareIntent";

const CANONICAL_URL =
  "https://stolla.app/communities/GABC1234/proposals/0123456789abcdef";

describe("truncateShareText", () => {
  it("keeps text that already fits the budget", () => {
    expect(truncateShareText("short", CANONICAL_URL, 280, 23)).toBe("short");
  });

  it("truncates text that overflows the URL-aware budget", () => {
    const long = "x".repeat(300);
    const result = truncateShareText(long, CANONICAL_URL, 280, 23);
    expect(result.endsWith("\u2026")).toBe(true);
    expect(result.length + 1 + CANONICAL_URL.length).toBeLessThanOrEqual(280);
  });
});

describe("buildXIntentUrl", () => {
  it("encodes text and URL into the X compose intent", () => {
    const url = buildXIntentUrl("View this proposal on Stolla", CANONICAL_URL);
    expect(url).toMatch(/^https:\/\/twitter\.com\/intent\/tweet\?/);
    expect(url).toContain("text=");
    expect(url).toContain("url=");
    // The canonical URL must survive verbatim once decoded.
    expect(url).toContain(encodeURIComponent(CANONICAL_URL));
  });
});

describe("buildWarpcastIntentUrl", () => {
  it("encodes text and embeds the URL into the Warpcast compose intent", () => {
    const url = buildWarpcastIntentUrl("View this proposal on Stolla", CANONICAL_URL);
    expect(url).toMatch(/^https:\/\/warpcast\.com\/~\/compose\?/);
    expect(url).toContain("text=");
    expect(url).toContain("embeds%5B%5D=");
    expect(url).toContain(encodeURIComponent(CANONICAL_URL));
  });
});

describe("buildProposalShareText", () => {
  it("uses the proposal title when provided", () => {
    expect(buildProposalShareText("Treasury rebalance")).toBe(
      "View Treasury rebalance on Stolla",
    );
  });

  it("falls back to a generic label", () => {
    expect(buildProposalShareText(null)).toBe("View this proposal on Stolla");
    expect(buildProposalShareText("  ")).toBe("View this proposal on Stolla");
  });
});
