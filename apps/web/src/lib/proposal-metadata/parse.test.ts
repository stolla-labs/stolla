import { describe, expect, it } from "vitest";
import { PROPOSAL_METADATA_PREFIX } from "./constants";
import { LEGACY_PROPOSAL_DESCRIPTION } from "./fixtures";
import { parseProposalDescription, proposalSummary, proposalTitle } from "./parse";

describe("proposal metadata parsing", () => {
  it("keeps legacy free text readable", () => {
    expect(parseProposalDescription(LEGACY_PROPOSAL_DESCRIPTION)).toEqual({
      kind: "legacy",
      metadata: null,
      raw: LEGACY_PROPOSAL_DESCRIPTION,
    });
    expect(proposalTitle(LEGACY_PROPOSAL_DESCRIPTION)).toBeNull();
    expect(proposalSummary(LEGACY_PROPOSAL_DESCRIPTION)).toBe(
      LEGACY_PROPOSAL_DESCRIPTION,
    );
  });

  it.each([
    "not-json",
    '{"version":2,"title":"x","summary":"y","body":"z","discussionUrl":null}',
    '{"version":1,"title":"","summary":"y","body":"z","discussionUrl":null}',
    '{"version":1,"title":"x","summary":"y","body":"z","discussionUrl":null,"extra":true}',
  ])("treats malformed or unknown envelopes as safe plain text", (payload) => {
    const raw = `${PROPOSAL_METADATA_PREFIX}${payload}`;
    expect(parseProposalDescription(raw)).toEqual({
      kind: "legacy",
      metadata: null,
      raw,
    });
  });
});
