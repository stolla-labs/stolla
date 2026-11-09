import { describe, expect, it } from "vitest";
import {
  connectE2EWallet,
  disconnectE2EWallet,
  evaluateHeaderOverflowBounds,
  shouldAutoConnectE2EWallet,
  type E2EWalletConfig,
} from "./e2eMock";

describe("E2E wallet bridge & mobile header overflow helpers (#395)", () => {
  const sampleAddress =
    "GD4GQO72YZ6LTEKTLCZRLXB6YKX7WM5NTOJNLXU75PPYRWXWUY23BZ2O";

  it("supports deferred connect -> disconnect -> reconnect lifecycle without auto-reconnect polling overwrite", () => {
    const wallet: E2EWalletConfig = {
      address: sampleAddress,
      networkPassphrase: "Test SDF Network ; September 2015",
      autoConnect: false,
      disconnected: false,
    };

    expect(shouldAutoConnectE2EWallet(wallet)).toBe(false);

    const connected = connectE2EWallet(wallet);
    expect(connected?.address).toBe(sampleAddress);
    expect(shouldAutoConnectE2EWallet(wallet)).toBe(true);

    expect(disconnectE2EWallet(wallet)).toBe(true);
    expect(shouldAutoConnectE2EWallet(wallet)).toBe(false);

    // Clicking Connect Wallet again re-enables the E2E wallet
    connectE2EWallet(wallet);
    expect(shouldAutoConnectE2EWallet(wallet)).toBe(true);
  });

  it("auto-connects by default when autoConnect is omitted", () => {
    const wallet: E2EWalletConfig = {
      address: sampleAddress,
      networkPassphrase: "Test SDF Network ; September 2015",
    };
    expect(shouldAutoConnectE2EWallet(wallet)).toBe(true);
  });

  it("evaluates mobile header overflow bounds on 390px viewports", () => {
    expect(
      evaluateHeaderOverflowBounds({
        viewportWidth: 390,
        clientWidth: 390,
        documentWidth: 390,
        bodyWidth: 390,
        headerRightEdge: 390,
      }),
    ).toEqual({
      withinViewport: true,
      reasons: [],
    });

    const overflowing = evaluateHeaderOverflowBounds({
      viewportWidth: 390,
      clientWidth: 390,
      documentWidth: 428,
      bodyWidth: 390,
      headerRightEdge: 412,
    });
    expect(overflowing.withinViewport).toBe(false);
    expect(overflowing.reasons).toHaveLength(2);
  });
});
