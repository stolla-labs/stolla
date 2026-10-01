"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Buffer } from "buffer";
import Link from "next/link";
import { useWallet } from "@/context/WalletProvider";
import { createGovernorClient, storeProposalId } from "@/lib/contracts";
import { useProposalDiscovery } from "@/hooks/useProposalDiscovery";
import { describeDiscoveryError } from "@/lib/discoveryErrors";
import {
  ProposalState,
  PROPOSAL_STATE_LABELS,
  PROPOSAL_STATE_ORDER,
} from "@/lib/proposalState";
import { contractIds } from "@/lib/stellar";
import { Skeleton } from "@/components/ui/Skeleton";
import { ProposalSummaryCard } from "@/components/ProposalSummaryCard";
import { ProposalMetadataFields } from "@/components/proposal/ProposalMetadataFields";
import { PreSubmitSummary } from "@/components/PreSubmitSummary";
import { AppButton } from "@/components/ui/AppButton";
import { truncateEnd } from "@/lib/truncate";
import { LiveStatus } from "@/components/ui/LiveStatus";
import { TransactionLifecycleStatus } from "@/components/TransactionLifecycleStatus";
import { DiscoveryFreshnessBanner } from "@/components/DiscoveryFreshnessBanner";
import { useOperationLifecycle } from "@/hooks/useOperationLifecycle";
import { contractIds as stellarContractIds } from "@/lib/stellar";
import {
  hasProposalMetadataErrors,
  serializeProposalMetadata,
  validateProposalMetadataDraft,
  type ProposalMetadataDraft,
  type ProposalMetadataErrors,
  type ProposalMetadataField,
} from "@/lib/proposal-metadata";

type ActionStatus = {
  message: string;
  tone: "routine" | "error";
};

const ALL_FILTER = "all" as const;
const LOAD_MORE_PAGE_SIZE = 10;
type StateFilter = typeof ALL_FILTER | ProposalState;

const EMPTY_METADATA_DRAFT: ProposalMetadataDraft = {
  title: "",
  summary: "",
  body: "",
  discussionUrl: null,
};

