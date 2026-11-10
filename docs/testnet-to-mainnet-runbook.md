# Testnet-to-Mainnet Deployment and Monitoring Runbook

The current NFT and Governor upgrade authority, entry points, and bootstrap
proofs are documented in [Community upgrade entry points](./community-upgrade-entry-points.md).
Timelock and Treasury upgrades remain gated until those contracts exist.

## Purpose and release policy

This runbook defines the evidence, approvals, commands, and operational checks
for promoting a Stolla release from a testnet pilot to Stellar mainnet. It is a
checklist, not evidence by itself. Copy it into a dated release record, fill
every field, attach command output and transaction links, and preserve the
completed record with the release artifacts.

The repository currently deploys only `community-nft` and
`community-governor`, and `scripts/deploy-testnet.sh` is intentionally pinned
to testnet. Do not modify that script into a mainnet deploy command. Mainnet
asset custody is a no-go until the timelock architecture in
[ADR-006](./adr/006-timelock-treasury-execution.md) is implemented, tested, and
independently reviewed.

The release coordinator owns the checklist. Any reviewer may call no-go. A
failed gate is not waived by verbal agreement: record a written risk
acceptance, scope, compensating control, owner, and expiry.

## Roles and separation of duties

Assign named people and backup contacts in the release record. One person may
coordinate, but no person may both perform and independently approve the same
privileged step.

| Role | Responsibility | Must not also be |
| --- | --- | --- |
| Release coordinator | Own checklist, evidence links, freeze, and go/no-go meeting | Sole deployer signer or sole verifier |
| Build operator | Produce clean, reproducible WASM and frontend artifacts | Independent artifact verifier |
| Artifact verifier | Rebuild and compare source, dependency, and WASM hashes | Build operator |
| Deployment proposer | Prepare exact transactions and constructor arguments | Final multisignature quorum alone |
| Deployment signer(s) | Approve hardware-backed deployment and role transactions | Unreviewed build operator |
| Contract verifier | Compare on-chain code, IDs, roles, configuration, and events | Deployment proposer |
| Security approver | Accept audit findings, dependency triage, and threat model | Author of all reviewed changes |
| Frontend operator | Deploy immutable frontend build and configuration | Sole contract verifier |
| Guardian signers | Emergency pause/cancel quorum | Deployer quorum with identical members |
| Monitoring primary/backup | Acknowledge alerts and lead initial triage | Unstaffed or shared mailbox only |
| Incident commander | Own severity, containment, communications, and recovery | Optional during a production incident |

Production deployment, bootstrap revocation, asset transfer, policy/cap
increases, upgrades, and Guardian rotation require multisignature approval plus
an independent verifier. Read-only checks and permissionless queue/execute
relaying do not.

## Release record

Create `release-records/<UTC-date>-<release-name>.md` in the private operations
repository. Do not put secrets in it. Record at least:

```yaml
release_name:
environment: testnet|mainnet
release_decision: pending|go|no-go|rolled-back
decision_time_utc:
source_repository: https://github.com/stolla-labs/stolla
source_revision:
release_tag:
cargo_lock_sha256:
package_lock_sha256:
rustc_version:
cargo_version:
stellar_cli_version:
node_version:
npm_version:
network_name:
network_passphrase:
rpc_primary:
rpc_secondary:
deployment_account_public_key:
bootstrap_multisig_public_key:
guardian_multisig_public_key:
registry_contract_id:
community_factory_contract_id:
community_nft_contract_id:
community_governor_contract_id:
community_timelock_contract_id:
community_treasury_contract_id:
governor_start_ledger:
frontend_commit:
frontend_deployment_url:
monitoring_dashboard_url:
incident_channel:
```

For every contract, add:

```yaml
- contract_name:
  source_revision:
  wasm_file:
  local_wasm_sha256:
  installed_wasm_hash:
  contract_id:
  deployment_transaction_hash:
  deployment_ledger:
  constructor_arguments_redacted: false
  constructor_arguments:
  expected_owner_or_authority:
  verified_by:
  verification_time_utc:
```

Constructor arguments are public and must not contain secrets. Record raw units
alongside display values for quorum, voting periods, asset decimals, Treasury
caps, timelock delay, grace period, and pause bounds.

## Network safety shell

Use a fresh shell for each deployment session. Run this guard first. It has no
default network and refuses mainnet unless the release/change ID and exact
confirmation phrase are present.

