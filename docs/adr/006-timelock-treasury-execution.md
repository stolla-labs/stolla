# ADR-006: Timelocked Governance and Treasury Execution

## Status

Proposed for the full timelocked execution model.

`CommunityTreasury` spend policy is partially implemented. The contract stores a
Timelock address and enforces asset, recipient, per-call, and period limits.
`CommunityTimelock` itself is not implemented here, and Governor queueing
defaults are unchanged. See [Treasury implementation status](#treasury-implementation-status).

This ADR defines the architecture required before Stolla enables privileged or
treasury-bearing proposals. The current deployment remains a signaling-oriented
Governor with immediate, open execution after a proposal succeeds. That model
must not control mainnet assets.

## Context

`CommunityGovernor` currently delegates proposal state and action hashing to
OpenZeppelin `stellar-governance`. Its `execute` wrapper:

- requires the submitted executor address to authorize the call
- reconstructs the proposal ID from targets, functions, arguments, and the
  description hash
- permits execution only after the proposal succeeds
- invokes all proposal targets in one Soroban transaction
- prevents a successfully executed proposal from executing again

The tests added for issues #77 and #85 prove successful execution, rejection
before success, rejection of mismatched action data, and rejection of replay.
The Governor does not override `proposals_need_queuing()`, however, so the
upstream default is `false` and a successful proposal has no review delay.

Stolla needs a model in which each community can control its own treasury and
privileged contracts without giving a deployer or frontend an unrestricted
execution key. The model must fit the future multi-community architecture:
each registry entry identifies an isolated NFT, Governor, Timelock, Treasury,
and policy set. A failure or compromised role in one community must not grant
authority over another.

## Goals

- Put an enforceable delay between approval and privileged execution.
- Make the approved action bytes, timing, and authority auditable on-chain.
- Prevent replay, delay bypass, and partial batch execution.
- Restrict treasury assets, amounts, destinations, and non-treasury calls.
- Keep routine queueing and execution permissionless without making them
  privileged.
- Provide narrowly scoped emergency cancellation while preserving governance
  as the long-term authority.

## Non-goals

- Custodying users' personal assets.
- Supporting arbitrary contract calls in the first mainnet release.
- Implementing streaming payments, swaps, bridges, or yield strategies.
- Replacing community voting rules, quorum, or proposal thresholds.
- Defining a global administrator for all communities.

## Options considered

| Option | Advantages | Rejected because |
| --- | --- | --- |
| Keep direct Governor execution | Smallest change and already tested | A successful proposal can execute immediately; there is no response window or treasury policy boundary |
| Off-chain multisignature treasury | Mature signer workflow and simple contracts | The vote is advisory, signers can refuse or alter an approved action, and execution/replay state is not fully on-chain |
| Delay inside the Governor | Fewer contracts | Couples voting, custody, emergency policy, and upgrades; harder to reuse and audit across communities |
| Shared global timelock | Fewer deployments | Creates cross-community blast radius, policy coupling, and registry/authorization complexity |
| Per-community Timelock plus Treasury | Isolated authority, explicit queue state, reusable policy enforcement, and auditable custody | More contracts, storage, events, deployment steps, and audit surface |

## Decision

Each executable community will have a dedicated `CommunityTimelock` and
`CommunityTreasury`.

1. The NFT determines voting power.
2. The Governor owns proposal and vote state.
3. After a proposal reaches `Succeeded`, anyone may ask the Governor to queue
   it. The Governor is the only authority accepted by the Timelock's `queue`
   entry point.
4. The Timelock stores the exact approved batch, earliest execution ledger,
   expiry ledger, and terminal status.
5. During the executable window, any authenticated account may submit the
   exact batch to `execute`.
6. The Timelock validates the batch against the community policy and invokes
   all calls atomically.
7. The Treasury accepts asset movement and privileged administration only when
   authorized by its Timelock.

There is no global Stolla execution key. A multi-community factory may deploy
and register the four-contract bundle, but it receives no lasting queue,
execution, treasury, or upgrade authority.

## Contract and authority boundaries

| Role | Authority | Explicitly cannot |
| --- | --- | --- |
| Proposer | Create a proposal when the Governor threshold is met; cancel its own proposal only while it is `Pending`, `Active`, or `Succeeded` but not queued | Queue directly, shorten the delay, spend Treasury assets, cancel after queue, or execute early |
| Approver | Vote using NFT voting power at the proposal snapshot | Change action bytes or timing after voting starts |
| Governor | Authorize `queue` for an exact succeeded proposal; update policy only through a separately approved and delayed self-governance action | Execute Treasury calls directly or queue failed/defeated/cancelled proposals |
| Executor | Any account may authorize and relay an executable batch | Change the batch, ETA, expiry, policy, or receive special authority merely by executing |
| Guardian | A configured community emergency multisignature may pause new queue/execution and permanently cancel a queued action | Queue, execute, transfer funds, change policy, upgrade, unpause early, or shorten/bypass a delay |
| Timelock | Sole operational authority of Treasury and governed contracts; enforce queue and policy | Create proposals or approve its own actions |
| Treasury | Hold allowlisted assets and perform policy-compliant payments after Timelock authorization | Accept an EOA/deployer as a second spending authority |
| Bootstrap administrator | Initialize and verify a newly deployed stack | Retain authority after the activation checklist is complete |

The bootstrap administrator must be a deployment multisignature, not one
operator's account. It is removed in the same activation transaction that sets
the Governor and Guardian, or the deployment is not production-ready. A
read-only method must expose whether bootstrap authority remains.

The Guardian is a 2-of-3 or stronger multisignature with signers independent
from the release deployer. Pausing is an emergency availability tradeoff, not
a way to pass an action. A pause:

- takes effect immediately
- blocks new queues and executions but not public reads or cancellation
- lasts at most `MAX_PAUSE_LEDGERS`
- does not move an action's ETA or expiry
- emits its reason hash and end ledger

An action that expires while paused remains expired. Repeated or abusive pauses
are visible and can only be remedied by rotating the Guardian through normal
timelocked governance.

## Lifecycle and boundary rules

The combined lifecycle is:

```text
Pending -> Active -> Succeeded -> Queued -> Executed
                  \-> Defeated       \-> Cancelled
Pending/Active/Succeeded -> Cancelled \-> Expired
```

All time values are ledger sequence numbers (`u32`), not wall-clock timestamps.
The initial mainnet parameters are:

| Parameter | Value | Meaning |
| --- | --- | --- |
| `MIN_DELAY_LEDGERS` | `34,560` | Approximately 48 hours at a five-second ledger close |
| `GRACE_LEDGERS` | `120,960` | Approximately seven days after ETA |
| `MAX_PAUSE_LEDGERS` | `120,960` | Maximum duration of one emergency pause |

The ledger count is authoritative; approximate durations are explanatory only.
Changing any parameter is itself a timelocked governance action. A delay
increase applies to actions queued after the update. A delay decrease also
applies only to later queues and must never recompute an existing ETA.

If queueing succeeds in ledger `Q`:

```text
eta            = checked_add(Q, MIN_DELAY_LEDGERS)
expires_at     = checked_add(eta, GRACE_LEDGERS)
executable     = current_ledger >= eta && current_ledger <= expires_at
expired        = current_ledger > expires_at
```

Consequently:

- execution at `eta - 1` is rejected
- execution at `eta` is allowed
- execution at `expires_at` is allowed
- the first expired ledger is `expires_at + 1`

Checked arithmetic must reject a queue operation on overflow. Neither
cancellation, expiry, pause, retry, policy update, nor contract upgrade can
rewrite `queued_at`, `eta`, or `expires_at`.

`mark_expired(action_id)` is permissionless after the boundary. It records the
terminal state and emits the expiry event. `execute` must also reject an
unmarked but logically expired action. Cleanup is therefore not required for
safety.

## Action identity, uniqueness, and replay protection

The existing Governor proposal ID remains:

```text
keccak256(XDR(targets, functions, args, description_hash))
```

The Timelock derives a domain-separated action ID:

```text
sha256(XDR(
  "stolla.timelock.v1",
  timelock_contract_address,
  governor_contract_address,
  proposal_id,
  targets,
  functions,
  args
))
```

Canonical Soroban XDR encoding is required. Concatenated strings or JSON are
not acceptable encodings. The Timelock recomputes both IDs and verifies that:

- the vectors have equal, non-zero lengths
- the Governor reports the proposal as `Succeeded`
- the submitted bytes match the approved proposal
- no queue record exists for the action ID
- the proposal has not been queued, cancelled, expired, or executed before

Queue records are persistent and terminal records are never deleted or reused.
Their TTL must be extended under the same policy as proposal history. A caller
cannot requeue a cancelled or expired action and receive a fresh delay. A new
vote with a new proposal ID is required.

Proposal tooling must include a unique, human-visible proposal nonce in the
description metadata. This permits governance to intentionally approve the
same payment twice while producing a different proposal ID. A new approval is
not considered replay; execution of one action ID more than once is replay and
must fail.

State changes to `Executing` before target invocation and to `Executed` after
all calls return. Soroban transaction rollback ensures that a failed target
also rolls the temporary `Executing` state back to `Queued`.

## Queue and cancellation authorization

| Transition | Required checks and authorization |
| --- | --- |
| `Pending -> Active` | Ledger boundary in Governor; no caller authority |
| `Active -> Succeeded/Defeated` | Voting deadline, quorum, and vote result in Governor; no caller authority |
| `Pending/Active/Succeeded -> Cancelled` | Exact proposer auth and proposal not yet queued, or Guardian multisig auth |
| `Succeeded -> Queued` | Exact Governor contract auth; Governor verifies succeeded state and exact payload |
| `Queued -> Cancelled` | Guardian multisig auth, action not executing/executed/expired |
| `Queued -> Executed` | Authenticated executor for attribution; exact action; unpaused; ETA reached; not expired; all policy checks pass |
| `Queued -> Expired` | Ledger strictly greater than expiry; permissionless |

Guardian cancellation is terminal and requires a reason hash. It cannot create
a replacement queue entry. Governance cancellation after queue is deliberately
not implemented in v1: an already queued cancellation proposal would itself
arrive too late or create ordering ambiguity. The Guardian is the narrow
emergency path, and a replacement action requires a new vote and full delay.

## Execution policy

Soroban calls do not carry an EVM-style native `value` field. All asset movement
must be an explicit, inspectable contract call. v1 rejects a synthetic values
vector and supports only the following action classes:

1. `CommunityTreasury.pay(asset, recipient, amount, reference)`
2. exact target/function pairs in the community call allowlist
3. policy administration calls to the Timelock itself
4. audited upgrade entry points on the community's own contracts

The policy is deny-by-default. It is stored by the Timelock and is changed only
by an action that passed through that same Timelock.

### Treasury validation

Before any target invocation, the Timelock decodes every Treasury payment and
checks:

- `asset` is a registered Stellar Asset Contract address
- `amount` is an `i128` greater than zero
- `recipient` is a valid address and is not the zero-equivalent or Treasury
  address
- the sum for each asset in the batch does not overflow
- the per-asset batch sum is at or below `max_per_action`
- the amount already executed in the current ledger window plus the batch sum
  is at or below `max_per_window`
- the Treasury's available balance is sufficient
- the action contains no more than `MAX_BATCH_CALLS` calls

The initial constants are `MAX_BATCH_CALLS = 10` and a rolling window of
`17,280` ledgers (approximately 24 hours). `max_per_action` and
`max_per_window` are mandatory per-asset initialization values expressed in
the asset's smallest unit. A zero or missing cap disables spending that asset;
it never means unlimited. Mainnet activation must record each asset contract,
decimals, both raw limits, and independently reviewed human-readable values.

Recipient allowlists are optional per asset. If enabled, every recipient must
be present. Adding an asset, raising a cap, disabling recipient restrictions,
or adding a recipient is a delayed policy action. Removing an asset, lowering
a cap, or removing a recipient is also delayed in v1 to keep one simple,
auditable authority path; the Guardian can cancel an unsafe queued payment
during the delay.

### Treasury implementation status

`CommunityTreasury` in `contracts/contracts/community-treasury` is **partially
implemented**. It does not depend on Timelock source. Spend and policy
administration require authorization from the Timelock `Address` stored at
construction.

Implemented:

- The stored Timelock is the only address that can call `pay`,
  `set_asset_policy`, `set_recipient`, or `remove_asset`.
- Per-asset policy stores `max_per_call`, `max_per_period`, a tumbling
  `period_ledgers` window, and an optional recipient allowlist of at most 32
  addresses. A missing asset, or a zero cap on either limit, rejects spends.
  Zero never means unlimited.
- `deposit(from, asset, amount)` pulls a SEP-41 transfer from an authorized
  depositor and emits `deposited`.
- `pay(asset, recipient, amount, reference)` matches the v1 treasury action
  shape in this ADR. It rejects a non-positive amount, a recipient equal to
  the treasury, an unknown asset, a disabled cap, a per-call overrun, a period
  overrun, a recipient outside an enabled allowlist, and an insufficient
  balance. A successful spend emits `treasury_payment`.
- The period counter resets when
  `current_ledger >= window_start + period_ledgers`. The expected mainnet
  value remains `17,280` ledgers (`DEFAULT_PERIOD_LEDGERS`); the stored policy
  carries the actual length.
- Unit tests cover the allow/deny matrix and callers that do not authorize the
  stored Timelock address.

Remaining gaps:

- `CommunityTimelock` is not in this change. The treasury does not decode a
  queued action, verify an action id, or sum several `pay` calls before the
  first invocation. Each `pay` is capped on its own. Later calls in the same
  window share the period counter.
- `treasury_payment` records the caller-supplied `reference` bytes. It does
  not independently attest an action id from Timelock storage.
- The window is tumbling, not a sliding sum of each earlier payment.
- The contract does not prove that an allowlisted address is a Stellar Asset
  Contract. The Timelock must store a SEP-41 token.
- A direct token transfer that skips `deposit` changes the balance and does
  not emit `deposited`.
- Policy administration is Timelock-authorized, but the delay that should
  precede a policy change lives in the Timelock, which is still absent.
- No upgrade entry point, bootstrap-role revocation, Guardian pause,
  `storage_health`, streaming payments, swaps, bridges, yield, or frontend
  dashboard.
- Spend-counter TTL uses the same 30-day extension as the other contracts.
  Archival restoration is not implemented.
- `CommunityGovernor` still uses immediate execution. Its queueing default was
  not changed.

### Other target calls

An allowlist entry is an exact `(target_contract, function_symbol)` pair.
Allowlisting a target does not allow all its functions. Calls to an account,
unknown contract, factory, registry from another community, or an unlisted
function fail before the first invocation.

Each listed function must have an implementation-specific argument validator.
An exact pair without a validator remains disabled. Generic arbitrary `Val`
forwarding is not approved for v1.

## Atomicity, failures, and retries

The Timelock executes one bounded batch in one Soroban transaction. Soroban
contract invocation is atomic:

- if every target succeeds, all effects and the `Executed` state commit
- if validation or any target fails, all calls, state changes, and successful
  execution events roll back
- partial execution is never retained
- the action remains `Queued` and may be retried with identical bytes while
  still inside its window

Execution order is the approved vector order and must not be sorted or changed.
Call count, encoded argument size, invocation depth, and resource usage must be
bounded and tested. A proposal that cannot fit within network resource limits
must expire and be replaced with smaller independently approved actions; it
must not be split after approval.

A failed Soroban transaction cannot persist a contract failure event because
the transaction rolls back. Monitoring must therefore ingest failed
transaction results for attempted calls to `execute`, including transaction
hash, action ID when decodable, diagnostic events, result code, and resource
usage. A retry uses a fresh transaction and sequence number, but the same
action ID.

## Events

Events use stable symbols and versioned payload schemas. Addresses and action
IDs needed for filtering belong in topics, while larger data belongs in the
value. At minimum:

| Event | Required data |
| --- | --- |
| `action_queued` | action ID, proposal ID, Governor, queued ledger, ETA, expiry, executor policy, action digest |
| `action_executed` | action ID, proposal ID, executor, execution ledger, transaction-correlatable action digest |
| `action_cancelled` | action ID, proposal ID, Guardian/proposer as applicable, cancellation ledger, reason hash |
| `action_expired` | action ID, proposal ID, ETA, expiry, marking ledger |
| `pause_set` | Guardian, start ledger, end ledger, reason hash |
| `pause_cleared` | clearing authority, ledger, original pause end |
| `policy_changed` | policy key, old-value hash, new-value hash, authorizing action ID |
| `treasury_payment` | action ID, asset, recipient, raw amount, reference |
| `wasm_upgraded` | contract, old WASM hash, new WASM hash, authorizing action ID |
| `role_changed` | role, old address, new address, authorizing action ID or bootstrap transaction |

`action_queued` must make the complete action available either in its value or
through a stable `get_action(action_id)` read. Indexers must not infer action
bytes from a frontend. Event consumers follow the pagination, deduplication,
and retention rules in [ADR-004](./004-proposal-discovery.md). Production
monitoring must persist these events because RPC retention is bounded.

## Storage and TTL

The following data is critical and uses persistent storage with explicit TTL
extension:

- queue and terminal action records
- action-to-proposal and proposal-to-action indexes
- policy allowlists, validators, asset caps, and rolling spend counters
- Governor, Guardian, Treasury, and bootstrap role configuration
- delay, grace, pause, and schema-version configuration

Instance code/configuration and executable WASM must also be extended. The
implementation must expose `storage_health()` or equivalent read methods that
return the oldest relevant live-until ledger without leaking secrets. No
critical authorization, replay, or spend-limit record may be intentionally
allowed to expire.

TTL behavior and restoration must be proven by issue #89 before mainnet. An
expired terminal action record could otherwise become a replay vulnerability,
so a deployment without tested extension and archival monitoring is a no-go.

## Upgrades, rollback, and migration

Every production contract exposes an audited upgrade entry point that accepts
only its own Timelock's authorization and an already installed WASM hash.
Upgrades are normal queued actions subject to the full delay. The Guardian
cannot upgrade code. A rollback is another timelocked update to a previously
audited and installed WASM hash; "rollback" does not reverse transactions or
Treasury payments made before it.

The Timelock is self-governed. Its upgrade implementation must preserve queue
records, action identity, role state, policy, and schema version. An upgrade
that changes action hashing, time boundaries, or storage layout requires a new
ADR and migration tests. Queued actions created under one policy version store
that version and are revalidated against both their queued snapshot and the
current policy; the stricter result wins. An upgrade must never make an
existing action execute earlier.

Migration from the current model:

1. Inventory all deployed communities, active proposals, owners, and contract
   WASM hashes.
2. Stop creating executable proposals on the legacy Governor.
3. Execute or cancel existing legacy proposals before the published cutoff.
   They cannot be grandfathered into a queue without a new vote.
4. Deploy and verify the Timelock and Treasury for each community.
5. Deploy or upgrade to a Governor that requires queueing. If the current
   Governor cannot safely upgrade, deploy a new Governor and update the
   registry through its authorized migration path.
6. Transfer NFT mint ownership and all governed upgrade/administrative roles
   to the Timelock.
7. Transfer approved assets into the Treasury only after caps and monitoring
   are active.
8. Revoke bootstrap and deployer authority and prove the revocation with
   public reads.
9. Submit a low-value end-to-end canary proposal and observe queue, delay,
   execution, events, and balances.

Legacy contract IDs remain in the migration record and frontend history. They
must not silently redirect to the new stack.

## Emergency and compromise scenarios

- **Unsafe queued action:** Guardian cancels it with a public reason hash. A
  corrected action needs a new vote and full delay.
- **Active exploit or unknown target behavior:** Guardian pauses, operators
  preserve evidence, cancel affected queues, and governance decides upgrades.
  The pause does not permit an emergency upgrade.
- **Guardian key compromise:** Monitor any Guardian authorization as critical,
  cancel suspicious queued actions only if an uncompromised quorum remains,
  and rotate the Guardian through governance. A compromised Guardian can deny
  service temporarily but cannot spend or execute.
- **Proposer/member key compromise:** Cancel the proposal before queue when
  possible. Voting approval and the delay remain required, so the key alone
  has no Treasury authority.
- **Bootstrap/deployer key compromise before revocation:** Stop activation and
  redeploy or rotate using the deployment multisignature. Do not fund the
  Treasury.
- **Timelock defect:** Pause and cancel exposed actions. Deploying fixed code or
  migrating funds still requires the approved governance path; no concealed
  owner key exists.
- **Bad upgrade:** Use a delayed rollback to the last audited WASM hash. If the
  contract cannot process governance safely, follow an audited migration plan;
  this is a recovery limitation that the security review must accept.

## Security and audit requirements

Before implementation is eligible for mainnet:

- Produce a threat model covering malicious targets, callback/reentrancy,
  confused-deputy authorization, hash ambiguity, storage expiry, resource
  exhaustion, cap bypass, and compromised roles.
- Obtain an independent review of the Governor, Timelock, Treasury, upgrade,
  and migration code and of pinned OpenZeppelin behavior.
- Fuzz canonical action encoding and malformed `Val` argument decoders.
- Verify auth trees for every privileged path; an asserted address parameter
  without `require_auth` is insufficient.
- Prove no target call occurs before all batch and policy validation completes.
- Review every allowlisted target/function and argument validator.
- Reproduce release WASM and record source revision and hashes.
- Exercise the complete test matrix below with TTL advancement enabled.

## Contract test matrix

| Area | Required cases |
| --- | --- |
| Lifecycle | Queue only `Succeeded`; reject Pending, Active, Defeated, Cancelled, Queued, Executed, and Expired |
| Delay | Reject `eta - 1`; allow `eta`; allow `expires_at`; reject `expires_at + 1`; checked-add overflow |
| Authorization | Exact Governor queue auth; proposer cancellation bounds; Guardian multisig cancel/pause; executor auth attribution; bootstrap revocation |
| Identity | Canonical XDR vectors; domain separation across Timelocks/Governors; mismatched target/function/arg/description; duplicate queue |
| Replay | Execute once; retry failed atomic call; reject second success; reject requeue after cancel/expiry; preserve terminal state across TTL advancement |
| Vector validation | Empty vectors; unequal lengths; too many calls; oversized/deep arguments; malformed symbols and addresses |
| Treasury assets | Unknown asset; zero/negative/overflow amount; insufficient balance; decimals recorded; exact successful balance deltas |
| Limits | Exactly at and one unit over per-action cap; rolling-window boundary; multi-call aggregation; counter overflow; disabled zero cap |
| Targets | Unknown target/function; validator rejection; cross-community target; policy update authorization |
| Atomicity | Failure in first/middle/last call; no target, spend counter, event, or execution-state residue; ordered successful batch |
| Pause/cancel | Pause duration boundaries; no ETA/expiry extension; cancel while paused; expired while paused; unauthorized and repeated cancellation |
| Events | Exact topics/values for queue, execute, cancel, expire, payment, policy, role, pause, and upgrade; no success events on rollback |
| Upgrade | Authorized update; unauthorized/Guardian update; storage migration; old queued action cannot execute earlier or under looser policy; rollback hash |
| TTL | Critical records survive the operating window; extension boundaries; archive/restore rehearsal; no replay after restoration |
| Migration | Legacy proposal cutoff; new registry pointer; owner transfer; bootstrap revocation; legacy IDs remain readable |

Integration tests must include a malicious/reentrant fixture, a target that
fails after an earlier target succeeds, multiple assets, two isolated
communities, and RPC event decoding.

## Consequences

- Governance approvals gain an enforceable review and response window.
- Executors and queue relayers can be permissionless without becoming
  authorities.
- Treasury custody and arbitrary privileged calls become constrained by
  contract policy rather than frontend convention.
- Every executable community adds Timelock and Treasury deployment, storage,
  monitoring, and audit costs.
- Emergency power can delay or cancel an approved action but cannot execute one.
- There is intentionally no instant upgrade or hidden recovery owner. Some
  defects may require a delayed migration, which is safer for custody but
  slower during incidents.

## Follow-up implementation work

1. Implement `CommunityTimelock`, canonical action records, lifecycle reads,
   events, and exact auth checks.
2. Finish `CommunityTreasury`. Spend policy, deposit and payment events, and
   the allow/deny tests are in place. Still open: Timelock-verified action
   ids, batch sums, SAC code checks, direct-transfer deposits, upgrade and
   bootstrap revocation, and `storage_health`.
3. Update `CommunityGovernor` to require queueing and expose exact approved
   action data for Timelock verification (`configure_timelock`, `set_timelock`,
   `set_privileged_target`, `get_queued_action`, `verify_approved_action`, and
   `proposals_need_queuing()` returning `true` once Timelock mode is enabled,
   while blocking privileged targets in signaling-only mode).
4. Add per-community deployment/registry integration after the
   CommunityFactory decision in issue #91.
5. Add upgrade entry points and bootstrap-role revocation proofs to every
   governed contract.
6. Implement Guardian multisignature and bounded pause behavior.
7. Add persistent event indexing and alerting for privileged actions.
8. Complete the test matrix, issue #89 TTL coverage, adversarial integration
   tests, and an independent audit.
9. Build proposal-policy decoding in the frontend so users can review assets,
   raw amounts, recipients, targets, ETA, and expiry before voting.
10. Run the testnet-to-mainnet gates in the deployment runbook before custody
    or mainnet activation.
