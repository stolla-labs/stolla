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

## Automated instance TTL keeper (`scripts/extend-instance-ttl.mjs`)

Operators can inspect TTL headroom and renew `CommunityFactory`, `Community NFT`,
and `Community Governor` instance TTLs with [`scripts/extend-instance-ttl.mjs`](../scripts/extend-instance-ttl.mjs):

```bash
# List discovered contract IDs from apps/web/.env.local or environment
node scripts/extend-instance-ttl.mjs --list

# Check current ledger sequence and TTL headroom
node scripts/extend-instance-ttl.mjs --check

# Preview extend_instance_ttl invocations (default --dry-run never submits transactions)
node scripts/extend-instance-ttl.mjs --extend --dry-run

# Submit extend_instance_ttl transactions on testnet and log transaction hashes
node scripts/extend-instance-ttl.mjs --extend --apply --identity keeper --network testnet
```

### Schedule, key handling, and alerting guidance

- **Recommended schedule:** Run `--check` every 6 hours and `--extend --apply`
  at least once every 24 hours (or whenever headroom enters `RENEW_NOW`, i.e.,
  $\le 17,280$ ledgers remaining). Because the renewal window is 30 days
  ($518,400$ ledgers), a daily job provides a 29-day buffer before expiration.
- **Auth key handling:** `extend_instance_ttl` is permissionless on-chain.
  Configure a dedicated low-balance fee-payer identity (`--identity keeper`) in
  Stellar CLI rather than using the `FactoryOwner` or `CommunityOwner` admin
  keys.
- **Mainnet safety gate:** The script refuses `mainnet` / `public` networks
  unless `--allow-mainnet` is passed explicitly.
- **Failure alerts:** Non-zero exit codes and `[ttl-keeper] EXTEND_FAILED` or
  `[ttl-keeper] RPC_ERROR` stderr lines should trigger operator alerts in cron
  or CI runners. Successful renewals log
  `[ttl-keeper] EXTENDED <label> (<contractId>) network=<net> txHash=<hash>`.
