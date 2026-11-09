"use client";

import Link from "next/link";
import type { Community, CommunityRegistry } from "@/lib/community/types";
import { useRegistryCommunity } from "@/lib/community/useRegistryCommunity";
import { getStoredProposalIdsFor } from "@/lib/contracts";
import {
  useCommunityProposals,
  type ProposalReaderFactory,
} from "@/lib/communities/proposals";
import { describeProposalDiscoveryError } from "@/lib/communities/proposalDiscoveryErrors";
import { ProposalState } from "@/lib/bindings/community-governor/src";
import {
  extractProposalSearchText,
  filterProposalsBySearch,
} from "@/lib/proposals/search-filter";
import { useProposalSearchQuery } from "@/lib/proposals/useProposalSearchQuery";
import { CommunityBreadcrumbs } from "./CommunityBreadcrumbs";
import { CommunityNotFound } from "./CommunityNotFound";
import { ProposalExportControls } from "./ProposalExportControls";
import type { ExportableProposal } from "@/lib/proposal-export";
import { AsyncState } from "@/components/ui/AsyncState";
import { EmptyState } from "@/components/ui/EmptyState";
import { FreshnessNotice } from "@/components/ui/FreshnessNotice";

const stateLabels: Record<ProposalState, string> = {
  [ProposalState.Pending]: "Pending",
  [ProposalState.Active]: "Active",
  [ProposalState.Defeated]: "Defeated",
  [ProposalState.Canceled]: "Canceled",
  [ProposalState.Succeeded]: "Succeeded",
  [ProposalState.Queued]: "Queued",
  [ProposalState.Expired]: "Expired",
  [ProposalState.Executed]: "Executed",
};

export type CommunityProposalsViewProps = {
  communityId: string;
  registry?: CommunityRegistry;
  proposalIds?: string[];
  proposalDescriptions?: Record<string, string>;
  initialSearchQuery?: string;
  getReader?: ProposalReaderFactory;
};

export function CommunityProposalsView({
  communityId,
  registry,
  proposalIds,
  proposalDescriptions,
  initialSearchQuery,
  getReader,
}: CommunityProposalsViewProps) {
  const resolution = useRegistryCommunity(communityId, registry);

  if (resolution.status === "loading") {
    return <p className="p-6 text-sm text-slate-400">Loading community…</p>;
  }
  if (resolution.status === "error") {
    return (
      <p role="alert" className="p-6 text-sm text-rose-300">
        {resolution.error}
      </p>
    );
  }
  if (resolution.result.status !== "found") {
    return <CommunityNotFound communityId={communityId} />;
  }

  const community = resolution.result.community;

  return (
    <CommunityProposalsPanel
      community={community}
      proposalIds={
        proposalIds ??
        getStoredProposalIdsFor(community.record.governorContract)
      }
      proposalDescriptions={proposalDescriptions}
      initialSearchQuery={initialSearchQuery}
      getReader={getReader}
    />
  );
}

