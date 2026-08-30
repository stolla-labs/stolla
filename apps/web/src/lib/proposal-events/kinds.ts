/**
 * Unified Governor proposal / vote event kind constants.
 *
 * `PROPOSAL_EVENT_KINDS` is the full decode surface (including
 * `proposal_queued`, which is defined upstream but not expected when
 * queuing is disabled). `PROPOSAL_EVENT_NAMES` is the query topic filter
 * set used by direct RPC discovery.
 */

export const PROPOSAL_EVENT_KINDS = [
  "proposal_created",
  "vote_cast",
  "proposal_queued",
  "proposal_executed",
  "proposal_cancelled",
] as const;

export type ProposalEventKind = (typeof PROPOSAL_EVENT_KINDS)[number];

/** Topic-filter names for `getEvents` proposal discovery queries. */
export const PROPOSAL_EVENT_NAMES = [
  "proposal_created",
  "proposal_executed",
  "proposal_cancelled",
  "vote_cast",
] as const;

export type ProposalEventName = (typeof PROPOSAL_EVENT_NAMES)[number];
