//! Community timelock for one Stolla community.
//!
//! Queues an exact Governor-approved batch, waits the ADR-006 delay, then
//! lets any authenticated account execute that same batch until it expires.
//! This crate does not change `CommunityGovernor` and does not spend treasury
//! assets. Spend policy, pause, and upgrades stay out of this contract.

#![no_std]

mod test;

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error,
    xdr::ToXdr, Address, BytesN, Env, String, Symbol, Val, Vec,
};
use stellar_governance::governor::{hash_proposal, GovernorClient, ProposalState};

const DAY_IN_LEDGERS: u32 = 17_280;
pub const STORAGE_EXTEND_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
pub const STORAGE_TTL_THRESHOLD: u32 = STORAGE_EXTEND_AMOUNT - DAY_IN_LEDGERS;

/// About 48 hours at a five-second ledger close. Ledger count is authoritative.
pub const MIN_DELAY_LEDGERS: u32 = 34_560;
/// About seven days after the earliest execution ledger.
pub const GRACE_LEDGERS: u32 = 120_960;
pub const MAX_BATCH_CALLS: u32 = 10;
const ACTION_DOMAIN: &str = "stolla.timelock.v1";

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ActionStatus {
    Queued = 1,
    Executing = 2,
    Executed = 3,
    Cancelled = 4,
    Expired = 5,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ActionRecord {
    pub proposal_id: BytesN<32>,
    pub batch_hash: BytesN<32>,
    pub targets: Vec<Address>,
    pub functions: Vec<Symbol>,
    pub args: Vec<Vec<Val>>,
    pub description_hash: BytesN<32>,
    pub queued_at: u32,
    pub earliest_ledger: u32,
    pub expiry_ledger: u32,
    pub status: ActionStatus,
    pub cancel_reason: Option<BytesN<32>>,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Governor,
    Guardian,
    BootstrapActive,
    Action(BytesN<32>),
    Proposal(BytesN<32>),
    // Present only while `queue_from_governor` is calling `queue`.
    TrustGovernor,
}

/// Single XDR preimage for the domain-separated action id.
#[contracttype]
#[derive(Clone)]
struct ActionIdPreimage {
    domain: String,
    timelock: Address,
    governor: Address,
    proposal_id: BytesN<32>,
    targets: Vec<Address>,
    functions: Vec<Symbol>,
    args: Vec<Vec<Val>>,
}

/// Single XDR preimage for the stored batch hash.
#[contracttype]
#[derive(Clone)]
struct BatchPreimage {
    targets: Vec<Address>,
    functions: Vec<Symbol>,
    args: Vec<Vec<Val>>,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum TimelockError {
    Unauthorized = 1,
    InvalidBatch = 2,
    AlreadyQueued = 3,
    NotQueued = 4,
    MismatchedBatch = 5,
    TooEarly = 6,
    Expired = 7,
    AlreadyExecuted = 8,
    Cancelled = 9,
    InvalidStatus = 10,
    DelayOverflow = 11,
    ProposalNotSucceeded = 12,
    NotExpired = 13,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ActionQueued {
    #[topic]
    pub action_id: BytesN<32>,
    #[topic]
    pub proposal_id: BytesN<32>,
    pub governor: Address,
    pub queued_ledger: u32,
    pub earliest_ledger: u32,
    pub expiry_ledger: u32,
    pub batch_hash: BytesN<32>,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ActionExecuted {
    #[topic]
    pub action_id: BytesN<32>,
    #[topic]
    pub proposal_id: BytesN<32>,
    pub executor: Address,
    pub execution_ledger: u32,
    pub batch_hash: BytesN<32>,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ActionCancelled {
    #[topic]
    pub action_id: BytesN<32>,
    #[topic]
    pub proposal_id: BytesN<32>,
    pub guardian: Address,
    pub cancellation_ledger: u32,
    pub reason_hash: BytesN<32>,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ActionExpired {
    #[topic]
    pub action_id: BytesN<32>,
    #[topic]
    pub proposal_id: BytesN<32>,
    pub earliest_ledger: u32,
    pub expiry_ledger: u32,
    pub marking_ledger: u32,
}

#[contract]
pub struct CommunityTimelock;

fn bump_instance_ttl(e: &Env) {
    e.storage()
        .instance()
        .extend_ttl(STORAGE_TTL_THRESHOLD, STORAGE_EXTEND_AMOUNT);
}

fn governor_address(e: &Env) -> Address {
    e.storage().instance().get(&DataKey::Governor).unwrap()
}

fn guardian_address(e: &Env) -> Address {
    e.storage().instance().get(&DataKey::Guardian).unwrap()
}

fn require_role(e: &Env, operator: &Address, expected: &Address) {
    if operator != expected {
        panic_with_error!(e, TimelockError::Unauthorized);
    }
    operator.require_auth();
}

fn validate_batch(e: &Env, targets: &Vec<Address>, functions: &Vec<Symbol>, args: &Vec<Vec<Val>>) {
    let len = targets.len();
    if len == 0 || len != functions.len() || len != args.len() || len > MAX_BATCH_CALLS {
        panic_with_error!(e, TimelockError::InvalidBatch);
    }
}

fn batch_hash(
    e: &Env,
    targets: &Vec<Address>,
    functions: &Vec<Symbol>,
    args: &Vec<Vec<Val>>,
) -> BytesN<32> {
    let preimage = BatchPreimage {
        targets: targets.clone(),
        functions: functions.clone(),
        args: args.clone(),
    };
    e.crypto().sha256(&preimage.to_xdr(e)).to_bytes()
}

fn action_id_for(
    e: &Env,
    governor: &Address,
    proposal_id: &BytesN<32>,
    targets: &Vec<Address>,
    functions: &Vec<Symbol>,
    args: &Vec<Vec<Val>>,
) -> BytesN<32> {
    let preimage = ActionIdPreimage {
        domain: String::from_str(e, ACTION_DOMAIN),
        timelock: e.current_contract_address(),
        governor: governor.clone(),
        proposal_id: proposal_id.clone(),
        targets: targets.clone(),
        functions: functions.clone(),
        args: args.clone(),
    };
    e.crypto().sha256(&preimage.to_xdr(e)).to_bytes()
}

fn checked_window(e: &Env, queued_at: u32) -> (u32, u32) {
    let earliest = queued_at
        .checked_add(MIN_DELAY_LEDGERS)
        .unwrap_or_else(|| panic_with_error!(e, TimelockError::DelayOverflow));
    let expiry = earliest
        .checked_add(GRACE_LEDGERS)
        .unwrap_or_else(|| panic_with_error!(e, TimelockError::DelayOverflow));
    (earliest, expiry)
}

fn extend_persistent(e: &Env, key: &DataKey) {
    e.storage()
        .persistent()
        .extend_ttl(key, STORAGE_TTL_THRESHOLD, STORAGE_EXTEND_AMOUNT);
}

fn read_action(e: &Env, action_id: &BytesN<32>) -> Option<ActionRecord> {
    let key = DataKey::Action(action_id.clone());
    let record = e.storage().persistent().get(&key);
    if record.is_some() {
        extend_persistent(e, &key);
    }
    record
}

fn write_action(e: &Env, action_id: &BytesN<32>, record: &ActionRecord) {
    let key = DataKey::Action(action_id.clone());
    e.storage().persistent().set(&key, record);
    extend_persistent(e, &key);
}

fn proposal_action(e: &Env, proposal_id: &BytesN<32>) -> Option<BytesN<32>> {
    let key = DataKey::Proposal(proposal_id.clone());
    let action_id = e.storage().persistent().get(&key);
    if action_id.is_some() {
        extend_persistent(e, &key);
    }
    action_id
}

fn require_succeeded(e: &Env, governor: &Address, proposal_id: &BytesN<32>) {
    let state = GovernorClient::new(e, governor).proposal_state(proposal_id);
    if state != ProposalState::Succeeded {
        panic_with_error!(e, TimelockError::ProposalNotSucceeded);
    }
}

fn reject_closed(e: &Env, status: ActionStatus) {
    match status {
        ActionStatus::Queued => {}
        ActionStatus::Executed => panic_with_error!(e, TimelockError::AlreadyExecuted),
        ActionStatus::Cancelled => panic_with_error!(e, TimelockError::Cancelled),
        ActionStatus::Expired => panic_with_error!(e, TimelockError::Expired),
        ActionStatus::Executing => panic_with_error!(e, TimelockError::InvalidStatus),
    }
}

#[contractimpl]
impl CommunityTimelock {
    /// Initializes Governor and Guardian wiring.
    ///
    /// `admin` must authorize this deployment. The address is not stored, so
    /// bootstrap authority does not remain after construction.
    pub fn __constructor(e: &Env, admin: Address, governor: Address, guardian: Address) {
        admin.require_auth();
        let instance = e.storage().instance();
        instance.set(&DataKey::Governor, &governor);
        instance.set(&DataKey::Guardian, &guardian);
        instance.set(&DataKey::BootstrapActive, &false);
        bump_instance_ttl(e);
    }

    pub fn governor(e: &Env) -> Address {
        bump_instance_ttl(e);
        governor_address(e)
    }

    pub fn guardian(e: &Env) -> Address {
        bump_instance_ttl(e);
        guardian_address(e)
    }

    /// False once construction finishes. There is no stored bootstrap admin.
    pub fn bootstrap_active(e: &Env) -> bool {
        bump_instance_ttl(e);
        e.storage()
            .instance()
            .get(&DataKey::BootstrapActive)
            .unwrap_or(true)
    }

    pub fn min_delay(e: &Env) -> u32 {
        bump_instance_ttl(e);
        MIN_DELAY_LEDGERS
    }

    pub fn grace_ledgers(e: &Env) -> u32 {
        bump_instance_ttl(e);
        GRACE_LEDGERS
    }

    pub fn extend_instance_ttl(e: &Env) {
        bump_instance_ttl(e);
    }

    pub fn get_action(e: &Env, action_id: BytesN<32>) -> Option<ActionRecord> {
        bump_instance_ttl(e);
        read_action(e, &action_id)
    }

    pub fn batch_hash(
        e: &Env,
        targets: Vec<Address>,
        functions: Vec<Symbol>,
        args: Vec<Vec<Val>>,
    ) -> BytesN<32> {
        bump_instance_ttl(e);
        batch_hash(e, &targets, &functions, &args)
    }

    /// Domain-separated id for this timelock, its Governor, and the batch.
    pub fn action_id(
        e: &Env,
        targets: Vec<Address>,
        functions: Vec<Symbol>,
        args: Vec<Vec<Val>>,
        description_hash: BytesN<32>,
    ) -> BytesN<32> {
        bump_instance_ttl(e);
        let governor = governor_address(e);
        let proposal_id = hash_proposal(e, &targets, &functions, &args, &description_hash);
        action_id_for(e, &governor, &proposal_id, &targets, &functions, &args)
    }

    /// Same record as `queue`. Used by the Governor, which cannot be re-entered
    /// for a `proposal_state` callback. The Governor checks Succeeded first.
    #[allow(clippy::too_many_arguments)]
    pub fn queue_from_governor(
        e: &Env,
        targets: Vec<Address>,
        functions: Vec<Symbol>,
        args: Vec<Vec<Val>>,
        description_hash: BytesN<32>,
        operator: Address,
    ) -> BytesN<32> {
        e.storage().instance().set(&DataKey::TrustGovernor, &true);
        Self::queue(e, targets, functions, args, description_hash, operator)
    }

    /// Queues a succeeded proposal. Only the configured Governor may authorize it.
    #[allow(clippy::too_many_arguments)]
    pub fn queue(
        e: &Env,
        targets: Vec<Address>,
        functions: Vec<Symbol>,
        args: Vec<Vec<Val>>,
        description_hash: BytesN<32>,
        operator: Address,
    ) -> BytesN<32> {
        bump_instance_ttl(e);
        let governor = governor_address(e);
        require_role(e, &operator, &governor);
        validate_batch(e, &targets, &functions, &args);

        let proposal_id = hash_proposal(e, &targets, &functions, &args, &description_hash);
        let action_id = action_id_for(e, &governor, &proposal_id, &targets, &functions, &args);
        if read_action(e, &action_id).is_some() || proposal_action(e, &proposal_id).is_some() {
            panic_with_error!(e, TimelockError::AlreadyQueued);
        }

        let trust_governor: bool = e
            .storage()
            .instance()
            .get(&DataKey::TrustGovernor)
            .unwrap_or(false);
        if trust_governor {
            // The Governor is on the stack. Reading proposal_state would
            // re-enter it, and the host rejects that. The Governor already
            // checked Succeeded. Direct `queue` never sets this flag.
            e.storage().instance().remove(&DataKey::TrustGovernor);
        } else {
            require_succeeded(e, &governor, &proposal_id);
        }

        let queued_at = e.ledger().sequence();
        let (earliest_ledger, expiry_ledger) = checked_window(e, queued_at);
        let digest = batch_hash(e, &targets, &functions, &args);
        let record = ActionRecord {
            proposal_id: proposal_id.clone(),
            batch_hash: digest.clone(),
            targets,
            functions,
            args,
            description_hash,
            queued_at,
            earliest_ledger,
            expiry_ledger,
            status: ActionStatus::Queued,
            cancel_reason: None,
        };
        write_action(e, &action_id, &record);
        let proposal_key = DataKey::Proposal(proposal_id.clone());
        e.storage().persistent().set(&proposal_key, &action_id);
        extend_persistent(e, &proposal_key);

        ActionQueued {
            action_id: action_id.clone(),
            proposal_id,
            governor,
            queued_ledger: queued_at,
            earliest_ledger,
            expiry_ledger,
            batch_hash: digest,
        }
        .publish(e);

        action_id
    }

    /// Executes the stored batch inside the inclusive `[earliest, expiry]` window.
    #[allow(clippy::too_many_arguments)]
    pub fn execute(
        e: &Env,
        action_id: BytesN<32>,
        targets: Vec<Address>,
        functions: Vec<Symbol>,
        args: Vec<Vec<Val>>,
        description_hash: BytesN<32>,
        executor: Address,
    ) -> BytesN<32> {
        bump_instance_ttl(e);
        validate_batch(e, &targets, &functions, &args);
        executor.require_auth();

        let governor = governor_address(e);
        let proposal_id = hash_proposal(e, &targets, &functions, &args, &description_hash);
        let derived = action_id_for(e, &governor, &proposal_id, &targets, &functions, &args);
        if derived != action_id {
            panic_with_error!(e, TimelockError::MismatchedBatch);
        }

        let mut record = read_action(e, &action_id).unwrap_or_else(|| {
            panic_with_error!(e, TimelockError::NotQueued);
        });
        let digest = batch_hash(e, &targets, &functions, &args);
        if record.batch_hash != digest
            || record.proposal_id != proposal_id
            || record.description_hash != description_hash
            || record.targets != targets
            || record.functions != functions
            || record.args != args
        {
            panic_with_error!(e, TimelockError::MismatchedBatch);
        }

        reject_closed(e, record.status);
        let now = e.ledger().sequence();
        if now < record.earliest_ledger {
            panic_with_error!(e, TimelockError::TooEarly);
        }
        if now > record.expiry_ledger {
            panic_with_error!(e, TimelockError::Expired);
        }

        record.status = ActionStatus::Executing;
        write_action(e, &action_id, &record);

        let len = targets.len();
        for index in 0..len {
            let target = targets.get(index).unwrap();
            let function = functions.get(index).unwrap();
            let func_args = args.get(index).unwrap();
            e.invoke_contract::<Val>(&target, &function, func_args);
        }

        record.status = ActionStatus::Executed;
        write_action(e, &action_id, &record);
        ActionExecuted {
            action_id: action_id.clone(),
            proposal_id,
            executor,
            execution_ledger: now,
            batch_hash: digest,
        }
        .publish(e);

        action_id
    }

    /// Guardian cancellation. Terminal, and it does not open a new delay.
    pub fn cancel(
        e: &Env,
        action_id: BytesN<32>,
        reason_hash: BytesN<32>,
        operator: Address,
    ) -> BytesN<32> {
        bump_instance_ttl(e);
        let guardian = guardian_address(e);
        require_role(e, &operator, &guardian);

        let mut record = read_action(e, &action_id).unwrap_or_else(|| {
            panic_with_error!(e, TimelockError::NotQueued);
        });
        reject_closed(e, record.status);
        let now = e.ledger().sequence();
        if now > record.expiry_ledger {
            panic_with_error!(e, TimelockError::Expired);
        }

        record.status = ActionStatus::Cancelled;
        record.cancel_reason = Some(reason_hash.clone());
        write_action(e, &action_id, &record);
        ActionCancelled {
            action_id: action_id.clone(),
            proposal_id: record.proposal_id,
            guardian,
            cancellation_ledger: now,
            reason_hash,
        }
        .publish(e);

        action_id
    }

    /// Records expiry after the grace ledger. Permissionless, and not required
    /// for `execute` to reject an already expired batch.
    pub fn mark_expired(e: &Env, action_id: BytesN<32>) -> BytesN<32> {
        bump_instance_ttl(e);
        let mut record = read_action(e, &action_id).unwrap_or_else(|| {
            panic_with_error!(e, TimelockError::NotQueued);
        });
        reject_closed(e, record.status);
        let now = e.ledger().sequence();
        if now <= record.expiry_ledger {
            panic_with_error!(e, TimelockError::NotExpired);
        }

        record.status = ActionStatus::Expired;
        write_action(e, &action_id, &record);
        ActionExpired {
            action_id: action_id.clone(),
            proposal_id: record.proposal_id,
            earliest_ledger: record.earliest_ledger,
            expiry_ledger: record.expiry_ledger,
            marking_ledger: now,
        }
        .publish(e);

        action_id
    }
}
