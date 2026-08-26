import { NextResponse } from "next/server";
import { config, contractIds } from "@/lib/stellar";

export const dynamic = "force-dynamic";

type HealthStatus = "ok" | "degraded";

type HealthResponse = {
  status: HealthStatus;
  network: {
    selected: "testnet" | "mainnet";
    networkPassphraseConfigured: boolean;
  };
  rpc: {
    configured: boolean;
  };
  contracts: {
    nftConfigured: boolean;
    governorConfigured: boolean;
    allConfigured: boolean;
  };
};

function buildResponse(): { response: HealthResponse; statusCode: number } {
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

  const passphraseConfigured = Boolean(config.networkPassphrase);

  const rpcOk =
    rpcConfigured;

  const isReady = rpcOk && allContractsConfigured && passphraseConfigured;

  const response: HealthResponse = {
    status: isReady ? "ok" : "degraded",
    network: {
      selected,
      networkPassphraseConfigured: passphraseConfigured,
    },
    rpc: {
      configured: rpcConfigured,
    },
    contracts: {
      nftConfigured,
      governorConfigured,
      allConfigured: allContractsConfigured,
    },
  };

  return {
    response,
    statusCode: isReady ? 200 : 503,
  };
}

export async function GET() {
  const { response, statusCode } = buildResponse();

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
