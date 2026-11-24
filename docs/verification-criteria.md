# Stolla Verified — Review Criteria

The **Verified** mark on a community signals that a Stolla operator has
manually reviewed the community against the bar below. It is a lightweight
trust signal for newcomers choosing where to mint — **it is not investment
advice, an endorsement of any token, or a guarantee of returns or outcomes.**

## What review checks

A community may be verified when it meets all of the following:

- **Accurate identity.** The community name, description, and links match a
  real, discoverable project and are not impersonating another community.
- **Non-misleading claims.** No promises of returns, staking yield, or price
  appreciation in the metadata or linked materials.
- **Reachable governance.** The Governor and NFT contracts resolve on the
  configured network and the proposal flow works end to end.
- **Active maintenance.** The community has a visible maintainer or a public
  channel for support questions.

## What verification is not

- Verification is **not** KYC, accreditation, or a legal review.
- Verification is **not** a statement about a token's price or investment
  quality.
- Verification can be **revoked** if a community later changes its metadata,
  contracts, or behavior in a way that fails the bar above.

## Granting or revoking the mark

Operators control the allowlist through the
`NEXT_PUBLIC_VERIFIED_COMMUNITY_IDS` environment variable (comma-separated
registry ids). Removing an id revokes the mark; the badge renders only for
communities in the allowlist.