```bash
set -euo pipefail

: "${NETWORK:?Set NETWORK explicitly to testnet or mainnet}"
: "${DEPLOYER_IDENTITY:?Set the local Stellar identity alias}"

case "$NETWORK" in
  testnet)
    EXPECTED_PASSPHRASE='Test SDF Network ; September 2015'
    ;;
  mainnet)
    : "${MAINNET_CHANGE_ID:?Set the approved mainnet release/change ID}"
    : "${CONFIRM_MAINNET:?Mainnet confirmation is required}"
    test "$CONFIRM_MAINNET" = 'I_ACKNOWLEDGE_STOLLA_MAINNET'
    EXPECTED_PASSPHRASE='Public Global Stellar Network ; September 2015'
    ;;
  *)
    echo "Refusing unknown network: $NETWORK" >&2
    exit 64
    ;;
esac

: "${NETWORK_PASSPHRASE:?Set and independently verify NETWORK_PASSPHRASE}"
test "$NETWORK_PASSPHRASE" = "$EXPECTED_PASSPHRASE"

DEPLOYER_PUBLIC_KEY="$(stellar keys public-key "$DEPLOYER_IDENTITY")"
printf 'NETWORK=%s\nDEPLOYER=%s\nCHANGE=%s\n' \
  "$NETWORK" "$DEPLOYER_PUBLIC_KEY" "${MAINNET_CHANGE_ID:-testnet-dry-run}"
```

All later commands use `--network "$NETWORK"` (or `-n "$NETWORK"`) explicitly.
Never create a shell alias that supplies a production network implicitly. Stop
if the CLI, RPC response, explorer, passphrase, or expected account disagrees.

Secret handling rules:

- Store seed phrases and signing keys only in approved hardware-backed or
  multisignature custody. Never place them in `.env`, shell history, command
  arguments, CI variables visible to forks, chat, tickets, or release records.
- Prefer offline transaction review/signing for mainnet. The online deploy host
  may hold an identity alias or public key, but not an exported recovery phrase.
- Disable shell tracing (`set +x`) before any signing operation.
- Use a dedicated, minimally funded deployment account. Do not use the
  Guardian, Treasury, personal wallet, or frontend service account.
- Verify signer public keys and thresholds out-of-band before funding.
- Rotate or retire temporary deployer/bootstrap access after activation.

## Gate 0: dependency and architecture readiness

Decision: `[ ] GO  [ ] NO-GO`

- [ ] Issue #89 contract storage and TTL behavior is complete, or a signed risk
      acceptance names the exact untested entries and mainnet compensating
      control.
- [ ] Issue #90 dependency analysis covers the release lockfile revision; every
      browser-reachable critical/high finding is fixed, mitigated, or accepted
      by the Security approver.
- [ ] Issue #91's CommunityFactory/registry decision is accepted if the release
      uses multi-community deployment.
- [ ] [ADR-006](./adr/006-timelock-treasury-execution.md) is accepted and its
      implementation/test matrix is complete if any contract can execute
      privileged calls or custody community assets.
- [ ] No unresolved critical/high audit finding affects authorization,
      execution, upgrades, accounting, storage durability, or signing.
- [ ] OpenZeppelin, Soroban SDK, Rust, Stellar CLI, Node, and npm versions are
      pinned and compatible.

Evidence: issue/ADR links, signed risk acceptances, dependency report, threat
model, audit report and remediation commit.

## Gate 1: release candidate quality

Decision: `[ ] GO  [ ] NO-GO`

From a clean checkout of the exact release revision:

```bash
: "${RELEASE_REVISION:?Set the reviewed full commit SHA}"
test -z "$(git status --porcelain)"
test "$(git rev-parse HEAD)" = "$RELEASE_REVISION"

npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run test:contracts
```

- [ ] CI is green at `RELEASE_REVISION`.
- [ ] Contract unit, boundary, auth-tree, malformed-input, cross-contract,
      upgrade, migration, TTL, and replay tests are green.
- [ ] Frontend unit, transaction lifecycle, public-read, production build, and
      browser smoke tests are green.
- [ ] Mainnet code contains no test keys, testnet contract IDs, permissive
      mock-auth paths, debug-only admin, or disabled policy validation.
- [ ] Generated contract bindings match the release WASM interfaces.
- [ ] The frontend rejects a network/passphrase mismatch and shows contract IDs
      and transaction explorer links for the selected network.
- [ ] Accessibility and supported-wallet checks passed for release-critical
      mint, delegate, propose, vote, queue, and execute views.

Evidence: CI URL, local logs, test counts, reviewed exceptions, frontend build
ID, and source revision.

## Gate 2: reproducible artifacts

Decision: `[ ] GO  [ ] NO-GO`

