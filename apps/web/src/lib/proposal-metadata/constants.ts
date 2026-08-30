export const PROPOSAL_METADATA_PREFIX = "STOLLA_PROPOSAL_METADATA_V1\n";

export const PROPOSAL_METADATA_LIMITS = {
  title: 120,
  summary: 280,
  body: 4_000,
  discussionUrl: 2_048,
  envelopeBytes: 8_192,
} as const;

export const EMPTY_PROPOSAL_METADATA_DRAFT = {
  title: "",
  summary: "",
  body: "",
  discussionUrl: null,
} as const;
