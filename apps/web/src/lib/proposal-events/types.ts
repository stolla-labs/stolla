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
  metadata?: import("@/lib/proposal-metadata").ProposalMetadataV1 | null;
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
// Typed discovery failures
// ---------------------------------------------------------------------------

/**
 * Discriminator for the kind of failure encountered during proposal
 * discovery.  Each variant maps to a stable, user-facing sentence so the
 * UI never has to fall back to a generic "Discovery failed" string.
 */
export type ProposalDiscoveryErrorKind =
  | "config-missing"
  | "retention-clamp"
  | "rpc-network"
  | "decode-partial";

/**
 * Structured discovery failure surfaced by `useProposalDiscovery`.
 *
 * `message` is always populated with a concrete, actionable sentence
 * (either the raw RPC message or a stable mapped sentence).  `cause` is
 * retained for logging/telemetry but must never be rendered directly.
 */
export interface ProposalDiscoveryError {
  kind: ProposalDiscoveryErrorKind;
  /** Concrete, user-facing message. Never generic. */
  message: string;
  /** Original thrown value, if any, for logging. */
  cause?: unknown;
}

/**
 * Map an arbitrary thrown value from `getEvents` / RPC into a typed
 * discovery failure.  Retention-window errors (e.g. "startLedger must be
 * within the ledger range") are classified as `retention-clamp` so the UI
 * can explain the configuration problem rather than showing a generic
 * failure.
 */
export function mapProposalDiscoveryError(
  error: unknown,
  fallbackKind: ProposalDiscoveryErrorKind = "rpc-network",
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

  if (
    lower.includes("startledger") ||
    lower.includes("ledger range") ||
    lower.includes("retention")
  ) {
    return {
      kind: "retention-clamp",
      message:
        raw ||
        "Start ledger is outside the RPC retention window. Adjust NEXT_PUBLIC_GOVERNOR_START_LEDGER or use a provider with a wider history.",
      cause: error,
    };
  }

  if (lower.includes("decode") || lower.includes("xdr")) {
    return {
      kind: "decode-partial",
      message:
        raw ||
        "Some proposal events could not be decoded. Partial results are shown.",
      cause: error,
    };
  }

  return {
    kind: fallbackKind,
    message: raw || "Proposal discovery failed due to an RPC or network error.",
    cause: error,
  };
}

/**
 * Stable, actionable message for a missing start-ledger configuration.
 * Names the exact environment variable so operators can fix it.
 */
export function missingStartLedgerError(): ProposalDiscoveryError {
  return {
    kind: "config-missing",
    message:
      "Missing NEXT_PUBLIC_GOVERNOR_START_LEDGER. Set it to the first ledger to scan for proposals.",
  };
}
