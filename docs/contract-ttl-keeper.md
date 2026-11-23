# Contract instance TTL keeper

Use `npm run keeper:ttl --` from the repository root to inventory and renew the
factory, Community NFT, and Community Governor **instance** entries. Supply every
deployed contract ID that must stay available, including each community pair.
This does not renew WASM code or arbitrary persistent proposal, token, or vote
entries. See the [storage policy](./contract-storage-lifecycle.md) and the
[mainnet runbook](./testnet-to-mainnet-runbook.md) for those separate duties.

The script defaults to testnet. Replace the example IDs with verified IDs from
your deployment record; do not use the dry-run IDs printed by the deploy script.

```bash
npm run keeper:ttl -- list \
  --contract factory=YOUR_FACTORY_CONTRACT_ID \
  --contract nft=YOUR_NFT_CONTRACT_ID \
  --contract governor=YOUR_GOVERNOR_CONTRACT_ID

npm run keeper:ttl -- check \
  --contract factory=YOUR_FACTORY_CONTRACT_ID \
  --contract nft=YOUR_NFT_CONTRACT_ID \
  --contract governor=YOUR_GOVERNOR_CONTRACT_ID

npm run keeper:ttl -- extend \
  --contract factory=YOUR_FACTORY_CONTRACT_ID \
  --contract nft=YOUR_NFT_CONTRACT_ID \
  --contract governor=YOUR_GOVERNOR_CONTRACT_ID
```

`list` prints the configured IDs without network access. `check` reads the
current ledger and instance live-until ledger, prints headroom, and exits
nonzero when any instance has 14 days or less (241,920 ledgers) remaining or
is expired/missing. `extend` is a **dry-run by default**: it shows which
instances would be renewed and never signs or submits a transaction. It
targets 30 days (518,400 ledgers) of headroom and skips entries above the
warning threshold. Set `--warning-ledgers` and `--extend-to-ledgers` to adjust
the thresholds; the warning threshold must be lower than the target.

For a reviewed testnet run, supply a dedicated, funded fee-paying key through
the job's secret manager as `KEEPER_SECRET_KEY`, then add `--submit` to the
`extend` command. The contract's `extend_instance_ttl` function is
permissionless, and the ledger TTL operation likewise needs only a fee payer;
do not use the owner or upgrade key. Never put the secret in a command-line
argument, checked-in file, or job log. The script signs locally, prints each
transaction hash after sending, and checks that the instance TTL increased.
If submission fails ambiguously, use the printed hash to inspect the
transaction before retrying.

Mainnet requires both `--network mainnet --allow-mainnet` and a reviewed
`--rpc-url` for a mainnet provider. The script checks the RPC network
passphrase before constructing a transaction. Follow the mainnet runbook's
independent review and restoration procedure; `--allow-mainnet` is a deliberate
operator gate, not a release approval.

Run `check` at least daily and before low-staffing periods. Schedule `extend`
with `--submit` daily or weekly after a testnet rehearsal, and alert on any
nonzero exit or missed run. Page the storage owner when headroom reaches 14
days; escalate at seven days (120,960 ledgers). An expired or missing instance
needs investigation or restoration, not a blind extension. Record the
transaction hash and post-extension headroom in the operations log.
