import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildNetworkCapabilities,
  compareNetworks,
  NETWORKS,
  type ActiveNetworkId,
  type NetworkComparison,
} from "@/lib/network";
import {
  buildRehearsalChecklist,
  readRehearsalConfirmations,
  rehearsalStorageKey,
  rehearsalVerdict,
  runbookUrl,
  toggleRehearsalConfirmation,
  writeRehearsalConfirmations,
  type RehearsalCheck,
  type RehearsalCheckId,
  type RehearsalSignals,
} from "./rehearsal";

const MAINNET_READY = {
  NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL: "https://soroban.example.test",
  NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID: "C".padEnd(56, "A"),
  NEXT_PUBLIC_NFT_CONTRACT_ID: "C".padEnd(56, "B"),
  NEXT_PUBLIC_GOVERNOR_CONTRACT_ID: "C".padEnd(56, "C"),
  NEXT_PUBLIC_GOVERNOR_START_LEDGER: "1000",
  NEXT_PUBLIC_ALLOW_MAINNET_WRITES: "true",
};

const DECLARED: RehearsalCheckId[] = [
  "fees-and-reserves",
  "usdc-trustline",
  "sponsorship",
  "alerts",
  "testnet-rehearsal",
];

function onMainnet(): NetworkComparison {
  return compareNetworks(NETWORKS.mainnet as never, {
    id: "mainnet",
    label: "Mainnet",
    networkPassphrase: NETWORKS.mainnet.networkPassphrase,
  });
}

function onTestnetWallet(): NetworkComparison {
  return compareNetworks(NETWORKS.mainnet as never, {
    id: "testnet",
    label: "Testnet",
    networkPassphrase: NETWORKS.testnet.networkPassphrase,
  });
}

function signals(overrides: Partial<RehearsalSignals> = {}): RehearsalSignals {
  const networkId: ActiveNetworkId = overrides.networkId ?? "mainnet";
  return {
    networkId,
    capabilities: buildNetworkCapabilities(networkId, MAINNET_READY),
    walletNetwork: onMainnet(),
    confirmed: DECLARED,
    ...overrides,
  };
}

function byId(checks: RehearsalCheck[], id: RehearsalCheckId) {
  return checks.find((check) => check.id === id);
}

