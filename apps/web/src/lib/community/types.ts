export type CommunityExternalLink = {
  label: string;
  url: string;
};

export type CommunityMetadata = {
  schemaVersion: 1;
  name: string;
  description: string;
  logo?: string;
  externalLinks: CommunityExternalLink[];
};

export type CommunityRegistryRecord = {
  id: string;
  nftContract: string;
  governorContract: string;
  /** Present only for communities deployed with emergency Timelock support. */
  timelockContract?: string;
  creator: string;
  communityOwner: string;
  createdAtLedger: number;
  creationIndex: number;
  metadataUri: string;
  metadataHash: string;
  metadataSchemaVersion: number;
};

export type GovernanceSnapshot = {
  votingDelay: number | null;
  votingPeriod: number | null;
  proposalThreshold: string | null;
  quorum: string | null;
  unavailableFields: string[];
};

export type Community = {
  record: CommunityRegistryRecord;
  metadata: CommunityMetadata | null;
  metadataError: string | null;
  governance: GovernanceSnapshot;
  /** Missing means active. A paused or archived community keeps its record. */
  activity?: import("./communityActivity").CommunityActivity;
};

/** @deprecated Prefer `Community`. Kept for existing imports. */
export type CommunityView = Community;

export type CommunityRegistryPage = {
  communities: Community[];
  nextCursor: number | null;
  malformedRecords: number;
};

export type CommunityDetailResult =
  | { status: "found"; community: Community }
  | { status: "not-found" }
  | { status: "malformed"; message: string };

export interface CommunityRegistry {
  list(cursor: number | null, limit: number): Promise<CommunityRegistryPage>;
  get(communityId: string): Promise<CommunityDetailResult>;
}
