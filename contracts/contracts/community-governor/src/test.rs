#![cfg(test)]

use soroban_sdk::{
    contract, contractimpl,
    testutils::{
        storage::Instance as _, Address as _, AuthorizedFunction, AuthorizedInvocation,
        Events as _, Ledger as _, MockAuth, MockAuthInvoke,
    },
    vec, Address, BytesN, Env, Event, IntoVal, String, Symbol, Val, Vec,
};
extern crate std;
use stellar_governance::{
    governor::{
        get_proposal_vote_counts, GovernorClient, ProposalCancelled, ProposalCreated,
        ProposalExecuted, ProposalState, VoteCast, VOTE_ABSTAIN, VOTE_AGAINST, VOTE_FOR,
    },
    votes::VotesClient,
};

use community_nft::{CommunityNft, CommunityNftClient};

use crate::{
    CommunityGovernor, CommunityGovernorClient, DEFAULT_TIMELOCK_DELAY_LEDGERS,
    STORAGE_EXTEND_AMOUNT, STORAGE_TTL_THRESHOLD,
};

const GOVERNOR_WASM: &[u8] =
    include_bytes!("../../community-factory/test_wasm/community_governor.wasm");

#[test]
fn upgrade_tracks_nft_owner_and_rejects_bootstrap_owner_after_transfer() {
    let e = Env::default();
    let fixture = setup_governance(&e);
    let upgrade_client = CommunityGovernorClient::new(&e, &fixture.governor_id);
    let successor = Address::generate(&e);
    let hash = e.deployer().upload_contract_wasm(GOVERNOR_WASM);
    assert!(upgrade_client.bootstrap_authority_remaining());

    e.mock_auths(&[MockAuth {
        address: &successor,
        invoke: &MockAuthInvoke {
            contract: &fixture.governor_id,
            fn_name: "upgrade",
            args: (&hash,).into_val(&e),
            sub_invokes: &[],
        },
    }]);
    assert!(upgrade_client.try_upgrade(&hash).is_err());

    e.mock_all_auths();
    fixture.nft.transfer_ownership(&successor, &100);
    fixture.nft.accept_ownership();
    assert!(!upgrade_client.bootstrap_authority_remaining());

    e.mock_auths(&[MockAuth {
        address: &fixture.owner,
        invoke: &MockAuthInvoke {
            contract: &fixture.governor_id,
            fn_name: "upgrade",
            args: (&hash,).into_val(&e),
            sub_invokes: &[],
        },
    }]);
    assert!(upgrade_client.try_upgrade(&hash).is_err());

    e.mock_auths(&[MockAuth {
        address: &successor,
        invoke: &MockAuthInvoke {
            contract: &fixture.governor_id,
            fn_name: "upgrade",
            args: (&hash,).into_val(&e),
            sub_invokes: &[],
        },
    }]);
    upgrade_client.upgrade(&hash);
}

#[contract]
struct GovernorExecutionTarget;

#[contractimpl]
impl GovernorExecutionTarget {
    pub fn apply(e: &Env, value: u32) {
        let value_key = Symbol::new(e, "value");
        let calls_key = Symbol::new(e, "calls");
        let calls: u32 = e.storage().instance().get(&calls_key).unwrap_or(0);
        e.storage().instance().set(&value_key, &value);
        e.storage().instance().set(&calls_key, &(calls + 1));
    }

    pub fn value(e: &Env) -> u32 {
        e.storage()
            .instance()
            .get(&Symbol::new(e, "value"))
            .unwrap_or(0)
    }

    pub fn calls(e: &Env) -> u32 {
        e.storage()
            .instance()
            .get(&Symbol::new(e, "calls"))
            .unwrap_or(0)
    }
}

struct ExecutableProposal {
    target_id: Address,
    targets: Vec<Address>,
    functions: Vec<Symbol>,
    args: Vec<Vec<Val>>,
    description: String,
    description_hash: BytesN<32>,
}

/// Default governance parameters used by most Governor unit tests.
pub struct GovernanceParams {
    pub voting_delay: u32,
    pub voting_period: u32,
    pub proposal_threshold: u128,
    pub quorum: u128,
}

impl Default for GovernanceParams {
    fn default() -> Self {
        Self {
            voting_delay: 1,
            voting_period: 10_000,
            proposal_threshold: 1,
            quorum: 1,
        }
    }
}

/// How many NFTs to mint for a voter and who receives their delegated votes.
pub struct VoterSpec {
    pub nft_count: u32,
    /// When `None`, the voter delegates to themselves.
    pub delegatee: Option<Address>,
}

impl VoterSpec {
    pub fn self_delegate(nft_count: u32) -> Self {
        Self {
            nft_count,
            delegatee: None,
        }
    }
}

/// Signaling proposal payload returned by [`signaling_proposal`].
pub struct SignalingProposal {
    pub targets: Vec<Address>,
    pub functions: Vec<Symbol>,
    pub args: Vec<Vec<Val>>,
    pub description: String,
}

/// Deployed NFT + Governor stack with configured voters.
#[allow(dead_code)] // Fields are part of the shared fixture surface for follow-up tests.
pub struct GovernanceFixture<'a> {
    pub env: &'a Env,
    pub owner: Address,
    pub nft_id: Address,
    pub governor_id: Address,
    pub nft: CommunityNftClient<'a>,
    pub votes: VotesClient<'a>,
    pub governor: GovernorClient<'a>,
    pub params: GovernanceParams,
    pub voters: std::vec::Vec<Address>,
}

impl<'a> GovernanceFixture<'a> {
    pub fn primary_voter(&self) -> &Address {
        self.voters
            .first()
            .expect("fixture must include at least one voter")
    }

    /// Create a signaling proposal from `proposer` and return its id.
    pub fn propose_signaling(&self, proposer: &Address) -> soroban_sdk::BytesN<32> {
        let proposal = signaling_proposal(self.env);
        self.governor.propose(
            &proposal.targets,
            &proposal.functions,
            &proposal.args,
            &proposal.description,
            proposer,
        )
    }
}

/// Set the ledger sequence to an absolute value.
pub fn set_ledger_sequence(e: &Env, sequence: u32) {
    e.ledger().with_mut(|li| {
        li.sequence_number = sequence;
    });
}

