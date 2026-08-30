# Stolla Next Sprint Issue Plan

This manifest is the reviewed source for the new GitHub backlog. H1–H10 are cross-cutting consolidation issues and N1–N10 are focused product issues.

## Merge order and PRD coverage

Issues in the same wave may run in parallel only when they do not edit the same files. Every PR must start from the latest `main`; later-wave PRs must rebase after their dependencies merge.

| Wave | Issue | Depends on | PRD alignment |
|---|---|---|---|
| 0: restore the baseline | H6 | — | NFR-1, NFR-6 |
| 0: restore the baseline | H8 | — | FR-3, FR-4, FR-11; UJ-1–UJ-3 |
| 0: restore the baseline | N9 | — | NFR-1 |
| 1: canonical foundation | H2 | H6 | FR-2; UJ-1–UJ-4 |
| 1: canonical foundation | H4 | H2, H8 | FR-3; UJ-2–UJ-3 |
| 1: canonical foundation | H1 | H2 | FR-1; UJ-1–UJ-4 |
| 2: remove duplicates | H3 | H1, H2, H4 | FR-4–FR-6; UJ-1 |
| 2: remove duplicates | H10 | H2, H4, H6 | FR-9; UJ-3–UJ-4 |
| 3: shared product language | H5 | H1, H4, H10 | FR-7, FR-9, FR-11; UJ-1–UJ-4 |
| 3: shared product language | H7 | H1, H4 | FR-6, FR-11; UJ-1–UJ-3 |
| 3: shared product language | H9 | H10 | FR-10; UJ-3 |
| 4: creator outcomes | N1 | H3, H8 | FR-4; UJ-1 |
| 4: creator outcomes | N2 | H3 | FR-5; UJ-1 |
| 4: creator outcomes | N3 | H2, H8 | FR-4, FR-6; UJ-1 |
| 4: creator outcomes | N4 | H2, H8, N3 | FR-2, FR-6; UJ-1, UJ-4 |
| 4: creator outcomes | N7 | H1, H3, H7 | FR-6; UJ-1 |
| 5: member outcomes | N5 | H4, H5 | FR-8; UJ-2 |
| 5: member outcomes | N8 | H5, H10 | FR-9; UJ-3–UJ-4 |
| 5: member outcomes | N6 | H4, H10, N8 | FR-7; UJ-2–UJ-4 |
| Independent decision | N10 | — | Non-goals, Open Question 3 |

## H1 — Canonicalize all community navigation under `/communities`

### Problem

The app currently owns behavior in three route families: `/communities/**`, `/community/**`, and `/proposals/**`. Users can enter different implementations of the same product journey, and contributors must update multiple route trees.

### Scope

Use `/communities`, `/communities/create`, `/communities/[id]`, `/communities/[id]/proposals`, and `/communities/[id]/proposals/[proposalId]` as canonical destinations. Convert singular and global legacy pages into thin redirects that preserve relevant query parameters. Update all internal links, breadcrumbs, navigation, component tests, route tests, E2E specs, and current docs.

### Mechanical recipe

1. Add one route-builder module with typed helpers.
2. Replace hard-coded community/proposal paths with those helpers.
3. Replace legacy page bodies with redirects.
4. Update test expectations and documentation links.

### Acceptance criteria

- No production component hard-codes a primary `/community` or global `/proposals` destination.
- Legacy URLs redirect to the equivalent canonical URL without losing identifiers or query parameters.
- Canonical route tests and Playwright navigation flows pass.

### Verification

`npm run lint && npm run typecheck && npm test && npm run test:e2e:ci`

## H2 — Consolidate the three community registry models into one adapter

### Problem

Production code currently has on-chain, environment JSON, and hard-coded community registry models in `lib/community`, `lib/communities`, and `lib/registry.ts`. The same Community can have incompatible shapes depending on the route.

### Scope

Define one typed `CommunityRegistry` adapter backed by CommunityFactory for production and injected fixtures for tests. Migrate pages, hooks, cards, switchers, metadata loaders, fixtures, unit tests, and E2E registry mocks. Remove production reads from `NEXT_PUBLIC_COMMUNITIES_JSON` and the hard-coded demo registry.

