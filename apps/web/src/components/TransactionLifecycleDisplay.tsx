"use client";

import { type TransactionStage } from "@/hooks/useTransactionLifecycle";
import { LiveStatus } from "@/components/ui/LiveStatus";

export type TransactionAction = "vote" | "cancel" | "execute";

/**
 * Maps each lifecycle stage to a display label.
 */
const STAGE_LABELS: Record<TransactionStage, string> = {
  idle: "Ready",
  simulating: "Simulating transaction…",
  wallet_approval: "Waiting for wallet approval…",
  submitting: "Submitting to network…",
  confirming: "Confirming on ledger…",
  confirmed: "Transaction confirmed!",
  wallet_rejected: "Wallet rejected",
  simulation_failed: "Simulation failed",
  submission_failed: "Submission failed",
  duplicate_vote: "Already voted",
};

/**
 * Maps each lifecycle stage to a colour class.
 */
const STAGE_COLORS: Record<TransactionStage, string> = {
  idle: "bg-slate-600",
  simulating: "bg-blue-500",
  wallet_approval: "bg-amber-500",
  submitting: "bg-indigo-500",
  confirming: "bg-violet-500",
  confirmed: "bg-emerald-500",
  wallet_rejected: "bg-rose-500",
  simulation_failed: "bg-rose-500",
  submission_failed: "bg-rose-500",
  duplicate_vote: "bg-amber-500",
};

const FAILURE_STAGES = new Set<TransactionStage>(['
  "wallet_rejected",
  "simulation_failed",
  "submission_failed",
  "duplicate_vote",
]);

const ACTION_LABELS: Record<TransactionAction, string> = {
  vote: "Vote",
  cancel: "Cancel",
  execute: "Execute",
};

function lifecycleAnnouncement(
  stage: TransactionStage,
  error: string | null,
  action: TransactionAction,
) {
  const actionLabel = ACTION_LABELS[action];
  switch (stage) {
    case "confirmed":
      return `${actionLabel} successfully submitted and confirmed.`;
    case "wallet_rejected":
      return `Wallet rejected the transaction. Your ${actionLabel.toLowerCase()} was not submitted.`;
    case "duplicate_vote":
      return "You have already voted on this proposal.";
    case "submission_failed":
      return `${actionLabel} submission failed: ${error ?? "unknown error"}. You can retry.`;
    case "simulation_failed":
      return `Transaction simulation failed: ${error ?? "unknown error"}.`;
    default:
      return `Transaction update: ${STAGE_LABELS[stage]}`;
  }
}

/**
 * Icons for each stage.
 */
function StageIcon({ stage }: { stage: TransactionStage }) {
  switch (stage) {
    case "confirmed":
      return (
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
            clipRule="evenodd"
          />
        </svg>
      );
    case "wallet_rejected":
    case "simulation_failed":
    case "submission_failed":
      return (
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      );
    case "duplicate_vote":
      return (
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      );
    case "simulating":
    case "wallet_approval":
    case "submitting":
    case "confirming":
      return (
        <svg
          className="h-5 w-5 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      );
    default:
      return null;
  }
}

/**
 * Vote type labels for display.
 */
const VOTE_TYPE_LABELS: Record<number, string> = {
  0: "Against",
  1: "For",
  2: "Abstain",
};

const VOTE_TYPE_COLORS: Record<number, string> = {
  0: "text-rose-400",
  1: "text-emerald-400",
  2: "text-slate-400",
};

type TransactionLifecycleDisplayProps = {
  stage: TransactionStage;
  action?: TransactionAction;
  voteType: number | null;
  reason: string;
  error: string | null;
  isTerminal: boolean;
};

/**
 * Displays the transaction lifecycle with stage indicator, action details,
 * and accessible announcements.
 */
export function TransactionLifecycleDisplay({
  stage,
  action = "vote",
  voteType,
  reason,
  error,
  isTerminal,
}: TransactionLifecycleDisplayProps) {
  if (stage === "idle") return null;

  const colorClass = STAGE_COLORS[stage];
  const label = STAGE_LABELS[stage];
  const isActive = !isTerminal;
  const isFailure = FAILURE_STAGES.has(stage);
  const showVoteDetails = action === "vote" && voteType !== null;

  return (
    <div
      className="mt-4 rounded-xl border border-slate-800 bg-[#151b2b] p-5"
      aria-label={`Transaction status: ${label}`}
    >
      {/* Stage indicator */}
      <div className="flex items-center gap-3">
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${colorClass} text-white`}>
          <StageIcon stage={stage} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-100">{label}</p>
          {isActive && (
            <p className="mt-1 text-xs text-slate-400">Please wait…</p>
          )}
        </div>
      </div>

      {/* Vote details visible during pending */}
      {showVoteDetails && (
        <div className="mt-4 rounded-lg border border-slate-700 bg-[#0b0f19] p-3">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Vote</dt>
              <dd className={`font-medium ${VOTE_TYPE_COLORS[voteType] ?? "text-slate-200"}`}>
                {VOTE_TYPE_LABELS[voteType] ?? "Unknown"}
              </dd>
            </div>
            {reason && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Reason</dt>
                <dd className="text-slate-300">{reason}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Error display */}
      {error && (
        <p className="mt-3 text-sm text-rose-400">
          {error}
        </p>
      )}

      <LiveStatus tone={isFailure ? "error" : "routine"} className="sr-only">
        {lifecycleAnnouncement(stage, error, action)}
      </LiveStatus>
    </div>
  );
}
