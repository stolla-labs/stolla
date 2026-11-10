#![cfg(test)]

extern crate std;

use community_nft::CommunityNftClient;
use soroban_sdk::{
    testutils::{Address as _, Events as _, Ledger as _},
    Address, Bytes, BytesN, Env, Event, String,
};
use stellar_governance::governor::GovernorClient;

use crate::{
    derive_salt, CommunityCreated, CommunityFactory, CommunityFactoryClient, CommunityMetadata,
    CommunityPausedChanged, CreateCommunityRequest, FactoryError, GovernanceParams,
    METADATA_SCHEMA_VERSION,
};

const NFT_WASM: &[u8] = include_bytes!("../test_wasm/community_nft.wasm");
const GOVERNOR_WASM: &[u8] = include_bytes!("../test_wasm/community_governor.wasm");

struct Fixture {
    e: Env,
    owner: Address,
    factory_id: Address,
    nft_wasm_hash: BytesN<32>,
    governor_wasm_hash: BytesN<32>,
}

impl Fixture {
    fn new() -> Self {
        let e = Env::default();
        e.ledger().with_mut(|ledger| {
            ledger.sequence_number = 12_345;
            ledger.network_id = [7; 32];
        });
        let owner = Address::generate(&e);
        let nft_wasm_hash = e.deployer().upload_contract_wasm(NFT_WASM);
        let governor_wasm_hash = e.deployer().upload_contract_wasm(GOVERNOR_WASM);
        let factory_id = e.register(
            CommunityFactory,
            (
                owner.clone(),
                nft_wasm_hash.clone(),
                governor_wasm_hash.clone(),
            ),
        );
        Self {
            e,
            owner,
            factory_id,
            nft_wasm_hash,
            governor_wasm_hash,
        }
    }

    fn client(&self) -> CommunityFactoryClient<'_> {
        CommunityFactoryClient::new(&self.e, &self.factory_id)
    }

    fn request(&self, external_key: &[u8]) -> CreateCommunityRequest {
        CreateCommunityRequest {
            community_owner: Address::generate(&self.e),
            external_key: Bytes::from_slice(&self.e, external_key),
            metadata: CommunityMetadata {
                schema_version: METADATA_SCHEMA_VERSION,
                name: String::from_str(&self.e, "Builders Guild"),
                symbol: String::from_str(&self.e, "BUILD"),
                collection_uri: String::from_str(&self.e, "ipfs://bafy-collection/"),
                metadata_uri: String::from_str(&self.e, "ipfs://bafy-community/metadata.json"),
                metadata_hash: self
                    .e
                    .crypto()
                    .sha256(&Bytes::from_slice(
                        &self.e,
                        br#"{"schemaVersion":1,"name":"Builders Guild"}"#,
                    ))
                    .to_bytes(),
            },
            governance: GovernanceParams {
                voting_delay: 12,
                voting_period: 2_000,
                proposal_threshold: 1,
                quorum: 3,
            },
        }
    }
}

#[test]
fn constructor_initializes_once_and_rejects_zero_hashes() {
    let fixture = Fixture::new();
    let client = fixture.client();
    assert_eq!(client.owner(), fixture.owner);
    assert_eq!(
        client.code_hashes(),
        (
            fixture.nft_wasm_hash.clone(),
            fixture.governor_wasm_hash.clone()
        )
    );
    assert_eq!(client.community_count(), 0);

    let repeated = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        fixture.e.register_at(
            &fixture.factory_id,
            CommunityFactory,
            (
                fixture.owner.clone(),
                fixture.nft_wasm_hash.clone(),
                fixture.governor_wasm_hash.clone(),
            ),
        );
    }));
    assert!(repeated.is_err());

    let e = Env::default();
    let zero_hash = BytesN::from_array(&e, &[0; 32]);
    let invalid = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        e.register(
            CommunityFactory,
            (Address::generate(&e), zero_hash.clone(), zero_hash.clone()),
        );
    }));
    assert!(invalid.is_err());
}