Use a clean, pinned builder image or documented immutable build environment.
Record tool versions and lockfile hashes before building:

```bash
rustc --version
cargo --version
stellar --version
node --version
npm --version
sha256sum Cargo.lock package-lock.json

rm -rf contracts/target
npm run build:contracts
mkdir -p release-artifacts
cp contracts/target/wasm32v1-none/release/*.wasm release-artifacts/
sha256sum release-artifacts/*.wasm | sort > release-artifacts/SHA256SUMS
sha256sum -c release-artifacts/SHA256SUMS
```

The Artifact verifier independently rebuilds from the same revision and pinned
environment. Do not copy the first operator's `target` directory. Compare:

```bash
: "${INDEPENDENT_SUMS:?Path to independently produced SHA256SUMS}"
diff -u release-artifacts/SHA256SUMS "$INDEPENDENT_SUMS"
```

- [ ] Both builds produce byte-identical WASM.
- [ ] Every artifact maps to one reviewed contract source package.
- [ ] `Cargo.lock`, `package-lock.json`, builder image digest, tool versions,
      source SHA, and WASM SHA-256 values are in the release record.
- [ ] Artifacts are stored in immutable, access-controlled release storage.
- [ ] The deployment proposer and independent verifier sign/approve the hash
      manifest.

If reproducibility fails, the decision is no-go. Diagnose the toolchain or build
inputs; do not bless one unexplained artifact.

## Gate 3: testnet pilot

Decision: `[ ] GO  [ ] NO-GO`

Run the same guarded process with `NETWORK=testnet`; do not use a separate
informal checklist. The pilot must use the release WASM hashes, constructor
arguments, role model, policy, deployment order, frontend build, indexer, RPC
failover, and alert routes intended for mainnet. Only network-specific IDs,
accounts, passphrase, endpoints, and deliberately documented low-value caps may
differ.

- [ ] A new deployment from empty state completed without manual state edits.
- [ ] The pilot remained observable for the agreed operating window and crossed
      at least one TTL renewal cycle or a controlled ledger/TTL rehearsal.
- [ ] Mint, delegate, propose, vote, queue, delay boundaries, execution,
      cancellation, expiry, failed execution retry, and replay rejection passed.
- [ ] Two-community isolation passed if CommunityFactory is in scope.
- [ ] RPC failover, indexer restart/replay, frontend rollback, Guardian pause,
      archived-state restoration, and alert escalation were rehearsed.
- [ ] No unexplained event gap, transaction failure, balance difference, stale
      read, or role mismatch remains.
- [ ] Product, Security, Contract verifier, and Monitoring primary signed off.

Evidence: completed testnet copy of this runbook, deployment manifest, explorer
links, event export, dashboard snapshots, incident drill notes, and sign-offs.

## Gate 4: mainnet pre-deployment

Decision: `[ ] GO  [ ] NO-GO`

Freeze release inputs before funding the deployer:

- [ ] Release revision/tag and all artifact hashes are immutable.
- [ ] Exact constructor/initialization arguments have a machine-readable file
      and a human-reviewed rendering.
- [ ] Mainnet network passphrase, primary and secondary RPC, explorer, fee
      policy, and latest ledger are independently verified.
- [ ] Deployment account public key and balance are correct; available funds
      cover simulation, deployment, initialization, verification, and reserve
      with an approved margin.
- [ ] Bootstrap multisignature, final Timelock, Guardian, Treasury, registry,
      and upgrade authorities are distinct and meet approved thresholds.
- [ ] Treasury asset contract IDs, decimals, recipient policy, per-action raw
      cap, and rolling-window raw cap are independently checked.
- [ ] No Treasury assets are transferred before bootstrap revocation,
      monitoring activation, and post-deploy verification.
- [ ] RPC event ingestion starts at or before the first deployment ledger.
- [ ] Dashboards, paging routes, primary/backup coverage, incident channel, and
      status communication are live.
- [ ] Previous frontend artifact/config is retained for immediate rollback.
- [ ] A maintenance window/change record is open and stakeholders know the
      expected contract IDs will change.

Evidence: reviewed parameter diff from testnet, signer ceremony record, funding
calculation, monitoring test alerts, and final go signatures.

## Deployment procedure

### 1. Reconfirm context

Run the network safety shell, then:

```bash
test "$(git rev-parse HEAD)" = "$RELEASE_REVISION"
sha256sum -c release-artifacts/SHA256SUMS
stellar network ls
stellar keys public-key "$DEPLOYER_IDENTITY"
```

The coordinator reads aloud or screen-shares the network, passphrase, release
SHA, deployer public key, and WASM hashes. A second person confirms each against
the release record.

