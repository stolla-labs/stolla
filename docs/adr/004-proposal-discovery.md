# ADR-004: Public Proposal Discovery via RPC Events

## Status

Accepted

## Context

The current proposals page discovers proposal IDs from browser-local
`localStorage`. That makes governance history private to the browser that
created the proposal, breaks cross-device visibility, and prevents any
trustworthy public history for the community.

For v0.2, Stolla needs a public, read-only proposal discovery flow that works
without a wallet and without introducing a dedicated indexing service before it
is operationally justified.

The solution must document:

- how proposals are discovered from Governor contract events
- how much history the app can rely on from Stellar RPC alone
- how pagination, duplicate events, ordering, and retries behave
- when the project must stop relying on direct RPC event queries and adopt a
  persistent indexer

## Options

| Option | Pros | Cons |
|--------|------|------|
| Direct Stellar RPC event queries | No extra infrastructure, lowest v0.2 complexity, can ship with existing app config | Bounded by RPC retention/history, repeated reads are slower, cursor/replay logic stays in app code |
| Dedicated persistent indexer | Full history control, richer filtering, easier analytics and multi-community feeds | Adds database, workers, ops burden, backfill logic, and deployment complexity too early |

## Decision

Stolla v0.2 will use direct Stellar RPC event queries as the source of truth
for public proposal discovery. A persistent indexer is deferred until the
project crosses explicit scale or retention limits.

The web app will stop treating `localStorage` as the source of proposal IDs.
`localStorage` may remain only as a short-lived UX cache during migration, but
RPC-discovered proposal history becomes authoritative.

## Required Event Scope

v0.2 proposal discovery depends on Governor events that let the app find and
track proposals without scanning browser state.

- Required now: proposal creation event(s) that emit a stable proposal ID
- Required for accurate lifecycle reconciliation: proposal cancellation and
  proposal execution/queue completion event(s) when exposed by the Governor
- Not required for the list view in v0.2: vote-cast events

Vote events are still part of the governance event surface and must be
inventoried in follow-up work, but they are not required to discover proposal
rows on the proposals index page.

## Proposal Summary Model

The public proposal history pipeline must normalize event data into a shared
summary record with these fields:

| Field | Why the frontend needs it |
|-------|---------------------------|
| `proposalId` | Stable route key and detail-page lookup |
| `contractId` | Guards against mixing unrelated Governor instances |
| `createdAtLedger` | Stable ordering and replay checkpoints |
| `createdAtTimestamp` | Human-readable history when available |
| `proposer` | Attribution and future filtering |
| `description` or equivalent summary text | Proposal list and detail context |
| `votingStartLedger` | Derive lifecycle expectations |
| `votingEndLedger` | Derive lifecycle expectations |
| `statusHint` | Initial list rendering before richer reads |
| `sourceEventId` | Deduplication and replay safety |

The existing proposals page currently renders `proposalId` and current state.
The normalized model is intentionally wider so later issues can add richer,
public proposal cards without redesigning the discovery pipeline.

## Start Ledger Strategy

Proposal discovery queries must start from a configured ledger boundary instead
of scanning from ledger `0`.

- Owner: repository configuration, not browser state
- Initial source: checked-in app configuration or environment variable owned by
  maintainers at deploy time
- Update policy: move forward only when a backfill or indexer guarantees no
  proposal history loss

This value must be explicit because RPC providers may not retain the full
history needed to discover older events.

## Pagination, Ordering, and Replay Rules

- Query pages in ascending ledger order from the configured start ledger
- Treat the RPC cursor as opaque and continue until the provider returns no next
  page
- Deduplicate by a stable event identity composed from contract, ledger,
  transaction, operation, and event position data when available
- Preserve deterministic ordering by `createdAtLedger`, then by intra-ledger
  event position
- Replaying the same ledger range must be safe and idempotent

The caller may re-read prior pages after retries or deploys. Duplicate events
must not create duplicate proposal rows.

## Failure Behavior

- If a page fails, keep already collected proposal summaries and expose a
  retryable partial-failure state
- If the first page fails, show a top-level discovery error
- Do not silently fall back to `localStorage` once public discovery is enabled
- Log enough context to diagnose the failing RPC range or cursor

This keeps proposal history honest: stale browser-local data must not masquerade
as public chain history.

## RPC Retention Limits

Direct RPC discovery is acceptable only while the configured start ledger stays
inside the practical event-history window of the chosen RPC provider.

Known implications:

- Retention is provider-dependent and cannot be assumed infinite
- A new environment or provider can lose discoverability for old proposals if
  the retained ledger window no longer reaches the configured start ledger
- Repeated full-range scans become increasingly expensive as proposal volume
  grows

For that reason, v0.2 is acceptable for a single-community testnet deployment,
but it is not the terminal architecture for long-lived public governance
history.

## Indexer Escalation Criteria

Adopt a persistent indexer when any of these become true:

- The configured start ledger falls outside retained RPC event history
- Proposal discovery needs guaranteed full-history replay across provider
  changes
- A single page load requires too many RPC pages to keep the UX responsive
- The product needs cross-community aggregation, analytics, or richer filters
- The app needs stronger availability than a single RPC provider can offer
- Operators need auditable backfills, reorg handling, or historical repairs

At that point, the indexer becomes the system of record for proposal discovery,
with RPC remaining the ingestion source.

## Consequences

- v0.2 can ship public proposal history without adding backend infrastructure
- Proposal discovery logic must own pagination, deduplication, and retry
  semantics in application code
- Maintainers must configure and preserve a valid start ledger
- The migration away from `localStorage` becomes incremental rather than
  all-at-once
- Application code consolidates event query, decode, map, dedupe, and vote
  aggregation under `apps/web/src/lib/proposal-events/` so global and
  Community Governor scopes share one pipeline

## Follow-up Backlog Mapping

- #35 Add a retryable RPC error state to the community page
- #36 Inventory the Governor proposal and vote event surface
  ([inventory](../governor-event-surface.md))
- #37 Add a testnet RPC client for querying Governor events
- #38 Add a regression test for proposal creation events
- #39 Define and test a typed proposal event decoder
- #40 Add a configurable start ledger for proposal discovery
- #41 Normalize proposal events into a shared proposal summary model
- #42 Add pagination support to Governor event queries
- #43 Deduplicate proposal events across paginated RPC responses
- #44 Add a public proposal discovery hook for the web app
- #45 Replace `localStorage` proposal discovery with the public data source
