import { describe, expect, it, vi } from "vitest";
import { Networks } from "@stellar/stellar-sdk";
import {
  FactoryNotConfiguredError,
  simulateCommunityDeployment,
  submitCommunityDeployment,
} from "./community-factory";
import { NETWORKS, NetworkMismatchError } from "./network";
import type { CommunitySimulation, CommunityDraft } from "./community-creation";

const DRAFT: CommunityDraft = {
  name: "Stolla Builders",
  symbol: "STBL",
  description: "A community for builders",
  collectionUri: "ipfs://QmCollection",
  metadataUri: "ipfs://QmCollection",
  logo: "",
  externalLinkLabel: "",
  externalLinkUrl: "",
  votingDelay: "1",
  votingPeriod: "10000",
  proposalThreshold: "1",
  quorum: "1",
};

function simulationOn(passphrase: string): CommunitySimulation {
  return {
    networkPassphrase: passphrase,
    factoryAddress: "CFACTORY",
    transactionXdr: "not-a-real-xdr",
    minResourceFee: "1000",
  };
}

describe("simulateCommunityDeployment", () => {
  it("refuses before any RPC call when the factory is unconfigured", async () => {
    await expect(
      simulateCommunityDeployment({
        network: NETWORKS.testnet,
        rpcUrl: "http://unreachable.invalid",
        factoryAddress: "",
        admin: "GADMIN",
        draft: DRAFT,
      }),
    ).rejects.toBeInstanceOf(FactoryNotConfiguredError);
  });
});

describe("submitCommunityDeployment", () => {
  it("refuses a simulation built on another network without signing it", async () => {
    const signTransaction = vi.fn();

    await expect(
      submitCommunityDeployment({
        simulation: simulationOn(Networks.PUBLIC),
        network: NETWORKS.testnet,
        rpcUrl: "http://unreachable.invalid",
        signTransaction,
      }),
    ).rejects.toBeInstanceOf(NetworkMismatchError);

    expect(signTransaction).not.toHaveBeenCalled();
  });

  /**
   * The passphrase check is the only thing standing between a stale simulation
   * and the wallet: with matching networks the same unparseable XDR reaches
   * signing, so the refusal above cannot be attributed to anything else.
   */
  it("reaches signing once the simulation belongs to the active network", async () => {
    const signTransaction = vi.fn(async () => ({ signedTxXdr: "signed" }));

    await expect(
      submitCommunityDeployment({
        simulation: simulationOn(Networks.TESTNET),
        network: NETWORKS.testnet,
        rpcUrl: "http://unreachable.invalid",
        signTransaction,
      }),
    ).rejects.not.toBeInstanceOf(NetworkMismatchError);

    expect(signTransaction).toHaveBeenCalledWith("not-a-real-xdr");
  });
});
