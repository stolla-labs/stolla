"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@/context/WalletProvider";
import { VoteActions } from "@/components/VoteActions";
import type { VoteType } from "@/components/voteOptions.mjs";
import {
  createGovernorClient,
  createReadOnlyGovernorClient,
  createReadOnlyNftClient,
} from "@/lib/contracts";
import { ProposalState } from "@/lib/bindings/community-governor/src";
import { PROPOSAL_STATE_LABELS } from "@/lib/proposalState";
import { contractIds } from "@/lib/stellar";
import { Skeleton } from "@/components/ui/Skeleton";
import { parseProposalId } from "@/lib/proposals";
import { useTransactionLifecycle } from "@/hooks/useTransactionLifecycle";
import { TransactionLifecycleDisplay } from "@/components/TransactionLifecycleDisplay";
import { truncateMiddle } from "@/lib/truncate";
import { LiveStatus } from "@/components/ui/LiveStatus";
import type { CommunityView } from "@/lib/community/types";

function shortenAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
import { fetchVoteTotals, type VoteTotals } from "@/lib/proposal-events";
import { fmt, pct } from "@/lib/voteDisplay";
import { useProposalDiscovery } from "@/hooks/useProposalDiscovery";
import { ProposalMetadataDisplay } from "@/components/proposal/ProposalMetadataDisplay";


type ProposalResult = {
  id: string;
  state: string;
  hasVoted: boolean | null;
};

const backLinkClassName =
  "mt-4 inline-block rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400";

