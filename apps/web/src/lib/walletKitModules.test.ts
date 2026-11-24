import { describe, expect, it } from "vitest";
import { membershipFromBalance } from "@/lib/community/membership";
import {
  DEFAULT_WALLET_MODULE_ID,
  SMOKE_VERIFIED_WALLET_MODULES,
  WALLET_MODULE_MATRIX,
  isSmokeVerifiedWalletModule,
  readMembershipBalance,
  walletModulesBySupport,
} from "./walletKitModules";

describe("wallet kit smoke matrix metadata", () => {
  it("keeps Freighter as the default module id", () => {
    expect(DEFAULT_WALLET_MODULE_ID).toBe("freighter");
    expect(SMOKE_VERIFIED_WALLET_MODULES[0]).toBe("freighter");
  });

  it("lists Freighter and Lobstr as smoke-verified", () => {
    expect([...SMOKE_VERIFIED_WALLET_MODULES]).toEqual(["freighter", "lobstr"]);
    expect(isSmokeVerifiedWalletModule("freighter")).toBe(true);
    expect(isSmokeVerifiedWalletModule("lobstr")).toBe(true);
    expect(isSmokeVerifiedWalletModule("xbull")).toBe(false);
    expect(isSmokeVerifiedWalletModule("trezor")).toBe(false);
  });

  it("marks hardware and mobile deep-link modules unsupported", () => {
    const unsupported = walletModulesBySupport("unsupported").map((row) => row.id);
    expect(unsupported).toEqual(
      expect.arrayContaining(["trezor", "ledger", "wallet-connect"]),
    );
    for (const id of unsupported) {
      expect(isSmokeVerifiedWalletModule(id)).toBe(false);
    }
  });

  it("keeps xBull unverified until a later smoke extension", () => {
    const xbull = WALLET_MODULE_MATRIX.find((row) => row.id === "xbull");
    expect(xbull?.support).toBe("unverified");
  });

  it("reads a membership balance after connect for the smoke path", async () => {
    const balance = await readMembershipBalance("GMEMBER", async (account) => {
      expect(account).toBe("GMEMBER");
      return 2n;
    });
    expect(balance).toBe(2);
    expect(membershipFromBalance(balance)).toBe("member");
  });
});
