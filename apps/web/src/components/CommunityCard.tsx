import { CommunityAvatar } from "@/components/CommunityAvatar";
import { AppLinkButton } from "@/components/ui/AppLinkButton";
import type { CommunityView } from "@/lib/community/types";
import { truncateMiddle } from "@/lib/truncate";

export function CommunityCard({ community }: { community: CommunityView }) {
  const { metadata, metadataError, record, governance } = community;
  const name = metadata?.name ?? `Community ${truncateMiddle(record.id, 8, 6)}`;

  return (
    <article className="flex h-full min-w-0 flex-col rounded-xl border border-slate-800 bg-[#151b2b] p-4 sm:p-5">
      <div className="flex min-w-0 items-start gap-3">
        <CommunityAvatar
          communityId={record.id}
          name={name}
          logo={metadata?.logo}
        />
        <div className="min-w-0">
          <h2 className="break-words text-lg font-semibold text-slate-100 [overflow-wrap:anywhere]">
            {name}
          </h2>
          <p
            className="mt-0.5 break-all font-mono text-xs text-slate-500"
            title={record.id}
          >
            {truncateMiddle(record.id, 10, 8)}
          </p>
        </div>
      </div>

      {metadata ? (
        <p
          className="mt-4 line-clamp-3 break-words text-sm leading-6 text-slate-400 [overflow-wrap:anywhere]"
          title={metadata.description}
        >
          {metadata.description}
        </p>
      ) : (
        <p className="mt-4 text-sm text-amber-300" role="status">
          Metadata unavailable. The verified registry record is still shown.
          {metadataError ? (
            <span className="sr-only"> {metadataError}</span>
          ) : null}
        </p>
      )}

      <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-800 pt-4 text-sm">
        <div className="min-w-0">
          <dt className="text-xs text-slate-500">Proposal threshold</dt>
          <dd className="mt-1 break-words text-slate-200">
            {governance.proposalThreshold ?? "Unavailable"}{" "}
            {governance.proposalThreshold ? "NFT votes" : ""}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-slate-500">Quorum</dt>
          <dd className="mt-1 break-words text-slate-200">
            {governance.quorum ?? "Unavailable"}{" "}
            {governance.quorum ? "NFT votes" : ""}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-slate-500">Voting delay</dt>
          <dd className="mt-1 break-words text-slate-200">
            {governance.votingDelay ?? "Unavailable"}{" "}
            {governance.votingDelay !== null ? "ledgers" : ""}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-slate-500">Voting period</dt>
          <dd className="mt-1 break-words text-slate-200">
            {governance.votingPeriod ?? "Unavailable"}{" "}
            {governance.votingPeriod !== null ? "ledgers" : ""}
          </dd>
        </div>
      </dl>

      <AppLinkButton
        href={`/communities/${record.id}`}
        aria-label={`View ${name} community details`}
        tone="primary"
        className="mt-5 sm:self-start"
      >
        View community
      </AppLinkButton>
    </article>
  );
}
