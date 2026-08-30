# Governor proposal and vote event surface

This document inventories the Stolla governor event surface for public proposal
discovery, as required by [ADR-004](./adr/004-proposal-discovery.md) and issue
[#36](https://github.com/stolla-labs/stolla/issues/36).

## Scope and sources

The inventory below is derived from:

- Stolla contract composition in
  `contracts/contracts/community-governor/src/lib.rs`
- generated contract bindings in
  `apps/web/src/lib/bindings/community-governor/src/index.ts`
- `stellar-governance v0.7.2` source in the local Cargo registry
- live Stellar testnet RPC metadata queried on August 3, 2026 from
  `https://soroban-testnet.stellar.org`

The current frontend contract configuration is:

- network: `testnet`
- RPC URL: `https://soroban-testnet.stellar.org`
- governor contract ID:
  `CAHM2MNNRYMS4AMFLDBQYJKPAYQZS24JT2HZRP4NBGFODQ2DPXRYEUOE`

## What Stolla actually emits

`CommunityGovernor` composes `stellar_governance::governor::Governor` and only
overrides `execute` and `cancel`. It does not define any custom governance
events of its own, so the effective event surface is the upstream Governor
event surface.

Stolla also does not override `proposals_need_queuing()`. The upstream default
is `false`, which means:

- `proposal_queued` is part of the dependency surface
- but it is not expected in the current Stolla governor configuration unless
  the contract is changed to enable queuing

## Event inventory

| Event | Topic shape | Value shape | Meaning | Status in current Stolla contract |
| --- | --- | --- | --- | --- |
| `proposal_created` | `["proposal_created", proposal_id: BytesN<32>, proposer: Address]` | `[targets: Vec<Address>, functions: Vec<Symbol>, args: Vec<Vec<Val>>, vote_snapshot: u32, vote_end: u32, description: String]` | New proposal created | Active |
| `vote_cast` | `["vote_cast", voter: Address, proposal_id: BytesN<32>]` | `[vote_type: u32, weight: u128, reason: String]` | Vote recorded for a proposal | Active |
| `proposal_executed` | `["proposal_executed", proposal_id: BytesN<32>]` | `[]` | Proposal executed | Active |
| `proposal_cancelled` | `["proposal_cancelled", proposal_id: BytesN<32>]` | `[]` | Proposal cancelled | Active |
| `proposal_queued` | `["proposal_queued", proposal_id: BytesN<32>]` | `[eta: u32]` | Proposal queued for delayed execution | Defined upstream, but not expected with current Stolla contract |

## Proposal ID encoding

Proposal IDs are deterministic. The binding docs for `get_proposal_id` describe
the exact encoding:

- `proposal_id = keccak256(XDR(targets, functions, args, description_hash))`
- `description_hash = keccak256(description.to_bytes())`
- the description hash uses the raw UTF-8 bytes of the description string
- no browser-local storage or off-chain nonce participates in proposal ID
  generation

That makes proposal IDs reproducible off-chain as long as the caller uses the
same serialized action vectors and description bytes.

## On-chain lifecycle fields versus event payloads

The Governor stores `ProposalCore` on-chain with:

- `proposer`
- `vote_snapshot`
- `vote_end`
- `state`

Only some of that state is emitted directly in creation events. The rest must
be read from the contract later.

### Proposal creation and lifecycle fields

| Field | `proposal_created` | Other event | Contract read needed | Notes |
| --- | --- | --- | --- | --- |
| `proposalId` | Yes | Also repeated in all lifecycle events except vote topic order differs | No | Primary discovery key |
| `proposer` | Yes | No | Optional | Creation event already includes it |
| `targets` | Yes | No | No | Action payload is event-provided |
| `functions` | Yes | No | No | Action payload is event-provided |
| `args` | Yes | No | No | Action payload is event-provided |
| `description` | Yes | No | No | Full proposal description is event-provided |
| `voteSnapshot` | Yes | No | Optional | Also available from `proposal_snapshot` |
| `voteEnd` | Yes | No | Optional | Also available from `proposal_deadline` |
| `currentState` | No | Partially implied by cancel/execute events | Yes | Use `proposal_state` for authoritative current status |
| `queueEta` | No | Yes, from `proposal_queued` only | Maybe | Unused in current Stolla config |

### Vote fields

| Field | `vote_cast` | Contract read needed | Notes |
| --- | --- | --- | --- |
| `proposalId` | Yes | No | In topic position 2 |
| `voter` | Yes | No | In topic position 1 |
| `voteType` | Yes | No | Upstream simple counting uses `0=Against`, `1=For`, `2=Abstain` |
| `weight` | Yes | No | Snapshot voting power recorded at cast time |
| `reason` | Yes | No | Empty string is still structurally present |
| `hasVoted(account)` | No | Yes | Use `has_voted` for account-specific UI checks |

## RPC event metadata

The current `@stellar/stellar-sdk` RPC types expose these metadata fields on
each parsed event response:

- `id`
- `type`
- `ledger`
- `ledgerClosedAt`
- `pagingToken`
- `inSuccessfulContractCall`
- `txHash`
- `contractId`
- `topic`
- `value`

The parsed `getEvents` response also includes:

- `latestLedger`
- `events`
- `cursor`

The raw JSON-RPC response from the current testnet server also includes
provider-window metadata:

- `oldestLedger`
- `oldestLedgerCloseTime`
- `latestLedgerCloseTime`

For proposal discovery, the important replay and audit fields are:

| Field | Why it matters |
| --- | --- |
| `contractId` | Prevents mixing events from different governors |
| `ledger` | Stable ordering and configured start-ledger replay |
| `ledgerClosedAt` | Human-readable time anchor |
| `txHash` | Transaction-level drilldown and dedup support |
| `pagingToken` | Intra-ledger ordering and pagination anchor |
| `cursor` | Opaque pagination checkpoint |
| `id` | Stable provider-level event identifier |

## Representative live testnet payloads

On August 3, 2026, querying the configured governor contract on testnet
returned no retained events inside the provider's current event-history window.

Observed RPC window:

- `oldestLedger`: `3831156`
- `latestLedger`: `3952115`

Observed contract query result:

```json
{
  "events": [],
  "cursor": "0016974208969998335-4294967295",
  "latestLedger": 3952115,
  "oldestLedger": 3831156
}
```

That means a representative live payload for this specific governor contract is
not currently available from the configured testnet RPC provider. The event
schemas above therefore come from the contract dependency source and generated
binding metadata rather than from a retained live contract event sample.

This is consistent with ADR-004's retention warning: proposal discovery can
only rely on direct RPC queries while the configured start ledger remains
inside the provider's retained history window.

## Frontend field mapping

### Current pages in the repo

Current pages read:

- proposals index: `proposalId`, derived `state`
- proposal detail: `proposalId`, derived `state`, wallet-specific `hasVoted`

### Discovery model from ADR-004 plus current detail needs

| Frontend field | Event-provided | Read-derived | Unavailable from current surface | Source |
| --- | --- | --- | --- | --- |
| `proposalId` | Yes | No | No | `proposal_created` topic |
| `contractId` | Yes | No | No | RPC event metadata |
| `createdAtLedger` | Yes | No | No | RPC event metadata `ledger` |
| `createdAtTimestamp` | Yes | No | No | RPC event metadata `ledgerClosedAt` |
| `sourceEventId` | Yes | No | No | RPC event metadata `id` |
| `txHash` | Yes | No | No | RPC event metadata |
| `cursor` / pagination checkpoint | Yes | No | No | RPC response cursor and event paging token |
| `proposer` | Yes | No | No | `proposal_created` topic |
| `description` | Yes | No | No | `proposal_created` value |
| `targets` / `functions` / `args` | Yes | No | No | `proposal_created` value |
| `votingStartLedger` | No | Yes | No | derive as `voteSnapshot + 1` |
| `votingEndLedger` | Yes | Optional | No | `proposal_created.vote_end` or `proposal_deadline` |
| `statusHint` | Partially | Yes | No | creation/cancel/execute events hint; `proposal_state` is authoritative |
| `hasVoted(currentAccount)` | No | Yes | No | `has_voted` read |
| current vote totals | No | Yes | No | requires contract vote-count reads, not events |
| per-account vote reason/history | Yes | No | No | `vote_cast` events |
| queue ETA | Only if queuing is enabled | Maybe | Yes in current deployment | `proposal_queued` is not expected today |

## Gaps and follow-up

1. Public proposal discovery can reconstruct proposal creation records from
   `proposal_created` alone, but not authoritative current state. The app still
   needs contract reads such as `proposal_state`.
2. Wallet-specific UI state such as `hasVoted` is not event-provided and must
   stay read-based.
3. The current testnet RPC provider no longer retains any visible events for
   the configured governor contract, so a deploy-owned start ledger and/or
   indexer escalation remains necessary.
4. If Stolla needs delayed execution semantics in the future, it must enable
   queuing in the contract before `proposal_queued` becomes part of the live
   surface.
5. If frontend work needs canonical decoded event payloads in app code, the
   next step is typed decoding and normalization on top of this inventory
   rather than changing the contract surface immediately.

## Recommendation

Use `proposal_created` as the discovery anchor, treat `proposal_state` and
`has_voted` as read-derived enrichments, and keep `vote_cast` as optional
history/detail data until the app introduces typed event decoding and paginated
public proposal discovery.

## Frontend module

Typed decode, pagination, mapping, deduplication, vote aggregation, and
client Freshness State stubs live under
`apps/web/src/lib/proposal-events/` (public barrel: `@/lib/proposal-events`).
Global and Community surfaces must import that pipeline rather than
parallel governor/proposal event helpers.
