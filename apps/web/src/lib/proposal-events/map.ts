import type {
  ProposalCreatedEventData,
  ProposalEventRpcMetadata,
  ProposalSummary,
} from "./types";
import { parseProposalDescription } from "@/lib/proposal-metadata";

/**
 * Maps a decoded ProposalCreated event and its RPC/indexer metadata into a
 * stable {@link ProposalSummary}.
 *
 * Design notes:
 * - No field is invented: missing optional fields become `null`.
 * - The proposalId is always returned in lowercase hex so all consumers
 *   share the same canonical format.
 * - The mapper is a pure function with no side-effects, no React imports,
 *   and no localStorage access — it can run in Node, a browser, or a
 *   server-side indexer worker.
 *
 * @param governorContractId - Stellar account ID of the Governor contract
 *   that emitted the event.  Passed separately so the mapper does not
 *   need to read global config.
 * @param event - Decoded event data.
 * @param meta  - RPC / indexer metadata for the containing transaction.
 * @returns A fully-populated ProposalSummary.
 */
export function mapProposalCreatedEvent(
  governorContractId: string,
  event: ProposalCreatedEventData,
  meta: ProposalEventRpcMetadata,
): ProposalSummary {
  const parsed = parseProposalDescription(event.description);
  return {
    proposalId: event.proposalId.toLowerCase(),
    governorContractId,
    proposer: event.proposer ?? null,
    creationLedger: meta.ledger,
    txHash: meta.txHash,
    cursor: meta.cursor ?? null,
    voteSnapshot: event.voteSnapshot,
    voteEnd: event.voteEnd,
    description: event.description,
    metadata: parsed.kind === "versioned" ? parsed.metadata : null,
  };
}
