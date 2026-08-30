import { describe, expect, it } from "vitest";
import {
  serializeCommunityFactoryArgs,
  type CommunityWizardState,
} from "./types";

const validState: CommunityWizardState = {
  metadata: {
    name: "Stolla Labs",
    symbol: "STLA",
    baseUri: "ipfs://QmCommunity",
    description: "A testnet community",
    externalUrl: "https://stolla.example",
  },
  governance: {
    votingDelay: "1",
    votingPeriod: "17280",
    proposalThreshold: "900719925474099312345",
    quorum: "340282366920938463463374607431768211455",
  },
};

describe("serializeCommunityFactoryArgs", () => {
  it("preserves metadata and governance units for the factory", () => {
    const args = serializeCommunityFactoryArgs(validState, "GCREATOR");

    expect(args.metadata).toEqual({
      name: "Stolla Labs",
      symbol: "STLA",
      base_uri: "ipfs://QmCommunity",
      description: "A testnet community",
      external_url: "https://stolla.example",
    });
    expect(args.governance.voting_delay).toBe(1);
    expect(args.governance.voting_period).toBe(17280);
    expect(args.governance.proposal_threshold).toBe(900719925474099312345n);
    expect(args.governance.quorum).toBe(
      340282366920938463463374607431768211455n,
    );
  });

  it("rejects lossy decimal inputs", () => {
    expect(() =>
      serializeCommunityFactoryArgs(
        {
          ...validState,
          governance: { ...validState.governance, quorum: "1.5" },
        },
        "GCREATOR",
      ),
    ).toThrow(/Quorum must be a whole number/);
  });

  it("rejects u32 values outside the contract range", () => {
    expect(() =>
      serializeCommunityFactoryArgs(
        {
          ...validState,
          governance: { ...validState.governance, votingDelay: "4294967296" },
        },
        "GCREATOR",
      ),
    ).toThrow(/Voting delay must fit in u32/);
  });
});
