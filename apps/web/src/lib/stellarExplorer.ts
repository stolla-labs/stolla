export type StellarNetworkId = "testnet" | "mainnet";

const TX_HASH_PATTERN = /^[0-9a-fA-F]{64}$/;
const CONTRACT_ADDRESS_PATTERN = /^C[A-Z2-7]{55}$/;
const ACCOUNT_ADDRESS_PATTERN = /^G[A-Z2-7]{55}$/;

/**
 * Build a Stellar Expert explorer URL for a confirmed transaction hash.
 * Returns null when the hash is missing or invalid so callers can skip the link.
 */
export function buildStellarExplorerTxUrl(
  hash: string | null | undefined,
  network: StellarNetworkId = "testnet",
): string | null {
  if (!hash || !TX_HASH_PATTERN.test(hash.trim())) {
    return null;
  }

  const normalized = hash.trim().toLowerCase();
  const explorerNetwork = network === "mainnet" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${explorerNetwork}/tx/${normalized}`;
}

/** Resolve the app's configured network into a helper-friendly id. */
export function resolveStellarNetworkId(
  raw: string | undefined = process.env.NEXT_PUBLIC_STELLAR_NETWORK,
): StellarNetworkId {
  return raw === "mainnet" ? "mainnet" : "testnet";
}

export function buildStellarExplorerContractUrl(
  contractId: string,
  network: StellarNetworkId = "testnet",
): string | null {
  if (!CONTRACT_ADDRESS_PATTERN.test(contractId)) return null;
  const explorerNetwork = network === "mainnet" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${explorerNetwork}/contract/${contractId}`;
}

/**
 * Build a Stellar Expert explorer URL for a G... account address.
 * Returns null when the address is missing or invalid so callers can skip the link.
 */
export function buildStellarExplorerAccountUrl(
  address: string | null | undefined,
  network: StellarNetworkId = "testnet",
): string | null {
  if (!address || !ACCOUNT_ADDRESS_PATTERN.test(address)) return null;
  const explorerNetwork = network === "mainnet" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${explorerNetwork}/account/${address}`;
}
