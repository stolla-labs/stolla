import {
  PROPOSAL_METADATA_LIMITS,
  PROPOSAL_METADATA_PREFIX,
  PROPOSAL_METADATA_V2_PREFIX,
} from "./constants";
import type {
  ProposalMetadata,
  ProposalMetadataDraft,
  ProposalMetadataErrors,
} from "./types";

export function countUnicodeCharacters(value: string): number {
  return Array.from(value).length;
}

export function normalizeDiscussionUrl(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

export function isSafeDiscussionUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

const PROPOSAL_ID = /^[0-9a-f]{64}$/;

/**
 * A supersede link as it is stored: lowercase hex, or null.
 *
 * Proposal ids are hashes, so the only difference between two spellings of
 * the same id is case. Normalizing here means a creator who pasted an id
 * copied from an uppercase display still links the same proposal, rather than
 * recording a link that resolves to nothing.
 */
export function normalizeSupersedes(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase() ?? "";
  return trimmed || null;
}

export function isProposalIdShape(value: string): boolean {
  return PROPOSAL_ID.test(value);
}

function tooLong(value: string, limit: number): boolean {
  return countUnicodeCharacters(value) > limit;
}

export function validateProposalMetadataDraft(
  draft: ProposalMetadataDraft,
): ProposalMetadataErrors {
  const errors: ProposalMetadataErrors = {};
  const title = draft.title.trim();
  const summary = draft.summary.trim();
  const body = draft.body.trim();
  const discussionUrl = normalizeDiscussionUrl(draft.discussionUrl);
  const supersedes = normalizeSupersedes(draft.supersedes);

  if (!title) errors.title = "Title is required.";
  else if (tooLong(title, PROPOSAL_METADATA_LIMITS.title)) {
    errors.title = `Title must be ${PROPOSAL_METADATA_LIMITS.title} characters or fewer.`;
  }

  if (!summary) errors.summary = "Summary is required.";
  else if (tooLong(summary, PROPOSAL_METADATA_LIMITS.summary)) {
    errors.summary = `Summary must be ${PROPOSAL_METADATA_LIMITS.summary} characters or fewer.`;
  }

  if (!body) errors.body = "Body is required.";
  else if (tooLong(body, PROPOSAL_METADATA_LIMITS.body)) {
    errors.body = `Body must be ${PROPOSAL_METADATA_LIMITS.body} characters or fewer.`;
  }

  if (discussionUrl) {
    if (tooLong(discussionUrl, PROPOSAL_METADATA_LIMITS.discussionUrl)) {
      errors.discussionUrl = `Discussion link must be ${PROPOSAL_METADATA_LIMITS.discussionUrl} characters or fewer.`;
    } else if (!isSafeDiscussionUrl(discussionUrl)) {
      errors.discussionUrl =
        "Discussion link must be an HTTPS URL without embedded credentials.";
    }
  }

  if (supersedes && !isProposalIdShape(supersedes)) {
    errors.supersedes =
      "Superseded proposal must be a 64-character proposal id (hex).";
  }

  if (
    !errors.title &&
    !errors.summary &&
    !errors.body &&
    !errors.discussionUrl &&
    !errors.supersedes
  ) {
    /* Measured as the envelope that will actually be written — v2 only when
       there is a link to record, so the extra key never charges a proposal
       that has none. */
    const envelope = supersedes
      ? `${PROPOSAL_METADATA_V2_PREFIX}${JSON.stringify({
          version: 2,
          title,
          summary,
          body,
          discussionUrl,
          supersedes,
        })}`
      : `${PROPOSAL_METADATA_PREFIX}${JSON.stringify({
          version: 1,
          title,
          summary,
          body,
          discussionUrl,
        })}`;
    if (
      new TextEncoder().encode(envelope).byteLength >
      PROPOSAL_METADATA_LIMITS.envelopeBytes
    ) {
      errors.envelope = "Combined metadata must fit within 8,192 UTF-8 bytes.";
    }
  }

  return errors;
}

/** Normalizes to v2 when there is a link to record, and to v1 when there is not. */
export function normalizeProposalMetadataDraft(
  draft: ProposalMetadataDraft,
): ProposalMetadata {
  const common = {
    title: draft.title.trim(),
    summary: draft.summary.trim(),
    body: draft.body.trim(),
    discussionUrl: normalizeDiscussionUrl(draft.discussionUrl),
  };
  const supersedes = normalizeSupersedes(draft.supersedes);

  return supersedes
    ? { version: 2, ...common, supersedes }
    : { version: 1, ...common };
}

/** The forward supersede link of any envelope version. v1 never has one. */
export function supersedesOf(metadata: ProposalMetadata | null | undefined): string | null {
  if (!metadata || metadata.version !== 2) return null;
  return metadata.supersedes;
}

export function hasProposalMetadataErrors(
  errors: ProposalMetadataErrors,
): boolean {
  return Object.keys(errors).length > 0;
}
