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
