# Privacy-safe product analytics

Analytics are disabled unless `NEXT_PUBLIC_ANALYTICS_ENABLED=true`. The client emitter has a pluggable sink; its default enabled sink writes structured events to the browser console.

| Event | Trigger | Allowed properties |
| --- | --- | --- |
| `page_view` | Route change | `path` |
| `landing_cta` | Landing create/browse CTA | `destination`, `source` |
| `create_start` / `create_finish` | Community wizard opened / registry verified | `source`, `network` |
| `claim_start` / `claim_finish` | Membership mint requested / confirmed | `network`, `outcome` |
| `first_vote` | First confirmed vote in a browser session | `outcome` |

Never add private keys, seed phrases, passphrases, proposal content, raw wallet addresses, or transaction bodies. The emitter rejects sensitive-looking property names. If a future self-hosted deployment needs wallet-level cohort analysis, pass a wallet address through `anonymizeWalletAddress` and send only the resulting hash.

Session replay, fingerprinting, and data resale are intentionally out of scope.

