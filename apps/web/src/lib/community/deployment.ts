import {
  Address,
  nativeToScVal,
  scValToNative,
  type xdr,
} from "@stellar/stellar-sdk";
import { AssembledTransaction } from "@stellar/stellar-sdk/contract";
import { Api, Server as RpcServer } from "@stellar/stellar-sdk/rpc";
import { activeCapabilities, requireRpcConfig } from "@/lib/stellar";
import type { SignTransaction } from "@stellar/stellar-sdk/contract";
import {
  parseCommunityMetadata,
  resolveCommunityResourceUrl,
  type CommunityMetadataDraft,
  type GovernanceDraft,
} from "./schema";
import { communityRegistry, parseRegistryRecord } from "./registry";
import type { CommunityRegistryRecord } from "./types";

export const COMMUNITY_DEPLOYMENT_RECOVERY_VERSION = 1 as const;
export const COMMUNITY_DEPLOYMENT_TIMEOUT_SECONDS = 300;

export type CommunityDeploymentInput = {
  creator: string;
  communityOwner: string;
  factoryId: string;
  network: "testnet" | "mainnet";
  networkPassphrase: string;
  metadata: CommunityMetadataDraft;
  governance: GovernanceDraft;
};

export type CommunityFactoryInvocation = {
  contractId: string;
  method: "create_community";
  sourceAccount: string;
  networkPassphrase: string;
  metadataHash: string;
  externalKey: string;
  args: xdr.ScVal[];
};

export type CommunityDeploymentSimulation = {
  invocation: CommunityFactoryInvocation;
  feeStroops: string;
  expectedRecord: CommunityRegistryRecord;
  sequence: string | null;
  expiresAt: number | null;
  prepared: unknown;
};

export type CommunityDeploymentRecovery = {
  version: typeof COMMUNITY_DEPLOYMENT_RECOVERY_VERSION;
  network: "testnet" | "mainnet";
  transactionHash: string;
  expectedRecord: CommunityRegistryRecord;
  submittedAt: number;
};

export type DeploymentTransactionStatus =
  | "pending"
  | "success"
  | "failed"
  | "not-found"
  | "ambiguous";

