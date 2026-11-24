import { nativeToScVal, scValToNative, xdr } from "@stellar/stellar-sdk";
import { AssembledTransaction } from "@stellar/stellar-sdk/contract";
import { requireRpcConfig } from "@/lib/stellar";

export const PRICE_ORACLE_CONTRACT_ID_ENV =
  "NEXT_PUBLIC_PRICE_ORACLE_CONTRACT_ID";
export const PRICE_ORACLE_FEED_ENV = "NEXT_PUBLIC_PRICE_ORACLE_FEED";

type CapabilityEnvironment = Record<string, string | undefined>;

export type PriceOracleReadKind =
  | "not_configured"
  | "unset_feed"
  | "rpc_fail";

export type PriceOracleReading = {
  feed: string;
  price: bigint;
  priceTimestamp: number;
};

export type PriceOracleReadResult =
  | { ok: true; reading: PriceOracleReading }
  | { ok: false; kind: PriceOracleReadKind; message: string };

export type PriceOracleInvocation = {
  contractId: string;
  method: "price" | "price_timestamp";
  args: xdr.ScVal[];
};

/** RPC boundary. Tests substitute this instead of the network. */
export type PriceOracleRpc = {
  prepare(invocation: PriceOracleInvocation): Promise<unknown>;
};

export function readPriceOracleContractId(
  environment: CapabilityEnvironment = process.env,
): string | null {
  const value = environment[PRICE_ORACLE_CONTRACT_ID_ENV]?.trim() ?? "";
  return value.length > 0 ? value : null;
}

export function readPriceOracleDefaultFeed(
  environment: CapabilityEnvironment = process.env,
): string {
  return environment[PRICE_ORACLE_FEED_ENV]?.trim() ?? "";
}

export function isPriceOracleConfigured(
  environment: CapabilityEnvironment = process.env,
): boolean {
  return readPriceOracleContractId(environment) !== null;
}

function normalizeFeed(feed: string): string {
  return feed.trim();
}

function parseI128(value: unknown): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return BigInt(value);
  }
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    return BigInt(value);
  }
  return null;
}

function parseU32(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === "bigint" && value >= BigInt(0) && value <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number(value);
  }
  return null;
}

function describeRpcError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/fetch|network|rpc|timeout|ECONN|ENOTFOUND/i.test(message)) {
    return `Price oracle RPC failed: ${message}. Check NEXT_PUBLIC_STELLAR_RPC_URL and retry.`;
  }
  return `Price oracle read failed: ${message || "unknown RPC error"}. Check the contract id and network, then retry.`;
}

export function createDefaultPriceOracleRpc(): PriceOracleRpc {
  const rpc = requireRpcConfig();
  return {
    async prepare(invocation) {
      const transaction = await AssembledTransaction.build<unknown>({
        contractId: invocation.contractId,
        method: invocation.method,
        args: invocation.args,
        networkPassphrase: rpc.networkPassphrase,
        rpcUrl: rpc.rpcUrl,
        parseResultXdr: (value) => scValToNative(value),
      });
      return transaction.result;
    },
  };
}

export async function readOraclePrice(input: {
  contractId: string | null;
  feed: string;
  rpc?: PriceOracleRpc;
}): Promise<PriceOracleReadResult> {
  if (!input.contractId) {
    return {
      ok: false,
      kind: "not_configured",
      message:
        "Price oracle contract id is not configured. Set NEXT_PUBLIC_PRICE_ORACLE_CONTRACT_ID to enable the experimental panel.",
    };
  }

  const feed = normalizeFeed(input.feed);
  if (!feed) {
    return {
      ok: false,
      kind: "unset_feed",
      message:
        "No oracle feed symbol is set. Enter a feed (for example XLM_USDC) or set NEXT_PUBLIC_PRICE_ORACLE_FEED.",
    };
  }

  const args = [nativeToScVal(feed, { type: "symbol" })];
  const rpc = input.rpc ?? createDefaultPriceOracleRpc();

  try {
    const [priceRaw, timestampRaw] = await Promise.all([
      rpc.prepare({
        contractId: input.contractId,
        method: "price",
        args,
      }),
      rpc.prepare({
        contractId: input.contractId,
        method: "price_timestamp",
        args,
      }),
    ]);

    const price = parseI128(priceRaw);
    const priceTimestamp = parseU32(timestampRaw);
    if (price === null || priceTimestamp === null) {
      return {
        ok: false,
        kind: "rpc_fail",
        message:
          "Price oracle returned an unexpected value shape. Confirm the contract implements price/price_timestamp and retry.",
      };
    }

    return {
      ok: true,
      reading: { feed, price, priceTimestamp },
    };
  } catch (error: unknown) {
    return {
      ok: false,
      kind: "rpc_fail",
      message: describeRpcError(error),
    };
  }
}
