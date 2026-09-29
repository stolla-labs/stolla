import { formatLedgerDuration } from "@/lib/community/governanceDisplay";

/** An estimate from the last known ledger, or the scheduled voting window. */
export function formatProposalDeadlineEstimate(
  deadlineLedger: number | null | undefined,
  currentLedger: number | null | undefined,
  snapshotLedger: number | null | undefined,
): string | null {
  if (typeof deadlineLedger !== "number" || !Number.isSafeInteger(deadlineLedger) || deadlineLedger < 0) return null;

  if (typeof currentLedger === "number" && Number.isSafeInteger(currentLedger) && currentLedger >= 0) {
    if (currentLedger >= deadlineLedger) {
      const overdue = formatLedgerDuration(currentLedger - deadlineLedger);
      return overdue ? `Approx. ${overdue} past deadline at last scan` : null;
    }
    const remaining = formatLedgerDuration(deadlineLedger - currentLedger);
    return remaining ? `Approx. ${remaining} remaining at last scan` : null;
  }

  if (
    typeof snapshotLedger === "number" &&
    Number.isSafeInteger(snapshotLedger) &&
    snapshotLedger >= 0 &&
    snapshotLedger <= deadlineLedger
  ) {
    const window = formatLedgerDuration(deadlineLedger - snapshotLedger);
    return window ? `Approx. voting window: ${window}` : null;
  }

  return null;
}
