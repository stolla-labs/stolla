import type { ProposalMetadataV1 } from "@/lib/proposal-metadata";

/**
 * Canonical application model for a created proposal.
 *
 * Consumed by both direct RPC discovery and future indexer adapters.
 * This type is React-independent and has no localStorage dependency.
 *
 * Fields that require a later contract read (e.g. proposal state, vote
 * totals) are deliberately absent rather than invented with placeholder
 * values.
 */
export interface ProposalSummary {
  /**
   * Canonical proposal identifier — lowercase hex-encoded 32-byte
   * keccak256 hash returned by the Governor contract.
   * All consumers must use this format; never raw Buffer or base64.
   */
  proposalId: string;

  /**
   * Stellar account ID of the Governor contract that emitted the event.
   * Required so the model can be used across communities when the
   * multi-community factory lands.
   */
  governorContractId: string;

  /**
   * Stellar account ID (G…) of the proposer, when present in the event.
   * The Governor contract includes the proposer in the ProposalCreated
   * event topics, but future indexer responses may omit it; use null
   * to represent the explicitly-unknown case rather than an empty string.
   */
  proposer: string | null;

  /**
   * Ledger sequence number at which the proposal-creation transaction
   * was finalised.  Sourced from RPC transaction metadata.
   */
  creationLedger: number;

  /**
   * Stellar transaction hash (hex) of the transaction that included the
   * proposal-creation event.  Sourced from RPC transaction metadata.
   */
  txHash: string;

  /**
   * Opaque event cursor string as returned by `getEvents` / an indexer.
   * Used for pagination and deduplication.  Null when the event was
   * synthesised without a cursor (e.g. from a raw ledger entry scan).
   */
  cursor: string | null;

  /**
   * Ledger at which the voting snapshot is taken.
   * Present in the ProposalCreated event body.
   */
  voteSnapshot: number;

  /**
   * Ledger at which voting ends.
   * Present in the ProposalCreated event body.
   */
  voteEnd: number;

  /**
   * Free-text description supplied by the proposer.
   */
  description: string;

  /** Parsed structured metadata when the description contains a valid v1 envelope. */
  metadata?: ProposalMetadataV1 | null;
}

// ---------------------------------------------------------------------------
// Typed representation of a decoded ProposalCreated contract event
// ---------------------------------------------------------------------------

/**
 * Decoded body of a ProposalCreated Soroban event as emitted by the
 * community_governor contract.
 *
 * Event topics: ["proposal_created", proposal_id: BytesN<32>]
 * Event data fields (from the XDR-decoded map):
 *   proposer      Address (optional — present when contract emits it)
 *   targets       Array<Address>
 *   functions     Array<Symbol>
 *   args          Array<Array<Val>>
 *   vote_snapshot u32
 *   vote_end      u32
 *   description   String
 *
 * Reference: community_governor bindings — ProposalCreated event spec.
 */
export interface ProposalCreatedEventData {
  /** 32-byte proposal ID as a hex string (canonical form). */
  proposalId: string;
  /** Proposer address, or null when not emitted by this version. */
  proposer: string | null;
  /** Contract addresses the proposal will call. */
  targets: string[];
  /** Function names to invoke on each target. */
  functions: string[];
  /** Encoded arguments for each call. */
  args: unknown[][];
  /** Ledger number for the voting-power snapshot. */
  voteSnapshot: number;
  /** Ledger number at which voting closes. */
  voteEnd: number;
  /** Human-readable proposal description. */
  description: string;
}

/**
 * RPC metadata accompanying the transaction that contained the event.
 * Sourced from `SorobanRpc.GetTransactionResponse` or an indexer response.
 */
export interface ProposalEventRpcMetadata {
  /** Ledger sequence number of the transaction. */
  ledger: number;
  /** Hex-encoded transaction hash. */
  txHash: string;
  /**
   * Opaque cursor string for the event.
   * Null when not available (e.g. synthesised from ledger-entry scan).
   */
  cursor: string | null;
}

// ---------------------------------------------------------------------------
// Typed discovery failure model
// ---------------------------------------------------------------------------

/**
 * Discriminator for the kind of failure encountered during proposal
 * discovery.  Each variant maps to a stable, user-facing sentence so the
 * UI never collapses distinct root causes into a single generic string.
 *
 * - `config_missing`   — required environment configuration is absent.
 * - `retention_clamp`  — the requested start ledger falls outside the
 *                        RPC node's retained ledger window.
 * - `rpc_network`      — transport, timeout, or non-2xx RPC response.
 * - `decode_partial`   — one or more pages decoded successfully but a
 *                        later page failed; partial results are retained.
 * - `unknown`          — unclassified failure; message is preserved.
 */
export type ProposalDiscoveryErrorKind =
  | "config_missing"
  | "retention_clamp"
  | "rpc_network"
  | "decode_partial"
  | "unknown";

/**
 * Typed discovery failure surfaced to the UI.  `message` is always a
 * concrete, actionable sentence — never the generic "Discovery failed".
 */
export interface ProposalDiscoveryError {
  kind: ProposalDiscoveryErrorKind;
  /** Concrete, user-facing sentence describing the failure. */
  message: string;
  /**
   * Raw underlying error message (e.g. the RPC string) when available.
   * Preserved for diagnostics and logging; may be shown in a details
   * disclosure but is not required by the primary UI.
   */
  cause?: string;
  /**
   * Number of proposals successfully decoded before the failure.
   * Non-zero only for `decode_partial`, so the UI can honestly report
   * that some results are available.
   */
  partialCount?: number;
}

/**
 * Environment variable name that must be set for discovery to run.
 * Exported so error mapping and tests share a single source of truth.
 */
export const GOVERNOR_START_LEDGER_ENV = "NEXT_PUBLIC_GOVERNOR_START_LEDGER";

/**
 * Map an arbitrary thrown value / RPC error string to a typed
 * {@link ProposalDiscoveryError}.  Pure and deterministic so it can be
 * unit-tested without touching the network.
 */
export function mapDiscoveryError(
  error: unknown,
  context: { partialCount?: number } = {},
): ProposalDiscoveryError {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : error == null
          ? ""
          : String(error);

  const lower = raw.toLowerCase();
  const partialCount = context.partialCount ?? 0;

  if (lower.includes("startledger must be within the ledger range")) {
    return {
      kind: "retention_clamp",
      message:
        "The configured start ledger is older than this RPC node retains. " +
        "Raise the start ledger or use an archival RPC endpoint.",
      cause: raw,
    };
  }

  if (
    lower.includes("next_public_governor_start_ledger") ||
    lower.includes("start ledger is not configured") ||
    lower.includes("missing governor start ledger")
  ) {
    return {
      kind: "config_missing",
      message: `Missing required configuration: ${GOVERNOR_START_LEDGER_ENV}.`,
      cause: raw,
    };
  }

  if (
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("timeout") ||
    lower.includes("econnrefused") ||
    lower.includes("429") ||
    lower.includes("503")
  ) {
    return {
      kind: "rpc_network",
      message:
        "Could not reach the Soroban RPC endpoint. Check connectivity and retry.",
      cause: raw,
    };
  }

  if (partialCount > 0) {
    return {
      kind: "decode_partial",
      message:
        `Loaded ${partialCount} proposal${partialCount === 1 ? "" : "s"} ` +
        "before a later page failed. Results shown may be incomplete.",
      cause: raw,
      partialCount,
    };
  }

  return {
    kind: "unknown",
    message: raw.length > 0 ? raw : "Proposal discovery failed.",
    cause: raw.length > 0 ? raw : undefined,
  };
}
