# Stolla Contracts

Soroban smart contracts for NFT-gated community governance.

## Contracts

| Contract | Description |
|----------|-------------|
| `community-nft` | SEP-0050 NFT with `NonFungibleVotes` + per-token IPFS URI storage |
| `community-governor` | OpenZeppelin Governor wired to the NFT votes token |
| `community-treasury` | Community asset custody; only the configured Timelock can spend, subject to per-asset caps |

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

## FAQ: Membership Revocation & Burn (`community-nft`)

- **Can a community owner revoke or burn a member's NFT?**
  No. `community-nft` implements `NonFungibleToken` (`NonFungibleVotes`), `Votes`, and `Ownable`, and intentionally omits `NonFungibleBurnable` and owner-forced revocation to prevent unilateral mid-governance disenfranchisement. See [ADR-001](../docs/adr/001-nft-voting-model.md#membership-token-revocation-and-burn-policy-402) for the full audit decision and key-rotation workarounds.
