import { createReadOnlyNftClient } from "@/lib/contracts";

export type MemberRosterEntry = {
  address: string;
  tokenIds: number[];
  tokenCount: number;
};

export type MemberRosterResult = {
  members: MemberRosterEntry[];
  totalSupply: number;
  hasMore: boolean;
};

export type NftRosterClient = {
  get_total_supply?: () => Promise<{ result?: bigint | number }>;
  owner_of?: (args: { token_id: number }) => Promise<{ result?: string }>;
};

export type FetchMemberRosterOptions = {
  nftContractId: string;
  client?: NftRosterClient;
  maxTokensToQuery?: number;
};

export const DEFAULT_MAX_ROSTER_TOKENS = 50;

/**
 * Fetches the membership roster from an NFT contract by querying total supply
 * and token owners.
 */
export async function fetchMemberRoster({
  nftContractId,
  client,
  maxTokensToQuery = DEFAULT_MAX_ROSTER_TOKENS,
}: FetchMemberRosterOptions): Promise<MemberRosterResult> {
  if (!nftContractId) {
    return { members: [], totalSupply: 0, hasMore: false };
  }

  const nftClient = client ?? (createReadOnlyNftClient(nftContractId) as unknown as NftRosterClient);

  if (typeof nftClient.get_total_supply !== "function") {
    return { members: [], totalSupply: 0, hasMore: false };
  }

  const supplyRes = await nftClient.get_total_supply();
  const rawSupply = supplyRes?.result ?? 0;
  const totalSupply = Number(rawSupply);

  if (isNaN(totalSupply) || totalSupply <= 0) {
    return { members: [], totalSupply: 0, hasMore: false };
  }

  const countToQuery = Math.min(totalSupply, maxTokensToQuery);
  const tokenQueries: Promise<{ tokenId: number; owner: string | null }>[] = [];

  for (let tokenId = 0; tokenId < countToQuery; tokenId++) {
    if (typeof nftClient.owner_of === "function") {
      tokenQueries.push(
        nftClient
          .owner_of({ token_id: tokenId })
          .then((res) => ({ tokenId, owner: res?.result ?? null }))
          .catch(() => ({ tokenId, owner: null })),
      );
    }
  }

  const results = await Promise.all(tokenQueries);
  const membersByAddress = new Map<string, number[]>();

  for (const { tokenId, owner } of results) {
    if (owner && typeof owner === "string") {
      const existing = membersByAddress.get(owner) ?? [];
      existing.push(tokenId);
      membersByAddress.set(owner, existing);
    }
  }

  const members: MemberRosterEntry[] = Array.from(membersByAddress.entries())
    .map(([address, tokenIds]) => ({
      address,
      tokenIds: tokenIds.sort((a, b) => a - b),
      tokenCount: tokenIds.length,
    }))
    .sort((a, b) => {
      if (b.tokenCount !== a.tokenCount) {
        return b.tokenCount - a.tokenCount;
      }
      return a.address.localeCompare(b.address);
    });

  return {
    members,
    totalSupply,
    hasMore: totalSupply > maxTokensToQuery,
  };
}
