import { NextResponse } from "next/server";
import { config, contractIds, stellarConfig } from "@/lib/stellar";
import { checkRegistryReadable } from "@/lib/community/registry";
import { rpc } from "@stellar/stellar-sdk";

export const dynamic = "force-dynamic";

type HealthStatus = "ok" | "degraded";

type HealthResponse = {
  status: HealthStatus;
  healthy: boolean;
  network: {
    selected: "testnet" | "mainnet";
    passphraseConfigured: boolean;
  };
  rpc: {
    configured: boolean;
    reachable: boolean;
  };
  factory: {
    configured: boolean;
  };
  registry: {
    readable: boolean;
  };
  contracts: {
    nftConfigured: boolean;
    governorConfigured: boolean;
    allConfigured: boolean;
  };
};

async function buildResponse(): Promise<{ response: HealthResponse; statusCode: number }> {
  const selected =
    process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
      ? "mainnet"
      : "testnet";

  const rpcConfigured = Boolean(config.rpcUrl && config.rpcUrl.trim() !== "");

  const nftConfigured = Boolean(
    contractIds.nft && contractIds.nft.trim() !== "",
  );
  const governorConfigured = Boolean(
    contractIds.governor && contractIds.governor.trim() !== "",
  );
  const allContractsConfigured = nftConfigured && governorConfigured;
  
  const factoryConfigured = Boolean(
    contractIds.communityFactory && contractIds.communityFactory.trim() !== "",
  );

  const passphraseConfigured = Boolean(config.networkPassphrase);

  const rpcOk =
    selected === "mainnet"
      ? rpcConfigured
      : rpcConfigured || Boolean(stellarConfig.testnet.rpcUrl);
      
  let rpcReachable = false;
  if (rpcOk && config.rpcUrl) {
    try {
      const server = new rpc.Server(config.rpcUrl);
      const health = await server.getHealth();
      rpcReachable = health.status === "healthy";
    } catch {
      rpcReachable = false;
    }
  }

  const registryReadable = await checkRegistryReadable();

  // A healthy response proves that at least the registry interface is readable.
  // We still require passphrase and RPC to be ok, and factory configured.
  // The legacy contracts are no longer mandatory for "healthy" status if factory is present.
  const isHealthy = rpcOk && passphraseConfigured && factoryConfigured && registryReadable;

  const response: HealthResponse = {
    status: isHealthy ? "ok" : "degraded",
    healthy: isHealthy,
    network: {
      selected,
      passphraseConfigured,
    },
    rpc: {
      configured: rpcConfigured,
      reachable: rpcReachable,
    },
    factory: {
      configured: factoryConfigured,
    },
    registry: {
      readable: registryReadable,
    },
    contracts: {
      nftConfigured,
      governorConfigured,
      allConfigured: allContractsConfigured,
    },
  };

  return {
    response,
    statusCode: isHealthy ? 200 : 503,
  };
}

export async function GET() {
  const { response, statusCode } = await buildResponse();

  return NextResponse.json(response, {
    status: statusCode,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
