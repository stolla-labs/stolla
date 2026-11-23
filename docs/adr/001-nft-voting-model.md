# ADR-001: NFT Voting Model

## Status

Accepted

## Context

Stolla communities gate DAO voting by NFT ownership. We need a model that is simple, resistant to flash-loan manipulation, and compatible with Soroban governance libraries.

## Decision

- **1 NFT = 1 voting unit** via OpenZeppelin `NonFungibleVotes`
- Holders must call `delegate(self)` before votes count (OZ Votes requirement)
- Voting power is read at proposal snapshot ledger (Governor default)
- MVP uses a single community: one NFT contract linked to one Governor contract

## Consequences

- Transfers move voting units to the recipient's delegate
- Members who forget to delegate cannot vote until they delegate
- Factory-based multi-community support is deferred to a later iteration

## Membership removal decision

The current `community_nft` does **not** support owner burn or revoke. Its
contract interface exposes owner-only `mint`, but no burn or revoke entry point.
The inherited NFT `transfer` requires authorization from the token holder;
`transfer_from` requires an approved spender or operator. Owning the
collection alone does not authorize either call. Since membership is voting
power, the dashboard must not offer an owner revoke action that this contract
cannot execute. Owner revoke UI is unsupported for this contract version.

If a member still controls their token, they can transfer it to a safe address
and delegate again. If an owner needs to exclude a token whose holder will not
cooperate, there is no immediate per-token workaround in this version. The
community must use a separately reviewed, authorized contract upgrade or
governance migration plan that accounts for the existing Governor, token
balances, and proposal snapshots. Creating another community does not remove
the token or its voting power from the original Governor. For an active
compromise, follow the proposer/member response in
[ADR-006](006-timelock-treasury-execution.md#emergency-and-compromise-scenarios).