### Mechanical recipe

1. Choose the existing on-chain registry type as the canonical base.
2. Add compatibility mappers at the boundary.
3. Update imports file by file without redesigning UI.
4. Delete superseded registry code after all consumers move.

### Acceptance criteria

- Production has exactly one Community type and registry interface.
- Metadata failure preserves contract IDs and registry identity.
- Tests inject deterministic fixture adapters and never hit RPC.

### Verification

`npm run lint && npm run typecheck && npm test`

## H3 — Retire the duplicate community creation wizard

### Problem

Two creation paths and two wizard implementations coexist. Draft persistence, restart, network guard, fee simulation, deployment recovery, and success behavior can diverge.

### Scope

Make `/communities/create` the only implementation. Move reusable steps and state into one wizard module, redirect `/community/new`, migrate tests and E2E fixtures, and update all creation entry points and docs. Preserve every currently implemented recovery behavior.

### Mechanical recipe

1. Inventory both wizard state shapes and keep the superset.
2. Move existing behaviors without copy rewrites.
3. Point all entry links and tests to the canonical wizard.
4. Delete the duplicate implementation and dead fixtures.

### Acceptance criteria

- One creation state machine owns metadata, governance, review, deployment, recovery, and success.
- Draft, discard, account-change, network-change, expired-transaction, fee, and registry-verification tests remain covered.
- `/community/new` redirects to `/communities/create`.

### Verification

`npm run lint && npm run typecheck && npm test && npm run test:e2e:ci`

## H4 — Introduce a shared community route context for contract-scoped actions

### Problem

Some pages use Community-specific NFT and Governor contract IDs while older hooks and actions still read global environment IDs. This can send reads or writes to the wrong Community.

### Scope

Create a `CommunityRouteContext` containing the registry ID, NFT contract ID, Governor contract ID, metadata state, and active network. Migrate Community pages, proposal pages, mint/delegate/propose/vote hooks, transaction clients, component tests, and fixtures to consume it explicitly.

### Mechanical recipe

1. Add a small typed context/provider with no new dependency.
2. Thread it through canonical route layouts.
3. Replace global contract reads in scoped consumers.
4. Update mocks with a shared context fixture.

### Acceptance criteria

- Every Community-scoped transaction uses contract IDs from the selected Community.
- Missing Community context produces an explicit unavailable state, never a global fallback.
- Switching fixture context changes all related reads and writes in tests.

### Verification

`npm run lint && npm run typecheck && npm test`

## H5 — Standardize async states across community and proposal screens

### Problem

Loading, empty, retryable error, stale data, partial failure, and unavailable states use inconsistent markup and wording across routes and components.

### Scope

Add small shared `AsyncState`, `EmptyState`, `ErrorState`, and `FreshnessNotice` primitives. Apply them to Community list/detail, creation, Proposal list/detail, voting power, metadata, registry, and transaction-adjacent reads. Update component and page tests for consistent roles and retry behavior.

### Mechanical recipe

1. Implement the four primitives using current design tokens.
2. Replace local state blocks without changing data-fetching logic.
3. Use existing error mapping and retry callbacks.
4. Update assertions to semantic roles and shared copy.

### Acceptance criteria

- Applicable screens distinguish loading, empty, stale, retryable error, and success.
- Partial Proposal failures do not hide successful items.
- Status regions are accessible and do not announce decorative content.

### Verification

`npm run lint && npm run typecheck && npm test`

## H6 — Consolidate Stellar test support and repair the frontend test baseline

### Problem

Tests use page-local RPC, wallet, registry, transaction, NFT, and Governor mocks alongside `src/test-support`. Mock drift currently causes missing exports, missing dependencies, empty suites, and 29 failing tests.

### Scope

Make `src/test-support/stellar` the canonical test API. Migrate page, component, hook, and library tests to its builders; add the missing user-event dev dependency; replace empty test files with real smoke assertions or remove them from discovery; fix current mock export drift without changing production behavior.

