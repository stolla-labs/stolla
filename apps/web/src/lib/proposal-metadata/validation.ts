import {
  PROPOSAL_METADATA_LIMITS,
  PROPOSAL_METADATA_PREFIX,
} from "./constants";
import type {
  ProposalMetadataDraft,
  ProposalMetadataErrors,
  ProposalMetadataV1,
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

  if (!errors.title && !errors.summary && !errors.body && !errors.discussionUrl) {
    const envelope = `${PROPOSAL_METADATA_PREFIX}${JSON.stringify({
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

export function normalizeProposalMetadataDraft(
  draft: ProposalMetadataDraft,
): ProposalMetadataV1 {
  return {
    version: 1,
    title: draft.title.trim(),
    summary: draft.summary.trim(),
    body: draft.body.trim(),
    discussionUrl: normalizeDiscussionUrl(draft.discussionUrl),
  };
}

export function hasProposalMetadataErrors(
  errors: ProposalMetadataErrors,
): boolean {
  return Object.keys(errors).length > 0;
}
