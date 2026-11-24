# Multi-wallet smoke matrix (Freighter + Lobstr)

Production assumes a Freighter-shaped connect flow. Other
`@creit.tech/stellar-wallets-kit` modules ship with the dependency but are not
all safe or verified to enable. This document records the minimal
**connect → read NFT balance** path covered by kit mocks, and which modules
must stay disabled.

## Smoke path

1. Initialize `StellarWalletsKit` with one selected hot-wallet module.
2. Call `authModal` / connect and receive a public key.
3. Read the community NFT `balance` for that address (membership gate).
4. Map the balance with `membershipFromBalance` (`member` when balance > 0).

Freighter remains the default module and the default UI copy (landing,
unavailable-wallet errors, README). Lobstr is the second module covered by
mocks so switching module selection does not crash `WalletProvider`.

## Test matrix

| Module | Kit path | Status | Smoke: connect → NFT balance | Notes |
|--------|----------|--------|------------------------------|-------|
| Freighter | `modules/freighter` | **Verified** | Yes (default) | Production `WalletProvider` init. UI copy stays Freighter. |
| LOBSTR | `modules/lobstr` | **Verified** | Yes (kit mocks) | Alternate hot wallet. Not default UI copy. |
| xBull | `modules/xbull` | Unverified | No | Installed with the kit; do not enable until verified. |
| Albedo | `modules/albedo` | Unverified | No | Kit present; no smoke coverage. |
| Rabet | `modules/rabet` | Unverified | No | Kit present; no smoke coverage. |
| Hana | `modules/hana` | Unverified | No | Kit present; no smoke coverage. |
| Trezor | `modules/trezor` | **Unsupported** | No | Hardware wallet. Out of scope; see `docs/web-dependency-vulnerability-plan.md`. |
| Ledger | `modules/ledger` | **Unsupported** | No | Hardware wallet browser path. Out of scope. |
| WalletConnect | `modules/wallet-connect` | **Unsupported** | No | Mobile deep-link path. Out of scope. |

## Unsupported by design

- **Hardware wallets** (Trezor, Ledger): not part of the browser Freighter-first
  product path; Trezor also pulls vulnerable `protobufjs`.
- **Mobile deep-link wallets** (WalletConnect and similar): not covered by this
  matrix.

## Verification

- Unit/integration: `apps/web/src/context/WalletProvider.test.tsx` (module
  selection smoke) and `apps/web/src/lib/walletKitModules.test.ts` (matrix
  metadata).
- Source of truth for statuses: `apps/web/src/lib/walletKitModules.ts`.

## Related

- `apps/web/src/context/WalletProvider.tsx`
- `docs/web-dependency-vulnerability-plan.md` (Trezor / protobuf reachability)