### Mechanical recipe

1. Export stable builders for network, registry, Governor, events, wallet, and transactions.
2. Replace inline mocks incrementally.
3. Keep existing scenario names and assertions where valid.
4. Remove redundant fixture code after migration.

### Acceptance criteria

- `npm test` passes with no empty-suite errors.
- Proposal detail, vote aggregation, Community components, and deployment tests use canonical builders.
- No test reaches live RPC or a browser wallet.
- Production feature behavior remains unchanged; this issue only repairs test infrastructure and fixtures.

### Verification

`npm run typecheck && npm test`

## H7 — Standardize on-chain identifiers, copy actions, and explorer links

### Problem

Wallet addresses, contract IDs, transaction hashes, and Proposal IDs are rendered with different truncation, overflow, copy, and explorer behavior.

### Scope

Create one `OnChainIdentifier` component supporting label, full accessible value, deterministic truncation, copy feedback, and optional explorer URL. Migrate Community cards/details, Proposal cards/details, deployment summaries, transaction receipts, network notices, and tests. Use existing explorer and truncate utilities.

### Mechanical recipe

1. Compose existing `truncate` and `stellarExplorer` helpers.
2. Replace repeated identifier markup.
3. Keep surrounding layout and copy unchanged.
4. Add one shared test matrix, then update consumer assertions.

### Acceptance criteria

- Identifier values never cause horizontal overflow at 320px.
- Copy works by keyboard and announces success without changing the accessible name.
- Explorer links use the active network and correct entity type.

### Verification

`npm run lint && npm run typecheck && npm test && npm run test:e2e:ci`

## H8 — Centralize network and deployment capability configuration

### Problem

Network passphrases, wallet detection, factory availability, global contract IDs, start ledgers, health checks, and E2E defaults are read through scattered shapes. The current main branch has passphrase type errors and a false mismatch regression.

### Scope

Define one typed capability matrix for active network, RPC, explorer, CommunityFactory, legacy single-instance contracts, and Proposal discovery. Migrate wallet context, guards, clients, deployment hooks, health route, test fixtures, scripts, and docs. Do not change supported networks.

### Mechanical recipe

1. Extend the existing network config rather than adding another config layer.
2. Replace `passphrase`/`networkPassphrase` ambiguity at every consumer.
3. Add explicit `available`/`unavailable` capability checks.
4. Update all network fixtures from one builder.

### Acceptance criteria

- Frontend typecheck has no network/passphrase errors.
- A Testnet wallet is recognized as Testnet and wrong networks remain blocked.
- Missing factory or discovery config produces a named capability error.

### Verification

`npm run lint && npm run typecheck && npm test`

## H9 — Add backward-compatible structured proposal metadata across all surfaces

### Problem

Proposal creation accepts one free-text description, which prevents consistent titles, summaries, discussion links, previews, and cards. The Governor contract already stores a description string.

### Scope

Implement the exact version 1 Proposal Metadata envelope and fallback rules defined by PRD FR-10 in the existing description field. Add parse/serialize helpers and migrate creation, preview, list cards, detail views, scoped routes, event mapping, fixtures, tests, and docs. Legacy free text must remain readable.

### Mechanical recipe

1. Add a pure parser/serializer with strict bounds.
2. Replace the single textarea with the four fields and a preview.
3. Render parsed content through shared components.
4. Update fixtures to include both legacy and versioned descriptions.

### Acceptance criteria

- Serialization is deterministic and round-trips Unicode content.
- Invalid or legacy descriptions fall back to safe plain text.
- Discussion links accept HTTPS only and render with safe external-link attributes.

### Verification

`npm run lint && npm run typecheck && npm test && npm run test:e2e:ci`

## H10 — Consolidate proposal and Governor event modules into one pipeline

### Problem

The repo contains overlapping `proposal-events`, `proposalEvents`, `governor-events`, `governorEvents`, discovery, aggregation, and scoped Proposal utilities. Behavior and mocks can drift between global and Community routes.

### Scope