### 2. Upload and record WASM

Use the exact CLI syntax validated during the testnet dry run. For each artifact:

```bash
: "${WASM_FILE:?Set one reviewed release artifact path}"
test -f "$WASM_FILE"
LOCAL_WASM_SHA256="$(sha256sum "$WASM_FILE" | awk '{print $1}')"

INSTALLED_WASM_HASH="$(
  stellar contract upload \
    --wasm "$WASM_FILE" \
    --source-account "$DEPLOYER_IDENTITY" \
    --network "$NETWORK"
)"

printf 'file=%s\nsha256=%s\ninstalled_wasm_hash=%s\n' \
  "$WASM_FILE" "$LOCAL_WASM_SHA256" "$INSTALLED_WASM_HASH"
```

Record the uploaded WASM hash and transaction/ledger from RPC or explorer.
Uploading code does not authorize it and is safe to do before deploying IDs,
but all fees and hashes still require review.

#### Rotating CommunityFactory approved WASM hashes (`set_code_hashes`)

When rotating the template WASM hashes stored in an existing `CommunityFactory`
(affecting future `create_community` deployments while leaving existing
community contracts untouched), always preview the exact invocation first in
`--dry-run` mode using `scripts/rotate-factory-wasm-hashes.mjs`:

```bash
node scripts/rotate-factory-wasm-hashes.mjs \
  --factory-id "$COMMUNITY_FACTORY_ID" \
  --nft-wasm-hash "$NEW_NFT_WASM_HASH" \
  --governor-wasm-hash "$NEW_GOVERNOR_WASM_HASH" \
  --identity "$DEPLOYER_IDENTITY" \
  --network "$NETWORK" \
  --dry-run
```

After the Contract verifier confirms both 64-character hex hashes against
`release-artifacts/SHA256SUMS`, execute with `--apply` (requiring
`CONFIRM_MAINNET=I_ACKNOWLEDGE_STOLLA_MAINNET` on mainnet) and verify the
emitted `factory_code_hashes_changed` event on-chain.

### 3. Deploy in dependency order

The exact deployment script must be checked in, reviewed, parameterized, and
used unchanged on testnet before mainnet. It must include the network guard and
write a manifest without secrets. Do not assemble a new mainnet command from
chat or shell history.

The logical order is:

1. Registry, if the accepted CommunityFactory architecture uses a separately
   deployed registry.
2. CommunityFactory configured with the registry, approved WASM hashes, and
   temporary bootstrap multisignature, if multi-community is enabled.
3. Community NFT.
4. Community Governor linked to the exact NFT.
5. Community Treasury and Community Timelock, linked so the Timelock is the
   Treasury's sole operational authority.
6. Registry entry binding community identifier, NFT, Governor, Timelock,
   Treasury, metadata, deployment ledger, and schema version.

If the accepted factory implementation atomically creates steps 3-6, invoke it
once and verify every emitted ID and registry record. Never deploy a second
member of a pair after a partial factory failure unless the accepted ADR
defines that recovery path.

For the repository's current single-community, testnet-only ABI, the reviewed
command shapes are:

```bash
: "${NFT_WASM:?Set reviewed NFT WASM path}"
: "${NFT_BASE_URI:?Set collection base URI}"
: "${NFT_NAME:?Set collection name}"
: "${NFT_SYMBOL:?Set collection symbol}"
: "${BOOTSTRAP_OWNER:?Set temporary multisignature owner}"

NFT_ID="$(
  stellar contract deploy \
    --wasm "$NFT_WASM" \
    --source-account "$DEPLOYER_IDENTITY" \
    --network "$NETWORK" \
    -- \
    --uri "$NFT_BASE_URI" \
    --name "$NFT_NAME" \
    --symbol "$NFT_SYMBOL" \
    --owner "$BOOTSTRAP_OWNER"
)"

: "${GOVERNOR_WASM:?Set reviewed Governor WASM path}"
: "${VOTING_DELAY:?Set reviewed ledger count}"
: "${VOTING_PERIOD:?Set reviewed ledger count}"
: "${PROPOSAL_THRESHOLD:?Set reviewed raw voting threshold}"
: "${QUORUM:?Set reviewed raw quorum}"

GOVERNOR_ID="$(
  stellar contract deploy \
    --wasm "$GOVERNOR_WASM" \
    --source-account "$DEPLOYER_IDENTITY" \
    --network "$NETWORK" \
    -- \
    --token_contract "$NFT_ID" \
    --voting_delay "$VOTING_DELAY" \
    --voting_period "$VOTING_PERIOD" \
    --proposal_threshold "$PROPOSAL_THRESHOLD" \
    --quorum "$QUORUM"
)"
```

