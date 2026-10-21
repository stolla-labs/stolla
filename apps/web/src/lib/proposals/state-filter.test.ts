import { describe, expect, it } from "vitest";
import { ProposalState } from "@/lib/proposalState";
import { parseProposalStateQuery, serializeProposalStateQuery } from "./state-filter";

describe("proposal state query", () => {
  it("parses a known state and serializes it", () => {
    expect(parseProposalStateQuery("active")).toBe(ProposalState.Active);
    expect(serializeProposalStateQuery(ProposalState.Succeeded)).toBe("succeeded");
  });

  it("falls back to all for unknown values", () => {
    expect(parseProposalStateQuery("nope")).toBe("all");
    expect(parseProposalStateQuery(null)).toBe("all");
  });

  it("clears the query when the filter returns to all", () => {
    expect(serializeProposalStateQuery("all")).toBeNull();
  });
});
