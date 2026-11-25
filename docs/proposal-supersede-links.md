# Proposal supersede links

An amended decision leaves the original proposal sitting in the list looking
exactly as authoritative as the correction. This is how a voter reads the wrong
text. A **supersede link** lets the newer proposal say which one it replaces,
and both proposals then say so to a reader.

## Only the forward link can be stored

A Governor `description` is immutable once the proposal exists. The older
proposal can therefore never be amended to point at its replacement, so:

- **`supersedes`** is stored, in the newer proposal's metadata.
- **`supersededBy`** is **derived**, by reading the community's proposals and
  inverting the links — `apps/web/src/lib/proposals/supersede.ts`.

That derivation is only ever as complete as the proposal discovery behind it.
When history is partial, the proposal page says that a newer proposal replacing
this one may not have loaded, rather than reporting the proposal as current.

## Metadata v2

v1's contract (`docs/proposal-metadata-v1.md`) says unknown keys invalidate an
envelope, so a sixth key could not simply be added: a v1 reader is required to
reject it. v2 is the same envelope with one more field and its own prefix:

```text
STOLLA_PROPOSAL_METADATA_V2
{"version":2,"title":"…","summary":"…","body":"…","discussionUrl":null,"supersedes":"<64 hex>"}
```

**Writers emit v2 only when a proposal actually replaces another.** A proposal
with nothing extra to say is still written as v1, so the envelope an older
reader cannot parse never appears on a proposal that did not need it.

Readers accept both versions, permanently — every v1 envelope ever written
stays v1, because descriptions are immutable.

Three envelopes a reader rejects into plain text, for the same reason v1 does:

| Envelope | Why it is not trusted |
|---|---|
| v1 prefix carrying `supersedes` | The v1 contract says six keys is malformed. |
| v2 prefix with `supersedes: null` | It announces a link and carries none. |
| v2 prefix with `version: 1` inside | The prefix and the body disagree. |

`supersedes` is stored lowercase. Proposal ids are hashes, so the only
difference between two spellings is case, and normalizing means a creator who
pasted an id from an upper-case display still links the same proposal.

## What a reader sees

| Situation | Notice |
|---|---|
| Nothing replaces this proposal | Nothing (plus a caveat if history is partial). |
| One chain of replacements | **This is not the current text.** It was replaced by *…*, naming the **end** of the chain — the text actually in force — not the next link. |
| This proposal replaces another | *This proposal replaces …*, and says so plainly when that proposal is not in the loaded history. |
| Two proposals replace the same one | Both are named. A fork is a disagreement the community has to settle, and choosing one would invent a governance decision nobody made. |
| The links form a loop | Reported as a loop, with no canonical pointer, because every candidate points back. |

The proposal lists show a quiet `Superseded` marker, and only for an
unambiguous single replacement: a fork or a loop is explained on the proposal
itself, where there is room to say what it means.

### Soft-hide

There is no soft-hide control in the app yet. When one lands it needs no change
here: `isSuperseded(graph, id)` is the predicate it should filter on, and the
banner above is deliberately independent of any hide state — a reader who has
followed a direct link to a hidden proposal still has to be told it is not the
current text.

## Cycles

Proposal ids are content hashes, so a loop cannot be created by accident. It
can be written by hand, and it renders as two proposals each claiming the other
is canonical, so it is rejected in two places and survivable in a third:

1. **At creation.** The create form walks the chain the target already belongs
   to and refuses a link that would close it, and refuses a proposal naming
   itself.
2. **On read.** `buildSupersedeGraph` drops a self-link at the door, and
   `resolveSupersede` walks with a visited set and reports `cycle` instead of
   looping forever.
3. **In the UI.** A loop is shown as a loop, never as a pointer.

An id no loaded proposal has is a **caution, not a refusal**. Discovery can be
partial, so refusing would block a legitimate amendment whenever the RPC
retention window is short.

## Out of scope

Cancelling the superseded proposal on chain, and a diff between the two texts
(issue #530). A link is a statement about which text is current; it does not
change any proposal's state, and nothing here writes to a contract.
