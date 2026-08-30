import { serializeProposalMetadata } from "./serialize";

export const VERSIONED_PROPOSAL_DRAFT = {
  title: "Fund Unicode governance tooling 🚀",
  summary: "Ship deterministic proposal metadata across every Stolla surface.",
  body: "This proposal preserves accents such as İstanbul and composed text exactly.",
  discussionUrl: "https://forum.example.org/t/governance-tooling",
} as const;

export const VERSIONED_PROPOSAL_DESCRIPTION = serializeProposalMetadata(
  VERSIONED_PROPOSAL_DRAFT,
);

export const LEGACY_PROPOSAL_DESCRIPTION =
  "Fund the original community grants round with a plain-text description.";
