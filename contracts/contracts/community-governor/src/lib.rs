#![no_std]

mod test;

use soroban_sdk::{
    contract, contractimpl, contracttype, panic_with_error, symbol_short, vec, xdr::ToXdr, Address,
    BytesN, Env, String, Symbol, Val, Vec,
};
use stellar_governance::governor::{self as governor, Governor, GovernorError, ProposalState};

const DAY_IN_LEDGERS: u32 = 17_280;
pub const STORAGE_EXTEND_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
pub const STORAGE_TTL_THRESHOLD: u32 = STORAGE_EXTEND_AMOUNT - DAY_IN_LEDGERS;
/// Default ADR-006 Timelock delay (~48 hours at 5s per ledger).
pub const DEFAULT_TIMELOCK_DELAY_LEDGERS: u32 = 2 * DAY_IN_LEDGERS;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueuedActionRecord {
    pub proposal_id: BytesN<32>,
    pub batch_hash: BytesN<32>,
    pub description_hash: BytesN<32>,
    pub queued_at: u32,
    pub eta: u32,
}

#[contracttype]
#[derive(Clone)]
struct BatchPreimage {
    targets: Vec<Address>,
    functions: Vec<Symbol>,
    args: Vec<Vec<Val>>,
}

#[contracttype]
#[derive(Clone)]
enum GovernorDataKey {
    Timelock,
    TimelockMinDelay,
    PrivilegedTarget(Address),
    QueuedAction(BytesN<32>),
}

#[contract]
pub struct CommunityGovernor;

fn bump_instance_ttl(e: &Env) {
    e.storage()
        .instance()
        .extend_ttl(STORAGE_TTL_THRESHOLD, STORAGE_EXTEND_AMOUNT);
}

fn require_community_owner_auth(e: &Env) {
    let token = CommunityGovernor::get_token_contract(e);
    let owner: Option<Address> = e.invoke_contract(&token, &symbol_short!("get_owner"), vec![e]);
    owner.expect("NFT has no owner").require_auth();
}

