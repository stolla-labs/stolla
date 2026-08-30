"use client";

import Link from "next/link";
import { ProposalState } from "@/lib/bindings/community-governor/src";
import { getStoredProposalIdsFor } from "@/lib/contracts";
import {
  useCommunityProposals,
  type ProposalReaderFactory,
} from "@/lib/communities/proposals";

export type ProposalActivityProps = {
  communityId: string;
  governorContractId: string;
  proposalIds?: string[];
  getReader?: ProposalReaderFactory;
};

const STATE_LABELS: Record<ProposalState, string> = {
  [ProposalState.Pending]: "Pending",
  [ProposalState.Active]: "Active",
  [ProposalState.Defeated]: "Defeated",
  [ProposalState.Canceled]: "Canceled",
  [ProposalState.Succeeded]: "Succeeded",
  [ProposalState.Queued]: "Queued",
  [ProposalState.Expired]: "Expired",
  [ProposalState.Executed]: "Executed",
};

type Freshness = "Current" | "Delayed" | "Stale" | "Unavailable";

function deriveFreshness(
  status: string,
  hasErrorEntry: boolean,
  isLoading: boolean,
): Freshness {
  if (isLoading) return "Delayed";
  if (status === "error" || hasErrorEntry) return "Stale";
  // When discovery itself is unavailable (error status with 0 entries), show Unavailable
  // For the pure localStorage path we default to Current when clean.
  return "Current";
}

function FreshnessBadge({ freshness }: { freshness: Freshness }) {
  const styles: Record<Freshness, string> = {
    Current: "border-emerald-800/60 bg-emerald-950/40 text-emerald-200",
    Delayed: "border-slate-700 bg-slate-800/60 text-slate-300",
    Stale: "border-amber-800/60 bg-amber-950/40 text-amber-200",
    Unavailable: "border-rose-800/60 bg-rose-950/40 text-rose-200",
  };
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${styles[freshness]}`}
      aria-label={`Discovery freshness: ${freshness}`}
    >
      {freshness}
    </span>
  );
}

export function ProposalActivity({
  communityId,
  governorContractId,
  proposalIds,
  getReader,
}: ProposalActivityProps) {
  const ids = proposalIds ?? getStoredProposalIdsFor(governorContractId);
  const resolution = useCommunityProposals(governorContractId, ids, getReader);

  const isLoading = resolution.status === "loading";
  const entries =
    resolution.status === "ready" ? resolution.entries : [];
  const unavailable = resolution.status === "error";
  const hasErrorEntry = entries.some((e) => e.status === "error");
  const readyEntries = entries.filter(
    (e): e is Extract<typeof e, { status: "ready" }> => e.status === "ready",
  );
  const activeCount = readyEntries.filter((e) => e.state === ProposalState.Active).length;
  // Most recent = last stored first (storeProposalIdFor unshifts), so ids[0] is newest.
  // Take up to 3 that are ready; preserve id order.
  const recentReady = readyEntries
    .slice()
    .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
    .slice(0, 3);

  const freshness = unavailable
    ? "Unavailable"
    : deriveFreshness(resolution.status, hasErrorEntry, isLoading);

  return (
    <section
      aria-labelledby="proposal-activity-title"
      className="mt-6 rounded-xl border border-slate-800 bg-[#151b2b] p-4 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="proposal-activity-title" className="font-semibold text-slate-100">
          Proposal activity
        </h2>
        <FreshnessBadge freshness={freshness} />
      </div>

      {isLoading && (
        <p className="mt-4 text-sm text-slate-500" role="status">
          Loading proposal activity…
        </p>
      )}

      {unavailable && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-rose-800/60 bg-rose-950/40 p-4"
        >
          <p className="text-sm font-medium text-rose-100">
            Proposal discovery is unavailable
          </p>
          <p className="mt-1 text-sm text-rose-200">
            The Governor could not be queried. No proposal count is shown.
          </p>
        </div>
      )}

      {!isLoading && !unavailable && entries.length === 0 && (
        <div className="mt-4 rounded-lg border border-slate-800 bg-[#0b0f19] p-4">
          <p className="text-sm font-medium text-slate-200">No proposals yet</p>
          <p className="mt-1 text-sm text-slate-500">
            This community hasn&apos;t created any proposals. When it does, the latest three will appear here.
          </p>
        </div>
      )}

      {!isLoading && entries.length > 0 && hasErrorEntry && readyEntries.length === 0 && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-amber-800/60 bg-amber-950/40 p-4"
        >
          <p className="text-sm font-medium text-amber-100">Proposal discovery is stale</p>
          <p className="mt-1 text-sm text-amber-200">
            Some proposals couldn&apos;t be loaded. The list may be incomplete. Try again.
          </p>
        </div>
      )}

      {!isLoading && hasErrorEntry && readyEntries.length > 0 && (
        <p className="mt-3 text-xs text-amber-300" role="status">
          Some proposals failed to load — showing available ones.
        </p>
      )}

      {!isLoading && entries.length > 0 && (
        <>
          <p className="mt-3 text-sm text-slate-400">
            <span className="font-semibold text-slate-200">{activeCount}</span>{" "}
            active proposal{activeCount !== 1 ? "s" : ""}
            {" · "}
            {entries.length} total
          </p>

          {recentReady.length > 0 && (
            <ul className="mt-4 space-y-2" aria-label="Recent proposals">
              {recentReady.map((entry) => (
                <li key={entry.id}>
                  <Link
                    href={`/communities/${communityId}/proposals/${entry.id}`}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#0b0f19] px-3 py-2.5 text-sm hover:bg-slate-800"
                  >
                    <span className="truncate font-mono text-slate-200" title={entry.id}>
                      {entry.id.slice(0, 10)}…{entry.id.slice(-6)}
                    </span>
                    <span className="ml-3 shrink-0 rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
                      {STATE_LABELS[entry.state]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <Link
            href={`/communities/${communityId}/proposals`}
            className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            View all proposals
          </Link>
        </>
      )}

      <p className="mt-4 text-xs text-slate-500">
        Last indexed state: {freshness}.{" "}
        {freshness === "Stale" && "Data may be delayed — retry if this persists."}
      </p>
    </section>
  );
}
