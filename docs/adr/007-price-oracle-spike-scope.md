# ADR-007: Price-oracle experimental read-only spike scope

## Status

Proposed (parallel to [#266](https://github.com/stolla-labs/stolla/issues/266))

## Context

Issue [#266](https://github.com/stolla-labs/stolla/issues/266) asks Stolla to decide
whether the workspace `price-oracle` contract should be quarantined/removed or
retained with a concrete governance use case. That decision is still open.

Meanwhile the crate exists without any productized web consumer, so contributors
cannot see how a read path would look, and the contract’s role stays abstract
([#394](https://github.com/stolla-labs/stolla/issues/394)).

## Decision (spike only)

Until #266 records a final product decision, Stolla may ship a **minimal
read-only** web consumer behind an explicit opt-in environment contract id:

- Capability gate: `NEXT_PUBLIC_PRICE_ORACLE_CONTRACT_ID` must be set; otherwise
  the UI panel stays hidden.
- Optional feed symbol: `NEXT_PUBLIC_PRICE_ORACLE_FEED` (for example `XLM_USDC`).
- Surface: community settings / debug panel only.
- Labeling: every surface states the spike is **experimental / not for custody**.
- Reads only: call `price` / `price_timestamp`. No submissions from the web app.
- Network: testnet / local deployments only. No mainnet feed configuration in
  docs or defaults.

This spike does **not** decide #266. It proposes evidence for the “retain with a
bounded future use case” alternative while keeping quarantine still available.

## Alternatives considered

1. **Wait for #266 only** — keeps the contract abstract and blocks any UI
   verification of the read path.
2. **Wire oracle prices into Governor / treasury execution now** — rejected;
   custody and governance coupling are explicitly out of scope for #394 and
   unsafe before a trust model exists.
3. **Remove the crate immediately** — belongs to #266, not this spike.

## Security implications

- Passthrough relayer prices are **not** production aggregation. Do not use them
  for custody, liquidation, or proposal execution.
- An unset or wrong contract id must not crash the settings page; the panel is
  simply absent.
- RPC and unset-feed failures must be actionable so operators can fix
  configuration without guessing.

## Follow-up

- Close or update [#266](https://github.com/stolla-labs/stolla/issues/266) with a
  durable product decision (quarantine vs retain).
- If retained, replace this spike ADR with a full trust model, data-source model,
  and milestone gate before any Governor integration.
- If quarantined, remove the panel and env contract together with the crate.

## Related

- [#266](https://github.com/stolla-labs/stolla/issues/266) — product scope decision
- [#394](https://github.com/stolla-labs/stolla/issues/394) — read-only consumer spike
- `contracts/contracts/price-oracle`