#[test]
fn create_deploys_initialized_deterministic_pair_and_emits_event() {
    let fixture = Fixture::new();
    fixture.e.mock_all_auths();
    let request = fixture.request(b"builders");
    let client = fixture.client();
    let expected_id = client.community_id(&fixture.owner, &request.external_key);

    let nft_salt = derive_salt(&fixture.e, b"nft", &expected_id);
    let governor_salt = derive_salt(&fixture.e, b"governor", &expected_id);
    let expected_nft = fixture.e.as_contract(&fixture.factory_id, || {
        fixture
            .e
            .deployer()
            .with_current_contract(nft_salt)
            .deployed_address()
    });
    let expected_governor = fixture.e.as_contract(&fixture.factory_id, || {
        fixture
            .e
            .deployer()
            .with_current_contract(governor_salt)
            .deployed_address()
    });

    let record = client.create_community(&fixture.owner, &request);
    assert_eq!(record.community_id, expected_id);
    assert_eq!(record.nft_contract, expected_nft);
    assert_eq!(record.governor_contract, expected_governor);
    assert_ne!(record.nft_contract, record.governor_contract);
    assert_eq!(record.community_owner, request.community_owner);
    assert_eq!(record.creation_index, 0);
    assert_eq!(record.created_at_ledger, 12_345);

    // Soroban test events are scoped to the latest top-level invocation, so
    // inspect the creation event before issuing registry or child reads.
    let expected_event = CommunityCreated {
        community_id: record.community_id.clone(),
        nft_contract: record.nft_contract.clone(),
        governor_contract: record.governor_contract.clone(),
        creator: fixture.owner.clone(),
        community_owner: request.community_owner.clone(),
        creation_index: 0,
        nft_wasm_hash: fixture.nft_wasm_hash.clone(),
        governor_wasm_hash: fixture.governor_wasm_hash.clone(),
        metadata_hash: request.metadata.metadata_hash.clone(),
    }
    .to_xdr(&fixture.e, &fixture.factory_id);
    assert_eq!(
        fixture.e.events().all().events().last(),
        Some(&expected_event)
    );

    assert_eq!(client.get_community(&expected_id), Some(record.clone()));
    assert_eq!(client.community_count(), 1);

    let nft = CommunityNftClient::new(&fixture.e, &record.nft_contract);
    assert_eq!(nft.get_owner(), Some(request.community_owner.clone()));
    assert_eq!(nft.name(), request.metadata.name);
    assert_eq!(nft.symbol(), request.metadata.symbol);

    let governor = GovernorClient::new(&fixture.e, &record.governor_contract);
    assert_eq!(governor.get_token_contract(), record.nft_contract);
    assert_eq!(governor.voting_delay(), request.governance.voting_delay);
    assert_eq!(governor.voting_period(), request.governance.voting_period);
    assert_eq!(
        governor.proposal_threshold(),
        request.governance.proposal_threshold
    );
    assert_eq!(
        governor.quorum(&fixture.e.ledger().sequence()),
        request.governance.quorum
    );
}

#[test]
fn authorization_duplicate_pause_and_validation_fail_without_registry_writes() {
    let fixture = Fixture::new();
    fixture.e.mock_all_auths();
    let client = fixture.client();
    let request = fixture.request(b"secure");
    let non_owner = Address::generate(&fixture.e);

    assert_eq!(
        client.try_create_community(&non_owner, &request),
        Err(Ok(FactoryError::UnauthorizedCreator))
    );
    assert_eq!(client.community_count(), 0);

    let mut invalid_key = request.clone();
    invalid_key.external_key = Bytes::new(&fixture.e);
    assert_eq!(
        client.try_create_community(&fixture.owner, &invalid_key),
        Err(Ok(FactoryError::InvalidExternalKey))
    );

    let mut invalid_metadata = request.clone();
    invalid_metadata.metadata.schema_version = 99;
    assert_eq!(
        client.try_create_community(&fixture.owner, &invalid_metadata),
        Err(Ok(FactoryError::InvalidMetadata))
    );

    let mut invalid_governance = request.clone();
    invalid_governance.governance.voting_period = 0;
    assert_eq!(
        client.try_create_community(&fixture.owner, &invalid_governance),
        Err(Ok(FactoryError::InvalidGovernance))
    );
    assert_eq!(client.community_count(), 0);

    client.set_paused(&true);
    assert_eq!(
        client.try_create_community(&fixture.owner, &request),
        Err(Ok(FactoryError::CreationPaused))
    );
    client.set_paused(&false);

    let record = client.create_community(&fixture.owner, &request);
    assert_eq!(
        client.try_create_community(&fixture.owner, &request),
        Err(Ok(FactoryError::DuplicateCommunity))
    );
    assert_eq!(client.community_count(), 1);
    assert_eq!(
        client.get_community(&record.community_id),
        Some(record.clone())
    );
}

