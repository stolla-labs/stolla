import { Networks } from "@stellar/stellar-sdk";

import {
  MOCK_GOVERNOR_CONTRACT_ID,
  MOCK_NFT_CONTRACT_ID,
} from "./fixtures";

export type NetworkFixtureOptions = {
  network?: "testnet" | "mainnet";
  rpcUrl?: string;
  horizonUrl?: string;
  governorContractId?: string;
  nftContractId?: string;
  communityFactoryContractId?: string;
  governorStartLedger?: number;
};

/**
 * Builds the complete public surface tests commonly mock from `lib/stellar`.
 * URLs use the reserved `.test` suffix so an accidental request cannot reach a
 * live Stellar service.
 */
export function createNetworkFixture(options: NetworkFixtureOptions = {}) {
  const network = options.network ?? "testnet";
  const testnetConfig = {
    rpcUrl: "https://stellar-rpc.testnet.test",
    horizonUrl: "https://stellar-horizon.testnet.test",
    networkPassphrase: Networks.TESTNET,
    friendbotUrl: null,
  };
  const mainnetConfig = {
    rpcUrl: "https://stellar-rpc.mainnet.test",
    horizonUrl: "https://stellar-horizon.mainnet.test",
    networkPassphrase: Networks.PUBLIC,
    friendbotUrl: null,
  };
  const selectedConfig = network === "mainnet" ? mainnetConfig : testnetConfig;
  const config = {
    ...selectedConfig,
    rpcUrl: options.rpcUrl ?? selectedConfig.rpcUrl,
    horizonUrl: options.horizonUrl ?? selectedConfig.horizonUrl,
  };
  const networkPassphrase = config.networkPassphrase;
  const communityFactory =
    options.communityFactoryContractId ?? `C${"F".repeat(55)}`;
  const governorStartLedger = options.governorStartLedger ?? 1_500_000;
  const contractIds = {
    nft: options.nftContractId ?? MOCK_NFT_CONTRACT_ID,
    governor: options.governorContractId ?? MOCK_GOVERNOR_CONTRACT_ID,
    communityFactory,
    factory: communityFactory,
  };

  return {
    activeNetwork: {
      id: network,
      label: network === "mainnet" ? "Mainnet" : "Testnet",
      passphrase: networkPassphrase,
      explorerSegment: network === "mainnet" ? "public" : "testnet",
    },
    config,
    contractIds,
    stellarConfig: {
      testnet: testnetConfig,
      mainnet: mainnetConfig,
    },
    stellarNetwork: network,
    requireCommunityFactoryContractId: () => communityFactory,
    requireCommunityFactoryId: () => communityFactory,
    requireContractIds: () => ({
      nft: contractIds.nft,
      governor: contractIds.governor,
    }),
    parseGovernorStartLedger: () => governorStartLedger,
    requireGovernorStartLedger: () => governorStartLedger,
  };
}

export type NetworkFixture = ReturnType<typeof createNetworkFixture>;
