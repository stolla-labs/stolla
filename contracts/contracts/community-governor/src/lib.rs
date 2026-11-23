#![no_std]

mod test;

use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, panic_with_error,
    symbol_short, vec, Address, BytesN, Env, String, Symbol, Val, Vec,
};
use stellar_governance::governor::{self as governor, Governor, GovernorError, ProposalState};

const DAY_IN_LEDGERS: u32 = 17_280;
pub const STORAGE_EXTEND_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
pub const STORAGE_TTL_THRESHOLD: u32 = STORAGE_EXTEND_AMOUNT - DAY_IN_LEDGERS;

#[contract]
pub struct CommunityGovernor;

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Timelock,
    Approved(BytesN<32>),
}

/// Exact action bytes accepted at queue time, for Timelock verification.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ApprovedAction {
    pub targets: Vec<Address>,
    pub functions: Vec<Symbol>,
    pub args: Vec<Vec<Val>>,
    pub description_hash: BytesN<32>,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum GovernorIntegrationError {
    TimelockAlreadySet = 1,
    ActionMismatch = 2,
    /// A configured Timelock must execute the action. Governor execution would
    /// skip the delay.
    DirectExecutionDisabled = 3,
}

#[contractclient(name = "TimelockQueueClient")]
trait TimelockQueue {
    fn queue_from_governor(
        e: &Env,
        targets: Vec<Address>,
        functions: Vec<Symbol>,
        args: Vec<Vec<Val>>,
        description_hash: BytesN<32>,
        operator: Address,
    ) -> BytesN<32>;
    fn min_delay(e: &Env) -> u32;
}

fn stored_timelock(e: &Env) -> Option<Address> {
    e.storage().instance().get(&DataKey::Timelock)
}

fn bump_instance_ttl(e: &Env) {
    e.storage()
        .instance()
        .extend_ttl(STORAGE_TTL_THRESHOLD, STORAGE_EXTEND_AMOUNT);
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

    /// The NFT owner is the upgrade authority for this community. Its owner
    /// must be transferred to the Timelock during activation.
    pub fn upgrade(e: &Env, new_wasm_hash: BytesN<32>) {
        let token = Self::get_token_contract(e);
        let owner: Option<Address> =
            e.invoke_contract(&token, &symbol_short!("get_owner"), vec![e]);
        owner.expect("NFT has no owner").require_auth();
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

    /// Bind this Governor to its community Timelock once.
    ///
    /// The NFT owner authorizes the binding, the same authority as `upgrade`.
    /// After this, succeeded proposals must be queued and cannot be executed
    /// directly. With no Timelock set, the Governor stays in signaling mode.
    pub fn set_timelock(e: &Env, timelock: Address) {
        let token = Self::get_token_contract(e);
        let owner: Option<Address> =
            e.invoke_contract(&token, &symbol_short!("get_owner"), vec![e]);
        owner.expect("NFT has no owner").require_auth();
        if stored_timelock(e).is_some() {
            panic_with_error!(e, GovernorIntegrationError::TimelockAlreadySet);
        }
        e.storage().instance().set(&DataKey::Timelock, &timelock);
        bump_instance_ttl(e);
    }

    pub fn get_timelock(e: &Env) -> Option<Address> {
        bump_instance_ttl(e);
        stored_timelock(e)
    }

    /// Exact targets, functions, arguments, and description hash stored at queue.
    pub fn get_approved_action(e: &Env, proposal_id: BytesN<32>) -> Option<ApprovedAction> {
        bump_instance_ttl(e);
        let key = DataKey::Approved(proposal_id);
        let action = e.storage().persistent().get(&key);
        if action.is_some() {
            e.storage().persistent().extend_ttl(
                &key,
                STORAGE_TTL_THRESHOLD,
                STORAGE_EXTEND_AMOUNT,
            );
        }
        action
    }
}

#[contractimpl(contracttrait)]
impl Governor for CommunityGovernor {
    fn proposals_need_queuing(e: &Env) -> bool {
        stored_timelock(e).is_some()
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
        if !Self::proposals_need_queuing(e) {
            panic_with_error!(e, GovernorError::QueueNotEnabled);
        }
        bump_instance_ttl(e);
        operator.require_auth();
        let proposal_id =
            governor::hash_proposal(e, &targets, &functions, &args, &description_hash);
        let snapshot = governor::get_proposal_snapshot(e, &proposal_id);
        let quorum = Self::quorum(e, snapshot);
        if governor::get_proposal_state(e, &proposal_id, quorum) != ProposalState::Succeeded {
            panic_with_error!(e, GovernorError::ProposalNotSuccessful);
        }
        let action = ApprovedAction {
            targets: targets.clone(),
            functions: functions.clone(),
            args: args.clone(),
            description_hash: description_hash.clone(),
        };
        let key = DataKey::Approved(proposal_id.clone());
        e.storage().persistent().set(&key, &action);
        e.storage().persistent().extend_ttl(
            &key,
            STORAGE_TTL_THRESHOLD,
            STORAGE_EXTEND_AMOUNT,
        );
        let timelock_id = stored_timelock(e).unwrap();
        let delay = TimelockQueueClient::new(e, &timelock_id).min_delay();
        let queued_eta = e.ledger().sequence().saturating_add(delay);
        let _ = eta;
        let governor_address = e.current_contract_address();
        governor_address.require_auth();
        TimelockQueueClient::new(e, &timelock_id).queue_from_governor(
            &targets,
            &functions,
            &args,
            &description_hash,
            &governor_address,
        );
        governor::queue(
            e,
            targets,
            functions,
            args,
            &description_hash,
            queued_eta,
            quorum,
        )
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
        if Self::proposals_need_queuing(e) {
            let state = governor::get_proposal_state(e, &proposal_id, quorum);
            if state != ProposalState::Queued {
                panic_with_error!(e, GovernorError::ProposalNotQueued);
            }
            let stored: ApprovedAction = e
                .storage()
                .persistent()
                .get(&DataKey::Approved(proposal_id))
                .unwrap();
            if stored.targets != targets
                || stored.functions != functions
                || stored.args != args
                || stored.description_hash != description_hash
            {
                panic_with_error!(e, GovernorIntegrationError::ActionMismatch);
            }
            // storage::execute would invoke the targets immediately and skip
            // the Timelock delay. The Timelock is the only executor.
            panic_with_error!(e, GovernorIntegrationError::DirectExecutionDisabled);
        }
        governor::execute(
            e,
            targets,
            functions,
            args,
            &description_hash,
            false,
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
