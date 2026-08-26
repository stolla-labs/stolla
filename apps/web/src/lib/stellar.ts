import { NETWORKS } from "./network";
import { type NetworkCapabilities, CapabilityError } from "./capabilities";

const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet";
export const stellarNetwork = network === "mainnet" ? "mainnet" : "testnet";
export const activeNetwork = NETWORKS[stellarNetwork];

function requireEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

const rpcUrl = requireEnv(stellarNetwork === "mainnet" ? "NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL" : "NEXT_PUBLIC_STELLAR_RPC_URL") 
  ?? (stellarNetwork === "testnet" ? "https://soroban-testnet.stellar.org" : undefined);
  
const friendbotUrl = stellarNetwork === "testnet" ? "https://friendbot.stellar.org" : null;

const rpcCapability: NetworkCapabilities["rpc"] = rpcUrl 
  ? { available: true, url: rpcUrl, friendbotUrl }
  : { available: false, reason: "RPC URL is not configured." };

const explorerSegment = activeNetwork.explorerSegment;
const explorerCapability: NetworkCapabilities["explorer"] = explorerSegment
  ? { available: true, segment: explorerSegment }
  : { available: false, reason: "Network is not indexed by an explorer." };

const communityFactory = requireEnv("NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID");
const communityFactoryCapability: NetworkCapabilities["communityFactory"] = communityFactory
  ? { available: true, contractId: communityFactory }
  : { available: false, reason: "CommunityFactory contract ID is not configured." };

const nft = requireEnv("NEXT_PUBLIC_NFT_CONTRACT_ID");
const governor = requireEnv("NEXT_PUBLIC_GOVERNOR_CONTRACT_ID");
const legacyContractsCapability: NetworkCapabilities["legacyContracts"] = nft && governor
  ? { available: true, nft, governor }
  : { available: false, reason: "Legacy contracts (NFT and/or Governor) are not configured." };

let proposalDiscoveryCapability: NetworkCapabilities["proposalDiscovery"];
try {
  const startLedger = parseGovernorStartLedger(process.env.NEXT_PUBLIC_GOVERNOR_START_LEDGER);
  proposalDiscoveryCapability = { available: true as const, startLedger };
} catch (e) {
  proposalDiscoveryCapability = { available: false as const, reason: e instanceof Error ? e.message : String(e) };
}

export const capabilities: NetworkCapabilities = {
  activeNetwork,
  rpc: rpcCapability,
  explorer: explorerCapability,
  communityFactory: communityFactoryCapability,
  legacyContracts: legacyContractsCapability,
  proposalDiscovery: proposalDiscoveryCapability,
};

// Aliasing config for migration
export const config = {
  rpcUrl: rpcCapability.available ? rpcCapability.url : "",
  networkPassphrase: activeNetwork.networkPassphrase,
};

export const contractIds = { communityFactory: communityFactoryCapability.available ? communityFactoryCapability.contractId : "",
  nft: legacyContractsCapability.available ? legacyContractsCapability.nft : "",
  governor: legacyContractsCapability.available ? legacyContractsCapability.governor : "",
  factory: communityFactoryCapability.available ? communityFactoryCapability.contractId : "",
};

export function requireContractIds() {
  if (!legacyContractsCapability.available) {
    throw new CapabilityError("legacyContracts", legacyContractsCapability.reason);
  }
  return { nft: legacyContractsCapability.nft, governor: legacyContractsCapability.governor };
}

export function requireCommunityFactoryId(): string {
  if (!communityFactoryCapability.available) {
    throw new CapabilityError("communityFactory", communityFactoryCapability.reason);
  }
  return communityFactoryCapability.contractId;
}

export function requireCommunityFactoryContractId(): string {
  return requireCommunityFactoryId();
}

export function requireGovernorStartLedger(): number {
  if (!proposalDiscoveryCapability.available) {
    throw new CapabilityError("proposalDiscovery", proposalDiscoveryCapability.reason);
  }
  return proposalDiscoveryCapability.startLedger;
}

export { CapabilityError } from "./capabilities";

export function parseGovernorStartLedger(
  rawValue: string | undefined = process.env.NEXT_PUBLIC_GOVERNOR_START_LEDGER,
): number {
  if (rawValue === undefined || rawValue.trim() === "") {
    throw new Error(
      "Governor start ledger is not configured. Set NEXT_PUBLIC_GOVERNOR_START_LEDGER to the positive integer ledger where the Governor was deployed (see README).",
    );
  }

  const trimmed = rawValue.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(
      `Invalid NEXT_PUBLIC_GOVERNOR_START_LEDGER: expected a positive integer, got "${rawValue}".`,
    );
  }

  const ledger = Number(trimmed);
  if (!Number.isSafeInteger(ledger) || ledger <= 0) {
    throw new Error(
      `Invalid NEXT_PUBLIC_GOVERNOR_START_LEDGER: expected a positive integer, got "${rawValue}".`,
    );
  }

  return ledger;
}
