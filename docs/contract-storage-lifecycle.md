# Contract storage and TTL policy

Stolla stores durable state in Soroban instance or persistent storage. The
contracts do not use temporary storage directly; temporary NFT approvals come
from `stellar-tokens` and intentionally expire at the caller-selected ledger.

One day is 17,280 ledgers and the operating window is 30 days (518,400
ledgers). `extend_instance_ttl` is permissionless in both contracts so an
operator, keeper, or user can renew configuration before the final day of the
window. Constructors and Stolla-owned entry points also renew the instance.
Expired instance and persistent entries are restorable Soroban state, but
renewal avoids an availability interruption and restoration transaction.

## Community NFT

| State | Storage | Renewal |
|---|---|---|
| Collection metadata, owner, sequential token counter, total-supply checkpoint count | Instance | Constructor and `extend_instance_ttl`; call maintenance at least daily when within the final day |
| Token owner and account balance | Persistent | `stellar-tokens` extends to 30 days when read |
| Custom token URI | Persistent | Mint and `custom_token_uri` extend to 30 days |
| Delegate, voting units, checkpoint count, vote and supply checkpoints | Persistent, except supply checkpoint count | `stellar-governance` extends scalable entries when read; instance maintenance covers the supply checkpoint count |
| Token and operator approvals | Temporary | Intentionally expires at `live_until_ledger`; it is not durable ownership state |

## Community Governor

| State | Storage | Renewal |
|---|---|---|
| Name, version, NFT address, voting delay/period, proposal threshold, quorum checkpoint count | Instance | Constructor and `extend_instance_ttl`; call maintenance at least daily when within the final day |
| Proposal core and quorum checkpoints | Persistent | `stellar-governance` extends to 30 days when read |
| Proposal vote tally and per-voter receipt | Persistent | `stellar-governance` extends an existing entry to 30 days when read |

Contract tests advance both ledger sequence and timestamp, verify all critical
state remains readable, and assert renewal at the one-day threshold. No
proposal, vote receipt, NFT ownership, metadata, delegation, or voting-power
record is intentionally temporary.

## Automated TTL Keeper Script (#393)

Operators can inspect TTL headroom and renew contract instances (`CommunityFactory`, `CommunityNft`, `CommunityGovernor`, `CommunityTimelock`) using [`../scripts/extend-contract-ttl.mjs`](../scripts/extend-contract-ttl.mjs).

### Commands

```bash
# List configured contract IDs and TTL parameters
node scripts/extend-contract-ttl.mjs --list

# Check TTL headroom (dry-run is the default and never submits transactions)
node scripts/extend-contract-ttl.mjs --check

# Extend instance TTLs when headroom is at or below the 29-day threshold (501,120 ledgers)
node scripts/extend-contract-ttl.mjs --extend
```

### Operational Guidance

- **Recommended schedule:** Run `--extend` every 12–24 hours (`0 */12 * * *`) so instances are renewed well before entering the final 24-hour (`17,280`-ledger) window.
- **Auth & key handling:** `extend_instance_ttl` is permissionless on Stolla contracts, so the fee-paying keeper account (`KEEPER_SECRET_KEY`) requires only XLM for transaction fees and holds no administrative or governance privileges.
- **Mainnet safety gate:** The keeper defaults to `testnet` and refuses to run when `STELLAR_NETWORK=mainnet` unless `--allow-mainnet` is explicitly passed.
- **Failure alerts:** Any non-zero exit code (`CONFIGURATION`, `GUARD`, or `ERROR`) writes a structured `[ttl-keeper]` line to `stderr` suitable for cron/CI alert routing.
