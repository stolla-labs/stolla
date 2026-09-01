"use client";

import { AppButton } from "@/components/ui/AppButton";
import { LiveStatus } from "@/components/ui/LiveStatus";
import { TransactionLifecycleStatus } from "@/components/TransactionLifecycleStatus";
import { useParticipationReadiness } from "@/hooks/useParticipationReadiness";

type Condition = {
  label: string;
  met: boolean;
  action?: React.ReactNode;
  statusWhenLoading?: boolean;
};

function statusIcon(isMet: boolean, isLoading: boolean): string {
  if (isLoading) return "⋯";
  return isMet ? "✓" : "○";
}

function ChecklistRow({
  label,
  isMet,
  isLoading,
  action,
}: {
  label: string;
  isMet: boolean;
  isLoading: boolean;
  action?: React.ReactNode;
}) {
  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
            isMet
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-slate-700/50 text-slate-400"
          }`}
        >
          {statusIcon(isMet, isLoading)}
        </span>
        <div>
          <p className="text-sm font-medium text-slate-200">{label}</p>
          <LiveStatus className="text-xs">
            {isLoading ? "Checking…" : isMet ? "Ready" : "Action needed"}
          </LiveStatus>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </li>
  );
}

export type ParticipationReadinessChecklistProps = {
  nftContractId: string;
};

/**
 * Read-only checklist that surfaces whether a member is ready to vote in a
 * Community: wallet connection, network, NFT membership, self-delegation, and
 * voting power. Each unmet condition exposes at most one primary recovery
 * action.
 */
export function ParticipationReadinessChecklist({
  nftContractId,
}: ParticipationReadinessChecklistProps) {
  const readiness = useParticipationReadiness(nftContractId);

  const isPastWalletGate =
    readiness.status !== "disconnected" && readiness.status !== "wrong_network";
  const isLoading = readiness.status === "loading";

  const conditions: Condition[] = [
    {
      label: "Wallet connected",
      met: readiness.status !== "disconnected",
      action:
        readiness.status === "disconnected" ? (
          <AppButton
            tone="primary"
            size="sm"
            onClick={() => void readiness.connect?.()}
            disabled={readiness.isActionInFlight}
          >
            Connect wallet
          </AppButton>
        ) : undefined,
    },
    {
      label: "Correct network",
      met:
        readiness.status !== "disconnected" &&
        readiness.status !== "wrong_network",
      action:
        readiness.status === "wrong_network" ? (
          <span className="text-xs text-amber-200">
            Switch network in wallet
          </span>
        ) : undefined,
    },
    {
      label: "Membership NFT",
      met:
        isPastWalletGate &&
        readiness.status !== "non_member" &&
        readiness.status !== "loading" &&
        readiness.status !== "read_error",
      statusWhenLoading: true,
      action:
        readiness.status === "non_member" ? (
          <AppButton
            tone="primary"
            size="sm"
            onClick={() => void readiness.mint()}
            disabled={readiness.isActionInFlight}
          >
            Mint NFT
          </AppButton>
        ) : undefined,
    },
    {
      label: "Voting power delegated",
      met:
        isPastWalletGate &&
        readiness.status !== "non_member" &&
        readiness.status !== "undelegated" &&
        readiness.status !== "loading" &&
        readiness.status !== "read_error",
      statusWhenLoading: true,
      action:
        readiness.status === "undelegated" ? (
          <AppButton
            tone="primary"
            size="sm"
            onClick={() => void readiness.delegate()}
            disabled={readiness.isActionInFlight}
          >
            Delegate
          </AppButton>
        ) : undefined,
    },
    {
      label: "Voting power active",
      met: readiness.status === "ready",
      statusWhenLoading: true,
      action:
        readiness.status === "zero_power" ? (
          <span className="text-xs text-slate-400">No action available</span>
        ) : undefined,
    },
  ];

  const activeStage =
    readiness.status === "non_member"
      ? readiness.mintStage
      : readiness.status === "undelegated"
        ? readiness.delegateStage
        : "idle";

  return (
    <section
      aria-labelledby="participation-readiness-title"
      className="mt-6 rounded-xl border border-slate-800 bg-[#151b2b] p-5"
    >
      <h2
        id="participation-readiness-title"
        className="font-semibold text-slate-100"
      >
        Participation readiness
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        Everything needed to vote in this community.
      </p>

      <ul className="mt-4 divide-y divide-slate-800/60">
        {conditions.map((condition) => (
          <ChecklistRow
            key={condition.label}
            label={condition.label}
            isMet={condition.met}
            isLoading={isLoading && Boolean(condition.statusWhenLoading)}
            action={condition.action}
          />
        ))}
      </ul>

      {readiness.status === "read_error" && (
        <div className="mt-4 rounded-lg border border-rose-800/70 bg-rose-950/40 p-3">
          <p className="text-sm text-rose-200">{readiness.readError}</p>
          <AppButton
            tone="danger"
            size="sm"
            onClick={() => void readiness.refresh()}
            className="mt-2"
            disabled={readiness.isActionInFlight}
          >
            Retry
          </AppButton>
        </div>
      )}

      {readiness.status === "ready" ? (
        <p className="mt-4 text-sm text-emerald-300">{readiness.summary}</p>
      ) : readiness.status !== "read_error" && readiness.summary ? (
        <p className="mt-4 text-sm text-slate-300">{readiness.summary}</p>
      ) : null}

      <TransactionLifecycleStatus
        stage={activeStage}
        operationLabel={
          readiness.status === "non_member" ? "Mint" : "Delegate"
        }
        error={readiness.actionError}
      />
    </section>
  );
}
