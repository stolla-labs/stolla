# Community draft preview

A creator wants to see the page a reader will see **before** paying for a
factory deployment. `/communities/draft/preview` renders the community chrome
from the wizard's local draft, under a large `DRAFT` watermark, and is reachable
only from the device that is writing the draft.

## Why the route needs a token

The draft exists only in the creating browser's storage. There is no server to
ask whether a visitor is the creator, so locality is most of the access control
— but a URL is the one part of a local page a creator can paste somewhere, and
a bare `/communities/draft/preview` would then read whatever draft the
**recipient** happens to have, rendering a stranger's own half-written
community as though the sender had shared it.

So the wizard mints a token into `localStorage` when the creator clicks
**Preview as a reader**, and the route only renders a draft when the token in
the URL matches the one this device issued:

| Stored | Key |
|---|---|
| Wizard draft | `stolla:community-wizard:<network>:v2` (existing) |
| Preview token | `stolla:community-draft-preview:v1:<network>` |

- A new token on every click, so a link copied out of the address bar stops
  working as soon as the creator previews again.
- 30 minutes, so a link pasted into a chat has stopped working by the time
  anybody opens it.
- A token issued in the future is treated as **expired**: a clock that moved is
  not a grant, because the interval cannot be measured.
- Keyed per network, so a mainnet draft never opens in a testnet preview.

Nothing here is a secret and nothing here is a permission. The draft is the
reader's own either way; the token only proves the request came from the wizard
on this device, recently. Sharing a draft with somebody else is out of scope
(issue #532) and this is the piece that would be replaced by it.

Each refusal is distinct, because they tell a creator different things to do:
no token, a token from elsewhere, an expired token, no draft in this browser,
and a draft with nothing typed into it yet.

## Not looking live

Two separate markers, because they do different jobs:

- The **watermark** (`DraftWatermark`) is `aria-hidden` and
  `pointer-events-none`: repeated decorative text a screen reader would
  otherwise announce several times for no information, and a creator clicking
  around their own preview must not be blocked by it. It is sized in viewport
  units (`18vw`, `14vw` from `sm`) so it is unmistakable on a phone and on a
  desktop without a breakpoint deciding who gets warned.
- The **banner** is the accessible statement, a real element in the flow rather
  than an overlay, so it is there however the page is read and cannot be
  scrolled past: *This is an unpublished draft. Nothing here exists on chain
  yet…*

Where a deployed community shows its Governor and NFT addresses, the preview
says **Not deployed**. A plausible-looking contract id is the one lie a preview
must not tell: a creator checking the page would have no way to know it was
invented.

## Not discoverable

- **Explore** lists what the community factory deployed. A draft has been
  deployed nowhere, so there is nothing to filter out — the exclusion is
  structural, not a rule somebody has to remember.
  `src/__tests__/ExploreIgnoresDrafts.test.tsx` pins it anyway, including a
  search for the draft's own name, so a later change that starts merging local
  state into the listing fails there.
- **Robots.** The route exports `robots: { index: false, follow: false,
  nocache: true }`.
- **Sitemap.** There is no sitemap route in the app yet (issue #494). When one
  lands it will enumerate registry records, which drafts are absent from for
  the same structural reason; the `noindex` above covers a preview URL that
  reaches a crawler any other way.

## Out of scope

Server-side draft collaboration and public sharing links without an owner
session, as the issue says. Both need a server; this feature deliberately has
none.
