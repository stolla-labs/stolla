# Transaction Error Catalog (`apps/web/src/lib/transactionErrors.ts`)

Stolla maps Soroban simulation, wallet signing, RPC submission, and IPFS pinning
errors through a centralized catalog in
[`apps/web/src/lib/transactionErrors.ts`](../apps/web/src/lib/transactionErrors.ts)
so raw SDK/XDR strings never leak into primary user-facing alerts.

## Catalog structure

Each entry in `TRANSACTION_ERROR_CATALOG` maps a `TransactionErrorCatalogCode`
to:

- `category`: One of the 9 base `TransactionErrorCategory` buckets (`wallet_rejected`, `wallet_unavailable`, `simulation_failed`, `rpc_unavailable`, `send_failed`, `confirmation_timeout`, `still_pending`, `contract_error`, `unknown`).
- `title`: Short heading for banners or status panels.
- `body`: Plain-language explanation of what happened and whether user state was preserved.
- `cta`: Recommended next step for the user.
- `retryable`: Whether repeating the same action without changing state can succeed.
- `diagnostic`: Truncated raw error message (`<= 500` chars) reserved for collapsible `<details>` inspection.

## Adding a new error mapping

1. Add the new code literal to `TRANSACTION_ERROR_CATALOG_CODES` in `apps/web/src/lib/transactionErrors.ts`.
2. Add its `title`, `body`, `cta`, `category`, and `retryable` metadata to `TRANSACTION_ERROR_CATALOG`.
3. Add matching detection rules in `classifyCatalogCode(error, flow)` before the generic `simulation_failed` / `contract_error` fallbacks.
4. Add unit test cases in `apps/web/src/lib/transactionErrors.test.ts` verifying both `lookupTransactionErrorCatalog` and `mapTransactionError`.