These two contracts alone are not an approved mainnet custody stack. Once
CommunityFactory, Registry, Timelock, and Treasury exist, replace this subsection
with their exact reviewed ABI generated by the implementation issues. Do not
guess constructor flags.

After each transaction:

- wait for final success; do not infer success from submission
- record transaction hash, ledger, contract ID, and constructor arguments
- compare emitted ID to the expected manifest slot
- stop on any mismatch or ambiguous timeout
- do not rerun blindly: query the original transaction hash and account
  sequence first

### 4. Initialize policy and roles

Using the reviewed deployment script and bootstrap multisignature:

1. Set approved delay/grace/pause ledger counts.
2. Register exact target/function validators.
3. Register Treasury asset addresses, decimals, recipient policy, and non-zero
   raw caps. Missing/zero caps must disable, never unlimit, an asset.
4. Set Governor as sole queue authority and Timelock as sole Treasury/governed
   contract authority.
5. Set Guardian multisignature and verify its threshold out-of-band.
6. Set upgrade ownership to the Timelock.
7. Revoke bootstrap/deployer authority.

Each initialization call needs independent argument review and multisignature
approval. Query state after every call. If any final role still references the
deployer or bootstrap account, stop and do not fund the Treasury.

### 5. Verify on-chain state independently

The Contract verifier uses a different RPC endpoint and machine:

- [ ] Contract IDs exist on mainnet and their executable WASM hashes equal the
      release manifest.
- [ ] Registry and factory point to each other as designed.
- [ ] NFT points to the intended owner/Timelock and exposes expected metadata.
- [ ] Governor points to the NFT and reports exact voting delay, period,
      threshold, quorum, and queue-required behavior.
- [ ] Timelock points to the Governor/Treasury, reports exact delay/grace/pause
      bounds, and has no bootstrap authority.
- [ ] Treasury points only to the Timelock and reports exact asset/cap policy.
- [ ] Guardian address/threshold and upgrade ownership are exact.
- [ ] Cross-community IDs or testnet IDs appear nowhere in configuration.
- [ ] Deployment/role/policy events are present in the persistent indexer.
- [ ] `governor_start_ledger` is the actual deployment ledger and is retained in
      frontend/indexer configuration.

Attach raw read output and verifier signature to the release record.

### 6. Configure and deploy the frontend

Create a mainnet configuration from the verified manifest, never terminal
scrollback:

```dotenv
NEXT_PUBLIC_STELLAR_NETWORK=mainnet
NEXT_PUBLIC_STELLAR_RPC_URL=<approved-mainnet-rpc>
NEXT_PUBLIC_NFT_CONTRACT_ID=<verified-mainnet-nft-id>
NEXT_PUBLIC_GOVERNOR_CONTRACT_ID=<verified-mainnet-governor-id>
NEXT_PUBLIC_GOVERNOR_START_LEDGER=<governor-deployment-ledger>
```

Add Registry, CommunityFactory, Timelock, and Treasury variables when those
bindings are implemented. The Frontend operator and Contract verifier compare
every value to the manifest. Deploy the immutable frontend build associated
with `RELEASE_REVISION`, then record its deployment ID and config checksum.

Do not route all users to it until read-only smoke checks pass. Keep the
previous production deployment address available.

## Post-deployment smoke checks

Use dedicated low-value canary accounts and public metadata. Never lower
governance parameters or bypass the Timelock to make smoke tests faster.

### Immediate read-only checks

- [ ] Health endpoint identifies mainnet, expected source revision, RPC health,
      and verified contract IDs without exposing secrets.
- [ ] Landing, community, proposal list, and proposal detail routes load from a
      clean browser with no wallet.
- [ ] NFT collection metadata and owner are correct.
- [ ] Governor name/version/configuration and proposal state reads are correct.
- [ ] Registry community listing and pagination return the deployed stack.
- [ ] Timelock policy, delay, and role reads match the manifest.
- [ ] Treasury balances are zero or exactly equal the approved canary funding.
- [ ] Primary and secondary RPC return consistent values.
- [ ] Explorer links use mainnet and resolve the exact contracts.

### Signed canary flow

- [ ] Mint one designated canary NFT through the authorized path; verify owner,
      token URI, raw balance change, event, and transaction link.
- [ ] Delegate the NFT to the canary voter; verify current and checkpoint voting
      power.
- [ ] Create a uniquely described low-value proposal with reviewed action bytes;
      verify proposal ID, proposer, snapshot, deadline, and event.
