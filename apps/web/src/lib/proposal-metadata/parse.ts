import {
  PROPOSAL_METADATA_LIMITS,
  PROPOSAL_METADATA_PREFIX,
} from "./constants";
import type {
  ParsedProposalDescription,
  ProposalMetadataDraft,
} from "./types";
import {
  hasProposalMetadataErrors,
  normalizeProposalMetadataDraft,
  validateProposalMetadataDraft,
} from "./validation";

function isExactEnvelopeShape(value: unknown): value is ProposalMetadataDraft & {
  version: 1;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  return (
    keys.length === 5 &&
    keys.every((key) =>
      ["version", "title", "summary", "body", "discussionUrl"].includes(key),
    ) &&
    record.version === 1 &&
    typeof record.title === "string" &&
    typeof record.summary === "string" &&
    typeof record.body === "string" &&
    (record.discussionUrl === null || typeof record.discussionUrl === "string")
  );
}

/** Parse v1 envelopes; every unknown, invalid, or legacy value stays plain text. */
export function parseProposalDescription(raw: string): ParsedProposalDescription {
  if (!raw.startsWith(PROPOSAL_METADATA_PREFIX)) {
    return { kind: "legacy", metadata: null, raw };
  }
  if (new TextEncoder().encode(raw).byteLength > PROPOSAL_METADATA_LIMITS.envelopeBytes) {
    return { kind: "legacy", metadata: null, raw };
  }

  try {
    const candidate: unknown = JSON.parse(raw.slice(PROPOSAL_METADATA_PREFIX.length));
    if (!isExactEnvelopeShape(candidate)) {
      return { kind: "legacy", metadata: null, raw };
    }
    const errors = validateProposalMetadataDraft(candidate);
    if (hasProposalMetadataErrors(errors)) {
      return { kind: "legacy", metadata: null, raw };
    }
    return {
      kind: "versioned",
      metadata: normalizeProposalMetadataDraft(candidate),
      raw,
    };
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