export default function ProposalDetailPage({
  proposalId,
  community,
}: {
  proposalId?: string;
  community?: CommunityView;
} = {}) {
  const params = useParams<{ id?: string; proposalId?: string }>();
  const proposalIdHex = proposalId ?? params.proposalId ?? params.id ?? "";
  const governorContractId =
    community?.record.governorContract ?? contractIds.governor;
  const nftContractId = community?.record.nftContract ?? contractIds.nft;
  const backHref = community
    ? `/communities/${community.record.id}/proposals`
    : "/proposals";
  const communityName =
    community?.metadata?.name ??
    (community ? `Community ${truncateMiddle(community.record.id)}` : null);
  const isValidId = parseProposalId(proposalIdHex) !== null;
  const { proposals: discoveredProposals } = useProposalDiscovery(
    governorContractId || undefined,
  );
  const proposalDescription = discoveredProposals.find(
    (candidate) => candidate.id.toLowerCase() === proposalIdHex.toLowerCase(),
  )?.description;
  const { address, signTransaction } = useWallet();
  const [result, setResult] = useState<ProposalResult | null>(null);
  const [loadErrorId, setLoadErrorId] = useState<string | null>(null);
  const [reason, setReason] = useState("Support");
  const [status, setStatus] = useState<string | null>(null);
  const [proposer, setProposer] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [totals, setTotals] = useState<VoteTotals | null>(null);
  const [quorum, setQuorum] = useState<bigint | null>(null);
  const [totalsError, setTotalsError] = useState<string | null>(null);
  const [totalsIncomplete, setTotalsIncomplete] = useState(false);
  const [snapshotLedger, setSnapshotLedger] = useState<number | null>(null);
  const [deadlineLedger, setDeadlineLedger] = useState<number | null>(null);
  const [snapshotStatus, setSnapshotStatus] = useState<
    "loading" | "ready" | "unavailable"
  >("loading");
  const [deadlineStatus, setDeadlineStatus] = useState<
    "loading" | "ready" | "unavailable"
  >("loading");
  const [votingPower, setVotingPower] = useState<bigint | null>(null);
  const [votingPowerStatus, setVotingPowerStatus] = useState<
    "disconnected" | "loading" | "ready" | "unavailable"
  >("disconnected");

  const loadProposal = useCallback(async () => {
    const proposalId = parseProposalId(proposalIdHex);
    if (!proposalId || !governorContractId) {
      throw new Error("Proposal unavailable");
    }
    // Read paths must not depend on a connected wallet; an empty publicKey
    // breaks AssembledTransaction simulation on some SDK paths.
    const readOnlyClient = createReadOnlyGovernorClient(governorContractId);
    const client = address
      ? createGovernorClient({
          publicKey: address,
          signTransaction,
          contractId: governorContractId,
        })
      : readOnlyClient;

    setSnapshotStatus("loading");
    setDeadlineStatus("loading");

    const [stateTx, votedTx, snapshotTx, voteResult] = await Promise.all([
      readOnlyClient.proposal_state({ proposal_id: proposalId }),
      address
        ? client.has_voted({ proposal_id: proposalId, account: address })
        : Promise.resolve(null),
      readOnlyClient.proposal_snapshot({ proposal_id: proposalId }).catch(() => null),
      fetchVoteTotals(proposalIdHex, governorContractId).catch((error: unknown) => ({
        totals: {
          for: BigInt(0),
          against: BigInt(0),
          abstain: BigInt(0),
          total: BigInt(0),
        },
        incomplete: true,
        error:
          error instanceof Error
            ? error.message
            : "Vote history could not be loaded.",
      })),
    ]);

    setTotals(voteResult.totals);
    setTotalsIncomplete(voteResult.incomplete);
    setTotalsError(voteResult.error ?? null);

    const snapshotValue = snapshotTx?.result;
    if (snapshotValue !== undefined && snapshotValue !== null) {
      setSnapshotLedger(snapshotValue);
      setSnapshotStatus("ready");
      try {
        const qTx = await client.quorum({ ledger: snapshotValue });
        setQuorum(qTx.result ?? null);
      } catch {
        setQuorum(null);
      }
    } else {
      setSnapshotLedger(null);
      setSnapshotStatus("unavailable");
      setQuorum(null);
    }

    // Independent reads — one failure must not hide other proposal information.
    readOnlyClient
      .proposal_deadline({ proposal_id: proposalId })
      .then((tx) => {
        if (tx.result === undefined || tx.result === null) {
          setDeadlineLedger(null);
          setDeadlineStatus("unavailable");
          return;
        }
        setDeadlineLedger(tx.result);
        setDeadlineStatus("ready");
      })
      .catch(() => {
        setDeadlineLedger(null);
        setDeadlineStatus("unavailable");
      });

    readOnlyClient
      .proposal_proposer({ proposal_id: proposalId })
      .then((tx) => setProposer(tx.result ?? null))
      .catch(() => setProposer(null));

    return {
      id: proposalIdHex,
      state: PROPOSAL_STATE_LABELS[stateTx.result ?? ProposalState.Pending],
      hasVoted: votedTx ? Boolean(votedTx.result) : null,
    };
  }, [address, governorContractId, proposalIdHex, signTransaction]);

  useEffect(() => {
    if (!isValidId) return;
    let active = true;

    // The async loader owns its independent loading sub-states.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProposal()
      .then((data) => {
        if (!active) return;
        setLoadErrorId(null);
        setResult(data);
      })
      .catch(() => {
        if (active) setLoadErrorId(proposalIdHex);
      });

    return () => {
      active = false;
    };
  }, [isValidId, loadProposal, proposalIdHex]);

  const loadVotingPower = useCallback(async () => {
    if (!address || !nftContractId) {
      setVotingPower(null);
      setVotingPowerStatus(address ? "unavailable" : "disconnected");
      return;
    }

    setVotingPowerStatus("loading");
    setVotingPower(null);

    try {
      const client = createReadOnlyNftClient(nftContractId);
      const tx = await client.get_votes({ account: address });
      setVotingPower(tx.result ?? BigInt(0));
      setVotingPowerStatus("ready");
    } catch {
      setVotingPower(null);
      setVotingPowerStatus("unavailable");
    }
  }, [address, nftContractId]);

  useEffect(() => {
    let active = true;

    void (async () => {
      if (!address || !nftContractId) {
        if (!active) return;
        setVotingPower(null);
        setVotingPowerStatus(address ? "unavailable" : "disconnected");
        return;
      }

      setVotingPowerStatus("loading");
      setVotingPower(null);

      try {
        const client = createReadOnlyNftClient(nftContractId);
        const tx = await client.get_votes({ account: address });
        if (!active) return;
        setVotingPower(tx.result ?? BigInt(0));
        setVotingPowerStatus("ready");
      } catch {
        if (!active) return;
        setVotingPower(null);
        setVotingPowerStatus("unavailable");
      }
    })();

    return () => {
      active = false;
    };
  }, [address, nftContractId]);

  // Transaction lifecycle management
  const {
    state: txLifecycle,
    execute: executeVote,
    reset: resetLifecycle,
    isInFlight: isVoteInFlight,
  } = useTransactionLifecycle({
      onConfirmed: async () => {
        // Refresh has_voted, proposal state, and available vote data after confirmation
        const data = await loadProposal();
        setLoadErrorId(null);
        setResult(data);
        await loadVotingPower();
      },
    });

  async function handleVote(voteType: VoteType) {
    const proposalId = parseProposalId(proposalIdHex);
    if (!proposalId) return;
    if (!address) {
      setStatus("Connect your wallet first.");
      return;
    }

    setStatus(null);
    resetLifecycle();

    await executeVote(voteType, reason, async () => {
      const client = createGovernorClient({
        publicKey: address,
        signTransaction,
        contractId: governorContractId,
      });
      const tx = await client.cast_vote({
        proposal_id: proposalId,
        vote_type: voteType,
        reason,
        voter: address,
      });
      // signAndSend handles wallet approval, network submission, and ledger confirmation
      await tx.signAndSend();
    });
  }

  const isInvalid = !isValidId;
  const isUnavailable = !isInvalid && loadErrorId === proposalIdHex;
  const isReady = !isInvalid && !isUnavailable && result?.id === proposalIdHex;
  const isLoading = !isInvalid && !isUnavailable && !isReady;

  // Disable voting buttons while a transaction is in progress
  const isVotingDisabled = !address || isVoteInFlight;
  const pendingVote = isVotingDisabled
    ? (txLifecycle.voteType as VoteType | null)
    : null;

  if (isInvalid) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-100">
          Invalid proposal ID
        </h1>
        <LiveStatus tone="error" className="mt-2 break-all text-slate-400">
          <code className="font-mono">{proposalIdHex}</code> is not a valid
          32-byte proposal identifier.
        </LiveStatus>
        <Link href={backHref} className={backLinkClassName}>
          Back to proposals
        </Link>
      </div>
    );
  }

  if (isUnavailable) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-100">
          Proposal unavailable
        </h1>
        <LiveStatus tone="error" className="mt-2 break-all text-slate-400">
          We couldn&apos;t load proposal{" "}
          <code className="font-mono">{proposalIdHex}</code>. It may not exist,
          or the network may be temporarily unavailable.
        </LiveStatus>
        <Link href={backHref} className={backLinkClassName}>
          Back to proposals
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <LiveStatus className="sr-only">Loading proposal…</LiveStatus>
        <h1 className="text-2xl font-bold text-slate-100">Proposal</h1>
        <div className="mt-2 flex items-center gap-2">
          <p
            className="truncate font-mono text-sm text-slate-400"
            title={proposalIdHex}
          >
            {truncateMiddle(proposalIdHex)}
          </p>
        </div>
        <div className="mt-6 grid gap-3 rounded-xl border border-slate-800 bg-[#151b2b] p-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">State</dt>
            <dd><Skeleton className="mt-0.5 h-5 w-24" /></dd>
          </div>
          <div>
            <dt className="text-slate-500">You voted</dt>
            <dd><Skeleton className="mt-0.5 h-5 w-16" /></dd>
          </div>
        </div>
      </div>
    );
  }

  const proposal = result!;
  const quorumPct =
    quorum !== null && totals ? pct(totals.total, quorum) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {community && (
        <nav aria-label="Breadcrumb" className="mb-5 text-sm text-slate-400">
          <Link
            href={`/communities/${community.record.id}`}
            className="hover:text-indigo-300"
          >
            {communityName}
          </Link>
          <span aria-hidden="true"> / </span>
          <Link href={backHref} className="hover:text-indigo-300">
            Proposals
          </Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">{truncateMiddle(proposalIdHex)}</span>
        </nav>
      )}
      <h1 className="text-2xl font-bold text-slate-100">Proposal</h1>
      <div className="mt-2 flex items-center gap-2">
        <p
          className="truncate font-mono text-sm text-slate-400"
          title={proposalIdHex}
        >
          {truncateMiddle(proposalIdHex)}
        </p>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(proposalIdHex)}
          className="shrink-0 rounded px-2 py-0.5 text-xs text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
          title="Copy proposal ID"
          aria-label={`Copy proposal ID ${proposalIdHex}`}
        >
          Copy
        </button>
      </div>

      <dl className="mt-6 grid gap-3 rounded-xl border border-slate-800 bg-[#151b2b] p-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">State</dt>
          <dd className="font-medium text-slate-100">{proposal.state}</dd>
        </div>
        <div>
          <dt className="text-slate-500">You voted</dt>
          <dd>
            {proposal.hasVoted === null ? "—" : proposal.hasVoted ? "Yes" : "No"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-slate-500">Your voting power</dt>
          <dd className="mt-0.5">
            {votingPowerStatus === "disconnected" && (
              <span className="text-slate-400">
                Connect your wallet to view voting power.
              </span>
            )}
            {votingPowerStatus === "loading" && (
              <Skeleton className="mt-0.5 h-5 w-24" />
            )}
            {votingPowerStatus === "unavailable" && (
              <span className="text-amber-300">Unavailable</span>
            )}
            {votingPowerStatus === "ready" && votingPower !== null && (
              <div>
                <span className="font-mono text-slate-100">
                  {votingPower.toString()}
                </span>
                {votingPower === BigInt(0) && (
                  <p className="mt-1 text-xs text-slate-500">
                    Delegate your membership NFT on the Community page to gain
                    voting power.
                  </p>
                )}
              </div>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Voting start ledger (snapshot)</dt>
          <dd className="font-mono text-slate-200">
            {snapshotStatus === "loading"
              ? "…"
              : snapshotStatus === "ready" && snapshotLedger !== null
                ? String(snapshotLedger)
                : "Unavailable"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Voting end ledger (deadline)</dt>
          <dd className="font-mono text-slate-200">
            {deadlineStatus === "loading"
              ? "…"
              : deadlineStatus === "ready" && deadlineLedger !== null
                ? String(deadlineLedger)
                : "Unavailable"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-slate-500">Proposer</dt>
          <dd className="mt-1">
            {proposer ? (
              <span className="inline-flex items-center gap-2">
                <span
                  className="font-mono text-sm text-slate-200"
                  title={proposer}
                >
                  {shortenAddress(proposer)}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(proposer);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch {
                      // Clipboard API unavailable
                    }
                  }}
                  aria-label={`Copy full proposer address ${proposer}`}
                  className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-400 transition hover:border-slate-600 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </span>
            ) : (
              <span className="text-slate-600">Unknown</span>
            )}
          </dd>
        </div>
      </dl>
      <div aria-live="polite" className="sr-only">
        {copied ? "Proposer address copied to clipboard" : null}
      </div>

      <section className="mt-6 rounded-xl border border-slate-800 bg-[#151b2b] p-5">
        {proposalDescription ? (
          <ProposalMetadataDisplay description={proposalDescription} />
        ) : (
          <div>
            <h2 className="font-semibold text-slate-100">Description</h2>
            <p className="mt-2 text-sm text-slate-500">
              Description unavailable from public event history.
            </p>
          </div>
        )}
      </section>


      <section className="mt-6 rounded-xl border border-slate-800 bg-[#151b2b] p-5">
        <h2 className="font-semibold text-slate-100">Votes</h2>
        {totals ? (
          <div className="mt-3 space-y-3">
            <div className="flex h-6 w-full overflow-hidden rounded-lg bg-slate-800">
              {totals.total > BigInt(0) ? (
                <>
                  <div
                    className="flex items-center justify-center bg-emerald-600 text-xs font-medium text-white transition-all duration-500"
                    style={{ width: `${pct(totals.for, totals.total)}%` }}
                  >
                    {pct(totals.for, totals.total) > 8 &&
                      `For ${pct(totals.for, totals.total)}%`}
                  </div>
                  <div
                    className="flex items-center justify-center bg-rose-600 text-xs font-medium text-white transition-all duration-500"
                    style={{ width: `${pct(totals.against, totals.total)}%` }}
                  >
                    {pct(totals.against, totals.total) > 8 &&
                      `Against ${pct(totals.against, totals.total)}%`}
                  </div>
                  <div
                    className="flex items-center justify-center bg-slate-600 text-xs font-medium text-white transition-all duration-500"
                    style={{ width: `${pct(totals.abstain, totals.total)}%` }}
                  >
                    {pct(totals.abstain, totals.total) > 8 &&
                      `Abstain ${pct(totals.abstain, totals.total)}%`}
                  </div>
                </>
              ) : (
                <div className="flex w-full items-center justify-center text-xs text-slate-500">
                  No votes yet
                </div>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div className="rounded-lg bg-[#0b0f19] p-2">
                <dt className="text-slate-500">For</dt>
                <dd className="font-mono font-semibold text-emerald-400">
                  {fmt(totals.for)}
                </dd>
              </div>
              <div className="rounded-lg bg-[#0b0f19] p-2">
                <dt className="text-slate-500">Against</dt>
                <dd className="font-mono font-semibold text-rose-400">
                  {fmt(totals.against)}
                </dd>
              </div>
              <div className="rounded-lg bg-[#0b0f19] p-2">
                <dt className="text-slate-500">Abstain</dt>
                <dd className="font-mono font-semibold text-slate-400">
                  {fmt(totals.abstain)}
                </dd>
              </div>
              <div className="rounded-lg bg-[#0b0f19] p-2">
                <dt className="text-slate-500">Total</dt>
                <dd className="font-mono font-semibold text-slate-100">
                  {fmt(totals.total)}
                </dd>
              </div>
            </dl>
            {totalsIncomplete && (
              <p className="text-xs text-amber-500">
                Event history may be incomplete — totals shown are a lower
                bound.
              </p>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-400">
            Vote totals unavailable{totalsError ? `: ${totalsError}` : ""}
          </p>
        )}
      </section>

      {quorum !== null && (
        <section className="mt-4 rounded-xl border border-slate-800 bg-[#151b2b] p-5">
          <h2 className="font-semibold text-slate-100">Quorum</h2>
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">
                {totals ? fmt(totals.total) : "0"} / {fmt(quorum)}
              </span>
              <span
                className={`font-medium ${
                  quorumPct !== null && quorumPct >= 100
                    ? "text-emerald-400"
                    : "text-slate-300"
                }`}
              >
                {quorumPct !== null ? `${quorumPct}%` : "—"}
              </span>
            </div>
            <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  quorumPct !== null && quorumPct >= 100
                    ? "bg-emerald-500"
                    : "bg-blue-500"
                }`}
                style={{ width: `${quorumPct ?? 0}%` }}
              />
            </div>
            {quorumPct !== null && quorumPct >= 100 && (
              <p className="mt-1 text-xs text-emerald-400">Quorum reached</p>
            )}
          </div>
        </section>
      )}

      <section className="mt-6 rounded-xl border border-slate-800 bg-[#151b2b] p-5">
        <h2 className="font-semibold text-slate-100">Cast vote</h2>
        <label
          htmlFor="vote-reason"
          className="mt-3 block text-sm text-slate-400"
        >
          Vote reason <span className="text-slate-500">(optional)</span>
        </label>
        <input
          id="vote-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={isVotingDisabled}
          aria-describedby="vote-reason-help"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 disabled:opacity-50"
          placeholder="Reason (optional)"
        />
        <p id="vote-reason-help" className="mt-1 text-xs text-slate-500">
          This reason is recorded with your vote.
        </p>
        <div className="mt-3">
          <VoteActions
            disabled={isVotingDisabled}
            pendingVote={pendingVote}
            onVote={handleVote}
          />
          {!address && (
            <p className="mt-2 text-xs text-slate-400">
              Connect your wallet to enable voting.
            </p>
          )}
        </div>
      </section>

      {/* Transaction lifecycle display */}
      <TransactionLifecycleDisplay
        stage={txLifecycle.stage}
        voteType={txLifecycle.voteType}
        reason={txLifecycle.reason}
        error={txLifecycle.error}
        isTerminal={txLifecycle.isTerminal}
      />

      {status && (
        <LiveStatus
          tone="error"
          className="mt-4 rounded-lg border border-rose-800/70 bg-[#151b2b] p-3 text-sm text-rose-200"
        >
          {status}
        </LiveStatus>
      )}
    </div>
  );
}