export default function ProposalsPage() {
  const { address, signTransaction } = useWallet();
  const [metadataDraft, setMetadataDraft] =
    useState<ProposalMetadataDraft>(EMPTY_METADATA_DRAFT);
  const [metadataErrors, setMetadataErrors] = useState<ProposalMetadataErrors>(
    {},
  );
  const [status, setStatus] = useState<ActionStatus | null>(null);
  const proposeLifecycle = useOperationLifecycle();
  const [stateFilter, setStateFilter] = useState<StateFilter>(ALL_FILTER);
  const [states, setStates] = useState<Record<string, ProposalState | "unknown">>(
    {},
  );
  const [failedProposalIds, setFailedProposalIds] = useState<string[]>([]);
  const [retryingIds, setRetryingIds] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(LOAD_MORE_PAGE_SIZE);
  const [createOpen, setCreateOpen] = useState(false);

  const {
    proposals: discoveredProposals,
    loading,
    error,
    errorKind,
    empty,
    freshness,
    latestLedger,
    refresh,
  } =
    useProposalDiscovery();
  const contractsConfigured = Boolean(contractIds.governor);

  const discoveryErrorMessage = useMemo(
    () => describeDiscoveryError(error, errorKind),
    [error, errorKind],
  );

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

  const handleRetryDiscovery = useCallback(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    // Async proposal-state fetch owns its loading/error sub-states.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStates();
  }, [loadStates]);

  const availableStates = useMemo(
    () =>
      PROPOSAL_STATE_ORDER.filter((state) =>
        Object.values(states).includes(state),
      ),
    [states],
  );

  const filteredIds = useMemo(
    () =>
      stateFilter === ALL_FILTER
        ? uniqueProposalIds
        : uniqueProposalIds.filter((id) => states[id] === stateFilter),
    [stateFilter, states, uniqueProposalIds],
  );

  const visibleIds = useMemo(
    () => filteredIds.slice(0, visibleCount),
    [filteredIds, visibleCount],
  );
  const canLoadMore = visibleCount < filteredIds.length;

  useEffect(() => {
    if (stateFilter !== ALL_FILTER && !availableStates.includes(stateFilter)) {
      // Drop stale filter when the available set shrinks after a reload.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStateFilter(ALL_FILTER);
    }
  }, [availableStates, stateFilter]);


  function updateMetadataField(field: ProposalMetadataField, value: string) {
    setMetadataDraft((current) => ({
      ...current,
      [field]: field === "discussionUrl" ? value || null : value,
    }));
    setMetadataErrors((current) => {
      if (!current[field] && !current.envelope) return current;
      const next = { ...current };
      delete next[field];
      delete next.envelope;
      return next;
    });
  }

  async function handleCreateProposal() {
    if (!address) {
      setStatus({ message: "Connect your wallet first.", tone: "error" });
      return;
    }

    const draftSnapshot: ProposalMetadataDraft = {
      title: metadataDraft.title,
      summary: metadataDraft.summary,
      body: metadataDraft.body,
      discussionUrl: metadataDraft.discussionUrl,
    };
    const nextErrors = validateProposalMetadataDraft(draftSnapshot);
    if (hasProposalMetadataErrors(nextErrors)) {
      setMetadataErrors(nextErrors);
      setStatus(null);
      return;
    }
    if (proposeLifecycle.isInFlight) return;

    const descriptionSnapshot = serializeProposalMetadata(draftSnapshot);
    setMetadataErrors({});
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
      // Preserve entered metadata on rejection / RPC failure.
      setMetadataDraft(draftSnapshot);
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

    setMetadataDraft(EMPTY_METADATA_DRAFT);
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

      {contractsConfigured && !stellarContractIds.governorStartLedger && (
        <p className="mt-6 rounded-lg border border-amber-800/60 bg-amber-950/50 p-4 text-sm text-amber-200">
          Set{" "}
          <code className="font-mono">
            NEXT_PUBLIC_GOVERNOR_START_LEDGER
          </code>{" "}
          in <code className="font-mono">.env.local</code> to bound proposal
          discovery to a valid ledger range.
        </p>
      )}

      {contractsConfigured && (
        <section className="mt-6 min-w-0 rounded-xl border border-slate-800 bg-[#151b2b] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-100">Create proposal</h2>
            <button
              type="button"
              onClick={() => setCreateOpen((open) => !open)}
              aria-expanded={createOpen}
              aria-controls="create-proposal-form"
              className="shrink-0 cursor-pointer rounded-lg bg-slate-800/80 px-2.5 py-1.5 text-sm text-slate-400 transition-colors hover:text-slate-100 sm:px-3"
            >
              {createOpen ? "Hide proposal form" : "New proposal"}
            </button>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Submits to the global Governor. For community-scoped proposals,
            visit{" "}
            <Link
              href="/communities"
              className="underline decoration-slate-500 underline-offset-2 hover:text-slate-200"
            >
              Communities (/communities)
            </Link>
            .
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Structured Proposal Metadata v1 is serialized into the on-chain
            description. Older free-text proposals remain readable on detail
            pages.
          </p>
          {createOpen && (
            <div id="create-proposal-form" className="mt-3">
              <ProposalMetadataFields
                value={metadataDraft}
                errors={metadataErrors}
                onChange={updateMetadataField}
              />
            </div>
          )}
          <PreSubmitSummary simulation={null} onConfirm={() => void handleCreateProposal()} />
          <AppButton
            tone="primary"
            onClick={() => void handleCreateProposal()}
            disabled={!address || proposeLifecycle.isInFlight}
            aria-describedby={
              !address ? "create-proposal-disabled-reason" : undefined
            }
            className="mt-3 w-full sm:w-auto"
          >
            {proposeLifecycle.isInFlight
              ? "Creating proposal…"
              : "Create proposal"}
          </AppButton>
          {!address && (
            <p
              id="create-proposal-disabled-reason"
              className="mt-2 text-sm text-slate-200"
            >
              Connect your wallet to create a proposal.
            </p>
          )}
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
            <p className="mt-1 text-sm text-rose-300/80">
              {discoveryErrorMessage}
            </p>
            <AppButton
              tone="danger"
              onClick={handleRetryDiscovery}
              className="mt-3"
            >
              Retry loading proposals
            </AppButton>
          </div>
        )}

        {!loading && !error && (
          <DiscoveryFreshnessBanner
            freshness={freshness}
            onRetry={handleRetryDiscovery}
          />
        )}

        {!loading && !error && empty && (
          <LiveStatus className="mt-3 rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-4 text-sm text-slate-400">
            No public proposals were found in the scanned range.
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
                const discovered = proposals.find((proposal) => proposal.id === id);
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
                        voteEnd: discovered?.voteEnd,
                        voteSnapshot: discovered?.voteSnapshot,
                      }}
                      currentLedger={latestLedger}
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
              <AppButton
                tone="secondary"
                onClick={() =>
                  setVisibleCount((count) => count + LOAD_MORE_PAGE_SIZE)
                }
                className="mt-4 w-full sm:w-auto"
              >
                Load more
              </AppButton>
            )}
          </>
        )}
      </section>
    </div>
  );
}