- [ ] Cast For/Against/Abstain from designated canary voters as planned; verify
      auth, `has_voted`, weights, totals, and events.
- [ ] Verify state changes only at documented voting boundaries.
- [ ] Queue the succeeded proposal; verify action ID, exact bytes, ETA, expiry,
      and queue event.
- [ ] Prove execution at `eta - 1` is rejected without state or balance change.
- [ ] Execute at or after ETA with a permissionless canary executor; verify
      target/Treasury balance deltas, proposal/action state, and events.
- [ ] Prove a second execution is rejected.

The full mainnet canary may span the normal voting and timelock periods. The
release remains under heightened monitoring until it completes. Use a
pre-approved minimal amount and recipient; do not use customer funds.

## Final activation gate

Decision: `[ ] GO  [ ] NO-GO`

- [ ] Independent on-chain verification passed.
- [ ] Immediate reads and all currently reachable canary stages passed.
- [ ] Bootstrap/deployer has no retained privileged role.
- [ ] Monitoring received real deployment, role, and canary events.
- [ ] Synthetic test alerts reached primary and backup responders.
- [ ] No unexplained failed transaction or frontend error spike exists.
- [ ] Frontend configuration checksum matches the verified contract manifest.
- [ ] Product, Security, Contract verifier, Frontend operator, and Monitoring
      primary recorded GO.

Route production traffic gradually. Record activation time and ledger. Continue
heightened monitoring through the completed governance/execution canary and at
least one scheduled TTL extension check.

## Monitoring specification

Every alert has a primary owner, backup, destination, runbook link, and
acknowledgement timer. Use a persistent event indexer; direct RPC event history
is not durable enough for incident evidence.

| Signal | Warning threshold | Critical/page threshold | Destination | Owner and response |
| --- | --- | --- | --- | --- |
| Contract event ingestion lag | More than 3 ledgers for 2 minutes | More than 12 ledgers or any detected event gap | Ops channel, then pager | Monitoring primary; fail over RPC/restart from durable cursor |
| Failed contract transactions | 3 in 5 minutes per method | Any privileged-call failure or 10 total in 5 minutes | Ops channel/pager | Contract on-call; classify result codes and preserve diagnostics |
| RPC primary health | 3 failed/slow probes in 2 minutes or p95 > 5s | Primary and secondary unavailable for 2 minutes | Ops channel/pager | Platform on-call; switch reads, pause submissions |
| Frontend health | 2 consecutive failed probes or p95 > 3s | Unavailable 5 minutes | Frontend channel/pager | Frontend on-call; rollback immutable deployment/config |
| Browser error rate | > 2% sessions for 10 minutes | > 5% for 5 minutes | Frontend channel/pager | Frontend on-call; compare release/config and RPC |
| User transaction failure rate | > 5% for 10 minutes | > 10% for 5 minutes, excluding user rejection | Product/contract channel/pager | Contract on-call; segment by method/wallet/RPC |
| Remaining critical TTL | <= 518,400 ledgers (~30d) | <= 241,920 (~14d); emergency at <= 120,960 (~7d) | Ops channel/pager | Storage owner; extend or restore using reviewed transaction |
| Queue timing | Due action unobserved for 1 hour | Early execution accepted, ETA changed, or action expires within 24h unexpectedly | Governance channel/pager | Governance on-call; validate state and cancel/pause if unsafe |
| Privileged events | Any expected event is informational | Any unexpected role, policy, upgrade, pause, cancel, or bootstrap event | Security pager | Security/Guardian; verify tx and invoke incident plan |
| Treasury movement | Any successful/rejected payment notifies | Unknown asset/recipient, cap anomaly, or balance mismatch of one raw unit | Treasury/Security pager | Contract verifier; pause/cancel and reconcile |
| Registry/factory integrity | Any new community or update notifies | Duplicate, changed pair, unknown WASM, or cross-community link | Governance/Security pager | Registry owner; stop frontend discovery and investigate |
| Deployment account activity | Any post-activation use warns | Any privileged post-revocation use | Security pager | Security approver; verify revocation/compromise |

Approximate TTL durations assume five-second ledger closes; alert calculations
use ledger counts. Review thresholds when protocol limits, close cadence, RPC
retention, or operating coverage changes.

Dashboards must show:

- latest network and indexed ledger, ingestion lag, cursor, and event gaps
- RPC availability/latency/result errors by endpoint
- transactions by contract/method/status/result code and confirmation latency
- proposal lifecycle, queue ETA/expiry, cancellations, retries, and executions
- Treasury balances, payments, spend-window use, and configured caps
- current WASM hash, roles, policy version, and configuration drift
- minimum live-until ledger by contract and critical storage category
- frontend health, source revision, browser errors, wallet/RPC failures, and
  active configuration checksum

