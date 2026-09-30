# CommunityFactory

`CommunityFactory` atomically deploys a Community NFT and Governor from
owner-approved WASM hashes and appends the pair to an on-chain registry. Its
design follows
[ADR-005](../../../docs/adr/005-community-factory-registry.md), and creation
inputs follow the
[community metadata and governance schema](../../../docs/community-metadata-governance-schema.md).

## Public API

| Function | Authorization | Result |
|---|---|---|
| `__constructor(owner, nft_wasm_hash, governor_wasm_hash)` | deployment | Initializes owner, approved templates, pause state, and count |
| `community_id(creator, external_key)` | none | Derives the network- and factory-specific canonical ID |
| `create_community(creator, request)` | creator; creator must be owner in v1 | Deploys and initializes the pair, stores it, and emits `community_created` |
| `get_community(id)` | none | Returns `Option<CommunityRecord>` |
| `list_communities(cursor, limit)` | none | Returns records in creation order and an exclusive next cursor |
| `community_count()` | none | Returns the append-only registry size |
| `owner()`, `code_hashes()`, `is_paused()` | none | Reads factory configuration |
| `set_code_hashes(nft, governor)` | owner | Changes templates for future communities |
| `set_paused(paused)` | owner | Pauses or resumes creation |
| `transfer_ownership(new, deadline)`, `accept_ownership()` | current/new owner | Performs two-step ownership transfer |
| `extend_instance_ttl()` | none | Renews bounded instance state for keepers |

`list_communities` accepts limits from 1 through 100. `None` starts at index
zero; a cursor is the next unread index. Records and index entries are
persistent and are renewed to the 30-day policy when accessed.

Community IDs are:

```text
sha256(network_id || factory_address_scval_xdr ||
       creator_address_scval_xdr || external_key)
```

Child salts are `sha256("nft" || community_id)` and
`sha256("governor" || community_id)`. Soroban invocation atomicity ensures
that a failed second deployment leaves neither the first child nor a registry
entry behind.

## Client bindings

The `#[contract]`, `#[contractimpl]`, `#[contracttype]`, `#[contracterror]`,
and `#[contractevent]` declarations embed the Soroban contract specification
in the built WASM and generate `CommunityFactoryClient` for Rust tests.
External bindings should be generated from the release WASM with the current
Stellar CLI, for example:

```sh
stellar contract bindings typescript \
  --wasm target/wasm32v1-none/release/community_factory.wasm \
  --output-dir bindings/community-factory
```

Regenerate bindings whenever a public function, contract type, error, or event
changes. Generated clients must preserve the contract's integer widths and use
`bigint`/decimal strings for `u128` values.

## Tests

`src/test.rs` covers the registry end to end against the built NFT and
Governor test WASM: a successful `create_community` and its `community_created`
event, unauthorized-creator rejection, pause/validation failures that leave no
registry writes behind, two-step ownership transfer (creation authority only
moves after `accept_ownership`), and `list_communities` pagination boundaries
(empty registry, a full page, the final partial page, and out-of-range
cursors/limits).

Run only this contract's suite from `contracts/`:

```sh
cargo test -p community-factory
```

or the whole contract workspace from the repository root with
`npm run test:contracts` (see [CONTRIBUTING.md](../../../CONTRIBUTING.md)).
