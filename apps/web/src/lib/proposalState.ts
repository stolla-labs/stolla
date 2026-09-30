import { ProposalState } from "@/lib/bindings/community-governor/src";

export { ProposalState };

export const PROPOSAL_STATE_LABELS: Record<ProposalState, string> = {
  [ProposalState.Pending]: "Pending",
  [ProposalState.Active]: "Active",
  [ProposalState.Defeated]: "Defeated",
  [ProposalState.Canceled]: "Canceled",
  [ProposalState.Succeeded]: "Succeeded",
  [ProposalState.Queued]: "Queued",
  [ProposalState.Expired]: "Expired",
  [ProposalState.Executed]: "Executed",
};

export const PROPOSAL_STATE_ORDER: ProposalState[] = [
  ProposalState.Pending,
  ProposalState.Active,
  ProposalState.Defeated,
  ProposalState.Canceled,
  ProposalState.Succeeded,
  ProposalState.Queued,
  ProposalState.Expired,
  ProposalState.Executed,
];

/**
 * States in which a proposal can be canceled by the proposer.
 */
export const CANCELLABLE_PROPOSAL_STATES: ReadonlySet<ProposalState> = new Set([
  ProposalState.Pending,
  ProposalState.Active,
]);

/**
 * States in which a proposal can be executed (permissionless).
 */
export const EXECUTABLE_PROPOSAL_STATES: ReadonlySet<ProposalState> = new Set([
  ProposalState.Succeeded,
]);

export function isProposalCancellable(state: ProposalState): boolean {
  return CANCELLABLE_PROPOSAL_STATES.has(state);
}

export function isProposalExecutable(state: ProposalState): boolean {
  return EXECUTABLE_PROPOSAL_STATES.has(state);
}