/// Advance the ledger sequence by a named delta.
pub fn advance_ledger(e: &Env, by: u32) {
    e.ledger().with_mut(|li| {
        li.sequence_number += by;
    });
}

/// Advance past the voting delay so a freshly created proposal becomes Active.
pub fn advance_past_voting_delay(e: &Env, params: &GovernanceParams) {
    advance_ledger(e, params.voting_delay.saturating_add(1));
}

/// Advance through the full voting period so an Active proposal can close.
pub fn advance_past_voting_period(e: &Env, params: &GovernanceParams) {
    advance_ledger(e, params.voting_period);
}

/// Build the standard no-op signaling proposal payload.
pub fn signaling_proposal(e: &Env) -> SignalingProposal {
    let target = Address::generate(e);
    SignalingProposal {
        targets: vec![e, target],
        functions: vec![e, Symbol::new(e, "noop")],
        args: vec![e, vec![e]],
        description: String::from_str(e, "Signal proposal: welcome members"),
    }
}

fn executable_proposal(e: &Env, value: u32) -> ExecutableProposal {
    let target_id = e.register(GovernorExecutionTarget, ());
    let targets = vec![e, target_id.clone()];
    let functions = vec![e, Symbol::new(e, "apply")];
    let args = vec![e, vec![e, value.into_val(e)]];
    let description = String::from_str(e, "Set the execution fixture value");
    let description_hash = e.crypto().keccak256(&description.to_bytes()).to_bytes();

    ExecutableProposal {
        target_id,
        targets,
        functions,
        args,
        description,
        description_hash,
    }
}

fn pass_executable_proposal(
    fixture: &GovernanceFixture<'_>,
    proposal: &ExecutableProposal,
    proposer: &Address,
) -> BytesN<32> {
    let proposal_id = fixture.governor.propose(
        &proposal.targets,
        &proposal.functions,
        &proposal.args,
        &proposal.description,
        proposer,
    );
    let snapshot = fixture.governor.proposal_snapshot(&proposal_id);
    set_ledger_sequence(fixture.env, snapshot + 1);
    fixture.governor.cast_vote(
        &proposal_id,
        &VOTE_FOR,
        &String::from_str(fixture.env, "Execute the approved action"),
        proposer,
    );
    let deadline = fixture.governor.proposal_deadline(&proposal_id);
    set_ledger_sequence(fixture.env, deadline + 1);
    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Succeeded
    );
    proposal_id
}

fn mock_execute_auth(
    e: &Env,
    governor_id: &Address,
    proposal: &ExecutableProposal,
    executor: &Address,
) {
    e.mock_auths(&[MockAuth {
        address: executor,
        invoke: &MockAuthInvoke {
            contract: governor_id,
            fn_name: "execute",
            args: (
                &proposal.targets,
                &proposal.functions,
                &proposal.args,
                &proposal.description_hash,
                executor,
            )
                .into_val(e),
            sub_invokes: &[],
        },
    }]);
}

fn mint_nfts(e: &Env, nft: &CommunityNftClient<'_>, to: &Address, count: u32) {
    for i in 0..count {
        let uri = String::from_str(e, &std::format!("ipfs://QmMember/{i}/metadata.json"));
        nft.mint(to, &uri);
    }
}

/// Deploy NFT + Governor and provision voters with deterministic mint/delegate setup.
pub fn deploy_governance<'a>(
    e: &'a Env,
    params: GovernanceParams,
    voter_specs: &[VoterSpec],
) -> GovernanceFixture<'a> {
    e.mock_all_auths();

    let owner = Address::generate(e);
    let nft_id = e.register(
        CommunityNft,
        (
            String::from_str(e, "ipfs://collection/"),
            String::from_str(e, "Stolla Community"),
            String::from_str(e, "STOLLA"),
            owner.clone(),
        ),
    );
    let nft = CommunityNftClient::new(e, &nft_id);
    let votes = VotesClient::new(e, &nft_id);

    let mut voters = std::vec::Vec::with_capacity(voter_specs.len());
    for spec in voter_specs {
        let voter = Address::generate(e);
        mint_nfts(e, &nft, &voter, spec.nft_count);
        let delegatee = spec.delegatee.clone().unwrap_or_else(|| voter.clone());
        votes.delegate(&voter, &delegatee);
        voters.push(voter);
    }

    let governor_id = e.register(
        CommunityGovernor,
        (
            nft_id.clone(),
            params.voting_delay,
            params.voting_period,
            params.proposal_threshold,
            params.quorum,
        ),
    );

    GovernanceFixture {
        env: e,
        owner,
        nft_id,
        governor_id: governor_id.clone(),
        nft,
        votes,
        governor: GovernorClient::new(e, &governor_id),
        params,
        voters,
    }
}

/// Convenience wrapper matching the historical single-voter setup.
fn setup_governance(e: &Env) -> GovernanceFixture<'_> {
    deploy_governance(
        e,
        GovernanceParams::default(),
        &[VoterSpec::self_delegate(1)],
    )
}

#[test]
fn multi_voter_fixture_assigns_distinct_weights() {
    let e = Env::default();
    set_ledger_sequence(&e, 100);

    let fixture = deploy_governance(
        &e,
        GovernanceParams {
            voting_delay: 2,
            voting_period: 50,
            proposal_threshold: 1,
            quorum: 3,
        },
        &[
            VoterSpec::self_delegate(1),
            VoterSpec::self_delegate(2),
            VoterSpec::self_delegate(4),
        ],
    );

    assert_eq!(fixture.voters.len(), 3);
    assert_eq!(fixture.votes.get_votes(&fixture.voters[0]), 1);
    assert_eq!(fixture.votes.get_votes(&fixture.voters[1]), 2);
    assert_eq!(fixture.votes.get_votes(&fixture.voters[2]), 4);
    assert_eq!(fixture.params.voting_delay, 2);
    assert_eq!(fixture.params.quorum, 3);

    advance_ledger(&e, 1);
    let proposal_id = fixture.propose_signaling(&fixture.voters[0]);
    advance_past_voting_delay(&e, &fixture.params);

    let reason = String::from_str(&e, "Support");
    fixture
        .governor
        .cast_vote(&proposal_id, &1, &reason, &fixture.voters[1]);
    fixture
        .governor
        .cast_vote(&proposal_id, &0, &reason, &fixture.voters[2]);

    advance_past_voting_period(&e, &fixture.params);
    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Defeated
    );
}

