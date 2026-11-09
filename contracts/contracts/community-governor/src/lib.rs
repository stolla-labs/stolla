#![no_std]

mod test;

use soroban_sdk::{
    contract, contractimpl, contracttype, panic_with_error, symbol_short, vec, Address, BytesN,
    Env, String, Symbol, Val, Vec,
};
use stellar_governance::governor::{self as governor, Governor, GovernorError, ProposalState};

const DAY_IN_LEDGERS: u32 = 17_280;
pub const STORAGE_EXTEND_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
pub const STORAGE_TTL_THRESHOLD: u32 = STORAGE_EXTEND_AMOUNT - DAY_IN_LEDGERS;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ApprovedAction {
    pub proposal_id: BytesN<32>,
    pub targets: Vec<Address>,
    pub functions: Vec<Symbol>,
    pub args: Vec<Vec<Val>>,
    pub description_hash: BytesN<32>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Timelock,
    ProposalAction(BytesN<32>),
    ProposalEta(BytesN<32>),
}

#[contract]
pub struct CommunityGovernor;

fn bump_instance_ttl(e: &Env) {
    e.storage()
        .instance()
        .extend_ttl(STORAGE_TTL_THRESHOLD, STORAGE_EXTEND_AMOUNT);
}

fn bump_persistent_ttl(e: &Env, key: &DataKey) {
    e.storage()
        .persistent()
        .extend_ttl(key, STORAGE_TTL_THRESHOLD, STORAGE_EXTEND_AMOUNT);
}

fn require_nft_owner_auth(e: &Env) {
    let token = CommunityGovernor::get_token_contract(e);
    let owner: Option<Address> =
        e.invoke_contract(&token, &symbol_short!("get_owner"), vec![e]);
    owner.expect("NFT has no owner").require_auth();
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

    /// Configure or clear the community Timelock address.
    ///
    /// When a Timelock address is set, the community operates in executable
    /// mode (`proposals_need_queuing() == true`) and requires proposals to be
    /// queued before execution. When `None` is set, signaling-only mode remains
    /// available (`proposals_need_queuing() == false`).
    pub fn set_timelock(e: &Env, timelock: Option<Address>) {
        require_nft_owner_auth(e);
        bump_instance_ttl(e);
        match timelock {
            Some(address) => e.storage().instance().set(&DataKey::Timelock, &address),
            None => e.storage().instance().remove(&DataKey::Timelock),
        }
    }

    /// Return the configured Timelock address (`None` when in signaling-only mode).
    pub fn timelock(e: &Env) -> Option<Address> {
        e.storage().instance().get(&DataKey::Timelock)
    }

    /// Return the exact canonical action payload (`targets`, `functions`, `args`,
    /// `description_hash`) recorded when `proposal_id` was proposed, for
    /// Timelock verification.
    pub fn get_proposal_action(e: &Env, proposal_id: BytesN<32>) -> Option<ApprovedAction> {
        let key = DataKey::ProposalAction(proposal_id);
        let action: Option<ApprovedAction> = e.storage().persistent().get(&key);
        if action.is_some() {
            bump_persistent_ttl(e, &key);
        }
        action
    }

    /// Verify that the submitted `targets`, `functions`, `args`, and
    /// `description_hash` match the exact approved proposal payload.
    pub fn verify_proposal_action(
        e: &Env,
        proposal_id: BytesN<32>,
        targets: Vec<Address>,
        functions: Vec<Symbol>,
        args: Vec<Vec<Val>>,
        description_hash: BytesN<32>,
    ) -> bool {
        let computed = governor::hash_proposal(e, &targets, &functions, &args, &description_hash);
        if computed != proposal_id {
            return false;
        }
        match Self::get_proposal_action(e, proposal_id.clone()) {
            Some(recorded) => {
                recorded.proposal_id == proposal_id
                    && recorded.targets == targets
                    && recorded.functions == functions
                    && recorded.args == args
                    && recorded.description_hash == description_hash
            }
            None => false,
        }
    }

    /// Return the queued ETA ledger for a queued proposal, if any.
    pub fn proposal_eta(e: &Env, proposal_id: BytesN<32>) -> Option<u32> {
        let key = DataKey::ProposalEta(proposal_id);
        let eta: Option<u32> = e.storage().persistent().get(&key);
        if eta.is_some() {
            bump_persistent_ttl(e, &key);
        }
        eta
    }

    /// The NFT owner is the upgrade authority for this community. Its owner
    /// must be transferred to the Timelock during activation.
    pub fn upgrade(e: &Env, new_wasm_hash: BytesN<32>) {
        require_nft_owner_auth(e);
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
        Self::timelock(e).is_some()
    }

    fn propose(
        e: &Env,
        targets: Vec<Address>,
        functions: Vec<Symbol>,
        args: Vec<Vec<Val>>,
        description: String,
        proposer: Address,
    ) -> BytesN<32> {
        proposer.require_auth();
        let description_hash = e.crypto().keccak256(&description.to_bytes()).to_bytes();
        let proposal_id = governor::propose(
            e,
            targets.clone(),
            functions.clone(),
            args.clone(),
            description,
            &proposer,
        );
        let key = DataKey::ProposalAction(proposal_id.clone());
        let action = ApprovedAction {
            proposal_id: proposal_id.clone(),
            targets,
            functions,
            args,
            description_hash,
        };
        e.storage().persistent().set(&key, &action);
        bump_persistent_ttl(e, &key);
        proposal_id
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
        operator.require_auth();
        if !Self::proposals_need_queuing(e) {
            panic_with_error!(e, GovernorError::QueueNotEnabled);
        }
        let proposal_id =
            governor::hash_proposal(e, &targets, &functions, &args, &description_hash);
        if !Self::verify_proposal_action(
            e,
            proposal_id.clone(),
            targets.clone(),
            functions.clone(),
            args.clone(),
            description_hash.clone(),
        ) {
            panic_with_error!(e, GovernorError::ProposalNotFound);
        }
        assert!(eta >= e.ledger().sequence(), "ETA cannot be in the past");
        let snapshot = governor::get_proposal_snapshot(e, &proposal_id);
        let quorum = Self::quorum(e, snapshot);
        let queued_id = governor::queue(
            e,
            targets,
            functions,
            args,
            &description_hash,
            eta,
            quorum,
        );
        let eta_key = DataKey::ProposalEta(proposal_id);
        e.storage().persistent().set(&eta_key, &eta);
        bump_persistent_ttl(e, &eta_key);
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
        let needs_queuing = Self::proposals_need_queuing(e);
        if needs_queuing {
            if !Self::verify_proposal_action(
                e,
                proposal_id.clone(),
                targets.clone(),
                functions.clone(),
                args.clone(),
                description_hash.clone(),
            ) {
                panic_with_error!(e, GovernorError::ProposalNotFound);
            }
            if let Some(eta) = Self::proposal_eta(e, proposal_id.clone()) {
                assert!(e.ledger().sequence() >= eta, "Timelock ETA not reached");
            }
        }
        let snapshot = governor::get_proposal_snapshot(e, &proposal_id);
        let quorum = Self::quorum(e, snapshot);
        governor::execute(
            e,
            targets,
            functions,
            args,
            &description_hash,
            needs_queuing,
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
