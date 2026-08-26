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
  networkPassphrase: string,
): StellarNetwork | null {
  return (
    Object.values(NETWORKS).find(
      (network) => network.networkPassphrase === networkPassphrase,
    ) ?? null
  );
}

export function describeNetwork(
  networkPassphrase: string,
  reportedName?: string,
): DetectedNetwork {
  const known = findNetworkByPassphrase(networkPassphrase);
  if (known) {
    return { id: known.id, label: known.label, networkPassphrase };
  }
  return {
    id: null,
    label: reportedName?.trim() || "Unrecognized network",
    networkPassphrase,
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
    detected.networkPassphrase === expected.networkPassphrase ? "match" : "mismatch";
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