#[test]
fn propose_and_cast_vote_succeeds() {
    let e = Env::default();
    set_ledger_sequence(&e, 100);

    let fixture = setup_governance(&e);
    let voter = fixture.primary_voter().clone();
    assert_eq!(fixture.votes.get_votes(&voter), 1);

    advance_ledger(&e, 1);

    let proposal = signaling_proposal(&e);
    let proposal_id = fixture.governor.propose(
        &proposal.targets,
        &proposal.functions,
        &proposal.args,
        &proposal.description,
        &voter,
    );

    advance_past_voting_delay(&e, &fixture.params);

    let reason = String::from_str(&e, "Support");
    fixture
        .governor
        .cast_vote(&proposal_id, &1, &reason, &voter);

    advance_past_voting_period(&e, &fixture.params);

    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Succeeded
    );
}

#[test]
fn propose_emits_proposal_created_event() {
    let e = Env::default();
    set_ledger_sequence(&e, 100);

    let fixture = setup_governance(&e);
    let voter = fixture.primary_voter().clone();

    advance_ledger(&e, 1);

    let proposal = signaling_proposal(&e);
    let proposal_id = fixture.governor.propose(
        &proposal.targets,
        &proposal.functions,
        &proposal.args,
        &proposal.description,
        &voter,
    );

    let vote_snapshot = 101 + fixture.params.voting_delay;
    let vote_end = vote_snapshot + fixture.params.voting_period;

    let expected = ProposalCreated {
        proposal_id: proposal_id.clone(),
        proposer: voter.clone(),
        targets: proposal.targets.clone(),
        functions: proposal.functions.clone(),
        args: proposal.args.clone(),
        vote_snapshot,
        vote_end,
        description: proposal.description.clone(),
    };

    assert_eq!(
        e.events().all(),
        std::vec![expected.to_xdr(&e, &fixture.governor_id)],
    );

    assert_eq!(proposal_id, expected.proposal_id);
}

#[test]
fn voting_period_boundary_keeps_active_through_inclusive_deadline() {
    let e = Env::default();
    set_ledger_sequence(&e, 100);

    let params = GovernanceParams {
        voting_delay: 1,
        voting_period: 5,
        proposal_threshold: 1,
        quorum: 1,
    };
    let fixture = deploy_governance(
        &e,
        params,
        &[VoterSpec::self_delegate(1), VoterSpec::self_delegate(1)],
    );
    let proposer = fixture.voters[0].clone();
    let late_voter = fixture.voters[1].clone();

    advance_ledger(&e, 1); // propose at ledger 101
    let proposal_id = fixture.propose_signaling(&proposer);
    let snapshot = fixture.governor.proposal_snapshot(&proposal_id);
    let deadline = fixture.governor.proposal_deadline(&proposal_id);
    assert_eq!(snapshot, 102); // 101 + voting_delay
    assert_eq!(deadline, snapshot + fixture.params.voting_period);
    assert_eq!(deadline, 107);

    // First Active ledger is the ledger after snapshot.
    set_ledger_sequence(&e, snapshot + 1);
    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Active
    );

    // Last Active ledger is the inclusive deadline.
    set_ledger_sequence(&e, deadline);
    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Active
    );
    let reason = String::from_str(&e, "Boundary For");
    let weight = fixture
        .governor
        .cast_vote(&proposal_id, &VOTE_FOR, &reason, &proposer);
    assert_eq!(weight, 1);

    // First closed ledger is deadline + 1.
    set_ledger_sequence(&e, deadline + 1);
    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Succeeded
    );

    let counts_before = e.as_contract(&fixture.governor_id, || {
        get_proposal_vote_counts(&e, &proposal_id)
    });
    assert!(!fixture.governor.has_voted(&proposal_id, &late_voter));

    let late_result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        fixture.governor.cast_vote(
            &proposal_id,
            &VOTE_FOR,
            &String::from_str(&e, "Too late"),
            &late_voter,
        );
    }));
    assert!(late_result.is_err());
    assert!(!fixture.governor.has_voted(&proposal_id, &late_voter));

    let counts_after = e.as_contract(&fixture.governor_id, || {
        get_proposal_vote_counts(&e, &proposal_id)
    });
    assert_eq!(counts_after.for_votes, counts_before.for_votes);
    assert_eq!(counts_after.against_votes, counts_before.against_votes);
    assert_eq!(counts_after.abstain_votes, counts_before.abstain_votes);
}

#[test]
#[should_panic(expected = "Error(Contract, #5002)")]
fn proposal_threshold_rejects_proposer_one_below_boundary() {
    let e = Env::default();
    set_ledger_sequence(&e, 100);

    let fixture = deploy_governance(
        &e,
        GovernanceParams {
            voting_delay: 1,
            voting_period: 10,
            proposal_threshold: 2,
            quorum: 1,
        },
        &[VoterSpec::self_delegate(1)],
    );
    assert_eq!(fixture.votes.get_votes(fixture.primary_voter()), 1);

    advance_ledger(&e, 1);
    let _ = fixture.propose_signaling(fixture.primary_voter());
}

#[test]
fn proposal_threshold_allows_proposer_exactly_at_boundary() {
    let e = Env::default();
    set_ledger_sequence(&e, 100);

    let fixture = deploy_governance(
        &e,
        GovernanceParams {
            voting_delay: 1,
            voting_period: 10,
            proposal_threshold: 2,
            quorum: 1,
        },
        &[VoterSpec::self_delegate(2)],
    );
    let proposer = fixture.primary_voter().clone();
    assert_eq!(fixture.votes.get_votes(&proposer), 2);

    advance_ledger(&e, 1);
    let proposal_id = fixture.propose_signaling(&proposer);
    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Pending
    );
    assert_eq!(fixture.governor.proposal_proposer(&proposal_id), proposer);
}