#[test]
fn missing_authorization_rejects_creation() {
    let fixture = Fixture::new();
    let client = fixture.client();
    let request = fixture.request(b"no-auth");

    assert!(client
        .try_create_community(&fixture.owner, &request)
        .is_err());
    assert_eq!(client.community_count(), 0);
}

#[test]
fn registry_lists_stable_pages_and_validates_boundaries() {
    let fixture = Fixture::new();
    fixture.e.mock_all_auths();
    let client = fixture.client();

    let empty = client.list_communities(&None, &10);
    assert!(empty.records.is_empty());
    assert_eq!(empty.next_cursor, None);

    let first = client.create_community(&fixture.owner, &fixture.request(b"first"));
    let second = client.create_community(&fixture.owner, &fixture.request(b"second"));
    let third = client.create_community(&fixture.owner, &fixture.request(b"third"));

    let page_one = client.list_communities(&None, &2);
    assert_eq!(page_one.records.len(), 2);
    assert_eq!(page_one.records.get(0), Some(first.clone()));
    assert_eq!(page_one.records.get(1), Some(second.clone()));
    assert_eq!(page_one.next_cursor, Some(2));

    let page_two = client.list_communities(&page_one.next_cursor, &2);
    assert_eq!(page_two.records.len(), 1);
    assert_eq!(page_two.records.get(0), Some(third.clone()));
    assert_eq!(page_two.next_cursor, None);

    let at_end = client.list_communities(&Some(3), &1);
    assert!(at_end.records.is_empty());
    assert_eq!(at_end.next_cursor, None);
    assert_eq!(
        client.get_community(&BytesN::from_array(&fixture.e, &[9; 32])),
        None
    );
    assert_eq!(
        client.try_list_communities(&None, &0),
        Err(Ok(FactoryError::InvalidPageLimit))
    );
    assert_eq!(
        client.try_list_communities(&None, &101),
        Err(Ok(FactoryError::InvalidPageLimit))
    );
    assert_eq!(
        client.try_list_communities(&Some(4), &1),
        Err(Ok(FactoryError::InvalidCursor))
    );
}

#[test]
fn failed_second_deployment_rolls_back_first_and_allows_retry() {
    let fixture = Fixture::new();
    fixture.e.mock_all_auths();
    let client = fixture.client();
    let request = fixture.request(b"atomic");
    let community_id = client.community_id(&fixture.owner, &request.external_key);

    // The NFT WASM cannot accept Governor constructor arguments. The second
    // deployment therefore fails after the NFT deployment has been attempted.
    client.set_code_hashes(&fixture.nft_wasm_hash, &fixture.nft_wasm_hash);
    assert!(client
        .try_create_community(&fixture.owner, &request)
        .is_err());
    assert_eq!(client.community_count(), 0);
    assert_eq!(client.get_community(&community_id), None);

    client.set_code_hashes(&fixture.nft_wasm_hash, &fixture.governor_wasm_hash);
    let record = client.create_community(&fixture.owner, &request);
    assert_eq!(record.community_id, community_id);
    assert_eq!(client.community_count(), 1);
}

