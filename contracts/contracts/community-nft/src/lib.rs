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

#[contract]
pub struct CommunityNft;

#[contractimpl]
impl CommunityNft {
    pub fn __constructor(e: &Env, uri: String, name: String, symbol: String, owner: Address) {
        Base::set_metadata(e, uri, name, symbol);
        set_owner(e, &owner);
    }

    #[only_owner]
    pub fn mint(e: &Env, to: Address, token_uri: String) -> u32 {
        let token_id = NonFungibleVotes::sequential_mint(e, &to);
        e.storage()
            .persistent()
            .set(&DataKey::TokenUri(token_id), &token_uri);
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
