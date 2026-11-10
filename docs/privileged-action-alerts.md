# Privileged Timelock and Treasury Action Alerts (#404)

This document defines the event field schemas and consumer worker for privileged governance execution and treasury spend alerts (ADR-006 follow-up #7).

## Privileged Event Schemas

| Event Topic | Contract Source | Severity | Required Fields |
|---|---|---|---|
| `action_queued` | `CommunityTimelock` | `warning` | `contractId`, `ledger`, `actionId`, `proposalId`, `etaLedger`, `expiresAtLedger` |
| `action_executed` | `CommunityTimelock` | `critical` | `contractId`, `ledger`, `actionId`, `proposalId`, `actor` (`executor`) |
| `action_cancelled` | `CommunityTimelock` | `warning` | `contractId`, `ledger`, `actionId`, `proposalId`, `actor` (`Guardian`/`proposer`), `reasonHash` |
| `treasury_payment` | `CommunityTreasury` | `critical` | `contractId`, `ledger`, `actionId`, `asset`, `recipient`, `amount`, `reference` |

## Running the Alert Consumer Worker

The alert consumer (`scripts/alert-privileged-actions.mjs` and `apps/web/src/lib/alerts/privilegedActions.ts`) transforms privileged events into versioned alert payloads (`schemaVersion: 1`).

```bash
# Log-only mode (default when PRIVILEGED_ALERT_WEBHOOK_URL is unset)
PRIVILEGED_EVENTS_FILE=./fixtures/events.json node scripts/alert-privileged-actions.mjs

# Webhook delivery mode
PRIVILEGED_EVENTS_FILE=./fixtures/events.json \
PRIVILEGED_ALERT_WEBHOOK_URL=https://hooks.example.com/stolla-alerts \
node scripts/alert-privileged-actions.mjs
```

### Soft-Fail Guarantee

When `PRIVILEGED_ALERT_WEBHOOK_URL` is omitted or empty, the consumer never crashes; it operates in `log_only` mode and writes structured JSON lines to `stdout`.
