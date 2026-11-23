#![cfg(test)]

use soroban_sdk::{
    testutils::{
        storage::{Instance as _, Persistent as _},
        Address as _, AuthorizedFunction, AuthorizedInvocation, Ledger as _, MockAuth,
        MockAuthInvoke,
    },
    Address, Env, IntoVal, String, Symbol,
};
extern crate std;
use stellar_governance::votes::{VotesClient, VotesStorageKey};
use stellar_tokens::non_fungible::NFTStorageKey;

use crate::{
    CommunityNft, CommunityNftClient, DataKey, STORAGE_EXTEND_AMOUNT, STORAGE_TTL_THRESHOLD,
};

const NFT_WASM: &[u8] = include_bytes!("../../community-factory/test_wasm/community_nft.wasm");

#[test]
fn upgrade_requires_current_owner_and_bootstrap_authority_can_be_revoked() {
    let e = Env::default();
    let (owner, successor, client) = setup(&e);
    let hash = e.deployer().upload_contract_wasm(NFT_WASM);
    assert!(client.bootstrap_authority_remaining());

    e.mock_auths(&[MockAuth {
        address: &successor,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "upgrade",
            args: (&hash,).into_val(&e),
            sub_invokes: &[],
        },
    }]);
    assert!(client.try_upgrade(&hash).is_err());

    e.mock_all_auths();
    client.transfer_ownership(&successor, &100);
    client.accept_ownership();
    assert_eq!(client.get_owner(), Some(successor.clone()));
    assert!(!client.bootstrap_authority_remaining());

    e.mock_auths(&[MockAuth {
        address: &owner,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "upgrade",
            args: (&hash,).into_val(&e),
            sub_invokes: &[],
        },
    }]);
    assert!(client.try_upgrade(&hash).is_err());

    e.mock_auths(&[MockAuth {
        address: &successor,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "upgrade",
            args: (&hash,).into_val(&e),
            sub_invokes: &[],
        },
    }]);
    client.upgrade(&hash);
}

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

fn assert_voting_model(
    e: &Env,
    client: &CommunityNftClient<'_>,
    accounts: &[Address],
    owners: &[usize],
    delegates: &[Option<usize>],
    seed: u64,
    step: usize,
    operations: &[std::string::String],
) {
    let mut expected = std::vec![0u128; accounts.len()];
    let mut represented = 0u128;
    for owner in owners {
        if let Some(delegate) = delegates[*owner] {
            expected[delegate] += 1;
            represented += 1;
        }
    }

    let votes = VotesClient::new(e, &client.address);
    let actual: std::vec::Vec<u128> = accounts
        .iter()
        .map(|account| votes.get_votes(account))
        .collect();
    let actual_total: u128 = actual.iter().sum();
    let context = std::format!("seed={seed:#x}, step={step}, operations={operations:#?}");

    assert_eq!(actual, expected, "{context}");
    assert_eq!(actual_total, represented, "{context}");
    assert_eq!(votes.get_total_supply(), owners.len() as u128, "{context}");
}

fn next_random(state: &mut u64) -> u64 {
    // A fixed LCG keeps every generated operation sequence reproducible in CI.
    *state = state
        .wrapping_mul(6_364_136_223_846_793_005)
        .wrapping_add(1);
    *state
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
fn collection_owner_cannot_transfer_members_token_without_member_auth() {
    let e = Env::default();
    let (owner, member, client) = setup(&e);
    let recipient = Address::generate(&e);
    let uri = String::from_str(&e, "ipfs://members/revoke-check.json");
    let token_id = mint_with_owner_auth(&e, &client, &owner, &member, &uri);
    delegate_with_auth(&e, &client, &member, &member);

    e.mock_auths(&[MockAuth {
        address: &owner,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "transfer",
            args: (&member, &recipient, token_id).into_val(&e),
            sub_invokes: &[],
        },
    }]);
    assert!(client.try_transfer(&member, &recipient, &token_id).is_err());
    assert_eq!(client.owner_of(&token_id), member.clone());
    assert_eq!(client.balance(&member), 1);
    assert_eq!(VotesClient::new(&e, &client.address).get_votes(&member), 1);

    transfer_with_auth(&e, &client, &member, &recipient, token_id);
    assert_eq!(client.owner_of(&token_id), recipient);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn empty_token_uri_returns_stable_contract_error() {
    let e = Env::default();
    let (owner, member, client) = setup(&e);
    mint_with_owner_auth(&e, &client, &owner, &member, &String::from_str(&e, ""));
}

#[test]
fn invalid_token_uri_does_not_change_mint_state() {
    let e = Env::default();
    let (owner, member, client) = setup(&e);
    let empty = String::from_str(&e, "");

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        mint_with_owner_auth(&e, &client, &owner, &member, &empty);
    }));
    assert!(result.is_err());
    assert_eq!(client.balance(&member), 0);
    assert_eq!(VotesClient::new(&e, &client.address).get_total_supply(), 0);
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.owner_of(&0);
    }))
    .is_err());
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.custom_token_uri(&0);
    }))
    .is_err());

    let valid = String::from_str(&e, "ipfs://members/first-valid.json");
    assert_eq!(
        mint_with_owner_auth(&e, &client, &owner, &member, &valid),
        0
    );
    assert_eq!(client.custom_token_uri(&0), valid);
}

