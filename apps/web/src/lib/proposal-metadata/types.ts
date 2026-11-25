/** Versioned proposal metadata stored inside the Governor description string. */
export type ProposalMetadataV1 = {
  version: 1;
  title: string;
  summary: string;
  body: string;
  discussionUrl: string | null;
};

/**
 * v2: v1 plus the id of the proposal this one replaces.
 *
 * Only the forward link is stored. A Governor description is immutable once
 * the proposal exists, so the older proposal can never be amended to point at
 * its replacement — the reverse link (`supersededBy`) is derived by reading
 * the community's proposals, in `lib/proposals/supersede.ts`.
 */
export type ProposalMetadataV2 = {
  version: 2;
  title: string;
  summary: string;
  body: string;
  discussionUrl: string | null;
  /** Lowercase hex proposal id, or null. Never this proposal's own id. */
  supersedes: string | null;
};

/** Any envelope version a reader accepts. */
export type ProposalMetadata = ProposalMetadataV1 | ProposalMetadataV2;

/**
 * `supersedes` is optional so every existing caller that builds a draft from
 * title/summary/body/discussionUrl still type-checks, and a stored draft
 * written before this field existed still restores.
 */
export type ProposalMetadataDraft = Omit<ProposalMetadataV1, "version"> & {
  supersedes?: string | null;
};

export type ProposalMetadataField = keyof ProposalMetadataDraft;

export type ProposalMetadataErrors = Partial<
  Record<ProposalMetadataField | "envelope", string>
>;

export type ParsedProposalDescription =
  | {
      kind: "versioned";
      metadata: ProposalMetadata;
      raw: string;
    }
  | {
      kind: "legacy";
      metadata: null;
      raw: string;
    };
