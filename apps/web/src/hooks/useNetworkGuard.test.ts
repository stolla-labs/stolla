import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { Networks } from "@stellar/stellar-sdk";
import { useNetworkGuard } from "./useNetworkGuard";

const wallet = vi.hoisted(() => ({
  walletNetwork: null as string | null,
  walletNetworkPassphrase: null as string | null,
}));

vi.mock("@/context/WalletProvider", () => ({
  useWallet: () => ({
    walletNetwork: wallet.walletNetwork,
    walletNetworkPassphrase: wallet.walletNetworkPassphrase,
  }),
}));

vi.mock("@/lib/stellar", () => ({
  activeNetwork: {
    id: "testnet",
    label: "Testnet",
    passphrase: Networks.TESTNET,
    explorerSegment: "testnet",
  },
}));

describe("useNetworkGuard", () => {
  it("does not treat the wallet network id string as a DetectedNetwork", () => {
    // Regression: compareNetworks(expected, "testnet") is truthy but has no
    // passphrase, so it falsely reports mismatch with a blank detected label.
    wallet.walletNetwork = "testnet";
    wallet.walletNetworkPassphrase = Networks.TESTNET;

    const { result } = renderHook(() => useNetworkGuard());
    expect(result.current.status).toBe("match");
    expect(result.current.detected?.label).toBe("Testnet");
  });

  it("reports unknown when the passphrase has not been read yet", () => {
    wallet.walletNetwork = "testnet";
    wallet.walletNetworkPassphrase = null;

    const { result } = renderHook(() => useNetworkGuard());
    expect(result.current.status).toBe("unknown");
  });

  it("reports mismatch when the passphrase is Mainnet", () => {
    wallet.walletNetwork = "mainnet";
    wallet.walletNetworkPassphrase = Networks.PUBLIC;

    const { result } = renderHook(() => useNetworkGuard());
    expect(result.current.status).toBe("mismatch");
    expect(result.current.detected?.label).toBe("Mainnet");
  });
});
