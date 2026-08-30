---
title: Stolla Self-Serve Governance Pilot
status: final
created: 2026-08-26
updated: 2026-08-26
supersedes: docs/prd.md
---

# PRD: Stolla Self-Serve Governance Pilot

## 0. Document purpose

This PRD defines the next sprint boundary for Stolla. It supersedes the single-community v0.1 scope in `docs/prd.md` because the repository already contains a CommunityFactory, an on-chain registry, a community creation wizard, and community-scoped routes. It is the product source for the twenty sprint issues in `issue-plan.md`; architecture-level implementation detail remains in the existing ADRs and architecture documents.

## 1. Vision

Stolla should move from a collection of working governance features to one coherent, self-serve testnet pilot. A creator should know whether they are authorized to launch a Community, publish valid Community Metadata, deploy the correct contract set, and share a canonical Community URL. A Member should land on that URL, understand whether they can participate, see public Proposal history, and act without learning Stolla's internal route or registry variants.

The sprint thesis is that consistency and participation clarity create more product value than another contract primitive. Stolla already implements NFT membership, delegation, proposal discovery, voting, and multi-community deployment. The next step is to make those capabilities feel like one trustworthy product.

## 2. Target users

### 2.1 Community Creator

A Stellar project operator who wants to launch a testnet governance space without manually reconciling contract IDs, metadata files, registry variants, or legacy routes.

### 2.2 Community Member

A wallet holder who follows a shared Community link and needs to understand membership, delegation, Voting Power, open Proposals, and deadlines before acting.

### 2.3 Public Visitor

A person without a connected wallet who needs to inspect a Community and its public Proposal history, including honest partial-data states, before deciding whether to participate.

### 2.4 Jobs to be done

- Launch a Community from a supported account and obtain a canonical shareable URL.
- Verify Community Metadata and deployment configuration before approving a transaction.
- Understand the steps required to become eligible to vote.
- Discover and evaluate Community-scoped Proposals from public chain data.
- Recover from wallet, network, RPC, metadata, and indexing failures without losing context.

### 2.4 Key user journeys

- **UJ-1. Creator launches a Community.** The Community Creator opens the canonical creation flow, sees authorization and network readiness before entering data, previews canonical Community Metadata, approves deployment, and receives a registry-verified Community URL plus next steps.
- **UJ-2. Member becomes ready to vote.** The Community Member opens a shared Community URL, connects a wallet, sees membership and delegation readiness, completes the missing action, and sees updated Voting Power.
- **UJ-3. Member reviews and votes on a Proposal.** The Community Member opens Community-scoped Proposal history, understands status, deadline, quorum, and structured content, submits a vote, and receives a transaction receipt without leaving the Community context.
- **UJ-4. Public Visitor recovers from partial data failure.** The Public Visitor can still identify the Community and retry a failed RPC or metadata region while stale or unavailable data is explicitly labeled.

## 3. Glossary

- **Community** — A registry entry that binds Community Metadata, an NFT Contract, and a Governor Contract.
- **Community Metadata** — The canonical JSON document describing a Community and its content hash.
- **Community Registry** — The on-chain CommunityFactory registry used as the canonical discovery source.
- **Canonical Route** — A URL under `/communities` that represents a Community or its Proposals.
- **Legacy Route** — A singular `/community` or global `/proposals` URL retained only as a redirect during migration.
- **Proposal** — A Governor Contract proposal discovered from Stellar RPC events and rendered within one Community.
- **Proposal Metadata** — Structured title, summary, body, and optional discussion URL encoded into the existing on-chain description field.
- **Participation Readiness** — Wallet, network, membership, delegation, and Voting Power conditions required for an action.
- **Voting Power** — Delegated NFT voting weight at the relevant ledger snapshot.
- **Freshness State** — Whether public RPC-derived data is current, delayed, stale, or unavailable.

## 4. Features

### 4.1 Canonical multi-community experience

**Description:** All public navigation, reads, actions, and links use one Canonical Route family and one Community Registry adapter. Legacy Routes remain safe redirects and do not host independent product behavior. Realizes UJ-1 through UJ-4.

#### FR-1: Canonical Community routing

The system must use `/communities`, `/communities/create`, `/communities/[id]`, `/communities/[id]/proposals`, and `/communities/[id]/proposals/[proposalId]` as the only feature-owning routes.

**Consequences:**

- Every internal Community or Proposal link resolves under `/communities`.
- Legacy Routes preserve query parameters when redirecting.
- Navigation, unit tests, E2E tests, and docs contain no Legacy Route as a primary destination.

#### FR-2: One Community Registry model

The web app must expose one typed Community model and one registry interface backed by the on-chain Community Registry, with fixtures injected only in tests.

**Consequences:**

