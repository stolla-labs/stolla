export const PROPOSAL_METADATA_PREFIX = "STOLLA_PROPOSAL_METADATA_V1\n";

/**
 * v2 adds exactly one field, `supersedes`, and is written **only** when a
 * proposal actually replaces another.
 *
 * The v1 contract in `docs/proposal-metadata-v1.md` says unknown keys
 * invalidate an envelope, so a sixth key could not be added to v1 without
 * making new proposals unreadable to readers that follow that rule. A new
 * prefix keeps both rules intact: a v1 reader falls back to plain text for a
 * v2 envelope, which is why writers stay on v1 whenever there is no link to
 * record — the newer format appears only on the proposals that need it.
 */
export const PROPOSAL_METADATA_V2_PREFIX = "STOLLA_PROPOSAL_METADATA_V2\n";

export const PROPOSAL_METADATA_LIMITS = {
  title: 120,
  summary: 280,
  body: 4_000,
  discussionUrl: 2_048,
  /** A proposal id is a 32-byte hash in hex: the field is fixed width, not a bound. */
  supersedes: 64,
  envelopeBytes: 8_192,
} as const;

export const EMPTY_PROPOSAL_METADATA_DRAFT = {
  title: "",
  summary: "",
  body: "",
  discussionUrl: null,
  supersedes: null,
} as const;