#[test]
fn voting_delay_boundary_transitions_pending_to_active() {
    let e = Env::default();
    set_ledger_sequence(&e, 100);

    let params = GovernanceParams {
        voting_delay: 3,
        voting_period: 10,
        proposal_threshold: 1,
        quorum: 1,
    };
    let fixture = deploy_governance(&e, params, &[VoterSpec::self_delegate(1)]);
    let voter = fixture.primary_voter().clone();

    advance_ledger(&e, 1); // propose at 101
    let proposal_id = fixture.propose_signaling(&voter);
    let snapshot = fixture.governor.proposal_snapshot(&proposal_id);
    assert_eq!(snapshot, 104); // 101 + delay 3
    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Pending
    );

    // Still Pending on the snapshot ledger itself.
    set_ledger_sequence(&e, snapshot);
    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Pending
    );

    let early = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        fixture.governor.cast_vote(
            &proposal_id,
            &VOTE_FOR,
            &String::from_str(&e, "Early"),
            &voter,
        );
    }));
    assert!(early.is_err());
    assert!(!fixture.governor.has_voted(&proposal_id, &voter));
    let empty = e.as_contract(&fixture.governor_id, || {
        get_proposal_vote_counts(&e, &proposal_id)
    });
    assert_eq!(empty.for_votes, 0);

    // First Active ledger is snapshot + 1.
    set_ledger_sequence(&e, snapshot + 1);
    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Active
    );
    let weight = fixture.governor.cast_vote(
        &proposal_id,
        &VOTE_FOR,
        &String::from_str(&e, "Now open"),
        &voter,
    );
    assert_eq!(weight, 1);
    assert!(fixture.governor.has_voted(&proposal_id, &voter));
}

#[test]
fn weighted_votes_credit_for_against_and_abstain_buckets() {
    let e = Env::default();
    set_ledger_sequence(&e, 100);

    let fixture = deploy_governance(
        &e,
        GovernanceParams {
            voting_delay: 1,
            voting_period: 20,
            proposal_threshold: 1,
            quorum: 1,
        },
        &[
            VoterSpec::self_delegate(1),
            VoterSpec::self_delegate(2),
            VoterSpec::self_delegate(4),
        ],
    );
    let for_voter = fixture.voters[0].clone();
    let against_voter = fixture.voters[1].clone();
    let abstain_voter = fixture.voters[2].clone();

    assert_eq!(fixture.votes.get_votes(&for_voter), 1);
    assert_eq!(fixture.votes.get_votes(&against_voter), 2);
    assert_eq!(fixture.votes.get_votes(&abstain_voter), 4);

    advance_ledger(&e, 1);
    let proposal_id = fixture.propose_signaling(&for_voter);
    advance_past_voting_delay(&e, &fixture.params);

    let for_reason = String::from_str(&e, "For");
    let against_reason = String::from_str(&e, "Against");
    let abstain_reason = String::from_str(&e, "Abstain");

    assert_eq!(
        fixture
            .governor
            .cast_vote(&proposal_id, &VOTE_FOR, &for_reason, &for_voter),
        1
    );
    assert_eq!(
        e.events().all(),
        std::vec![VoteCast {
            voter: for_voter.clone(),
            proposal_id: proposal_id.clone(),
            vote_type: VOTE_FOR,
            weight: 1,
            reason: for_reason,
        }
        .to_xdr(&e, &fixture.governor_id)],
    );

    assert_eq!(
        fixture
            .governor
            .cast_vote(&proposal_id, &VOTE_AGAINST, &against_reason, &against_voter),
        2
    );
    assert_eq!(
        e.events().all(),
        std::vec![VoteCast {
            voter: against_voter.clone(),
            proposal_id: proposal_id.clone(),
            vote_type: VOTE_AGAINST,
            weight: 2,
            reason: against_reason,
        }
        .to_xdr(&e, &fixture.governor_id)],
    );

    assert_eq!(
        fixture
            .governor
            .cast_vote(&proposal_id, &VOTE_ABSTAIN, &abstain_reason, &abstain_voter),
        4
    );
    assert_eq!(
        e.events().all(),
        std::vec![VoteCast {
            voter: abstain_voter.clone(),
            proposal_id: proposal_id.clone(),
            vote_type: VOTE_ABSTAIN,
            weight: 4,
            reason: abstain_reason,
        }
        .to_xdr(&e, &fixture.governor_id)],
    );

    let counts = e.as_contract(&fixture.governor_id, || {
        get_proposal_vote_counts(&e, &proposal_id)
    });
    assert_eq!(counts.for_votes, 1);
    assert_eq!(counts.against_votes, 2);
    assert_eq!(counts.abstain_votes, 4);

    // Casting does not mutate delegated voting power.
    assert_eq!(fixture.votes.get_votes(&for_voter), 1);
    assert_eq!(fixture.votes.get_votes(&against_voter), 2);
    assert_eq!(fixture.votes.get_votes(&abstain_voter), 4);
}

