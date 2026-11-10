"use client";

import { AppLinkButton } from "@/components/ui/AppLinkButton";
import type { Community, CommunityRegistry } from "@/lib/community/types";
import type { GuardianAdapter } from "@/lib/community/guardian";
import { useRegistryCommunity } from "@/lib/community/useRegistryCommunity";
import { CommunityBreadcrumbs } from "./CommunityBreadcrumbs";
import { CommunityNotFound } from "./CommunityNotFound";
import { GuardianControls } from "./GuardianControls";
import { OwnerOnboardingChecklist } from "./OwnerOnboardingChecklist";

export type CommunityDetailViewProps = {
  communityId: string;
  registry?: CommunityRegistry;
  guardianAdapter?: GuardianAdapter;
};

export function CommunityDetailView({
  communityId,
  registry,
  guardianAdapter,
}: CommunityDetailViewProps) {
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

  return <CommunityDetailPanel community={resolution.result.community} guardianAdapter={guardianAdapter} />;
}

function CommunityDetailPanel({ community, guardianAdapter }: { community: Community; guardianAdapter?: GuardianAdapter }) {
  const displayName =
    community.metadata?.name ??
    `Community ${community.record.id.slice(0, 8)}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <CommunityBreadcrumbs
        communityId={community.record.id}
        communityName={displayName}
      />

      <h1 className="mt-4 text-2xl font-bold text-slate-100">{displayName}</h1>

      {community.record.timelockContract && (
        <GuardianControls timelockId={community.record.timelockContract} adapter={guardianAdapter} />
      )}

      {community.metadata && (
        <p className="mt-2 text-slate-400">{community.metadata.description}</p>
      )}
      {community.metadataError && (
        <p className="mt-2 rounded-lg border border-amber-800/60 bg-amber-950/50 p-3 text-sm text-amber-200">
          Community details are temporarily unavailable, but on-chain data below is
          still accurate.
        </p>
      )}

      <dl className="mt-6 grid gap-3 rounded-xl border border-slate-800 bg-[#151b2b] p-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Community ID</dt>
          <dd className="break-all font-mono text-slate-100">{community.record.id}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Governor contract</dt>
          <dd className="break-all font-mono text-slate-100">
            {community.record.governorContract}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">NFT contract</dt>
          <dd className="break-all font-mono text-slate-100">
            {community.record.nftContract}
          </dd>
        </div>
      </dl>

      <AppLinkButton
        href={`/community/${community.record.id}/proposals`}
        tone="primary"
        className="mt-6"
      >
        View proposals
      </AppLinkButton>

      <OwnerOnboardingChecklist community={community} />
    </div>
  );
}
