import type { CommunityRecord } from "./types";

function isCommunityRecord(value: unknown): value is CommunityRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    record.id.length > 0 &&
    typeof record.name === "string" &&
    typeof record.symbol === "string" &&
    typeof record.governorContractId === "string" &&
    typeof record.nftContractId === "string" &&
    (record.metadataUri === undefined || typeof record.metadataUri === "string")
  );
}

function parseRegistry(json: string | undefined): CommunityRecord[] {
  if (!json) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isCommunityRecord);
}

export const communityRegistry: CommunityRecord[] = parseRegistry(
  process.env.NEXT_PUBLIC_COMMUNITIES_JSON,
);

export function listCommunities(
  registry: CommunityRecord[] = communityRegistry,
): CommunityRecord[] {
  return registry;
}

export function getCommunityById(
  id: string,
  registry: CommunityRecord[] = communityRegistry,
): CommunityRecord | undefined {
  return registry.find((community) => community.id === id);
}
