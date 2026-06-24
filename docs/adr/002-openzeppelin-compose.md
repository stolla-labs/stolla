# ADR-002: OpenZeppelin Compose Strategy

## Status

Accepted

## Context

Building NFT + governance from scratch is error-prone. OpenZeppelin Stellar Contracts provide audited patterns for SEP-0050 NFTs and Governor modules.

## Decision

Pin OpenZeppelin crates at **0.7.2** and compose:

| Crate | Usage |
|-------|-------|
| `stellar-tokens` | `NonFungibleVotes` as `ContractType` for community NFT |
| `stellar-governance` | `Votes` trait on NFT; `Governor` trait on governor contract |
| `stellar-access` | `Ownable` for owner-only mint |
| `stellar-macros` | `#[only_owner]` on mint |

Reference implementations: OZ `fungible-governor` and `nft-sequential-minting` examples.

SDK alignment: `soroban-sdk = "26.1.0"` to match OZ 0.7.1.

## Consequences

- Library is experimental; testnet only until audit
- Governor `execute` / `cancel` must be implemented by integrator (open execute, proposer-only cancel)
- Version bumps require coordinated testing across contracts
