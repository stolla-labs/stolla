# Community-scoped proposal discovery and indexing

## Status

Proposed architecture for issue #99. This design extends the direct-RPC
single-Governor approach in [ADR-004](adr/004-proposal-discovery.md) to the
multi-community registry defined by
[ADR-005](adr/005-community-factory-registry.md).

## Decision

Stolla will use a shared, read-only indexing service for community proposal
history. The service discovers communities from `CommunityFactory`, ingests
events from each registered Governor, stores normalized records in PostgreSQL,
and exposes a cursor-paginated public HTTP API.

Direct browser-to-RPC discovery remains useful as a development fallback for a
single configured Governor, but it is not the multi-community source of truth.
It was rejected for community-scoped history because:

- RPC event retention cannot guarantee history from every community's creation
  ledger.
- every browser would repeat the same paginated scans and provider retries;
- a browser cannot maintain durable cursors, quarantine malformed events, or
  perform an auditable rebuild;
- cross-community availability and pagination would vary with each client's
  network and RPC response window.

A per-community indexer was also rejected. It would duplicate workers,
databases, deployment configuration, and monitoring while weakening consistent
query semantics. One shared service can still isolate each Governor's cursor
and failures.

The index is a derived read model. The factory registry, Governor contracts,
and ledger events remain authoritative and can rebuild it.

## Identity and registry mapping

The registry supplies this immutable mapping:

```text
(network, community_id) -> governor_contract, created_at_ledger
```

The indexer polls `list_communities` in ascending `creation_index` order,
deduplicates by `community_id`, and upserts each mapping. A new community starts
at the registry record's `created_at_ledger`; adding one never requires a code
or deployment configuration change.

Proposal IDs are only unique within one Governor. The canonical proposal key
is:

```text
proposal_key = network_id + ":" + governor_contract + ":" + proposal_id_hex
```

`community_id` is a query partition, not part of proposal identity. This
prevents collisions if two Governors produce the same 32-byte proposal ID and
preserves identity if a registry migration points to an already indexed
Governor. API routes use both community ID and proposal ID, then verify the
stored Governor mapping.

The minimum normalized proposal record is:

```text
network_id, community_id, governor_contract, proposal_id_hex,
created_ledger, created_event_position, created_at_timestamp?,
proposer?, description?, voting_start_ledger?, voting_end_ledger?,
status_hint?, source_event_id, first_seen_at, updated_at, generation
```

`proposal_id_hex` is lowercase. Contract and account addresses use canonical
StrKey encoding. Values that exceed JavaScript's safe integer range are decimal
strings at the API boundary.

## Ingestion and checkpoints

Each `(network_id, governor_contract, event_family)` has an independent
checkpoint:

```text
generation, opaque_rpc_cursor?, start_ledger, indexed_through_ledger,
last_event_ledger?, last_success_at, retry_count, status
```

Workers query ascending ledger order in bounded pages. The first request uses
`start_ledger`; subsequent requests use the RPC cursor as an opaque value.
Cursor values are never parsed or synthesized.

For every page, one database transaction:

1. validates the response belongs to the expected network and Governor;
2. decodes known event versions and quarantines malformed events;
3. inserts events with `ON CONFLICT (source_event_id) DO NOTHING`;
4. upserts proposals by canonical `proposal_key`;
5. advances the checkpoint only after all valid writes and quarantine writes
   commit.

The preferred `source_event_id` uses the RPC event ID when the provider defines
it as stable. The portable fallback is a hash of network ID, contract,
ledger sequence, transaction hash, operation index, event index, topics, and
value XDR. The database enforces uniqueness on both `source_event_id` and the
canonical proposal key. Re-reading a page, an overlap window, or a complete
backfill is therefore idempotent.