- Production code does not read a hard-coded registry or `NEXT_PUBLIC_COMMUNITIES_JSON`.
- Metadata failures do not remove the on-chain Community identity.
- All Community pages and tests use the same adapter contract.

#### FR-3: Community-scoped contract context

Each Community screen must derive its NFT Contract and Governor Contract from the selected Community instead of global contract environment variables.

**Consequences:**

- Switching Community changes all reads and writes to that Community's contracts.
- No Community-scoped action silently falls back to a global contract ID.

### 4.2 Creator launch readiness

**Description:** The creation journey identifies blocking conditions before wallet approval and turns deployment success into a usable launch outcome. Realizes UJ-1.

#### FR-4: Authorization and network preflight

The creation flow must show whether the connected wallet and active network can call CommunityFactory before submission.

**Consequences:**

- An unauthorized wallet receives an explanatory blocked state before simulation.
- A network mismatch identifies the expected and detected network.
- The product never describes creation as permissionless while the contract is owner-only.

#### FR-5: Canonical Community Metadata preview

The Community Creator must be able to preview and download the exact canonical Community Metadata JSON and content hash used by the deployment flow.

**Consequences:**

- Equivalent form input produces deterministic JSON and hash output.
- The preview validates required fields and URL schemes before deployment.
- Built-in IPFS upload remains out of scope for this sprint.

#### FR-6: Registry-verified launch handoff

After deployment, the system must verify the Community Registry entry and show the Canonical Route, share action, contract explorer links, and a short launch checklist.

**Consequences:**

- Success is not shown until the registry read matches the submitted deployment.
- Partial confirmation is recoverable from the stored transaction hash.

### 4.3 Member home and participation readiness

**Description:** A Community page becomes the primary governance home rather than a metadata and contract-ID display. Realizes UJ-2 and UJ-4.

#### FR-7: Community governance overview

The Community page must show Community Metadata, human-readable governance parameters, recent or active Proposals, and explicit Freshness State.

**Consequences:**

- A visitor can reach Proposal history and distinguish empty history from failed discovery.
- Ledger-based durations include an approximate human duration without hiding exact ledger values.

#### FR-8: Participation readiness checklist

A connected Community Member must see wallet, network, membership, delegation, and Voting Power status with direct actions for unmet conditions.

**Consequences:**

- Disconnected, wrong-network, non-member, undelegated, and ready states are distinguishable.
- Completing an action refreshes only the affected readiness state.

### 4.4 Proposal clarity and public history

**Description:** Proposal discovery and presentation use one Community-scoped event pipeline and a backward-compatible structured content convention. Realizes UJ-3 and UJ-4.

#### FR-9: Community-scoped Proposal discovery

All Proposal list and detail surfaces must query the selected Governor Contract through one event pipeline and preserve partial-failure behavior.

**Consequences:**

- Browser local storage is not a discovery source.
- Event pagination, deduplication, decoding, and vote aggregation share one implementation.
- Freshness State is visible when RPC retention or indexing lag limits results.

#### FR-10: Structured Proposal Metadata

The Proposal creation experience must support a title, summary, body, and optional discussion URL while remaining compatible with the existing Governor Contract description field. [ASSUMPTION: Existing contract interfaces remain backward compatible; Proposal Metadata is encoded in the current description field.]

**Consequences:**

- New descriptions use a UTF-8 JSON envelope with exactly `version`, `title`, `summary`, `body`, and optional `discussionUrl` fields. Version 1 permits a title up to 120 characters, summary up to 280 characters, body up to 8,000 UTF-8 bytes, an HTTPS discussion URL up to 2,048 characters, and a total serialized envelope up to 12 KiB.
- Serialization is deterministic: fixed field order, no insignificant whitespace, normalized line endings, and no mutation of user-visible Unicode content.
- Legacy free-text descriptions still render safely.
- An unknown `version`, invalid JSON, invalid field, or oversized envelope is treated as legacy plain text for reads and is rejected with a field-specific message for new writes.
- List cards, detail views, fixtures, and tests render both formats.

#### FR-11: Consistent on-chain identity and transaction feedback

Addresses, contract IDs, proposal IDs, explorer links, copy actions, and asynchronous states must use shared presentation primitives across Community and Proposal flows.

**Consequences:**

- Long identifiers never create horizontal overflow.
- Copy and explorer behavior is accessible by keyboard.
- Loading, empty, stale, error, pending, confirmed, and failed states use consistent semantics.

## 5. Cross-cutting requirements