Retention must cover the audit/legal requirement and at least one full
governance lifecycle. Preserve raw event XDR, transaction hash, ledger,
timestamp, contract ID, decoded schema version, and decoder version.

## TTL extension and archival recovery

### Routine extension

The storage owner reviews the TTL dashboard weekly and before any period with
reduced staffing. Extend well before warning threshold using a transaction
generated and simulated on the exact network. The pinned Stellar CLI command
surface must be validated during the testnet drill:

```bash
: "${CONTRACT_ID:?Set one verified contract ID}"
: "${EXTEND_TO_LEDGERS:?Set reviewed extension ledger count}"

stellar contract extend \
  --id "$CONTRACT_ID" \
  --ledgers-to-extend "$EXTEND_TO_LEDGERS" \
  --durability persistent \
  --source-account "$DEPLOYER_IDENTITY" \
  --network "$NETWORK"
```

Do not assume extending contract instance/code extends every persistent entry.
Inventory and exercise contract-specific bump methods required by issue #89.
After confirmation, query all critical categories and record their new
live-until ledgers.

### Archived state

1. Stop affected writes and mark reads degraded; do not redeploy over missing
   state.
2. Identify exact archived keys, last known values, live-until ledgers, and
   dependent proposals/actions.
3. Generate and simulate restoration using the pinned CLI and a reviewed
   footprint. A typical contract-instance rehearsal starts with:

   ```bash
   : "${CONTRACT_ID:?Set the verified archived contract ID}"
   stellar contract restore \
     --id "$CONTRACT_ID" \
     --durability persistent \
     --source-account "$DEPLOYER_IDENTITY" \
     --network "$NETWORK"
   ```

4. Obtain the same multisignature/independent review required for the affected
   state. Confirm current CLI syntax with `stellar contract restore --help`;
   never improvise a mainnet footprint.
5. Submit once, wait for finality, then extend restored entries.
6. Verify roles, balances, proposal/action terminal records, replay protection,
   registry links, and WASM hash before reopening writes.
7. Backfill the indexer and document the archival root cause.

If a replay-prevention, authority, balance, or policy record cannot be restored
exactly, treat it as Severity 1 and do not resume execution.

## Incident classification and escalation

| Severity | Examples | Acknowledge | Escalation |
| --- | --- | --- | --- |
| SEV-1 | Unauthorized/early execution, Treasury loss, compromised privileged quorum, replay, corrupted authority/state | 5 minutes | Page Incident commander, Security, Guardian, Contract owner; open incident channel immediately |
| SEV-2 | Mainnet writes unavailable, both RPCs down, critical TTL, bad deployment before funding, widespread transaction failure | 15 minutes | Page primary/backup and coordinator; escalate to SEV-1 if custody/integrity at risk |
| SEV-3 | Single RPC degraded, frontend regression with healthy contracts, delayed indexing without gap | 30 minutes | Team channel and ticket; page if threshold worsens |

The first responder:

1. Declares severity and Incident commander.
2. Preserves transaction hashes, raw RPC responses, event/indexer cursor,
   frontend build/config, signer logs, and timestamps.
3. Stops automated submissions and frontend write affordances if duplicate or
   unsafe writes are possible.
4. Uses Guardian pause/cancel only when its documented conditions are met.
5. Communicates known facts, impact, and next update time. Do not speculate.
6. Tracks every containment and recovery transaction through independent review.

## Scenario procedures

### Key compromise

1. Determine which public key, role, threshold, and pending transactions are
   exposed.
2. Stop using the key and revoke service sessions; do not move secrets through
   chat.
3. If a Guardian quorum remains trustworthy, pause and cancel suspicious queued
   actions.
4. For deployer/bootstrap compromise before revocation, stop activation and
   redeploy or rotate before funding.
5. For Guardian compromise, treat every Guardian event as hostile and rotate
   via normal timelocked governance. Guardian cannot spend or upgrade.
6. For proposer/member compromise, cancel unqueued proposals where authorized;
   the key alone must not grant Treasury authority.
7. Verify all roles and recent events from a secondary RPC, rotate affected
   keys with required multisignature approval, and monitor for recurrence.

### Bad contract deployment or initialization

1. Do not transfer assets, publish the frontend config, or register the stack.
2. Record the bad IDs as abandoned; on-chain deployment cannot be undone.
3. If the factory transaction failed atomically, prove no registry or child
   state committed before retrying.
