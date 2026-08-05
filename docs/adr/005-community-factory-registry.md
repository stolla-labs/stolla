# ADR-005: CommunityFactory and on-chain registry

## Status

Accepted

## Context

Stolla currently deploys one Community NFT and one Governor and places their
addresses in web configuration. Multi-community operation needs an on-chain,
publicly readable mapping from a stable community identifier to an initialized
NFT/Governor pair.

Soroban supports several approaches:

1. An off-chain deployer can deploy both contracts and submit a later registry
   transaction. This is simple, but registration is not atomic with
   initialization and the registry must trust external assertions.
2. A factory can upload WASM, deploy contracts, and register them. Re-uploading
   code per community wastes fees and complicates upgrades.
3. A factory can hold approved NFT and Governor WASM hashes, deploy both with
   deterministic salts, initialize them through constructor arguments, and
   register the pair in the same invocation.

The registry must support stable reads and pagination without putting an
unbounded list in instance storage. It also needs explicit authority,
duplicate handling, upgrade ownership, event semantics, and recovery behavior.

## Decision

Stolla will implement a single `CommunityFactory` contract that owns the
canonical registry and deploys paired contracts from owner-approved WASM
hashes. Community creation is permissioned initially. The factory owner may
later authorize a policy contract or make creation permissionless through a
separate reviewed upgrade.

### Trust and authorization

- `FactoryOwner` is an instance-storage address protected by two-step ownership
  transfer.
- Only `FactoryOwner` may change approved NFT/Governor WASM hashes, upgrade the
  factory, pause creation, or change the creator policy.
- `create_community` requires authorization from `creator`. The initial policy
  also requires `creator == FactoryOwner`.
- Each new NFT owner is the requested `community_owner`, not the factory.
- The Governor has no mutable administrator in the current design. Its NFT
  address and governance parameters are immutable constructor configuration.
- Factory code-hash changes affect only future communities. Existing NFT and
  Governor upgrades remain controlled by their contract-instance upgrade
  authority; production deployment must assign that authority to the
  community owner or its Governor, never silently to the factory operator.

### Identifier and deployment sequence

`community_id` is `sha256(network_id || factory_address ||
creator_address || external_key)`, where `external_key` is caller-supplied
bytes with a maximum documented length. The factory rejects an existing
`community_id`; identifiers are never reused after registration.

The NFT salt is `sha256("nft" || community_id)` and the Governor salt is
`sha256("governor" || community_id)`. Deterministic salts make addresses
predictable for one factory and code hash while domain separation prevents the
pair from colliding.

`create_community` performs one Soroban invocation:

1. Authenticate the creator and validate metadata and governance bounds.
2. Reject `Community(community_id)` if present.
3. Read the approved NFT and Governor WASM hashes.
4. Deploy Community NFT with collection URI, name, symbol, and
   `community_owner`.
5. Deploy Community Governor with the NFT address, voting delay, voting
   period, proposal threshold, and quorum.
6. Verify the resulting addresses are distinct and store the registry record
   plus its ordered index entry.
7. Emit `community_created`.

Soroban invocation semantics are atomic. A constructor, deployment, or storage
failure rolls back both deployments, registry writes, and events. There is no
partially registered pair to repair. Retrying the same input is safe after a
failed transaction. After success, duplicate salts or IDs are rejected.

### Interface

The implementation will expose this conceptual interface:

```text
__constructor(owner, nft_wasm_hash, governor_wasm_hash)
create_community(creator, community_owner, external_key,
                 collection_uri, name, symbol,
                 voting_delay, voting_period,
                 proposal_threshold, quorum) -> CommunityRecord
get_community(community_id) -> Option<CommunityRecord>
list_communities(cursor: Option<u32>, limit: u32)
    -> { records: Vec<CommunityRecord>, next_cursor: Option<u32> }
set_code_hashes(nft_wasm_hash, governor_wasm_hash)
extend_instance_ttl()
```

`CommunityRecord` contains `community_id`, NFT address, Governor address,
creator, community owner, creation ledger, NFT code hash, Governor code hash,
and a metadata URI/hash. Human-readable collection metadata remains in the NFT.
Governance parameters remain authoritative in the Governor. The registry
duplicates only discovery and provenance fields and must not become a second
mutable governance configuration source.

Field types, bounds, update policy, deterministic serialization, and the
versioned off-chain document are specified in the
[community metadata and governance schema](../community-metadata-governance-schema.md).

### Registry storage and pagination

| Key | Storage | Value |
|---|---|---|
| `FactoryOwner`, approved hashes, paused flag, `CommunityCount` | Instance | Bounded factory configuration |
| `Community(BytesN<32>)` | Persistent | `CommunityRecord` |
| `CommunityAt(u32)` | Persistent | Community ID at a stable creation index |

`list_communities` uses an exclusive numeric cursor. `None` starts at index
zero; a response reads ascending indexes and returns the next unread index.
`limit` must be between 1 and 100. Records are append-only, so pagination does
not skip or duplicate entries due to concurrent creation. Clients must still
deduplicate by `community_id` when retrying network requests.

Factory instance state and registry entries use the Stolla 30-day TTL policy.
The constructor and mutating calls renew instance TTL. Registry reads renew
each accessed `Community` and `CommunityAt` entry. A permissionless
`extend_instance_ttl` supports keepers. Registry entries are not temporary and
must remain restorable.

### Events and failures

`community_created` topics contain the community ID, NFT address, and Governor
address. Data contains creator, community owner, creation index, and code
hashes. `factory_code_hashes_changed`, `factory_paused`, and ownership events
are emitted for administrative changes.

Validation errors, duplicate IDs, unauthorized callers, invalid code hashes,
and deployment failures return stable contract errors. Events are emitted only
after all registry writes succeed. Off-chain callers should simulate before
submission and treat a missing success result as no creation.

### Upgrades and migration

The factory stores code hashes rather than embedding WASM. Owner-authorized
hash rotation changes the template for future pairs and emits old/new hashes.
Records preserve the hashes used for each pair. Factory storage migrations
must be additive or versioned; changing identifier or cursor semantics requires
a new factory and an explicit migration registry rather than rewriting IDs.

## Rejected alternatives

- Off-chain deployment plus registration was rejected because it permits
  unverifiable pairs and partial completion.
- A registry separate from the factory was rejected for the first version
  because cross-contract writes add failure modes without a current scaling or
  governance benefit.
- Permissionless creation was deferred because unrestricted deployment spends
  ledger resources and enables registry spam.
- A single vector of all communities in instance storage was rejected because
  it grows without bound and makes every instance read more expensive.
- Mutable registry metadata as the governance source was rejected because it
  can diverge from the deployed contracts.

## Consequences

- Creation and registration are atomic, deterministic, and independently
  verifiable.
- The factory owner is a powerful deployment-policy trust boundary and must be
  secured by multisig or governance before production.
- Communities retain ownership of their NFT and explicit upgrade authority;
  factory template upgrades do not migrate existing contracts.
- Append-only persistent indexes cost more entries but provide bounded,
  deterministic pagination.
- The registry enables public multi-community discovery without an indexer,
  while long-history event aggregation may still require one.

## Follow-up work

- Implement the factory, stable errors, events, storage keys, and generated
  client bindings.
- Add deterministic-address, duplicate-ID, authorization, pagination-limit,
  atomic rollback, and TTL-boundary tests.
- Define governance parameter bounds and metadata size limits.
- Add factory deployment and code-hash rotation tooling.
- Update the web app to discover communities and regenerate bindings.
- Document production multisig, keeper, upgrade, and migration runbooks.
