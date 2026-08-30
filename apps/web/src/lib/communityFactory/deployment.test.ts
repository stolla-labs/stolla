import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  deployCommunityFromWizard,
  extractTransactionHash,
  type DeploymentStage,
} from "./deployment";
import { CommunityDeploymentError } from "./errors";
import type { CommunityDeploymentResult, CommunityWizardState } from "./types";

const state: CommunityWizardState = {
  metadata: {
    name: "Stolla Labs",
    symbol: "STLA",
    baseUri: "ipfs://QmCommunity",
    description: "A testnet community",
    externalUrl: "",
  },
  governance: {
    votingDelay: "1",
    votingPeriod: "17280",
    proposalThreshold: "1",
    quorum: "1",
  },
};

function dependencies(overrides: {
  walletNetworkPassphrase?: string | null;
  deployError?: Error;
  signError?: Error;
  signResponse?: {
    hash?: string;
    txHash?: string;
    result?: CommunityDeploymentResult;
  };
  stages?: DeploymentStage[];
  hashes?: string[];
} = {}) {
  return {
    address: "GCREATOR",
    expectedNetworkPassphrase: "Test SDF Network ; September 2015",
    walletNetworkPassphrase:
      overrides.walletNetworkPassphrase ?? "Test SDF Network ; September 2015",
    createClient: () => ({
      deploy_community: async () => {
        if (overrides.deployError) throw overrides.deployError;
        return {
          signAndSend: async () => {
            if (overrides.signError) throw overrides.signError;
            return overrides.signResponse ?? { hash: "abc123" };
          },
        };
      },
    }),
    storeHash: (hash: string) => overrides.hashes?.push(hash),
    onStage: (stage: DeploymentStage) => overrides.stages?.push(stage),
  };
}

describe("deployCommunityFromWizard", () => {
  it("fails before simulation on network mismatch", async () => {
    await assert.rejects(
      () =>
        deployCommunityFromWizard(
          state,
          dependencies({ walletNetworkPassphrase: "Public Global Stellar Network ; September 2015" }),
        ),
      (error) =>
        error instanceof CommunityDeploymentError && error.kind === "network",
    );
  });

  it("surfaces simulation failures before wallet signing", async () => {
    const stages: DeploymentStage[] = [];

    await assert.rejects(
      () =>
        deployCommunityFromWizard(
          state,
          dependencies({
            deployError: new Error("simulation rejected contract args"),
            stages,
          }),
        ),
      (error) =>
        error instanceof CommunityDeploymentError && error.kind === "simulation",
    );
    assert.deepEqual(stages, ["serializing", "simulating"]);
  });

  it("does not store a hash when the wallet rejects authorization", async () => {
    const hashes: string[] = [];

    await assert.rejects(
      () =>
        deployCommunityFromWizard(
          state,
          dependencies({
            signError: new Error("User rejected request"),
            hashes,
          }),
        ),
      (error) =>
        error instanceof CommunityDeploymentError &&
        error.kind === "wallet_rejection",
    );
    assert.deepEqual(hashes, []);
  });

  it("fails submission when the wallet response has no hash", async () => {
    await assert.rejects(
      () =>
        deployCommunityFromWizard(
          state,
          dependencies({ signResponse: { result: undefined } }),
        ),
      (error) =>
        error instanceof CommunityDeploymentError && error.kind === "submission",
    );
  });

  it("stores the transaction hash immediately after successful submission", async () => {
    const stages: DeploymentStage[] = [];
    const hashes: string[] = [];

    const outcome = await deployCommunityFromWizard(
      state,
      dependencies({
        stages,
        hashes,
        signResponse: {
          txHash: "hash-from-wallet",
          result: {
            nft_contract: "CNFT",
            governor_contract: "CGOV",
          },
        },
      }),
    );

    assert.equal(outcome.hash, "hash-from-wallet");
    assert.deepEqual(hashes, ["hash-from-wallet"]);
    assert.deepEqual(stages, [
      "serializing",
      "simulating",
      "awaiting_wallet",
      "submitting",
      "success",
    ]);
  });
});

describe("extractTransactionHash", () => {
  it("accepts common wallet hash field names", () => {
    assert.equal(extractTransactionHash({ hash: "a" }), "a");
    assert.equal(extractTransactionHash({ txHash: "b" }), "b");
    assert.equal(extractTransactionHash({ transactionHash: "c" }), "c");
    assert.equal(extractTransactionHash({ id: "d" }), "d");
  });
});
