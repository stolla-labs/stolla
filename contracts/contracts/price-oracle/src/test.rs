//! Tests for the PriceOracle contract, focusing on relayer fee settlement in
//! a native (SEP-0041) token.
//!
//! Test matrix
//! -----------
//! 1. `submit_price_transfers_fee_immediately`
//!    Pool has enough tokens → fee transferred automatically on submission.
//!
//! 2. `submit_price_accrues_owed_when_pool_empty`
//!    Pool is empty → no transfer, but owed balance grows.
//!
//! 3. `withdraw_relayer_fees_pays_full_owed_when_pool_refilled`
//!    After accrual, admin tops up pool → relayer withdraws exact owed amount.
//!
//! 4. `withdraw_relayer_fees_partial_when_pool_insufficient`
//!    Pool has less than the owed amount → partial payment, remainder stays
//!    owed.
//!
//! 5. `withdraw_relayer_fees_noop_when_nothing_owed`
//!    Owed == 0 → no transfer, no panic.
//!
//! 6. `submit_price_unauthorized_relayer_panics`
//!    Address not in allowlist → submit_price should panic.
//!
//! 7. `set_settlement_token_only_admin`
//!    Non-admin calling set_settlement_token should panic.
//!
//! 8. `multiple_submissions_accumulate_correct_fee`
//!    Two submissions → relayer receives 2× fee.
//!
//! 9. `median_helper_odd_and_even_lengths`
//!    Verify the in-contract median helper.

#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env, IntoVal, Map, Symbol,
};

use crate::{PriceOracle, PriceOracleClient};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Deploy a simple Stellar Asset Contract (native-token style) so we have a
/// real SEP-0041 token to exercise transfers.
fn create_token<'a>(e: &'a Env, admin: &Address) -> (Address, StellarAssetClient<'a>) {
    let token_id = e.register_stellar_asset_contract_v2(admin.clone());
    let sac = StellarAssetClient::new(e, &token_id.address());
    (token_id.address(), sac)
}

const FEE: i128 = 1_000_000; // 0.1 XLM equivalent in stroops

/// Register the oracle, add one relayer, and fund the contract pool.
fn setup_oracle_with_pool<'a>(
    e: &'a Env,
    admin: &Address,
    relayer: &Address,
    token_addr: &Address,
    pool_amount: i128,
) -> PriceOracleClient<'a> {
    let oracle_id = e.register(
        PriceOracle,
        (admin.clone(), token_addr.clone(), FEE),
    );
    let oracle = PriceOracleClient::new(e, &oracle_id);

    oracle.add_relayer(relayer);

    // Transfer `pool_amount` tokens into the contract so fees can be paid.
    if pool_amount > 0 {
        let sac = StellarAssetClient::new(e, token_addr);
        sac.mint(&oracle_id, &pool_amount);
    }

    oracle
}

// ---------------------------------------------------------------------------
// Test 1 – immediate fee transfer when pool is funded
// ---------------------------------------------------------------------------

#[test]
fn submit_price_transfers_fee_immediately() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let relayer = Address::generate(&e);
    let (token_addr, _sac) = create_token(&e, &admin);

    let oracle = setup_oracle_with_pool(&e, &admin, &relayer, &token_addr, FEE * 5);

    let token = TokenClient::new(&e, &token_addr);
    let oracle_id = oracle.address.clone();

    let pool_before = token.balance(&oracle_id);
    let relayer_before = token.balance(&relayer);

    let asset = Symbol::new(&e, "XLM_USDC");
    oracle.submit_price(&relayer, &asset, &1_234_567);

    assert_eq!(token.balance(&oracle_id), pool_before - FEE);
    assert_eq!(token.balance(&relayer), relayer_before + FEE);
    // Nothing should be owed.
    assert_eq!(oracle.owed_fees(&relayer), 0);
}

// ---------------------------------------------------------------------------
// Test 2 – fee accrued when pool is empty
// ---------------------------------------------------------------------------

#[test]
fn submit_price_accrues_owed_when_pool_empty() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let relayer = Address::generate(&e);
    let (token_addr, _sac) = create_token(&e, &admin);

    // Pool starts empty.
    let oracle = setup_oracle_with_pool(&e, &admin, &relayer, &token_addr, 0);

    let asset = Symbol::new(&e, "XLM_USDC");
    oracle.submit_price(&relayer, &asset, &1_000_000);

    assert_eq!(oracle.owed_fees(&relayer), FEE);
    assert_eq!(oracle.price(&asset), 1_000_000);
}

// ---------------------------------------------------------------------------
// Test 3 – full withdrawal after pool refill
// ---------------------------------------------------------------------------

#[test]
fn withdraw_relayer_fees_pays_full_owed_when_pool_refilled() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let relayer = Address::generate(&e);
    let (token_addr, sac) = create_token(&e, &admin);

    // Pool empty → submission accrues owed.
    let oracle = setup_oracle_with_pool(&e, &admin, &relayer, &token_addr, 0);
    let asset = Symbol::new(&e, "XLM_USDC");
    oracle.submit_price(&relayer, &asset, &500);
    assert_eq!(oracle.owed_fees(&relayer), FEE);

    // Top up the pool.
    sac.mint(&oracle.address, &(FEE * 2));

    let token = TokenClient::new(&e, &token_addr);
    let relayer_before = token.balance(&relayer);

    oracle.withdraw_relayer_fees(&relayer);

    assert_eq!(oracle.owed_fees(&relayer), 0);
    assert_eq!(token.balance(&relayer), relayer_before + FEE);
}

// ---------------------------------------------------------------------------
// Test 4 – partial withdrawal when pool is insufficient
// ---------------------------------------------------------------------------

