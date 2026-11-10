# Soroban & Transaction Error Catalog

Stolla maps raw Soroban simulation, contract panic, wallet, and RPC submission failures to plain-language catalog entries in `apps/web/src/lib/transactionErrors.ts`.

| Catalog Code | Category | Title | Suggested Action (CTA) | Retryable |
|---|---|---|---|---|
| `wallet_rejected` | `wallet_rejected` | Wallet request declined | Retry and approve in wallet | Yes |
| `wallet_unavailable` | `wallet_unavailable` | Wallet not connected | Connect or unlock wallet | Yes |
| `insufficient_voting_power` | `contract_error` | Insufficient voting power | Mint or self-delegate membership NFTs before retrying | No |
| `already_voted` | `contract_error` | Vote already recorded | Review your recorded vote on the proposal page | No |
| `proposal_not_active` | `contract_error` | Proposal voting window is not active | Check the proposal state and ledger window | No |
| `propose_cooldown` | `contract_error` | Proposal cooldown active | Wait for the cooldown window to elapse before proposing again | No |
| `unauthorized_owner` | `contract_error` | Owner permission required | Switch to the community owner wallet | No |
| `storage_footprint_restore` | `simulation_failed` | Contract state requires restoration | Restore archived contract storage and retry | Yes |
| `resource_limit_exceeded` | `simulation_failed` | Simulation resource limit exceeded | Reduce batch size or check XLM fee balance | Yes |
| `simulation_failed` | `simulation_failed` | Transaction simulation failed | Verify inputs and retry | Yes |
| `rpc_unavailable` | `rpc_unavailable` | Stellar RPC unreachable | Wait a moment and retry | Yes |
| `send_failed` | `send_failed` | Transaction submission failed | Retry submission | Yes |
| `confirmation_timeout` | `confirmation_timeout` | Confirmation timed out | Check Stellar explorer before retrying | No |
| `still_pending` | `still_pending` | Transaction still pending | View transaction status in explorer | No |
| `contract_error` | `contract_error` | Contract rejected operation | Review community governance requirements | No |
| `unknown` | `unknown` | Unexpected transaction error | Try again | Yes |
