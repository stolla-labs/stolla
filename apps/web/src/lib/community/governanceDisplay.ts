/**
 * Ledger time helpers for governance display (issue #262 N6.02, N6.06).
 *
 * Stellar closes ledgers ~every 5 seconds (ADR-006 confirms 5s for
 * MIN_DELAY_LEDGERS). We keep exact ledger counts authoritative and show
 * approximate human durations as supplemental info only.
 */

export const STELLAR_LEDGER_CLOSE_SECONDS = 5;

export const LEDGER_TIME_ASSUMPTION_NOTE =
  "assumes ~5s per ledger — ledgers are authoritative";

export function formatLedgerDuration(ledgers: number | null): string | null {
  if (ledgers === null || !Number.isSafeInteger(ledgers) || ledgers < 0) return null;
  if (ledgers === 0) return "~0s";
  const totalSeconds = ledgers * STELLAR_LEDGER_CLOSE_SECONDS;
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds && parts.length === 0) parts.push(`${seconds}s`);
  // Keep to at most 2 most significant parts for brevity.
  return `|~${parts.slice(0, 2).join(" ")}`;
}

export const GOVERNANCE_HELPERS: Record<string, string> = {
  proposalThreshold: "Votes needed to create a proposal (prevents spam).",
  quorum: "Votes needed for a proposal to pass once voting ends.",
  votingDelay: "Ledgers after creation before voting starts (time to review).",
  votingPeriod: "Voting window length — how long votes can be cast.",
};

/**
 * Proposal action availability for the community-scoped detail page.
 *
 * The current signaling Governor model exposes two mutating actions after voting:
 * - cancel: proposer-only, while the proposal is still cancellable.
 * - execute: permissionless, once the proposal has succeeded.
 *
 * The function is pure so the visible/hidden matrix can be unit tested
 * without any live RPC.
 */

export type ProposalActionState =
  | "Pending"
  | "Active"
  | "Defeated"
  | "Succeeded"
  | "Canceled"
  | "Executed"
  | "Queued"
  | "Expired"
  | unknown;

export interface ProposalActionInput {
  state: ProposalActionState;
  /** Whether the connected wallet is the proposal proposer. */
  isProposer: boolean;
  /** Whether a wallet is connected at all. */
  isWalletConnected: boolean;
  /** Whether the connected wallet is on the expected network. */
  isCorrectNetwork: boolean;
}

export interface ProposalActionAvailability {
  /** Proposer-only cancel is available and would be accepted by the contract. */
  canCancel: boolean;
  /** Permissionless execute is available and would be accepted by the contract. */
  canExecute: boolean;
  /** The action is visible but blocked because the wallet is not connected. */
  blockedByWallet: boolean;
  /** The action is visible but blocked because the wallet is on the wrong network. */
  blockedByNetwork: boolean;
  /** The action is visible but blocked because the wallet is not authorized. */
  blockedByAuthorization: boolean;
}

const CANCELLABLE_STATES: Readonly Set<ProposalActionState> = new Set([
  "Pending",
  "Active",
  "Queued",
]);

const EXECUTABLE_STATES: Readonly Set<ProposalActionState> = new Set(["Succeeded"]);

export function isCancellableState(state: ProposalActionState): boolean {
  return CANCELLABLE_STATES.has(state);
}

export function isExecutableState(state: ProposalActionState): boolean {
  return EXECUTABLE_STATES.has(state);
}

/**
 * Compute the visible/enabled matrix for the proposal detail actions.
 *
 * Visibility releses on state and role only; connectivity and network
 * only gate whether the visible action is currently enabled. This keeps the
 * "non-proposers never see a working Cancel action" acceptance criterion
 * true even when the wallet is disconnected or on the wrong network.
 */
export function getProposalActionAvailability(
  input: ProposalActionInput,
): ProposalActionAvailability {
  const { state, isProposer, isWalletConnected, isCorrectNetwork } = input;

  const cancelVisible = isProposer && isCancellableState(state);
  const executeVisible = isExecutableState(state);

  const blockedByWallet = !isWalletConnected;
  const blockedByNetwork = isWalletConnected && !isCorrectNetwork;
  const blockedByAuthorization = false;

  const canCancel =
    cancelVisible && isWalletConnected && isCorrectNetwork;
  const canExecute =
    executeVisible && isWalletConnected && isCorrectNetwork;

  return {
    canCancel,
    canExecute,
    blockedByWallet: (cancelVisible || executeVisible) && blockedByWallet,
    blockedByNetwork: (cancelVisible || executeVisible) && blockedByNetwork,
    blockedByAuthorization,
  };
}
