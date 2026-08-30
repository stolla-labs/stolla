import { describe, expect, it } from "vitest";
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

function dependencies(
  overrides: {
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
  } = {},
) {
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
    await expect(
      deployCommunityFromWizard(
        state,
        dependencies({
          walletNetworkPassphrase:
            "Public Global Stellar Network ; September 2015",
        }),
      ),
    ).rejects.toMatchObject({
      kind: "network",
      constructor: CommunityDeploymentError,
    });
  });

  it("surfaces simulation failures before wallet signing", async () => {
    const stages: DeploymentStage[] = [];

    await expect(
      deployCommunityFromWizard(
        state,
        dependencies({
          deployError: new Error("simulation rejected contract args"),
          stages,
        }),
      ),
    ).rejects.toMatchObject({
      kind: "simulation",
      constructor: CommunityDeploymentError,
    });
    expect(stages).toEqual(["serializing", "simulating"]);
  });

  it("does not store a hash when the wallet rejects authorization", async () => {
    const hashes: string[] = [];

    await expect(
      deployCommunityFromWizard(
        state,
        dependencies({
          signError: new Error("User rejected request"),
          hashes,
        }),
      ),
    ).rejects.toMatchObject({
      kind: "wallet_rejection",
      constructor: CommunityDeploymentError,
    });
    expect(hashes).toEqual([]);
  });

  it("fails submission when the wallet response has no hash", async () => {
    await expect(
      deployCommunityFromWizard(
        state,
        dependencies({ signResponse: { result: undefined } }),
      ),
    ).rejects.toMatchObject({
      kind: "submission",
      constructor: CommunityDeploymentError,
    });
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

    expect(outcome.hash).toBe("hash-from-wallet");
    expect(hashes).toEqual(["hash-from-wallet"]);
    expect(stages).toEqual([
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
    expect(extractTransactionHash({ hash: "a" })).toBe("a");
    expect(extractTransactionHash({ txHash: "b" })).toBe("b");
    expect(extractTransactionHash({ transactionHash: "c" })).toBe("c");
    expect(extractTransactionHash({ id: "d" })).toBe("d");
  });
});
