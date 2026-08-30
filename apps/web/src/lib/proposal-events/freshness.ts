/**
 * Client-side Freshness State types matching
 * `docs/community-proposal-indexing.md` public sync contract.
 *
 * Until the shared indexer lands, direct-RPC discovery can surface a
 * stub sync payload so Community and global consumers share one shape.
 */

/** Indexer / discovery pipeline status for a community proposal feed. */
export type ProposalSyncStatus =
  | "ready"
  | "syncing"
  | "partial"
  | "unavailable";

/**
 * Freshness label relative to observed head and finality lag.
 * See community-proposal-indexing.md § Finality, freshness, and caching.
 */
export type ProposalFreshness = "fresh" | "stale" | "unknown";

export interface ProposalSyncState {
  status: ProposalSyncStatus;
  freshness: ProposalFreshness;
  indexedThroughLedger: number | null;
  observedHeadLedger: number | null;
  lastSuccessfulSync: string | null;
  warnings: string[];
}

export interface ClientFreshnessStubOptions {
  status?: ProposalSyncStatus;
  freshness?: ProposalFreshness;
  indexedThroughLedger?: number | null;
  observedHeadLedger?: number | null;
  lastSuccessfulSync?: string | null;
  warnings?: string[];
}

/**
 * Build a client-side sync stub for direct-RPC discovery.
 * Not a substitute for indexer freshness; call sites must not present
 * this as authoritative multi-community indexing state.
 */
export function createClientFreshnessStub(
  options: ClientFreshnessStubOptions = {},
): ProposalSyncState {
  return {
    status: options.status ?? "ready",
    freshness: options.freshness ?? "unknown",
    indexedThroughLedger: options.indexedThroughLedger ?? null,
    observedHeadLedger: options.observedHeadLedger ?? null,
    lastSuccessfulSync: options.lastSuccessfulSync ?? null,
    warnings: options.warnings ?? [],
  };
}
