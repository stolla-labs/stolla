# Stolla

NFT-gated DAO voting platform for Stellar project communities.

## Features

- **Community NFT** — SEP-0050 membership tokens with IPFS metadata (OpenZeppelin `NonFungibleVotes`)
- **Governor** — On-chain proposals and voting (OpenZeppelin `stellar-governance`)
- **Web dashboard** — Wallet connect, mint, delegate, propose, vote (Next.js + Stellar Wallets Kit)

## Prerequisites

- Node.js 20+
- npm 11+

To build and deploy the contracts, you will also need:

- [Rust](https://www.rust-lang.org/tools/install)
- [Stellar CLI](https://developers.stellar.org/docs/tools/cli/install-cli)
- A Stellar-compatible wallet such as [Freighter](https://www.freighter.app/)

## Run locally

All npm commands must be run from the repository root. This project uses a
single root lockfile for the `apps/web` workspace.

### 1. Install dependencies

```bash
npm ci
```

### 2. Configure the web app

Create a local environment file:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Set the contract IDs in `apps/web/.env.local`:

```dotenv
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID=<community-factory-contract-id>
NEXT_PUBLIC_NFT_CONTRACT_ID=<community-nft-contract-id>
NEXT_PUBLIC_GOVERNOR_CONTRACT_ID=<governor-contract-id>
# Optional gateway used to resolve ipfs:// community metadata and logos.
NEXT_PUBLIC_IPFS_GATEWAY_URL=https://ipfs.io/ipfs/
# Lower ledger boundary for proposal event discovery (Governor deploy ledger).
# Example (testnet): NEXT_PUBLIC_GOVERNOR_START_LEDGER=1500000
NEXT_PUBLIC_GOVERNOR_START_LEDGER=<governor-deploy-ledger>
```

`NEXT_PUBLIC_GOVERNOR_START_LEDGER` must be a positive integer. Use the ledger
where the Governor contract was deployed (printed by the deploy script or
visible in a Stellar explorer). Missing, zero, negative, and non-integer values
fail with an actionable error when proposal discovery runs.

You can use an existing deployment or deploy your own contracts using the
instructions below.

### 3. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Run the mobile navigation smoke test

Install Chromium once, then run the Playwright suite:

```bash
npx playwright install chromium
npm run test:e2e
```

For CI, use the single-worker command:

```bash
npx playwright install --with-deps chromium
npm run test:e2e:ci
```

Playwright starts the web app on an isolated local port and stops both the
browser and server when the run completes. The smoke test does not require a
wallet extension or configured contracts.

## Contracts

Build and test both Soroban contracts from the repository root:

```bash
npm run build:contracts
npm run test:contracts
```

### Deploy contracts

Create a deployer identity and fund it:

```bash
stellar keys generate deployer --network testnet
./scripts/fund-testnet.sh deployer
```

Deploy both contracts:

```bash
./scripts/deploy-testnet.sh deployer
```

The deploy script builds the contracts, deploys them, and writes the resulting
contract IDs to `apps/web/.env.local`. Restart the development server after
deploying so Next.js picks up the new values.

## Deploy the web app

Import the repo on [Vercel](https://vercel.com/new).

Use the following project settings:

| Setting | Value |
|---------|-------|
| Framework Preset | Next.js |
| Root Directory | `.` (repository root) |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `apps/web/.next` |

These commands are already defined in the root `vercel.json`, so Vercel should
detect them automatically.

Do not configure `apps/web` as a separate Vercel root. Dependencies and the
lockfile are managed from the monorepo root so local development, CI, and
deployment use the same dependency graph.

Add these environment variables in the Vercel project settings:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_STELLAR_NETWORK` | `testnet` |
| `NEXT_PUBLIC_STELLAR_RPC_URL` | `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID` | From the factory deployment |
| `NEXT_PUBLIC_NFT_CONTRACT_ID` | From deploy script output |
| `NEXT_PUBLIC_GOVERNOR_CONTRACT_ID` | From deploy script output |
| `NEXT_PUBLIC_IPFS_GATEWAY_URL` | Public IPFS gateway ending in `/ipfs/` |

After the first production deployment, Vercel will redeploy automatically when
new commits are pushed to the production branch.

### Monitor production health

Set the repository Actions variable `PRODUCTION_HEALTH_URL` to the deployed
health endpoint, for example `https://stolla.example/api/health`. The
`Production health check` workflow requests it at minutes 17 and 47 of every
hour (UTC) with a 10-second timeout and read-only repository permissions.

The workflow can also be run manually from the Actions tab. Its optional
`health_url` input overrides the repository variable for that run, which can be
used to verify both healthy and intentionally failing endpoints. Network,
timeout, HTTP-status, and unhealthy-payload failures are reported separately.
URL credentials, query parameters, and fragments are omitted from logs.

## Useful commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Create a production web build |
| `npm run lint` | Run frontend linting |
| `npm run clean` | Remove generated Next.js and Turbopack state from the web workspace |
| `npm run typecheck` | Type-check the web workspace (`tsc --noEmit`) |
| `npm test` | Run frontend unit and production health-check tests |
| `npm run test:e2e` | Run the Playwright mobile navigation smoke test |
| `npm run test:e2e:ci` | Run Playwright with one CI worker |
| `npm run build:contracts` | Build the Soroban contracts |
| `npm run test:contracts` | Run the contract test suite |

Run `npm run clean` when stale development state causes Next.js or Turbopack
manifest/cache errors, then restart the development server. The command only
removes `apps/web/.next` and `apps/web/.turbo`; it preserves source and
environment files, dependencies, npm caches, and the root lockfile.

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

- [Proposal Metadata v1](docs/proposal-metadata-v1.md) defines the backwards-compatible Governor description envelope and fallback rules.

- [PRD](docs/prd.md)
- [Architecture](docs/architecture.md)
- [ADRs](docs/adr/)

## License

MIT
