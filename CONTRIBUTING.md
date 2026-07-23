# Contributing to Stolla

## Table of contents

- [Prerequisites](#prerequisites)
- [Repository structure](#repository-structure)
- [Frontend setup (Next.js)](#frontend-setup-nextjs)
- [Contract setup (Soroban / Rust)](#contract-setup-soroban--rust)
- [Available commands](#available-commands)
- [Known limitations](#known-limitations)
- [Making changes](#making-changes)
- [Pull request process](#pull-request-process)

## Prerequisites

| Tool | Version | Required for |
|------|---------|--------------|
| [Node.js](https://nodejs.org/) | ^20 | Web app |
| [npm](https://docs.npmjs.com/cli/) | ^11 | Dependency management |
| [Rust](https://www.rust-lang.org/tools/install) | stable (edition 2021) | Contract development |
| [Stellar CLI](https://developers.stellar.org/docs/tools/cli/install-cli) | latest | Contract build & deploy |
| [Freighter](https://www.freighter.app/) (browser extension) | latest | Local wallet interaction |

All npm commands **must be run from the repository root** unless noted otherwise.
This project uses a root lockfile for the `apps/web` workspace (see [`.npmrc`](.npmrc)).

## Repository structure

```
stolla/
├── apps/web/           # Next.js dApp (TypeScript)
├── contracts/          # Soroban smart contracts (Rust)
│   ├── contracts/
│   │   ├── community-nft/
│   │   └── community-governor/
│   ├── Cargo.toml      # Rust workspace
│   └── README.md
├── docs/               # PRD, architecture, ADRs
├── scripts/            # Deploy and funding helpers
├── .github/
│   └── workflows/
│       └── ci.yml      # CI configuration
└── package.json        # Root workspace config
```

## Frontend setup (Next.js)

### 1. Install dependencies

```bash
npm ci
```

> **Note:** Some environments may require `npm ci` to resolve optional native
> dependencies for Tailwind CSS v4 and LightningCSS. See
> [Known limitations](#known-limitations).

### 2. Configure environment variables

Create a local environment file:

```bash
cp apps/web/.env.example apps/web/.env.local
```

> **Caution:** The `.env.example` file does not yet exist in the repository.
> Create it manually with the following content:

```dotenv
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_NFT_CONTRACT_ID=<community-nft-contract-id>
NEXT_PUBLIC_GOVERNOR_CONTRACT_ID=<governor-contract-id>
```

You can use an existing deployment or deploy your own contracts (see
[Contract setup](#contract-setup-soroban--rust)).

### 3. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Contract setup (Soroban / Rust)

### 1. Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 2. Install the Stellar CLI

```bash
cargo install --locked stellar-cli --features opt
```

### 3. Build and test

```bash
# From the repository root
npm run build:contracts
npm run test:contracts
```

Or from the `contracts/` directory directly:

```bash
cd contracts
CARGO_TARGET_DIR=target stellar contract build
cargo test
```

### Deploy to testnet

```bash
stellar keys generate deployer --network testnet
./scripts/fund-testnet.sh deployer
./scripts/deploy-testnet.sh deployer
```

The deploy script writes contract IDs to `apps/web/.env.local`. Restart the
development server afterward.

## Available commands

All commands below are run from the repository root unless a different directory
is specified.

| Command | Directory | Description |
|---------|-----------|-------------|
| `npm ci` | root | Install all dependencies |
| `npm run dev` | root | Start Next.js development server |
| `npm run build` | root | Create a production web build |
| `npm run lint` | root | Run frontend ESLint |
| `npm run build:contracts` | root | Build both Soroban contracts |
| `npm run test:contracts` | root | Run contract test suite |
| `cd contracts && cargo test` | `contracts/` | Run contract tests directly |
| `cd contracts && CARGO_TARGET_DIR=target stellar contract build` | `contracts/` | Build contracts directly |
| `npm run start` | root | Start Next.js production server (after `npm run build`) |

## Known limitations

- **`.env.example` is missing.** The file referenced in the README setup
  instructions (`apps/web/.env.example`) does not yet exist. Create it manually
  with the content shown in the [setup section](#frontend-setup-nextjs).

- **Optional native dependencies may fail.** Tailwind CSS v4 and LightningCSS
  ship platform-specific native binaries. If `npm run build` fails with a
  `Cannot find native binding` error, run `npm ci` (not `npm install`) to
  ensure optional dependencies are installed correctly. This is a known npm
  issue (npm/cli#4828).

- **Lint warnings exist.** Running `npm run lint` reports pre-existing warnings
  about `setState` calls within `useEffect` on the community and proposal
  detail pages. These are not introduced by new contributions and are tracked
  separately.

- **Rust / Stellar CLI are separate installs.** The Rust toolchain and
  `stellar-cli` binary are not managed by npm. See
  [Contract setup](#contract-setup-soroban--rust) for installation steps.

- **No typecheck script.** There is no dedicated `tsc` script in
  `package.json`. TypeScript errors are surfaced during `npm run build`.

## Making changes

### Focus your changes

- Keep pull requests scoped to a single concern (bug fix, feature, docs,
  refactor). If a change touches both contracts and the frontend, consider
  splitting it into separate PRs.
- Run `npm run lint` and `npm run build` before opening a PR to catch
  TypeScript and ESLint issues early.

### Include test evidence

- **Contract changes:** Add or update Rust unit tests in the relevant
  `src/test.rs`. Verify with `npm run test:contracts`.
- **Frontend changes:** Verify manually that the affected routes render
  correctly. There is no frontend test suite yet; manual smoke testing is
  sufficient.

### UI changes

- Include before/after screenshots in the PR description.
- Test at mobile and desktop viewport widths.
- Verify dark theme rendering (the app uses a dark color scheme).

### Link issues

- Every PR should reference at least one issue.
- Use `Closes #N` in the PR description to auto-close the issue on merge.

## Pull request process

1. Create a feature branch from `main`.
2. Make your changes following the guidance above.
3. Run the verification commands listed in [Available commands](#available-commands).
4. Open a pull request using [the template](.github/PULL_REQUEST_TEMPLATE.md).
5. Ensure CI checks pass (contract tests + frontend build).
6. Request review from a maintainer.
