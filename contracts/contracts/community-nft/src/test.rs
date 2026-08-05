#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, AuthorizedFunction, AuthorizedInvocation, MockAuth, MockAuthInvoke},
    Address, Env, IntoVal, String, Symbol,
};
extern crate std;
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

fn mint_with_owner_auth(
    e: &Env,
    client: &CommunityNftClient<'_>,
    owner: &Address,
    recipient: &Address,
    uri: &String,
) -> u32 {
    e.mock_auths(&[MockAuth {
        address: owner,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "mint",
            args: (recipient, uri).into_val(e),
            sub_invokes: &[],
        },
    }]);
    client.mint(recipient, uri)
}

fn delegate_with_auth(
    e: &Env,
    client: &CommunityNftClient<'_>,
    account: &Address,
    delegatee: &Address,
) {
    e.mock_auths(&[MockAuth {
        address: account,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "delegate",
            args: (account, delegatee).into_val(e),
            sub_invokes: &[],
        },
    }]);
    VotesClient::new(e, &client.address).delegate(account, delegatee);
}

fn transfer_with_auth(
    e: &Env,
    client: &CommunityNftClient<'_>,
    from: &Address,
    to: &Address,
    token_id: u32,
) {
    e.mock_auths(&[MockAuth {
        address: from,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "transfer",
            args: (from, to, token_id).into_val(e),
            sub_invokes: &[],
        },
    }]);
    client.transfer(from, to, &token_id);
}

#[test]
fn mint_stores_token_uri_and_grants_voting_power_after_delegate() {
    let e = Env::default();
    let (owner, member, client) = setup(&e);
    let uri = String::from_str(&e, "ipfs://QmExample/metadata.json");

    let token_id = mint_with_owner_auth(&e, &client, &owner, &member, &uri);
    assert_eq!(
        e.auths(),
        [(
            owner.clone(),
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    client.address.clone(),
                    Symbol::new(&e, "mint"),
                    (&member, &uri).into_val(&e),
                )),
                sub_invocations: [].into(),
            },
        )]
    );
    assert_eq!(token_id, 0);
    assert_eq!(client.custom_token_uri(&token_id), uri);
    assert_eq!(client.balance(&member), 1);

    let votes = VotesClient::new(&e, &client.address);
    assert_eq!(votes.get_votes(&member), 0);

    delegate_with_auth(&e, &client, &member, &member);
    assert_eq!(votes.get_votes(&member), 1);
}

#[test]
fn non_owner_authorization_cannot_mint() {
    let e = Env::default();

    let (owner, member, client) = setup(&e);
    let uri = String::from_str(&e, "ipfs://QmExample/metadata.json");

    e.mock_auths(&[MockAuth {
        address: &member,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "mint",
            args: (&member, &uri).into_val(&e),
            sub_invokes: &[],
        },
    }]);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.mint(&member, &uri);
    }));

    assert!(result.is_err());
    assert_eq!(client.balance(&member), 0);

    // A rejected mint must not consume the first sequential token ID.
    assert_eq!(mint_with_owner_auth(&e, &client, &owner, &member, &uri), 0);
}

#[test]
fn multiple_mints_use_sequential_ids_and_preserve_owners_and_uris() {
    let e = Env::default();
    let (owner, first_recipient, client) = setup(&e);
    let second_recipient = Address::generate(&e);
    let first_uri = String::from_str(&e, "ipfs://members/first.json");
    let second_uri = String::from_str(&e, "ipfs://members/second.json");
    let third_uri = String::from_str(&e, "ipfs://members/third.json");

    let first_id = mint_with_owner_auth(&e, &client, &owner, &first_recipient, &first_uri);
    let second_id = mint_with_owner_auth(&e, &client, &owner, &second_recipient, &second_uri);
    let third_id = mint_with_owner_auth(&e, &client, &owner, &first_recipient, &third_uri);

    assert_eq!((first_id, second_id, third_id), (0, 1, 2));
    assert_eq!(client.owner_of(&first_id), first_recipient.clone());
    assert_eq!(client.owner_of(&second_id), second_recipient.clone());
    assert_eq!(client.owner_of(&third_id), first_recipient.clone());
    assert_eq!(client.balance(&first_recipient), 2);
    assert_eq!(client.balance(&second_recipient), 1);
    assert_eq!(client.custom_token_uri(&first_id), first_uri);
    assert_eq!(client.custom_token_uri(&second_id), second_uri);
    assert_eq!(client.custom_token_uri(&third_id), third_uri);
}

