# CommunityFactory WASM hash rotation runbook

Operator procedure for registering new Community NFT and Community Governor
WASM hashes on a deployed `CommunityFactory` without redeploying the factory.
It implements the code-hash rotation follow-up in
[ADR-005](adr/005-community-factory-registry.md).

**Scope.** Rotation changes the templates used for communities created
*afterwards*. Already-deployed communities keep their code and are never
migrated by this procedure. Mainnet is gated; see
[testnet-to-mainnet-runbook](testnet-to-mainnet-runbook.md).

Tooling: [`scripts/rotate-factory-wasm.mjs`](../scripts/rotate-factory-wasm.mjs)
(Node 20+, Stellar CLI). It calls `set_code_hashes(nft_wasm_hash,
governor_wasm_hash)`, which requires the factory owner's authorization.

## 1. Prechecks

- [ ] The new contracts are built from a reviewed, tagged commit
      (`npm run build:contracts`) and `npm run test:contracts` passes.
- [ ] The release is tested on testnet using this same script before any
      mainnet change.
- [ ] You know the factory contract ID and the network (`testnet` or `mainnet`).
- [ ] The signing identity is the current factory `owner()`. If the owner is a
      multisig, collect signatures out of band using the printed arguments;
      the script refuses to apply with any non-owner identity.
- [ ] The factory is paused (`set_paused true`) if you need to prevent creation
      with mixed templates during the change window. Resume afterwards.
- [ ] Mainnet only: an approved change ID and the runbook gates are complete.

## 2. Compute the hashes

The Soroban WASM hash is the lowercase hex `sha256` of the WASM bytes. Either
let the script compute it from a file or pass a hash that is already installed
on the target network.

```bash
shasum -a 256 contracts/target/wasm32v1-none/release/community_nft.wasm
shasum -a 256 contracts/target/wasm32v1-none/release/community_governor.wasm
```

Hashes must be 64 hex characters and not all zero (the contract rejects the
zero hash with `InvalidCodeHash`).

## 3. Dry-run

Dry-run is the default. It performs no network calls and prints the exact
hashes and every command that `--apply` would run.

```bash
node scripts/rotate-factory-wasm.mjs \
  --factory-id <FACTORY_CONTRACT_ID> \
  --identity <OWNER_IDENTITY> \
  --network testnet \
  --nft-wasm contracts/target/wasm32v1-none/release/community_nft.wasm \
  --governor-wasm contracts/target/wasm32v1-none/release/community_governor.wasm
```

Review the printed `NFT WASM hash`, `Governor WASM hash`, and the
`set_code_hashes` command. Have a second reviewer compare them with the
release record.

## 4. Apply

```bash
node scripts/rotate-factory-wasm.mjs ...same arguments... --apply
```

On `--apply` the script:

1. Enforces the mainnet gates (below).
2. Resolves the signing identity address and reads `owner()`; it **refuses to
   continue unless they match**.
3. Reads `code_hashes()` and prints the current values as the rollback values.
4. Uploads the WASM files (when paths were given; upload is idempotent).
5. Invokes `set_code_hashes`.
6. Re-reads `code_hashes()` and fails if the on-chain hashes differ from the
   expected ones.

Mainnet `--apply` additionally requires:

```bash
export MAINNET_CHANGE_ID=<approved-change-id>
export CONFIRM_MAINNET=I_ACKNOWLEDGE_STOLLA_MAINNET
```

Record the transaction hash and the `factory_code_hashes_changed` event (it
carries the old and new hashes) in the release record.

## 5. Post-checks

- [ ] `stellar contract invoke --id <FACTORY> --network <NET> --send=no -- code_hashes`
      returns the new hashes.
- [ ] A test community created on testnet deploys with the new hashes and its
      `CommunityRecord` stores them.
- [ ] Resume creation if it was paused.

## 6. Rollback

Rotation only affects future communities, so rollback is another rotation to
the previous hashes printed in step 4 (the old hashes must still be installed
on the network, which they are unless their TTL lapsed):

```bash
node scripts/rotate-factory-wasm.mjs \
  --factory-id <FACTORY_CONTRACT_ID> --identity <OWNER_IDENTITY> --network <NET> \
  --nft-hash <PREVIOUS_NFT_HASH> --governor-hash <PREVIOUS_GOVERNOR_HASH> --apply
```

Communities created between the rotation and rollback keep the new templates;
list them from `community_created` events if remediation is needed.

## Tests

```bash
node --test scripts/rotate-factory-wasm.test.mjs
```