export type CommunityDeploymentAdapter = {
  simulate(input: CommunityDeploymentInput): Promise<CommunityDeploymentSimulation>;
  signAndSubmit(
    simulation: CommunityDeploymentSimulation,
    signTransaction: SignTransaction,
  ): Promise<{ transactionHash: string }>;
  transactionStatus(hash: string): Promise<DeploymentTransactionStatus>;
  verifyRegistry(
    expected: CommunityRegistryRecord,
  ): Promise<"verified" | "missing" | "mismatch" | "rpc-error">;
  /**
   * Reads the CommunityFactory owner so the UI can gate deployment before any
   * simulation or signature. Resolves to the owner address string on success;
   * throws on a transient read failure so callers can retry rather than treat
   * the result as an authorization verdict.
   */
  readFactoryOwner(factoryId: string, publicKey: string): Promise<string>;
};

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string): Uint8Array {
  return Uint8Array.from(value.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
}

async function digest(bytes: Uint8Array): Promise<Uint8Array> {
  const copy = Uint8Array.from(bytes);
  return new Uint8Array(
    await globalThis.crypto.subtle.digest("SHA-256", copy.buffer),
  );
}

function metadataMatchesDraft(
  bytes: Uint8Array,
  draft: CommunityMetadataDraft,
): boolean {
  try {
    const parsed = parseCommunityMetadata(
      JSON.parse(new TextDecoder().decode(bytes)),
    );
    if (!parsed) return false;
    const links = draft.externalLinkLabel
      ? [{ label: draft.externalLinkLabel, url: draft.externalLinkUrl }]
      : [];
    return (
      parsed.name === draft.name &&
      parsed.description === draft.description &&
      (parsed.logo ?? "") === draft.logo &&
      JSON.stringify(parsed.externalLinks) === JSON.stringify(links)
    );
  } catch {
    return false;
  }
}

export async function loadMetadataCommitment(
  draft: CommunityMetadataDraft,
): Promise<Uint8Array> {
  const response = await fetch(resolveCommunityResourceUrl(draft.metadataUri), {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(
      `Community metadata could not be verified (HTTP ${response.status}).`,
    );
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!metadataMatchesDraft(bytes, draft)) {
    throw new Error(
      "Published metadata does not match the name, description, logo, and links in this draft.",
    );
  }
  return digest(bytes);
}

function serializeMetadata(
  draft: CommunityMetadataDraft,
  metadataHash: Uint8Array,
): xdr.ScVal {
  return nativeToScVal({
    collection_uri: nativeToScVal(draft.collectionUri),
    metadata_hash: nativeToScVal(metadataHash),
    metadata_uri: nativeToScVal(draft.metadataUri),
    name: nativeToScVal(draft.name),
    schema_version: nativeToScVal(1, { type: "u32" }),
    symbol: nativeToScVal(draft.symbol),
  });
}

function serializeGovernance(draft: GovernanceDraft): xdr.ScVal {
  return nativeToScVal({
    proposal_threshold: nativeToScVal(BigInt(draft.proposalThreshold), {
      type: "u128",
    }),
    quorum: nativeToScVal(BigInt(draft.quorum), { type: "u128" }),
    voting_delay: nativeToScVal(Number(draft.votingDelay), { type: "u32" }),
    voting_period: nativeToScVal(Number(draft.votingPeriod), { type: "u32" }),
  });
}

export async function serializeCommunityFactoryInvocation(
  input: CommunityDeploymentInput,
  metadataHashOverride?: Uint8Array,
): Promise<CommunityFactoryInvocation> {
  if (
    input.networkPassphrase !==
    activeCapabilities.network.networkPassphrase
  ) {
    throw new Error("The deployment network passphrase does not match the application network.");
  }
  const metadataHash =
    metadataHashOverride ?? (await loadMetadataCommitment(input.metadata));
  if (metadataHash.length !== 32) {
    throw new Error("The community metadata commitment must be exactly 32 bytes.");
  }
  const externalKey = metadataHash;
  const request = nativeToScVal({
    community_owner: new Address(input.communityOwner),
    external_key: nativeToScVal(externalKey),
    governance: serializeGovernance(input.governance),
    metadata: serializeMetadata(input.metadata, metadataHash),
  });

  return {
    contractId: input.factoryId,
    method: "create_community",
    sourceAccount: input.creator,
    networkPassphrase: input.networkPassphrase,
    metadataHash: bytesToHex(metadataHash),
    externalKey: bytesToHex(externalKey),
    args: [new Address(input.creator).toScVal(), request],
  };
}

function simulationFee(transaction: AssembledTransaction<unknown>): string {
  const simulation = transaction.simulation;
  if (!simulation || !Api.isSimulationSuccess(simulation)) {
    throw new Error("Community deployment simulation did not return resource data.");
  }
  return simulation.minResourceFee;
}

function expectedRecord(transaction: AssembledTransaction<unknown>) {
  const record = parseRegistryRecord(transaction.result);
  if (!record) {
    throw new Error("CommunityFactory simulation returned a malformed registry record.");
  }
  return record;
}

function transactionSequence(transaction: AssembledTransaction<unknown>) {
  return transaction.built?.sequence ?? null;
}

function transactionExpiry(transaction: AssembledTransaction<unknown>) {
  const timeBounds = transaction.built?.timeBounds;
  if (!timeBounds?.maxTime) return null;
  const value = Number(timeBounds.maxTime);
  return Number.isSafeInteger(value) ? value : null;
}

function transactionHash(sent: unknown): string | null {
  if (!sent || typeof sent !== "object") return null;
  const response = (sent as { sendTransactionResponse?: { hash?: unknown } })
    .sendTransactionResponse;
  return typeof response?.hash === "string" ? response.hash : null;
}

export function formatStroopsAsXlm(value: string): string {
  if (!/^\d+$/.test(value)) throw new Error("Invalid stroop amount.");
  const stroops = BigInt(value);
  const whole = stroops / BigInt(10_000_000);
  const fraction = (stroops % BigInt(10_000_000))
    .toString()
    .padStart(7, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction} XLM` : `${whole} XLM`;
}

export function isExpiredOrStaleDeploymentError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /expired|timebounds|too[_ ]late|bad[_ ]seq|sequence number|stale/i.test(
    message,
  );
}

export function communityDeploymentRecoveryKey(
  network: "testnet" | "mainnet",
): string {
  return `stolla:community-deployment:${network}:v${COMMUNITY_DEPLOYMENT_RECOVERY_VERSION}`;
}

export function parseCommunityDeploymentRecovery(
  raw: string | null,
  network: "testnet" | "mainnet",
): CommunityDeploymentRecovery | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<CommunityDeploymentRecovery>;
    if (
      value.version !== COMMUNITY_DEPLOYMENT_RECOVERY_VERSION ||
      value.network !== network ||
      typeof value.transactionHash !== "string" ||
      !/^[0-9a-fA-F]{64}$/.test(value.transactionHash) ||
      !Number.isSafeInteger(value.submittedAt) ||
      !parseRegistryRecord({
        ...value.expectedRecord,
        community_id: value.expectedRecord?.id,
        nft_contract: value.expectedRecord?.nftContract,
        governor_contract: value.expectedRecord?.governorContract,
        community_owner: value.expectedRecord?.communityOwner,
        created_at_ledger: value.expectedRecord?.createdAtLedger,
        creation_index: value.expectedRecord?.creationIndex,
        metadata_uri: value.expectedRecord?.metadataUri,
        metadata_hash: value.expectedRecord?.metadataHash,
        metadata_schema_version: value.expectedRecord?.metadataSchemaVersion,
      })
    ) {
      return null;
    }
    return value as CommunityDeploymentRecovery;
  } catch {
    return null;
  }
}

export const defaultCommunityDeploymentAdapter: CommunityDeploymentAdapter = {
  async simulate(input) {
    const rpc = requireRpcConfig();
    const invocation = await serializeCommunityFactoryInvocation(input);
    const transaction = await AssembledTransaction.build<unknown>({
      contractId: invocation.contractId,
      method: invocation.method,
      args: invocation.args,
      networkPassphrase: invocation.networkPassphrase,
      rpcUrl: rpc.rpcUrl,
      publicKey: invocation.sourceAccount,
      timeoutInSeconds: COMMUNITY_DEPLOYMENT_TIMEOUT_SECONDS,
      parseResultXdr: scValToNative,
    });
    return {
      invocation,
      feeStroops: simulationFee(transaction),
      expectedRecord: expectedRecord(transaction),
      sequence: transactionSequence(transaction),
      expiresAt: transactionExpiry(transaction),
      prepared: transaction,
    };
  },

  async signAndSubmit(simulation, signTransaction) {
    const transaction = simulation.prepared;
    if (!(transaction instanceof AssembledTransaction)) {
      throw new Error("The simulated deployment transaction is unavailable.");
    }
    await transaction.sign({ signTransaction });
    const sent = await transaction.send();
    const hash = transactionHash(sent);
    if (!hash) throw new Error("The RPC did not return a transaction hash.");
    return { transactionHash: hash };
  },

  async transactionStatus(hash) {
    try {
      const response = await new RpcServer(
        requireRpcConfig().rpcUrl,
      ).getTransaction(hash);
      switch (response.status) {
        case Api.GetTransactionStatus.SUCCESS:
          return "success";
        case Api.GetTransactionStatus.FAILED:
          return "failed";
        case Api.GetTransactionStatus.NOT_FOUND:
          return "not-found";
        default:
          return "pending";
      }
    } catch {
      return "ambiguous";
    }
  },

  async verifyRegistry(expected) {
    try {
      const result = await communityRegistry.get(expected.id);
      if (result.status === "not-found") return "missing";
      if (result.status !== "found") return "mismatch";
      return result.community.record.nftContract === expected.nftContract &&
        result.community.record.governorContract === expected.governorContract
        ? "verified"
        : "mismatch";
    } catch {
      return "rpc-error";
    }
  },

  /**
   * Reads `owner()` off the factory as a read-only simulation. Any throw is a
   * transient read failure that the UI reports as retryable, never as
   * "unauthorized".
   */
  async readFactoryOwner(factoryId, publicKey) {
    const transaction = await AssembledTransaction.build<string>({
      contractId: factoryId,
      method: "owner",
      args: [],
      networkPassphrase: requireRpcConfig().networkPassphrase,
      rpcUrl: requireRpcConfig().rpcUrl,
      publicKey,
      timeoutInSeconds: COMMUNITY_DEPLOYMENT_TIMEOUT_SECONDS,
      parseResultXdr: (value) => scValToNative(value) as string,
    });
    const owner = transaction.result;
    if (typeof owner !== "string" || owner.trim() === "") {
      throw new Error("The CommunityFactory owner read did not return an address.");
    }
    return owner;
  },
};

export function metadataHashBytes(invocation: CommunityFactoryInvocation) {
  return hexToBytes(invocation.metadataHash);
}
