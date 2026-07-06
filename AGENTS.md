# Stolla — Agent Guide

Stolla is an NFT-gated DAO voting platform for Stellar communities. Monorepo:

- `apps/web/` — Next.js dApp (see `apps/web/AGENTS.md`).
- `contracts/` — Soroban (Rust) smart contracts: `community-nft` + `community-governor`.
- `scripts/` — testnet deploy/fund helpers.

Standard commands live in the root `package.json` scripts and `README.md`; refer to those.

## Cursor Cloud specific instructions

The VM snapshot already has: Node 22, Rust (stable 1.85+, required by Soroban SDK 26) with the `wasm32v1-none` target, and the Stellar CLI (`stellar`, installed as a prebuilt binary on `PATH`). The startup update script only refreshes npm dependencies.

- **package-lock.json is macOS-only and breaks Linux installs.** The committed root `package-lock.json` was generated on macOS and only resolves `darwin-arm64` native binaries. On Linux a plain `npm install` silently skips `@tailwindcss/oxide-linux-x64-gnu` (and `lightningcss-linux-x64-gnu`), which makes `next build` / `next dev` crash with `Cannot find module './tailwindcss-oxide.linux-x64-gnu.node'`. The startup update script works around this by deleting `package-lock.json` and reinstalling so npm resolves the Linux binaries. Do **not** commit the Linux-regenerated `package-lock.json` — it would break Mac developers. Leave the committed lockfile untouched.

- **Web app runtime needs contract IDs.** The dApp reads `NEXT_PUBLIC_*` vars from `apps/web/.env.local` (git-ignored). Without it the app runs but shows "contracts not configured". Run `./scripts/deploy-testnet.sh <identity>` to deploy fresh contracts to testnet and auto-write `.env.local`, or hand-write the four `NEXT_PUBLIC_*` vars (see `README.md`). After changing `.env.local`, restart `npm run dev` (Next.js reads env at startup).

- **Contracts:** `npm run test:contracts` (`cargo test`) needs only Rust. `npm run build:contracts` needs the Stellar CLI + `wasm32v1-none` target and outputs to `contracts/target/wasm32v1-none/release/*.wasm`.

- **Web write actions require the Freighter browser extension (testnet), which cannot be installed in the cloud VM.** To exercise on-chain writes (mint, delegate, propose, vote), use the Stellar CLI; use the web UI to read/verify (the proposal detail page `/proposals/<idHex>` fetches live state by ID). Non-obvious CLI arg names: `mint --to <addr> --token_uri <uri>`; `delegate --account <addr> --delegatee <addr>`; `propose --targets '["G..."]' --functions '["noop"]' --args '[[]]' --description '"..."' --proposer <addr>`; `cast_vote --proposal_id <hex> --vote_type <u32> --reason '"..."' --voter <addr>` (vote_type: 1=For, 0=Against, 2=Abstain). Write calls need `--send=yes`.

- **Lint is pre-broken.** `npm run lint` currently fails on pre-existing errors in generated files under `apps/web/src/lib/bindings/*`. CI does not run lint (only build), so this failure is not introduced by your changes.
