import { Networks } from "@stellar/stellar-sdk";

export type NetworkId = "testnet" | "mainnet" | "futurenet";

export type StellarNetwork = {
  id: NetworkId;
  label: string;
  networkPassphrase: string;
  /** Path segment used by stellar.expert, or null when the network is not indexed. */
  explorerSegment: string | null;
};

export const NETWORKS: Record<NetworkId, StellarNetwork> = {
  testnet: {
    id: "testnet",
    label: "Testnet",
    networkPassphrase: Networks.TESTNET,
    explorerSegment: "testnet",
  },
  mainnet: {
    id: "mainnet",
    label: "Mainnet",
    networkPassphrase: Networks.PUBLIC,
    explorerSegment: "public",
  },
  futurenet: {
    id: "futurenet",
    label: "Futurenet",
    networkPassphrase: Networks.FUTURENET,
    explorerSegment: null,
  },
};

/**
 * A network as reported by a wallet. The wallet may sit on a network Stolla does
 * not know about, so `id` is null for anything outside the registry.
 */
export type DetectedNetwork = {
  id: NetworkId | null;
  label: string;
  networkPassphrase: string;
};

export function findNetworkByPassphrase(
  passphrase: string,
): StellarNetwork | null {
  return (
    Object.values(NETWORKS).find(
      (network) => network.networkPassphrase === passphrase,
    ) ?? null
  );
}

export function describeNetwork(
  passphrase: string,
  reportedName?: string,
): DetectedNetwork {
  const known = findNetworkByPassphrase(passphrase);
  if (known) {
    return { id: known.id, label: known.label, networkPassphrase: passphrase };
  }
  return {
    id: null,
    label: reportedName?.trim() || "Unrecognized network",
    networkPassphrase: passphrase,
  };
}

export type NetworkComparison =
  | { status: "unknown"; expected: StellarNetwork; detected: null }
  | { status: "match"; expected: StellarNetwork; detected: DetectedNetwork }
  | { status: "mismatch"; expected: StellarNetwork; detected: DetectedNetwork };

export function compareNetworks(
  expected: StellarNetwork,
  detected: DetectedNetwork | null,
): NetworkComparison {
  if (!detected) {
    return { status: "unknown", expected, detected: null };
  }
  const status =
    detected.networkPassphrase === expected.networkPassphrase
      ? "match"
      : "mismatch";
  return { status, expected, detected };
}

export class NetworkMismatchError extends Error {
  readonly expected: StellarNetwork;
  readonly detected: DetectedNetwork | null;

  constructor(expected: StellarNetwork, detected: DetectedNetwork | null) {
    super(
      detected
        ? `Wallet is on ${detected.label}. Switch it to ${expected.label} to continue.`
        : `Could not read the wallet network. Reconnect on ${expected.label} to continue.`,
    );
    this.name = "NetworkMismatchError";
    this.expected = expected;
    this.detected = detected;
  }
}

const EXPLORER_ORIGIN = "https://stellar.expert/explorer";

type ExplorerResource = "tx" | "contract";

/**
 * Explorer links always take the network they belong to as an argument. There is
 * no ambient default, so a link cannot outlive the network it was built for.
 */
function explorerUrl(
  network: StellarNetwork,
  resource: ExplorerResource,
  value: string,
): string | null {
  if (!network.explorerSegment || !value) return null;
  return `${EXPLORER_ORIGIN}/${network.explorerSegment}/${resource}/${value}`;
}

export function transactionUrl(network: StellarNetwork, hash: string) {
  return explorerUrl(network, "tx", hash);
}

export function contractUrl(network: StellarNetwork, contractId: string) {
  return explorerUrl(network, "contract", contractId);
}

export type ActiveNetworkId = Exclude<NetworkId, "futurenet">;
export type NetworkCapabilityName =
  | "rpc"
  | "explorer"
  | "communityFactory"
  | "legacyContracts"
  | "proposalDiscovery";

export type CapabilityAvailability =
  | { available: true }
  | { available: false; reason: string; requiredEnvironment: readonly string[] };

export type NetworkCapabilities = {
  network: StellarNetwork & { id: ActiveNetworkId };
  rpc: CapabilityAvailability & { url: string; horizonUrl: string; friendbotUrl: string | null };
  explorer: CapabilityAvailability & { origin: string; segment: string | null };
  contracts: {
    communityFactory: string;
    legacyNft: string;
    legacyGovernor: string;
  };
  communityFactory: CapabilityAvailability & { contractId: string };
  legacyContracts: CapabilityAvailability & { nftContractId: string; governorContractId: string };
  proposalDiscovery: CapabilityAvailability & { governorContractId: string; startLedger: number | null };
};

