/**
 * Canonical application model for a created proposal.
 *
 * Consumed by both direct APC discovery and future indexer adapters.
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
   * proposal-creation event.  Sourced from RC transaction metadata.
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

// --------------------------------------------------------------------------
 // Typed representation of a decoded ProposalCreated contract event
// --------------------------------------------------------------------------

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
 * RFC metadata accompanying the transaction that contained the event.
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

// --------------------------------------------------------------------------
 // Typed discovery failures and error mapping
// --------------------------------------------------------------------------

/**
 * Environment variable that must be set to discover proposal events.
 * Named explicitly so the UI can tell operators what to configure.
 */
export const GOVERNOR_START_LEDGER_ENV_VAR = "NEXT_PUBLIC_GOVERNOR_START_LEDGER" as const;

/**
 * Categories of discovery failure. These are typed so the UI can render
 * a stable, actionable message instead of a generic "Discovery failed".
 */
export type DiscoveryErrorCode =
  /** Required configuration (e.g. start ledger) is missing or invalid. */
  | "config_missing"
  /** Requested ledger window is outside RPC retention / clamped. */
  | "retention_clamp"
  /** RPC or network failure (timeout, 5xx, 500, network error). */
  | "rpc_network"
  /** Event decode failure or partial page decode failure. */
  | "decode_partial"
  /** Unknown/unclassified failure. */
  | "unknown";

/**
 * Typed discovery failure propagated from `useProposalDiscovery` to the UI.
 */
export interface DiscoveryError {
  /** Stable category code for programmatic handling. */
  code: DiscoveryErrorCode;
  /** Stable, human-readable sentence for the UI fallback. */
  message: string;
  /** Raw underlying message (e.g. RPC error) when available. */
  detail?: string;
  /** Environment variable name when configuration is missing. */
  envVar?: string;
}

/**
 * Maps a raw RPC / network / decode error into a typed discovery failure.
 *
 * Retention-window errors (e.g. "startLedger must be within the
 * ledger range") are classified as `retention_clamp` so the UI can explain
 * the configuration problem instead of collapsing to "Discovery failed".
 */
export function mapDiscoveryError(error: unknown, options?: { envVar?: string }): DiscoveryError {
  const raw = extractErrorMessage(error);
  const lower = raw.toLowerCase();

  if (looksLikeRetentionError(lower)) {
    return {
      code: "retention_clamp",
      message:
        "The configured start ledger is outside the RFC retention window. " +
        "Update the start ledger configuration to a recent ledger and retry.",
      detail: raw,
      envVar: options?.envVar,
    };
  }

  if (looksLikeDecodeError(lower)) {
    return {
      code: "decode_partial",
      message:
        "Some proposal events could not be decoded. Partial results are shown.",
      detail: raw,
    };
  }

  if (looksLikeRpcError(lower)) {
    return {
      code: "rpc_network",
      message:
        "Could not reach the Stellar RPC endpoint. Check your network and RFC URL and retry.",
      detail: raw,
    };
  }

  return {
    code: "unknown",
    message: "Proposal discovery failed.",
    detail: raw,
  };
}

/**
 * Builds a typed configuration-missing failure that names the expected
 * environment variable so operators know what to set.
 */
export function configMissingError(
  envVar: string = GOVERNOR_START_LEDGER_ENV_VAR,
  detail?: string,
): DiscoveryError {
  return {
    code: "config_missing",
    message: `Missing required configuration: ${envVar}. Set it and retry.`,
    detail,
    envVar,
  };
}

/**
 * Returns the most actionable human-message for a discovery error.
 * Prefers the concrete `detail` when present, falling back to the stable
 * mapped `message`.
 */
export function discoveryErrorMessage(error: DiscoveryError): string {
  if (error.detail && error.detail.trim().length > 0) {
    return error.detail;
  }
  return error.message;
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const candidate = (error as { message?: unknown; error?: unknown });
    if (typeof candidate.message === "string") return candidate.message;
    if (typeof candidate.error === "string") return candidate.error;
  }
  return "";
}

function looksLikeRetentionError(lower: string): boolean {
  return (
    lower.includes("startledger") ||
    lower.includes("start ledger") ||
    lower.includes("ledger range") ||
    lower.includes("out of range") ||
    lower.includes("retention") ||
    lower.includes("clamped")
  );
}

function looksLikeDecodeError(lower: string): boolean {
  return (
    lower.includes("decode") ||
    lower.includes("decoding") ||
    lower.includes("xdr") ||
    lower.includes("parse")
  );
}

function looksLikeRpcError(lower: string): boolean {
  return (
    lower.includes("fetch") ||
    lower.includes("network") ||
    lower.includes("timeout") ||
    lower.includes("rpc") ||
    lower.includes("http") ||
    /\b5\d{2}\b/.test(lower)
  );
}