Create one `lib/proposal-events/` public API for event queries, pagination, decoding, deduplication, mapping, vote aggregation, and Freshness State. Migrate all hooks, routes, fixtures, tests, and relevant docs; remove compatibility files after imports are updated.

### Mechanical recipe

1. Preserve existing tested pure functions behind one index export.
2. Move modules without rewriting algorithms.
3. Update imports and mocks mechanically.
4. Add one Community Governor scoping regression test.

### Acceptance criteria

- Global legacy and canonical Community surfaces call the same pipeline until legacy redirects land.
- Event queries always filter by the selected Governor contract.
- Pagination, deduplication, malformed-event, partial-failure, and vote-total tests pass.

### Verification

`npm run lint && npm run typecheck && npm test`

## N1 — Add CommunityFactory authorization preflight to community creation

### Problem

The UI invites any connected wallet to create a Community, but `create_community` currently requires the CommunityFactory owner. Unauthorized users learn this only after transaction work begins.

### Scope

Read the factory owner during creation readiness, compare it with the connected address, and show ready, disconnected, wrong-network, unauthorized, and read-failed states before simulation. Keep the contract permission model unchanged.

### Acceptance criteria

- Unauthorized wallets cannot reach the deploy approval action.
- The blocked message explains that creation is limited during the pilot.
- Owner comparison is network-aware and covered by unit/component tests.
- Factory read failure is retryable and is not reported as unauthorized.

### Verification

`npm run lint && npm run typecheck && npm test`

## N2 — Add deterministic Community Metadata preview and download

### Problem

Creators must host a metadata JSON document before the wizard can validate it, but the app does not produce the canonical document they need to host.

### Scope

Build a pure metadata serializer from wizard fields, show formatted JSON and its content hash on the review step, and add a client-side `.json` download. Do not upload or pin content.

### Acceptance criteria

- The same normalized inputs always produce identical JSON bytes and hash.
- Preview and downloaded content match exactly.
- Required fields, URL schemes, and size limits are validated before download.
- Unit tests cover normalization, Unicode, escaping, and hash stability.

### Verification

`npm run lint && npm run typecheck && npm test`

## N3 — Extend the testnet deploy script to deploy and configure CommunityFactory

### Problem

The web app expects a CommunityFactory, but `scripts/deploy-testnet.sh` only deploys NFT and Governor instances and writes incomplete environment configuration.

### Scope

Update the script to upload approved NFT and Governor WASM, deploy CommunityFactory with their hashes, capture the factory deployment ledger, and write the complete testnet environment values expected by the web app. Preserve safe shell behavior and existing identity checks.

### Acceptance criteria

- One documented command produces a usable factory-backed testnet deployment.
- Script output includes factory contract ID, WASM hashes, deploy ledger, and explorer links.
- `.env.local` updates preserve unrelated existing variables.
- A dry-run or command-construction test covers generated CLI arguments.

### Verification

`npm test && npm run check:workspace` plus a documented manual Testnet run

## N4 — Make the health endpoint factory and registry aware

### Problem

`/api/health` checks legacy global NFT/Governor configuration but not the CommunityFactory or registry read path that powers the current product.

### Scope

Report separate configuration and read-probe results for RPC, CommunityFactory, registry listing, and optional legacy contracts. Keep the response credential-safe and backward compatible at the top-level `healthy` field.

### Acceptance criteria

- Missing factory config is distinguishable from RPC and registry-read failures.
- A healthy response proves that at least the registry interface is readable.
- Logs and JSON never expose query strings, credentials, or full wallet addresses.
- Route and scheduled health-check tests cover healthy, degraded, and unhealthy responses.

### Verification

`npm test && npm run typecheck`

## N5 — Add a participation readiness checklist to community detail

### Problem

Members must infer whether wallet connection, network, NFT membership, delegation, and Voting Power are ready before they can vote.

### Scope

Add a read-only checklist to the canonical Community detail page with direct connect, switch-network, mint, and delegate actions where applicable. Reuse existing hooks and transaction lifecycle components.

### Acceptance criteria