4. Fix source/parameters through normal review, produce new artifacts if code
   changed, and rerun all affected gates.
5. Deploy new IDs and verify them independently. Never conceal or silently
   reuse an incorrect manifest.
6. If already active, pause/cancel unsafe actions, hide writes, and use the
   accepted timelocked upgrade/migration path.

### RPC outage or ambiguous submission

1. Disable new write submissions in the frontend; public reads may fail over.
2. Query the original transaction hash and source account sequence on primary
   and secondary RPC before signing anything again.
3. If status is pending/unknown, wait for the documented finality timeout and
   continue querying. Do not duplicate a deployment or payment.
4. Fail over to the approved secondary only after confirming network
   passphrase and latest ledger.
5. Reconcile all transactions/events and replay the indexer from its durable
   cursor after recovery.

### Frontend regression or bad configuration

1. Confirm contracts and RPC are healthy independently of the frontend.
2. Disable write routes if network/ID mismatch or duplicate submission is
   possible.
3. Roll traffic back to the previous immutable frontend deployment and its
   matching configuration checksum.
4. Purge only versioned frontend caches; do not delete on-chain/indexer history.
5. Verify public reads and wallet network checks, then restore traffic.

### Unsafe queued action or contract exploit

1. Verify action ID, proposal, exact bytes, ETA/expiry, and affected assets.
2. Guardian cancels the unsafe queued action, or pauses when multiple/unknown
   actions are exposed. Record the reason hash.
3. Do not alter ETA, execute a corrective call early, or use an unapproved key.
4. Remediate through a new proposal, full vote, and full delay. A code rollback
   is a timelocked upgrade to a previously audited WASM and does not reverse
   prior effects.
5. Reconcile Treasury and contract state before clearing the incident.

## Rollback decision tree

On-chain transactions are final; "rollback" means containing further effects
and moving forward through an approved code/config/migration path.

- **Before any deployment transaction:** abort, correct evidence/parameters,
  and reconvene the failed gate.
- **Code installed, no contract deployed:** leave the unused hash recorded;
  deploy only after correction.
- **Bad IDs deployed, no assets/registry/frontend:** abandon and redeploy.
- **Bad registry entry, no assets:** use its authorized update/migration path;
  do not mutate storage out of band.
- **Bad governed code, Timelock operational:** Guardian contains unsafe queues;
  governance performs delayed rollback/upgrade.
- **Timelock cannot safely process governance:** keep execution paused and use
  only the independently audited migration path accepted for that release.
- **Frontend only:** roll back to previous immutable deployment/config.
- **Data/indexer only:** stop writes if state is ambiguous, restore/replay from
  durable chain data, and prove no event gap before reopening.

Every rollback gets a release-record status, incident link, abandoned/new IDs,
balance reconciliation, and a fresh go/no-go review.

## Testnet reset and redeployment

Use reset for an intentionally disposable pilot, not to erase evidence:

1. Mark the old environment read-only and export its manifest, events, balances,
   final ledger, TTL state, and open proposal/action IDs.
2. Record old contract IDs as retired. Remove them from active frontend/indexer
   config but keep them in historical records.
3. Create new testnet deployment and bootstrap identities. Do not reuse a
   compromised identity.
4. Run the network guard with `NETWORK=testnet`; build/verify the intended
   release artifacts.
5. Deploy in the same dependency order and role model as mainnet.
6. Set the new Governor start ledger, clear only environment-scoped frontend
   caches, and start a fresh durable indexer cursor.
7. Run the complete signed canary flow, TTL restore/extend drill, RPC failover,
   Guardian drill, and monitoring test alerts.
8. Obtain pilot sign-off and attach the completed checklist to Gate 3.

Testnet friendbot funding and `scripts/fund-testnet.sh` are testnet-only. There
is no mainnet equivalent in this repository.

## Closeout

- [ ] Release record is complete, immutable, and access-controlled.
- [ ] Source, lockfiles, artifact hashes, installed hashes, contract IDs,
      passphrase, arguments, transaction hashes, and deployment ledgers match.
- [ ] All temporary roles and excess deployer funds are removed according to
      policy.
- [ ] Dashboards and paging have named primary/backup owners.
- [ ] The mainnet canary and first TTL check are complete or tracked as explicit
      release follow-ups under heightened monitoring.
- [ ] Any incident, risk acceptance, abandoned deployment, or manual deviation
      has an owner and durable record.
- [ ] Operators schedule a retrospective and update this runbook when commands,
      ABI, network behavior, or incident lessons change.