API pagination never exposes the ingestion cursor. Proposal pages use a signed,
opaque keyset cursor containing the last row's
`(created_ledger, created_event_position, proposal_key)` and filter hash.
Ordering is descending by those fields for user-facing history. A stable
proposal key tie-breaker prevents duplicates or omissions when new rows arrive.
Invalid, expired, or filter-mismatched cursors return `400`.

## Finality, freshness, and caching

Stellar closes ledgers without probabilistic chain reorganization in normal
operation. The service still uses a configurable two-ledger publication lag to
avoid racing provider ingestion and labels it `finality_lag_ledgers`; this is
an operational buffer, not proof-of-work confirmation.

- Workers target `observed_head - finality_lag_ledgers`.
- A community is fresh when `indexed_through_ledger` is within five ledgers of
  that target and the last successful poll is under one minute old.
- Empty first pages may be cached publicly for 15 seconds.
- Populated first pages may be cached for 30 seconds with
  `stale-while-revalidate=60`.
- Cursor pages may be cached for five minutes because keyset boundaries are
  immutable for the requested ordering.
- API responses always report `indexedThroughLedger`, `observedHeadLedger`,
  `lastSuccessfulSync`, and `freshness`.

Clients must show stale or partial status rather than presenting cached data as
current.

## Public frontend query contract

```http
GET /v1/communities/{communityId}/proposals?limit=20&cursor=...&state=active
GET /v1/communities/{communityId}/proposals/{proposalId}
```

`limit` defaults to 20 and is bounded to 1–100. State and future filters are
included in the cursor's filter hash.

```json
{
  "items": [
    {
      "communityId": "64-lowercase-hex",
      "governorContract": "C...",
      "proposalId": "64-lowercase-hex",
      "proposalKey": "testnet:C...:...",
      "createdAtLedger": 123,
      "description": "Example",
      "statusHint": "active"
    }
  ],
  "page": {
    "nextCursor": "opaque-or-null",
    "hasMore": false
  },
  "sync": {
    "status": "ready",
    "freshness": "fresh",
    "indexedThroughLedger": 456,
    "observedHeadLedger": 458,
    "lastSuccessfulSync": "2026-08-05T12:00:00Z",
    "warnings": []
  }
}
```

Frontend semantics:

| Situation | HTTP / payload | UI behavior |
|---|---|---|
| Initial request in progress | client state `loading` | skeletons and polite live status |
| No proposals after a complete first sync | `200`, empty items, `ready` | actionable empty state |
| Indexing has not reached the target | `200`, available items, `syncing` | keep data, show indexing notice |
| A later ingestion page failed | `200`, available items, `partial` | keep data, show retry/staleness notice |
| Metadata or one proposal enrichment failed | `200`, item retained, warning | render on-chain fields and mark missing field |
| Unknown community | `404` | community not-found state |
| Known community, no successful checkpoint | `503`, retry metadata | top-level retryable discovery error |
| Invalid cursor or filter | `400` | discard cursor and offer first-page reload |

The browser deduplicates appended pages by `proposalKey` defensively. It must
not merge local storage IDs into public results or silently query a globally
configured Governor when a community query fails.

Client-side shared helpers for direct-RPC discovery (decode, pagination,
dedupe, vote totals, Freshness State stubs) live in
`apps/web/src/lib/proposal-events/`. Community routes must pass an explicit
Governor contract id into that pipeline and must not fall back to the env
global Governor.

## Failure and retry behavior

- HTTP 429, timeouts, and transient 5xx responses use exponential backoff with
  full jitter and a bounded retry budget. The worker then marks only that
  Governor `degraded`; other communities continue.
- A failed page does not advance its checkpoint. The next attempt safely
  replays it.
- A provider response that jumps past a requested ledger range is an RPC gap.
  The worker stops that partition, records the missing range, tries a second
  configured provider, and marks results partial until the range is filled.
- Unknown event versions and malformed events are stored with raw XDR,
  contract, ledger, and decode error in a quarantine table. They do not block
  valid events in the page, but they raise an alert and a public warning if
  proposal completeness may be affected.
