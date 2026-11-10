import { describe, expect, it } from "vitest";
import { Networks } from "@stellar/stellar-sdk";
import {
  NETWORKS,
  NetworkCapabilityError,
  NetworkMismatchError,
  buildHealthGates,
  buildNetworkCapabilities,
  compareNetworks,
  contractUrl,
  describeNetwork,
  findNetworkByPassphrase,
  listUnavailableCapabilities,
  permissionlessCreateAllowed,
  requireNetworkCapability,
  transactionUrl,
} from "./network";
import { createNetworkCapabilitiesFixture } from "@/test-support/stellar/capabilities";

describe("describeNetwork", () => {
  it("recognizes registered networks by passphrase", () => {
    expect(describeNetwork(Networks.TESTNET)).toEqual({
      id: "testnet",
      label: "Testnet",
      networkPassphrase: Networks.TESTNET,
    });
  });

  it("keeps the wallet's own name for networks outside the registry", () => {
    expect(describeNetwork("Custom Network ; 2026", "Local")).toEqual({
      id: null,
      label: "Local",
      networkPassphrase: "Custom Network ; 2026",
    });
  });

  it("falls back to a generic label when the wallet reports no name", () => {
    expect(describeNetwork("Custom Network ; 2026").label).toBe(
      "Unrecognized network",
    );
  });
});

describe("compareNetworks", () => {
  it("reports unknown while the wallet network has not been read", () => {
    const comparison = compareNetworks(NETWORKS.testnet, null);
    expect(comparison.status).toBe("unknown");
  });

  it("matches identical passphrases", () => {
    const comparison = compareNetworks(
      NETWORKS.testnet,
      describeNetwork(Networks.TESTNET),
    );
    expect(comparison.status).toBe("match");
  });

  it("reports a mismatch with both networks named", () => {
    const comparison = compareNetworks(
      NETWORKS.testnet,
      describeNetwork(Networks.PUBLIC),
    );
    expect(comparison.status).toBe("mismatch");
    expect(comparison.expected.label).toBe("Testnet");
    expect(comparison.detected?.label).toBe("Mainnet");
  });
});

describe("explorer links", () => {
  it("uses the segment of the network it is given", () => {
    expect(transactionUrl(NETWORKS.testnet, "abc")).toBe(
      "https://stellar.expert/explorer/testnet/tx/abc",
    );
    expect(transactionUrl(NETWORKS.mainnet, "abc")).toBe(
      "https://stellar.expert/explorer/public/tx/abc",
    );
  });

  it("never shares a URL between two networks", () => {
    expect(contractUrl(NETWORKS.testnet, "C1")).not.toBe(
      contractUrl(NETWORKS.mainnet, "C1"),
    );
  });

  it("returns null when the network is not indexed or the value is empty", () => {
    expect(transactionUrl(NETWORKS.futurenet, "abc")).toBeNull();
    expect(contractUrl(NETWORKS.testnet, "")).toBeNull();
  });
});

describe("findNetworkByPassphrase", () => {
  it("returns null for an unknown passphrase", () => {
    expect(findNetworkByPassphrase("nope")).toBeNull();
  });
});

describe("NetworkMismatchError", () => {
  it("names both networks when the wallet network is known", () => {
    const error = new NetworkMismatchError(
      NETWORKS.testnet,
      describeNetwork(Networks.PUBLIC),
    );
    expect(error.message).toContain("Mainnet");
    expect(error.message).toContain("Testnet");
  });

  it("explains an unreadable wallet network", () => {
    const error = new NetworkMismatchError(NETWORKS.testnet, null);
    expect(error.message).toContain("Could not read the wallet network");
  });
});

