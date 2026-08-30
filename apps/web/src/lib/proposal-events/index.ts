/**
 * Public API for Governor proposal / vote event discovery.
 *
 * Global legacy and Community-scoped surfaces should import from this
 * barrel so queries, decode, pagination, mapping, dedupe, and vote
 * aggregation stay on one pipeline.
 */

export {
  PROPOSAL_EVENT_KINDS,
  PROPOSAL_EVENT_NAMES,
  type ProposalEventKind,
  type ProposalEventName,
} from "./kinds";

export {
  getProposalEvents,
  type ProposalEventsPage,
} from "./query";

export {
  fetchGovernorEvents,
  type EventPage,
  type FetchGovernorEventsOptions,
} from "./paginate";

export {
  decodeProposalEvent,
  type ProposalEventInput,
  type ProposalCreatedEvent,
  type VoteCastEvent,
  type ProposalQueuedEvent,
  type ProposalExecutedEvent,
  type ProposalCancelledEvent,
  type ProposalEvent,
  type DecodeFailureReason,
  type ProposalEventResult,
  type DecodeProposalEventOptions,
} from "./decode";

export type {
  ProposalSummary,
  ProposalCreatedEventData,
  ProposalEventRpcMetadata,
} from "./types";

export { mapProposalCreatedEvent } from "./map";

export {
  dedupeProposalSummaries,
  proposalRowIdentity,
  stableEventIdentity,
  type ProposalDiscoveryIdentityFields,
} from "./dedupe";

export {
  fetchVoteTotals,
  type VoteTotals,
  type VoteAggregationResult,
} from "./votes";

export {
  discoverProposals,
  getLegacyLocalProposalIds,
  type PublicProposalSummary,
  type ProposalSource,
  type DiscoveredProposal,
} from "./discovery-merge";

export {
  createClientFreshnessStub,
  type ProposalSyncStatus,
  type ProposalFreshness,
  type ProposalSyncState,
  type ClientFreshnessStubOptions,
} from "./freshness";
