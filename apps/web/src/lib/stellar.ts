import { NETWORKS } from "./network";
import { Networks } from "@stellar/stellar-sdk";

const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet";

export const stellarNetwork = network === "mainnet" ? "mainnet" : "testnet";

/** Configured deployment network used by wizard and network-guard UI. */
export const activeNetwork = NETWORKS[stellarNetwork];

export const stellarConfig = {
  testnet: {
    rpcUrl:
      process.env.NEXT_PUBLIC_STELLAR_RPC_URL ??
      "https://soroban-testnet.stellar.org",
    horizonUrl: "https://horizon-testnet.stellar.org",
    networkPassphrase: Networks.TESTNET,
    friendbotUrl: "https://friendbot.stellar.org",
  },
  mainnet: {
    rpcUrl: process.env.NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL ?? "",
    horizonUrl: "https://horizon.stellar.org",
    networkPassphrase: Networks.PUBLIC,
    friendbotUrl: null,
  },
} as const;

export const config =
  network === "mainnet" ? stellarConfig.mainnet : stellarConfig.testnet;

export const contractIds = {
  nft: process.env.NEXT_PUBLIC_NFT_CONTRACT_ID ?? "",
  governor: process.env.NEXT_PUBLIC_GOVERNOR_CONTRACT_ID ?? "",
  communityFactory:
    process.env.NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID ?? "",
  /** Alias used by assignee community-creation wizard modules. */
  factory: process.env.NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID ?? "",
};

export function requireContractIds(): { nft: string; governor: string } {
  if (!contractIds.nft || !contractIds.governor) {
    throw new Error(
      "Contract IDs are not configured. Set NEXT_PUBLIC_NFT_CONTRACT_ID and NEXT_PUBLIC_GOVERNOR_CONTRACT_ID.",
    );
  }
  return { nft: contractIds.nft, governor: contractIds.governor };
}

export function requireCommunityFactoryId(): string {
  if (!contractIds.communityFactory) {
    throw new Error(
      "Community registry is not configured. Set NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID.",
    );
  }
  return contractIds.communityFactory;
}

export function requireCommunityFactoryContractId(): string {
  return requireCommunityFactoryId();
}

/**
 * Parse and validate the Governor discovery start ledger.
 *
 * Accepts only positive safe integers. Missing, blank, non-integer, negative,
 * and zero values fail with an actionable error so misconfigured environments
 * cannot silently scan from ledger 0 or an invalid boundary.
 */
export function parseGovernorStartLedger(
  rawValue?: string,
): number {
  const candidate =
    arguments.length === 0
      ? process.env.NEXT_PUBLIC_GOVERNOR_START_LEDGER
      : rawValue;

  if (candidate === undefined || candidate.trim() === "") {
    throw new Error(
      "Governor start ledger is not configured. Set NEXT_PUBLIC_GOVERNOR_START_LEDGER to the positive integer ledger where the Governor was deployed (see README).",
    );
  }

  const trimmed = candidate.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(
      `Invalid NEXT_PUBLIC_GOVERNOR_START_LEDGER: expected a positive integer, got "${candidate}".`,
    );
  }

  const ledger = Number(trimmed);
  if (!Number.isSafeInteger(ledger) || ledger <= 0) {
    throw new Error(
      `Invalid NEXT_PUBLIC_GOVERNOR_START_LEDGER: expected a positive integer, got "${candidate}".`,
    );
  }

  return ledger;
}

/** Typed start ledger for proposal discovery RPC queries. */
export function requireGovernorStartLedger(): number {
  return parseGovernorStartLedger();
}
