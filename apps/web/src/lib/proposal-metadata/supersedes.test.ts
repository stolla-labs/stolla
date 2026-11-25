import { describe, expect, it } from "vitest";
import {
  PROPOSAL_METADATA_PREFIX,
  PROPOSAL_METADATA_V2_PREFIX,
} from "./constants";
import { parseProposalDescription } from "./parse";
import { serializeProposalMetadata } from "./serialize";
import { supersedesOf, validateProposalMetadataDraft } from "./validation";

const OLDER = "a".repeat(64);

const DRAFT = {
  title: "Amended treasury allocation",
  summary: "Replaces the June allocation with corrected figures.",
  body: "The original proposal double counted the audit retainer.",
  discussionUrl: null,
};

describe("writing", () => {
  it("stays on v1 when nothing is replaced", () => {
    // A v1 reader can still read every proposal that has nothing extra to say.
    const envelope = serializeProposalMetadata(DRAFT);

    expect(envelope.startsWith(PROPOSAL_METADATA_PREFIX)).toBe(true);
    expect(envelope).not.toContain("supersedes");
  });

  it("stays on v1 when the link is blank", () => {
    expect(
      serializeProposalMetadata({ ...DRAFT, supersedes: "   " }).startsWith(
        PROPOSAL_METADATA_PREFIX,
      ),
    ).toBe(true);
  });

  it("writes v2 when a proposal replaces another", () => {
    const envelope = serializeProposalMetadata({ ...DRAFT, supersedes: OLDER });

    expect(envelope.startsWith(PROPOSAL_METADATA_V2_PREFIX)).toBe(true);
    expect(envelope.split("\n")[1]).toBe(
      JSON.stringify({
        version: 2,
        title: DRAFT.title,
        summary: DRAFT.summary,
        body: DRAFT.body,
        discussionUrl: null,
        supersedes: OLDER,
      }),
    );
  });

  it("writes the id in the one spelling a reader will compare", () => {
    const envelope = serializeProposalMetadata({ ...DRAFT, supersedes: OLDER.toUpperCase() });

    expect(envelope).toContain(OLDER);
    expect(envelope).not.toContain(OLDER.toUpperCase());
  });

  it("refuses a link that is not a proposal id", () => {
    expect(validateProposalMetadataDraft({ ...DRAFT, supersedes: "proposal-12" })).toEqual({
      supersedes: "Superseded proposal must be a 64-character proposal id (hex).",
    });
    expect(() => serializeProposalMetadata({ ...DRAFT, supersedes: "proposal-12" })).toThrow();
  });
});

describe("reading", () => {
  it("round trips a v2 envelope", () => {
    const parsed = parseProposalDescription(
      serializeProposalMetadata({ ...DRAFT, supersedes: OLDER }),
    );

    expect(parsed.kind).toBe("versioned");
    if (parsed.kind !== "versioned") return;
    expect(parsed.metadata.version).toBe(2);
    expect(supersedesOf(parsed.metadata)).toBe(OLDER);
    expect(parsed.metadata.title).toBe(DRAFT.title);
  });

  it("still reads every v1 envelope ever written", () => {
    // Descriptions are immutable, so v1 proposals stay v1 forever.
    const parsed = parseProposalDescription(serializeProposalMetadata(DRAFT));

    expect(parsed.kind).toBe("versioned");
    if (parsed.kind !== "versioned") return;
    expect(parsed.metadata.version).toBe(1);
    expect(supersedesOf(parsed.metadata)).toBeNull();
  });

  it("treats a v1 envelope carrying a sixth key as plain text", () => {
    // The v1 contract says unknown keys invalidate the envelope. That rule is
    // why `supersedes` needed a version of its own.
    const smuggled = `${PROPOSAL_METADATA_PREFIX}${JSON.stringify({
      version: 1,
      ...DRAFT,
      supersedes: OLDER,
    })}`;

    expect(parseProposalDescription(smuggled).kind).toBe("legacy");
  });

  it("treats a v2 envelope with no link as plain text", () => {
    // Announcing v2 and then carrying nothing extra is a lie about what the
    // proposal says, and a partially trusted envelope is exactly what the
    // format contract forbids.
    const empty = `${PROPOSAL_METADATA_V2_PREFIX}${JSON.stringify({
      version: 2,
      ...DRAFT,
      supersedes: null,
    })}`;

    expect(parseProposalDescription(empty).kind).toBe("legacy");
  });

  it("treats a v2 envelope missing the key as plain text", () => {
    const missing = `${PROPOSAL_METADATA_V2_PREFIX}${JSON.stringify({ version: 2, ...DRAFT })}`;

    expect(parseProposalDescription(missing).kind).toBe("legacy");
  });

  it("treats a version the prefix does not match as plain text", () => {
    const mismatched = `${PROPOSAL_METADATA_V2_PREFIX}${JSON.stringify({
      version: 1,
      ...DRAFT,
      supersedes: OLDER,
    })}`;

    expect(parseProposalDescription(mismatched).kind).toBe("legacy");
  });
});