describe("buildRehearsalChecklist", () => {
  it("passes everything when the deployment is ready and the creator has confirmed", () => {
    const checks = buildRehearsalChecklist(signals());

    expect(checks.every((check) => check.status === "pass")).toBe(true);
    expect(rehearsalVerdict(checks)).toEqual({
      blocked: false,
      blocking: [],
      warnings: [],
      outstanding: [],
    });
  });

  it("hides Mainnet-only items on Testnet rather than showing them as passing", () => {
    // A row reading "wallet is on Mainnet ✓" while the creator is on Testnet
    // would be a false statement.
    const checks = buildRehearsalChecklist(
      signals({ networkId: "testnet", confirmed: [], walletNetwork: null }),
    );

    expect(checks.map((check) => check.id)).toEqual(["rpc", "factory"]);
    expect(checks.some((check) => check.mainnetOnly)).toBe(false);
    expect(rehearsalVerdict(checks).blocked).toBe(false);
  });

  it("names a wrong wallet network in plain language", () => {
    const checks = buildRehearsalChecklist(signals({ walletNetwork: onTestnetWallet() }));
    const wallet = byId(checks, "wallet-network");

    expect(wallet?.status).toBe("fail");
    expect(wallet?.detail).toContain("The wallet is on Testnet");
    expect(wallet?.detail).toContain("a real transaction on that network");
  });

  it("asks for a wallet before claiming anything about its network", () => {
    const wallet = byId(buildRehearsalChecklist(signals({ walletNetwork: null })), "wallet-network");

    expect(wallet?.status).toBe("fail");
    expect(wallet?.detail).toContain("Connect the wallet");
  });

  it("reports a wallet that did not say which network it is on", () => {
    const comparison = compareNetworks(NETWORKS.mainnet as never, null);
    const wallet = byId(
      buildRehearsalChecklist(signals({ walletNetwork: comparison })),
      "wallet-network",
    );

    expect(wallet?.status).toBe("fail");
    expect(wallet?.detail).toContain("did not report a network");
  });

  it("reports missing capabilities as failures, not as unconfirmed", () => {
    // A measured item cannot be ticked away: the signal is the answer.
    const checks = buildRehearsalChecklist(
      signals({ capabilities: buildNetworkCapabilities("mainnet", {}) }),
    );

    expect(byId(checks, "rpc")?.status).toBe("fail");
    expect(byId(checks, "factory")?.status).toBe("fail");
    expect(byId(checks, "writes-enabled")?.status).toBe("fail");
    expect(byId(checks, "writes-enabled")?.detail).toContain("Mainnet writes are off");
  });

  it("leaves an unconfirmed declared item unconfirmed, never passing", () => {
    const checks = buildRehearsalChecklist(signals({ confirmed: [] }));

    for (const id of DECLARED) {
      expect(byId(checks, id)?.status).toBe("unconfirmed");
      expect(byId(checks, id)?.verification).toBe("declared");
    }
    // Each one says that Stolla did not check it, rather than implying it did.
    expect(byId(checks, "fees-and-reserves")?.detail).toContain("cannot read your balance");
    expect(byId(checks, "usdc-trustline")?.detail).toContain("cannot read trustlines");
  });

  it("points every item at a runbook section that exists", () => {
    // A "Runbook" link that lands on the top of a long document because a
    // heading was renamed is worse than no link: the creator concludes the
    // item is not documented.
    const runbook = readFileSync("../../docs/testnet-to-mainnet-runbook.md", "utf8");
    const anchors = new Set(
      runbook
        .split("\n")
        .filter((line) => line.startsWith("#"))
        .map((line) =>
          line
            .replace(/^#+/, "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9 -]/g, "")
            .replace(/ /g, "-"),
        ),
    );

    for (const check of buildRehearsalChecklist(signals())) {
      expect(runbookUrl(check.runbookAnchor)).toContain(
        "docs/testnet-to-mainnet-runbook.md#",
      );
      expect(anchors).toContain(check.runbookAnchor);
    }
  });
});

describe("rehearsalVerdict", () => {
  it("blocks on a hard gate that is failing", () => {
    const verdict = rehearsalVerdict(
      buildRehearsalChecklist(signals({ walletNetwork: onTestnetWallet() })),
    );

    expect(verdict.blocked).toBe(true);
    expect(verdict.blocking.map((check) => check.id)).toEqual(["wallet-network"]);
  });

  it("blocks on a hard gate the creator has not confirmed", () => {
    // Fees are a hard gate this app cannot measure: it blocks until confirmed
    // rather than being shown green unchecked.
    const verdict = rehearsalVerdict(
      buildRehearsalChecklist(
        signals({ confirmed: DECLARED.filter((id) => id !== "fees-and-reserves") }),
      ),
    );

    expect(verdict.blocked).toBe(true);
    expect(verdict.blocking.map((check) => check.id)).toEqual(["fees-and-reserves"]);
  });

  it("never blocks on soft items, however many are outstanding", () => {
    const verdict = rehearsalVerdict(
      buildRehearsalChecklist(signals({ confirmed: ["fees-and-reserves"] })),
    );

    expect(verdict.blocked).toBe(false);
    expect(verdict.warnings.map((check) => check.id)).toEqual([
      "usdc-trustline",
      "sponsorship",
      "alerts",
      "testnet-rehearsal",
    ]);
    expect(verdict.blocking).toEqual([]);
  });

  it("counts hard and soft together only in `outstanding`", () => {
    const verdict = rehearsalVerdict(buildRehearsalChecklist(signals({ confirmed: [] })));

    expect(verdict.outstanding).toHaveLength(5);
    expect(verdict.blocking).toHaveLength(1);
    expect(verdict.warnings).toHaveLength(4);
  });
});

describe("confirmations on this device", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round trips through storage, per network", () => {
    writeRehearsalConfirmations("mainnet", ["fees-and-reserves"]);

    expect(readRehearsalConfirmations("mainnet")).toEqual(["fees-and-reserves"]);
    expect(readRehearsalConfirmations("testnet")).toEqual([]);
  });

  it("refuses a stored confirmation for a measured item", () => {
    // Otherwise a hand-edited store could tick away a signal the app read.
    localStorage.setItem(
      rehearsalStorageKey("mainnet"),
      JSON.stringify(["writes-enabled", "rpc", "fees-and-reserves"]),
    );

    expect(readRehearsalConfirmations("mainnet")).toEqual(["fees-and-reserves"]);
  });

  it("confirms nothing when storage holds something else", () => {
    localStorage.setItem(rehearsalStorageKey("mainnet"), "{not json");
    expect(readRehearsalConfirmations("mainnet")).toEqual([]);

    localStorage.setItem(rehearsalStorageKey("mainnet"), JSON.stringify({ fees: true }));
    expect(readRehearsalConfirmations("mainnet")).toEqual([]);
  });

  it("survives storage that refuses to be written", () => {
    const setItem = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });

    expect(() => writeRehearsalConfirmations("mainnet", ["alerts"])).not.toThrow();
    setItem.mockRestore();
  });

  it("toggles one declared item at a time and ignores measured ones", () => {
    expect(toggleRehearsalConfirmation([], "alerts")).toEqual(["alerts"]);
    expect(toggleRehearsalConfirmation(["alerts"], "alerts")).toEqual([]);
    expect(toggleRehearsalConfirmation(["alerts"], "rpc")).toEqual(["alerts"]);
  });
});