#[test]
fn transfers_and_redelegation_move_voting_power_without_changing_supply() {
    let e = Env::default();
    let (owner, alice, client) = setup(&e);
    let bob = Address::generate(&e);
    let undelegated_recipient = Address::generate(&e);
    let alice_delegate = Address::generate(&e);
    let bob_delegate = Address::generate(&e);
    let final_delegate = Address::generate(&e);
    let uri = String::from_str(&e, "ipfs://members/vote-unit.json");

    let alice_first = mint_with_owner_auth(&e, &client, &owner, &alice, &uri);
    let alice_second = mint_with_owner_auth(&e, &client, &owner, &alice, &uri);
    let bob_token = mint_with_owner_auth(&e, &client, &owner, &bob, &uri);
    assert_eq!((alice_first, alice_second, bob_token), (0, 1, 2));

    delegate_with_auth(&e, &client, &alice, &alice_delegate);
    delegate_with_auth(&e, &client, &bob, &bob_delegate);
    let votes = VotesClient::new(&e, &client.address);
    assert_eq!(votes.get_votes(&alice_delegate), 2);
    assert_eq!(votes.get_votes(&bob_delegate), 1);
    assert_eq!(votes.get_total_supply(), 3);

    transfer_with_auth(&e, &client, &alice, &bob, alice_first);
    assert_eq!(client.balance(&alice), 1);
    assert_eq!(client.balance(&bob), 2);
    assert_eq!(votes.get_votes(&alice_delegate), 1);
    assert_eq!(votes.get_votes(&bob_delegate), 2);
    assert_eq!(
        votes.get_votes(&alice_delegate) + votes.get_votes(&bob_delegate),
        3
    );
    assert_eq!(votes.get_total_supply(), 3);

    transfer_with_auth(&e, &client, &alice, &undelegated_recipient, alice_second);
    assert_eq!(votes.get_votes(&alice_delegate), 0);
    assert_eq!(votes.get_votes(&bob_delegate), 2);
    assert_eq!(votes.get_votes(&undelegated_recipient), 0);
    assert_eq!(votes.get_total_supply(), 3);

    delegate_with_auth(&e, &client, &undelegated_recipient, &final_delegate);
    assert_eq!(votes.get_votes(&final_delegate), 1);
    assert_eq!(
        votes.get_votes(&bob_delegate) + votes.get_votes(&final_delegate),
        3
    );

    delegate_with_auth(&e, &client, &bob, &final_delegate);
    assert_eq!(votes.get_votes(&bob_delegate), 0);
    assert_eq!(votes.get_votes(&final_delegate), 3);
    assert_eq!(client.balance(&alice), 0);
    assert_eq!(client.balance(&bob), 2);
    assert_eq!(client.balance(&undelegated_recipient), 1);
    assert_eq!(votes.get_total_supply(), 3);
}

#[test]
fn mint_with_empty_uri_panics_and_does_not_consume_token_id() {
    let e = Env::default();
    let (owner, member, client) = setup(&e);
    let empty_uri = String::from_str(&e, "");

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.mint(&member, &empty_uri);
    }));
    assert!(result.is_err());
    assert_eq!(client.balance(&member), 0);

    // Verify that a subsequent valid mint still gets token ID 0
    let valid_uri = String::from_str(&e, "ipfs://valid/metadata.json");
    let valid_id = mint_with_owner_auth(&e, &client, &owner, &member, &valid_uri);
    assert_eq!(valid_id, 0);
    assert_eq!(client.custom_token_uri(&valid_id), valid_uri);
}

#[test]
fn mint_with_whitespace_only_uri_panics_and_preserves_id_counter() {
    let e = Env::default();
    let (owner, member, client) = setup(&e);
    let whitespace_uri = String::from_str(&e, "   \t\n   ");

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.mint(&member, &whitespace_uri);
    }));
    assert!(result.is_err());
    assert_eq!(client.balance(&member), 0);

    let valid_uri = String::from_str(&e, "ipfs://after-whitespace.json");
    let valid_id = mint_with_owner_auth(&e, &client, &owner, &member, &valid_uri);
    assert_eq!(valid_id, 0);
}

#[test]
fn mint_with_whitespace_padded_uri_trims_and_stores_clean_value() {
    let e = Env::default();
    let (owner, member, client) = setup(&e);
    let padded_uri = String::from_str(&e, "  ipfs://QmPadded/metadata.json  ");

    let token_id = mint_with_owner_auth(&e, &client, &owner, &member, &padded_uri);
    let expected_uri = String::from_str(&e, "ipfs://QmPadded/metadata.json");
    assert_eq!(client.custom_token_uri(&token_id), expected_uri);
}

#[test]
fn mint_with_valid_uri_works() {
    let e = Env::default();
    let (owner, member, client) = setup(&e);
    let uri = String::from_str(&e, "ipfs://QmValid/metadata.json");

    let token_id = mint_with_owner_auth(&e, &client, &owner, &member, &uri);
    assert_eq!(token_id, 0);
    assert_eq!(client.custom_token_uri(&token_id), uri);
    assert_eq!(client.balance(&member), 1);
}
