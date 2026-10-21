import {
  ProposalState,
  PROPOSAL_STATE_LABELS,
  PROPOSAL_STATE_ORDER,
} from "@/lib/proposalState";

export const ALL_PROPOSAL_STATES = "all" as const;
export type ProposalStateFilter = typeof ALL_PROPOSAL_STATES | ProposalState;

export function parseProposalStateQuery(value: string | null | undefined): ProposalStateFilter {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === ALL_PROPOSAL_STATES) return ALL_PROPOSAL_STATES;

  const match = PROPOSAL_STATE_ORDER.find(
    (state) => PROPOSAL_STATE_LABELS[state].toLowerCase() === normalized,
  );
  return match ?? ALL_PROPOSAL_STATES;
}

/** Returns null for All so the caller can drop the query parameter. */
export function serializeProposalStateQuery(filter: ProposalStateFilter): string | null {
  if (filter === ALL_PROPOSAL_STATES) return null;
  return PROPOSAL_STATE_LABELS[filter].toLowerCase();
}
