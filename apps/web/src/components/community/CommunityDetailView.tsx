"use client";

import { AppLinkButton } from "@/components/ui/AppLinkButton";
import { getCommunityById } from "@/lib/communities/registry";
import type { CommunityRecord, CommunityMetadata } from "@/lib/communities/types";
import { useCommunityMetadata } from "@/lib/communities/useCommunityMetadata";
import { CommunityBreadcrumbs } from "./CommunityBreadcrumbs";
import { CommunityNotFound } from "./CommunityNotFound";

export type CommunityDetailViewProps = {
  communityId: string;
  registry?: CommunityRecord[];
  fetchMetadata?: (uri: string) => Promise<CommunityMetadata>;
};

export function CommunityDetailView({
  communityId,
  registry,
  fetchMetadata,
}: CommunityDetailViewProps) {
  const community = getCommunityById(communityId, registry);

  if (!community) {
    return <CommunityNotFound communityId={communityId} />;
  }

  return (
    <CommunityDetailPanel
      community={community}
      fetchMetadata={fetchMetadata}
    />
  );
}

function CommunityDetailPanel({
  community,
  fetchMetadata,
}: {
  community: CommunityRecord;
  fetchMetadata?: (uri: string) => Promise<CommunityMetadata>;
}) {
  const metadata = useCommunityMetadata(community.metadataUri, fetchMetadata);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <CommunityBreadcrumbs
        communityId={community.id}
        communityName={community.name}
      />

      <h1 className="mt-4 text-2xl font-bold text-slate-100">{community.name}</h1>

      {metadata.status === "ready" && (
        <p className="mt-2 text-slate-400">{metadata.data.description}</p>
      )}
      {metadata.status === "error" && (
        <p className="mt-2 rounded-lg border border-amber-800/60 bg-amber-950/50 p-3 text-sm text-amber-200">
          Community details are temporarily unavailable, but on-chain data below is
          still accurate.
        </p>
      )}

      <dl className="mt-6 grid gap-3 rounded-xl border border-slate-800 bg-[#151b2b] p-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Symbol</dt>
          <dd className="font-mono text-slate-100">{community.symbol}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Community ID</dt>
          <dd className="font-mono text-slate-100">{community.id}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Governor contract</dt>
          <dd className="break-all font-mono text-slate-100">
            {community.governorContractId}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">NFT contract</dt>
          <dd className="break-all font-mono text-slate-100">
            {community.nftContractId}
          </dd>
        </div>
      </dl>

      <AppLinkButton
        href={`/community/${community.id}/proposals`}
        tone="primary"
        className="mt-6"
      >
        View proposals
      </AppLinkButton>
    </div>
  );
}
