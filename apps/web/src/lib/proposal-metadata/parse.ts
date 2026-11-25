import {
  PROPOSAL_METADATA_LIMITS,
  PROPOSAL_METADATA_PREFIX,
  PROPOSAL_METADATA_V2_PREFIX,
} from "./constants";
import type {
  ParsedProposalDescription,
  ProposalMetadataDraft,
} from "./types";
import {
  hasProposalMetadataErrors,
  normalizeProposalMetadataDraft,
  supersedesOf,
  validateProposalMetadataDraft,
} from "./validation";

type EnvelopeVersion = 1 | 2;

const ENVELOPE_KEYS: Record<EnvelopeVersion, readonly string[]> = {
  1: ["version", "title", "summary", "body", "discussionUrl"],
  2: ["version", "title", "summary", "body", "discussionUrl", "supersedes"],
};

function isExactEnvelopeShape(
  value: unknown,
  version: EnvelopeVersion,
): value is ProposalMetadataDraft & { version: EnvelopeVersion } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  const expected = ENVELOPE_KEYS[version];
  return (
    keys.length === expected.length &&
    keys.every((key) => expected.includes(key)) &&
    record.version === version &&
    typeof record.title === "string" &&
    typeof record.summary === "string" &&
    typeof record.body === "string" &&
    (record.discussionUrl === null || typeof record.discussionUrl === "string") &&
    /* v2 requires the key to be present — an envelope announcing v2 without it
       is as malformed as a v1 envelope with a sixth key. */
    (version === 1 ||
      record.supersedes === null ||
      typeof record.supersedes === "string")
  );
}

/**
 * Parse v1 and v2 envelopes; every unknown, invalid, or legacy value stays
 * plain text.
 *
 * Both versions are accepted on read, forever: a description is immutable
 * once its proposal exists, so every v1 envelope already written stays v1.
 */
export function parseProposalDescription(raw: string): ParsedProposalDescription {
  const version: EnvelopeVersion | null = raw.startsWith(PROPOSAL_METADATA_PREFIX)
    ? 1
    : raw.startsWith(PROPOSAL_METADATA_V2_PREFIX)
      ? 2
      : null;

  if (version === null) {
    return { kind: "legacy", metadata: null, raw };
  }
  if (new TextEncoder().encode(raw).byteLength > PROPOSAL_METADATA_LIMITS.envelopeBytes) {
    return { kind: "legacy", metadata: null, raw };
  }

  const prefix = version === 1 ? PROPOSAL_METADATA_PREFIX : PROPOSAL_METADATA_V2_PREFIX;

  try {
    const candidate: unknown = JSON.parse(raw.slice(prefix.length));
    if (!isExactEnvelopeShape(candidate, version)) {
      return { kind: "legacy", metadata: null, raw };
    }
    const errors = validateProposalMetadataDraft(candidate);
    if (hasProposalMetadataErrors(errors)) {
      return { kind: "legacy", metadata: null, raw };
    }
    const metadata = normalizeProposalMetadataDraft(candidate);

    /* A v2 envelope whose link normalizes away is not a v2 proposal: the
       normalizer would hand back v1 and the stated version would be a lie
       about what the proposal says. Legacy, like any other malformed value. */
    if (version === 2 && supersedesOf(metadata) === null) {
      return { kind: "legacy", metadata: null, raw };
    }

    return { kind: "versioned", metadata, raw };
  } catch {
    return { kind: "legacy", metadata: null, raw };
  }
}

export function proposalTitle(raw: string): string | null {
  const parsed = parseProposalDescription(raw);
  return parsed.kind === "versioned" ? parsed.metadata.title : null;
}

export function proposalSummary(raw: string): string {
  const parsed = parseProposalDescription(raw);
  return parsed.kind === "versioned" ? parsed.metadata.summary : raw.trim();
}
