"use client";

import { LiveStatus } from "@/components/ui/LiveStatus";
import {
  isPendingTransactionLifecycleStage,
  resolveTransactionLifecycleStage,
  TRANSACTION_LIFECYCLE_LABELS,
  type TransactionLifecycleMetadata,
  type TransactionLifecycleStage,
} from "@/lib/transactionLifecycle";
import {
  buildStellarExplorerTxUrl,
  resolveStellarNetworkId,
} from "@/lib/stellarExplorer";

const STAGE_COLORS: Record<TransactionLifecycleStage, string> = {
  idle: "bg-slate-600",
  simulating: "bg-blue-500",
  awaiting_approval: "bg-amber-500",
  submitting: "bg-indigo-500",
  confirming: "bg-violet-500",
  success: "bg-emerald-500",
  failure: "bg-rose-500",
};

const STAGE_MARKERS: Record<TransactionLifecycleStage, string> = {
  idle: "Idle",
  simulating: "Pending",
  awaiting_approval: "Pending",
  submitting: "Pending",
  confirming: "Pending",
  success: "Success",
  failure: "Failed",
};

function StageIcon({ stage }: { stage: TransactionLifecycleStage }) {
  switch (stage) {
    case "success":
      return (
        <svg
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
            clipRule="evenodd"
          />
        </svg>
      );
    case "failure":
      return (
        <svg
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      );
    case "simulating":
    case "awaiting_approval":
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

function announcementFor(
  stage: TransactionLifecycleStage,
  operationLabel: string,
  error: string | null | undefined,
): string {
  switch (stage) {
    case "success":
      return `${operationLabel} confirmed successfully.`;
    case "failure":
      return `${operationLabel} failed${error ? `: ${error}` : ""}.`;
    case "idle":
      return `${operationLabel} ready.`;
    default:
      return `${operationLabel} update: ${TRANSACTION_LIFECYCLE_LABELS[stage]}`;
  }
}

export type TransactionLifecycleStatusProps = {
  stage: TransactionLifecycleStage | string;
  /** Concise label for the operation, e.g. "Mint", "Delegate", "Vote". */
  operationLabel?: string;
  error?: string | null;
  diagnostic?: string | null;
  metadata?: TransactionLifecycleMetadata;
  /** When false, idle still renders a compact ready state (default: hide idle). */
  showIdle?: boolean;
};

/**
 * Reusable transaction lifecycle status for any on-chain operation.
 */
export function TransactionLifecycleStatus({
  stage: rawStage,
  operationLabel = "Transaction",
  error = null,
  diagnostic = null,
  metadata,
  showIdle = false,
}: TransactionLifecycleStatusProps) {
  const stage = resolveTransactionLifecycleStage(rawStage);
  if (stage === "idle" && !showIdle) return null;

  const label =
    stage === "success"
      ? `${operationLabel} confirmed`
      : stage === "failure"
        ? `${operationLabel} failed`
        : TRANSACTION_LIFECYCLE_LABELS[stage];
  const isPending = isPendingTransactionLifecycleStage(stage);
  const isFailure = stage === "failure";
  const details = metadata?.details ?? [];
  const transactionHash = metadata?.transactionHash ?? null;
  const explorerUrl =
    stage === "success"
      ? buildStellarExplorerTxUrl(transactionHash, resolveStellarNetworkId())
      : null;

  return (
    <div
      className="mt-4 w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-800 bg-[#151b2b] p-4 sm:p-5"
      aria-label={`${operationLabel} status: ${label}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${STAGE_COLORS[stage]} text-white`}
        >
          <StageIcon stage={stage} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="min-w-0 break-words text-sm font-medium text-slate-100 [overflow-wrap:anywhere]">
              {label}
            </p>
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                isFailure
                  ? "bg-rose-950 text-rose-200 ring-1 ring-rose-700"
                  : stage === "success"
                    ? "bg-emerald-950 text-emerald-200 ring-1 ring-emerald-700"
                    : isPending
                      ? "bg-slate-900 text-slate-300 ring-1 ring-slate-600"
                      : "bg-slate-900 text-slate-400 ring-1 ring-slate-700"
              }`}
            >
              {STAGE_MARKERS[stage]}
            </span>
          </div>
          {isPending && (
            <p className="mt-1 text-xs text-slate-400">Please wait…</p>
          )}
          {error && (
            <p className="mt-2 min-w-0 break-words text-sm text-rose-400 [overflow-wrap:anywhere]">
              {error}
            </p>
          )}
          {isFailure && diagnostic && (
            <details className="mt-2 text-xs text-slate-400">
              <summary className="cursor-pointer select-none font-medium text-slate-300">
                Technical details
              </summary>
              <pre className="mt-1 overflow-x-auto rounded border border-slate-800 bg-[#0b0f19] p-2 font-mono text-[11px] text-slate-300 whitespace-pre-wrap">
                {diagnostic}
              </pre>
            </details>
          )}
        </div>
      </div>

      {(details.length > 0 || transactionHash || explorerUrl) && (
        <dl className="mt-4 min-w-0 space-y-1 rounded-lg border border-slate-700 bg-[#0b0f19] p-3 text-sm">
          {details.map((detail) => (
            <div
              key={`${detail.label}:${detail.value}`}
              className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-3"
            >
              <dt className="shrink-0 text-slate-500">{detail.label}</dt>
              <dd className="min-w-0 break-words text-slate-300 [overflow-wrap:anywhere] sm:text-right">
                {detail.value}
              </dd>
            </div>
          ))}
          {transactionHash && (
            <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-3">
              <dt className="shrink-0 text-slate-500">Transaction</dt>
              <dd
                className="min-w-0 break-all font-mono text-xs text-slate-300 [overflow-wrap:anywhere] sm:text-right"
                title={transactionHash}
              >
                {transactionHash}
              </dd>
            </div>
          )}
          {explorerUrl && (
            <div className="pt-2">
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center text-sm font-medium text-indigo-300 underline-offset-2 hover:text-indigo-200 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
              >
                View on Stellar Expert
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>
          )}
        </dl>
      )}

      <LiveStatus tone={isFailure ? "error" : "routine"} className="sr-only">
        {announcementFor(stage, operationLabel, error)}
      </LiveStatus>
    </div>
  );
}