fn compute_batch_hash(
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

fn is_privileged_target(e: &Env, target: &Address) -> bool {
    let token = CommunityGovernor::get_token_contract(e);
    if *target == token || *target == e.current_contract_address() {
        return true;
    }
    e.storage()
        .instance()
        .get(&GovernorDataKey::PrivilegedTarget(target.clone()))
        .unwrap_or(false)
}

fn ensure_signaling_targets_allowed(e: &Env, targets: &Vec<Address>) {
    for i in 0..targets.len() {
        let target = targets.get(i).unwrap();
        assert!(
            !is_privileged_target(e, &target),
            "privileged target requires timelock queueing"
        );
    }
}

#[contractimpl]
impl CommunityGovernor {
    pub fn __constructor(
        e: &Env,
        token_contract: Address,
        voting_delay: u32,
        voting_period: u32,
        proposal_threshold: u128,
        quorum: u128,
    ) {
        governor::set_name(e, String::from_str(e, "StollaGovernor"));
        governor::set_version(e, String::from_str(e, "1.0.0"));
        governor::set_token_contract(e, &token_contract);
        governor::set_voting_delay(e, voting_delay);
        governor::set_voting_period(e, voting_period);
        governor::set_proposal_threshold(e, proposal_threshold);
        governor::set_quorum(e, quorum);
        bump_instance_ttl(e);
    }

    /// Configures the community Timelock and minimum execution delay (in ledgers),
    /// switching the Governor from signaling-only mode to mandatory queueing mode.
    pub fn configure_timelock(e: &Env, timelock: Address, min_delay_ledgers: u32) {
        require_community_owner_auth(e);
        assert!(min_delay_ledgers > 0, "timelock delay must be positive");
        let instance = e.storage().instance();
        instance.set(&GovernorDataKey::Timelock, &timelock);
        instance.set(&GovernorDataKey::TimelockMinDelay, &min_delay_ledgers);
        bump_instance_ttl(e);
    }

    /// Convenience helper that configures the Timelock with ADR-006 `DEFAULT_TIMELOCK_DELAY_LEDGERS`.
    pub fn set_timelock(e: &Env, timelock: Address) {
        Self::configure_timelock(e, timelock, DEFAULT_TIMELOCK_DELAY_LEDGERS);
    }

    /// Marks or unmarks an external contract (such as `CommunityTreasury`) as a
    /// privileged target that cannot be invoked while the Governor is in signaling-only mode.
    pub fn set_privileged_target(e: &Env, target: Address, privileged: bool) {
        require_community_owner_auth(e);
        let key = GovernorDataKey::PrivilegedTarget(target);
        if privileged {
            e.storage().instance().set(&key, &true);
        } else {
            e.storage().instance().remove(&key);
        }
        bump_instance_ttl(e);
    }

    pub fn timelock(e: &Env) -> Option<Address> {
        bump_instance_ttl(e);
        e.storage().instance().get(&GovernorDataKey::Timelock)
    }

    pub fn timelock_min_delay(e: &Env) -> u32 {
        bump_instance_ttl(e);
        e.storage()
            .instance()
            .get(&GovernorDataKey::TimelockMinDelay)
            .unwrap_or(DEFAULT_TIMELOCK_DELAY_LEDGERS)
    }

    /// Returns `true` while no Timelock has been configured (`proposals_need_queuing() == false`).
    pub fn is_signaling_only(e: &Env) -> bool {
        bump_instance_ttl(e);
        !Self::proposals_need_queuing(e)
    }

    /// Computes the canonical SHA-256 batch digest over XDR-encoded `(targets, functions, args)`.
    pub fn batch_hash(
        e: &Env,
        targets: Vec<Address>,
        functions: Vec<Symbol>,
        args: Vec<Vec<Val>>,
    ) -> BytesN<32> {
        bump_instance_ttl(e);
        compute_batch_hash(e, &targets, &functions, &args)
    }

    /// Returns the stored queued action metadata for `proposal_id`, if queued.
    pub fn get_queued_action(e: &Env, proposal_id: BytesN<32>) -> Option<QueuedActionRecord> {
        bump_instance_ttl(e);
        let key = GovernorDataKey::QueuedAction(proposal_id);
        let record: Option<QueuedActionRecord> = e.storage().persistent().get(&key);
        if record.is_some() {
            e.storage()
                .persistent()
                .extend_ttl(&key, STORAGE_TTL_THRESHOLD, STORAGE_EXTEND_AMOUNT);
        }
        record
    }

    /// Verifies that the exact action payload corresponds to a `Succeeded` or `Queued` proposal
    /// on this Governor (used by `CommunityTimelock` and off-chain verifiers).
    pub fn verify_approved_action(
        e: &Env,
        targets: Vec<Address>,
        functions: Vec<Symbol>,
        args: Vec<Vec<Val>>,
        description_hash: BytesN<32>,
    ) -> bool {
        bump_instance_ttl(e);
        if targets.is_empty()
            || targets.len() != functions.len()
            || targets.len() != args.len()
        {
            return false;
        }
        let proposal_id =
            governor::hash_proposal(e, &targets, &functions, &args, &description_hash);
        let state = Self::proposal_state(e, proposal_id.clone());
        match state {
            ProposalState::Succeeded => true,
            ProposalState::Queued => {
                if let Some(record) = Self::get_queued_action(e, proposal_id) {
                    let digest = compute_batch_hash(e, &targets, &functions, &args);
                    record.batch_hash == digest && record.description_hash == description_hash
                } else {
                    false
                }
            }
            _ => false,
        }
    }

    /// The NFT owner is the upgrade authority for this community. Its owner
    /// must be transferred to the Timelock during activation.
    pub fn upgrade(e: &Env, new_wasm_hash: BytesN<32>) {
        require_community_owner_auth(e);
        bump_instance_ttl(e);
        e.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    /// Mirrors the NFT bootstrap-owner proof used by this upgrade hook.
    pub fn bootstrap_authority_remaining(e: &Env) -> bool {
        let token = Self::get_token_contract(e);
        e.invoke_contract(
            &token,
            &Symbol::new(e, "bootstrap_authority_remaining"),
            vec![e],
        )
    }

    /// Permissionlessly renew the contract instance and governance configuration.
    ///
    /// Scalable proposal and vote records are renewed separately when read.
    pub fn extend_instance_ttl(e: &Env) {
        bump_instance_ttl(e);
    }
}

#[contractimpl(contracttrait)]
impl Governor for CommunityGovernor {
    fn proposals_need_queuing(e: &Env) -> bool {
        e.storage().instance().has(&GovernorDataKey::Timelock)
    }

    fn queue(
        e: &Env,
        targets: Vec<Address>,
        functions: Vec<Symbol>,
        args: Vec<Vec<Val>>,
        description_hash: BytesN<32>,
        eta: u32,
        operator: Address,
    ) -> BytesN<32> {
        bump_instance_ttl(e);
        if !Self::proposals_need_queuing(e) {
            panic_with_error!(e, GovernorError::QueueNotEnabled);
        }
        operator.require_auth();

        let now = e.ledger().sequence();
        let min_eta = now
            .checked_add(Self::timelock_min_delay(e))
            .unwrap_or_else(|| panic_with_error!(e, GovernorError::MathOverflow));
        assert!(eta >= min_eta, "eta below minimum timelock delay");

        let proposal_id =
            governor::hash_proposal(e, &targets, &functions, &args, &description_hash);
        let snapshot = governor::get_proposal_snapshot(e, &proposal_id);
        let quorum = Self::quorum(e, snapshot);
        let digest = compute_batch_hash(e, &targets, &functions, &args);

        let queued_id = governor::queue(
            e,
            targets,
            functions,
            args,
            &description_hash,
            eta,
            quorum,
        );

        let record = QueuedActionRecord {
            proposal_id: queued_id.clone(),
            batch_hash: digest,
            description_hash,
            queued_at: now,
            eta,
        };
        let key = GovernorDataKey::QueuedAction(queued_id.clone());
        e.storage().persistent().set(&key, &record);
        e.storage()
            .persistent()
            .extend_ttl(&key, STORAGE_TTL_THRESHOLD, STORAGE_EXTEND_AMOUNT);

        queued_id
    }

    fn execute(
        e: &Env,
        targets: Vec<Address>,
        functions: Vec<Symbol>,
        args: Vec<Vec<Val>>,
        description_hash: BytesN<32>,
        executor: Address,
    ) -> BytesN<32> {
        bump_instance_ttl(e);
        executor.require_auth();
        let proposal_id =
            governor::hash_proposal(e, &targets, &functions, &args, &description_hash);
        let snapshot = governor::get_proposal_snapshot(e, &proposal_id);
        let quorum = Self::quorum(e, snapshot);
        let need_queuing = Self::proposals_need_queuing(e);

        if need_queuing {
            let state = Self::proposal_state(e, proposal_id.clone());
            if state == ProposalState::Executed {
                panic_with_error!(e, GovernorError::ProposalAlreadyExecuted);
            }
            if state != ProposalState::Queued {
                panic_with_error!(e, GovernorError::ProposalNotQueued);
            }
            let record = Self::get_queued_action(e, proposal_id.clone())
                .unwrap_or_else(|| panic_with_error!(e, GovernorError::ProposalNotQueued));
            let digest = compute_batch_hash(e, &targets, &functions, &args);
            assert!(
                record.batch_hash == digest && record.description_hash == description_hash,
                "queued action batch mismatch"
            );
            assert!(
                e.ledger().sequence() >= record.eta,
                "timelock delay has not elapsed"
            );
        } else {
            ensure_signaling_targets_allowed(e, &targets);
        }

        governor::execute(
            e,
            targets,
            functions,
            args,
            &description_hash,
            need_queuing,
            quorum,
        )
    }

    fn cancel(
        e: &Env,
        targets: Vec<Address>,
        functions: Vec<Symbol>,
        args: Vec<Vec<Val>>,
        description_hash: BytesN<32>,
        operator: Address,
    ) -> BytesN<32> {
        bump_instance_ttl(e);
        let proposal_id =
            governor::hash_proposal(e, &targets, &functions, &args, &description_hash);
        let proposer = governor::get_proposal_proposer(e, &proposal_id);
        assert!(operator == proposer);
        operator.require_auth();
        governor::cancel(e, targets, functions, args, &description_hash)
    }
}