function CommunityProposalsPanel({
  community,
  proposalIds,
  proposalDescriptions,
  initialSearchQuery = "",
  getReader,
}: {
  community: Community;
  proposalIds: string[];
  proposalDescriptions?: Record<string, string>;
  initialSearchQuery?: string;
  getReader?: ProposalReaderFactory;
}) {
  const resolution = useCommunityProposals(
    community.record.governorContract,
    proposalIds,
    getReader,
  );
  const { query, hasActiveQuery, setQuery, clearQuery } =
    useProposalSearchQuery(initialSearchQuery);

  const discoveryError =
    resolution.status === "error"
      ? describeProposalDiscoveryError(resolution.error)
      : resolution.status === "ready" && resolution.error
        ? describeProposalDiscoveryError(resolution.error)
        : null;

  const partialError =
    resolution.status === "ready"
      ? resolution.entries.find((entry) => entry.status === "error")
      : undefined;

  const partialMessage =
    partialError && partialError.status === "error"
      ? describeProposalDiscoveryError(partialError.error)
      : null;

  const filteredEntries =
    resolution.status === "ready"
      ? filterProposalsBySearch(
          resolution.entries,
          query,
          proposalDescriptions,
        )
      : [];

  const exportableProposals: ExportableProposal[] =
    resolution.status === "ready"
      ? filteredEntries.map((entry) => ({
          id: entry.id,
          state:
            entry.status === "ready" ? stateLabels[entry.state] : "Unavailable",
          discoveryStatus: entry.status === "ready" ? "ready" : "error",
        }))
      : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <CommunityBreadcrumbs
        communityId={community.record.id}
        communityName={community.metadata?.name ?? community.record.id}
      />
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-slate-100">
          {community.metadata?.name ??
            `Community ${community.record.id.slice(0, 8)}`} proposals
        </h1>
        <ProposalExportControls
          communityId={community.record.id}
          communityName={community.metadata?.name}
          proposals={exportableProposals}
          isLoading={resolution.status === "loading"}
        />
      </div>

      {proposalIds.length > 0 && (
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
          <label htmlFor="community-proposal-search" className="sr-only">
            Search proposals
          </label>
          <input
            id="community-proposal-search"
            type="search"
            aria-label="Search proposals"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search proposals by title, summary, or ID…"
            className="w-full rounded-lg border border-slate-800 bg-[#151b2b] px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
          {hasActiveQuery && (
            <button
              type="button"
              onClick={clearQuery}
              className="shrink-0 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              Clear search
            </button>
          )}
        </div>
      )}

      {resolution.status === "loading" && (
        <AsyncState className="mt-6 text-sm text-slate-500">
          Loading proposals…
        </AsyncState>
      )}

      {discoveryError && (
        <FreshnessNotice className="mt-6" role="alert">
          <span className="font-medium text-rose-300">
            {discoveryError.title}
          </span>
          <span className="mt-1 block text-slate-300">
            {discoveryError.message}
          </span>
        </FreshnessNotice>
      )}

      {resolution.status === "ready" && proposalIds.length === 0 && (
        <EmptyState className="mt-6">No proposals yet.</EmptyState>
      )}

      {resolution.status === "ready" && proposalIds.length > 0 && (
        <>
          {resolution.entries.some((entry) => entry.status === "error") && (
            <FreshnessNotice className="mt-6" role="alert">
              <span className="font-medium text-amber-300">
                {partialMessage?.title ?? "Some proposal states are unavailable"}
              </span>
              <span className="mt-1 block text-slate-300">
                {partialMessage?.message ??
                  "Successful proposals remain visible."}
              </span>
            </FreshnessNotice>
          )}

          {filteredEntries.length === 0 ? (
            <EmptyState className="mt-6">
              <div className="flex flex-col items-center gap-3">
                <span>
                  No proposals match &ldquo;{query.trim()}&rdquo;.
                </span>
                {hasActiveQuery && (
                  <button
                    type="button"
                    onClick={clearQuery}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
                  >
                    Clear search
                  </button>
                )}
              </div>
            </EmptyState>
          ) : (
            <ul className="mt-6 space-y-2">
              {filteredEntries.map((entry) => {
                const searchText = extractProposalSearchText(
                  entry,
                  proposalDescriptions,
                );
                return (
                  <li key={entry.id}>
                    <Link
                      href={`/community/${community.record.id}/proposals/${entry.id}`}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#151b2b] px-4 py-3 text-sm text-slate-200 hover:bg-slate-800/80"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-mono text-xs text-slate-400">
                            #{entry.id}
                          </span>
                          {searchText.title && (
                            <span className="truncate font-medium text-slate-100">
                              {searchText.title}
                            </span>
                          )}
                        </div>
                        {searchText.summary && (
                          <p className="mt-1 truncate text-xs text-slate-400">
                            {searchText.summary}
                          </p>
                        )}
                      </div>
                      <span
                        className={`ml-3 shrink-0 ${entry.status === "error" ? "text-rose-400" : "text-slate-500"}`}
                      >
                        {entry.status === "ready"
                          ? stateLabels[entry.state]
                          : "Unavailable"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
