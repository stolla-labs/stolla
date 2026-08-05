---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - docs/prd.md
  - docs/adr/001-nft-voting-model.md
  - docs/adr/002-openzeppelin-compose.md
  - docs/adr/003-ipfs-metadata.md
  - docs/adr/004-proposal-discovery.md
  - docs/adr/005-community-factory-registry.md
workflowType: architecture
project_name: Stolla
date: 2026-06-24
---

# Stolla Architecture

## System Overview

Stolla is a monorepo with Soroban smart contracts and a Next.js dApp. MVP deploys one community NFT collection and one Governor on Stellar testnet.

```mermaid
flowchart TB
    subgraph web [apps/web]
        Pages[Next.js Pages]
        Wallet[WalletsKit Provider]
        SDK[Stellar SDK + RPC]
    end

    subgraph chain [contracts]
        Factory[community_factory]
        NFT[community_nft]
        Gov[community_governor]
    end

    Pages --> Wallet
    Pages --> SDK
    SDK --> Factory
    SDK --> NFT
    SDK --> Gov
    Factory -->|"deploy + register"| NFT
    Factory -->|"deploy + register"| Gov
    Gov -->|"get_votes token"| NFT
```

## Contract Architecture

### community_nft

OpenZeppelin `NonFungibleVotes` + `Votes` + `Ownable`.

| Function | Auth | Description |
|----------|------|-------------|
| `__constructor(uri, name, symbol, owner)` | — | Set collection metadata and owner |
| `mint(to, token_uri)` | owner | Sequential mint + store IPFS URI |
| `custom_token_uri(token_id)` | — | Read per-token metadata URI |
| `delegate(delegatee)` | holder | Delegate voting power |
| `transfer` / `balance` / `owner_of` | — | SEP-0050 via trait |

### community_governor

OpenZeppelin `Governor` trait implementation (pattern from `fungible-governor`).

| Function | Auth | Description |
|----------|------|-------------|
| `__constructor(token, delay, period, threshold, quorum)` | — | Wire NFT as votes token |
| `propose(targets, values, calldata, description)` | proposer | Create proposal |
| `cast_vote(proposal_id, voter, support)` | voter | Cast For/Against/Abstain |
| `state(proposal_id)` | — | Read proposal state |
| `execute(...)` | executor | Open execution after success |
| `cancel(...)` | proposer | Proposer-only cancel |

MVP proposals use empty targets (signaling votes only).

### community_factory

The factory deploys deterministic NFT/Governor pairs from owner-approved WASM
hashes and stores an append-only, paginated registry. Creation and registration
occur in one atomic Soroban invocation. See the
[contract API](../contracts/contracts/community-factory/README.md), the
[metadata and governance schema](community-metadata-governance-schema.md), and
[ADR-005](adr/005-community-factory-registry.md).

### Deploy Order

1. Upload approved `community_nft` and `community_governor` WASM.
2. Deploy `community_factory` with the owner and both WASM hashes.
3. Call `create_community`; the factory atomically deploys and registers the
   initialized pair.
4. Discover contract IDs through `get_community` or `list_communities`.

## Frontend Architecture

### Stack

- Next.js 15 App Router, TypeScript, Tailwind CSS
- `@stellar/stellar-sdk` for RPC simulation and submission
- `@creit.tech/stellar-wallets-kit` for Freighter

### Routes

| Route | Purpose |
|-------|---------|
| `/` | Marketing landing (professional light; see `docs/landing-page.md`) |
| `/community` | Collection info, mint form (IPFS URI) |
| `/proposals` | Proposal list |
| `/proposals/[id]` | Vote, delegate, proposal detail |

Landing and app use separate layouts: landing has section-anchor nav; app pages show wallet connect and app navigation.

### Transaction Flow

1. Simulate contract invocation via Soroban RPC
2. Build transaction with Freighter
3. Poll `getTransaction` until success/failure
4. Refresh UI state from RPC read calls

### Config (`lib/stellar.ts`)

```typescript
export const config = {
  rpcUrl: process.env.NEXT_PUBLIC_STELLAR_RPC_URL,
  networkPassphrase: Networks.TESTNET,
  nftContractId: process.env.NEXT_PUBLIC_NFT_CONTRACT_ID,
  governorContractId: process.env.NEXT_PUBLIC_GOVERNOR_CONTRACT_ID,
};
```

## Storage Model (NFT)

| Key | Type | Description |
|-----|------|-------------|
| `Owner` | Address | Mint authority |
| `TokenUri(token_id)` | String | IPFS metadata URI per token |

See [Contract storage and TTL policy](contract-storage-lifecycle.md) for the
complete NFT/Governor inventory, renewal window, and intentional expiry rules.

## Security Considerations

- Owner-only mint (`#[only_owner]`)
- Delegation required before voting power counts
- Governor snapshot prevents flash-loan voting
- Testnet only; OZ library marked experimental
- No timelock in MVP — proposals are signaling only

## Future Extensions

- `CommunityFactory` and registry for multi-community deployment
  ([ADR-005](adr/005-community-factory-registry.md))
- A reviewed creator-policy upgrade for permissionless community creation
- Timelock + on-chain execution
- Public proposal discovery from Stellar RPC events
- Persistent event indexer for long-lived proposal history
- IPFS upload helper in frontend
