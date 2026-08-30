import { Buffer } from "buffer";

import { ProposalState } from "../../lib/bindings/community-governor/src";
import type {
  ProposalReader,
  ProposalReaderFactory,
} from "../../lib/communities/proposals";
import type {
  CommunityMetadata,
  CommunityRecord,
} from "../../lib/communities/types";

export function createCommunityRecord(
  overrides: Partial<CommunityRecord> = {},
): CommunityRecord {
  return {
    id: "atlas-collective",
    name: "Atlas Collective",
    symbol: "ATLAS",
    governorContractId:
      "CGOVERNORATLAS00000000000000000000000000000000000000001",
    nftContractId:
      "CNFTATLAS000000000000000000000000000000000000000000001",
    metadataUri: "https://metadata.example.test/atlas.json",
    ...overrides,
  };
}

export const atlasCommunity = createCommunityRecord();
export const beaconCommunity = createCommunityRecord({
  id: "beacon-guild",
  name: "Beacon Guild",
  symbol: "BEACON",
  governorContractId:
    "CGOVERNORBEACON0000000000000000000000000000000000000002",
  nftContractId:
    "CNFTBEACON00000000000000000000000000000000000000000002",
  metadataUri: "https://metadata.example.test/beacon.json",
});
export const driftwoodCommunity = createCommunityRecord({
  id: "driftwood-cooperative",
  name: "Driftwood Cooperative",
  symbol: "DRIFT",
  governorContractId:
    "CGOVERNORDRIFTWOOD000000000000000000000000000000000003",
  nftContractId:
    "CNFTDRIFTWOOD0000000000000000000000000000000000000000003",
  metadataUri: undefined,
});

export function createCommunityRegistry(
  ...communities: CommunityRecord[]
): CommunityRecord[] {
  return communities.length > 0
    ? [...communities]
    : [atlasCommunity, beaconCommunity, driftwoodCommunity];
}

export const multiCommunityRegistry = createCommunityRegistry();

export const atlasMetadata: CommunityMetadata = {
  description: "Funding public goods across the Atlas ecosystem.",
  logoUri: "https://metadata.example.test/atlas-logo.png",
};
export const beaconMetadata: CommunityMetadata = {
  description: "Coordinating grants for the Beacon Guild.",
  logoUri: "https://metadata.example.test/beacon-logo.png",
};

export function createFetchMetadata(
  byUri: Record<string, CommunityMetadata | Error>,
) {
  return async (uri: string): Promise<CommunityMetadata> => {
    const outcome = byUri[uri];
    if (outcome === undefined) {
      throw new Error(`No fixture metadata for ${uri}`);
    }
    if (outcome instanceof Error) throw outcome;
    return outcome;
  };
}

export type GovernorFixture = {
  contractId: string;
  proposals: Record<string, ProposalState | Error>;
};

export type GovernorReaderFactoryMock = ProposalReaderFactory & {
  calls: Array<{ contractId: string; proposalId: string }>;
};

/** Creates per-contract proposal readers without Vitest spies or RPC access. */
export function createGovernorReaderFactory(
  fixtures: GovernorFixture[],
): GovernorReaderFactoryMock {
  const byContractId = new Map(
    fixtures.map((fixture) => [fixture.contractId, fixture]),
  );
  const calls: Array<{ contractId: string; proposalId: string }> = [];

  const factory = ((contractId: string): ProposalReader => ({
    proposal_state: async ({ proposal_id }: { proposal_id: Buffer }) => {
      const proposalId = proposal_id.toString("hex");
      calls.push({ contractId, proposalId });
      const outcome = byContractId.get(contractId)?.proposals[proposalId];
      if (outcome === undefined) {
        throw new Error(
          `No fixture proposal ${proposalId} for governor ${contractId}`,
        );
      }
      if (outcome instanceof Error) throw outcome;
      return { result: outcome };
    },
  })) as GovernorReaderFactoryMock;

  factory.calls = calls;
  return factory;
}
