export type {
  ProposalSummary,
  ProposalCreatedEventData,
  ProposalEventRpcMetadata,
} from "./types";

export { mapProposalCreatedEvent } from "./mapper";

export {
  dedupeProposalSummaries,
  proposalRowIdentity,
  stableEventIdentity,
} from "./dedupe";
export type { ProposalDiscoveryIdentityFields } from "./dedupe";

export {
  evaluateDiscoveryFreshness,
  CURRENT_THRESHOLD,
  STALE_THRESHOLD,
} from "./freshness";
export type { FreshnessState, FreshnessMetadata, FreshnessResult } from "./freshness";
