import type { ReactNode } from "react";
import { AsyncState } from "@/components/ui/AsyncState";
import { OnChainIdentifier } from "@/components/ui/OnChainIdentifier";
import {
  decodeProposalActions,
  type DecodedProposalAction,
  type ProposalActionContext,
} from "@/lib/proposal-actions/decode";
import type { ProposalActionRecordResolution } from "@/lib/proposal-actions/useProposalActionRecord";
import { fmt } from "@/lib/voteDisplay";

export const SIGNALING_NO_CUSTODY_MESSAGE =
  "Signaling only / no custody move. This proposal has no on-chain actions, so passing it moves no funds.";

export type ProposalActionsPanelProps = {
  resolution: ProposalActionRecordResolution;
  context?: ProposalActionContext;
};

const SECTION_CLASS =
  "mt-6 w-full min-w-0 rounded-xl border border-slate-800 bg-[#151b2b] p-4 sm:p-5";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="break-words font-medium text-slate-100">{children}</dd>
    </div>
  );
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="mt-3 rounded-lg border border-rose-800/70 bg-rose-950/40 p-3 text-sm text-rose-200"
    >
      {children}
    </p>
  );
}

function ActionItem({ action }: { action: DecodedProposalAction }) {
  if (action.kind === "unrecognized") {
    return (
      <li className="rounded-lg border border-rose-800/70 bg-rose-950/20 p-4">
        <h3 className="font-semibold text-rose-100">Unrecognized action</h3>
        <p className="mt-1 text-sm text-rose-200">
          Not a known Stolla action. Do not treat it as a safe transfer.{" "}
          {action.reason}
        </p>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <Field label="Target">
            <OnChainIdentifier label="Action target" value={action.target} kind="contract" />
          </Field>
          <Field label="Function">
            <span className="font-mono">{action.functionName}</span>
          </Field>
          <Field label="Arguments">{action.argCount}</Field>
        </dl>
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-slate-700 p-4">
      <h3 className="font-semibold text-slate-100">Treasury payment</h3>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <Field label="Asset">
          <OnChainIdentifier label="Asset contract" value={action.asset} kind="contract" />
        </Field>
        <Field label="Amount (raw units)">
          <span className="font-mono">{fmt(action.amount)}</span>
        </Field>
        <Field label="Recipient">
          <OnChainIdentifier label="Recipient" value={action.recipient} kind="account" />
        </Field>
        <Field label="Treasury target">
          <OnChainIdentifier label="Treasury target" value={action.target} kind="contract" />
        </Field>
        {action.reference ? (
          <Field label="Reference">
            <span className="break-all font-mono text-xs">{action.reference}</span>
          </Field>
        ) : null}
      </dl>
      {action.targetVerified ? null : (
        <p className="mt-3 text-xs text-amber-300">
          The target could not be verified as this community&apos;s Treasury.
        </p>
      )}
    </li>
  );
}

/** Human-readable summary of what a proposal would do if it executes. */
export function ProposalActionsPanel({ resolution, context }: ProposalActionsPanelProps) {
  if (resolution.status === "loading") {
    return (
      <section aria-label="Proposal actions" className={SECTION_CLASS}>
        <AsyncState className="text-sm text-slate-400">Loading proposal actions…</AsyncState>
      </section>
    );
  }

  const heading = <h2 className="text-base font-semibold text-slate-100">Proposal actions</h2>;

  if (resolution.status === "error" || resolution.record === null) {
    return (
      <section aria-label="Proposal actions" className={SECTION_CLASS}>
        {heading}
        <Warning>
          Actions could not be loaded
          {resolution.status === "error" ? `: ${resolution.error}` : " from the available event history"}
          . Do not assume this proposal is signaling-only or safe.
        </Warning>
      </section>
    );
  }

  const decoded = decodeProposalActions(resolution.record, context);

  if (decoded.kind === "signaling") {
    return (
      <section aria-label="Proposal actions" data-kind="signaling" className={SECTION_CLASS}>
        {heading}
        <p className="mt-2 text-sm text-slate-300">{SIGNALING_NO_CUSTODY_MESSAGE}</p>
      </section>
    );
  }

  if (decoded.kind === "malformed") {
    return (
      <section aria-label="Proposal actions" data-kind="malformed" className={SECTION_CLASS}>
        {heading}
        <Warning>
          Unrecognized action record. {decoded.reason} Do not treat this proposal as a safe
          transfer.
        </Warning>
      </section>
    );
  }

  const hasUnrecognized = decoded.actions.some((action) => action.kind === "unrecognized");
  return (
    <section aria-label="Proposal actions" data-kind="actions" className={SECTION_CLASS}>
      {heading}
      <p className="mt-2 text-sm text-slate-300">
        If this proposal passes, these calls run in order.
      </p>
      {hasUnrecognized ? (
        <Warning>
          This proposal includes unrecognized actions. Review them carefully before voting.
        </Warning>
      ) : null}
      <ol className="mt-4 flex flex-col gap-3">
        {decoded.actions.map((action, index) => (
          <ActionItem key={index} action={action} />
        ))}
      </ol>
    </section>
  );
}
