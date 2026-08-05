#![no_std]

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String};
use stellar_access::ownable::{set_owner, Ownable};
use stellar_governance::votes::Votes;
use stellar_macros::only_owner;
use stellar_tokens::non_fungible::{
    votes::NonFungibleVotes, Base, NonFungibleToken,
};

#[contracttype]
pub enum DataKey {
    TokenUri(u32),
}

/// Validates a token URI before minting.
///
/// # Rules
/// - Empty URIs are rejected.
/// - Whitespace-only URIs are rejected (treated as empty after trimming).
/// - Leading and trailing whitespace is trimmed and the resulting URI is used.
///
/// # Errors
/// Returns `false` if the URI is empty or whitespace-only after trimming.
fn is_valid_token_uri(uri: &String) -> bool {
    let trimmed: String = String::from_str(&uri.env(), &uri.to_string().trim());
    !trimmed.is_empty()
}

/// Normalizes a token URI by trimming leading and trailing whitespace.
fn normalize_token_uri(uri: &String) -> String {
    String::from_str(&uri.env(), &uri.to_string().trim())
}

#[contract]
pub struct CommunityNft;

#[contractimpl]
impl CommunityNft {
    pub fn __constructor(e: &Env, uri: String, name: String, symbol: String, owner: Address) {
        Base::set_metadata(e, uri, name, symbol);
        set_owner(e, &owner);
    }

    /// Mint a new NFT with the given token URI.
    ///
    /// # Validation
    /// - Only the contract owner may mint (enforced by `#[only_owner]`).
    /// - The `token_uri` is trimmed of leading/trailing whitespace.
    /// - Empty and whitespace-only URIs are rejected.
    ///
    /// # Panics
    /// Panics with `"community-nft: token URI must not be empty"` if the URI is invalid.
    ///
    /// # Returns
    /// The sequential token ID of the newly minted NFT.
    #[only_owner]
    pub fn mint(e: &Env, to: Address, token_uri: String) -> u32 {
        assert!(
            is_valid_token_uri(&token_uri),
            "community-nft: token URI must not be empty"
        );
        let normalized_uri = normalize_token_uri(&token_uri);
        let token_id = NonFungibleVotes::sequential_mint(e, &to);
        e.storage()
            .persistent()
            .set(&DataKey::TokenUri(token_id), &normalized_uri);
        token_id
    }

    pub fn custom_token_uri(e: &Env, token_id: u32) -> String {
        e.storage()
            .persistent()
            .get(&DataKey::TokenUri(token_id))
            .unwrap_or_else(|| Base::token_uri(e, token_id))
    }
}

#[contractimpl(contracttrait)]
impl NonFungibleToken for CommunityNft {
    type ContractType = NonFungibleVotes;
}

#[contractimpl(contracttrait)]
impl Votes for CommunityNft {}

#[contractimpl(contracttrait)]
impl Ownable for CommunityNft {}
