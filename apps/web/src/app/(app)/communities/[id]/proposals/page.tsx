"use client";

import Link from "next/link";
import { Buffer } from "buffer";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProposalSummaryCard } from "@/components/ProposalSummaryCard";
import { AsyncState } from "@/components/ui/AsyncState";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FreshnessNotice } from "@/components/ui/FreshnessNotice";
import { Skeleton } from "@/components/ui/Skeleton";
import { useProposalDiscovery } from "@/hooks/useProposalDiscovery";
import { useCommunityRegistry } from "@/lib/community/CommunityRegistryProvider";
import type { Community } from "@/lib/community/types";
import { createReadOnlyGovernorClient } from "@/lib/contracts";
import {
  ProposalState,
  PROPOSAL_STATE_LABELS,
  PROPOSAL_STATE_ORDER,
} from "@/lib/proposalState";

const PAGE_SIZE = 10;
const ALL_STATES = "all";

function ScopedProposalHistory({ community }: { community: Community }) {
  const governorContract = community.record.governorContract;
  const { proposals: discovered, loading, error, empty, refresh } =
    useProposalDiscovery(governorContract);
  const proposals = useMemo(
    () =>
      Array.from(
        new Map(discovered.map((proposal) => [proposal.id, proposal])).values(),
      ),
    [discovered],
  );
  const [states, setStates] = useState<
    Record<string, ProposalState | "unavailable">
  >({});
  const [retrying, setRetrying] = useState<string[]>([]);
  const [filter, setFilter] = useState<typeof ALL_STATES | ProposalState>(
    ALL_STATES,
  );
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const loadState = useCallback(
    async (proposalId: string) => {
      try {
        const client = createReadOnlyGovernorClient(governorContract);
        const transaction = await client.proposal_state({
          proposal_id: Buffer.from(proposalId, "hex"),
        });
        setStates((current) => ({
          ...current,
          [proposalId]: transaction.result ?? ProposalState.Pending,
        }));
      } catch {
        setStates((current) => ({
          ...current,
          [proposalId]: "unavailable",
        }));
      }
    },
    [governorContract],
  );

  useEffect(() => {
    let active = true;
    void Promise.all(
      proposals.map(async (proposal) => {
        if (!active) return;
        await loadState(proposal.id);
      }),
    );
    return () => {
      active = false;
    };
  }, [loadState, proposals]);

  const availableStates = PROPOSAL_STATE_ORDER.filter((state) =>
    Object.values(states).includes(state),
  );
  const filtered =
    filter === ALL_STATES
      ? proposals
      : proposals.filter((proposal) => states[proposal.id] === filter);
  const visible = filtered.slice(0, visibleCount);
  const communityName =
    community.metadata?.name ?? `Community ${community.record.id.slice(0, 8)}`;

  async function retryState(proposalId: string) {
    setRetrying((current) => [...new Set([...current, proposalId])]);
    await loadState(proposalId);
    setRetrying((current) => current.filter((id) => id !== proposalId));
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl px-4 py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-400">
        <Link href="/communities" className="hover:text-indigo-300">
          Communities
        </Link>
        <span aria-hidden="true"> / </span>
        <Link
          href={`/communities/${community.record.id}`}
          className="hover:text-indigo-300"
        >
          {communityName}
        </Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">Proposals</span>
      </nav>

      <h1 className="mt-5 break-words text-2xl font-bold text-slate-100">
        {communityName} proposals
      </h1>
      <p className="mt-2 text-slate-400">
        Public proposal history for this community&apos;s registered Governor.
      </p>
      <p className="mt-2 break-all font-mono text-xs text-slate-500">
        Governor {governorContract}
      </p>

      <section className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-100">Proposal history</h2>
          {proposals.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-slate-400">
              State
              <select
                aria-label="Filter community proposals by state"
                value={String(filter)}
                onChange={(event) => {
                  setFilter(
                    event.target.value === ALL_STATES
                      ? ALL_STATES
                      : (Number(event.target.value) as ProposalState),
                  );
                  setVisibleCount(PAGE_SIZE);
                }}
                className="min-h-10 rounded-lg border border-slate-700 bg-[#0b0f19] px-3 text-slate-100"
              >
                <option value={ALL_STATES}>All</option>
                {availableStates.map((state) => (
                  <option key={state} value={state}>
                    {PROPOSAL_STATE_LABELS[state]}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {loading && proposals.length === 0 && (
          <>
            <AsyncState className="sr-only">
              Loading community proposal history…
            </AsyncState>
            <div className="mt-3 space-y-2" aria-hidden="true">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </>
        )}

        {error && (
          <ErrorState
            className="mt-3"
            title={
              proposals.length
                ? "Proposal history is incomplete"
                : "Proposal history is unavailable"
            }
            onRetry={() => void refresh()}
            retryLabel="Retry proposal history"
          >
            {error}
          </ErrorState>
        )}

        {!loading && !error && empty && (
          <EmptyState className="mt-3">
            This community has no public proposals yet.
          </EmptyState>
        )}

        {!loading && proposals.length > 0 && filtered.length === 0 && (
          <p className="mt-3 text-sm text-slate-400">
            No proposals match this state.
          </p>
        )}

        {visible.length > 0 && (
          <>
            {Object.values(states).includes("unavailable") && (
              <FreshnessNotice className="mt-3">
                Some proposal states could not be refreshed. Available
                proposals remain visible below.
              </FreshnessNotice>
            )}
            <ul className="mt-3 space-y-2">
              {visible.map((proposal) => {
                const state = states[proposal.id];
                const unavailable = state === "unavailable";
                return (
                  <li key={proposal.id}>
                    <ProposalSummaryCard
                      summary={{
                        proposalId: proposal.id,
                        description: proposal.description,
                      }}
                      showDescription
                      href={`/communities/${community.record.id}/proposals/${proposal.id}`}
                      stateStatus={
                        unavailable
                          ? "unavailable"
                          : state === undefined
                            ? "loading"
                            : "ready"
                      }
                      stateLabel={
                        typeof state === "number"
                          ? PROPOSAL_STATE_LABELS[state]
                          : undefined
                      }
                      onRetryState={
                        unavailable
                          ? () => void retryState(proposal.id)
                          : undefined
                      }
                      isRetryingState={retrying.includes(proposal.id)}
                      onCopyId={() =>
                        void navigator.clipboard.writeText(proposal.id)
                      }
                    />
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {visibleCount < filtered.length && (
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
            className="mt-4 min-h-11 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800"
          >
            Load more proposals
          </button>
        )}
      </section>
    </div>
  );
}

export default function CommunityProposalHistoryPage() {
  const { id = "" } = useParams<{ id: string }>();
  const registry = useCommunityRegistry();
  const [community, setCommunity] = useState<Community | null>(null);
  const [status, setStatus] = useState<"loading" | "not-found" | "error">(
    "loading",
  );

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      setStatus("loading");
      setCommunity(null);
      void registry.get(id)
        .then((result) => {
          if (!active) return;
          if (result.status !== "found") {
            setStatus("not-found");
            return;
          }
          setCommunity(result.community);
        })
        .catch(() => {
          if (active) setStatus("error");
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [id, registry]);

  if (community) return <ScopedProposalHistory community={community} />;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      {status === "loading" ? (
        <AsyncState>Loading community proposal history…</AsyncState>
      ) : (
        <ErrorState
          title={
            status === "not-found"
              ? "Community not found"
              : "Community proposal history unavailable"
          }
          action={
            <Link
              href="/communities"
              className="inline-flex min-h-11 items-center rounded-lg bg-indigo-500 px-4 py-2 text-sm text-white"
            >
              Browse communities
            </Link>
          }
        >
          {status === "not-found"
            ? "The route community is malformed or is not registered."
            : "The canonical community record could not be loaded."}
        </ErrorState>
      )}
    </div>
  );
}
