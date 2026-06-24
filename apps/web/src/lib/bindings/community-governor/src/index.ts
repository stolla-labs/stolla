import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}





/**
 * Errors that can occur in governor operations.
 */
export const GovernorError = {
  /**
   * The proposal was not found.
   */
  5000: {message:"ProposalNotFound"},
  /**
   * The proposal already exists.
   */
  5001: {message:"ProposalAlreadyExists"},
  /**
   * The proposer does not have enough voting power.
   */
  5002: {message:"InsufficientProposerVotes"},
  /**
   * The proposal contains no actions.
   */
  5003: {message:"EmptyProposal"},
  /**
   * The targets, functions, and args vectors have different lengths.
   */
  5004: {message:"InvalidProposalLength"},
  /**
   * The proposal is not in the active state.
   */
  5005: {message:"ProposalNotActive"},
  /**
   * The proposal has not succeeded.
   */
  5006: {message:"ProposalNotSuccessful"},
  /**
   * The proposal has not been queued.
   */
  5007: {message:"ProposalNotQueued"},
  /**
   * The proposal has already been executed.
   */
  5008: {message:"ProposalAlreadyExecuted"},
  /**
   * The proposal is in a non-cancellable state (`Canceled`, `Expired`, or
   * `Executed`).
   */
  5009: {message:"ProposalNotCancellable"},
  /**
   * The voting delay has not been set.
   */
  5010: {message:"VotingDelayNotSet"},
  /**
   * The voting period has not been set.
   */
  5011: {message:"VotingPeriodNotSet"},
  /**
   * The proposal threshold has not been set.
   */
  5012: {message:"ProposalThresholdNotSet"},
  /**
   * The name has not been set.
   */
  5013: {message:"NameNotSet"},
  /**
   * The version has not been set.
   */
  5014: {message:"VersionNotSet"},
  /**
   * Arithmetic overflow occurred.
   */
  5015: {message:"MathOverflow"},
  /**
   * The account has already voted on this proposal.
   */
  5016: {message:"AlreadyVoted"},
  /**
   * The vote type is invalid (must be 0, 1, or 2).
   */
  5017: {message:"InvalidVoteType"},
  /**
   * The quorum has not been set.
   */
  5018: {message:"QuorumNotSet"},
  /**
   * The token contract has already been set (can only be initialized once).
   */
  5019: {message:"TokenContractAlreadySet"},
  /**
   * The token contract has not been set.
   */
  5020: {message:"TokenContractNotSet"},
  /**
   * The proposal description exceeds the maximum allowed length.
   */
  5021: {message:"DescriptionTooLong"},
  /**
   * Queuing is not enabled for this governor.
   */
  5022: {message:"QueueNotEnabled"}
}

/**
 * The state of a proposal in its lifecycle.
 * 
 * States are divided into two categories:
 * 
 * ## Time-based states (derived, never stored explicitly)
 * 
 * These are computed by [`get_proposal_state()`] from the current ledger
 * relative to the proposal's voting schedule. They are only returned when
 * no explicit state has been set.
 * 
 * - [`Pending`](ProposalState::Pending) — voting has not started yet.
 * - [`Active`](ProposalState::Active) — voting is ongoing.
 * - [`Defeated`](ProposalState::Defeated) — voting ended **without** the
 * counting logic marking the proposal as `Succeeded`.
 * 
 * ## Explicit states
 * 
 * Set explicitly by the Governor or its extensions and persisted in
 * storage. Once set, they take precedence over any time-based derivation.
 * 
 * - [`Canceled`](ProposalState::Canceled) — set by the Governor.
 * - [`Succeeded`](ProposalState::Succeeded) — set by the counting logic.
 * - [`Queued`](ProposalState::Queued) / [`Expired`](ProposalState::Expired) —
 * set by extensions like `TimelockControl`.
 * - [`Executed`](ProposalState::Execu
 */
export enum ProposalState {
  Pending = 0,
  Active = 1,
  Defeated = 2,
  Canceled = 3,
  Succeeded = 4,
  Queued = 5,
  Expired = 6,
  Executed = 7,
}