- **NFR-1 — Quality gate:** `npm run lint`, `npm run typecheck`, and `npm test` must pass on the final sprint branch. The 2026-08-26 baseline has 3 lint errors, 9 typecheck errors, and 29 failing tests.
- **NFR-2 — Accessibility:** Changed interactive flows must meet WCAG 2.1 AA keyboard, focus, labeling, and status-announcement expectations.
- **NFR-3 — Reliability:** A failure in Community Metadata or one Proposal read must not hide otherwise available on-chain identity or history.
- **NFR-4 — Privacy:** Product analytics must not transmit a full wallet address; analytics implementation is not required in this sprint.
- **NFR-5 — Network safety:** The active network and contract provenance must be visible before any signing request. [ASSUMPTION: Testnet remains the only supported public network for this sprint.]
- **NFR-6 — Contributor efficiency:** Wide-scope issues must provide a mechanical migration recipe, named shared primitive, affected file families, and bounded verification commands.

### 5.1 Freshness State model

Proposal discovery must compare its last successfully scanned ledger with the latest ledger returned by the same configured RPC endpoint:

- **Current:** complete response and lag of 0–5 ledgers.
- **Delayed:** complete response and lag of 6–20 ledgers.
- **Stale:** partial response, retention/cursor gap, or lag above 20 ledgers; available results remain visible.
- **Unavailable:** no usable result because the event query or latest-ledger read failed.

The UI must show the last scanned ledger and latest known ledger when both exist. A missing latest-ledger value cannot be labeled Current. These pilot thresholds are product defaults, not an indexing SLA. [ASSUMPTION: A five-ledger Current window and twenty-ledger Stale boundary are appropriate for the testnet pilot.]

## 6. Non-goals

- Mainnet launch or production asset custody.
- Timelock or treasury execution; ADR-006 remains a future product gate.
- New voting algorithms, token economics, roles, or reputation systems.
- A persistent hosted indexer with database and operations stack.
- Built-in IPFS pinning or a paid metadata service.
- Mobile-native applications.
- Expanding the unrelated price-oracle contract without an approved scope decision.

## 7. Sprint scope

### In scope

- Canonical route, registry, context, wizard, event, test-support, state, identifier, and configuration consolidation.
- Structured Proposal Metadata compatibility layer.
- Creator authorization preflight, deterministic Community Metadata preview, deployment/config coherence, health readiness, and launch sharing.
- Community governance overview, participation readiness, and Freshness State.
- Restoring all existing frontend quality gates.

### Out of scope

- Contract permission-model changes. [ASSUMPTION: The owner-only CommunityFactory policy remains unchanged during this sprint.]
- Backend services and durable indexing.
- Treasury execution and mainnet deployment.

## 8. Success metrics

### Primary

- **SM-1:** 100% of internal Community and Proposal links use Canonical Routes; validates FR-1.
- **SM-2:** A testnet creator using the authorized account can complete create-to-share without manually editing contract IDs; validates FR-4 through FR-6.
- **SM-3:** A Member can determine Participation Readiness and reach an open Community Proposal from one Community page; validates FR-7 through FR-9.
- **SM-4:** Lint, typecheck, unit tests, and scoped E2E tests are green; validates NFR-1.

### Secondary

- **SM-5:** Production code has one Community Registry adapter, one creation wizard, and one Proposal event pipeline; validates FR-2, FR-9.
- **SM-6:** Every asynchronous Community and Proposal surface represents loading, empty, stale, error, and success where applicable; validates FR-11.

### Counter-metrics

- **SM-C1:** Consolidation must reduce duplicate production paths rather than leave permanent compatibility layers that preserve the same ambiguity.
- **SM-C2:** The sprint must not reduce safety by bypassing authorization, network, metadata-hash, or registry verification.
- **SM-C3:** The sprint must not add a backend dependency merely to simplify a frontend migration.

## 9. Risks and mitigations

- **Owner-only factory versus self-serve language:** Detect authorization early and describe the pilot accurately; decide a future policy separately.
- **RPC retention and scale:** Expose Freshness State and retain the documented indexer escalation path.
- **Route migration link breakage:** Preserve query parameters and cover Legacy Route redirects in E2E tests.
- **Metadata durability:** Provide deterministic preview/download and hash verification; do not imply Stolla pins content.
- **Brownfield test drift:** Make the green baseline an explicit entry gate before broad migrations are merged.

## 10. Open questions

1. After the pilot, should Community creation remain owner-only, move to an allowlist, or become permissionless with anti-spam controls?
2. What pilot usage threshold justifies implementing the persistent indexer described in `docs/community-proposal-indexing.md`?
3. Should the price-oracle contract become part of a future treasury policy or be removed from the Stolla workspace?

## 11. Assumptions index

- The owner-only CommunityFactory policy remains unchanged during this sprint (§7).
- Testnet remains the only supported public network for this sprint (§5, NFR-5).
- Existing contract interfaces remain backward compatible; Proposal Metadata is encoded in the current description field (§4.4, FR-10).
- A five-ledger Current window and twenty-ledger Stale boundary are appropriate for the testnet pilot (§5.1).
