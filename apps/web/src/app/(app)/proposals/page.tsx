"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Buffer } from "buffer";
import { useWallet } from "@/context/WalletProvider";
import { createGovernorClient, storeProposalId } from "@/lib/contracts";
import { useProposalDiscovery } from "@/hooks/useProposalDiscovery";
import {
  ProposalState,
  PROPOSAL_STATE_LABELS,
  PROPOSAL_STATE_ORDER,
} from "@/lib/proposalState";
import { contractIds } from "@/lib/stellar";
import { Skeleton } from "@/components/ui/Skeleton";
import { ProposalSummaryCard } from "@/components/ProposalSummaryCard";
import { truncateEnd } from "@/lib/truncate";
import { LiveStatus } from "@/components/ui/LiveStatus";
import { TransactionLifecycleStatus } from "@/components/TransactionLifecycleStatus";
import { useOperationLifecycle } from "@/hooks/useOperationLifecycle";

type ActionStatus = {
  message: string;
  tone: "routine" | "error";
};

const ALL_FILTER = "all" as const;
const LOAD_MORE_PAGE_SIZE = 10;
type StateFilter = typeof ALL_FILTER | ProposalState;

export default function ProposalsPage() {
  const { address, signTransaction } = useWallet();
  const [description, setDescription] = useState("");
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [status, setStatus] = useState<ActionStatus | null>(null);
  const proposeLifecycle = useOperationLifecycle();
  const [stateFilter, setStateFilter] = useState<StateFilter>(ALL_FILTER);
  const [states, setStates] = useState<Record<string, ProposalState | "unknown">>(
    {},
  );
  const [failedProposalIds, setFailedProposalIds] = useState<string[]>([]);
  const [retryingIds, setRetryingIds] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(LOAD_MORE_PAGE_SIZE);

  const {
    proposals: discoveredProposals,
    loading,
    error,
    empty,
    refresh,
  } =
    useProposalDiscovery();
  const contractsConfigured = Boolean(contractIds.governor);

  const proposals = useMemo(
    () =>
      Array.from(
        new Map(
          discoveredProposals.map((proposal) => [proposal.id, proposal]),
        ).values(),
      ),
    [discoveredProposals],
  );
  const proposalIds = useMemo(
    () => proposals.map((proposal) => proposal.id),
    [proposals],
  );

  const descriptionsById = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const proposal of proposals) {
      map[proposal.id] = proposal.description;
    }
    return map;
  }, [proposals]);
  const uniqueProposalIds = useMemo(
    () => Array.from(new Set(proposalIds)),
    [proposalIds],
  );

  const loadStates = useCallback(async () => {
    if (!contractsConfigured || uniqueProposalIds.length === 0) {
      setStates({});
      setFailedProposalIds([]);
      return;
    }

    let client: ReturnType<typeof createGovernorClient> | undefined;
    const nextStates: Record<string, ProposalState | "unknown"> = {};
    const failedIds: string[] = [];

    for (const idHex of uniqueProposalIds) {
      try {
        client ??= createGovernorClient({
          publicKey: address ?? "",
          signTransaction,
        });
        const tx = await client.proposal_state({
          proposal_id: Buffer.from(idHex, "hex"),
        });
        nextStates[idHex] = tx.result ?? ProposalState.Pending;
      } catch {
        nextStates[idHex] = "unknown";
        failedIds.push(idHex);
      }
    }

    setStates(nextStates);
    setFailedProposalIds(failedIds);
  }, [address, contractsConfigured, signTransaction, uniqueProposalIds]);

  const retryProposalState = useCallback(
    async (idHex: string) => {
      if (!contractsConfigured) return;

      setRetryingIds((current) =>
        current.includes(idHex) ? current : [...current, idHex],
      );

      try {
        const client = createGovernorClient({
          publicKey: address ?? "",
          signTransaction,
        });
        const tx = await client.proposal_state({
          proposal_id: Buffer.from(idHex, "hex"),
        });
        setStates((current) => ({
          ...current,
          [idHex]: tx.result ?? ProposalState.Pending,
        }));
        setFailedProposalIds((current) =>
          current.filter((failedId) => failedId !== idHex),
        );
      } catch {
        setStates((current) => ({ ...current, [idHex]: "unknown" }));
        setFailedProposalIds((current) =>
          current.includes(idHex) ? current : [...current, idHex],
        );
      } finally {
        setRetryingIds((current) =>
          current.filter((retryingId) => retryingId !== idHex),
        );
      }
    },
    [address, contractsConfigured, signTransaction],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!contractsConfigured || uniqueProposalIds.length === 0) {
        if (!cancelled) {
          setStates({});
          setFailedProposalIds([]);
        }
        return;
      }

      let client: ReturnType<typeof createGovernorClient> | undefined;
      const nextStates: Record<string, ProposalState | "unknown"> = {};
      const failedIds: string[] = [];

      for (const idHex of uniqueProposalIds) {
        try {
          client ??= createGovernorClient({
            publicKey: address ?? "",
            signTransaction,
          });
          const tx = await client.proposal_state({
            proposal_id: Buffer.from(idHex, "hex"),
          });
          nextStates[idHex] = tx.result ?? ProposalState.Pending;
        } catch {
          nextStates[idHex] = "unknown";
          failedIds.push(idHex);
        }
      }

      if (!cancelled) {
        setStates(nextStates);
        setFailedProposalIds(failedIds);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address, contractsConfigured, signTransaction, uniqueProposalIds]);

  const availableStates = useMemo(
    () =>
      PROPOSAL_STATE_ORDER.filter((state) =>
        Object.values(states).includes(state),
      ),
    [states],
  );

  const activeStateFilter = useMemo(() => {
    if (stateFilter !== ALL_FILTER && !availableStates.includes(stateFilter)) {
      return ALL_FILTER;
    }
    return stateFilter;
  }, [availableStates, stateFilter]);

  const filteredIds = useMemo(
    () =>
      activeStateFilter === ALL_FILTER
        ? uniqueProposalIds
        : uniqueProposalIds.filter((id) => states[id] === activeStateFilter),
    [activeStateFilter, states, uniqueProposalIds],
  );

  const visibleIds = useMemo(
    () => filteredIds.slice(0, visibleCount),
    [filteredIds, visibleCount],
  );
  const canLoadMore = visibleCount < filteredIds.length;

  async function handleCreateProposal() {
    if (!address) {
      setStatus({ message: "Connect your wallet first.", tone: "error" });
      return;
    }
    if (!description.trim()) {
      setDescriptionError("Proposal description is required.");
      setStatus(null);
      return;
    }
    if (proposeLifecycle.isInFlight) return;

    const descriptionSnapshot = description.trim();
    setDescriptionError(null);
    setStatus(null);
    proposeLifecycle.reset();

    const result = await proposeLifecycle.execute(async () => {
      const client = createGovernorClient({
        publicKey: address,
        signTransaction,
      });
      return client.propose({
        targets: [address],
        functions: ["noop"],
        args: [[]],
        description: descriptionSnapshot,
        proposer: address,
      });
    });

    if (!result.ok) {
      // Preserve entered description on rejection / RPC failure.
      setDescription(descriptionSnapshot);
      return;
    }

    const idBytes = result.result;
    const idHex =
      idBytes instanceof Uint8Array || Buffer.isBuffer(idBytes)
        ? Buffer.from(idBytes).toString("hex")
        : typeof idBytes === "string"
          ? idBytes
          : null;

    if (idHex) {
      storeProposalId(idHex);
      setStatus({
        message: `Proposal created: ${truncateEnd(idHex, 12)}`,
        tone: "routine",
      });
    } else {
      setStatus({
        message: "Proposal created successfully.",
        tone: "routine",
      });
    }

    setDescription("");
    // Discovery delay is indexing lag, not a transaction failure.
    const refreshed = await refresh();
    if (!refreshed) {
      setStatus({
        message: idHex
          ? `Proposal confirmed (${truncateEnd(idHex, 12)}). Public history is still indexing.`
          : "Proposal confirmed. Public history is still indexing.",
        tone: "routine",
      });
      return;
    }
    await loadStates();
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-100">Proposals</h1>
      <p className="mt-2 text-slate-400">
        Create and track DAO proposals. Voting power requires delegated NFTs.
      </p>

      {!contractsConfigured && (
        <p className="mt-6 rounded-lg border border-amber-800/60 bg-amber-950/50 p-4 text-sm text-amber-200">
          Set <code className="font-mono">NEXT_PUBLIC_GOVERNOR_CONTRACT_ID</code>{" "}
          in <code className="font-mono">.env.local</code> after deployment.
        </p>
      )}

      {contractsConfigured && (
        <section className="mt-6 min-w-0 rounded-xl border border-slate-800 bg-[#151b2b] p-4 sm:p-5">
          <h2 className="font-semibold text-slate-100">Create proposal</h2>
          <label
            htmlFor="proposal-description"
            className="mt-3 block text-sm text-slate-400"
          >
            Proposal description{" "}
            <span className="text-slate-500">(required)</span>
          </label>
          <textarea
            id="proposal-description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setDescriptionError(null);
            }}
            rows={3}
            required
            aria-describedby={`proposal-description-help${
              descriptionError ? " proposal-description-error" : ""
            }`}
            aria-invalid={Boolean(descriptionError)}
            className="mt-1 box-border w-full min-w-0 resize-y rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
            placeholder="Describe the community decision..."
          />
          <p
            id="proposal-description-help"
            className="mt-1 text-xs text-slate-500"
          >
            Summarize the decision and intended action recorded with the proposal.
          </p>
          {descriptionError && (
            <p
              id="proposal-description-error"
              role="alert"
              className="mt-1 text-xs text-rose-300"
            >
              {descriptionError}
            </p>
          )}
          <button
            type="button"
            onClick={() => void handleCreateProposal()}
            disabled={!address || proposeLifecycle.isInFlight}
            className="mt-3 min-h-11 w-full touch-manipulation rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50 sm:w-auto"
          >
            {proposeLifecycle.isInFlight
              ? "Creating proposal…"
              : "Create proposal"}
          </button>
          <TransactionLifecycleStatus
            stage={proposeLifecycle.stage}
            operationLabel="Propose"
            error={proposeLifecycle.error}
            metadata={{
              transactionHash: proposeLifecycle.transactionHash,
              details: proposeLifecycle.outcomeKind
                ? [
                    {
                      label: "Outcome",
                      value:
                        proposeLifecycle.outcomeKind === "wallet_rejected"
                          ? "Wallet rejected"
                          : proposeLifecycle.outcomeKind === "still_pending"
                            ? "Still pending"
                            : proposeLifecycle.outcomeKind ===
                                "simulation_failed"
                              ? "Simulation failed"
                              : "Send failed",
                    },
                  ]
                : undefined,
            }}
          />
          {status && (
            <LiveStatus
              tone={status.tone}
              className={`mt-3 min-w-0 break-words rounded-lg border bg-[#0b0f19] p-3 text-sm [overflow-wrap:anywhere] ${
                status.tone === "error"
                  ? "border-rose-800/70 text-rose-200"
                  : "border-slate-800 text-slate-200"
              }`}
            >
              {status.message}
            </LiveStatus>
          )}
        </section>
      )}

      <section className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-100">
            Community governance history
          </h2>
          {uniqueProposalIds.length > 0 && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="proposal-state-filter"
                className="text-sm text-slate-500"
              >
                Filter by state
              </label>
              <select
                id="proposal-state-filter"
                aria-label="Filter proposals by state"
                value={
                  stateFilter === ALL_FILTER ? ALL_FILTER : String(stateFilter)
                }
                onChange={(e) => {
                  setStateFilter(
                    e.target.value === ALL_FILTER
                      ? ALL_FILTER
                      : (Number(e.target.value) as ProposalState),
                  );
                  setVisibleCount(LOAD_MORE_PAGE_SIZE);
                }}
                className="rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-1.5 text-sm text-slate-100"
              >
                <option value={ALL_FILTER}>All</option>
                {availableStates.map((state) => (
                  <option key={state} value={state}>
                    {PROPOSAL_STATE_LABELS[state]}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        {!address && (
          <p className="mt-2 text-sm text-slate-500">
            Proposal history is public. You can review it without connecting a
            wallet.
          </p>
        )}

        {loading && (
          <>
            <ul className="mt-3 space-y-2">
              {Array.from({ length: Math.max(uniqueProposalIds.length || 3, 1) }).map(
                (_, i) => (
                  <li key={i}>
                    <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#151b2b] px-4 py-3">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                  </li>
                ),
              )}
            </ul>
            <LiveStatus className="sr-only">Loading proposal history...</LiveStatus>
          </>
        )}

        {!loading && error && (
          <div
            className="mt-3 rounded-lg border border-rose-800/70 bg-rose-950/40 p-4"
            role="alert"
          >
            <p className="font-medium text-rose-200">
              {uniqueProposalIds.length > 0
                ? "More proposal history could not be loaded."
                : "Proposal history is temporarily unavailable."}
            </p>
            <p className="mt-1 text-sm text-rose-300/80">{error}</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="mt-3 min-h-11 touch-manipulation rounded-lg border border-rose-600 px-3 py-2 text-sm font-medium text-rose-100 hover:bg-rose-900/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
            >
              Retry loading proposals
            </button>
          </div>
        )}

        {!loading && !error && empty && (
          <LiveStatus className="mt-3 rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-4 text-sm text-slate-400">
            No public proposals have been discovered yet.
          </LiveStatus>
        )}

        {!loading && uniqueProposalIds.length > 0 && filteredIds.length === 0 && (
          <p className="mt-2 text-sm text-slate-500">
            No proposals match the selected filter.
          </p>
        )}

        {!loading && visibleIds.length > 0 && (
          <>
            {failedProposalIds.length > 0 && (
              <p
                className="mt-3 rounded-lg border border-amber-800/70 bg-amber-950/40 p-4 text-sm text-amber-200"
                role="status"
              >
                Some proposal states could not be loaded. Successful entries
                remain listed; retry state on an affected entry.
              </p>
            )}
            <ul className="mt-3 space-y-2">
              {visibleIds.map((id) => {
                const state = states[id];
                const stateFailed = failedProposalIds.includes(id);
                const isRetrying = retryingIds.includes(id);
                const stateStatus = stateFailed
                  ? "unavailable"
                  : state === undefined
                    ? "loading"
                    : "ready";
                const stateLabel =
                  state === undefined || state === "unknown"
                    ? undefined
                    : PROPOSAL_STATE_LABELS[state];
                return (
                  <li key={id}>
                    <ProposalSummaryCard
                      summary={{
                        proposalId: id,
                        description: descriptionsById[id] ?? null,
                      }}
                      showDescription
                      stateStatus={stateStatus}
                      stateLabel={stateLabel}
                      onRetryState={
                        stateFailed
                          ? () => void retryProposalState(id)
                          : undefined
                      }
                      isRetryingState={isRetrying}
                      onCopyId={() => void navigator.clipboard.writeText(id)}
                    />
                  </li>
                );
              })}
            </ul>
            {canLoadMore && (
              <button
                type="button"
                onClick={() =>
                  setVisibleCount((count) => count + LOAD_MORE_PAGE_SIZE)
                }
                className="mt-4 min-h-11 w-full touch-manipulation rounded-lg border border-slate-700 bg-[#151b2b] px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800/80 sm:w-auto"
              >
                Load more
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