describe("network capability matrix", () => {
  it("builds complete testnet fixtures through the production builder", () => {
    const capabilities = createNetworkCapabilitiesFixture("testnet");
    expect(capabilities.network.networkPassphrase).toBe(Networks.TESTNET);
    expect(listUnavailableCapabilities(capabilities)).toEqual([]);
  });

  it("names missing factory and discovery capabilities", () => {
    const capabilities = buildNetworkCapabilities("mainnet", {
      NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL: "https://rpc.example",
    });
    expect(listUnavailableCapabilities(capabilities)).toEqual([
      "communityFactory",
      "legacyContracts",
      "proposalDiscovery",
      "privilegedWrites",
    ]);
    expect(() =>
      requireNetworkCapability(capabilities, "communityFactory"),
    ).toThrowError(NetworkCapabilityError);
    try {
      requireNetworkCapability(capabilities, "proposalDiscovery");
    } catch (error) {
      expect(error).toMatchObject({
        name: "NetworkCapabilityError",
        capability: "proposalDiscovery",
        networkId: "mainnet",
      });
    }
  });

  it("keeps invalid discovery ledgers unavailable", () => {
    const capabilities = createNetworkCapabilitiesFixture("testnet", {
      NEXT_PUBLIC_GOVERNOR_START_LEDGER: "0",
    });
    expect(capabilities.proposalDiscovery.available).toBe(false);
  });

  it("allows testnet writes and blocks mainnet writes until the flag is set", () => {
    expect(buildNetworkCapabilities("testnet", {}).privilegedWrites.available).toBe(true);
    const blocked = buildNetworkCapabilities("mainnet", {
      NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL: "https://rpc.example",
    });
    expect(blocked.privilegedWrites.available).toBe(false);
    expect(blocked.rpc.available).toBe(true);
    if (!blocked.privilegedWrites.available) {
      expect(blocked.privilegedWrites.reason).toContain("docs/testnet-to-mainnet-runbook.md");
    }
    expect(
      buildNetworkCapabilities("mainnet", {
        NEXT_PUBLIC_ALLOW_MAINNET_WRITES: "true",
      }).privilegedWrites.available,
    ).toBe(true);
  });

  it("defaults permissionlessCreate to unavailable and unlocks when NEXT_PUBLIC_PERMISSIONLESS_CREATE is true", () => {
    expect(permissionlessCreateAllowed({})).toBe(false);
    const defaultCaps = buildNetworkCapabilities("testnet", {});
    expect(defaultCaps.permissionlessCreate.available).toBe(false);
    if (!defaultCaps.permissionlessCreate.available) {
      expect(defaultCaps.permissionlessCreate.reason).toContain(
        "docs/adr/005-community-factory-registry.md",
      );
      expect(defaultCaps.permissionlessCreate.requiredEnvironment).toEqual([
        "NEXT_PUBLIC_PERMISSIONLESS_CREATE",
      ]);
    }

    expect(
      permissionlessCreateAllowed({
        NEXT_PUBLIC_PERMISSIONLESS_CREATE: "true",
      }),
    ).toBe(true);
    const enabledCaps = buildNetworkCapabilities("testnet", {
      NEXT_PUBLIC_PERMISSIONLESS_CREATE: "true",
    });
    expect(enabledCaps.permissionlessCreate.available).toBe(true);
  });
});

describe("buildHealthGates", () => {
  it("reports every gate available with no reason when the environment is complete", () => {
    const gates = buildHealthGates(createNetworkCapabilitiesFixture("testnet"));
    expect(gates).toHaveLength(6);
    expect(gates.every((gate) => gate.available)).toBe(true);
    expect(gates.every((gate) => gate.reason === null)).toBe(true);
    expect(gates.every((gate) => gate.requiredEnvironment.length === 0)).toBe(true);
    expect(gates.find((gate) => gate.name === "privilegedWrites")?.label).toBe("Mainnet writes");
  });

  it("names the missing capability clearly when mainnet writes are blocked", () => {
    const capabilities = createNetworkCapabilitiesFixture("mainnet", {
      NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL: "https://rpc.mainnet.example",
    });
    const gates = buildHealthGates(capabilities);
    const writesGate = gates.find((gate) => gate.name === "privilegedWrites");
    expect(writesGate?.available).toBe(false);
    expect(writesGate?.reason).toContain("Mainnet writes are off");
    expect(writesGate?.requiredEnvironment).toContain("NEXT_PUBLIC_ALLOW_MAINNET_WRITES");

    // Every other gate stays independently reported — one failure doesn't
    // blank out the rest of the checklist.
    const rpcGate = gates.find((gate) => gate.name === "rpc");
    expect(rpcGate?.available).toBe(true);
    expect(rpcGate?.reason).toBeNull();
  });

  it("links each gate to its runbook anchor", () => {
    const gates = buildHealthGates(createNetworkCapabilitiesFixture("testnet"));
    for (const gate of gates) {
      expect(gate.runbookAnchor.length).toBeGreaterThan(0);
    }
    expect(gates.find((gate) => gate.name === "privilegedWrites")?.runbookAnchor).toBe(
      "final-activation-gate",
    );
  });

  it("surfaces an unconfigured contract as its own named gate, independent of mainnet writes", () => {
    const capabilities = createNetworkCapabilitiesFixture("testnet", {
      NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID: "",
    });
    const gates = buildHealthGates(capabilities);
    const factoryGate = gates.find((gate) => gate.name === "communityFactory");
    expect(factoryGate?.available).toBe(false);
    expect(factoryGate?.reason).toMatch(/CommunityFactory/);
    expect(gates.find((gate) => gate.name === "privilegedWrites")?.available).toBe(true);
  });
});
