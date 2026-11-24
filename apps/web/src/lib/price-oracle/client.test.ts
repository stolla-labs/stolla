import { describe, expect, it, vi } from "vitest";
import {
  isPriceOracleConfigured,
  readOraclePrice,
  readPriceOracleContractId,
  readPriceOracleDefaultFeed,
  type PriceOracleRpc,
} from "./client";

const CONTRACT = "CORACLE000000000000000000000000000000000000000000000000001";

function rpc(prepare: PriceOracleRpc["prepare"]): PriceOracleRpc {
  return { prepare };
}

describe("price oracle client", () => {
  it("treats a missing contract id as unconfigured", () => {
    expect(readPriceOracleContractId({})).toBeNull();
    expect(
      readPriceOracleContractId({ NEXT_PUBLIC_PRICE_ORACLE_CONTRACT_ID: "  " }),
    ).toBeNull();
    expect(
      readPriceOracleContractId({
        NEXT_PUBLIC_PRICE_ORACLE_CONTRACT_ID: ` ${CONTRACT} `,
      }),
    ).toBe(CONTRACT);
    expect(isPriceOracleConfigured({})).toBe(false);
    expect(
      isPriceOracleConfigured({
        NEXT_PUBLIC_PRICE_ORACLE_CONTRACT_ID: CONTRACT,
      }),
    ).toBe(true);
  });

  it("reads the optional default feed from the environment", () => {
    expect(readPriceOracleDefaultFeed({})).toBe("");
    expect(
      readPriceOracleDefaultFeed({
        NEXT_PUBLIC_PRICE_ORACLE_FEED: " XLM_USDC ",
      }),
    ).toBe("XLM_USDC");
  });

  it("returns an actionable error when the contract id is missing", async () => {
    const prepare = vi.fn();
    const result = await readOraclePrice({
      contractId: null,
      feed: "XLM_USDC",
      rpc: rpc(prepare),
    });
    expect(result).toMatchObject({ ok: false, kind: "not_configured" });
    expect(prepare).not.toHaveBeenCalled();
  });

  it("returns an actionable error when the feed is unset", async () => {
    const prepare = vi.fn();
    const result = await readOraclePrice({
      contractId: CONTRACT,
      feed: "   ",
      rpc: rpc(prepare),
    });
    expect(result).toMatchObject({ ok: false, kind: "unset_feed" });
    expect(result.ok === false && result.message).toMatch(/feed/i);
    expect(prepare).not.toHaveBeenCalled();
  });

  it("reads price and timestamp through a mocked oracle RPC", async () => {
    const prepare = vi.fn(async (invocation) => {
      if (invocation.method === "price") return BigInt(1_234_567);
      if (invocation.method === "price_timestamp") return 42;
      throw new Error(`unexpected method ${invocation.method}`);
    });

    const result = await readOraclePrice({
      contractId: CONTRACT,
      feed: "XLM_USDC",
      rpc: rpc(prepare),
    });

    expect(result).toEqual({
      ok: true,
      reading: {
        feed: "XLM_USDC",
        price: BigInt(1_234_567),
        priceTimestamp: 42,
      },
    });
    expect(prepare).toHaveBeenCalledTimes(2);
  });

  it("maps RPC failures to an actionable rpc_fail result", async () => {
    const prepare = vi.fn(async () => {
      throw new Error("RPC timeout talking to fetch endpoint");
    });
    const result = await readOraclePrice({
      contractId: CONTRACT,
      feed: "XLM_USDC",
      rpc: rpc(prepare),
    });
    expect(result).toMatchObject({ ok: false, kind: "rpc_fail" });
    expect(result.ok === false && result.message).toMatch(/RPC failed/i);
    expect(result.ok === false && result.message).toMatch(
      /NEXT_PUBLIC_STELLAR_RPC_URL/,
    );
  });
});