- A code upgrade at the same Governor address keeps the proposal namespace.
  The decoder selects an event schema by observed code hash and ledger range.
  An unsupported hash pauses that partition instead of guessing.
- Replacing a Governor address creates a new indexing epoch. The registry or
  migration manifest must provide its start ledger; old records are retained
  under the old Governor and both epochs can be queried for the community.

## Testnet resets and network identity

`network_id` is the hash of the network passphrase, not the display name
`testnet`. On startup and every checkpoint response, the worker verifies the
network identity and checks that the observed ledger does not move behind the
stored checkpoint.

If a reset or incompatible RPC network is detected, ingestion stops. Operators
create a new generation after confirming the registry deployment and start
ledgers. Old testnet generations are retained for a short diagnostic window but
are excluded from current API queries. The service never attaches old cursors
or proposals to the reset network.

## Backfill, rebuild, and retention

Backfill procedure:

1. register or rediscover the community and its creation ledger;
2. create a checkpoint in `backfilling` state with no RPC cursor;
3. ingest ascending pages through the finalized target;
4. compare proposal counts and ledger coverage, resolve quarantined gaps;
5. atomically mark the generation active and expose it to queries.

Rebuilds are blue/green. A new generation writes separate checkpoints and rows
while the active generation serves traffic. After coverage, gap, decoder, and
sample query checks pass, one transaction switches the active generation.
Rollback switches the pointer back. No in-place truncation is required.

Normalized proposal and source-event records are retained for the life of a
production community. Raw successful event XDR may move to compressed object
storage after 90 days. Quarantined events and checkpoint audit history remain
online until resolved and are then retained for at least one year. Testnet
generations may be deleted after 30 days if they are not the active generation.

## Security and operating tradeoffs

- The service is read-only with respect to Stellar. It holds no signing keys.
- Community IDs, contract addresses, cursors, limits, and filters are validated
  before use. Queries are parameterized and response text is escaped by the
  frontend.
- Public endpoints have per-IP and global rate limits. Cursor signatures
  prevent clients from injecting arbitrary SQL keysets.
- Metadata fetching uses an allowlisted `https`/IPFS resolver, response size
  and time limits, content-hash verification, no private-network access, and no
  credential forwarding.
- Database credentials and provider tokens stay server-side. Logs redact URL
  credentials and never record full request headers.

The shared service adds database, worker, backup, and on-call cost. In return it
deduplicates RPC work, preserves history beyond RPC retention, and gives every
client consistent pagination and failure semantics. Worker concurrency and
poll frequency can scale per active Governor; inactive communities can poll
less often without changing correctness.

## Observability

Metrics are labeled by network and hashed Governor identifier to control
cardinality:

- finalized head and indexed ledger, expressed as ledger and wall-clock lag;
- pages, events, proposals, duplicates, retries, and RPC gaps;
- decode/quarantine count by event schema and code hash;
- request latency, error rate, cache hit rate, and stale/partial responses;
- backfill generation progress and last successful checkpoint age.

Alerts fire for sustained indexing lag, an RPC gap, repeated partition failure,
unknown code hash, quarantine growth, network reset detection, API error-budget
burn, database saturation, and failed backups. Structured logs include
network, community ID, Governor, generation, ledger range, and a request trace
ID, but not metadata bodies.

## Follow-up implementation work

1. Define database migrations, generation switching, and repository methods.
2. Implement registry polling and per-Governor checkpoint workers.
3. Add versioned Governor event decoders and quarantine storage.
4. Implement the signed keyset cursor and public API endpoints.
5. Add the frontend community-proposal query hook and scoped proposal routes.
6. Add multi-provider gap recovery, retry budgets, and rate limiting.
7. Build fixture-ledger ingestion, retry, deduplication, cursor, reset, and
   blue/green rebuild tests.
8. Add dashboards, alerts, backup/restore, and operator runbooks.
9. Define the Governor replacement manifest and registry migration extension.
