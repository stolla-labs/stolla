"use client";

import { useCallback, useEffect, useState } from "react";
import { useOptionalWallet } from "@/context/WalletProvider";
import { AppButton } from "@/components/ui/AppButton";
import { LiveStatus } from "@/components/ui/LiveStatus";
import { Skeleton } from "@/components/ui/Skeleton";
import { truncateMiddle } from "@/lib/truncate";
import {
  fetchMemberRoster,
  type MemberRosterEntry,
  type MemberRosterResult,
  type NftRosterClient,
} from "@/lib/community/roster";

export type CommunityMemberRosterProps = {
  nftContractId: string;
  connectedAddress?: string | null;
  client?: NftRosterClient;
  pageSize?: number;
};

export function CommunityMemberRoster({
  nftContractId,
  connectedAddress,
  client,
  pageSize = 10,
}: CommunityMemberRosterProps) {
  const wallet = useOptionalWallet();
  const effectiveAddress = connectedAddress ?? wallet?.address ?? null;
  const [data, setData] = useState<MemberRosterResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const loadRoster = useCallback(async () => {
    if (!nftContractId) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchMemberRoster({
        nftContractId,
        client,
      });
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load member roster from the NFT contract.",
      );
    } finally {
      setLoading(false);
    }
  }, [nftContractId, client]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  const handleCopy = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2500);
    } catch {
      // Fallback or ignore
    }
  };

  const members = data?.members ?? [];
  const totalPages = Math.max(1, Math.ceil(members.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const currentMembers = members.slice(startIndex, startIndex + pageSize);

  const normalizedConnected = effectiveAddress?.trim().toLowerCase();

  return (
    <section
      aria-labelledby="member-roster-title"
      className="mt-6 rounded-xl border border-slate-800 bg-[#151b2b] p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div>
          <h2 id="member-roster-title" className="font-semibold text-slate-100">
            Member roster
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {data ? (
              <>
                {data.members.length} {data.members.length === 1 ? "member" : "members"}{" "}
                ({data.totalSupply} {data.totalSupply === 1 ? "token" : "tokens"} minted)
                {data.hasMore && " — showing first batch"}
              </>
            ) : (
              "Verified holders from the community NFT contract."
            )}
          </p>
        </div>
        {!loading && (
          <AppButton
            tone="secondary"
            size="sm"
            onClick={() => void loadRoster()}
            aria-label="Refresh member roster"
          >
            Refresh
          </AppButton>
        )}
      </div>

      {loading && (
        <div className="mt-4 space-y-2" aria-busy="true">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      )}

      {!loading && error && (
        <div className="mt-4 rounded-lg border border-amber-800/70 bg-amber-950/40 p-4">
          <p className="text-sm text-amber-200">
            {error}
          </p>
          <AppButton
            tone="danger"
            size="sm"
            onClick={() => void loadRoster()}
            className="mt-3"
          >
            Retry roster
          </AppButton>
        </div>
      )}

      {!loading && !error && members.length === 0 && (
        <div className="mt-4 rounded-lg border border-slate-800 bg-[#0b0f19] p-6 text-center text-sm text-slate-400">
          No members yet. Once membership NFTs are minted, holders appear here.
        </div>
      )}

      {!loading && !error && members.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm" role="table">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="pb-2 font-medium">Member address</th>
                <th scope="col" className="pb-2 font-medium text-center">Tokens</th>
                <th scope="col" className="pb-2 font-medium text-right">NFT IDs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
              {currentMembers.map((member) => {
                const isYou =
                  Boolean(normalizedConnected) &&
                  member.address.trim().toLowerCase() === normalizedConnected;

                return (
                  <tr
                    key={member.address}
                    className={`transition-colors ${
                      isYou
                        ? "bg-emerald-950/20 font-medium text-emerald-200"
                        : "hover:bg-slate-800/30 text-slate-200"
                    }`}
                    data-testid={`roster-row-${member.address}`}
                  >
                    <td className="py-2.5 pr-2">
                      <div className="flex items-center gap-2">
                        <span
                          title={member.address}
                          className="font-mono text-slate-100"
                        >
                          {truncateMiddle(member.address, 8, 6)}
                        </span>
                        {isYou && (
                          <span
                            data-testid="roster-you-badge"
                            className="inline-flex items-center rounded border border-emerald-700/80 bg-emerald-900/60 px-1.5 py-0.5 text-[10px] font-sans font-semibold text-emerald-200"
                          >
                            You
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleCopy(member.address)}
                          aria-label={`Copy address ${member.address}`}
                          className="rounded px-1.5 py-0.5 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                        >
                          {copiedAddress === member.address ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center text-slate-300">
                      {member.tokenCount}
                    </td>
                    <td className="py-2.5 pl-2 text-right text-slate-400">
                      {member.tokenIds.slice(0, 5).map((id) => `#${id}`).join(", ")}
                      {member.tokenIds.length > 5 && " …"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3 text-xs text-slate-400">
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-2">
                <AppButton
                  tone="secondary"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  aria-label="Previous page"
                >
                  Previous
                </AppButton>
                <AppButton
                  tone="secondary"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  aria-label="Next page"
                >
                  Next
                </AppButton>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
