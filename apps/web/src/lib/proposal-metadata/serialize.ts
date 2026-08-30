import {
  PROPOSAL_METADATA_LIMITS,
  PROPOSAL_METADATA_PREFIX,
} from "./constants";
import type { ProposalMetadataDraft } from "./types";
import {
  hasProposalMetadataErrors,
  normalizeProposalMetadataDraft,
  validateProposalMetadataDraft,
} from "./validation";

/** Serialize using a fixed key order so identical Unicode input is deterministic. */
export function serializeProposalMetadata(draft: ProposalMetadataDraft): string {
  const errors = validateProposalMetadataDraft(draft);
  if (hasProposalMetadataErrors(errors)) {
    throw new Error(Object.values(errors)[0] ?? "Proposal metadata is invalid.");
  }

  const metadata = normalizeProposalMetadataDraft(draft);
  const envelope = `${PROPOSAL_METADATA_PREFIX}${JSON.stringify({
    version: metadata.version,
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