type CapabilityEnvironment = Record<string, string | undefined>;
const EXPLORER_ORIGIN_VALUE = "https://stellar.expert/explorer";

function unavailable(reason: string, ...requiredEnvironment: string[]): CapabilityAvailability {
  return { available: false, reason, requiredEnvironment };
}

function configured(value: string | undefined) {
  return value?.trim() ?? "";
}

export function resolveActiveNetworkId(value?: string): ActiveNetworkId {
  return value?.trim().toLowerCase() === "mainnet" ? "mainnet" : "testnet";
}

export function parsePositiveLedger(value?: string): number | null {
  const normalized = value?.trim();
  if (!normalized || !/^\d+$/.test(normalized)) return null;
  const ledger = Number(normalized);
  return Number.isSafeInteger(ledger) && ledger > 0 ? ledger : null;
}

export function buildNetworkCapabilities(
  id: ActiveNetworkId,
  environment: CapabilityEnvironment = process.env,
): NetworkCapabilities {
  const network = NETWORKS[id] as StellarNetwork & { id: ActiveNetworkId };
  const rpcEnvironment = id === "mainnet" ? "NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL" : "NEXT_PUBLIC_STELLAR_RPC_URL";
  const rpcUrl = configured(environment[rpcEnvironment]) || (id === "testnet" ? "https://soroban-testnet.stellar.org" : "");
  const horizonUrl = id === "mainnet" ? "https://horizon.stellar.org" : "https://horizon-testnet.stellar.org";
  const communityFactory = configured(environment.NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID);
  const legacyNft = configured(environment.NEXT_PUBLIC_NFT_CONTRACT_ID);
  const legacyGovernor = configured(environment.NEXT_PUBLIC_GOVERNOR_CONTRACT_ID);
  const startLedger = parsePositiveLedger(environment.NEXT_PUBLIC_GOVERNOR_START_LEDGER);

  return {
    network,
    rpc: {
      url: rpcUrl,
      horizonUrl,
      friendbotUrl: id === "testnet" ? "https://friendbot.stellar.org" : null,
      ...(rpcUrl ? { available: true as const } : unavailable(`RPC is unavailable for ${network.label}.`, rpcEnvironment)),
    },
    explorer: {
      origin: EXPLORER_ORIGIN_VALUE,
      segment: network.explorerSegment,
      ...(network.explorerSegment ? { available: true as const } : unavailable(`Explorer is unavailable for ${network.label}.`)),
    },
    contracts: { communityFactory, legacyNft, legacyGovernor },
    communityFactory: {
      contractId: communityFactory,
      ...(communityFactory ? { available: true as const } : unavailable("CommunityFactory is unavailable for the active deployment.", "NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID")),
    },
    legacyContracts: {
      nftContractId: legacyNft,
      governorContractId: legacyGovernor,
      ...(legacyNft && legacyGovernor ? { available: true as const } : unavailable("Legacy single-instance contracts are unavailable for the active deployment.", "NEXT_PUBLIC_NFT_CONTRACT_ID", "NEXT_PUBLIC_GOVERNOR_CONTRACT_ID")),
    },
    proposalDiscovery: {
      governorContractId: legacyGovernor,
      startLedger,
      ...(legacyGovernor && startLedger ? { available: true as const } : unavailable("Proposal discovery is unavailable for the active deployment.", "NEXT_PUBLIC_GOVERNOR_CONTRACT_ID", "NEXT_PUBLIC_GOVERNOR_START_LEDGER")),
    },
  };
}

export class NetworkCapabilityError extends Error {
  constructor(
    readonly capability: NetworkCapabilityName,
    readonly networkId: ActiveNetworkId,
    readonly requiredEnvironment: readonly string[],
    message: string,
  ) {
    super(message);
    this.name = "NetworkCapabilityError";
  }
}

export function requireNetworkCapability<K extends NetworkCapabilityName>(
  capabilities: NetworkCapabilities,
  capability: K,
): Extract<NetworkCapabilities[K], { available: true }> {
  const value = capabilities[capability];
  if (!value.available) {
    throw new NetworkCapabilityError(capability, capabilities.network.id, value.requiredEnvironment, value.reason);
  }
  return value as Extract<NetworkCapabilities[K], { available: true }>;
}

export function listUnavailableCapabilities(capabilities: NetworkCapabilities) {
  const names: NetworkCapabilityName[] = ["rpc", "explorer", "communityFactory", "legacyContracts", "proposalDiscovery"];
  return names.filter((name) => !capabilities[name].available);
}
