# Saved proposal views

A delegate doing weekly governance applies the same filters every time: Active,
one category, a search term they keep retyping. A **saved view** is that
combination of filters under a name, applied in one click.

Views are a device preference, not a governance record. Nothing about them
reaches a contract, an indexer or a server.

## Where a view lives

`localStorage`, under a key carrying both the wallet and the scope:

```
stolla:saved-views:v1:<wallet or "guest">:<community id or "global">
```

Two things follow from that key, and both are acceptance criteria of the
feature:

- **One community's presets are never offered on another's list.** The scope
  segment is the community's registry id — not its URL segment, so the same
  community reached by a different route keeps its views.
- **A guest keeps their views.** Unlike the community watchlist, which asserts
  something about a wallet, a filter preset is a browser preference; a visitor
  with no wallet connected is keyed under `guest` rather than given nothing.

Switching wallets shows that wallet's views. Clearing site data or moving
browsers loses them, by design — shared, server-synced team views are out of
scope for v1 (see issue #527).

## What a view carries

Only the filter parameters the proposal lists keep in the URL:

| Parameter | Filter |
|---|---|
| `state` | Proposal state (`active`, `defeated`, …) |
| `q` | Search over titles and summaries |
| `category` | Proposal category |

`category` has no control on the lists yet — the categories issue is still
open. It is a known parameter here anyway, so a view saved today restores a
category the day that filter lands rather than needing a storage migration.

A stored view carrying a parameter this version does not know is **rejected
whole** rather than applied partially: a view that quietly does less than its
name promises is worse than one that is missing.

## How applying a view works

The URL remains the single place the filters live. Applying a view writes its
parameters into the query string with `router.replace`, exactly as the state
filter already does, so the back button, a reload and a shared link all behave
the way they did before.

Applying a view **clears** any filter it does not name. Otherwise a search term
from the previous view survives into one that never mentioned a search, and the
list shows fewer proposals than the view's name claims. Query parameters that
are not filters are left alone.

## Limits, and why they exist

| Limit | Value | Reason |
|---|---|---|
| Views per scope | 12 | A row of buttons stops being faster than the filters themselves. |
| Name length | 40 characters | It has to read as a button label. |
| Empty filter set | Refused | A view that applies nothing is an entry somebody deletes and then wonders whether they lost something. |

Saving over an existing name replaces that view rather than adding a second one
with the same label, which nobody could tell apart in a row of buttons.

## Code

| Path | Responsibility |
|---|---|
| `apps/web/src/lib/saved-views.ts` | Storage, the known parameters, and applying a view to a query string. No React. |
| `apps/web/src/hooks/useSavedViews.ts` | One list's views: reads for the current wallet and scope, and navigates on apply. |
| `apps/web/src/components/proposals/SavedViews.tsx` | The view buttons, the save control and the reasons a save was refused. |

Tests: `apps/web/src/lib/saved-views.test.ts` (persistence, scoping, apply) and
`apps/web/src/__tests__/SavedViews.test.tsx` (the control, and the scoping
promises end to end).
