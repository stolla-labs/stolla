"use client";

import {
  decodeProposalActionPolicy,
  type DecodeActionPolicyOptions,
} from "@/lib/proposals/actionPolicy";

export type ProposalActionPolicySummaryProps = DecodeActionPolicyOptions & {
  actionPayload?: unknown;
};

export function ProposalActionPolicySummary({
  actionPayload,
  timelockConfigured,
  etaLedger,
  expiresAtLedger,
}: ProposalActionPolicySummaryProps) {
  const decoded = decodeProposalActionPolicy(actionPayload, {
    timelockConfigured,
    etaLedger,
    expiresAtLedger,
  });

  const badgeTone =
    decoded.kind === "signaling"
      ? "border-slate-700 bg-slate-800/80 text-slate-200"
      : decoded.kind === "treasury_spend"
        ? "border-indigo-700/70 bg-indigo-950/60 text-indigo-200"
        : decoded.kind === "custom_call"
          ? "border-amber-700/70 bg-amber-950/60 text-amber-200"
          : "border-rose-700/80 bg-rose-950/60 text-rose-200";

  return (
    <section
      aria-label="Proposal action policy"
      data-testid="proposal-action-policy"
      className="mt-6 rounded-xl border border-slate-800 bg-[#151b2b] p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-100">Action policy</h2>
        <span
          data-testid="proposal-action-policy-badge"
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeTone}`}
        >
          {decoded.badge}
        </span>
      </div>

      <p className="mt-2 text-sm text-slate-300">{decoded.summary}</p>

      {decoded.kind === "treasury_spend" && (
        <dl className="mt-3 grid gap-2 rounded-lg border border-slate-800 bg-[#0d1322] p-3 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Asset</dt>
            <dd className="font-mono font-semibold text-slate-100">
              {decoded.fields.asset}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Amount</dt>
            <dd className="font-mono font-semibold text-slate-100">
              {decoded.fields.amount}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Recipient</dt>
            <dd className="break-all font-mono text-slate-200">
              {decoded.fields.recipient}
            </dd>
          </div>
          {decoded.fields.target && (
            <div className="sm:col-span-3">
              <dt className="text-slate-500">Target contract</dt>
              <dd className="break-all font-mono text-slate-300">
                {decoded.fields.target}
              </dd>
            </div>
          )}
          {typeof decoded.fields.etaLedger === "number" && (
            <div>
              <dt className="text-slate-500">Earliest execution (ETA)</dt>
              <dd className="font-mono text-slate-200">
                Ledger {decoded.fields.etaLedger}
              </dd>
            </div>
          )}
          {typeof decoded.fields.expiresAtLedger === "number" && (
            <div>
              <dt className="text-slate-500">Execution expiry</dt>
              <dd className="font-mono text-slate-200">
                Ledger {decoded.fields.expiresAtLedger}
              </dd>
            </div>
          )}
        </dl>
      )}

      {decoded.kind === "custom_call" && (
        <dl className="mt-3 grid gap-2 rounded-lg border border-slate-800 bg-[#0d1322] p-3 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Target contract</dt>
            <dd className="break-all font-mono text-slate-200">
              {decoded.fields.target}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Function</dt>
            <dd className="font-mono text-slate-200">
              {decoded.fields.functionName}
            </dd>
          </div>
        </dl>
      )}

      {decoded.warning && (
        <p
          role="alert"
          data-testid="proposal-action-policy-warning"
          className="mt-3 rounded-lg border border-amber-800/70 bg-amber-950/40 p-3 text-xs text-amber-200"
        >
          {decoded.warning}
        </p>
      )}
    </section>
  );
}
