import { Networks, scValToNative } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import {
  formatStroopsAsXlm,
  isExpiredOrStaleDeploymentError,
  parseCommunityDeploymentRecovery,
  serializeCommunityFactoryInvocation,
} from "./deployment";
import {
  MOCK_CONTRACT_A,
  MOCK_CONTRACT_B,
  MOCK_GOVERNOR_CONTRACT_ID,
} from "@/test-support/stellar/fixtures";

const creator = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const factoryId = MOCK_CONTRACT_A;
const input = {
  creator,
  communityOwner: creator,
  factoryId,
  network: "testnet" as const,
  networkPassphrase: Networks.TESTNET,
  metadata: {
    name: "Builders Guild",
    symbol: "BUILD",
    description: "Build public goods.",
    externalLinkLabel: "",
    externalLinkUrl: "",
  },
  payload: {
    collectionUri: "ipfs://collection",
    metadataUri: "ipfs://community",
    metadataHash:
      "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
  },
  governance: {
    proposalThreshold: "4294967295",
    quorum: "2500",
    votingDelay: "0",
    votingPeriod: "17280",
  },
};

describe("community deployment serialization", () => {
  it("serializes the exact CommunityFactory method, source, network, and lossless values", async () => {
    const hash = Uint8Array.from({ length: 32 }, (_, index) => index);
    const invocation = await serializeCommunityFactoryInvocation(input, hash);
    const request = scValToNative(invocation.args[1]) as Record<string, unknown>;
    const governance = request.governance as Record<string, unknown>;
    const metadata = request.metadata as Record<string, unknown>;

    expect(invocation).toMatchObject({
      contractId: factoryId,
      method: "create_community",
      sourceAccount: creator,
      networkPassphrase: Networks.TESTNET,
      metadataHash:
        "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
    });
    expect(scValToNative(invocation.args[0])).toBe(creator);
    expect(request.community_owner).toBe(creator);
    expect(governance.proposal_threshold).toBe(BigInt("4294967295"));
    expect(governance.quorum).toBe(BigInt("2500"));
    expect(governance.voting_delay).toBe(0);
    expect(governance.voting_period).toBe(17280);
    expect(Array.from(metadata.metadata_hash as Uint8Array)).toEqual(
      Array.from(hash),
    );
    expect(metadata.collection_uri).toBe("ipfs://collection");
    expect(metadata.metadata_uri).toBe("ipfs://community");
  });

  it("rejects out-of-bounds governance parameters before simulation (#385)", async () => {
    await expect(
      serializeCommunityFactoryInvocation({
        ...input,
        governance: {
          ...input.governance,
          votingDelay: "120961",
        },
      }),
    ).rejects.toThrow(/Governance parameters are out of schema bounds/);

    await expect(
      serializeCommunityFactoryInvocation({
        ...input,
        governance: {
          ...input.governance,
          votingPeriod: "0",
        },
      }),
    ).rejects.toThrow(/Governance parameters are out of schema bounds/);

    await expect(
      serializeCommunityFactoryInvocation({
        ...input,
        governance: {
          ...input.governance,
          quorum: "4294967296",
        },
      }),
    ).rejects.toThrow(/Governance parameters are out of schema bounds/);
  });

  it("uses the generated payload hash when no override is supplied", async () => {
    const invocation = await serializeCommunityFactoryInvocation(input);
    expect(invocation.metadataHash).toBe(input.payload.metadataHash);
  });

  it("fails closed when the pin pipeline did not produce URIs or a hash", async () => {
    await expect(
      serializeCommunityFactoryInvocation({
        ...input,
        payload: { collectionUri: "", metadataUri: "", metadataHash: "" },
      }),
    ).rejects.toThrow(/Deployment payload is incomplete/);
    await expect(
      serializeCommunityFactoryInvocation({
        ...input,
        payload: { ...input.payload, metadataHash: "0".repeat(64) },
      }),
    ).rejects.toThrow(/non-zero 32-byte/);
  });

  it("fails closed on a mismatched network passphrase before simulation", async () => {
    await expect(
      serializeCommunityFactoryInvocation(
        { ...input, networkPassphrase: Networks.PUBLIC },
        new Uint8Array(32),
      ),
    ).rejects.toThrow(/does not match the application network/);
  });

  it("converts stroops with exact integer arithmetic, including huge values", () => {
    expect(formatStroopsAsXlm("12345678")).toBe("1.2345678 XLM");
    expect(formatStroopsAsXlm("10000000")).toBe("1 XLM");
    expect(formatStroopsAsXlm("900719925474099312345678")).toBe(
      "90071992547409931.2345678 XLM",
    );
  });

  it("recognizes expiry and stale sequence failures without treating arbitrary errors as rebuildable", () => {
    expect(isExpiredOrStaleDeploymentError(new Error("tx_too_late"))).toBe(true);
    expect(isExpiredOrStaleDeploymentError(new Error("tx_bad_seq"))).toBe(true);
    expect(isExpiredOrStaleDeploymentError(new Error("wallet rejected"))).toBe(
      false,
    );
  });

  it("restores only network-scoped valid submitted transaction recovery", () => {
    const raw = JSON.stringify({
      version: 1,
      network: "testnet",
      transactionHash: "ab".repeat(32),
      submittedAt: 123,
      expectedRecord: {
        id: "cd".repeat(32),
        nftContract: MOCK_CONTRACT_B,
        governorContract: MOCK_GOVERNOR_CONTRACT_ID,
        creator,
        communityOwner: creator,
        createdAtLedger: 10,
        creationIndex: 2,
        metadataUri: "https://example.test/community.json",
        metadataHash: "ef".repeat(32),
        metadataSchemaVersion: 1,
      },
    });
    expect(parseCommunityDeploymentRecovery(raw, "testnet")).toMatchObject({
      transactionHash: "ab".repeat(32),
    });
    expect(parseCommunityDeploymentRecovery(raw, "mainnet")).toBeNull();
    expect(
      parseCommunityDeploymentRecovery(
        raw.replace("ab".repeat(32), "invalid"),
        "testnet",
      ),
    ).toBeNull();
  });
});
