"use client";

import {
  decodeProposalActionPolicy,
  type ProposalActionBatchInput,
} from "@/lib/timelock/actionDecoder";

export function ProposalActionPolicyPanel({
  batch,
}: {
  batch?: ProposalActionBatchInput | null;
}) {
  const policy = decodeProposalActionPolicy(batch);

  return (
    <section
      aria-label="Proposal action policy"
      data-policy-mode={policy.mode}
      className="mt-6 rounded-xl border border-slate-800 bg-[#151b2b] p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-100">Action policy</h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            policy.hasWarning
              ? "border border-amber-700 bg-amber-950/60 text-amber-200"
              : policy.mode === "treasury"
                ? "border border-indigo-700 bg-indigo-950/60 text-indigo-200"
                : "border border-slate-700 bg-slate-900 text-slate-300"
          }`}
        >
          {policy.label}
        </span>
      </div>

      {(policy.etaLedger !== null || policy.expiresAtLedger !== null) && (
        <dl className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
          {policy.etaLedger !== null && (
            <div>
              <dt className="text-slate-500">Earliest execution (ETA ledger)</dt>
              <dd className="font-mono text-slate-200">{policy.etaLedger}</dd>
            </div>
          )}
          {policy.expiresAtLedger !== null && (
            <div>
              <dt className="text-slate-500">Execution expiry ledger</dt>
              <dd className="font-mono text-slate-200">
                {policy.expiresAtLedger}
              </dd>
            </div>
          )}
        </dl>
      )}

      <ul className="mt-4 space-y-3">
        {policy.actions.map((item, idx) => (
          <li
            key={`${item.kind}-${idx}`}
            className="rounded-lg border border-slate-800 bg-[#0b0f19] p-3 text-sm"
          >
            <p className="font-medium text-slate-100">{item.title}</p>
            <p className="mt-1 text-slate-300">{item.summary}</p>

            {item.kind === "treasury_spend" && (
              <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Asset</dt>
                  <dd className="break-all font-mono text-slate-200">
                    {item.asset}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Amount (raw units)</dt>
                  <dd className="font-mono text-slate-200">{item.amount}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Recipient</dt>
                  <dd className="break-all font-mono text-slate-200">
                    {item.recipient}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Target Treasury</dt>
                  <dd className="break-all font-mono text-slate-200">
                    {item.target}
                  </dd>
                </div>
              </dl>
            )}

            {item.kind === "unrecognized" && (
              <div
                role="alert"
                className="mt-3 rounded border border-amber-700/70 bg-amber-950/40 p-2.5 text-xs text-amber-200"
              >
                <p className="font-semibold">{item.warning}</p>
                <p className="mt-1 font-mono text-[11px] text-amber-100/90 break-all">
                  Target: {item.target} · Function: {item.functionName} · Args:{" "}
                  {item.rawArgsPreview}
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
