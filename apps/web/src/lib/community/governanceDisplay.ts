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
  return `~${parts.slice(0, 2).join(" ")}`;
}

export const GOVERNANCE_HELPERS: Record<string, string> = {
  proposalThreshold: "Votes needed to create a proposal (prevents spam).",
  quorum: "Votes needed for a proposal to pass once voting ends.",
  votingDelay: "Ledgers after creation before voting starts (time to review).",
  votingPeriod: "Voting window length — how long votes can be cast.",
};
