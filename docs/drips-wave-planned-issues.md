# Drips Wave Program — Planned Issues

## Types of work we post

Stolla is an NFT-gated DAO platform on Stellar/Soroban. We scope issues so contributors can pick up meaningful, reviewable work in a single sprint cycle. Each issue has clear acceptance criteria, links to relevant docs/ADRs, and a suggested skill label (contracts, frontend, docs, etc.).

### Smart contracts (Soroban / Rust)

Work on `community_nft` and `community_governor`: new governance parameters, proposal lifecycle improvements, on-chain execution paths, factory patterns for multi-community deployment, and OpenZeppelin Stellar integration upgrades. Issues include unit tests and CI green before merge.

### Frontend & dApp (Next.js / TypeScript)

Wallet connect flows (Stellar Wallets Kit), mint/delegate/propose/vote UI, proposal list and detail pages, transaction simulation and submission via Soroban RPC, loading/error states, and responsive layout across landing and app routes.

### Integration & infrastructure

IPFS metadata handling, contract binding generation, deploy scripts, env/config wiring, RPC polling and state refresh, and CI pipelines for contracts and the web app.

### Testing & quality

Contract unit and integration tests, frontend smoke paths for core flows (mint → delegate → propose → vote), regression fixes for wallet and ledger edge cases, and accessibility checks on public pages.

### Documentation

README and quickstart updates, architecture and ADR additions, contributor onboarding (local setup, deploy to testnet), and inline code comments where behavior is non-obvious.

### Bug fixes & polish

Targeted fixes for delegation, voting power snapshots, failed transactions, and UI inconsistencies. Small UX improvements with before/after criteria, not open-ended redesigns.

### Security & hardening

Owner-only mint enforcement, delegation and snapshot correctness, input validation on contract calls and forms, and prep work aligned with testnet → mainnet readiness (without expanding scope beyond the issue).

## How we label issues

We label issues by difficulty (`good first issue`, `help wanted`, `sprint-sized`) and tie each to a user story from our PRD so contributors always know why the work matters and how to verify it.