#[test]
fn quorum_one_below_is_defeated_and_exact_quorum_succeeds() {
    let e = Env::default();
    set_ledger_sequence(&e, 100);
    let quorum = 4u128;
    let fixture = deploy_governance(
        &e,
        GovernanceParams {
            voting_delay: 1,
            voting_period: 10,
            proposal_threshold: 1,
            quorum,
        },
        &[
            VoterSpec::self_delegate(2),
            VoterSpec::self_delegate(1),
            VoterSpec::self_delegate(1),
            VoterSpec::self_delegate(1),
        ],
    );
    let for_voter = fixture.voters[0].clone();
    let against_voter = fixture.voters[1].clone();
    let first_abstain_voter = fixture.voters[2].clone();
    let boundary_abstain_voter = fixture.voters[3].clone();

    advance_ledger(&e, 1);
    let below_id = fixture.propose_signaling(&for_voter);
    let below_snapshot = fixture.governor.proposal_snapshot(&below_id);
    assert_eq!(fixture.governor.quorum(&below_snapshot), quorum);
    set_ledger_sequence(&e, below_snapshot + 1);
    fixture.governor.cast_vote(
        &below_id,
        &VOTE_FOR,
        &String::from_str(&e, "Two for"),
        &for_voter,
    );
    fixture.governor.cast_vote(
        &below_id,
        &VOTE_AGAINST,
        &String::from_str(&e, "Against does not count toward quorum"),
        &against_voter,
    );
    fixture.governor.cast_vote(
        &below_id,
        &VOTE_ABSTAIN,
        &String::from_str(&e, "One abstention"),
        &first_abstain_voter,
    );
    let below_counts = e.as_contract(&fixture.governor_id, || {
        get_proposal_vote_counts(&e, &below_id)
    });
    assert_eq!(below_counts.for_votes, 2);
    assert_eq!(below_counts.against_votes, 1);
    assert_eq!(below_counts.abstain_votes, 1);
    assert_eq!(
        below_counts.for_votes + below_counts.abstain_votes,
        quorum - 1
    );
    set_ledger_sequence(&e, fixture.governor.proposal_deadline(&below_id) + 1);
    assert_eq!(
        fixture.governor.proposal_state(&below_id),
        ProposalState::Defeated
    );

    let exact_id = fixture.propose_signaling(&for_voter);
    let exact_snapshot = fixture.governor.proposal_snapshot(&exact_id);
    assert_eq!(fixture.governor.quorum(&exact_snapshot), quorum);
    set_ledger_sequence(&e, exact_snapshot + 1);
    fixture.governor.cast_vote(
        &exact_id,
        &VOTE_FOR,
        &String::from_str(&e, "Two for"),
        &for_voter,
    );
    fixture.governor.cast_vote(
        &exact_id,
        &VOTE_AGAINST,
        &String::from_str(&e, "One against"),
        &against_voter,
    );
    fixture.governor.cast_vote(
        &exact_id,
        &VOTE_ABSTAIN,
        &String::from_str(&e, "First abstention"),
        &first_abstain_voter,
    );
    fixture.governor.cast_vote(
        &exact_id,
        &VOTE_ABSTAIN,
        &String::from_str(&e, "Boundary abstention"),
        &boundary_abstain_voter,
    );
    let exact_counts = e.as_contract(&fixture.governor_id, || {
        get_proposal_vote_counts(&e, &exact_id)
    });
    assert_eq!(exact_counts.for_votes, 2);
    assert_eq!(exact_counts.against_votes, 1);
    assert_eq!(exact_counts.abstain_votes, 2);
    assert_eq!(exact_counts.for_votes + exact_counts.abstain_votes, quorum);
    assert!(exact_counts.for_votes > exact_counts.against_votes);
    set_ledger_sequence(&e, fixture.governor.proposal_deadline(&exact_id) + 1);
    assert_eq!(
        fixture.governor.proposal_state(&exact_id),
        ProposalState::Succeeded
    );
}

#[test]
fn proposer_can_cancel_with_exact_authorization() {
    let e = Env::default();
    set_ledger_sequence(&e, 100);
    let fixture = setup_governance(&e);
    let proposer = fixture.primary_voter().clone();
    advance_ledger(&e, 1);
    let proposal = signaling_proposal(&e);
    let proposal_id = fixture.governor.propose(
        &proposal.targets,
        &proposal.functions,
        &proposal.args,
        &proposal.description,
        &proposer,
    );
    let description_hash = e
        .crypto()
        .keccak256(&proposal.description.to_bytes())
        .to_bytes();

    e.mock_auths(&[MockAuth {
        address: &proposer,
        invoke: &MockAuthInvoke {
            contract: &fixture.governor_id,
            fn_name: "cancel",
            args: (
                &proposal.targets,
                &proposal.functions,
                &proposal.args,
                &description_hash,
                &proposer,
            )
                .into_val(&e),
            sub_invokes: &[],
        },
    }]);
    let cancelled_id = fixture.governor.cancel(
        &proposal.targets,
        &proposal.functions,
        &proposal.args,
        &description_hash,
        &proposer,
    );

    assert_eq!(cancelled_id, proposal_id);
    assert_eq!(
        e.events().all(),
        std::vec![ProposalCancelled {
            proposal_id: proposal_id.clone(),
        }
        .to_xdr(&e, &fixture.governor_id)]
    );
    assert_eq!(
        e.auths(),
        [(
            proposer.clone(),
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    fixture.governor_id.clone(),
                    Symbol::new(&e, "cancel"),
                    (
                        &proposal.targets,
                        &proposal.functions,
                        &proposal.args,
                        &description_hash,
                        &proposer,
                    )
                        .into_val(&e),
                )),
                sub_invocations: [].into(),
            },
        )]
    );
    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Canceled
    );
}

#[test]
fn non_proposer_cannot_cancel_and_emits_no_cancellation_event() {
    let e = Env::default();
    set_ledger_sequence(&e, 100);
    let fixture = setup_governance(&e);
    let proposer = fixture.primary_voter().clone();
    let non_proposer = Address::generate(&e);
    advance_ledger(&e, 1);
    let proposal = signaling_proposal(&e);
    let proposal_id = fixture.governor.propose(
        &proposal.targets,
        &proposal.functions,
        &proposal.args,
        &proposal.description,
        &proposer,
    );
    let description_hash = e
        .crypto()
        .keccak256(&proposal.description.to_bytes())
        .to_bytes();

    e.mock_auths(&[MockAuth {
        address: &non_proposer,
        invoke: &MockAuthInvoke {
            contract: &fixture.governor_id,
            fn_name: "cancel",
            args: (
                &proposal.targets,
                &proposal.functions,
                &proposal.args,
                &description_hash,
                &non_proposer,
            )
                .into_val(&e),
            sub_invokes: &[],
        },
    }]);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        fixture.governor.cancel(
            &proposal.targets,
            &proposal.functions,
            &proposal.args,
            &description_hash,
            &non_proposer,
        );
    }));

    assert!(result.is_err());
    assert_eq!(e.events().all(), std::vec![]);
    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Pending
    );
}

#[test]
fn proposer_cannot_cancel_without_authorization() {
    let e = Env::default();
    set_ledger_sequence(&e, 100);
    let fixture = setup_governance(&e);
    let proposer = fixture.primary_voter().clone();
    advance_ledger(&e, 1);
    let proposal = signaling_proposal(&e);
    let proposal_id = fixture.governor.propose(
        &proposal.targets,
        &proposal.functions,
        &proposal.args,
        &proposal.description,
        &proposer,
    );
    let description_hash = e
        .crypto()
        .keccak256(&proposal.description.to_bytes())
        .to_bytes();

    e.mock_auths(&[]);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        fixture.governor.cancel(
            &proposal.targets,
            &proposal.functions,
            &proposal.args,
            &description_hash,
            &proposer,
        );
    }));

    assert!(result.is_err());
    assert_eq!(e.events().all(), std::vec![]);
    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Pending
    );
}

