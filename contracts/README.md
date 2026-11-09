# Stolla Contracts

Soroban smart contracts for NFT-gated community governance.

## Contracts

| Contract | Description |
|----------|-------------|
| `community-nft` | SEP-0050 NFT with `NonFungibleVotes` + per-token IPFS URI storage (mint-only; no owner revoke/burn — see [ADR-001](../docs/adr/001-nft-voting-model.md)) |
| `community-governor` | OpenZeppelin Governor wired to the NFT votes token |
| `community-treasury` | Community asset custody; only the configured Timelock can spend, subject to per-asset caps |

## Membership revocation and burn policy (`community-nft`)

`CommunityNft` intentionally does **not** implement `NonFungibleBurnable` or
expose an owner-only `revoke` function:

- Minting (`mint(to, token_uri)`) is gated by `#[only_owner]`, but once minted,
  token ownership and delegated voting units are controlled solely by the token
  holder via SEP-0050 (`transfer`, `approve`) and OpenZeppelin `Votes`
  (`delegate`).
- Unilateral owner burn is excluded so a single `CommunityOwner` key cannot
  censor voters immediately before a proposal snapshot ledger.
- See [ADR-001](../docs/adr/001-nft-voting-model.md) for the documented
  operational workarounds when a member wallet is rotated or compromised.

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
