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
// Typed discovery failures
// ---------------------------------------------------------------------------

/**
 * Discriminator for the category of a proposal-discovery failure.
 *
 * - `config`: required configuration (e.g. start ledger) is missing/invalid.
 * - `retention`: the requested ledger range falls outside the RPC's
 *   retention window (e.g. "startLedger must be within the ledger range").
 * - `rpc`: transport/network/RPC-level failure (timeouts, 5xx, connection).
 * - `decode`: an event was fetched but could not be decoded/parsed.
 * - `partial`: some pages succeeded but a later page failed.
 */
export type ProposalDiscoveryErrorKind =
  | "config"
  | "retention"
  | "rpc"
  | "decode"
  | "partial";

/**
 * Typed, serialisable description of a discovery failure.
 *
 * `message` is the concrete underlying message (when available) so
 * operators can distinguish configuration mistakes from transient RPC
 * outages.  `userMessage` is a stable, mapped sentence safe to render in
 * the UI.  `cause` preserves the original error for logging/debugging.
 */
export interface ProposalDiscoveryError {
  kind: ProposalDiscoveryErrorKind;
  /** Stable, human-readable sentence suitable for the error/freshness UI. */
  userMessage: string;
  /** Concrete underlying message, when one was available. */
  message: string | null;
  /** Original thrown value, when available. */
  cause?: unknown;
}

/**
 * Result of a discovery attempt that may have partially succeeded.
 *
 * `proposals` always contains whatever was successfully discovered, even
 * when `error` is set — callers must not discard partial pages.
 */
export interface ProposalDiscoveryResult {
  proposals: ProposalSummary[];
  error: ProposalDiscoveryError | null;
}

/**
 * Name of the environment variable that configures the governor start
 * ledger.  Exposed so error messages and tests reference a single source
 * of truth.
 */
export const GOVERNOR_START_LEDGER_ENV = "NEXT_PUBLIC_GOVERNOR_START_LEDGER";

/**
 * Map an arbitrary thrown value to a typed {@link ProposalDiscoveryError}.
 *
 * Classification is best-effort and based on message heuristics so that
 * callers can surface actionable copy without depending on RPC internals.
 */
export function mapProposalDiscoveryError(
  error: unknown,
  kind?: ProposalDiscoveryErrorKind,
): ProposalDiscoveryError {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : null;

  const resolvedKind: ProposalDiscoveryErrorKind =
    kind ?? classifyProposalDiscoveryError(message);

  return {
    kind: resolvedKind,
    userMessage: proposalDiscoveryErrorMessage(resolvedKind, message),
    message,
    cause: error,
  };
}

/**
 * Heuristically classify a discovery failure from its message.
 */
export function classifyProposalDiscoveryError(
  message: string | null,
): ProposalDiscoveryErrorKind {
  if (!message) return "rpc";
  const lower = message.toLowerCase();
  if (
    lower.includes("startledger") ||
    lower.includes("ledger range") ||
    lower.includes("retention")
  ) {
    return "retention";
  }
  if (
    lower.includes(GOVERNOR_START_LEDGER_ENV.toLowerCase()) ||
    lower.includes("not configured") ||
    lower.includes("missing config")
  ) {
    return "config";
  }
  if (
    lower.includes("decode") ||
    lower.includes("parse") ||
    lower.includes("invalid event")
  ) {
    return "decode";
  }
  return "rpc";
}

/**
 * Produce a stable, user-facing sentence for a discovery failure kind.
 *
 * When a concrete `message` is available it is appended so operators can
 * see the underlying RPC error rather than a generic fallback.
 */
export function proposalDiscoveryErrorMessage(
  kind: ProposalDiscoveryErrorKind,
  message: string | null,
): string {
  const base = (() => {
    switch (kind) {
      case "config":
        return `Proposal discovery is not configured. Set ${GOVERNOR_START_LEDGER_ENV}.`;
      case "retention":
        return "Proposal discovery is outside the RPC retention window. Adjust the start ledger or use a closer RPC.";
      case "decode":
        return "Proposal discovery received an event that could not be decoded.";
      case "partial":
        return "Proposal discovery partially failed; some proposals may be missing.";
      case "rpc":
      default:
        return "Proposal discovery failed due to an RPC or network error.";
    }
  })();

  if (message && message.trim().length > 0 && !base.includes(message)) {
    return `${base} (${message})`;
  }
  return base;
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
