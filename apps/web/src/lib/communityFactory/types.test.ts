import assert from "node:assert/strict";
import { describe, it } from "vitest";
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

    assert.deepEqual(args.metadata, {
      name: "Stolla Labs",
      symbol: "STLA",
      base_uri: "ipfs://QmCommunity",
      description: "A testnet community",
      external_url: "https://stolla.example",
    });
    assert.equal(args.governance.voting_delay, 1);
    assert.equal(args.governance.voting_period, 17280);
    assert.equal(args.governance.proposal_threshold, 900719925474099312345n);
    assert.equal(
      args.governance.quorum,
      340282366920938463463374607431768211455n,
    );
  });

  it("rejects lossy decimal inputs", () => {
    assert.throws(
      () =>
        serializeCommunityFactoryArgs(
          {
            ...validState,
            governance: { ...validState.governance, quorum: "1.5" },
          },
          "GCREATOR",
        ),
      /Quorum must be a whole number/,
    );
  });

  it("rejects u32 values outside the contract range", () => {
    assert.throws(
      () =>
        serializeCommunityFactoryArgs(
          {
            ...validState,
            governance: { ...validState.governance, votingDelay: "4294967296" },
          },
          "GCREATOR",
        ),
      /Voting delay must fit in u32/,
    );
  });
});
