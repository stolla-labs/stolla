# ADR-004: Delayed, Governance-Controlled Execution via Timelock

## Status

Proposed

## Context

MVP proposals are signaling-only — `execute` is open and targets are empty, so
passing a vote has no on-chain effect (noted in ADR-002 and the architecture
doc). To support real treasury disbursements, parameter changes, and other
privileged actions, execution must be:

1. **Authorized** — only proposals that passed a quorum vote may trigger it.
2. **Delayed** — a waiting period between vote success and execution lets the
   community inspect the payload and exit before an unwanted action takes
   effect.
3. **Guarded** — the treasury (and any other privileged contract) must only
   accept calls that originated from the timelock, not from an arbitrary
   account.

Without a timelock controller, these properties cannot be enforced. Adding one
requires decisions about contract topology, delay parameters, cancellation
authority, and how the Soroban execution model constrains the design.

## Decision

Introduce a **`TimelockController`** contract that sits between the Governor and
any privileged target. The Governor queues operations into the timelock after a
vote succeeds; the timelock enforces the delay before allowing execution.

### Contract topology

```
Governor ──propose/vote──▶ Governor state machine
         ──queue──────────▶ TimelockController
                                │  (delay elapses)
                                ▼
                        Treasury / NFT / Governor config
```

The Governor is assigned the **PROPOSER** role on the timelock (it is the only
address that may queue and cancel). Any account may call `execute` once the
delay has elapsed; executor role is set to `address(0)` (open execution). The
timelock itself is assigned the **ADMIN** role on the treasury and on any
contract that needs governance-controlled access.

### TimelockController responsibilities

| Function | Auth | Description |
|----------|------|-------------|
| `schedule(targets, values, calldata, predecessor, salt, delay)` | PROPOSER | Queue a batch of calls; enforces `delay >= min_delay` |
| `execute(targets, values, calldata, predecessor, salt)` | open (EXECUTOR role = zero) | Execute a ready operation |
| `cancel(id)` | PROPOSER or CANCELLER | Remove a pending or ready operation |
| `is_operation_ready(id)` | — | True when timestamp has elapsed |
| `get_min_delay()` | — | Read the current minimum delay |
| `update_delay(new_delay)` | timelock self | Change minimum delay via governance proposal |

Operation state machine: `Unset → Waiting → Ready → Done`.

### Implementation approach

Use the OpenZeppelin `stellar-governance` `TimelockController` if one is
available in the version pinned by ADR-002 (0.7.2). If the crate does not yet
expose a ready-made controller, implement the state machine directly in a new
`contracts/timelock` crate, following the OZ Solidity `TimelockController`
semantics mapped to Soroban persistent storage and ledger-sequence timestamps.

Ledger sequence numbers (not wall-clock time) are used for all delay arithmetic
because they are the canonical monotonic counter available to Soroban contracts.
One ledger ≈ 5 seconds; document the ledger-to-time conversion for parameter
selection.

### Governor integration

The Governor's `execute` function is changed to call `timelock.schedule` instead
of invoking targets directly. A second Governor `execute_timelock` function (or
a flag on the existing one) calls `timelock.execute` after the delay. The
Governor stores the timelock address as an immutable constructor argument.

### Delay parameters (testnet defaults)

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Minimum timelock delay | 1,440 ledgers (≈ 2 hours) | Low friction for testnet iteration |
| Production recommendation | 17,280 ledgers (≈ 24 hours) | Standard DAO practice |

The minimum delay is enforced by the contract; the actual delay per operation is
set by the proposer at queue time and must be ≥ min_delay.

### Treasury contract

A minimal `Treasury` contract is added that holds native/custom token balances
and exposes `transfer(to, token, amount)` protected by an `only_timelock`
guard. Any disbursement requires a successful governance vote followed by the
timelock delay.

### Cancellation

The Governor's existing `cancel` (proposer-only) is extended to also call
`timelock.cancel` for any proposal that has already been queued. A dedicated
**CANCELLER** role on the timelock (initially granted to the deployer multisig /
community owner) can cancel malicious operations independently of the Governor.

### Deploy order

1. Deploy `community_nft`
2. Deploy `community_governor` (constructor takes timelock address — deploy
   timelock first, or use a two-step init)
3. Deploy `timelock_controller` with Governor as PROPOSER, zero address as
   EXECUTOR, and deployer as initial ADMIN
4. Deploy `treasury` with timelock address
5. Renounce the deployer's ADMIN role on the timelock (governance is now
   self-sovereign)
6. Write all contract IDs to `.env.local`

## Consequences

**Positive**

- Treasury disbursements and parameter changes are enforceable on-chain.
- The delay gives the community a reaction window against governance attacks.
- Open execution (executor = zero) means anyone can trigger execution once
  ready, preventing griefing by a single executor.
- Separation of PROPOSER / CANCELLER / EXECUTOR roles allows fine-grained
  emergency controls.

**Negative / tradeoffs**

- End-to-end latency increases: vote period + timelock delay before an action
  takes effect.
- Added contract surface area requires auditing the `TimelockController`
  implementation.
- Ledger-sequence delays are predictable but not expressed in human-readable
  wall-clock time; the UI must translate ledger counts to approximate times.
- Deployer must renounce the ADMIN role after setup; if this step is missed the
  timelock is not truly trustless.
- Empty-target signaling proposals must bypass `schedule` (no targets to queue);
  the Governor must distinguish signaling proposals from executable ones.

## References

- [OpenZeppelin Solidity TimelockController](https://docs.openzeppelin.com/contracts/5.x/governance#timelock)
- [OZ Stellar Contracts `stellar-governance` crate](https://github.com/OpenZeppelin/stellar-contracts)
- ADR-002: OpenZeppelin Compose Strategy
- Architecture doc: "Future Extensions — Timelock + on-chain execution"
