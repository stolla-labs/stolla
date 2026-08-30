"use client";

import Link from "next/link";
import type { Community, CommunityRegistry } from "@/lib/community/types";
import { useRegistryCommunity } from "@/lib/community/useRegistryCommunity";
import { getStoredProposalIdsFor } from "@/lib/contracts";
import {
  useCommunityProposals,
  type ProposalReaderFactory,
} from "@/lib/communities/proposals";
import { ProposalState } from "@/lib/bindings/community-governor/src";
import { CommunityBreadcrumbs } from "./CommunityBreadcrumbs";
import { CommunityNotFound } from "./CommunityNotFound";
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
  getReader?: ProposalReaderFactory;
};

export function CommunityProposalsView({
  communityId,
  registry,
  proposalIds,
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
      getReader={getReader}
    />
  );
}

function CommunityProposalsPanel({
  community,
  proposalIds,
  getReader,
}: {
  community: Community;
  proposalIds: string[];
  getReader?: ProposalReaderFactory;
}) {
  const resolution = useCommunityProposals(
    community.record.governorContract,
    proposalIds,
    getReader,
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <CommunityBreadcrumbs
        communityId={community.record.id}
        communityName={community.metadata?.name ?? community.record.id}
      />
      <h1 className="mt-4 text-2xl font-bold text-slate-100">
        {community.metadata?.name ??
          `Community ${community.record.id.slice(0, 8)}`} proposals
      </h1>

      {resolution.status === "loading" && (
        <AsyncState className="mt-6 text-sm text-slate-500">
          Loading proposals…
        </AsyncState>
      )}

      {resolution.status === "ready" && proposalIds.length === 0 && (
        <EmptyState className="mt-6">No proposals yet.</EmptyState>
      )}

      {resolution.status === "ready" && proposalIds.length > 0 && (
        <>
          {resolution.entries.some((entry) => entry.status === "error") && (
            <FreshnessNotice className="mt-6">
              Some proposal states are unavailable. Successful proposals remain
              visible.
            </FreshnessNotice>
          )}
          <ul className="mt-6 space-y-2">
            {resolution.entries.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={`/community/${community.record.id}/proposals/${entry.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#151b2b] px-4 py-3 text-sm text-slate-200 hover:bg-slate-800/80"
                >
                  <span className="truncate font-mono">#{entry.id}</span>
                  <span
                    className={`ml-3 ${entry.status === "error" ? "text-rose-400" : "text-slate-500"}`}
                  >
                    {entry.status === "ready"
                      ? stateLabels[entry.state]
                      : "Unavailable"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