#[test]
fn whitespace_token_uri_is_preserved_without_normalization() {
    let e = Env::default();
    let (owner, member, client) = setup(&e);
    let whitespace = String::from_str(&e, " \t ");

    let token_id = mint_with_owner_auth(&e, &client, &owner, &member, &whitespace);

    assert_eq!(client.custom_token_uri(&token_id), whitespace);
}

#[test]
fn custom_token_uris_remain_bound_to_token_ids_across_transfers() {
    let e = Env::default();
    let (owner, alice, client) = setup(&e);
    let bob = Address::generate(&e);
    let carol = Address::generate(&e);
    let first_uri = String::from_str(&e, "ipfs://members/transfer-one.json");
    let second_uri = String::from_str(&e, "ipfs://members/transfer-two.json");
    let first_id = mint_with_owner_auth(&e, &client, &owner, &alice, &first_uri);
    let second_id = mint_with_owner_auth(&e, &client, &owner, &bob, &second_uri);

    assert_eq!(client.custom_token_uri(&first_id), first_uri);
    transfer_with_auth(&e, &client, &alice, &bob, first_id);
    assert_eq!(client.owner_of(&first_id), bob.clone());
    assert_eq!(client.custom_token_uri(&first_id), first_uri);
    assert_eq!(client.custom_token_uri(&second_id), second_uri);

    transfer_with_auth(&e, &client, &bob, &carol, first_id);
    assert_eq!(client.owner_of(&first_id), carol);
    assert_eq!(client.owner_of(&second_id), bob);
    assert_eq!(client.custom_token_uri(&first_id), first_uri);
    assert_eq!(client.custom_token_uri(&second_id), second_uri);
}

#[test]
fn generated_sequences_conserve_delegated_voting_power() {
    const SEEDS: [u64; 4] = [0x5eed, 0xc0ffee, 0xdecafbad, 0x8675_309];

    for seed in SEEDS {
        let e = Env::default();
        e.mock_all_auths();
        e.ledger().set_sequence_number(100);
        let (_owner, first_account, client) = setup(&e);
        let accounts = std::vec![
            first_account,
            Address::generate(&e),
            Address::generate(&e),
            Address::generate(&e),
            Address::generate(&e),
        ];
        let votes = VotesClient::new(&e, &client.address);
        let uri = String::from_str(&e, "ipfs://members/generated.json");
        let mut owners = std::vec::Vec::<usize>::new();
        let mut delegates = std::vec![None; accounts.len()];
        let mut operations = std::vec::Vec::<std::string::String>::new();

        // Every scenario starts with multiple holders, NFTs, self-delegation,
        // and cross-account delegation before generated operations begin.
        for holder in 0..3 {
            client.mint(&accounts[holder], &uri);
            owners.push(holder);
            operations.push(std::format!("mint(holder={holder})"));
        }
        votes.delegate(&accounts[0], &accounts[0]);
        delegates[0] = Some(0);
        operations.push("delegate(holder=0, delegate=0)".into());
        votes.delegate(&accounts[1], &accounts[3]);
        delegates[1] = Some(3);
        operations.push("delegate(holder=1, delegate=3)".into());
        assert_voting_model(
            &e,
            &client,
            &accounts,
            &owners,
            &delegates,
            seed,
            0,
            &operations,
        );

        let mut random = seed;
        for step in 1..=64 {
            e.ledger().set_sequence_number(e.ledger().sequence() + 1);
            match next_random(&mut random) % 3 {
                0 => {
                    let holder = (next_random(&mut random) as usize) % accounts.len();
                    client.mint(&accounts[holder], &uri);
                    owners.push(holder);
                    operations.push(std::format!("mint(holder={holder})"));
                }
                1 => {
                    let token = (next_random(&mut random) as usize) % owners.len();
                    let from = owners[token];
                    let mut to = (next_random(&mut random) as usize) % accounts.len();
                    if to == from {
                        to = (to + 1) % accounts.len();
                    }
                    client.transfer(&accounts[from], &accounts[to], &(token as u32));
                    owners[token] = to;
                    operations.push(std::format!(
                        "transfer(token={token}, from={from}, to={to})"
                    ));
                }
                _ => {
                    let holder = (next_random(&mut random) as usize) % accounts.len();
                    let mut delegate = (next_random(&mut random) as usize) % accounts.len();
                    if delegates[holder] == Some(delegate) {
                        delegate = (delegate + 1) % accounts.len();
                    }
                    votes.delegate(&accounts[holder], &accounts[delegate]);
                    delegates[holder] = Some(delegate);
                    operations.push(std::format!(
                        "delegate(holder={holder}, delegate={delegate})"
                    ));
                }
            }

            assert_voting_model(
                &e,
                &client,
                &accounts,
                &owners,
                &delegates,
                seed,
                step,
                &operations,
            );
        }
    }
}

