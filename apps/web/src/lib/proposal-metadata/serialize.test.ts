import { describe, expect, it } from "vitest";
import { VERSIONED_PROPOSAL_DRAFT } from "./fixtures";
import { parseProposalDescription } from "./parse";
import { serializeProposalMetadata } from "./serialize";

describe("proposal metadata serialization", () => {
  it("round-trips Unicode deterministically", () => {
    const first = serializeProposalMetadata(VERSIONED_PROPOSAL_DRAFT);
    const second = serializeProposalMetadata({ ...VERSIONED_PROPOSAL_DRAFT });
    expect(first).toBe(second);
    expect(parseProposalDescription(first)).toEqual({
      kind: "versioned",
      metadata: { version: 1, ...VERSIONED_PROPOSAL_DRAFT },
      raw: first,
    });
  });

  it("normalizes outer whitespace without changing internal Unicode", () => {
    const serialized = serializeProposalMetadata({
      ...VERSIONED_PROPOSAL_DRAFT,
      title: "  İstanbul 🚀  ",
      discussionUrl: "  https://example.org/topic  ",
    });
    const parsed = parseProposalDescription(serialized);
    expect(parsed.kind).toBe("versioned");
    if (parsed.kind === "versioned") {
      expect(parsed.metadata.title).toBe("İstanbul 🚀");
      expect(parsed.metadata.discussionUrl).toBe("https://example.org/topic");
    }
  });

  it("rejects envelopes whose valid fields exceed the UTF-8 byte budget", () => {
    expect(() =>
      serializeProposalMetadata({
        title: "Title",
        summary: "Summary",
        body: "🚀".repeat(3_000),
        discussionUrl: null,
      }),
    ).toThrow(/8,192 UTF-8 bytes/);
  });
});