#[test]
fn duplicate_vote_is_rejected_without_tally_or_event_mutation() {
    let e = Env::default();
    set_ledger_sequence(&e, 100);
    let fixture = deploy_governance(
        &e,
        GovernanceParams {
            voting_delay: 1,
            voting_period: 10,
            proposal_threshold: 1,
            quorum: 1,
        },
        &[VoterSpec::self_delegate(3)],
    );
    let voter = fixture.primary_voter().clone();
    advance_ledger(&e, 1);
    let proposal_id = fixture.propose_signaling(&voter);
    advance_past_voting_delay(&e, &fixture.params);
    let first_reason = String::from_str(&e, "Initial support");

    assert_eq!(
        fixture
            .governor
            .cast_vote(&proposal_id, &VOTE_FOR, &first_reason, &voter),
        3
    );
    assert_eq!(
        e.events().all(),
        std::vec![VoteCast {
            voter: voter.clone(),
            proposal_id: proposal_id.clone(),
            vote_type: VOTE_FOR,
            weight: 3,
            reason: first_reason,
        }
        .to_xdr(&e, &fixture.governor_id)]
    );
    assert!(fixture.governor.has_voted(&proposal_id, &voter));
    let before = e.as_contract(&fixture.governor_id, || {
        get_proposal_vote_counts(&e, &proposal_id)
    });

    let duplicate = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        fixture.governor.cast_vote(
            &proposal_id,
            &VOTE_AGAINST,
            &String::from_str(&e, "Attempt to replace the vote"),
            &voter,
        );
    }));
    assert!(duplicate.is_err());
    assert_eq!(e.events().all(), std::vec![]);

    let after = e.as_contract(&fixture.governor_id, || {
        get_proposal_vote_counts(&e, &proposal_id)
    });
    assert_eq!(after.for_votes, before.for_votes);
    assert_eq!(after.against_votes, before.against_votes);
    assert_eq!(after.abstain_votes, before.abstain_votes);
    assert!(fixture.governor.has_voted(&proposal_id, &voter));
    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Active
    );
}

#[test]
fn proposal_snapshot_ignores_later_mint_transfer_and_redelegation() {
    let e = Env::default();
    set_ledger_sequence(&e, 100);
    let fixture = deploy_governance(
        &e,
        GovernanceParams {
            voting_delay: 1,
            voting_period: 20,
            proposal_threshold: 1,
            quorum: 1,
        },
        &[
            VoterSpec::self_delegate(1),
            VoterSpec::self_delegate(1),
            VoterSpec::self_delegate(1),
        ],
    );
    let mint_voter = fixture.voters[0].clone();
    let transfer_voter = fixture.voters[1].clone();
    let redelegating_voter = fixture.voters[2].clone();
    let transfer_recipient = Address::generate(&e);
    let new_delegate = Address::generate(&e);

    advance_ledger(&e, 1);
    let proposal_id = fixture.propose_signaling(&mint_voter);
    let snapshot = fixture.governor.proposal_snapshot(&proposal_id);
    set_ledger_sequence(&e, snapshot + 1);

    fixture.nft.mint(
        &mint_voter,
        &String::from_str(&e, "ipfs://members/post-snapshot.json"),
    );
    fixture
        .votes
        .delegate(&transfer_recipient, &transfer_recipient);
    fixture
        .nft
        .transfer(&transfer_voter, &transfer_recipient, &1);
    fixture.votes.delegate(&redelegating_voter, &new_delegate);

    assert_eq!(fixture.votes.get_votes(&mint_voter), 2);
    assert_eq!(fixture.votes.get_votes(&transfer_voter), 0);
    assert_eq!(fixture.votes.get_votes(&transfer_recipient), 1);
    assert_eq!(fixture.votes.get_votes(&redelegating_voter), 0);
    assert_eq!(fixture.votes.get_votes(&new_delegate), 1);
    assert_eq!(
        fixture
            .votes
            .get_votes_at_checkpoint(&mint_voter, &snapshot),
        1
    );
    assert_eq!(
        fixture
            .votes
            .get_votes_at_checkpoint(&transfer_voter, &snapshot),
        1
    );
    assert_eq!(
        fixture
            .votes
            .get_votes_at_checkpoint(&redelegating_voter, &snapshot),
        1
    );

    for voter in [&mint_voter, &transfer_voter, &redelegating_voter] {
        let reason = String::from_str(&e, "Snapshot weight");
        assert_eq!(
            fixture
                .governor
                .cast_vote(&proposal_id, &VOTE_FOR, &reason, voter),
            1
        );
        assert_eq!(
            e.events().all(),
            std::vec![VoteCast {
                voter: voter.clone(),
                proposal_id: proposal_id.clone(),
                vote_type: VOTE_FOR,
                weight: 1,
                reason,
            }
            .to_xdr(&e, &fixture.governor_id)]
        );
    }
    let original_counts = e.as_contract(&fixture.governor_id, || {
        get_proposal_vote_counts(&e, &proposal_id)
    });
    assert_eq!(original_counts.for_votes, 3);

    set_ledger_sequence(&e, fixture.governor.proposal_deadline(&proposal_id) + 1);
    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Succeeded
    );

    let later_id = fixture.propose_signaling(&mint_voter);
    let later_snapshot = fixture.governor.proposal_snapshot(&later_id);
    set_ledger_sequence(&e, later_snapshot + 1);
    assert_eq!(
        fixture.governor.cast_vote(
            &later_id,
            &VOTE_FOR,
            &String::from_str(&e, "Updated mint power"),
            &mint_voter,
        ),
        2
    );
    assert_eq!(
        fixture.governor.cast_vote(
            &later_id,
            &VOTE_FOR,
            &String::from_str(&e, "Updated transfer power"),
            &transfer_recipient,
        ),
        1
    );
    assert_eq!(
        fixture.governor.cast_vote(
            &later_id,
            &VOTE_FOR,
            &String::from_str(&e, "Updated delegation power"),
            &new_delegate,
        ),
        1
    );
    let later_counts = e.as_contract(&fixture.governor_id, || {
        get_proposal_vote_counts(&e, &later_id)
    });
    assert_eq!(later_counts.for_votes, 4);
}