#[test]
fn nft_storage_and_instance_ttls_renew_at_the_policy_boundary() {
    let e = Env::default();
    e.mock_all_auths();
    e.ledger().set_sequence_number(100);
    let (_owner, member, client) = setup(&e);
    let uri = String::from_str(&e, "ipfs://members/durable.json");
    let token_id = client.mint(&member, &uri);
    VotesClient::new(&e, &client.address).delegate(&member, &member);

    assert_eq!(client.owner_of(&token_id), member);
    assert_eq!(client.custom_token_uri(&token_id), uri);
    let votes = VotesClient::new(&e, &client.address);
    assert_eq!(votes.get_votes(&member), 1);
    assert_eq!(votes.get_delegate(&member), Some(member.clone()));

    e.as_contract(&client.address, || {
        assert_eq!(e.storage().instance().get_ttl(), STORAGE_EXTEND_AMOUNT);
        assert_eq!(
            e.storage()
                .persistent()
                .get_ttl(&DataKey::TokenUri(token_id)),
            STORAGE_EXTEND_AMOUNT
        );
        assert_eq!(
            e.storage()
                .persistent()
                .get_ttl(&NFTStorageKey::Owner(token_id)),
            STORAGE_EXTEND_AMOUNT
        );
        assert_eq!(
            e.storage()
                .persistent()
                .get_ttl(&VotesStorageKey::Delegatee(member.clone())),
            STORAGE_EXTEND_AMOUNT
        );
    });

    e.ledger().set_sequence_number(
        e.ledger().sequence() + (STORAGE_EXTEND_AMOUNT - STORAGE_TTL_THRESHOLD),
    );
    e.as_contract(&client.address, || {
        assert_eq!(
            e.storage()
                .persistent()
                .get_ttl(&DataKey::TokenUri(token_id)),
            STORAGE_TTL_THRESHOLD
        );
    });

    // Reads renew scalable persistent entries; the maintenance entry point
    // renews the contract instance and its owner/metadata/counter state.
    assert_eq!(client.custom_token_uri(&token_id), uri);
    assert_eq!(client.owner_of(&token_id), member);
    assert_eq!(votes.get_votes(&member), 1);
    assert_eq!(votes.get_delegate(&member), Some(member.clone()));
    client.extend_instance_ttl();

    e.as_contract(&client.address, || {
        assert_eq!(e.storage().instance().get_ttl(), STORAGE_EXTEND_AMOUNT);
        assert_eq!(
            e.storage()
                .persistent()
                .get_ttl(&DataKey::TokenUri(token_id)),
            STORAGE_EXTEND_AMOUNT
        );
        assert_eq!(
            e.storage()
                .persistent()
                .get_ttl(&NFTStorageKey::Owner(token_id)),
            STORAGE_EXTEND_AMOUNT
        );
        assert_eq!(
            e.storage()
                .persistent()
                .get_ttl(&VotesStorageKey::Delegatee(member)),
            STORAGE_EXTEND_AMOUNT
        );
    });
}
