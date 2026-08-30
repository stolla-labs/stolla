/**
 * Proposal discovery freshness evaluation.
 *
 * Derives a user-facing freshness label from the metadata returned by
 * paginated RPC event scans — never from wall-clock guesses alone.
 *
 * Thresholds follow PRD §5.1 as adapted for direct browser-to-RPC
 * discovery (no backend indexer):
 *
 *   Current    – scan completed, last event ledger within {@link CURRENT_THRESHOLD}
 *                of the RPC's latest ledger, no errors.
 *   Delayed    – scan completed but the gap between last event and latest
 *                ledger exceeds {@link CURRENT_THRESHOLD} and is within
 *                {@link STALE_THRESHOLD}.
 *   Stale      – gap exceeds {@link STALE_THRESHOLD}, or the RPC reported
 *                errors during pagination even though some data was returned.
 *   Unavailable – no data was returned (empty range or complete RPC failure).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FreshnessState = "current" | "delayed" | "stale" | "unavailable";

/**
 * Metadata extracted from paginated RPC event responses.
 * All fields are nullable because the RPC may not return them or the
 * discovery scan may not have reached a page that provides them.
 */
export interface FreshnessMetadata {
  /** Latest ledger known to the RPC at the time of the first page. */
  latestLedger: number | null;
  /** Highest ledger sequence observed across all returned events. */
  lastEventLedger: number | null;
  /** Number of proposals successfully discovered. */
  discoveredCount: number;
  /** Whether any paginated page returned an error. */
  hadError: boolean;
}

/**
 * Full result produced by {@link evaluateDiscoveryFreshness}.
 * Includes the state plus diagnostic fields for the UI banner.
 */
export interface FreshnessResult {
  state: FreshnessState;
  /** Human-readable explanation for the current state. */
  explanation: string;
  /** Gap between latest ledger and last event ledger, or null if unknown. */
  ledgerGap: number | null;
}

// ---------------------------------------------------------------------------
// Thresholds (ledgers)
// ---------------------------------------------------------------------------

/**
 * Maximum gap between `lastEventLedger` and `latestLedger` for the data
 * to be considered Current.  Five ledgers ≈ a few seconds of network time.
 */
export const CURRENT_THRESHOLD = 5;

/**
 * Gap beyond which data is considered Stale rather than merely Delayed.
 * One hundred ledgers ≈ ~50 seconds on Stellar mainnet.
 */
export const STALE_THRESHOLD = 100;

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate the freshness of a proposal discovery result from RPC metadata.
 *
 * The function is pure — no side-effects, no React dependency, no
 * wall-clock access.  It can run in Node, a browser, or a test.
 */
export function evaluateDiscoveryFreshness(
  meta: FreshnessMetadata,
): FreshnessResult {
  const { latestLedger, lastEventLedger, discoveredCount, hadError } = meta;

  // --- Unavailable: no data at all ---
  if (discoveredCount === 0 && lastEventLedger === null) {
    // If the RPC itself failed, it's unavailable regardless.
    if (hadError || latestLedger === null) {
      return {
        state: "unavailable",
        explanation: "Proposal history could not be loaded.",
        ledgerGap: null,
      };
    }

    // RPC responded but no events found — distinguish "no proposals exist"
    // from "scan range is too narrow".  Without a backend indexer we cannot
    // know, so report unavailable with an actionable hint.
    return {
      state: "unavailable",
      explanation: "No proposal events were found in the scanned ledger range.",
      ledgerGap: null,
    };
  }

  // --- Compute the ledger gap ---
  const gap =
    latestLedger !== null && lastEventLedger !== null
      ? latestLedger - lastEventLedger
      : null;

  // --- Errors during pagination → Stale (data exists but is unreliable) ---
  if (hadError && discoveredCount > 0) {
    return {
      state: "stale",
      explanation:
        "Some proposal history could not be loaded due to network errors.",
      ledgerGap: gap,
    };
  }

  // --- No RPC head available (shouldn't happen with a live RPC) ---
  if (latestLedger === null) {
    return {
      state: "delayed",
      explanation: "Proposal history is loading but the network head is unknown.",
      ledgerGap: null,
    };
  }

  // --- Gap-based classification ---
  if (gap !== null && gap <= CURRENT_THRESHOLD) {
    return {
      state: "current",
      explanation: "Proposal history is up to date.",
      ledgerGap: gap,
    };
  }

  if (gap !== null && gap <= STALE_THRESHOLD) {
    return {
      state: "delayed",
      explanation:
        "Proposal history is slightly behind the network. New proposals may not appear yet.",
      ledgerGap: gap,
    };
  }

  // Gap > STALE_THRESHOLD
  return {
    state: "stale",
    explanation:
      "Proposal history is significantly behind the network. Results may be incomplete.",
    ledgerGap: gap,
  };
}
