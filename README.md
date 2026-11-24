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
# Server-only Pinata JWT. The app pins community, collection, and token
# metadata through /api/ipfs/pin so creators never paste URIs. Never expose
# it with a NEXT_PUBLIC_ prefix.
PINATA_JWT=<pinata-jwt>
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

Deploy the contracts to testnet:

```bash
./scripts/deploy-testnet.sh deployer
```

The deploy script:
1. Builds all contracts (`community_nft`, `community_governor`, and `community_factory`).
2. Uploads approved `community_nft.wasm` and `community_governor.wasm` to testnet.
3. Deploys `CommunityFactory` initialized with the approved WASM hashes and deployer owner.
4. Deploys default `community_nft` and `community_governor` instances for fallback routes.
5. Captures the deployment ledger sequence from the Soroban RPC.
6. Preserves unrelated variables in `apps/web/.env.local` while updating the testnet configuration:
   - `NEXT_PUBLIC_STELLAR_NETWORK=testnet`
   - `NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org`
   - `NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID`
   - `NEXT_PUBLIC_NFT_CONTRACT_ID`
   - `NEXT_PUBLIC_GOVERNOR_CONTRACT_ID`
   - `NEXT_PUBLIC_GOVERNOR_START_LEDGER`
7. Displays a summary containing all contract IDs, WASM hashes, deployment ledger, and Stellar Expert explorer links.

To preview or test command construction without broadcasting transactions:

```bash
./scripts/deploy-testnet.sh deployer --dry-run
```

Restart the development server after deploying so Next.js picks up the new values.

To rotate the approved NFT/Governor WASM hashes on an existing factory (dry-run by default), see the [factory WASM rotation runbook](docs/factory-wasm-rotation-runbook.md).

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
| `NEXT_PUBLIC_GOVERNOR_START_LEDGER` | Governor deploy ledger from deploy script output |
| `NEXT_PUBLIC_IPFS_GATEWAY_URL` | Public IPFS gateway ending in `/ipfs/` |
| `PINATA_JWT` | Server-only Pinata JWT used by `/api/ipfs/pin` (required for create and mint) |
| `NEXT_PUBLIC_ALLOW_MAINNET_WRITES` | `true` only after the testnet-to-mainnet runbook. Default off. Mainnet create, mint, and propose stay disabled until this is set. Testnet is unchanged. |
| `NEXT_PUBLIC_PERMISSIONLESS_CREATE` | Pilot flag, default off, ignored on mainnet. `true` lets any connected wallet create a community from the web app. Set it only when the deployed factory accepts non-owner creators. See ADR-005 addendum. |

After the first production deployment, Vercel will redeploy automatically when
new commits are pushed to the production branch.

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

## Continuous Integration (CI)

GitHub Actions (`.github/workflows/ci.yml`) runs on `push` to `main`/`master`,
on `pull_request`, and via manual `workflow_dispatch`:

- **contracts (required):** Installs the pinned official prebuilt Stellar CLI
  (`stellar/stellar-cli@v30.0.1`, no `cargo install` / dbus build), runs
  `cargo test`, then `CARGO_TARGET_DIR=target stellar contract build`.
- **frontend (required):** Rejects a nested `apps/web/package-lock.json`, runs
  `npm ci`, `npm run check:workspace`, `npm run lint`,
  `npm run typecheck --workspace=web`, `npm run test --workspace=web`, the
  production-health and factory WASM rotation script tests, and a production
  Next.js build.
- **e2e (advisory):** Installs Playwright Chromium and runs
  `npm run test:e2e:ci --workspace=web`. Marked `continue-on-error: true` while
  browser-level E2E hardening is tracked in #265 and #395.

### Local equivalents

Install [Rust](https://www.rustup.rs/) and the
[Stellar CLI](https://developers.stellar.org/docs/tools/cli/install-cli)
(prefer the install script or Homebrew so you get a prebuilt binary), then from
the repository root:

```bash
# Contracts job
npm run test:contracts
npm run build:contracts

# Frontend job
npm ci
npm run check:workspace
npm run lint
npm run typecheck --workspace=web
npm run test --workspace=web
node --test scripts/check-production-health.test.mjs
node --test scripts/rotate-factory-wasm.test.mjs
NEXT_PUBLIC_STELLAR_NETWORK=testnet \
  NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org \
  npm run build --workspace=web

# E2E job (advisory in CI)
npx --workspace=web playwright install --with-deps chromium
npm run test:e2e:ci --workspace=web
```

## End-to-end flow

1. Connect Freighter on testnet
2. **Community owner** mints an NFT to a member by entering a name, description, and optional image (Stolla pins the metadata to IPFS)
3. **Member** delegates voting power to themselves
4. **Proposer** creates a proposal (needs delegated NFT voting power)
5. **Member** casts a vote on the proposal detail page

## Membership FAQ

**Can a community owner revoke or burn a member's NFT?** No. The current
`community_nft` has no owner burn/revoke function. A collection owner also
cannot transfer a member's token without the member's authorization or an
approval that member granted. If the member controls the token, they can move
it to a safe wallet and delegate again. Removing an uncooperative or
compromised member requires a separately reviewed contract upgrade or
governance migration; the existing Governor continues to count the token until
such a change takes effect. See [ADR-001](docs/adr/001-nft-voting-model.md#membership-removal-decision)
for the contract decision and incident guidance.

## Project structure

```
stolla/
├── apps/web/           # Next.js dApp
├── contracts/          # Soroban smart contracts
├── docs/               # PRD, architecture, ADRs
└── scripts/            # Deploy and funding helpers
```

## Documentation

- [Seven-day community launch playbook](docs/growth-launch-playbook.md) sequences creation, membership, delegation, the first proposal, alerts, and launch review for contributors.

- [ADR-003: IPFS Metadata](docs/adr/003-ipfs-metadata.md) explains upload-first metadata. Stolla pins through `/api/ipfs/pin` with the server-only `PINATA_JWT`, so users never paste URIs.

- [Proposal Metadata v1](docs/proposal-metadata-v1.md) defines the backwards-compatible Governor description envelope and fallback rules.

- [PRD](docs/prd.md)
- [Architecture](docs/architecture.md)
- [ADRs](docs/adr/)

## License

MIT