- Disconnected, wrong-network, non-member, undelegated, zero-power, ready, loading, and read-error states are distinct.
- Each unmet condition has at most one primary recovery action.
- Successful mint or delegation refreshes the affected rows.
- Component tests cover the full state table without live RPC.

### Verification

`npm run lint && npm run typecheck && npm test`

## N6 — Add recent proposal activity and participation summary to community detail

### Problem

Community detail already shows metadata, sharing, contract provenance, and raw governance parameters. It still does not summarize current activity or explain those parameters in the context of participation.

### Scope

Add active Proposal count, the three most recent Proposals, and short participation explanations beside the existing threshold, quorum, voting delay, and voting period values. Preserve exact ledger values, add approximate human durations, and use the PRD Freshness State model.

### Acceptance criteria

- Governance parameters come from the selected Community's Governor contract.
- Approximate durations state the ledger-time assumption and never replace exact values.
- Empty history and failed/stale discovery are visually distinct.
- Each recent Proposal links to its canonical Community-scoped detail route.

### Verification

`npm run lint && npm run typecheck && npm test`

## N7 — Add a launch and invite kit to community deployment success

### Problem

After deployment, creators need a clear way to share the Community and guide the first Members instead of copying contract IDs manually.

### Scope

Extend the registry-verified success state with the canonical Community URL, copy/share actions, explorer links, and a checklist: verify metadata, invite Members, mint membership, delegate, create the first Proposal.

### Acceptance criteria

- Share content uses the canonical registered Community URL.
- Native Web Share is used when available with clipboard fallback.
- Explorer links use the active network.
- Refreshing a recoverable deployment retains the success handoff after registry verification.

### Verification

`npm run lint && npm run typecheck && npm test`

## N8 — Show proposal discovery freshness and indexing limitations

### Problem

Browser RPC event scans can be delayed or bounded by ledger retention, but users cannot reliably tell complete history from an incomplete response.

### Scope

Implement the exact Current, Delayed, Stale, and Unavailable thresholds defined in PRD §5.1 from the existing discovery result; show the state on Community Proposal lists and detail vote totals. Link to a concise explanation and retry action. Do not add a backend indexer.

### Acceptance criteria

- Freshness derives from returned ledger/cursor/error data, not wall-clock guesses alone.
- Partial results remain visible and are labeled.
- Retry preserves current filters and Community context.
- Unit tests cover each Freshness State and malformed RPC metadata.

### Verification

`npm run lint && npm run typecheck && npm test`

## N9 — Align E2E CI with the root npm lockfile

### Problem

The frontend CI enforces the root lockfile while the E2E job caches `apps/web/package-lock.json` and runs a workspace-scoped install, creating an inconsistent and currently fragile dependency path.

### Scope

Make every Node job install from the repository root with `npm ci`, cache the root `package-lock.json`, and run workspace scripts from root. Keep Playwright browser caching and single-worker behavior.

### Acceptance criteria

- CI contains no reference to `apps/web/package-lock.json`.
- Frontend and E2E jobs use the same Node/npm versions and install command.
- Workspace layout validation runs before install-dependent checks where practical.
- CI YAML is covered by the existing workspace/check script or a focused static test.

### Verification

`npm run check:workspace && npm test` plus a green CI run

## N10 — Decide and document the price-oracle contract's product scope

### Problem

The workspace contains a price-oracle contract that is absent from the Stolla PRD, README product story, and architecture. Its relationship to governance is undefined, which creates contributor and security ambiguity.

### Scope

Write a short ADR that chooses one of two outcomes: quarantine/remove the contract from the Stolla workspace, or define a concrete future governance use case, trust model, data-source model, and milestone gate. Documentation only; do not expand the contract.

### Acceptance criteria

- The ADR states a decision, alternatives, evidence, security implications, and follow-up action.
- README, architecture, Cargo workspace comments, and contributor docs consistently reflect the decision.
- If retained, the ADR explicitly states that current passthrough submission is not production price aggregation.
- No new oracle feature or external dependency is added.

### Verification

`npm run check:workspace && npm test`
