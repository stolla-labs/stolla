import type { NetworkCapabilities } from "@/lib/capabilities";
import { NETWORKS } from "@/lib/network";

export function buildNetworkCapabilityFixture(overrides?: Partial<NetworkCapabilities>): NetworkCapabilities {
  return {
    activeNetwork: NETWORKS.testnet,
    rpc: { available: true, url: "https://soroban-testnet.stellar.org", friendbotUrl: "https://friendbot.stellar.org" },
    explorer: { available: true, segment: "testnet" },
    communityFactory: { available: true, contractId: "CFACTORY" },
    legacyContracts: { available: true, nft: "CNFT", governor: "CGOV" },
    proposalDiscovery: { available: true, startLedger: 1000 },
    ...overrides,
  };
}
