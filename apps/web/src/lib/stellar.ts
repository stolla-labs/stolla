import {
  buildNetworkCapabilities,
  parsePositiveLedger,
  requireNetworkCapability,
  resolveActiveNetworkId,
} from "./network";

export const stellarNetwork = resolveActiveNetworkId(
  process.env.NEXT_PUBLIC_STELLAR_NETWORK,
);

// Next.js only substitutes public environment variables when their property
// names are statically visible. Pass an explicit snapshot to the pure builder
// so browser bundles receive the same matrix as server code and tests.
const publicCapabilityEnvironment = {
  NEXT_PUBLIC_STELLAR_RPC_URL: process.env.NEXT_PUBLIC_STELLAR_RPC_URL,
  NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL:
    process.env.NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL,
  NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID:
    process.env.NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID,
  NEXT_PUBLIC_NFT_CONTRACT_ID: process.env.NEXT_PUBLIC_NFT_CONTRACT_ID,
  NEXT_PUBLIC_GOVERNOR_CONTRACT_ID:
    process.env.NEXT_PUBLIC_GOVERNOR_CONTRACT_ID,
  NEXT_PUBLIC_GOVERNOR_START_LEDGER:
    process.env.NEXT_PUBLIC_GOVERNOR_START_LEDGER,
};

/** Single typed source for the active network and every deployment capability. */
export const activeCapabilities = buildNetworkCapabilities(
  stellarNetwork,
  publicCapabilityEnvironment,
);
export const activeNetwork = activeCapabilities.network;

/** Compatibility view for callers that enumerate supported deployment networks. */
export const stellarConfig = {
  testnet: buildNetworkCapabilities("testnet", publicCapabilityEnvironment).rpc,
  mainnet: buildNetworkCapabilities("mainnet", publicCapabilityEnvironment).rpc,
} as const;

/** RPC clients consume one unambiguous `networkPassphrase` field. */
export const config = {
  rpcUrl: activeCapabilities.rpc.url,
  horizonUrl: activeCapabilities.rpc.horizonUrl,
  networkPassphrase: activeNetwork.networkPassphrase,
  friendbotUrl: activeCapabilities.rpc.friendbotUrl,
} as const;

export const contractIds = {
  nft: activeCapabilities.contracts.legacyNft,
  governor: activeCapabilities.contracts.legacyGovernor,
  communityFactory: activeCapabilities.contracts.communityFactory,
  factory: activeCapabilities.contracts.communityFactory,
};

export function requireRpcConfig() {
  const rpc = requireNetworkCapability(activeCapabilities, "rpc");
  return { rpcUrl: rpc.url, networkPassphrase: activeNetwork.networkPassphrase };
}

export function requireContractIds(): { nft: string; governor: string } {
  const legacy = requireNetworkCapability(activeCapabilities, "legacyContracts");
  return { nft: legacy.nftContractId, governor: legacy.governorContractId };
}

export function requireCommunityFactoryId(): string {
  return requireNetworkCapability(activeCapabilities, "communityFactory").contractId;
}

export function requireCommunityFactoryContractId(): string {
  return requireCommunityFactoryId();
}

export function parseGovernorStartLedger(
  rawValue?: string,
): number {
  const value =
    arguments.length === 0
      ? process.env.NEXT_PUBLIC_GOVERNOR_START_LEDGER
      : rawValue;
  const ledger = parsePositiveLedger(value);
  if (ledger !== null) return ledger;
  if (value === undefined || value.trim() === "") {
    throw new Error(
      "Governor start ledger is not configured. Set NEXT_PUBLIC_GOVERNOR_START_LEDGER to the positive integer ledger where the Governor was deployed (see README).",
    );
  }
  throw new Error(
    `Invalid NEXT_PUBLIC_GOVERNOR_START_LEDGER: expected a positive integer, got "${value}".`,
  );
}

export function requireGovernorStartLedger(): number {
  const startLedger = requireNetworkCapability(
    activeCapabilities,
    "proposalDiscovery",
  ).startLedger;
  if (startLedger === null) {
    throw new Error("Proposal discovery start ledger is unavailable.");
  }
  return startLedger;
}
