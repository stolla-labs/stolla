# Stolla

NFT-gated DAO voting platform for Stellar project communities.

## Features

- **Community NFT** — SEP-0050 membership tokens with IPFS metadata (OpenZeppelin `NonFungibleVotes`)
- **Governor** — On-chain proposals and voting (OpenZeppelin `stellar-governance`)
- **Web dashboard** — Wallet connect, mint, delegate, propose, vote (Next.js + Stellar Wallets Kit)

## Prerequisites

- [Stellar CLI](https://developers.stellar.org/docs/tools/cli/install-cli)
- Rust toolchain
- Node.js 20+
- Freighter wallet (testnet)

## Quickstart

### 1. Install dependencies

```bash
npm install
```

### 2. Build and test contracts

```bash
npm run build:contracts
npm run test:contracts
```

### 3. Deploy to testnet

Create a deployer identity and fund it:

```bash
stellar keys generate deployer --network testnet
./scripts/fund-testnet.sh deployer
```

Deploy contracts and write env vars:

```bash
./scripts/deploy-testnet.sh deployer
```

Copy generated values to `apps/web/.env.local`:

```bash
cp apps/web/.env.example apps/web/.env.local
# Edit with contract IDs from deploy output
```

### 4. Run the web app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## End-to-end flow

1. Connect Freighter on testnet
2. **Community owner** mints NFT to a member with an IPFS metadata URI
3. **Member** delegates voting power to themselves
4. **Proposer** creates a proposal (needs delegated NFT voting power)
5. **Member** casts a vote on the proposal detail page

## Project structure

```
stolla/
├── apps/web/           # Next.js dApp
├── contracts/          # Soroban smart contracts
├── docs/               # PRD, architecture, ADRs
└── scripts/            # Deploy and funding helpers
```

## Documentation

- [PRD](docs/prd.md)
- [Architecture](docs/architecture.md)
- [ADRs](docs/adr/)

## License

MIT
