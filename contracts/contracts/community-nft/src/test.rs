#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env, String};
use stellar_governance::votes::VotesClient;

use crate::{CommunityNft, CommunityNftClient};

fn setup(e: &Env) -> (Address, Address, CommunityNftClient<'_>) {
    let owner = Address::generate(e);
    let member = Address::generate(e);
    let contract_id = e.register(
        CommunityNft,
        (
            String::from_str(e, "ipfs://collection/"),
            String::from_str(e, "Stolla Community"),
            String::from_str(e, "STOLLA"),
            owner.clone(),
        ),
    );
    (owner, member, CommunityNftClient::new(e, &contract_id))
}

#[test]
fn mint_stores_token_uri_and_grants_voting_power_after_delegate() {
    let e = Env::default();
    e.mock_all_auths();

    let (owner, member, client) = setup(&e);
    let uri = String::from_str(&e, "ipfs://QmExample/metadata.json");

    let token_id = client.mint(&member, &uri);
    assert_eq!(token_id, 0);
    assert_eq!(client.custom_token_uri(&token_id), uri);
    assert_eq!(client.balance(&member), 1);

    let votes = VotesClient::new(&e, &client.address);
    assert_eq!(votes.get_votes(&member), 0);

    votes.delegate(&member, &member);
    assert_eq!(votes.get_votes(&member), 1);
}

#[test]
#[should_panic(expected = "Unauthorized")]
fn non_owner_cannot_mint() {
    let e = Env::default();

    let (owner, member, client) = setup(&e);
    let uri = String::from_str(&e, "ipfs://QmExample/metadata.json");

    client.mint(&member, &uri);
    let _ = owner;
}
