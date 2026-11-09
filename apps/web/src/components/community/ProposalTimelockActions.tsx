import { lookupTransactionErrorCatalog } from "@/lib/transactionErrors";
"use client";

import { useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import type { TimelockCallResult } from "@/lib/timelock/client";
import {
  deriveProposalExecution,
  type ProposalExecutionInput,
  type ProposalExecutionView,
  type TimelockActionName,
} from "@/lib/timelock/proposalExecution";

export type ProposalTimelockActionsProps = {
  input: ProposalExecutionInput;
  onSubmit: (action: TimelockActionName) => Promise<TimelockCallResult>;
};

const ACTION_LABEL: Record<TimelockActionName, string> = {
  queue: "Queue",
  execute: "Execute",
  cancel: "Cancel",
};

function ActionButton({
  label,
  tone,
  disabled,
  pending,
  reason,
  onClick,
}: {
  label: string;
  tone: "primary" | "danger" | "secondary";
  disabled: boolean;
  pending: boolean;
  reason: string | null;
  onClick: () => void;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto">
      <AppButton
        tone={tone}
        className="w-full sm:w-auto"
        disabled={disabled || pending}
        aria-busy={pending}
        title={reason ?? undefined}
        onClick={onClick}
      >
        {label}
      </AppButton>
      {reason ? (
        <p className="max-w-xs text-xs text-slate-400 sm:max-w-sm">{reason}</p>
      ) : null}
    </div>
  );
}

export function ProposalTimelockActions({
  input,
  onSubmit,
}: ProposalTimelockActionsProps) {
  const view: ProposalExecutionView = deriveProposalExecution(input);
  const [draftAction, setDraftAction] = useState<TimelockActionName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (view.phase === "idle") return null;

  async function submit(action: TimelockActionName) {
    setDraftAction(action);
    setPending(true);
    try {
      const result = await onSubmit(action);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      setDraftAction(null);
    } catch (submitError: unknown) {
      setError(lookupTransactionErrorCatalog(submitError, "timelock").body);
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-label="Timelock execution"
      data-phase={view.phase}
      className="mt-6 w-full min-w-0 rounded-xl border border-slate-800 bg-[#151b2b] p-4 sm:p-5"
    >
      <h2 className="text-base font-semibold text-slate-100">Timelock execution</h2>
      {view.statusMessage ? (
        <p className="mt-2 text-sm text-slate-300">{view.statusMessage}</p>
      ) : null}
      {view.delayPreview ? (
        <p className="mt-2 text-sm text-slate-400">{view.delayPreview}</p>
      ) : null}
      {(view.earliestExecution || view.expiry) && (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          {view.earliestExecution ? (
            <div className="min-w-0">
              <dt className="text-slate-500">Earliest execution</dt>
              <dd className="break-words font-medium text-slate-100">
                {view.earliestExecution}
              </dd>
            </div>
          ) : null}
          {view.expiry ? (
            <div className="min-w-0">
              <dt className="text-slate-500">Expiry</dt>
              <dd className="break-words font-medium text-slate-100">{view.expiry}</dd>
            </div>
          ) : null}
        </dl>
      )}
      {view.assumptionNote ? (
        <p className="mt-2 text-xs text-slate-500">{view.assumptionNote}</p>
      ) : null}
      {(view.queue.visible || view.execute.visible || view.cancel.visible) && (
        <div className="mt-4 flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap">
          {view.queue.visible ? (
            <ActionButton
              label={ACTION_LABEL.queue}
              tone="primary"
              disabled={view.queue.disabled}
              pending={pending}
              reason={view.queue.reason}
              onClick={() => void submit("queue")}
            />
          ) : null}
          {view.execute.visible ? (
            <ActionButton
              label={ACTION_LABEL.execute}
              tone="primary"
              disabled={view.execute.disabled}
              pending={pending}
              reason={view.execute.reason}
              onClick={() => void submit("execute")}
            />
          ) : null}
          {view.cancel.visible ? (
            <ActionButton
              label={ACTION_LABEL.cancel}
              tone="danger"
              disabled={view.cancel.disabled}
              pending={pending}
              reason={view.cancel.reason}
              onClick={() => void submit("cancel")}
            />
          ) : null}
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-3 break-words text-sm text-rose-300">
          {error}
        </p>
      ) : null}
      {draftAction && error ? (
        <p className="mt-1 text-sm text-slate-300">Draft kept: {draftAction}</p>
      ) : null}
    </section>
  );
}
