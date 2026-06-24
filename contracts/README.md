# Stolla Contracts

Soroban smart contracts for NFT-gated community governance.

## Contracts

| Contract | Description |
|----------|-------------|
| `community-nft` | SEP-0050 NFT with `NonFungibleVotes` + per-token IPFS URI storage |
| `community-governor` | OpenZeppelin Governor wired to the NFT votes token |

## Commands

```bash
# From repo root
npm run test:contracts
npm run build:contracts

# Or directly
cd contracts
cargo test
CARGO_TARGET_DIR=target stellar contract build
```

## Dependencies

- `soroban-sdk` 26.1.0
- OpenZeppelin Stellar Contracts 0.7.2 (`stellar-tokens`, `stellar-governance`, `stellar-access`)

## Deploy

See [`../scripts/deploy-testnet.sh`](../scripts/deploy-testnet.sh).
