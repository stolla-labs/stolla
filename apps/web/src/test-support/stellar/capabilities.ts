import {
  buildNetworkCapabilities,
  type ActiveNetworkId,
} from "@/lib/network";

export const TEST_NFT_CONTRACT_ID = `C${"N".repeat(55)}`;
export const TEST_GOVERNOR_CONTRACT_ID = `C${"G".repeat(55)}`;
export const TEST_FACTORY_CONTRACT_ID = `C${"F".repeat(55)}`;

export function completeNetworkEnvironment(
  networkId: ActiveNetworkId = "testnet",
  overrides: Record<string, string | undefined> = {},
) {
  return {
    NEXT_PUBLIC_STELLAR_NETWORK: networkId,
    ...(networkId === "mainnet"
      ? { NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL: "https://rpc.mainnet.example" }
      : { NEXT_PUBLIC_STELLAR_RPC_URL: "https://rpc.testnet.example" }),
    NEXT_PUBLIC_NFT_CONTRACT_ID: TEST_NFT_CONTRACT_ID,
    NEXT_PUBLIC_GOVERNOR_CONTRACT_ID: TEST_GOVERNOR_CONTRACT_ID,
    NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID: TEST_FACTORY_CONTRACT_ID,
    NEXT_PUBLIC_GOVERNOR_START_LEDGER: "12345",
    ...overrides,
  };
}

/** Every network fixture is produced by the production capability builder. */
export function createNetworkCapabilitiesFixture(
  networkId: ActiveNetworkId = "testnet",
  overrides: Record<string, string | undefined> = {},
) {
  return buildNetworkCapabilities(
    networkId,
    completeNetworkEnvironment(networkId, overrides),
  );
}
