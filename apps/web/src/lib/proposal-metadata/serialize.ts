import {
  PROPOSAL_METADATA_LIMITS,
  PROPOSAL_METADATA_PREFIX,
  PROPOSAL_METADATA_V2_PREFIX,
} from "./constants";
import type { ProposalMetadataDraft } from "./types";
import {
  hasProposalMetadataErrors,
  normalizeProposalMetadataDraft,
  validateProposalMetadataDraft,
} from "./validation";

/**
 * Serialize using a fixed key order so identical Unicode input is
 * deterministic.
 *
 * The version written is decided by the content, not by the caller: v2 when
 * the draft records a supersede link, and v1 when it does not. That keeps the
 * envelope a v1 reader cannot parse off every proposal that has nothing extra
 * to say — see `PROPOSAL_METADATA_V2_PREFIX`.
 */
export function serializeProposalMetadata(draft: ProposalMetadataDraft): string {
  const errors = validateProposalMetadataDraft(draft);
  if (hasProposalMetadataErrors(errors)) {
    throw new Error(Object.values(errors)[0] ?? "Proposal metadata is invalid.");
  }

  const metadata = normalizeProposalMetadataDraft(draft);
  const envelope =
    metadata.version === 2
      ? `${PROPOSAL_METADATA_V2_PREFIX}${JSON.stringify({
          version: 2,
          title: metadata.title,
          summary: metadata.summary,
          body: metadata.body,
          discussionUrl: metadata.discussionUrl,
          supersedes: metadata.supersedes,
        })}`
      : `${PROPOSAL_METADATA_PREFIX}${JSON.stringify({
          version: 1,
          title: metadata.title,
          summary: metadata.summary,
          body: metadata.body,
          discussionUrl: metadata.discussionUrl,
        })}`;

  if (new TextEncoder().encode(envelope).byteLength > PROPOSAL_METADATA_LIMITS.envelopeBytes) {
    throw new Error(
      `Serialized proposal metadata exceeds ${PROPOSAL_METADATA_LIMITS.envelopeBytes} bytes.`,
    );
  }
  return envelope;
}