#[test]
fn ownership_transfer_changes_creation_authority_only_after_acceptance() {
    let fixture = Fixture::new();
    fixture.e.mock_all_auths();
    let client = fixture.client();
    let new_owner = Address::generate(&fixture.e);
    let deadline = fixture.e.ledger().sequence() + 100;

    client.transfer_ownership(&new_owner, &deadline);
    assert_eq!(client.owner(), fixture.owner);
    client.accept_ownership();
    assert_eq!(client.owner(), new_owner.clone());

    assert_eq!(
        client.try_create_community(&fixture.owner, &fixture.request(b"old-owner")),
        Err(Ok(FactoryError::UnauthorizedCreator))
    );
    client.create_community(&new_owner, &fixture.request(b"new-owner"));
    assert_eq!(client.community_count(), 1);
}

#[test]
fn community_owner_sync_follows_accepted_nft_owner() {
    let fixture = Fixture::new();
    fixture.e.mock_all_auths();
    let client = fixture.client();
    let request = fixture.request(b"ownership-sync");
    let record = client.create_community(&fixture.owner, &request);
    let nft = CommunityNftClient::new(&fixture.e, &record.nft_contract);
    let next_owner = Address::generate(&fixture.e);
    let deadline = fixture.e.ledger().sequence() + 100;

    nft.transfer_ownership(&next_owner, &deadline);
    assert_eq!(
        client
            .sync_community_owner(&record.community_id)
            .community_owner,
        request.community_owner
    );
    nft.accept_ownership();
    assert_eq!(
        client
            .get_community(&record.community_id)
            .unwrap()
            .community_owner,
        request.community_owner
    );
    assert_eq!(
        client
            .sync_community_owner(&record.community_id)
            .community_owner,
        next_owner
    );
    assert_eq!(
        client
            .list_communities(&None, &10)
            .records
            .get(0)
            .unwrap()
            .community_owner,
        next_owner
    );
    assert_eq!(nft.get_owner(), Some(next_owner));
    assert_eq!(
        client.try_sync_community_owner(&BytesN::from_array(&fixture.e, &[0; 32])),
        Err(Ok(FactoryError::CommunityNotFound))
    );
}

#[test]
fn community_pause_state_authorizes_community_or_factory_owner_and_preserves_reads() {
    let fixture = Fixture::new();
    fixture.e.mock_all_auths();
    let client = fixture.client();
    let request = fixture.request(b"pausable-community");
    let record = client.create_community(&fixture.owner, &request);
    let stranger = Address::generate(&fixture.e);
    let unknown_id = BytesN::from_array(&fixture.e, &[5; 32]);

    assert!(!client.is_community_paused(&record.community_id));
    assert_eq!(
        client.try_is_community_paused(&unknown_id),
        Err(Ok(FactoryError::CommunityNotFound))
    );
    assert_eq!(
        client.try_set_community_paused(&fixture.owner, &unknown_id, &true),
        Err(Ok(FactoryError::CommunityNotFound))
    );
    assert_eq!(
        client.try_set_community_paused(&stranger, &record.community_id, &true),
        Err(Ok(FactoryError::UnauthorizedCommunityAdmin))
    );
    assert!(!client.is_community_paused(&record.community_id));

    // Community owner can pause the community
    assert!(client.set_community_paused(
        &request.community_owner,
        &record.community_id,
        &true
    ));
    let expected_event = CommunityPausedChanged {
        community_id: record.community_id.clone(),
        caller: request.community_owner.clone(),
        paused: true,
    }
    .to_xdr(&fixture.e, &fixture.factory_id);
    assert_eq!(
        fixture.e.events().all().events().last(),
        Some(&expected_event)
    );
    assert!(client.is_community_paused(&record.community_id));

    // Read paths remain available while paused
    assert_eq!(
        client.get_community(&record.community_id),
        Some(record.clone())
    );
    assert_eq!(
        client.list_communities(&None, &10).records.get(0),
        Some(record.clone())
    );

    // Factory owner can also unpause (or pause) as emergency policy fallback
    assert!(!client.set_community_paused(&fixture.owner, &record.community_id, &false));
    assert!(!client.is_community_paused(&record.community_id));
}
