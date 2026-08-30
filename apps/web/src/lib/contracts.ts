import { Buffer } from "buffer";
import { Client as NftClient } from "@/lib/bindings/community-nft/src";
import { Client as GovernorClient } from "@/lib/bindings/community-governor/src";
import { Client as CommunityFactoryClient } from "@/lib/bindings/community-factory/src";
import type { SignTransaction } from "@stellar/stellar-sdk/contract";
import {
  requireCommunityFactoryContractId,
  requireContractIds,
  requireRpcConfig,
} from "./stellar";
import { getE2EBridge } from "./e2eMock";

type ClientOptions = {
  publicKey: string;
  signTransaction: SignTransaction;
  contractId?: string;
};

function createE2EGovernorClient(contractId: string) {
  const proposals = getE2EBridge()?.proposals?.[contractId];
  if (!proposals) return null;
  const proposal = (input: { proposal_id?: Uint8Array }) => {
    const id = input.proposal_id
      ? Buffer.from(input.proposal_id).toString("hex")
      : "";
    return proposals.find((candidate) => candidate.id === id);
  };
  const result = <T>(value: T) => Promise.resolve({ result: value });
  return {
    proposal_state: (input: { proposal_id: Uint8Array }) =>
      result(proposal(input)?.state ?? 0),
    has_voted: () => result(false),
    proposal_snapshot: () => result(100),
    proposal_deadline: () => result(200),
    proposal_proposer: () => result(null),
    quorum: () => result(BigInt(1)),
    get_votes: () => result({ against: BigInt(0), for: BigInt(0), abstain: BigInt(0) }),
  };
}

export function createNftClient({
  publicKey,
  signTransaction,
  contractId,
}: ClientOptions) {
  const rpc = requireRpcConfig();
  const nft = contractId ?? requireContractIds().nft;
  return new NftClient({
    contractId: nft,
    networkPassphrase: rpc.networkPassphrase,
    rpcUrl: rpc.rpcUrl,
    publicKey,
    signTransaction,
  });
}

export function createGovernorClient({
  publicKey,
  signTransaction,
  contractId,
}: ClientOptions) {
  const rpc = requireRpcConfig();
  const governor = contractId ?? requireContractIds().governor;
  const mocked = createE2EGovernorClient(governor);
  if (mocked) return mocked as unknown as GovernorClient;
  return new GovernorClient({
    contractId: governor,
    networkPassphrase: rpc.networkPassphrase,
    rpcUrl: rpc.rpcUrl,
    publicKey,
    signTransaction,
  });
}

export function createReadOnlyNftClient(contractId?: string) {
  const rpc = requireRpcConfig();
  const nft = contractId ?? requireContractIds().nft;
  return new NftClient({
    contractId: nft,
    networkPassphrase: rpc.networkPassphrase,
    rpcUrl: rpc.rpcUrl,
  });
}

export function createReadOnlyGovernorClient(contractId?: string) {
  const rpc = requireRpcConfig();
  const governor = contractId ?? requireContractIds().governor;
  const mocked = createE2EGovernorClient(governor);
  if (mocked) return mocked as unknown as GovernorClient;
  return new GovernorClient({
    contractId: governor,
    networkPassphrase: rpc.networkPassphrase,
    rpcUrl: rpc.rpcUrl,
  });
}



export function createReadOnlyGovernorClientFor(governorContractId: string) {
  const rpc = requireRpcConfig();
  return new GovernorClient({
    contractId: governorContractId,
    networkPassphrase: rpc.networkPassphrase,
    rpcUrl: rpc.rpcUrl,
  });
}

export function createCommunityFactoryClient({
  publicKey,
  signTransaction,
}: ClientOptions) {
  const rpc = requireRpcConfig();
  return new CommunityFactoryClient({
    contractId: requireCommunityFactoryContractId(),
    networkPassphrase: rpc.networkPassphrase,
    rpcUrl: rpc.rpcUrl,
    publicKey,
    signTransaction,
  });
}

const PROPOSAL_STORAGE_KEY = "stolla:proposal-ids";

export function getStoredProposalIds(): string[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(PROPOSAL_STORAGE_KEY);
  if (!raw) return [];
  const proposalIds: unknown = JSON.parse(raw);
  if (
    !Array.isArray(proposalIds) ||
    !proposalIds.every((proposalId) => typeof proposalId === "string")
  ) {
    throw new Error("Stored proposal history is invalid.");
  }
  return proposalIds;
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

const COMMUNITY_DEPLOYMENT_HASH_KEY = "stolla:community-deployment-hash";

export function getStoredCommunityDeploymentHash(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(COMMUNITY_DEPLOYMENT_HASH_KEY);
}

export function storeCommunityDeploymentHash(hash: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(COMMUNITY_DEPLOYMENT_HASH_KEY, hash);
}

function scopedProposalStorageKey(governorContractId: string): string {
  return `stolla:proposal-ids:${governorContractId}`;
}

export function getStoredProposalIdsFor(governorContractId: string): string[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(scopedProposalStorageKey(governorContractId));
  if (!raw) return [];
  try {
    const proposalIds: unknown = JSON.parse(raw);
    if (
      !Array.isArray(proposalIds) ||
      !proposalIds.every((proposalId) => typeof proposalId === "string")
    ) {
      return [];
    }
    return proposalIds;
  } catch {
    return [];
  }
}

export function storeProposalIdFor(governorContractId: string, idHex: string) {
  const existing = getStoredProposalIdsFor(governorContractId);
  if (!existing.includes(idHex)) {
    localStorage.setItem(
      scopedProposalStorageKey(governorContractId),
      JSON.stringify([idHex, ...existing]),
    );
  }
}