#[test]
fn withdraw_relayer_fees_partial_when_pool_insufficient() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let relayer = Address::generate(&e);
    let (token_addr, sac) = create_token(&e, &admin);

    // Two submissions with empty pool → owed = 2 × FEE.
    let oracle = setup_oracle_with_pool(&e, &admin, &relayer, &token_addr, 0);
    let asset = Symbol::new(&e, "XLM_USDC");
    oracle.submit_price(&relayer, &asset, &100);
    oracle.submit_price(&relayer, &asset, &200);
    assert_eq!(oracle.owed_fees(&relayer), FEE * 2);

    // Top up only half.
    sac.mint(&oracle.address, &FEE);

    let token = TokenClient::new(&e, &token_addr);
    let relayer_before = token.balance(&relayer);

    oracle.withdraw_relayer_fees(&relayer);

    // Half paid, half still owed.
    assert_eq!(oracle.owed_fees(&relayer), FEE);
    assert_eq!(token.balance(&relayer), relayer_before + FEE);
}

// ---------------------------------------------------------------------------
// Test 5 – withdraw with nothing owed is a no-op
// ---------------------------------------------------------------------------

#[test]
fn withdraw_relayer_fees_noop_when_nothing_owed() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let relayer = Address::generate(&e);
    let (token_addr, _sac) = create_token(&e, &admin);

    let oracle = setup_oracle_with_pool(&e, &admin, &relayer, &token_addr, FEE);

    // Never submitted; owed is 0.
    oracle.withdraw_relayer_fees(&relayer);
    assert_eq!(oracle.owed_fees(&relayer), 0);
}

// ---------------------------------------------------------------------------
// Test 6 – unauthorised relayer panics
// ---------------------------------------------------------------------------

#[test]
#[should_panic(expected = "Unauthorized: not a relayer")]
fn submit_price_unauthorized_relayer_panics() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let attacker = Address::generate(&e);
    let (token_addr, _sac) = create_token(&e, &admin);

    let oracle_id = e.register(PriceOracle, (admin.clone(), token_addr.clone(), FEE));
    let oracle = PriceOracleClient::new(&e, &oracle_id);

    oracle.submit_price(&attacker, &Symbol::new(&e, "XLM_USDC"), &999);
}

// ---------------------------------------------------------------------------
// Test 7 – set_settlement_token restricted to admin
// ---------------------------------------------------------------------------

#[test]
#[should_panic]
fn set_settlement_token_only_admin() {
    let e = Env::default();

    let admin = Address::generate(&e);
    let non_admin = Address::generate(&e);
    let (token_addr, _sac) = create_token(&e, &admin);
    let (other_token, _) = create_token(&e, &admin);

    let oracle_id = e.register(PriceOracle, (admin.clone(), token_addr.clone(), FEE));
    let oracle = PriceOracleClient::new(&e, &oracle_id);

    // Authenticate only as non_admin – should panic because non_admin ≠ admin.
    e.mock_auths(&[MockAuth {
        address: &non_admin,
        invoke: &MockAuthInvoke {
            contract: &oracle_id,
            fn_name: "set_settlement_token",
            args: (&other_token,).into_val(&e),
            sub_invokes: &[],
        },
    }]);

    oracle.set_settlement_token(&other_token);
}

// ---------------------------------------------------------------------------
// Test 8 – multiple submissions accumulate correct fee
// ---------------------------------------------------------------------------

#[test]
fn multiple_submissions_accumulate_correct_fee() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let relayer = Address::generate(&e);
    let (token_addr, _sac) = create_token(&e, &admin);

    // Fund pool for 3 submissions.
    let oracle = setup_oracle_with_pool(&e, &admin, &relayer, &token_addr, FEE * 3);
    let token = TokenClient::new(&e, &token_addr);
    let oracle_id = oracle.address.clone();

    let asset = Symbol::new(&e, "XLM_USDC");
    oracle.submit_price(&relayer, &asset, &100);
    oracle.submit_price(&relayer, &asset, &200);
    oracle.submit_price(&relayer, &asset, &300);

    // Pool drained by 3 fees; relayer received 3 fees.
    assert_eq!(token.balance(&oracle_id), 0);
    assert_eq!(token.balance(&relayer), FEE * 3);
    assert_eq!(oracle.owed_fees(&relayer), 0);
    // Latest price is from the last submission.
    assert_eq!(oracle.price(&asset), 300);
}

// ---------------------------------------------------------------------------
// Test 9 – median helper
// ---------------------------------------------------------------------------

#[test]
fn median_helper_odd_and_even_lengths() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let (token_addr, _sac) = create_token(&e, &admin);
    let oracle_id = e.register(PriceOracle, (admin.clone(), token_addr.clone(), 0_i128));
    let oracle = PriceOracleClient::new(&e, &oracle_id);

    // Odd number of values: [10, 30, 20] → sorted [10, 20, 30] → median = 20
    let mut odd_map: Map<Address, i128> = Map::new(&e);
    let a1 = Address::generate(&e);
    let a2 = Address::generate(&e);
    let a3 = Address::generate(&e);
    odd_map.set(a1.clone(), 10_i128);
    odd_map.set(a2.clone(), 30_i128);
    odd_map.set(a3.clone(), 20_i128);
    assert_eq!(oracle.median(&odd_map), 20);

    // Even number of values: [10, 20, 30, 40] → median = (20+30)/2 = 25
    let mut even_map: Map<Address, i128> = Map::new(&e);
    let a4 = Address::generate(&e);
    even_map.set(a1, 10_i128);
    even_map.set(a2, 20_i128);
    even_map.set(a3, 30_i128);
    even_map.set(a4, 40_i128);
    assert_eq!(oracle.median(&even_map), 25);
}
