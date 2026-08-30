import { NextResponse } from "next/server";
import { activeCapabilities } from "@/lib/stellar";
import {
  listUnavailableCapabilities,
  type NetworkCapabilityName,
} from "@/lib/network";

export const dynamic = "force-dynamic";

type HealthResponse = {
  status: "ok" | "degraded";
  network: { selected: "testnet" | "mainnet"; passphraseConfigured: boolean };
  rpc: { configured: boolean };
  contracts: { nftConfigured: boolean; governorConfigured: boolean; allConfigured: boolean };
  capabilities: Record<NetworkCapabilityName, boolean>;
  unavailableCapabilities: NetworkCapabilityName[];
};

function buildResponse(): { response: HealthResponse; statusCode: number } {
  const capabilities = activeCapabilities;
  const nftConfigured = Boolean(capabilities.contracts.legacyNft);
  const governorConfigured = Boolean(capabilities.contracts.legacyGovernor);
  const legacyConfigured = capabilities.legacyContracts.available;
  const factoryConfigured = capabilities.communityFactory.available;
  const isReady = capabilities.rpc.available && (legacyConfigured || factoryConfigured);
  const unavailableCapabilities = listUnavailableCapabilities(capabilities);

  return {
    response: {
      status: isReady ? "ok" : "degraded",
      network: {
        selected: capabilities.network.id,
        passphraseConfigured: Boolean(capabilities.network.networkPassphrase),
      },
      rpc: { configured: capabilities.rpc.available },
      contracts: {
        nftConfigured,
        governorConfigured,
        allConfigured: legacyConfigured,
      },
      capabilities: {
        rpc: capabilities.rpc.available,
        explorer: capabilities.explorer.available,
        communityFactory: factoryConfigured,
        legacyContracts: legacyConfigured,
        proposalDiscovery: capabilities.proposalDiscovery.available,
      },
      unavailableCapabilities,
    },
    statusCode: isReady ? 200 : 503,
  };
}

export async function GET() {
  const { response, statusCode } = buildResponse();
  return NextResponse.json(response, {
    status: statusCode,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
