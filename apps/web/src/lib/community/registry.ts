import { Buffer } from "buffer";
import { AssembledTransaction } from "@stellar/stellar-sdk/contract";
import { nativeToScVal, scValToNative, xdr } from "@stellar/stellar-sdk";
import { requireCommunityFactoryId, requireRpcConfig } from "@/lib/stellar";
import { e2eGetCommunity, e2eListCommunities } from "@/lib/e2eMock";
import {
  parseCommunityMetadata,
  resolveCommunityResourceUrl,
} from "./schema";
import type {
  CommunityDetailResult,
  CommunityRegistryPage,
  CommunityRegistryRecord,
  CommunityView,
  GovernanceSnapshot,
} from "./types";

const EMPTY_GOVERNANCE: GovernanceSnapshot = {
  votingDelay: null,
  votingPeriod: null,
  proposalThreshold: null,
  quorum: null,
  unavailableFields: [
    "Voting delay",
    "Voting period",
    "Proposal threshold",
    "Quorum",
  ],
};

async function readContract(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<unknown> {
  const rpc = requireRpcConfig();
  const transaction = await AssembledTransaction.build<unknown>({
    contractId,
    method,
    args,
    networkPassphrase: rpc.networkPassphrase,
    rpcUrl: rpc.rpcUrl,
    parseResultXdr: (value) => scValToNative(value),
  });
  return transaction.result;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value instanceof Map) {
    return Object.fromEntries(value) as Record<string, unknown>;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asSafeNumber(value: unknown): number | null {
  if (typeof value === "bigint") {
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
  }
  return Number.isSafeInteger(value) && Number(value) >= 0
    ? Number(value)
    : null;
}

function asDecimalString(value: unknown): string | null {
  if (typeof value === "bigint" && value >= BigInt(0)) return value.toString();
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return String(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value)) return value;
  return null;
}

function asHex(value: unknown, bytes: number): string | null {
  if (typeof value === "string" && new RegExp(`^[0-9a-fA-F]{${bytes * 2}}$`).test(value)) {
    return value.toLowerCase();
  }
  if (!(value instanceof Uint8Array) || value.length !== bytes) return null;
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isCommunityId(value: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(value);
}

export function parseRegistryRecord(
  input: unknown,
): CommunityRegistryRecord | null {
  const record = asObject(input);
  if (!record) return null;

  const id = asHex(record.community_id, 32);
  const metadataHash = asHex(record.metadata_hash, 32);
  const createdAtLedger = asSafeNumber(record.created_at_ledger);
  const creationIndex = asSafeNumber(record.creation_index);
  const metadataSchemaVersion = asSafeNumber(record.metadata_schema_version);
  const nftContract =
    typeof record.nft_contract === "string" ? record.nft_contract : null;
  const governorContract =
    typeof record.governor_contract === "string"
      ? record.governor_contract
      : null;
  const creator = typeof record.creator === "string" ? record.creator : null;
  const communityOwner =
    typeof record.community_owner === "string"
      ? record.community_owner
      : null;
  const metadataUri =
    typeof record.metadata_uri === "string" ? record.metadata_uri : null;

  if (
    !id ||
    !metadataHash ||
    createdAtLedger === null ||
    creationIndex === null ||
    metadataSchemaVersion !== 1 ||
    !nftContract ||
    !governorContract ||
    !creator ||
    !communityOwner ||
    !metadataUri
  ) {
    return null;
  }

  return {
    id,
    nftContract,
    governorContract,
    creator,
    communityOwner,
    createdAtLedger,
    creationIndex,
    metadataUri,
    metadataHash,
    metadataSchemaVersion,
  };
}

async function loadMetadata(record: CommunityRegistryRecord) {
  const response = await fetch(resolveCommunityResourceUrl(record.metadataUri), {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Metadata request failed with HTTP ${response.status}.`);
  }

  const bytes = await response.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const digestHex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  if (digestHex !== record.metadataHash) {
    throw new Error("Metadata does not match the registry commitment.");
  }

  let input: unknown;
  try {
    input = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("Metadata is not valid UTF-8 JSON.");
  }

  const metadata = parseCommunityMetadata(input, {
    nftContract: record.nftContract,
    governorContract: record.governorContract,
  });
  if (!metadata) {
    throw new Error("Metadata does not conform to community schema version 1.");
  }
  return metadata;
}

function settledNumber(
  result: PromiseSettledResult<unknown>,
): number | null {
  return result.status === "fulfilled" ? asSafeNumber(result.value) : null;
}

function settledDecimal(
  result: PromiseSettledResult<unknown>,
): string | null {
  return result.status === "fulfilled" ? asDecimalString(result.value) : null;
}

async function loadGovernance(
  record: CommunityRegistryRecord,
): Promise<GovernanceSnapshot> {
  const [delay, period, threshold, quorum] = await Promise.allSettled([
    readContract(record.governorContract, "voting_delay"),
    readContract(record.governorContract, "voting_period"),
    readContract(record.governorContract, "proposal_threshold"),
    readContract(record.governorContract, "quorum", [
      nativeToScVal(record.createdAtLedger, { type: "u32" }),
    ]),
  ]);

  const votingDelay = settledNumber(delay);
  const votingPeriod = settledNumber(period);
  const proposalThreshold = settledDecimal(threshold);
  const quorumValue = settledDecimal(quorum);
  const unavailableFields: string[] = [];
  if (votingDelay === null) unavailableFields.push("Voting delay");
  if (votingPeriod === null) unavailableFields.push("Voting period");
  if (proposalThreshold === null) unavailableFields.push("Proposal threshold");
  if (quorumValue === null) unavailableFields.push("Quorum");

  return {
    votingDelay,
    votingPeriod,
    proposalThreshold,
    quorum: quorumValue,
    unavailableFields,
  };
}

async function hydrateRecord(
  record: CommunityRegistryRecord,
): Promise<CommunityView> {
  const [metadataResult, governanceResult] = await Promise.allSettled([
    loadMetadata(record),
    loadGovernance(record),
  ]);

  return {
    record,
    metadata:
      metadataResult.status === "fulfilled" ? metadataResult.value : null,
    metadataError:
      metadataResult.status === "rejected"
        ? metadataResult.reason instanceof Error
          ? metadataResult.reason.message
          : "Community metadata is unavailable."
        : null,
    governance:
      governanceResult.status === "fulfilled"
        ? governanceResult.value
        : { ...EMPTY_GOVERNANCE },
  };
}

export async function listCommunities(
  cursor: number | null,
  limit: number,
): Promise<CommunityRegistryPage> {
  const mocked = e2eListCommunities(cursor, limit);
  if (mocked) return mocked;
  const factoryId = requireCommunityFactoryId();
  const rawPage = asObject(
    await readContract(factoryId, "list_communities", [
      cursor === null
        ? xdr.ScVal.scvVoid()
        : nativeToScVal(cursor, { type: "u32" }),
      nativeToScVal(limit, { type: "u32" }),
    ]),
  );

  if (!rawPage || !Array.isArray(rawPage.records)) {
    throw new Error("The community registry returned a malformed page.");
  }

  const nextCursor =
    rawPage.next_cursor === null || rawPage.next_cursor === undefined
      ? null
      : asSafeNumber(rawPage.next_cursor);
  if (
    rawPage.next_cursor !== null &&
    rawPage.next_cursor !== undefined &&
    nextCursor === null
  ) {
    throw new Error("The community registry returned an invalid cursor.");
  }

  const records: CommunityRegistryRecord[] = [];
  const seen = new Set<string>();
  let malformedRecords = 0;
  for (const rawRecord of rawPage.records) {
    const record = parseRegistryRecord(rawRecord);
    if (!record || seen.has(record.id)) {
      malformedRecords += 1;
      continue;
    }
    seen.add(record.id);
    records.push(record);
  }

  return {
    communities: await Promise.all(records.map(hydrateRecord)),
    nextCursor,
    malformedRecords,
  };
}

export async function getCommunity(
  communityId: string,
): Promise<CommunityDetailResult> {
  if (!isCommunityId(communityId)) return { status: "not-found" };
  const mocked = e2eGetCommunity(communityId);
  if (mocked) return mocked;

  const rawRecord = await readContract(
    requireCommunityFactoryId(),
    "get_community",
    [nativeToScVal(Uint8Array.from(Buffer.from(communityId, "hex")))],
  );
  if (rawRecord === null || rawRecord === undefined) {
    return { status: "not-found" };
  }

  const record = parseRegistryRecord(rawRecord);
  if (!record || record.id !== communityId.toLowerCase()) {
    return {
      status: "malformed",
      message: "The registry entry exists but does not conform to schema version 1.",
    };
  }

  return { status: "found", community: await hydrateRecord(record) };
}
