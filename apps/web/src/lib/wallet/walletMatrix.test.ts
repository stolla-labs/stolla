import { describe, expect, it } from "vitest";
import {
  DEFAULT_WALLET_PRODUCT_ID,
  SECONDARY_VERIFIED_WALLET_PRODUCT_ID,
  WALLET_COMPATIBILITY_MATRIX,
  getUnsupportedWalletEntries,
  getVerifiedWalletEntries,
  isVerifiedWalletProductId,
  runWalletModuleSmokePath,
  toWalletConnectionError,
  type KitLikeWalletModule,
} from "./walletMatrix";

function createMockKitModule(
  productId: string,
  productName: string,
  address: string,
  available = true,
): KitLikeWalletModule {
  return {
    productId,
    productName,
    isAvailable: async () => available,
    getAddress: async () => ({ address }),
    getNetwork: async () => ({
      network: "TESTNET",
      networkPassphrase: "Test SDF Network ; September 2015",
    }),
    signTransaction: async (xdr) => ({
      signedTxXdr: `signed:${productId}:${xdr}`,
      signerAddress: address,
    }),
  };
}

describe("multi-wallet smoke matrix (#396)", () => {
  const freighterAddress =
    "GFREIGHTER1111111111111111111111111111111111111111111111";
  const xbullAddress =
    "GXBULL22222222222222222222222222222222222222222222222222";

  it("keeps Freighter as default and lists xBull as verified secondary while marking Trezor/mobile unsupported", () => {
    const verified = getVerifiedWalletEntries();
    expect(verified.map((e) => e.productId)).toEqual([
      DEFAULT_WALLET_PRODUCT_ID,
      SECONDARY_VERIFIED_WALLET_PRODUCT_ID,
    ]);
    expect(verified[0].isDefault).toBe(true);
    expect(verified[1].isDefault).toBe(false);

    const unsupportedIds = getUnsupportedWalletEntries().map((e) => e.productId);
    expect(unsupportedIds).toContain("trezor");
    expect(unsupportedIds).toContain("walletconnect");
    expect(unsupportedIds).toContain("lobstr");
  });

  it("executes connect -> read-balance smoke path across Freighter and xBull modules and switches cleanly", async () => {
    const balances = new Map<string, bigint>([
      [freighterAddress, 3n],
      [xbullAddress, 7n],
    ]);
    const readBalance = async (addr: string) => balances.get(addr) ?? 0n;

    const freighterModule = createMockKitModule(
      "freighter",
      "Freighter",
      freighterAddress,
    );
    const xbullModule = createMockKitModule("xbull", "xBull", xbullAddress);

    const firstSession = await runWalletModuleSmokePath(
      freighterModule,
      readBalance,
    );
    expect(firstSession.productId).toBe("freighter");
    expect(firstSession.address).toBe(freighterAddress);
    expect(firstSession.votingPowerBalance).toBe(3n);

    // Switching to the secondary verified kit module succeeds without crashing
    const secondSession = await runWalletModuleSmokePath(
      xbullModule,
      readBalance,
    );
    expect(secondSession.productId).toBe("xbull");
    expect(secondSession.address).toBe(xbullAddress);
    expect(secondSession.votingPowerBalance).toBe(7n);
  });

  it("rejects unsupported hardware or mobile modules and preserves Freighter default UI copy on unavailable errors", async () => {
    expect(isVerifiedWalletProductId("trezor")).toBe(false);
    const trezorModule = createMockKitModule(
      "trezor",
      "Trezor",
      freighterAddress,
    );

    await expect(
      runWalletModuleSmokePath(trezorModule, async () => 1n),
    ).rejects.toThrow(/not in the verified smoke matrix/);

    const err = toWalletConnectionError(new Error("xBull wallet is not installed"));
    expect(err?.code).toBe("wallet-unavailable");
    expect(err?.message).toContain("Freighter");
  });

  it("documents every matrix entry with non-empty notes", () => {
    for (const entry of WALLET_COMPATIBILITY_MATRIX) {
      expect(entry.notes.trim().length).toBeGreaterThan(10);
    }
  });
});
