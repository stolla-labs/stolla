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
# Or run ./scripts/deploy-testnet.sh deployer — it writes .env.local automatically
```

### 4. Run the web app locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Deploy web app (Vercel)

Import the repo on [Vercel](https://vercel.com/new).

Keep **Root Directory** at the repository root. The root `vercel.json` installs
the workspace from the single root lockfile and builds `apps/web`.

Do not configure `apps/web` as a separate Vercel root. Dependencies and the
lockfile are managed from the monorepo root so local development, CI, and
deployment use the same dependency graph.

Add these environment variables in the Vercel project settings:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_STELLAR_NETWORK` | `testnet` |
| `NEXT_PUBLIC_STELLAR_RPC_URL` | `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_NFT_CONTRACT_ID` | From deploy script output |
| `NEXT_PUBLIC_GOVERNOR_CONTRACT_ID` | From deploy script output |

Current testnet deployment (2026-06-24):

- NFT: `CDEBV3G52J3H2HBSORUTWFNLSSL57X75UAPKYAQBHFSFOIHF46A7UCFK`
- Governor: `CAHM2MNNRYMS4AMFLDBQYJKPAYQZS24JT2HZRP4NBGFODQ2DPXRYEUOE`
- Deployer: `GCA6ODTDT6MYMO4HHW7EP25KCQFK2OCN3S3ETO4WSGVBMBY3DYBSPIDR`

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
