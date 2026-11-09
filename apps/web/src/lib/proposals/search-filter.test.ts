import { describe, expect, it } from "vitest";
import { serializeProposalMetadata } from "../proposal-metadata/serialize";
import {
  buildProposalSearchHref,
  extractProposalSearchText,
  filterProposalsBySearch,
  matchesProposalSearch,
  parseProposalSearchQuery,
  updateProposalSearchUrlParams,
} from "./search-filter";

const versionedTreasuryDescription = serializeProposalMetadata({
  title: "Increase Treasury Quorum Threshold",
  summary: "Raise the minimum quorum for treasury disbursements from 10% to 15%.",
  body: "Detailed rationale for increasing quorum.",
  discussionUrl: "https://forum.example.com/t/quorum/42",
});

const versionedGrantDescription = serializeProposalMetadata({
  title: "Fund Soroban Developer Workshop",
  summary: "Allocate 2,500 XLM to Q3 community education events.",
  body: "Breakdown of workshop milestones.",
  discussionUrl: null,
});

const legacyDescription = "Plain text legacy proposal about validator rotation";

const sampleProposals = [
  { id: "a1b2c3d4", status: "ready" as const },
  { id: "e5f60718", status: "ready" as const },
  { id: "99887766", status: "error" as const },
];

const descriptionsById: Record<string, string> = {
  a1b2c3d4: versionedTreasuryDescription,
  e5f60718: versionedGrantDescription,
  "99887766": legacyDescription,
};

describe("proposal search filter (#390)", () => {
  it("extracts versioned metadata title and summary as well as legacy raw descriptions", () => {
    const treasury = extractProposalSearchText(sampleProposals[0], descriptionsById);
    expect(treasury.title).toBe("Increase Treasury Quorum Threshold");
    expect(treasury.summary).toContain("10% to 15%");

    const legacy = extractProposalSearchText(sampleProposals[2], descriptionsById);
    expect(legacy.title).toBeNull();
    expect(legacy.summary).toBe(legacyDescription);
  });

  it("matches case-insensitively across title, summary, legacy text, and proposal ID", () => {
    expect(
      matchesProposalSearch(sampleProposals[0], "TREASURY QUORUM", descriptionsById),
    ).toBe(true);
    expect(
      matchesProposalSearch(sampleProposals[1], "2,500 xlm", descriptionsById),
    ).toBe(true);
    expect(
      matchesProposalSearch(sampleProposals[2], "VALIDATOR ROTATION", descriptionsById),
    ).toBe(true);
    expect(
      matchesProposalSearch(sampleProposals[0], "#A1B2", descriptionsById),
    ).toBe(true);
    expect(
      matchesProposalSearch(sampleProposals[0], "nonexistent keyword", descriptionsById),
    ).toBe(false);
  });

  it("restores the full loaded list when the search query is cleared", () => {
    const narrowed = filterProposalsBySearch(
      sampleProposals,
      "soroban",
      descriptionsById,
    );
    expect(narrowed.map((entry) => entry.id)).toEqual(["e5f60718"]);

    const restored = filterProposalsBySearch(sampleProposals, "   ", descriptionsById);
    expect(restored).toEqual(sampleProposals);
  });

  it("parses and updates URL search params while preserving existing state filter parameters", () => {
    expect(parseProposalSearchQuery("?state=active&q=treasury")).toBe("treasury");
    expect(parseProposalSearchQuery("?state=active")).toBe("");

    const withSearch = updateProposalSearchUrlParams(
      "?state=active&page=2",
      "  quorum   threshold ",
    );
    expect(withSearch).toBe("state=active&page=2&q=quorum+threshold");

    const cleared = updateProposalSearchUrlParams(withSearch, "");
    expect(cleared).toBe("state=active&page=2");

    expect(
      buildProposalSearchHref("/community/1/proposals", "?state=queued", "grant"),
    ).toBe("/community/1/proposals?state=queued&q=grant");
    expect(
      buildProposalSearchHref("/community/1/proposals", "?q=grant", " "),
    ).toBe("/community/1/proposals");
  });
});
