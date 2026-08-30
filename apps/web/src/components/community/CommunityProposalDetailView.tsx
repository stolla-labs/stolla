"use client";

import type { Community, CommunityRegistry } from "@/lib/community/types";
import { useRegistryCommunity } from "@/lib/community/useRegistryCommunity";
import {
  useCommunityProposal,
  type ProposalReaderFactory,
} from "@/lib/communities/proposals";
import { ProposalState } from "@/lib/bindings/community-governor/src";
import { CommunityBreadcrumbs } from "./CommunityBreadcrumbs";
import { CommunityNotFound } from "./CommunityNotFound";
import { AsyncState } from "@/components/ui/AsyncState";
import { ErrorState } from "@/components/ui/ErrorState";

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

export type CommunityProposalDetailViewProps = {
  communityId: string;
  proposalId: string;
  registry?: CommunityRegistry;
  getReader?: ProposalReaderFactory;
};

export function CommunityProposalDetailView({
  communityId,
  proposalId,
  registry,
  getReader,
}: CommunityProposalDetailViewProps) {
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
    <CommunityProposalDetailPanel
      community={community}
      proposalId={proposalId}
      getReader={getReader}
    />
  );
}

function CommunityProposalDetailPanel({
  community,
  proposalId,
  getReader,
}: {
  community: Community;
  proposalId: string;
  getReader?: ProposalReaderFactory;
}) {
  const resolution = useCommunityProposal(
    community.record.governorContract,
    proposalId,
    getReader,
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <CommunityBreadcrumbs
        communityId={community.record.id}
        communityName={community.metadata?.name ?? community.record.id}
        proposalId={proposalId}
      />
      <h1 className="mt-4 text-2xl font-bold text-slate-100">
        Proposal #{proposalId}
      </h1>

      {resolution.status === "loading" && (
        <AsyncState className="mt-6 text-sm text-slate-500">
          Loading proposal…
        </AsyncState>
      )}
      {resolution.status === "error" && (
        <ErrorState className="mt-6" title="Proposal unavailable">
          {resolution.error}
        </ErrorState>
      )}
      {resolution.status === "ready" && (
        <dl className="mt-6 grid gap-3 rounded-xl border border-slate-800 bg-[#151b2b] p-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">State</dt>
            <dd className="font-medium text-slate-100">
              {stateLabels[resolution.state]}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Community</dt>
            <dd className="font-medium text-slate-100">
              {community.metadata?.name ?? community.record.id}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}
