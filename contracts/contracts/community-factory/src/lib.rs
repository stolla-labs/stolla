#![no_std]

#[cfg(test)]
mod test;

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error,
    xdr::ToXdr, Address, Bytes, BytesN, Env, String, Vec,
};

const DAY_IN_LEDGERS: u32 = 17_280;
pub const FACTORY_TTL_EXTEND: u32 = 30 * DAY_IN_LEDGERS;
pub const FACTORY_TTL_THRESHOLD: u32 = FACTORY_TTL_EXTEND - DAY_IN_LEDGERS;
pub const MAX_EXTERNAL_KEY_BYTES: u32 = 64;
pub const MAX_PAGE_SIZE: u32 = 100;
pub const METADATA_SCHEMA_VERSION: u32 = 1;
pub const MAX_NAME_BYTES: u32 = 64;
pub const MAX_SYMBOL_BYTES: u32 = 12;
pub const MAX_URI_BYTES: u32 = 256;
pub const MAX_VOTING_DELAY_LEDGERS: u32 = 7 * DAY_IN_LEDGERS;
pub const MAX_VOTING_PERIOD_LEDGERS: u32 = 90 * DAY_IN_LEDGERS;
pub const MAX_VOTE_COUNT: u128 = u32::MAX as u128;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CommunityMetadata {
    pub schema_version: u32,
    pub name: String,
    pub symbol: String,
    pub collection_uri: String,
    pub metadata_uri: String,
    pub metadata_hash: BytesN<32>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GovernanceParams {
    pub voting_delay: u32,
    pub voting_period: u32,
    pub proposal_threshold: u128,
    pub quorum: u128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CreateCommunityRequest {
    pub community_owner: Address,
    pub external_key: Bytes,
    pub metadata: CommunityMetadata,
    pub governance: GovernanceParams,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CommunityRecord {
    pub community_id: BytesN<32>,
    pub nft_contract: Address,
    pub governor_contract: Address,
    pub creator: Address,
    pub community_owner: Address,
    pub created_at_ledger: u32,
    pub creation_index: u32,
    pub nft_wasm_hash: BytesN<32>,
    pub governor_wasm_hash: BytesN<32>,
    pub metadata_uri: String,
    pub metadata_hash: BytesN<32>,
    pub metadata_schema_version: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum CommunityStatus {
    Active = 0,
    Paused = 1,
    Archived = 2,
}

pub struct CommunityPage {
    pub records: Vec<CommunityRecord>,
    /// Exclusive cursor: the next unread creation index, or `None` at the end.
    pub next_cursor: Option<u32>,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Owner,
    PendingOwner,
    PendingOwnerUntil,
    NftWasmHash,
    GovernorWasmHash,
    Paused,
    CommunityCount,
    Community(BytesN<32>),
    CommunityAt(u32),
    CommunityStatus(BytesN<32>),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum FactoryError {
    AlreadyInitialized = 1,
    InvalidCodeHash = 2,
    UnauthorizedCreator = 3,
    CreationPaused = 4,
    InvalidExternalKey = 5,
    InvalidMetadata = 6,
    InvalidGovernance = 7,
    DuplicateCommunity = 8,
    InvalidPageLimit = 9,
    InvalidCursor = 10,
    RegistryCorrupt = 11,
    CommunityCountOverflow = 12,
    AddressCollision = 13,
    InvalidOwnershipTransfer = 14,
    NoPendingOwner = 15,
    PendingOwnerExpired = 16,
    CommunityNotFound = 17,
    UnauthorizedCommunityOwner = 18,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CommunityCreated {
    #[topic]
    pub community_id: BytesN<32>,
    #[topic]
    pub nft_contract: Address,
    #[topic]
    pub governor_contract: Address,
    pub creator: Address,
    pub community_owner: Address,
    pub creation_index: u32,
    pub nft_wasm_hash: BytesN<32>,
    pub governor_wasm_hash: BytesN<32>,
    pub metadata_hash: BytesN<32>,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FactoryCodeHashesChanged {
    pub old_nft_wasm_hash: BytesN<32>,
    pub new_nft_wasm_hash: BytesN<32>,
    pub old_governor_wasm_hash: BytesN<32>,
    pub new_governor_wasm_hash: BytesN<32>,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FactoryPaused {
    pub paused: bool,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OwnershipTransferStarted {
    pub old_owner: Address,
    pub pending_owner: Address,
    pub live_until_ledger: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CommunityStatusChanged {
    #[topic]
    pub community_id: BytesN<32>,
    pub old_status: CommunityStatus,
    pub new_status: CommunityStatus,
}

#[contractevent]
pub struct OwnershipTransferred {
    pub old_owner: Address,
    pub new_owner: Address,
}

#[contract]
pub struct CommunityFactory;

#[contractimpl]
impl CommunityFactory {
    pub fn __constructor(
        e: &Env,
        owner: Address,
        nft_wasm_hash: BytesN<32>,
        governor_wasm_hash: BytesN<32>,
    ) {
        if e.storage().instance().has(&DataKey::Owner) {
            panic_with_error!(e, FactoryError::AlreadyInitialized);
        }
        if !valid_hash(&nft_wasm_hash) || !valid_hash(&governor_wasm_hash) {
            panic_with_error!(e, FactoryError::InvalidCodeHash);
        }

        let instance = e.storage().instance();
        instance.set(&DataKey::Owner, &owner);
        instance.set(&DataKey::NftWasmHash, &nft_wasm_hash);
        instance.set(&DataKey::GovernorWasmHash, &governor_wasm_hash);
        instance.set(&DataKey::Paused, &false);
        instance.set(&DataKey::CommunityCount, &0u32);
        extend_instance_ttl(e);
    }

    pub fn owner(e: &Env) -> Address {
        extend_instance_ttl(e);
        owner(e)
    }

    pub fn code_hashes(e: &Env) -> (BytesN<32>, BytesN<32>) {
        extend_instance_ttl(e);
        code_hashes(e)
    }

    pub fn is_paused(e: &Env) -> bool {
        extend_instance_ttl(e);
        e.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }

    pub fn community_count(e: &Env) -> u32 {
        extend_instance_ttl(e);
        community_count(e)
    }

    /// Derive the canonical ID as
    /// `sha256(network_id || factory_address_xdr || creator_address_xdr || external_key)`.
    pub fn community_id(
        e: &Env,
        creator: Address,
        external_key: Bytes,
    ) -> Result<BytesN<32>, FactoryError> {
        validate_external_key(&external_key)?;
        Ok(derive_community_id(e, &creator, &external_key))
    }

    pub fn create_community(
        e: &Env,
        creator: Address,
        request: CreateCommunityRequest,
    ) -> Result<CommunityRecord, FactoryError> {
        creator.require_auth();
        if creator != owner(e) {
            return Err(FactoryError::UnauthorizedCreator);
        }
        if e.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
        {
            return Err(FactoryError::CreationPaused);
        }

        validate_external_key(&request.external_key)?;
        validate_metadata(&request.metadata)?;
        validate_governance(&request.governance)?;

        let community_id = derive_community_id(e, &creator, &request.external_key);
        let community_key = DataKey::Community(community_id.clone());
        if e.storage().persistent().has(&community_key) {
            return Err(FactoryError::DuplicateCommunity);
        }

        let creation_index = community_count(e);
        let next_count = creation_index
            .checked_add(1)
            .ok_or(FactoryError::CommunityCountOverflow)?;
        let (nft_wasm_hash, governor_wasm_hash) = code_hashes(e);
        let nft_salt = derive_salt(e, b"nft", &community_id);
        let governor_salt = derive_salt(e, b"governor", &community_id);

        let nft_contract = e.deployer().with_current_contract(nft_salt).deploy_v2(
            nft_wasm_hash.clone(),
            (
                request.metadata.collection_uri.clone(),
                request.metadata.name.clone(),
                request.metadata.symbol.clone(),
                request.community_owner.clone(),
            ),
        );
        let governor_contract = e.deployer().with_current_contract(governor_salt).deploy_v2(
            governor_wasm_hash.clone(),
            (
                nft_contract.clone(),
                request.governance.voting_delay,
                request.governance.voting_period,
                request.governance.proposal_threshold,
                request.governance.quorum,
            ),
        );

        if nft_contract == governor_contract {
            return Err(FactoryError::AddressCollision);
        }

        let record = CommunityRecord {
            community_id: community_id.clone(),
            nft_contract: nft_contract.clone(),
            governor_contract: governor_contract.clone(),
            creator: creator.clone(),
            community_owner: request.community_owner.clone(),
            created_at_ledger: e.ledger().sequence(),
            creation_index,
            nft_wasm_hash: nft_wasm_hash.clone(),
            governor_wasm_hash: governor_wasm_hash.clone(),
            metadata_uri: request.metadata.metadata_uri.clone(),
            metadata_hash: request.metadata.metadata_hash.clone(),
            metadata_schema_version: request.metadata.schema_version,
        };

        let index_key = DataKey::CommunityAt(creation_index);
        let persistent = e.storage().persistent();
        persistent.set(&community_key, &record);
        persistent.set(&index_key, &community_id);
        persistent.extend_ttl(&community_key, FACTORY_TTL_THRESHOLD, FACTORY_TTL_EXTEND);
        persistent.extend_ttl(&index_key, FACTORY_TTL_THRESHOLD, FACTORY_TTL_EXTEND);
        e.storage()
            .instance()
            .set(&DataKey::CommunityCount, &next_count);
        extend_instance_ttl(e);

        CommunityCreated {
            community_id,
            nft_contract,
            governor_contract,
            creator,
            community_owner: request.community_owner,
            creation_index,
            nft_wasm_hash,
            governor_wasm_hash,
            metadata_hash: request.metadata.metadata_hash,
        }
        .publish(e);

        Ok(record)
    }

    pub fn get_community(e: &Env, community_id: BytesN<32>) -> Option<CommunityRecord> {
        extend_instance_ttl(e);
        let key = DataKey::Community(community_id);
        let record = e.storage().persistent().get(&key);
        if record.is_some() {
            e.storage()
                .persistent()
                .extend_ttl(&key, FACTORY_TTL_THRESHOLD, FACTORY_TTL_EXTEND);
        }
        record
    }

    pub fn list_communities(
        e: &Env,
        cursor: Option<u32>,
        limit: u32,
    ) -> Result<CommunityPage, FactoryError> {
        if !(1..=MAX_PAGE_SIZE).contains(&limit) {
            return Err(FactoryError::InvalidPageLimit);
        }
        extend_instance_ttl(e);

        let count = community_count(e);
        let start = cursor.unwrap_or(0);
        if start > count {
            return Err(FactoryError::InvalidCursor);
        }
        let end = start.saturating_add(limit).min(count);
        let mut records = Vec::new(e);
        let mut index = start;
        while index < end {
            let index_key = DataKey::CommunityAt(index);
            let community_id: BytesN<32> = e
                .storage()
                .persistent()
                .get(&index_key)
                .ok_or(FactoryError::RegistryCorrupt)?;
            e.storage().persistent().extend_ttl(
                &index_key,
                FACTORY_TTL_THRESHOLD,
                FACTORY_TTL_EXTEND,
            );

            let community_key = DataKey::Community(community_id);
            let record = e
                .storage()
                .persistent()
                .get(&community_key)
                .ok_or(FactoryError::RegistryCorrupt)?;
            e.storage().persistent().extend_ttl(
                &community_key,
                FACTORY_TTL_THRESHOLD,
                FACTORY_TTL_EXTEND,
            );
            records.push_back(record);
            index += 1;
        }

        Ok(CommunityPage {
            records,
            next_cursor: if end < count { Some(end) } else { None },
        })
    }

    pub fn set_code_hashes(
        e: &Env,
        nft_wasm_hash: BytesN<32>,
        governor_wasm_hash: BytesN<32>,
    ) -> Result<(), FactoryError> {
        require_owner_auth(e);
        if !valid_hash(&nft_wasm_hash) || !valid_hash(&governor_wasm_hash) {
            return Err(FactoryError::InvalidCodeHash);
        }

        let (old_nft_wasm_hash, old_governor_wasm_hash) = code_hashes(e);
        let instance = e.storage().instance();
        instance.set(&DataKey::NftWasmHash, &nft_wasm_hash);
        instance.set(&DataKey::GovernorWasmHash, &governor_wasm_hash);
        extend_instance_ttl(e);

        FactoryCodeHashesChanged {
            old_nft_wasm_hash,
            new_nft_wasm_hash: nft_wasm_hash,
            old_governor_wasm_hash,
            new_governor_wasm_hash: governor_wasm_hash,
        }
        .publish(e);
        Ok(())
    }

    pub fn set_paused(e: &Env, paused: bool) {
        require_owner_auth(e);
        e.storage().instance().set(&DataKey::Paused, &paused);
        extend_instance_ttl(e);
        FactoryPaused { paused }.publish(e);
    }

    pub fn transfer_ownership(
        e: &Env,
        pending_owner: Address,
        live_until_ledger: u32,
    ) -> Result<(), FactoryError> {
        let old_owner = require_owner_auth(e);
        if pending_owner == old_owner || live_until_ledger <= e.ledger().sequence() {
            return Err(FactoryError::InvalidOwnershipTransfer);
        }
        let instance = e.storage().instance();
        instance.set(&DataKey::PendingOwner, &pending_owner);
        instance.set(&DataKey::PendingOwnerUntil, &live_until_ledger);
        extend_instance_ttl(e);
        OwnershipTransferStarted {
            old_owner,
            pending_owner,
            live_until_ledger,
        }
        .publish(e);
        Ok(())
    }

    pub fn accept_ownership(e: &Env) -> Result<(), FactoryError> {
        let instance = e.storage().instance();
        let pending_owner: Address = instance
            .get(&DataKey::PendingOwner)
            .ok_or(FactoryError::NoPendingOwner)?;
        let live_until_ledger: u32 = instance
            .get(&DataKey::PendingOwnerUntil)
            .ok_or(FactoryError::NoPendingOwner)?;
        if e.ledger().sequence() > live_until_ledger {
            return Err(FactoryError::PendingOwnerExpired);
        }
        pending_owner.require_auth();

        let old_owner = owner(e);
        instance.set(&DataKey::Owner, &pending_owner);
        instance.remove(&DataKey::PendingOwner);
        instance.remove(&DataKey::PendingOwnerUntil);
        extend_instance_ttl(e);
        OwnershipTransferred {
            old_owner,
            new_owner: pending_owner,
        }
        .publish(e);
        Ok(())
    }

    pub fn get_community_status(e: &Env, community_id: BytesN<32>) -> CommunityStatus {
        extend_instance_ttl(e);
        let key = DataKey::CommunityStatus(community_id.clone());
        let status = e
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(CommunityStatus::Active);
        if e.storage().persistent().has(&key) {
            e.storage()
                .persistent()
                .extend_ttl(&key, FACTORY_TTL_THRESHOLD, FACTORY_TTL_EXTEND);
        }
        status
    }

    pub fn set_community_status(
        e: &Env,
        community_id: BytesN<32>,
        new_status: CommunityStatus,
    ) -> Result<(), FactoryError> {
        let key = DataKey::Community(community_id.clone());
        let record: CommunityRecord = e
            .storage()
            .persistent()
            .get(&key)
            .ok_or(FactoryError::CommunityNotFound)?;

        // Authorization: Community owner must authorize status changes
        record.community_owner.require_auth();

        let status_key = DataKey::CommunityStatus(community_id.clone());
        let old_status = e
            .storage()
            .persistent()
            .get(&status_key)
            .unwrap_or(CommunityStatus::Active);

        e.storage().persistent().set(&status_key, &new_status);
        e.storage()
            .persistent()
            .extend_ttl(&status_key, FACTORY_TTL_THRESHOLD, FACTORY_TTL_EXTEND);

        CommunityStatusChanged {
            community_id,
            old_status,
            new_status,
        }
        .publish(e);

        Ok(())
    }


    /// Permissionless keeper entry point for the bounded instance state.
    pub fn extend_instance_ttl(e: &Env) {
        extend_instance_ttl(e);
    }
}

fn owner(e: &Env) -> Address {
    e.storage()
        .instance()
        .get(&DataKey::Owner)
        .expect("factory is initialized")
}

fn require_owner_auth(e: &Env) -> Address {
    let owner = owner(e);
    owner.require_auth();
    owner
}

fn code_hashes(e: &Env) -> (BytesN<32>, BytesN<32>) {
    (
        e.storage()
            .instance()
            .get(&DataKey::NftWasmHash)
            .expect("factory is initialized"),
        e.storage()
            .instance()
            .get(&DataKey::GovernorWasmHash)
            .expect("factory is initialized"),
    )
}

fn community_count(e: &Env) -> u32 {
    e.storage()
        .instance()
        .get(&DataKey::CommunityCount)
        .unwrap_or(0)
}

fn extend_instance_ttl(e: &Env) {
    e.storage()
        .instance()
        .extend_ttl(FACTORY_TTL_THRESHOLD, FACTORY_TTL_EXTEND);
}

fn valid_hash(hash: &BytesN<32>) -> bool {
    let mut index = 0;
    while index < 32 {
        if hash.get(index).unwrap_or(0) != 0 {
            return true;
        }
        index += 1;
    }
    false
}

fn validate_external_key(external_key: &Bytes) -> Result<(), FactoryError> {
    if external_key.is_empty() || external_key.len() > MAX_EXTERNAL_KEY_BYTES {
        return Err(FactoryError::InvalidExternalKey);
    }
    Ok(())
}

fn validate_metadata(metadata: &CommunityMetadata) -> Result<(), FactoryError> {
    if metadata.schema_version != METADATA_SCHEMA_VERSION
        || !valid_text(&metadata.name, MAX_NAME_BYTES)
        || !valid_symbol(&metadata.symbol)
        || !valid_uri(&metadata.collection_uri)
        || !valid_uri(&metadata.metadata_uri)
        || !valid_hash(&metadata.metadata_hash)
    {
        return Err(FactoryError::InvalidMetadata);
    }
    Ok(())
}

fn validate_governance(governance: &GovernanceParams) -> Result<(), FactoryError> {
    if governance.voting_delay > MAX_VOTING_DELAY_LEDGERS
        || governance.voting_period == 0
        || governance.voting_period > MAX_VOTING_PERIOD_LEDGERS
        || governance.proposal_threshold == 0
        || governance.proposal_threshold > MAX_VOTE_COUNT
        || governance.quorum == 0
        || governance.quorum > MAX_VOTE_COUNT
        || governance
            .voting_delay
            .checked_add(governance.voting_period)
            .is_none()
    {
        return Err(FactoryError::InvalidGovernance);
    }
    Ok(())
}

fn valid_text(value: &String, max_len: u32) -> bool {
    let bytes = value.to_bytes();
    if bytes.is_empty() || bytes.len() > max_len {
        return false;
    }
    let mut has_visible = false;
    let mut index = 0;
    while index < bytes.len() {
        let byte = bytes.get(index).unwrap_or(0);
        if byte < 0x20 || byte == 0x7f {
            return false;
        }
        if byte != b' ' {
            has_visible = true;
        }
        index += 1;
    }
    has_visible
}

fn valid_symbol(value: &String) -> bool {
    let bytes = value.to_bytes();
    if bytes.is_empty() || bytes.len() > MAX_SYMBOL_BYTES {
        return false;
    }
    let mut index = 0;
    while index < bytes.len() {
        let byte = bytes.get(index).unwrap_or(0);
        if !byte.is_ascii_uppercase() && !byte.is_ascii_digit() {
            return false;
        }
        index += 1;
    }
    true
}

fn valid_uri(value: &String) -> bool {
    let bytes = value.to_bytes();
    if bytes.is_empty() || bytes.len() > MAX_URI_BYTES {
        return false;
    }
    has_prefix(&bytes, b"ipfs://") || has_prefix(&bytes, b"https://")
}

fn has_prefix(bytes: &Bytes, prefix: &[u8]) -> bool {
    if bytes.len() < prefix.len() as u32 {
        return false;
    }
    let mut index = 0;
    while index < prefix.len() as u32 {
        if bytes.get(index) != Some(prefix[index as usize]) {
            return false;
        }
        index += 1;
    }
    bytes.len() > prefix.len() as u32
}

fn derive_community_id(e: &Env, creator: &Address, external_key: &Bytes) -> BytesN<32> {
    let mut preimage = Bytes::new(e);
    preimage.append(&Bytes::from_array(e, &e.ledger().network_id().to_array()));
    preimage.append(&e.current_contract_address().to_xdr(e));
    preimage.append(&creator.to_xdr(e));
    preimage.append(external_key);
    e.crypto().sha256(&preimage).to_bytes()
}

fn derive_salt(e: &Env, domain: &[u8], community_id: &BytesN<32>) -> BytesN<32> {
    let mut preimage = Bytes::from_slice(e, domain);
    preimage.append(&Bytes::from_array(e, &community_id.to_array()));
    e.crypto().sha256(&preimage).to_bytes()
}
