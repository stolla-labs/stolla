/** Versioned proposal metadata stored inside the Governor description string. */
export type ProposalMetadataV1 = {
  version: 1;
  title: string;
  summary: string;
  body: string;
  discussionUrl: string | null;
};

export type ProposalMetadataDraft = Omit<ProposalMetadataV1, "version">;

export type ProposalMetadataField = keyof ProposalMetadataDraft;

export type ProposalMetadataErrors = Partial<
  Record<ProposalMetadataField | "envelope", string>
>;

export type ParsedProposalDescription =
  | {
      kind: "versioned";
      metadata: ProposalMetadataV1;
      raw: string;
    }
  | {
      kind: "legacy";
      metadata: null;
      raw: string;
    };
