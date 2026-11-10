import { describe, expect, it } from "vitest";
import { serializeProposalMetadata } from "@/lib/proposal-metadata";
import {
  filterProposalsBySearch,
  matchesProposalSearch,
  normalizeProposalSearchQuery,
} from "./search-filter";

describe("proposal search filter (#390)", () => {
  const v1Envelope = serializeProposalMetadata({
    title: "Upgrade Treasury Quorum",
    summary: "Increase quorum threshold for treasury disbursements",
    body: "Detailed governance rationale for Soroban treasury safety.",
    discussionUrl: "https://forum.example.org/t/12",
  });

  const proposals = [
    { id: "01a2", description: v1Envelope },
    { id: "02b4", description: "Legacy plain text proposal about liquidity grants" },
    { id: "03c6", description: null },
  ];

  it("normalizes whitespace and case in search queries", () => {
    expect(normalizeProposalSearchQuery("  Treasury  ")).toBe("treasury");
    expect(normalizeProposalSearchQuery(null)).toBe("");
  });

  it("matches by proposal ID (with or without leading #), v1 title/summary/body, and legacy description", () => {
    expect(matchesProposalSearch(proposals[0], "#01a2")).toBe(true);
    expect(matchesProposalSearch(proposals[0], "quorum")).toBe(true);
    expect(matchesProposalSearch(proposals[0], "disbursements")).toBe(true);
    expect(matchesProposalSearch(proposals[1], "liquidity")).toBe(true);
    expect(matchesProposalSearch(proposals[2], "quorum")).toBe(false);
  });

  it("filters a proposal list and returns all items when query is empty", () => {
    expect(filterProposalsBySearch(proposals, "")).toHaveLength(3);
    expect(filterProposalsBySearch(proposals, "treasury")).toEqual([proposals[0]]);
    expect(filterProposalsBySearch(proposals, "grants")).toEqual([proposals[1]]);
    expect(filterProposalsBySearch(proposals, "nonexistent")).toEqual([]);
  });
});
