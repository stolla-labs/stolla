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
