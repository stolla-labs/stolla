"use client";

import Link from "next/link";
import type { Community, CommunityRegistry } from "@/lib/community/types";
import { useRegistryCommunity } from "@/lib/community/useRegistryCommunity";
import { CommunityBreadcrumbs } from "./CommunityBreadcrumbs";
import { CommunityNotFound } from "./CommunityNotFound";

export type CommunityDetailViewProps = {
  communityId: string;
  registry?: CommunityRegistry;
};

export function CommunityDetailView({
  communityId,
  registry,
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

  return <CommunityDetailPanel community={resolution.result.community} />;
}

function CommunityDetailPanel({ community }: { community: Community }) {
  const { record, metadata, metadataError } = community;
  const name = metadata?.name ?? `Community ${record.id.slice(0, 8)}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <CommunityBreadcrumbs
        communityId={record.id}
        communityName={name}
      />

      <h1 className="mt-4 text-2xl font-bold text-slate-100">{name}</h1>

      {metadata && (
        <p className="mt-2 text-slate-400">{metadata.description}</p>
      )}
      {metadataError && (
        <p className="mt-2 rounded-lg border border-amber-800/60 bg-amber-950/50 p-3 text-sm text-amber-200">
          Community details are temporarily unavailable, but on-chain data below is
          still accurate.
        </p>
      )}

      <dl className="mt-6 grid gap-3 rounded-xl border border-slate-800 bg-[#151b2b] p-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Community ID</dt>
          <dd className="font-mono text-slate-100">{record.id}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Governor contract</dt>
          <dd className="break-all font-mono text-slate-100">
            {record.governorContract}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">NFT contract</dt>
          <dd className="break-all font-mono text-slate-100">
            {record.nftContract}
          </dd>
        </div>
      </dl>

      <Link
        href={`/community/${record.id}/proposals`}
        className="mt-6 inline-block rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
      >
        View proposals
      </Link>
    </div>
  );
}
