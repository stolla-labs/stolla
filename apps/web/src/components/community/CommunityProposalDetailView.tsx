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
import type { SignTransaction } from "@stellar/stellar-sdk/contract";
import {
  readTimelockContractId,
  submitTimelockAction,
  type TimelockCallResult,
  type TimelockWindow,
} from "@/lib/timelock/client";
import type { TimelockActionName } from "@/lib/timelock/proposalExecution";
import { useTimelockWindow } from "@/lib/timelock/useTimelockWindow";
import { ProposalActionPolicySummary } from "./ProposalActionPolicySummary";
import { ProposalTimelockActions } from "./ProposalTimelockActions";
import { QuorumProgress } from "@/components/QuorumProgress";
import { fmt } from "@/lib/voteDisplay";

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
  /** Override the configured timelock id. `null` forces signaling-only. */
  timelockContractId?: string | null;
  executionWindow?: TimelockWindow;
  walletConnected?: boolean;
  walletAddress?: string | null;
  signTransaction?: SignTransaction;
  correctNetwork?: boolean;
  onTimelockAction?: (action: TimelockActionName) => Promise<TimelockCallResult>;
  actionPayload?: unknown;
};

export function CommunityProposalDetailView({
  communityId,
  proposalId,
  registry,
  getReader,
  timelockContractId,
  executionWindow,
  walletConnected,
  walletAddress,
  signTransaction,
  correctNetwork,
  onTimelockAction,
  actionPayload,
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
      timelockContractId={
        timelockContractId === undefined ? readTimelockContractId() : timelockContractId
      }
      executionWindow={executionWindow}
      walletConnected={walletConnected}
      walletAddress={walletAddress}
      signTransaction={signTransaction}
      correctNetwork={correctNetwork}
      onTimelockAction={onTimelockAction}
      actionPayload={actionPayload}
    />
  );
}

function CommunityProposalDetailPanel({
  community,
  proposalId,
  getReader,
  timelockContractId,
  executionWindow,
  walletConnected,
  walletAddress,
  signTransaction,
  correctNetwork,
  onTimelockAction,
  actionPayload,
}: {
  community: Community;
  proposalId: string;
  getReader?: ProposalReaderFactory;
  timelockContractId: string | null;
  executionWindow?: TimelockWindow;
  walletConnected?: boolean;
  walletAddress?: string | null;
  signTransaction?: SignTransaction;
  correctNetwork?: boolean;
  onTimelockAction?: (action: TimelockActionName) => Promise<TimelockCallResult>;
  actionPayload?: unknown;
}) {
  const resolution = useCommunityProposal(
    community.record.governorContract,
    proposalId,
    getReader,
  );
  const connected = walletConnected ?? Boolean(walletAddress);
  const networkOk = correctNetwork ?? true;
  const readsWindow =
    resolution.status === "ready" &&
    (resolution.state === ProposalState.Queued ||
      resolution.state === ProposalState.Expired);
  const { window: timelockWindow, error: windowError } = useTimelockWindow(
    readsWindow ? timelockContractId : null,
    proposalId,
    walletAddress ?? undefined,
    executionWindow,
  );

  const proposer = resolution.status === "ready" ? resolution.proposer : null;
  const isProposer = Boolean(
    walletAddress && proposer && walletAddress === proposer,
  );

  async function submit(action: TimelockActionName): Promise<TimelockCallResult> {
    const result = onTimelockAction
      ? await onTimelockAction(action)
      : !signTransaction || !walletAddress
        ? {
            ok: false as const,
            kind: "send_failed" as const,
            message: "Connect a wallet to continue.",
          }
        : await submitTimelockAction({
            action,
            contractId: timelockContractId,
            proposalIdHex: proposalId,
            publicKey: walletAddress,
            signTransaction,
          });
    if (result.ok && resolution.status === "ready") {
      resolution.refresh();
    }
    return result;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <CommunityBreadcrumbs
        communityId={community.record.id}
        communityName={community.metadata?.name ?? community.record.id}
        proposalId={proposalId}
      />
      <h1 className="mt-4 break-words text-2xl font-bold text-slate-100">
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
        <>
          <dl className="mt-6 grid gap-3 rounded-xl border border-slate-800 bg-[#151b2b] p-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">State</dt>
              <dd className="font-medium text-slate-100">
                {stateLabels[resolution.state]}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Community</dt>
              <dd className="break-words font-medium text-slate-100">
                {community.metadata?.name ?? community.record.id}
              </dd>
            </div>
          </dl>
          <ProposalActionPolicySummary
            actionPayload={actionPayload}
            timelockConfigured={Boolean(timelockContractId)}
            etaLedger={timelockWindow.etaLedger}
            expiresAtLedger={timelockWindow.expiresAtLedger}
          />
          <section className="mt-6 rounded-xl border border-slate-800 bg-[#151b2b] p-5">
            <h2 className="font-semibold text-slate-100">Votes</h2>
            {resolution.votes && !resolution.votes.error ? (
              <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                {(["for", "against", "abstain"] as const).map((choice) => (
                  <div key={choice}>
                    <dt className="capitalize text-slate-400">{choice}</dt>
                    <dd className="font-mono text-slate-100">{fmt(resolution.votes!.totals[choice])}</dd>
                  </div>
                ))}
              </dl>
            ) : <p className="mt-3 text-sm text-slate-400">Vote totals unavailable.</p>}
            <QuorumProgress
              totals={resolution.votes && !resolution.votes.error ? resolution.votes.totals : null}
              quorum={resolution.quorum}
              incomplete={resolution.votes?.incomplete}
            />
          </section>
          {windowError ? (
            <p role="alert" className="mt-4 text-sm text-rose-300">
              {windowError}
            </p>
          ) : null}
          <ProposalTimelockActions
            input={{
              state: resolution.state,
              timelockConfigured: Boolean(timelockContractId),
              etaLedger: timelockWindow.etaLedger,
              expiresAtLedger: timelockWindow.expiresAtLedger,
              currentLedger: timelockWindow.currentLedger,
              isProposer,
              walletConnected: connected,
              correctNetwork: networkOk,
            }}
            onSubmit={submit}
          />
        </>
      )}
    </div>
  );
}
