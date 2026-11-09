# Wallet Compatibility & Smoke Matrix

Stolla connects to browser wallets via [`@creit.tech/stellar-wallets-kit`](https://github.com/Creit-Tech/Stellar-Wallets-Kit). While the kit ships adapters for many wallets, Soroban governance flows (`community_factory`, `community_nft`, `community_governor`, and `community_timelock`) require full Soroban `InvokeHostFunctionOp` simulation and transaction signing support.

## Verified vs Unverified Modules

| Module (`productId`) | Wallet Name | Status | Default in UI Copy | Connect (`getAddress` / `getNetwork`) | Read Balance (`get_votes` / NFT balance) | Soroban `signTransaction` | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `freighter` | **Freighter** | **Verified (Default)** | Yes | Pass | Pass | Pass | Primary browser extension wallet; default in UI copy and Playwright smoke flows. |
| `xbull` | **xBull** | **Verified (Secondary)** | No | Pass | Pass | Pass | Verified secondary hot-wallet module covered by automated kit smoke tests (`src/lib/wallet/walletMatrix.test.ts`). |
| `lobstr` | LOBSTR | Unverified | No | — | — | — | Unverified for multi-step Soroban governance simulation/signing in v1. |
| `trezor` | Trezor Hardware Wallet | **Unsupported** | No | Out of scope | Out of scope | Out of scope | Browser hardware bridge dependencies and Soroban host function signing are unsupported. |
| `walletconnect` | Mobile Deep-Link / WalletConnect | **Unsupported** | No | Out of scope | Out of scope | Out of scope | Mobile deep-link session resumption is not enabled in v1. |

## Smoke Verification Path

Automated unit tests in [`apps/web/src/lib/wallet/walletMatrix.test.ts`](../apps/web/src/lib/wallet/walletMatrix.test.ts) verify the `connect -> getNetwork -> read-balance` lifecycle across both `freighter` (default) and `xbull` (secondary), confirming that:

1. Switching between mocked kit modules updates the active session cleanly without crashing `WalletProvider`.
2. Unsupported hardware (`trezor`) and mobile deep-link (`walletconnect`) modules are explicitly rejected by the smoke runner.
3. Freighter remains the default wallet referenced in user-facing error and onboarding copy.
