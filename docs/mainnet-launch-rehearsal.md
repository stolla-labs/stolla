# Mainnet launch rehearsal

Testnet success does not transfer. First Mainnet launches go wrong on things
the create wizard never asked about: an account with no XLM for fees and
reserves, a treasury with no trustline for the asset it will pay in,
sponsorship nobody arranged, and nobody watching when it breaks.

The rehearsal is that list, shown on the wizard's review step, in the words a
creator would use.

## Two facts per item, never conflated

Conflating these is what makes a checklist lie.

**`gate` is policy.** A `hard` gate holds the deployment; a `soft` one warns.
The rule for which is which: hard means the write will fail, or will succeed
into something nobody can use.

**`verification` is how the answer was obtained.** `measured` items are read
from this deployment's configuration and from the connected wallet. `declared`
items are ones this app cannot see — a Horizon balance, a trustline, an
alerting rota. A declared item is **never shown as passing until the creator
confirms it**, and the row says out loud that Stolla did not check it.

A measured item cannot be confirmed away: the signal is the answer, there is no
checkbox, and a hand-edited confirmation for a measured id is dropped on read.

## The items

| Item | Gate | Verification | Mainnet only |
|---|---|---|---|
| Your wallet is on Mainnet | hard | measured | yes |
| This deployment can reach the network | hard | measured | no |
| The community factory address is set | hard | measured | no |
| Mainnet writes are switched on | hard | measured | yes |
| The deploying account holds XLM for fees and reserves | hard | declared | yes |
| The treasury trusts the asset you will pay in | soft | declared | yes |
| Sponsorship is arranged for the accounts you create | soft | declared | yes |
| Somebody is told when it breaks | soft | declared | yes |
| You have done this once on Testnet | soft | declared | yes |

### Why fees are hard and a trustline is not

A deployment that runs out of XLM halfway leaves contracts nobody owns, so the
fee item holds the deployment **until the creator confirms it**. That is an
acknowledgement gate rather than a box-ticking trap: the alternative is either
blocking on a fact nobody here can establish, or showing an unchecked item as
green.

A community deploys perfectly well without a USDC trustline — the trustline
matters at the first payment, which is later and elsewhere. Blocking the
deployment on it would be a gate that teaches creators to ignore gates. It
warns, loudly, and says exactly when it will bite.

Rehearsing on Testnet warns rather than blocks for the reason this feature
exists: a Testnet success is not evidence about Mainnet, and a creator
launching their second community should not be stopped by a claim about their
first.

### Testnet hides the Mainnet-only items

On Testnet the Mainnet-only rows are **absent**, not greyed out and not shown
as passing. A row reading *your wallet is on Mainnet ✓* while the creator is on
Testnet is a false statement, and a greyed-out row is noise in a list meant to
be read once, carefully.

## What it blocks

The wizard passes `verdict.blocked` to `CommunityDeploymentPanel` as
`rehearsalBlocked`, which disables **both** *Simulate deployment* and *Approve
and deploy* and is re-checked inside `submit()`. So no signature is requested
while a hard gate is open, not merely no click accepted.

Minting is **not** gated by this checklist. A mint happens on a community that
is already deployed, which means the rehearsal has already run for it; the
`rehearsalVerdict` predicate is exported if a later issue wants the same hold
on the mint panel.

## Where the signals come from

`buildNetworkCapabilities` (issue #408's capability matrix) and the wallet's
reported network (#356's write gate reads the same flag). The operator-facing
`buildHealthGates` in `lib/network.ts` reads the same matrix and stays separate
on purpose: an operator fixes an environment variable, a creator funds an
account, and one list cannot address both without talking past one of them.

Confirmations are stored per network in
`stolla:mainnet-rehearsal:v1:<network>`, so a Testnet rehearsal confirms
nothing for Mainnet. They are device-local because they are a statement by the
person at the keyboard about things only they can see.

Every item links to the runbook section that explains it, and a test asserts
each anchor exists in `docs/testnet-to-mainnet-runbook.md` — a link that lands
on the top of a long document because a heading moved is worse than no link,
because the creator concludes the item is undocumented.

## Out of scope

Bridging funds and creating custodial accounts, as the issue says. This feature
reads and asks; it moves nothing.
