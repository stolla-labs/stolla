import type {
  Community,
  CommunityRegistry,
} from "@/lib/community/types";

const OWNER = `G${"A".repeat(55)}`;

function community(
  idByte: string,
  name: string,
  governorContract: string,
  nftContract: string,
  description: string,
): Community {
  const id = idByte.repeat(64);
  return {
    record: {
      id,
      nftContract,
      governorContract,
      creator: OWNER,
      communityOwner: OWNER,
      createdAtLedger: 100,
      creationIndex: 0,
      metadataUri: `https://metadata.example/${id}.json`,
      metadataHash: "ab".repeat(32),
      metadataSchemaVersion: 1,
    },
    metadata: {
      schemaVersion: 1,
      name,
      description,
      externalLinks: [],
    },
    metadataError: null,
    governance: {
      votingDelay: 1,
      votingPeriod: 100,
      proposalThreshold: "1",
      quorum: "1",
      unavailableFields: [],
    },
  };
}

export const atlasCommunity = community(
  "a",
  "Atlas Collective",
  "CGOVERNORATLAS00000000000000000000000000000000000000001",
  "CNFTATLAS000000000000000000000000000000000000000000001",
  "Funding public goods across the Atlas ecosystem.",
);

export const beaconCommunity = community(
  "b",
  "Beacon Guild",
  "CGOVERNORBEACON0000000000000000000000000000000000000002",
  "CNFTBEACON00000000000000000000000000000000000000000002",
  "Coordinating grants for the Beacon Guild.",
);

export const driftwoodCommunity = community(
  "c",
  "Driftwood Cooperative",
  "CGOVERNORDRIFTWOOD000000000000000000000000000000000003",
  "CNFTDRIFTWOOD0000000000000000000000000000000000000000003",
  "Unavailable metadata fixture.",
);
driftwoodCommunity.metadata = null;
driftwoodCommunity.metadataError = "Metadata request failed.";

export const multiCommunityFixtures: Community[] = [
  atlasCommunity,
  beaconCommunity,
  driftwoodCommunity,
];

export function createFixtureCommunityRegistry(
  communities: Community[],
): CommunityRegistry {
  return {
    async list(cursor, limit) {
      const start = cursor ?? 0;
      const page = communities.slice(start, start + limit);
      return {
        communities: page,
        nextCursor:
          start + page.length < communities.length
            ? start + page.length
            : null,
        malformedRecords: 0,
      };
    },
    async get(communityId) {
      const match = communities.find(
        (candidate) =>
          candidate.record.id.toLowerCase() === communityId.toLowerCase(),
      );
      return match
        ? { status: "found" as const, community: match }
        : { status: "not-found" as const };
    },
  };
}

export const multiCommunityRegistry = createFixtureCommunityRegistry(
  multiCommunityFixtures,
);
