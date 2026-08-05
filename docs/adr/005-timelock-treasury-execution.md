# ADR 005: Timelock and Treasury Execution

**Status:** Proposed  
**Date:** 2026-08-05  
**Deciders:** Stolla Labs  

## Context

The Stolla protocol currently lacks a governance-controlled execution layer for treasury and privileged actions. Without a timelock mechanism, governance decisions take effect immediately, which introduces risks: voters have no time to react to passed proposals, and malicious proposals can be executed before the community can intervene.

We need an architecture that introduces a mandatory delay between proposal approval and execution, with clear role boundaries, replay protection, and emergency controls.

## Decision

We will implement a **timelock controller** contract with the following design:

### State Machine

```
Proposed → Queued → Executed
                ↘ Cancelled
```

1. **Proposed**: A governance proposal passes and is submitted to the timelock.
2. **Queued**: The proposal enters a timelock period (default: 48 hours / ~34,560 Stellar ledgers).
3. **Executed**: After the timelock expires, any executor can trigger execution within the grace period (24 hours).
4. **Cancelled**: A guardian or the original proposer may cancel a queued (but not yet executed) proposal.

### Roles and Boundaries

| Role | Authority |
|------|-----------|
| **Proposer** | Submits approved proposals to the timelock; may cancel own proposals |
| **Executor** | Executes queued proposals after timelock expiry; permissionless after grace |
| **Guardian** | May cancel any queued proposal in emergency; controlled by multisig |
| **Treasury** | Holds protocol assets; only callable by timelock |

### Timelock Parameters

- **Default delay**: 48 hours (configurable by governance)
- **Grace period**: 24 hours after timelock expiry
- **Minimum delay**: 12 hours (immutable floor, prevents zero-delay attacks)
- **Maximum delay**: 7 days

### Execution Targets

The timelock may only interact with pre-approved target contracts registered in a whitelist:
- Treasury contract (asset transfers)
- Governor contract (parameter updates)
- Community NFT contract (metadata updates)
- Upgrade proxy (contract upgrades)

All function calls are restricted to predefined selectors with value limits:
- Treasury transfers capped at 100,000 USDC equivalent per proposal
- Only `transfer`, `update_config`, and `set_metadata` selectors are allowed
- No `delegatecall` or raw calls permitted

### Cross-Contract Safety

- Each proposal is identified by a unique `proposal_id` (hash of target + selector + params + salt)
- Replay protection: executed and cancelled proposal IDs are stored permanently on-chain
- Atomicity: each proposal executes exactly one function call; batches are explicitly out of scope for v1
- On failure: execution reverts entirely; proposal remains queued for retry within grace period
- Events: `ProposalQueued`, `ProposalExecuted`, `ProposalCancelled`, `ProposalExpired` emitted

### Emergency Controls

- **Guardian multisig** (3 of 5) can:
  - Cancel any queued proposal
  - Pause the timelock (prevents new queuing)
  - Unpause the timelock
- **Upgrade path**: timelock itself is upgradeable via governance with a 7-day mandatory delay
- **Migration**: a one-time migration function moves assets from current direct-execution model to timelock-gated treasury

### Rejected Alternatives

1. **No timelock (status quo)**: Rejected because it exposes treasury to instant-execution risk.
2. **Multi-sig without timelock**: Rejected because it centralizes control; timelock adds a time buffer for community reaction.
3. **Optimistic timelock (veto-only)**: Rejected because it requires active monitoring; a mandatory delay is simpler and safer.
4. **On-chain veto by token vote during timelock**: Considered for v2; adds complexity without clear benefit for v1.

## Testing and Audit Requirements

Before implementation:

1. **Unit tests**:
   - Queue → execute (happy path)
   - Queue → expire (grace period exceeded)
   - Queue → cancel (guardian)
   - Queue → cancel (proposer, before expiry)
   - Replay protection (duplicate proposal ID)
   - Unauthorized execution (non-executor)
   - Pause/unpause

2. **Integration tests**:
   - Full governance → timelock → treasury flow
   - Emergency cancel during active proposal
   - Upgrade with mandatory delay

3. **Audit scope**:
   - Timelock controller contract
   - Treasury integration
   - Upgrade proxy integration
   - Role-based access control

## Consequences

### Positive
- Treasury actions have a public waiting period, giving the community time to react
- Clear role separation reduces single-point-of-failure risks
- Emergency controls provide a safety valve without compromising decentralization

### Negative
- Adds latency to all governance actions (intentional trade-off)
- Increases gas/storage costs per proposal
- Guardian role introduces a trusted component that must be carefully managed

### Neutral
- Requires ongoing maintenance of the target contract whitelist
- Adds one more contract to the deployment and upgrade pipeline