export interface Client {
  /**
   * Construct and simulate a name transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the name of the governor.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * 
   * # Errors
   * 
   * * [`GovernorError::NameNotSet`] - Occurs if the name has not been set.
   */
  name: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a queue transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Queues a succeeded proposal for execution and returns its unique
   * identifier.
   * 
   * This function is only relevant when queuing is enabled, i.e., when
   * [`Self::proposals_need_queuing`] is overridden to return `true`. If
   * queuing is not enabled, calling this function will revert with
   * [`GovernorError::QueueNotEnabled`].
   * 
   * When queuing is enabled, this function transitions a proposal from
   * the `Succeeded` state to the `Queued` state. The `execute` function
   * will then require the proposal to be in the `Queued` state before
   * allowing execution. Note that `eta` enforcement is **not** handled
   * by the governor itself — it must be enforced by the integration
   * layer (e.g., a timelock contract that gates execution until the
   * delay has elapsed).
   * 
   * # Enabling Queueing
   * 
   * The default implementation uses **open queueing**: any account can
   * queue a succeeded proposal without authentication. To enable it,
   * override [`Self::proposals_need_queuing`] to return `true`:
   * 
   * ```ignore
   * #[contractimpl(contracttrait)]
   * impl Governor for MyGovernor {
   * fn pro
   */
  queue: ({targets, functions, args, description_hash, eta, operator}: {targets: Array<string>, functions: Array<string>, args: Array<Array<any>>, description_hash: Buffer, eta: u32, operator: string}, options?: MethodOptions) => Promise<AssembledTransaction<Buffer>>

  /**
   * Construct and simulate a cancel transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  cancel: ({targets, functions, args, description_hash, operator}: {targets: Array<string>, functions: Array<string>, args: Array<Array<any>>, description_hash: Buffer, operator: string}, options?: MethodOptions) => Promise<AssembledTransaction<Buffer>>

  /**
   * Construct and simulate a quorum transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the quorum required at the given ledger.
   * 
   * The default implementation uses checkpoint-based storage, returning
   * the quorum value that was in effect at the requested `ledger`.
   * Custom implementations (e.g., fractional quorum based on total
   * supply) may override this to compute a dynamic quorum.
   * 
   * # Dynamic Quorum Overrides
   * 
   * Dynamic quorum implementations (e.g., supply-relative) should
   * typically **not** use [`set_quorum`] / [`storage::get_quorum`], as
   * those are designed for the default checkpoint-based fixed quorum.
   * Instead, compute the quorum from on-chain state at the requested
   * `ledger`.
   * 
   * If the dynamic quorum depends on configurable parameters (e.g., a
   * quorum percentage), those parameters must themselves be queried at
   * the historical `ledger` — otherwise, later parameter updates would
   * retroactively change the outcome of existing proposals.
   * 
   * This method is called with the proposal's `vote_snapshot` ledger,
   * which may be in the future during the `Pending` state. The override
   * **must not panic** on future led
   */
  quorum: ({ledger}: {ledger: u32}, options?: MethodOptions) => Promise<AssembledTransaction<u128>>

  /**
   * Construct and simulate a execute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  execute: ({targets, functions, args, description_hash, executor}: {targets: Array<string>, functions: Array<string>, args: Array<Array<any>>, description_hash: Buffer, executor: string}, options?: MethodOptions) => Promise<AssembledTransaction<Buffer>>

  /**
   * Construct and simulate a propose transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Creates a new proposal and returns its unique identifier (hash).
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `targets` - The addresses of contracts to call.
   * * `functions` - The function names to invoke on each target.
   * * `args` - The arguments for each function call.
   * * `description` - A description of the proposal.
   * * `proposer` - The address creating the proposal.
   * 
   * # Errors
   * 
   * * [`GovernorError::InsufficientProposerVotes`] - If the proposer does
   * not have enough voting power.
   * * [`GovernorError::ProposalAlreadyExists`] - If a proposal with the same
   * parameters already exists.
   * * [`GovernorError::InvalidProposalLength`] - If the targets, functions,
   * and args vectors have different lengths.
   * * [`GovernorError::EmptyProposal`] - If the proposal contains no
   * actions.
   * * [`GovernorError::ProposalThresholdNotSet`] - If the proposal threshold
   * has not been set.
   * * [`GovernorError::VotingDelayNotSet`] - If the voting delay has not
   * been set.
   * * [`GovernorError::VotingPeriodNotSet`] - If the voting period has not
   * been
   */
  propose: ({targets, functions, args, description, proposer}: {targets: Array<string>, functions: Array<string>, args: Array<Array<any>>, description: string, proposer: string}, options?: MethodOptions) => Promise<AssembledTransaction<Buffer>>

  /**
   * Construct and simulate a version transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the version of the governor contract.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * 
   * # Errors
   * 
   * * [`GovernorError::VersionNotSet`] - Occurs if the version has not been
   * set.
   */
  version: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a cast_vote transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Casts a vote on a proposal and returns the voter's voting power.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `proposal_id` - The unique identifier of the proposal.
   * * `vote_type` - The type of vote. For simple counting: 0 = Against, 1 =
   * For, 2 = Abstain.
   * * `reason` - An optional explanation for the vote.
   * * `voter` - The address casting the vote.
   * 
   * # Errors
   * 
   * * [`GovernorError::ProposalNotFound`] - If the proposal does not exist.
   * * [`GovernorError::ProposalNotActive`] - If voting is not currently
   * open.
   * * [`GovernorError::QuorumNotSet`] - If no quorum checkpoint exists at or
   * before the proposal's `vote_snapshot` ledger.
   * 
   * # Events
   * 
   * * topics - `["vote_cast", voter: Address, proposal_id: BytesN<32>]`
   * * data - `[vote_type: u32, weight: u128, reason: String]`
   * 
   * # Notes
   * 
   * * Authorization for `voter` is required.
   * * The `voter` parameter enables flexible access control. The implementer
   * can pass any address to customize who is authorized to cast votes
   * (e.g., for vote delegation or relaying).
   */
  cast_vote: ({proposal_id, vote_type, reason, voter}: {proposal_id: Buffer, vote_type: u32, reason: string, voter: string}, options?: MethodOptions) => Promise<AssembledTransaction<u128>>

  /**
   * Construct and simulate a has_voted transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns whether an account has voted on a proposal.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `proposal_id` - The unique identifier of the proposal.
   * * `account` - The address to check.
   */
  has_voted: ({proposal_id, account}: {proposal_id: Buffer, account: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a voting_delay transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the voting delay in ledgers.
   * 
   * The voting delay is the number of ledgers between proposal creation
   * and the start of voting.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * 
   * # Errors
   * 
   * * [`GovernorError::VotingDelayNotSet`] - Occurs if the voting delay has
   * not been set.
   */
  voting_delay: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a counting_mode transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns a symbol identifying the counting strategy.
   * 
   * This function is expected to be used to display human-readable
   * information about the counting strategy, for example in UIs.
   * 
   * For simple counting, this returns `"simple"`.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   */
  counting_mode: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a voting_period transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the voting period in ledgers.
   * 
   * The voting period is the number of ledgers during which voting is open.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * 
   * # Errors
   * 
   * * [`GovernorError::VotingPeriodNotSet`] - Occurs if the voting period
   * has not been set.
   */
  voting_period: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a proposal_state transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the current state of a proposal.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `proposal_id` - The unique identifier of the proposal.
   * 
   * # Errors
   * 
   * * [`GovernorError::ProposalNotFound`] - If the proposal does not exist.
   * * [`GovernorError::QuorumNotSet`] - If no quorum checkpoint exists at or
   * before the proposal's `vote_snapshot` ledger.
   */
  proposal_state: ({proposal_id}: {proposal_id: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<ProposalState>>

  /**
   * Construct and simulate a get_proposal_id transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the proposal ID computed from the proposal details.
   * 
   * The proposal ID is a deterministic keccak256 hash of the XDR-serialized
   * targets, functions, args, and description hash. This allows anyone to
   * compute the ID without storing the full proposal data.
   * 
   * The `description_hash` is computed as
   * `keccak256(description.to_bytes())`, i.e., a keccak256 hash of the
   * raw UTF-8 bytes of the description string. Off-chain clients can
   * reproduce this by hashing the raw string bytes directly — no XDR
   * encoding is required.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `targets` - The addresses of contracts to call.
   * * `functions` - The function names to invoke on each target.
   * * `args` - The arguments for each function call.
   * * `description_hash` - The keccak256 hash of the description's raw
   * bytes.
   */
  get_proposal_id: ({targets, functions, args, description_hash}: {targets: Array<string>, functions: Array<string>, args: Array<Array<any>>, description_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Buffer>>

  /**
   * Construct and simulate a proposal_deadline transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the ledger number at which voting ends for a proposal.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `proposal_id` - The unique identifier of the proposal.
   * 
   * # Errors
   * 
   * * [`GovernorError::ProposalNotFound`] - If the proposal does not exist.
   */
  proposal_deadline: ({proposal_id}: {proposal_id: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a proposal_proposer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the address of the proposer for a given proposal.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `proposal_id` - The unique identifier of the proposal.
   * 
   * # Errors
   * 
   * * [`GovernorError::ProposalNotFound`] - If the proposal does not exist.
   */
  proposal_proposer: ({proposal_id}: {proposal_id: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a proposal_snapshot transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the ledger number at which voting power is retrieved for a
   * proposal.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `proposal_id` - The unique identifier of the proposal.
   * 
   * # Errors
   * 
   * * [`GovernorError::ProposalNotFound`] - If the proposal does not exist.
   */
  proposal_snapshot: ({proposal_id}: {proposal_id: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a get_token_contract transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the address of the token contract that implements the Votes
   * trait.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * 
   * # Errors
   * 
   * * [`GovernorError::TokenContractNotSet`] - Occurs if the token contract
   * has not been set.
   */
  get_token_contract: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a proposal_threshold transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the minimum voting power required to create a proposal.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * 
   * # Errors
   * 
   * * [`GovernorError::ProposalThresholdNotSet`] - Occurs if the proposal
   * threshold has not been set.
   */
  proposal_threshold: (options?: MethodOptions) => Promise<AssembledTransaction<u128>>

  /**
   * Construct and simulate a proposals_need_queuing transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns whether proposals need to be queued before execution.
   * 
   * When this returns `false` (the default), [`Governor::execute`] expects
   * proposals in the `Succeeded` state and [`Governor::queue`] will revert
   * with [`GovernorError::QueueNotEnabled`].
   * 
   * When overridden to return `true`, [`Governor::execute`] expects
   * proposals in the `Queued` state, meaning [`Governor::queue`] must be
   * called first to transition from `Succeeded` to `Queued`.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   */
  proposals_need_queuing: (options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {token_contract, voting_delay, voting_period, proposal_threshold, quorum}: {token_contract: string, voting_delay: u32, voting_period: u32, proposal_threshold: u128, quorum: u128},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({token_contract, voting_delay, voting_period, proposal_threshold, quorum}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAKxSZXR1cm5zIHRoZSBuYW1lIG9mIHRoZSBnb3Zlcm5vci4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4KCiMgRXJyb3JzCgoqIFtgR292ZXJub3JFcnJvcjo6TmFtZU5vdFNldGBdIC0gT2NjdXJzIGlmIHRoZSBuYW1lIGhhcyBub3QgYmVlbiBzZXQuAAAABG5hbWUAAAAAAAAAAQAAABA=",
        "AAAAAAAABABRdWV1ZXMgYSBzdWNjZWVkZWQgcHJvcG9zYWwgZm9yIGV4ZWN1dGlvbiBhbmQgcmV0dXJucyBpdHMgdW5pcXVlCmlkZW50aWZpZXIuCgpUaGlzIGZ1bmN0aW9uIGlzIG9ubHkgcmVsZXZhbnQgd2hlbiBxdWV1aW5nIGlzIGVuYWJsZWQsIGkuZS4sIHdoZW4KW2BTZWxmOjpwcm9wb3NhbHNfbmVlZF9xdWV1aW5nYF0gaXMgb3ZlcnJpZGRlbiB0byByZXR1cm4gYHRydWVgLiBJZgpxdWV1aW5nIGlzIG5vdCBlbmFibGVkLCBjYWxsaW5nIHRoaXMgZnVuY3Rpb24gd2lsbCByZXZlcnQgd2l0aApbYEdvdmVybm9yRXJyb3I6OlF1ZXVlTm90RW5hYmxlZGBdLgoKV2hlbiBxdWV1aW5nIGlzIGVuYWJsZWQsIHRoaXMgZnVuY3Rpb24gdHJhbnNpdGlvbnMgYSBwcm9wb3NhbCBmcm9tCnRoZSBgU3VjY2VlZGVkYCBzdGF0ZSB0byB0aGUgYFF1ZXVlZGAgc3RhdGUuIFRoZSBgZXhlY3V0ZWAgZnVuY3Rpb24Kd2lsbCB0aGVuIHJlcXVpcmUgdGhlIHByb3Bvc2FsIHRvIGJlIGluIHRoZSBgUXVldWVkYCBzdGF0ZSBiZWZvcmUKYWxsb3dpbmcgZXhlY3V0aW9uLiBOb3RlIHRoYXQgYGV0YWAgZW5mb3JjZW1lbnQgaXMgKipub3QqKiBoYW5kbGVkCmJ5IHRoZSBnb3Zlcm5vciBpdHNlbGYg4oCUIGl0IG11c3QgYmUgZW5mb3JjZWQgYnkgdGhlIGludGVncmF0aW9uCmxheWVyIChlLmcuLCBhIHRpbWVsb2NrIGNvbnRyYWN0IHRoYXQgZ2F0ZXMgZXhlY3V0aW9uIHVudGlsIHRoZQpkZWxheSBoYXMgZWxhcHNlZCkuCgojIEVuYWJsaW5nIFF1ZXVlaW5nCgpUaGUgZGVmYXVsdCBpbXBsZW1lbnRhdGlvbiB1c2VzICoqb3BlbiBxdWV1ZWluZyoqOiBhbnkgYWNjb3VudCBjYW4KcXVldWUgYSBzdWNjZWVkZWQgcHJvcG9zYWwgd2l0aG91dCBhdXRoZW50aWNhdGlvbi4gVG8gZW5hYmxlIGl0LApvdmVycmlkZSBbYFNlbGY6OnByb3Bvc2Fsc19uZWVkX3F1ZXVpbmdgXSB0byByZXR1cm4gYHRydWVgOgoKYGBgaWdub3JlCiNbY29udHJhY3RpbXBsKGNvbnRyYWN0dHJhaXQpXQppbXBsIEdvdmVybm9yIGZvciBNeUdvdmVybm9yIHsKZm4gcHJvAAAABXF1ZXVlAAAAAAAABgAAAAAAAAAHdGFyZ2V0cwAAAAPqAAAAEwAAAAAAAAAJZnVuY3Rpb25zAAAAAAAD6gAAABEAAAAAAAAABGFyZ3MAAAPqAAAD6gAAAAAAAAAAAAAAEGRlc2NyaXB0aW9uX2hhc2gAAAPuAAAAIAAAAAAAAAADZXRhAAAAAAQAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAEAAAPuAAAAIA==",
        "AAAAAAAAAAAAAAAGY2FuY2VsAAAAAAAFAAAAAAAAAAd0YXJnZXRzAAAAA+oAAAATAAAAAAAAAAlmdW5jdGlvbnMAAAAAAAPqAAAAEQAAAAAAAAAEYXJncwAAA+oAAAPqAAAAAAAAAAAAAAAQZGVzY3JpcHRpb25faGFzaAAAA+4AAAAgAAAAAAAAAAhvcGVyYXRvcgAAABMAAAABAAAD7gAAACA=",
        "AAAAAAAABABSZXR1cm5zIHRoZSBxdW9ydW0gcmVxdWlyZWQgYXQgdGhlIGdpdmVuIGxlZGdlci4KClRoZSBkZWZhdWx0IGltcGxlbWVudGF0aW9uIHVzZXMgY2hlY2twb2ludC1iYXNlZCBzdG9yYWdlLCByZXR1cm5pbmcKdGhlIHF1b3J1bSB2YWx1ZSB0aGF0IHdhcyBpbiBlZmZlY3QgYXQgdGhlIHJlcXVlc3RlZCBgbGVkZ2VyYC4KQ3VzdG9tIGltcGxlbWVudGF0aW9ucyAoZS5nLiwgZnJhY3Rpb25hbCBxdW9ydW0gYmFzZWQgb24gdG90YWwKc3VwcGx5KSBtYXkgb3ZlcnJpZGUgdGhpcyB0byBjb21wdXRlIGEgZHluYW1pYyBxdW9ydW0uCgojIER5bmFtaWMgUXVvcnVtIE92ZXJyaWRlcwoKRHluYW1pYyBxdW9ydW0gaW1wbGVtZW50YXRpb25zIChlLmcuLCBzdXBwbHktcmVsYXRpdmUpIHNob3VsZAp0eXBpY2FsbHkgKipub3QqKiB1c2UgW2BzZXRfcXVvcnVtYF0gLyBbYHN0b3JhZ2U6OmdldF9xdW9ydW1gXSwgYXMKdGhvc2UgYXJlIGRlc2lnbmVkIGZvciB0aGUgZGVmYXVsdCBjaGVja3BvaW50LWJhc2VkIGZpeGVkIHF1b3J1bS4KSW5zdGVhZCwgY29tcHV0ZSB0aGUgcXVvcnVtIGZyb20gb24tY2hhaW4gc3RhdGUgYXQgdGhlIHJlcXVlc3RlZApgbGVkZ2VyYC4KCklmIHRoZSBkeW5hbWljIHF1b3J1bSBkZXBlbmRzIG9uIGNvbmZpZ3VyYWJsZSBwYXJhbWV0ZXJzIChlLmcuLCBhCnF1b3J1bSBwZXJjZW50YWdlKSwgdGhvc2UgcGFyYW1ldGVycyBtdXN0IHRoZW1zZWx2ZXMgYmUgcXVlcmllZCBhdAp0aGUgaGlzdG9yaWNhbCBgbGVkZ2VyYCDigJQgb3RoZXJ3aXNlLCBsYXRlciBwYXJhbWV0ZXIgdXBkYXRlcyB3b3VsZApyZXRyb2FjdGl2ZWx5IGNoYW5nZSB0aGUgb3V0Y29tZSBvZiBleGlzdGluZyBwcm9wb3NhbHMuCgpUaGlzIG1ldGhvZCBpcyBjYWxsZWQgd2l0aCB0aGUgcHJvcG9zYWwncyBgdm90ZV9zbmFwc2hvdGAgbGVkZ2VyLAp3aGljaCBtYXkgYmUgaW4gdGhlIGZ1dHVyZSBkdXJpbmcgdGhlIGBQZW5kaW5nYCBzdGF0ZS4gVGhlIG92ZXJyaWRlCioqbXVzdCBub3QgcGFuaWMqKiBvbiBmdXR1cmUgbGVkAAAABnF1b3J1bQAAAAAAAQAAAAAAAAAGbGVkZ2VyAAAAAAAEAAAAAQAAAAo=",
        "AAAAAAAAAAAAAAAHZXhlY3V0ZQAAAAAFAAAAAAAAAAd0YXJnZXRzAAAAA+oAAAATAAAAAAAAAAlmdW5jdGlvbnMAAAAAAAPqAAAAEQAAAAAAAAAEYXJncwAAA+oAAAPqAAAAAAAAAAAAAAAQZGVzY3JpcHRpb25faGFzaAAAA+4AAAAgAAAAAAAAAAhleGVjdXRvcgAAABMAAAABAAAD7gAAACA=",
        "AAAAAAAABABDcmVhdGVzIGEgbmV3IHByb3Bvc2FsIGFuZCByZXR1cm5zIGl0cyB1bmlxdWUgaWRlbnRpZmllciAoaGFzaCkuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYHRhcmdldHNgIC0gVGhlIGFkZHJlc3NlcyBvZiBjb250cmFjdHMgdG8gY2FsbC4KKiBgZnVuY3Rpb25zYCAtIFRoZSBmdW5jdGlvbiBuYW1lcyB0byBpbnZva2Ugb24gZWFjaCB0YXJnZXQuCiogYGFyZ3NgIC0gVGhlIGFyZ3VtZW50cyBmb3IgZWFjaCBmdW5jdGlvbiBjYWxsLgoqIGBkZXNjcmlwdGlvbmAgLSBBIGRlc2NyaXB0aW9uIG9mIHRoZSBwcm9wb3NhbC4KKiBgcHJvcG9zZXJgIC0gVGhlIGFkZHJlc3MgY3JlYXRpbmcgdGhlIHByb3Bvc2FsLgoKIyBFcnJvcnMKCiogW2BHb3Zlcm5vckVycm9yOjpJbnN1ZmZpY2llbnRQcm9wb3NlclZvdGVzYF0gLSBJZiB0aGUgcHJvcG9zZXIgZG9lcwpub3QgaGF2ZSBlbm91Z2ggdm90aW5nIHBvd2VyLgoqIFtgR292ZXJub3JFcnJvcjo6UHJvcG9zYWxBbHJlYWR5RXhpc3RzYF0gLSBJZiBhIHByb3Bvc2FsIHdpdGggdGhlIHNhbWUKcGFyYW1ldGVycyBhbHJlYWR5IGV4aXN0cy4KKiBbYEdvdmVybm9yRXJyb3I6OkludmFsaWRQcm9wb3NhbExlbmd0aGBdIC0gSWYgdGhlIHRhcmdldHMsIGZ1bmN0aW9ucywKYW5kIGFyZ3MgdmVjdG9ycyBoYXZlIGRpZmZlcmVudCBsZW5ndGhzLgoqIFtgR292ZXJub3JFcnJvcjo6RW1wdHlQcm9wb3NhbGBdIC0gSWYgdGhlIHByb3Bvc2FsIGNvbnRhaW5zIG5vCmFjdGlvbnMuCiogW2BHb3Zlcm5vckVycm9yOjpQcm9wb3NhbFRocmVzaG9sZE5vdFNldGBdIC0gSWYgdGhlIHByb3Bvc2FsIHRocmVzaG9sZApoYXMgbm90IGJlZW4gc2V0LgoqIFtgR292ZXJub3JFcnJvcjo6Vm90aW5nRGVsYXlOb3RTZXRgXSAtIElmIHRoZSB2b3RpbmcgZGVsYXkgaGFzIG5vdApiZWVuIHNldC4KKiBbYEdvdmVybm9yRXJyb3I6OlZvdGluZ1BlcmlvZE5vdFNldGBdIC0gSWYgdGhlIHZvdGluZyBwZXJpb2QgaGFzIG5vdApiZWVuAAAAB3Byb3Bvc2UAAAAABQAAAAAAAAAHdGFyZ2V0cwAAAAPqAAAAEwAAAAAAAAAJZnVuY3Rpb25zAAAAAAAD6gAAABEAAAAAAAAABGFyZ3MAAAPqAAAD6gAAAAAAAAAAAAAAC2Rlc2NyaXB0aW9uAAAAABAAAAAAAAAACHByb3Bvc2VyAAAAEwAAAAEAAAPuAAAAIA==",
        "AAAAAAAAAL5SZXR1cm5zIHRoZSB2ZXJzaW9uIG9mIHRoZSBnb3Zlcm5vciBjb250cmFjdC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4KCiMgRXJyb3JzCgoqIFtgR292ZXJub3JFcnJvcjo6VmVyc2lvbk5vdFNldGBdIC0gT2NjdXJzIGlmIHRoZSB2ZXJzaW9uIGhhcyBub3QgYmVlbgpzZXQuAAAAAAAHdmVyc2lvbgAAAAAAAAAAAQAAABA=",
        "AAAAAAAAA+1DYXN0cyBhIHZvdGUgb24gYSBwcm9wb3NhbCBhbmQgcmV0dXJucyB0aGUgdm90ZXIncyB2b3RpbmcgcG93ZXIuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYHByb3Bvc2FsX2lkYCAtIFRoZSB1bmlxdWUgaWRlbnRpZmllciBvZiB0aGUgcHJvcG9zYWwuCiogYHZvdGVfdHlwZWAgLSBUaGUgdHlwZSBvZiB2b3RlLiBGb3Igc2ltcGxlIGNvdW50aW5nOiAwID0gQWdhaW5zdCwgMSA9CkZvciwgMiA9IEFic3RhaW4uCiogYHJlYXNvbmAgLSBBbiBvcHRpb25hbCBleHBsYW5hdGlvbiBmb3IgdGhlIHZvdGUuCiogYHZvdGVyYCAtIFRoZSBhZGRyZXNzIGNhc3RpbmcgdGhlIHZvdGUuCgojIEVycm9ycwoKKiBbYEdvdmVybm9yRXJyb3I6OlByb3Bvc2FsTm90Rm91bmRgXSAtIElmIHRoZSBwcm9wb3NhbCBkb2VzIG5vdCBleGlzdC4KKiBbYEdvdmVybm9yRXJyb3I6OlByb3Bvc2FsTm90QWN0aXZlYF0gLSBJZiB2b3RpbmcgaXMgbm90IGN1cnJlbnRseQpvcGVuLgoqIFtgR292ZXJub3JFcnJvcjo6UXVvcnVtTm90U2V0YF0gLSBJZiBubyBxdW9ydW0gY2hlY2twb2ludCBleGlzdHMgYXQgb3IKYmVmb3JlIHRoZSBwcm9wb3NhbCdzIGB2b3RlX3NuYXBzaG90YCBsZWRnZXIuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJ2b3RlX2Nhc3QiLCB2b3RlcjogQWRkcmVzcywgcHJvcG9zYWxfaWQ6IEJ5dGVzTjwzMj5dYAoqIGRhdGEgLSBgW3ZvdGVfdHlwZTogdTMyLCB3ZWlnaHQ6IHUxMjgsIHJlYXNvbjogU3RyaW5nXWAKCiMgTm90ZXMKCiogQXV0aG9yaXphdGlvbiBmb3IgYHZvdGVyYCBpcyByZXF1aXJlZC4KKiBUaGUgYHZvdGVyYCBwYXJhbWV0ZXIgZW5hYmxlcyBmbGV4aWJsZSBhY2Nlc3MgY29udHJvbC4gVGhlIGltcGxlbWVudGVyCmNhbiBwYXNzIGFueSBhZGRyZXNzIHRvIGN1c3RvbWl6ZSB3aG8gaXMgYXV0aG9yaXplZCB0byBjYXN0IHZvdGVzCihlLmcuLCBmb3Igdm90ZSBkZWxlZ2F0aW9uIG9yIHJlbGF5aW5nKS4AAAAAAAAJY2FzdF92b3RlAAAAAAAABAAAAAAAAAALcHJvcG9zYWxfaWQAAAAD7gAAACAAAAAAAAAACXZvdGVfdHlwZQAAAAAAAAQAAAAAAAAABnJlYXNvbgAAAAAAEAAAAAAAAAAFdm90ZXIAAAAAAAATAAAAAQAAAAo=",
        "AAAAAAAAAMlSZXR1cm5zIHdoZXRoZXIgYW4gYWNjb3VudCBoYXMgdm90ZWQgb24gYSBwcm9wb3NhbC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgcHJvcG9zYWxfaWRgIC0gVGhlIHVuaXF1ZSBpZGVudGlmaWVyIG9mIHRoZSBwcm9wb3NhbC4KKiBgYWNjb3VudGAgLSBUaGUgYWRkcmVzcyB0byBjaGVjay4AAAAAAAAJaGFzX3ZvdGVkAAAAAAAAAgAAAAAAAAALcHJvcG9zYWxfaWQAAAAD7gAAACAAAAAAAAAAB2FjY291bnQAAAAAEwAAAAEAAAAB",
        "AAAAAAAAARxSZXR1cm5zIHRoZSB2b3RpbmcgZGVsYXkgaW4gbGVkZ2Vycy4KClRoZSB2b3RpbmcgZGVsYXkgaXMgdGhlIG51bWJlciBvZiBsZWRnZXJzIGJldHdlZW4gcHJvcG9zYWwgY3JlYXRpb24KYW5kIHRoZSBzdGFydCBvZiB2b3RpbmcuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuCgojIEVycm9ycwoKKiBbYEdvdmVybm9yRXJyb3I6OlZvdGluZ0RlbGF5Tm90U2V0YF0gLSBPY2N1cnMgaWYgdGhlIHZvdGluZyBkZWxheSBoYXMKbm90IGJlZW4gc2V0LgAAAAx2b3RpbmdfZGVsYXkAAAAAAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAUAAAAAAAAADnRva2VuX2NvbnRyYWN0AAAAAAATAAAAAAAAAAx2b3RpbmdfZGVsYXkAAAAEAAAAAAAAAA12b3RpbmdfcGVyaW9kAAAAAAAABAAAAAAAAAAScHJvcG9zYWxfdGhyZXNob2xkAAAAAAAKAAAAAAAAAAZxdW9ydW0AAAAAAAoAAAAA",
        "AAAAAAAAARhSZXR1cm5zIGEgc3ltYm9sIGlkZW50aWZ5aW5nIHRoZSBjb3VudGluZyBzdHJhdGVneS4KClRoaXMgZnVuY3Rpb24gaXMgZXhwZWN0ZWQgdG8gYmUgdXNlZCB0byBkaXNwbGF5IGh1bWFuLXJlYWRhYmxlCmluZm9ybWF0aW9uIGFib3V0IHRoZSBjb3VudGluZyBzdHJhdGVneSwgZm9yIGV4YW1wbGUgaW4gVUlzLgoKRm9yIHNpbXBsZSBjb3VudGluZywgdGhpcyByZXR1cm5zIGAic2ltcGxlImAuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuAAAADWNvdW50aW5nX21vZGUAAAAAAAAAAAAAAQAAABE=",
        "AAAAAAAAAQpSZXR1cm5zIHRoZSB2b3RpbmcgcGVyaW9kIGluIGxlZGdlcnMuCgpUaGUgdm90aW5nIHBlcmlvZCBpcyB0aGUgbnVtYmVyIG9mIGxlZGdlcnMgZHVyaW5nIHdoaWNoIHZvdGluZyBpcyBvcGVuLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIHRoZSBTb3JvYmFuIGVudmlyb25tZW50LgoKIyBFcnJvcnMKCiogW2BHb3Zlcm5vckVycm9yOjpWb3RpbmdQZXJpb2ROb3RTZXRgXSAtIE9jY3VycyBpZiB0aGUgdm90aW5nIHBlcmlvZApoYXMgbm90IGJlZW4gc2V0LgAAAAAADXZvdGluZ19wZXJpb2QAAAAAAAAAAAAAAQAAAAQ=",
        "AAAAAAAAAWRSZXR1cm5zIHRoZSBjdXJyZW50IHN0YXRlIG9mIGEgcHJvcG9zYWwuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYHByb3Bvc2FsX2lkYCAtIFRoZSB1bmlxdWUgaWRlbnRpZmllciBvZiB0aGUgcHJvcG9zYWwuCgojIEVycm9ycwoKKiBbYEdvdmVybm9yRXJyb3I6OlByb3Bvc2FsTm90Rm91bmRgXSAtIElmIHRoZSBwcm9wb3NhbCBkb2VzIG5vdCBleGlzdC4KKiBbYEdvdmVybm9yRXJyb3I6OlF1b3J1bU5vdFNldGBdIC0gSWYgbm8gcXVvcnVtIGNoZWNrcG9pbnQgZXhpc3RzIGF0IG9yCmJlZm9yZSB0aGUgcHJvcG9zYWwncyBgdm90ZV9zbmFwc2hvdGAgbGVkZ2VyLgAAAA5wcm9wb3NhbF9zdGF0ZQAAAAAAAQAAAAAAAAALcHJvcG9zYWxfaWQAAAAD7gAAACAAAAABAAAH0AAAAA1Qcm9wb3NhbFN0YXRlAAAA",
        "AAAAAAAAAyhSZXR1cm5zIHRoZSBwcm9wb3NhbCBJRCBjb21wdXRlZCBmcm9tIHRoZSBwcm9wb3NhbCBkZXRhaWxzLgoKVGhlIHByb3Bvc2FsIElEIGlzIGEgZGV0ZXJtaW5pc3RpYyBrZWNjYWsyNTYgaGFzaCBvZiB0aGUgWERSLXNlcmlhbGl6ZWQKdGFyZ2V0cywgZnVuY3Rpb25zLCBhcmdzLCBhbmQgZGVzY3JpcHRpb24gaGFzaC4gVGhpcyBhbGxvd3MgYW55b25lIHRvCmNvbXB1dGUgdGhlIElEIHdpdGhvdXQgc3RvcmluZyB0aGUgZnVsbCBwcm9wb3NhbCBkYXRhLgoKVGhlIGBkZXNjcmlwdGlvbl9oYXNoYCBpcyBjb21wdXRlZCBhcwpga2VjY2FrMjU2KGRlc2NyaXB0aW9uLnRvX2J5dGVzKCkpYCwgaS5lLiwgYSBrZWNjYWsyNTYgaGFzaCBvZiB0aGUKcmF3IFVURi04IGJ5dGVzIG9mIHRoZSBkZXNjcmlwdGlvbiBzdHJpbmcuIE9mZi1jaGFpbiBjbGllbnRzIGNhbgpyZXByb2R1Y2UgdGhpcyBieSBoYXNoaW5nIHRoZSByYXcgc3RyaW5nIGJ5dGVzIGRpcmVjdGx5IOKAlCBubyBYRFIKZW5jb2RpbmcgaXMgcmVxdWlyZWQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYHRhcmdldHNgIC0gVGhlIGFkZHJlc3NlcyBvZiBjb250cmFjdHMgdG8gY2FsbC4KKiBgZnVuY3Rpb25zYCAtIFRoZSBmdW5jdGlvbiBuYW1lcyB0byBpbnZva2Ugb24gZWFjaCB0YXJnZXQuCiogYGFyZ3NgIC0gVGhlIGFyZ3VtZW50cyBmb3IgZWFjaCBmdW5jdGlvbiBjYWxsLgoqIGBkZXNjcmlwdGlvbl9oYXNoYCAtIFRoZSBrZWNjYWsyNTYgaGFzaCBvZiB0aGUgZGVzY3JpcHRpb24ncyByYXcKYnl0ZXMuAAAAD2dldF9wcm9wb3NhbF9pZAAAAAAEAAAAAAAAAAd0YXJnZXRzAAAAA+oAAAATAAAAAAAAAAlmdW5jdGlvbnMAAAAAAAPqAAAAEQAAAAAAAAAEYXJncwAAA+oAAAPqAAAAAAAAAAAAAAAQZGVzY3JpcHRpb25faGFzaAAAA+4AAAAgAAAAAQAAA+4AAAAg",
        "AAAAAAAAAQNSZXR1cm5zIHRoZSBsZWRnZXIgbnVtYmVyIGF0IHdoaWNoIHZvdGluZyBlbmRzIGZvciBhIHByb3Bvc2FsLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIHRoZSBTb3JvYmFuIGVudmlyb25tZW50LgoqIGBwcm9wb3NhbF9pZGAgLSBUaGUgdW5pcXVlIGlkZW50aWZpZXIgb2YgdGhlIHByb3Bvc2FsLgoKIyBFcnJvcnMKCiogW2BHb3Zlcm5vckVycm9yOjpQcm9wb3NhbE5vdEZvdW5kYF0gLSBJZiB0aGUgcHJvcG9zYWwgZG9lcyBub3QgZXhpc3QuAAAAABFwcm9wb3NhbF9kZWFkbGluZQAAAAAAAAEAAAAAAAAAC3Byb3Bvc2FsX2lkAAAAA+4AAAAgAAAAAQAAAAQ=",
        "AAAAAAAAAP5SZXR1cm5zIHRoZSBhZGRyZXNzIG9mIHRoZSBwcm9wb3NlciBmb3IgYSBnaXZlbiBwcm9wb3NhbC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgcHJvcG9zYWxfaWRgIC0gVGhlIHVuaXF1ZSBpZGVudGlmaWVyIG9mIHRoZSBwcm9wb3NhbC4KCiMgRXJyb3JzCgoqIFtgR292ZXJub3JFcnJvcjo6UHJvcG9zYWxOb3RGb3VuZGBdIC0gSWYgdGhlIHByb3Bvc2FsIGRvZXMgbm90IGV4aXN0LgAAAAAAEXByb3Bvc2FsX3Byb3Bvc2VyAAAAAAAAAQAAAAAAAAALcHJvcG9zYWxfaWQAAAAD7gAAACAAAAABAAAAEw==",
        "AAAAAAAAARFSZXR1cm5zIHRoZSBsZWRnZXIgbnVtYmVyIGF0IHdoaWNoIHZvdGluZyBwb3dlciBpcyByZXRyaWV2ZWQgZm9yIGEKcHJvcG9zYWwuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYHByb3Bvc2FsX2lkYCAtIFRoZSB1bmlxdWUgaWRlbnRpZmllciBvZiB0aGUgcHJvcG9zYWwuCgojIEVycm9ycwoKKiBbYEdvdmVybm9yRXJyb3I6OlByb3Bvc2FsTm90Rm91bmRgXSAtIElmIHRoZSBwcm9wb3NhbCBkb2VzIG5vdCBleGlzdC4AAAAAAAARcHJvcG9zYWxfc25hcHNob3QAAAAAAAABAAAAAAAAAAtwcm9wb3NhbF9pZAAAAAPuAAAAIAAAAAEAAAAE",
        "AAAAAAAAAOhSZXR1cm5zIHRoZSBhZGRyZXNzIG9mIHRoZSB0b2tlbiBjb250cmFjdCB0aGF0IGltcGxlbWVudHMgdGhlIFZvdGVzCnRyYWl0LgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIHRoZSBTb3JvYmFuIGVudmlyb25tZW50LgoKIyBFcnJvcnMKCiogW2BHb3Zlcm5vckVycm9yOjpUb2tlbkNvbnRyYWN0Tm90U2V0YF0gLSBPY2N1cnMgaWYgdGhlIHRva2VuIGNvbnRyYWN0CmhhcyBub3QgYmVlbiBzZXQuAAAAEmdldF90b2tlbl9jb250cmFjdAAAAAAAAAAAAAEAAAAT",
        "AAAAAAAAAOVSZXR1cm5zIHRoZSBtaW5pbXVtIHZvdGluZyBwb3dlciByZXF1aXJlZCB0byBjcmVhdGUgYSBwcm9wb3NhbC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4KCiMgRXJyb3JzCgoqIFtgR292ZXJub3JFcnJvcjo6UHJvcG9zYWxUaHJlc2hvbGROb3RTZXRgXSAtIE9jY3VycyBpZiB0aGUgcHJvcG9zYWwKdGhyZXNob2xkIGhhcyBub3QgYmVlbiBzZXQuAAAAAAAAEnByb3Bvc2FsX3RocmVzaG9sZAAAAAAAAAAAAAEAAAAK",
        "AAAAAAAAAe1SZXR1cm5zIHdoZXRoZXIgcHJvcG9zYWxzIG5lZWQgdG8gYmUgcXVldWVkIGJlZm9yZSBleGVjdXRpb24uCgpXaGVuIHRoaXMgcmV0dXJucyBgZmFsc2VgICh0aGUgZGVmYXVsdCksIFtgR292ZXJub3I6OmV4ZWN1dGVgXSBleHBlY3RzCnByb3Bvc2FscyBpbiB0aGUgYFN1Y2NlZWRlZGAgc3RhdGUgYW5kIFtgR292ZXJub3I6OnF1ZXVlYF0gd2lsbCByZXZlcnQKd2l0aCBbYEdvdmVybm9yRXJyb3I6OlF1ZXVlTm90RW5hYmxlZGBdLgoKV2hlbiBvdmVycmlkZGVuIHRvIHJldHVybiBgdHJ1ZWAsIFtgR292ZXJub3I6OmV4ZWN1dGVgXSBleHBlY3RzCnByb3Bvc2FscyBpbiB0aGUgYFF1ZXVlZGAgc3RhdGUsIG1lYW5pbmcgW2BHb3Zlcm5vcjo6cXVldWVgXSBtdXN0IGJlCmNhbGxlZCBmaXJzdCB0byB0cmFuc2l0aW9uIGZyb20gYFN1Y2NlZWRlZGAgdG8gYFF1ZXVlZGAuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuAAAAAAAAFnByb3Bvc2Fsc19uZWVkX3F1ZXVpbmcAAAAAAAAAAAABAAAAAQ==",
        "AAAABQAAACJFdmVudCBlbWl0dGVkIHdoZW4gYSB2b3RlIGlzIGNhc3QuAAAAAAAAAAAACFZvdGVDYXN0AAAAAQAAAAl2b3RlX2Nhc3QAAAAAAAAFAAAAAAAAAAV2b3RlcgAAAAAAABMAAAABAAAAAAAAAAtwcm9wb3NhbF9pZAAAAAPuAAAAIAAAAAEAAAAWVGhlIHR5cGUgb2Ygdm90ZSBjYXN0LgAAAAAACXZvdGVfdHlwZQAAAAAAAAQAAAAAAAAAFlRoZSB2b3RpbmcgcG93ZXIgdXNlZC4AAAAAAAZ3ZWlnaHQAAAAAAAoAAAAAAAAAJ1RoZSB2b3RlcidzIGV4cGxhbmF0aW9uIGZvciB0aGVpciB2b3RlLgAAAAAGcmVhc29uAAAAAAAQAAAAAAAAAAI=",
        "AAAABAAAAC1FcnJvcnMgdGhhdCBjYW4gb2NjdXIgaW4gZ292ZXJub3Igb3BlcmF0aW9ucy4AAAAAAAAAAAAADUdvdmVybm9yRXJyb3IAAAAAAAAXAAAAG1RoZSBwcm9wb3NhbCB3YXMgbm90IGZvdW5kLgAAAAAQUHJvcG9zYWxOb3RGb3VuZAAAE4gAAAAcVGhlIHByb3Bvc2FsIGFscmVhZHkgZXhpc3RzLgAAABVQcm9wb3NhbEFscmVhZHlFeGlzdHMAAAAAABOJAAAAL1RoZSBwcm9wb3NlciBkb2VzIG5vdCBoYXZlIGVub3VnaCB2b3RpbmcgcG93ZXIuAAAAABlJbnN1ZmZpY2llbnRQcm9wb3NlclZvdGVzAAAAAAATigAAACFUaGUgcHJvcG9zYWwgY29udGFpbnMgbm8gYWN0aW9ucy4AAAAAAAANRW1wdHlQcm9wb3NhbAAAAAAAE4sAAABAVGhlIHRhcmdldHMsIGZ1bmN0aW9ucywgYW5kIGFyZ3MgdmVjdG9ycyBoYXZlIGRpZmZlcmVudCBsZW5ndGhzLgAAABVJbnZhbGlkUHJvcG9zYWxMZW5ndGgAAAAAABOMAAAAKFRoZSBwcm9wb3NhbCBpcyBub3QgaW4gdGhlIGFjdGl2ZSBzdGF0ZS4AAAARUHJvcG9zYWxOb3RBY3RpdmUAAAAAABONAAAAH1RoZSBwcm9wb3NhbCBoYXMgbm90IHN1Y2NlZWRlZC4AAAAAFVByb3Bvc2FsTm90U3VjY2Vzc2Z1bAAAAAAAE44AAAAhVGhlIHByb3Bvc2FsIGhhcyBub3QgYmVlbiBxdWV1ZWQuAAAAAAAAEVByb3Bvc2FsTm90UXVldWVkAAAAAAATjwAAACdUaGUgcHJvcG9zYWwgaGFzIGFscmVhZHkgYmVlbiBleGVjdXRlZC4AAAAAF1Byb3Bvc2FsQWxyZWFkeUV4ZWN1dGVkAAAAE5AAAABSVGhlIHByb3Bvc2FsIGlzIGluIGEgbm9uLWNhbmNlbGxhYmxlIHN0YXRlIChgQ2FuY2VsZWRgLCBgRXhwaXJlZGAsIG9yCmBFeGVjdXRlZGApLgAAAAAAFlByb3Bvc2FsTm90Q2FuY2VsbGFibGUAAAAAE5EAAAAiVGhlIHZvdGluZyBkZWxheSBoYXMgbm90IGJlZW4gc2V0LgAAAAAAEVZvdGluZ0RlbGF5Tm90U2V0AAAAAAATkgAAACNUaGUgdm90aW5nIHBlcmlvZCBoYXMgbm90IGJlZW4gc2V0LgAAAAASVm90aW5nUGVyaW9kTm90U2V0AAAAABOTAAAAKFRoZSBwcm9wb3NhbCB0aHJlc2hvbGQgaGFzIG5vdCBiZWVuIHNldC4AAAAXUHJvcG9zYWxUaHJlc2hvbGROb3RTZXQAAAATlAAAABpUaGUgbmFtZSBoYXMgbm90IGJlZW4gc2V0LgAAAAAACk5hbWVOb3RTZXQAAAAAE5UAAAAdVGhlIHZlcnNpb24gaGFzIG5vdCBiZWVuIHNldC4AAAAAAAANVmVyc2lvbk5vdFNldAAAAAAAE5YAAAAdQXJpdGhtZXRpYyBvdmVyZmxvdyBvY2N1cnJlZC4AAAAAAAAMTWF0aE92ZXJmbG93AAATlwAAAC9UaGUgYWNjb3VudCBoYXMgYWxyZWFkeSB2b3RlZCBvbiB0aGlzIHByb3Bvc2FsLgAAAAAMQWxyZWFkeVZvdGVkAAATmAAAAC5UaGUgdm90ZSB0eXBlIGlzIGludmFsaWQgKG11c3QgYmUgMCwgMSwgb3IgMikuAAAAAAAPSW52YWxpZFZvdGVUeXBlAAAAE5kAAAAcVGhlIHF1b3J1bSBoYXMgbm90IGJlZW4gc2V0LgAAAAxRdW9ydW1Ob3RTZXQAABOaAAAAR1RoZSB0b2tlbiBjb250cmFjdCBoYXMgYWxyZWFkeSBiZWVuIHNldCAoY2FuIG9ubHkgYmUgaW5pdGlhbGl6ZWQgb25jZSkuAAAAABdUb2tlbkNvbnRyYWN0QWxyZWFkeVNldAAAABObAAAAJFRoZSB0b2tlbiBjb250cmFjdCBoYXMgbm90IGJlZW4gc2V0LgAAABNUb2tlbkNvbnRyYWN0Tm90U2V0AAAAE5wAAAA8VGhlIHByb3Bvc2FsIGRlc2NyaXB0aW9uIGV4Y2VlZHMgdGhlIG1heGltdW0gYWxsb3dlZCBsZW5ndGguAAAAEkRlc2NyaXB0aW9uVG9vTG9uZwAAAAATnQAAAClRdWV1aW5nIGlzIG5vdCBlbmFibGVkIGZvciB0aGlzIGdvdmVybm9yLgAAAAAAAA9RdWV1ZU5vdEVuYWJsZWQAAAATng==",
        "AAAAAwAABABUaGUgc3RhdGUgb2YgYSBwcm9wb3NhbCBpbiBpdHMgbGlmZWN5Y2xlLgoKU3RhdGVzIGFyZSBkaXZpZGVkIGludG8gdHdvIGNhdGVnb3JpZXM6CgojIyBUaW1lLWJhc2VkIHN0YXRlcyAoZGVyaXZlZCwgbmV2ZXIgc3RvcmVkIGV4cGxpY2l0bHkpCgpUaGVzZSBhcmUgY29tcHV0ZWQgYnkgW2BnZXRfcHJvcG9zYWxfc3RhdGUoKWBdIGZyb20gdGhlIGN1cnJlbnQgbGVkZ2VyCnJlbGF0aXZlIHRvIHRoZSBwcm9wb3NhbCdzIHZvdGluZyBzY2hlZHVsZS4gVGhleSBhcmUgb25seSByZXR1cm5lZCB3aGVuCm5vIGV4cGxpY2l0IHN0YXRlIGhhcyBiZWVuIHNldC4KCi0gW2BQZW5kaW5nYF0oUHJvcG9zYWxTdGF0ZTo6UGVuZGluZykg4oCUIHZvdGluZyBoYXMgbm90IHN0YXJ0ZWQgeWV0LgotIFtgQWN0aXZlYF0oUHJvcG9zYWxTdGF0ZTo6QWN0aXZlKSDigJQgdm90aW5nIGlzIG9uZ29pbmcuCi0gW2BEZWZlYXRlZGBdKFByb3Bvc2FsU3RhdGU6OkRlZmVhdGVkKSDigJQgdm90aW5nIGVuZGVkICoqd2l0aG91dCoqIHRoZQpjb3VudGluZyBsb2dpYyBtYXJraW5nIHRoZSBwcm9wb3NhbCBhcyBgU3VjY2VlZGVkYC4KCiMjIEV4cGxpY2l0IHN0YXRlcwoKU2V0IGV4cGxpY2l0bHkgYnkgdGhlIEdvdmVybm9yIG9yIGl0cyBleHRlbnNpb25zIGFuZCBwZXJzaXN0ZWQgaW4Kc3RvcmFnZS4gT25jZSBzZXQsIHRoZXkgdGFrZSBwcmVjZWRlbmNlIG92ZXIgYW55IHRpbWUtYmFzZWQgZGVyaXZhdGlvbi4KCi0gW2BDYW5jZWxlZGBdKFByb3Bvc2FsU3RhdGU6OkNhbmNlbGVkKSDigJQgc2V0IGJ5IHRoZSBHb3Zlcm5vci4KLSBbYFN1Y2NlZWRlZGBdKFByb3Bvc2FsU3RhdGU6OlN1Y2NlZWRlZCkg4oCUIHNldCBieSB0aGUgY291bnRpbmcgbG9naWMuCi0gW2BRdWV1ZWRgXShQcm9wb3NhbFN0YXRlOjpRdWV1ZWQpIC8gW2BFeHBpcmVkYF0oUHJvcG9zYWxTdGF0ZTo6RXhwaXJlZCkg4oCUCnNldCBieSBleHRlbnNpb25zIGxpa2UgYFRpbWVsb2NrQ29udHJvbGAuCi0gW2BFeGVjdXRlZGBdKFByb3Bvc2FsU3RhdGU6OkV4ZWN1AAAAAAAAAA1Qcm9wb3NhbFN0YXRlAAAAAAAACAAAADdUaGUgcHJvcG9zYWwgaXMgcGVuZGluZyBhbmQgdm90aW5nIGhhcyBub3Qgc3RhcnRlZCB5ZXQuAAAAAAdQZW5kaW5nAAAAAAAAAAAtVGhlIHByb3Bvc2FsIGlzIGFjdGl2ZSBhbmQgdm90aW5nIGlzIG9uZ29pbmcuAAAAAAAABkFjdGl2ZQAAAAAAAQAAAMhUaGUgcHJvcG9zYWwgd2FzIGRlZmVhdGVkIChkaWQgbm90IG1lZXQgcXVvcnVtIG9yIG1ham9yaXR5KS4gVGhpcyBpcwp0aGUgZGVmYXVsdCBvdXRjb21lIHdoZW4gdm90aW5nIGVuZHMgYW5kIHRoZSBjb3VudGluZyBsb2dpYyBoYXMKbm90IG1hcmtlZCB0aGUgcHJvcG9zYWwgYXMgW2BTdWNjZWVkZWRgXShQcm9wb3NhbFN0YXRlOjpTdWNjZWVkZWQpLgAAAAhEZWZlYXRlZAAAAAIAAAA1VGhlIHByb3Bvc2FsIGhhcyBiZWVuIGNhbmNlbGxlZC4gU2V0IGJ5IHRoZSBHb3Zlcm5vci4AAAAAAAAIQ2FuY2VsZWQAAAADAAAA3lRoZSBwcm9wb3NhbCBzdWNjZWVkZWQgYW5kIGNhbiBiZSBleGVjdXRlZC4gU2V0IGJ5IHRoZSBjb3VudGluZwpsb2dpYyB3aGVuIHRoZSBwcm9wb3NhbCBtZWV0cyB0aGUgcmVxdWlyZWQgcXVvcnVtIGFuZCB2b3RlCnRocmVzaG9sZHMuIElmIGEgcXVldWluZyBleHRlbnNpb24gaXMgZW5hYmxlZCwgdGhpcyBzdGF0ZSBtZWFucyB0aGUKcHJvcG9zYWwgaXMgcmVhZHkgdG8gYmUgcXVldWVkLgAAAAAACVN1Y2NlZWRlZAAAAAAAAAQAAABPVGhlIHByb3Bvc2FsIGlzIHF1ZXVlZCBmb3IgZXhlY3V0aW9uLiBTZXQgYnkgZXh0ZW5zaW9ucyBsaWtlCmBUaW1lbG9ja0NvbnRyb2xgLgAAAAAGUXVldWVkAAAAAAAFAAAAYVRoZSBwcm9wb3NhbCBoYXMgZXhwaXJlZCBhbmQgY2FuIG5vIGxvbmdlciBiZSBleGVjdXRlZC4gU2V0IGJ5CmV4dGVuc2lvbnMgbGlrZSBgVGltZWxvY2tDb250cm9sYC4AAAAAAAAHRXhwaXJlZAAAAAAGAAAANFRoZSBwcm9wb3NhbCBoYXMgYmVlbiBleGVjdXRlZC4gU2V0IGJ5IHRoZSBHb3Zlcm5vci4AAAAIRXhlY3V0ZWQAAAAH",
        "AAAABQAAAC9FdmVudCBlbWl0dGVkIHdoZW4gdGhlIHF1b3J1bSB2YWx1ZSBpcyBjaGFuZ2VkLgAAAAAAAAAADVF1b3J1bUNoYW5nZWQAAAAAAAABAAAADnF1b3J1bV9jaGFuZ2VkAAAAAAACAAAAAAAAAApvbGRfcXVvcnVtAAAAAAAKAAAAAAAAAAAAAAAKbmV3X3F1b3J1bQAAAAAACgAAAAAAAAAC",
        "AAAABQAAAClFdmVudCBlbWl0dGVkIHdoZW4gYSBwcm9wb3NhbCBpcyBjcmVhdGVkLgAAAAAAAAAAAAAPUHJvcG9zYWxDcmVhdGVkAAAAAAEAAAAQcHJvcG9zYWxfY3JlYXRlZAAAAAgAAAAAAAAAC3Byb3Bvc2FsX2lkAAAAA+4AAAAgAAAAAQAAAAAAAAAIcHJvcG9zZXIAAAATAAAAAQAAAAAAAAAHdGFyZ2V0cwAAAAPqAAAAEwAAAAAAAAAAAAAACWZ1bmN0aW9ucwAAAAAAA+oAAAARAAAAAAAAAAAAAAAEYXJncwAAA+oAAAPqAAAAAAAAAAAAAAAAAAAADXZvdGVfc25hcHNob3QAAAAAAAAEAAAAAAAAAAAAAAAIdm90ZV9lbmQAAAAEAAAAAAAAAAAAAAALZGVzY3JpcHRpb24AAAAAEAAAAAAAAAAC",
        "AAAABQAAACpFdmVudCBlbWl0dGVkIHdoZW4gYSBwcm9wb3NhbCBpcyBleGVjdXRlZC4AAAAAAAAAAAAQUHJvcG9zYWxFeGVjdXRlZAAAAAEAAAARcHJvcG9zYWxfZXhlY3V0ZWQAAAAAAAABAAAAAAAAAAtwcm9wb3NhbF9pZAAAAAPuAAAAIAAAAAEAAAAC",
        "AAAABQAAACtFdmVudCBlbWl0dGVkIHdoZW4gYSBwcm9wb3NhbCBpcyBjYW5jZWxsZWQuAAAAAAAAAAARUHJvcG9zYWxDYW5jZWxsZWQAAAAAAAABAAAAEnByb3Bvc2FsX2NhbmNlbGxlZAAAAAAAAQAAAAAAAAALcHJvcG9zYWxfaWQAAAAD7gAAACAAAAABAAAAAg==" ]),
      options
    )
  }
  public readonly fromJSON = {
    name: this.txFromJSON<string>,
        queue: this.txFromJSON<Buffer>,
        cancel: this.txFromJSON<Buffer>,
        quorum: this.txFromJSON<u128>,
        execute: this.txFromJSON<Buffer>,
        propose: this.txFromJSON<Buffer>,
        version: this.txFromJSON<string>,
        cast_vote: this.txFromJSON<u128>,
        has_voted: this.txFromJSON<boolean>,
        voting_delay: this.txFromJSON<u32>,
        counting_mode: this.txFromJSON<string>,
        voting_period: this.txFromJSON<u32>,
        proposal_state: this.txFromJSON<ProposalState>,
        get_proposal_id: this.txFromJSON<Buffer>,
        proposal_deadline: this.txFromJSON<u32>,
        proposal_proposer: this.txFromJSON<string>,
        proposal_snapshot: this.txFromJSON<u32>,
        get_token_contract: this.txFromJSON<string>,
        proposal_threshold: this.txFromJSON<u128>,
        proposals_need_queuing: this.txFromJSON<boolean>
  }
}