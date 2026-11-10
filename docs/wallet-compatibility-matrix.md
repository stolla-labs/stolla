# Multi-Wallet Compatibility & Smoke Matrix

Stolla uses `@creit.tech/stellar-wallets-kit` in `apps/web/src/context/WalletProvider.tsx` and registers two kit modules out of the box:

1. **Freighter (`FreighterModule` — `freighter`)**
2. **xBull (`xBullModule` — `xbull`)**

---

## 1. Compatibility Matrix

| Wallet Module | Kit Module Import | Supported Browsers | Session / Event Model | Network Passphrase Reporting | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Freighter** | `@creit.tech/stellar-wallets-kit/modules/freighter` | Chromium (Chrome, Brave, Edge), Firefox | Browser extension injection + `KitEventType.STATE_UPDATED` | Returns active passphrase via `getNetwork()` and `STATE_UPDATED` | Primary supported module |
| **xBull** | `@creit.tech/stellar-wallets-kit/modules/xbull` | Chromium, Firefox (extension + web bridge fallback) | Extension or popup bridge + `KitEventType.STATE_UPDATED` | Returns active passphrase via `getNetwork()` and `STATE_UPDATED` | Supported secondary module |

---

## 2. Pass / Fail Criteria for `signTransaction` XDR Round-Trip

Every wallet module included in `buildWalletKitModules()` must satisfy the following checks before release:

1. **Module Registration & Modal Selection (`PASS` / `FAIL`):**
   - `StellarWalletsKit.init` receives both `FreighterModule` and `xBullModule` (`SUPPORTED_WALLET_MODULE_IDS = ["freighter", "xbull"]`).
   - Selecting either module in `authModal()` populates `address`, `walletNetwork`, and `walletNetworkPassphrase` in `WalletContext`.
2. **Module Switching & State Synchronization (`PASS` / `FAIL`):**
   - Emitting `KitEventType.STATE_UPDATED` when switching from Freighter to xBull (or vice versa) updates `address` and `walletNetworkPassphrase` without stale error banners.
3. **Network Passphrase Guard (`PASS` / `FAIL`):**
   - Calling `signTransaction(unsignedXdr, options)` when `walletNetworkPassphrase !== activeNetwork.networkPassphrase` rejects immediately with `"Wallet network does not match the application network."` before invoking the wallet module.
4. **XDR Round-Trip Integrity (`PASS` / `FAIL`):**
   - When the wallet network matches `activeNetwork.networkPassphrase`, `signTransaction(unsignedXdr, options)` forwards `networkPassphrase: activeNetwork.networkPassphrase` to `StellarWalletsKit.signTransaction`.
   - The returned `{ signedTxXdr, signerAddress }` preserves a valid base64 XDR envelope decodable by `TransactionBuilder.fromXDR(signedTxXdr, activeNetwork.networkPassphrase)` and carries a signature for `signerAddress`.

---

## 3. Running Automated Smoke Verification

```bash
npm --workspace apps/web run test -- src/context/WalletProvider.test.tsx
```
