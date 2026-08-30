import { describe, expect, it } from "vitest";
import {
  buildStellarExplorerAccountUrl,
  buildStellarExplorerContractUrl,
  buildStellarExplorerTxUrl,
  resolveStellarNetworkId,
} from "@/lib/stellarExplorer";

const VALID_HASH =
  "a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0";

describe("buildStellarExplorerTxUrl", () => {
  it("builds a testnet explorer URL", () => {
    expect(buildStellarExplorerTxUrl(VALID_HASH, "testnet")).toBe(
      `https://stellar.expert/explorer/testnet/tx/${VALID_HASH}`,
    );
  });

  it("builds a mainnet explorer URL", () => {
    expect(buildStellarExplorerTxUrl(VALID_HASH, "mainnet")).toBe(
      `https://stellar.expert/explorer/public/tx/${VALID_HASH}`,
    );
  });

  it("normalizes hash casing", () => {
    expect(buildStellarExplorerTxUrl(VALID_HASH.toUpperCase(), "testnet")).toBe(
      `https://stellar.expert/explorer/testnet/tx/${VALID_HASH}`,
    );
  });

  it("returns null for missing or invalid hashes", () => {
    expect(buildStellarExplorerTxUrl(null, "testnet")).toBeNull();
    expect(buildStellarExplorerTxUrl(undefined, "mainnet")).toBeNull();
    expect(buildStellarExplorerTxUrl("", "testnet")).toBeNull();
    expect(buildStellarExplorerTxUrl("not-a-hash", "testnet")).toBeNull();
    expect(buildStellarExplorerTxUrl("abcd", "mainnet")).toBeNull();
    expect(
      buildStellarExplorerTxUrl(`${VALID_HASH}ff`, "testnet"),
    ).toBeNull();
  });
});

describe("buildStellarExplorerContractUrl", () => {
  const contractId = `C${"A".repeat(55)}`;

  it("builds network-specific contract links", () => {
    expect(buildStellarExplorerContractUrl(contractId, "testnet")).toBe(
      `https://stellar.expert/explorer/testnet/contract/${contractId}`,
    );
    expect(buildStellarExplorerContractUrl(contractId, "mainnet")).toBe(
      `https://stellar.expert/explorer/public/contract/${contractId}`,
    );
  });

  it("rejects malformed contract addresses", () => {
    expect(buildStellarExplorerContractUrl("CNFT", "testnet")).toBeNull();
  });
});

describe("buildStellarExplorerAccountUrl", () => {
  const accountId = `G${"A".repeat(55)}`;

  it("builds network-specific account links", () => {
    expect(buildStellarExplorerAccountUrl(accountId, "testnet")).toBe(
      `https://stellar.expert/explorer/testnet/account/${accountId}`,
    );
    expect(buildStellarExplorerAccountUrl(accountId, "mainnet")).toBe(
      `https://stellar.expert/explorer/public/account/${accountId}`,
    );
  });

  it("returns null for missing or malformed account addresses", () => {
    expect(buildStellarExplorerAccountUrl(null, "testnet")).toBeNull();
    expect(buildStellarExplorerAccountUrl(undefined, "testnet")).toBeNull();
    expect(buildStellarExplorerAccountUrl("", "testnet")).toBeNull();
    expect(buildStellarExplorerAccountUrl("CNFT", "testnet")).toBeNull();
  });
});

describe("resolveStellarNetworkId", () => {
  it("maps configured network values", () => {
    expect(resolveStellarNetworkId("mainnet")).toBe("mainnet");
    expect(resolveStellarNetworkId("testnet")).toBe("testnet");
    expect(resolveStellarNetworkId(undefined)).toBe("testnet");
    expect(resolveStellarNetworkId("other")).toBe("testnet");
  });
});
