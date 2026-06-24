import { Client as NftClient } from "@/lib/bindings/community-nft/src";
import { Client as GovernorClient } from "@/lib/bindings/community-governor/src";
import type { SignTransaction } from "@stellar/stellar-sdk/contract";
import { config, requireContractIds } from "./stellar";

type ClientOptions = {
  publicKey: string;
  signTransaction: SignTransaction;
};

export function createNftClient({ publicKey, signTransaction }: ClientOptions) {
  const { nft } = requireContractIds();
  return new NftClient({
    contractId: nft,
    networkPassphrase: config.networkPassphrase,
    rpcUrl: config.rpcUrl,
    publicKey,
    signTransaction,
  });
}

export function createGovernorClient({
  publicKey,
  signTransaction,
}: ClientOptions) {
  const { governor } = requireContractIds();
  return new GovernorClient({
    contractId: governor,
    networkPassphrase: config.networkPassphrase,
    rpcUrl: config.rpcUrl,
    publicKey,
    signTransaction,
  });
}

export function createReadOnlyNftClient() {
  const { nft } = requireContractIds();
  return new NftClient({
    contractId: nft,
    networkPassphrase: config.networkPassphrase,
    rpcUrl: config.rpcUrl,
  });
}

export function createReadOnlyGovernorClient() {
  const { governor } = requireContractIds();
  return new GovernorClient({
    contractId: governor,
    networkPassphrase: config.networkPassphrase,
    rpcUrl: config.rpcUrl,
  });
}

const PROPOSAL_STORAGE_KEY = "stolla:proposal-ids";

export function getStoredProposalIds(): string[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(PROPOSAL_STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function storeProposalId(idHex: string) {
  const existing = getStoredProposalIds();
  if (!existing.includes(idHex)) {
    localStorage.setItem(
      PROPOSAL_STORAGE_KEY,
      JSON.stringify([idHex, ...existing]),
    );
  }
}