#[test]
fn succeeded_proposal_executes_target_once_with_exact_authorization() {
    let e = Env::default();
    set_ledger_sequence(&e, 100);
    let fixture = setup_governance(&e);
    let proposer = fixture.primary_voter().clone();
    let executor = Address::generate(&e);
    let proposal = executable_proposal(&e, 42);
    let target = GovernorExecutionTargetClient::new(&e, &proposal.target_id);
    assert_eq!(target.value(), 0);
    assert_eq!(target.calls(), 0);

    advance_ledger(&e, 1);
    let proposal_id = pass_executable_proposal(&fixture, &proposal, &proposer);
    mock_execute_auth(&e, &fixture.governor_id, &proposal, &executor);
    let executed_id = fixture.governor.execute(
        &proposal.targets,
        &proposal.functions,
        &proposal.args,
        &proposal.description_hash,
        &executor,
    );

    assert_eq!(executed_id, proposal_id);
    assert_eq!(
        e.events().all(),
        std::vec![ProposalExecuted {
            proposal_id: proposal_id.clone(),
        }
        .to_xdr(&e, &fixture.governor_id)]
    );
    assert_eq!(
        e.auths(),
        [(
            executor.clone(),
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    fixture.governor_id.clone(),
                    Symbol::new(&e, "execute"),
                    (
                        &proposal.targets,
                        &proposal.functions,
                        &proposal.args,
                        &proposal.description_hash,
                        &executor,
                    )
                        .into_val(&e),
                )),
                sub_invocations: [].into(),
            },
        )]
    );
    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Executed
    );
    assert_eq!(target.value(), 42);
    assert_eq!(target.calls(), 1);
}

#[test]
fn proposal_cannot_execute_before_it_succeeds() {
    let e = Env::default();
    set_ledger_sequence(&e, 100);
    let fixture = setup_governance(&e);
    let proposer = fixture.primary_voter().clone();
    let executor = Address::generate(&e);
    let proposal = executable_proposal(&e, 17);
    let target = GovernorExecutionTargetClient::new(&e, &proposal.target_id);

    advance_ledger(&e, 1);
    let proposal_id = fixture.governor.propose(
        &proposal.targets,
        &proposal.functions,
        &proposal.args,
        &proposal.description,
        &proposer,
    );
    mock_execute_auth(&e, &fixture.governor_id, &proposal, &executor);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        fixture.governor.execute(
            &proposal.targets,
            &proposal.functions,
            &proposal.args,
            &proposal.description_hash,
            &executor,
        );
    }));

    assert!(result.is_err());
    assert_eq!(e.events().all(), std::vec![]);
    assert_eq!(target.value(), 0);
    assert_eq!(target.calls(), 0);
    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Pending
    );
}

#[test]
fn mismatched_action_data_cannot_execute_succeeded_proposal() {
    let e = Env::default();
    set_ledger_sequence(&e, 100);
    let fixture = setup_governance(&e);
    let proposer = fixture.primary_voter().clone();
    let executor = Address::generate(&e);
    let proposal = executable_proposal(&e, 23);
    let target = GovernorExecutionTargetClient::new(&e, &proposal.target_id);

    advance_ledger(&e, 1);
    let proposal_id = pass_executable_proposal(&fixture, &proposal, &proposer);
    let mismatched_args = vec![&e, vec![&e, 999u32.into_val(&e)]];
    e.mock_auths(&[MockAuth {
        address: &executor,
        invoke: &MockAuthInvoke {
            contract: &fixture.governor_id,
            fn_name: "execute",
            args: (
                &proposal.targets,
                &proposal.functions,
                &mismatched_args,
                &proposal.description_hash,
                &executor,
            )
                .into_val(&e),
            sub_invokes: &[],
        },
    }]);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        fixture.governor.execute(
            &proposal.targets,
            &proposal.functions,
            &mismatched_args,
            &proposal.description_hash,
            &executor,
        );
    }));

    assert!(result.is_err());
    assert_eq!(e.events().all(), std::vec![]);
    assert_eq!(target.value(), 0);
    assert_eq!(target.calls(), 0);
    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Succeeded
    );
}

#[test]
fn executed_proposal_cannot_execute_twice() {
    let e = Env::default();
    set_ledger_sequence(&e, 100);
    let fixture = setup_governance(&e);
    let proposer = fixture.primary_voter().clone();
    let executor = Address::generate(&e);
    let proposal = executable_proposal(&e, 31);
    let target = GovernorExecutionTargetClient::new(&e, &proposal.target_id);

    advance_ledger(&e, 1);
    let proposal_id = pass_executable_proposal(&fixture, &proposal, &proposer);
    mock_execute_auth(&e, &fixture.governor_id, &proposal, &executor);
    assert_eq!(
        fixture.governor.execute(
            &proposal.targets,
            &proposal.functions,
            &proposal.args,
            &proposal.description_hash,
            &executor,
        ),
        proposal_id
    );
    assert_eq!(target.value(), 31);
    assert_eq!(target.calls(), 1);

    mock_execute_auth(&e, &fixture.governor_id, &proposal, &executor);
    let second = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        fixture.governor.execute(
            &proposal.targets,
            &proposal.functions,
            &proposal.args,
            &proposal.description_hash,
            &executor,
        );
    }));

    assert!(second.is_err());
    assert_eq!(e.events().all(), std::vec![]);
    assert_eq!(target.value(), 31);
    assert_eq!(target.calls(), 1);
    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Executed
    );
}

