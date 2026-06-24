#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    vec, Address, Env, String, Symbol, Val, Vec,
};
use stellar_governance::{
    governor::{GovernorClient, ProposalState},
    votes::VotesClient,
};

use community_nft::CommunityNft;

use crate::CommunityGovernor;

const VOTING_DELAY: u32 = 1;
const VOTING_PERIOD: u32 = 10_000;
const PROPOSAL_THRESHOLD: u128 = 1;
const QUORUM: u128 = 1;

fn simple_proposal(e: &Env) -> (Vec<Address>, Vec<Symbol>, Vec<Vec<Val>>, String) {
    let target = Address::generate(e);
    let targets = vec![e, target];
    let functions = vec![e, Symbol::new(e, "noop")];
    let args: Vec<Vec<Val>> = vec![e, vec![e]];
    let description = String::from_str(e, "Signal proposal: welcome members");
    (targets, functions, args, description)
}

fn setup_governance(e: &Env) -> (Address, GovernorClient<'_>, VotesClient<'_>) {
    e.mock_all_auths();

    let owner = Address::generate(e);
    let voter = Address::generate(e);

    let nft_id = e.register(
        CommunityNft,
        (
            String::from_str(e, "ipfs://collection/"),
            String::from_str(e, "Stolla Community"),
            String::from_str(e, "STOLLA"),
            owner.clone(),
        ),
    );
    let nft = community_nft::CommunityNftClient::new(e, &nft_id);
    nft.mint(&voter, &String::from_str(e, "ipfs://QmMember/metadata.json"));

    let votes = VotesClient::new(e, &nft_id);
    votes.delegate(&voter, &voter);

    let governor_id = e.register(
        CommunityGovernor,
        (
            nft_id.clone(),
            VOTING_DELAY,
            VOTING_PERIOD,
            PROPOSAL_THRESHOLD,
            QUORUM,
        ),
    );

    (
        voter,
        GovernorClient::new(e, &governor_id),
        votes,
    )
}

#[test]
fn propose_and_cast_vote_succeeds() {
    let e = Env::default();
    e.ledger().with_mut(|li| {
        li.sequence_number = 100;
    });

    let (voter, governor, votes) = setup_governance(&e);
    assert_eq!(votes.get_votes(&voter), 1);

    e.ledger().with_mut(|li| {
        li.sequence_number += 1;
    });

    let (targets, functions, calldata, description) = simple_proposal(&e);
    let proposal_id = governor.propose(&targets, &functions, &calldata, &description, &voter);

    e.ledger().with_mut(|li| {
        li.sequence_number += VOTING_DELAY + 1;
    });

    let reason = String::from_str(&e, "Support");
    governor.cast_vote(&proposal_id, &1, &reason, &voter);

    e.ledger().with_mut(|li| {
        li.sequence_number += VOTING_PERIOD;
    });

    assert_eq!(
        governor.proposal_state(&proposal_id),
        ProposalState::Succeeded
    );
}
