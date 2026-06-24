# Stolla MVP — Product Requirements

## Summary

Stolla lets Stellar projects launch a community with an NFT membership collection and on-chain DAO voting. NFT holders receive one vote per token after delegating to themselves.

## Target Users

- **Project creators** — deploy a community NFT collection and governance contract on testnet
- **Community members** — mint or receive NFTs, delegate voting power, vote on proposals

## MVP Scope (v0.1)

| In scope | Out of scope |
|----------|--------------|
| Single community instance (1 NFT + 1 Governor) | Multi-community factory |
| Owner-only NFT mint with IPFS metadata URI | Marketplace / secondary sales |
| OpenZeppelin Governor + NonFungibleVotes | Timelock, treasury execution |
| Testnet deployment | Mainnet |
| Next.js dashboard (wallet, mint, vote) | Mobile app |

## User Stories

1. As a **creator**, I deploy NFT and Governor contracts and mint member NFTs with an IPFS metadata URI.
2. As a **member**, I connect my wallet, delegate voting power to myself, and cast votes on proposals.
3. As a **creator**, I create proposals that members can vote on.
4. As any user, I view proposal status and vote counts via the web UI.

## Acceptance Criteria

- Contracts compile and pass unit tests on CI
- Frontend builds and connects Freighter on testnet
- End-to-end flow works: mint → delegate → propose → vote
- NFT metadata resolves via IPFS URI (manual URI input accepted in MVP)

## Governance Parameters (testnet defaults)

| Parameter | Value |
|-----------|-------|
| Voting delay | 1 ledger |
| Voting period | 10_000 ledgers |
| Proposal threshold | 1 vote |
| Quorum | 1 vote |

## Success Metrics

- One successful testnet deployment documented in README
- All core flows executable from the web UI