#[test]
fn governor_storage_survives_advancement_and_instance_ttl_renews_at_boundary() {
    let e = Env::default();
    set_ledger_sequence(&e, 100);
    e.ledger()
        .with_mut(|ledger| ledger.timestamp = 1_800_000_000);
    let fixture = setup_governance(&e);
    let voter = fixture.primary_voter().clone();

    advance_ledger(&e, 1);
    let proposal_id = fixture.propose_signaling(&voter);
    let snapshot = fixture.governor.proposal_snapshot(&proposal_id);
    set_ledger_sequence(&e, snapshot + 1);
    fixture.governor.cast_vote(
        &proposal_id,
        &VOTE_FOR,
        &String::from_str(&e, "Durability regression"),
        &voter,
    );

    let instance_ttl = e.as_contract(&fixture.governor_id, || e.storage().instance().get_ttl());
    assert!(instance_ttl > STORAGE_TTL_THRESHOLD);

    let advance_by = instance_ttl - STORAGE_TTL_THRESHOLD;
    e.ledger().with_mut(|ledger| {
        ledger.sequence_number += advance_by;
        ledger.timestamp += u64::from(advance_by) * 5;
    });
    e.as_contract(&fixture.governor_id, || {
        assert_eq!(e.storage().instance().get_ttl(), STORAGE_TTL_THRESHOLD);
    });

    // Configuration (instance storage), proposal core, vote tally, and the
    // per-voter receipt (persistent storage) all remain readable.
    assert_eq!(
        fixture.governor.name(),
        String::from_str(&e, "StollaGovernor")
    );
    assert_eq!(fixture.governor.version(), String::from_str(&e, "1.0.0"));
    assert_eq!(fixture.governor.get_token_contract(), fixture.nft_id);
    assert_eq!(fixture.governor.voting_delay(), fixture.params.voting_delay);
    assert_eq!(
        fixture.governor.voting_period(),
        fixture.params.voting_period
    );
    assert_eq!(
        fixture.governor.proposal_threshold(),
        fixture.params.proposal_threshold
    );
    assert_eq!(fixture.governor.proposal_snapshot(&proposal_id), snapshot);
    assert!(fixture.governor.has_voted(&proposal_id, &voter));
    let counts = e.as_contract(&fixture.governor_id, || {
        get_proposal_vote_counts(&e, &proposal_id)
    });
    assert_eq!(counts.for_votes, 1);
    assert_eq!(counts.against_votes, 0);
    assert_eq!(counts.abstain_votes, 0);

    CommunityGovernorClient::new(&e, &fixture.governor_id).extend_instance_ttl();
    e.as_contract(&fixture.governor_id, || {
        assert_eq!(e.storage().instance().get_ttl(), STORAGE_EXTEND_AMOUNT);
    });
}

#[test]
fn timelock_mode_requires_queueing_and_enforces_delay_before_execution() {
    let e = Env::default();
    set_ledger_sequence(&e, 100);
    let fixture = setup_governance(&e);
    let governor_admin = CommunityGovernorClient::new(&e, &fixture.governor_id);
    let timelock = Address::generate(&e);
    let proposer = fixture.primary_voter().clone();
    let operator = Address::generate(&e);
    let executor = Address::generate(&e);
    let proposal = executable_proposal(&e, 77);
    let target = GovernorExecutionTargetClient::new(&e, &proposal.target_id);

    assert!(governor_admin.is_signaling_only());
    assert!(!fixture.governor.proposals_need_queuing());

    e.mock_all_auths();
    governor_admin.set_timelock(&timelock);
    assert!(!governor_admin.is_signaling_only());
    assert!(fixture.governor.proposals_need_queuing());
    assert_eq!(governor_admin.timelock(), Some(timelock));
    assert_eq!(
        governor_admin.timelock_min_delay(),
        DEFAULT_TIMELOCK_DELAY_LEDGERS
    );

    advance_ledger(&e, 1);
    let proposal_id = pass_executable_proposal(&fixture, &proposal, &proposer);
    assert!(governor_admin.verify_approved_action(
        &proposal.targets,
        &proposal.functions,
        &proposal.args,
        &proposal.description_hash,
    ));

    // Unqueued execution must fail even though the proposal is Succeeded.
    let unqueued = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        fixture.governor.execute(
            &proposal.targets,
            &proposal.functions,
            &proposal.args,
            &proposal.description_hash,
            &executor,
        );
    }));
    assert!(unqueued.is_err());
    assert_eq!(target.calls(), 0);
    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Succeeded
    );

    // Queueing with an ETA earlier than the minimum timelock delay is rejected.
    let queued_at = e.ledger().sequence();
    let eta = queued_at + DEFAULT_TIMELOCK_DELAY_LEDGERS;
    let early_queue = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        fixture.governor.queue(
            &proposal.targets,
            &proposal.functions,
            &proposal.args,
            &proposal.description_hash,
            &(eta - 1),
            &operator,
        );
    }));
    assert!(early_queue.is_err());

    let queued_id = fixture.governor.queue(
        &proposal.targets,
        &proposal.functions,
        &proposal.args,
        &proposal.description_hash,
        &eta,
        &operator,
    );
    assert_eq!(queued_id, proposal_id);
    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Queued
    );

    let record = governor_admin
        .get_queued_action(&proposal_id)
        .expect("queued action record stored");
    assert_eq!(record.proposal_id, proposal_id);
    assert_eq!(record.queued_at, queued_at);
    assert_eq!(record.eta, eta);
    assert_eq!(
        record.batch_hash,
        governor_admin.batch_hash(&proposal.targets, &proposal.functions, &proposal.args)
    );
    assert!(governor_admin.verify_approved_action(
        &proposal.targets,
        &proposal.functions,
        &proposal.args,
        &proposal.description_hash,
    ));

    // Execution at eta - 1 must fail.
    set_ledger_sequence(&e, eta - 1);
    let early_exec = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        fixture.governor.execute(
            &proposal.targets,
            &proposal.functions,
            &proposal.args,
            &proposal.description_hash,
            &executor,
        );
    }));
    assert!(early_exec.is_err());
    assert_eq!(target.calls(), 0);

    // Execution at eta succeeds once.
    set_ledger_sequence(&e, eta);
    let executed_id = fixture.governor.execute(
        &proposal.targets,
        &proposal.functions,
        &proposal.args,
        &proposal.description_hash,
        &executor,
    );
    assert_eq!(executed_id, proposal_id);
    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Executed
    );
    assert_eq!(target.value(), 77);
    assert_eq!(target.calls(), 1);
}

#[test]
fn signaling_only_governor_rejects_privileged_targets_until_timelock_enabled() {
    let e = Env::default();
    set_ledger_sequence(&e, 100);
    let fixture = setup_governance(&e);
    let governor_admin = CommunityGovernorClient::new(&e, &fixture.governor_id);
    let proposer = fixture.primary_voter().clone();
    let executor = Address::generate(&e);
    let proposal = executable_proposal(&e, 91);
    let target = GovernorExecutionTargetClient::new(&e, &proposal.target_id);

    e.mock_all_auths();
    governor_admin.set_privileged_target(&proposal.target_id, &true);

    advance_ledger(&e, 1);
    let proposal_id = pass_executable_proposal(&fixture, &proposal, &proposer);
    let blocked = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        fixture.governor.execute(
            &proposal.targets,
            &proposal.functions,
            &proposal.args,
            &proposal.description_hash,
            &executor,
        );
    }));
    assert!(blocked.is_err());
    assert_eq!(target.calls(), 0);
    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Succeeded
    );
}
