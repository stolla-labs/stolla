"use client";

import { describeProposeRejection } from "@/lib/proposeCooldown";

export type ProposeCooldownGuidanceProps = {
  remainingCooldownMs?: number;
  error?: unknown;
  proposalThreshold?: string;
};

export function ProposeCooldownGuidance({
  remainingCooldownMs = 0,
  error,
  proposalThreshold,
}: ProposeCooldownGuidanceProps) {
  const rejection = describeProposeRejection(error);
  const remainingSeconds = Math.ceil(Math.max(0, remainingCooldownMs) / 1000);

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs text-slate-400">
        Spam prevention: proposing requires delegated voting power meeting the{" "}
        {proposalThreshold
          ? `proposal threshold (${proposalThreshold})`
          : "community proposal threshold"}{" "}
        and respects a brief cooldown between submissions.
      </p>

      {remainingSeconds > 0 && (
        <div
          role="status"
          aria-live="polite"
          data-testid="propose-cooldown-banner"
          className="rounded-lg border border-amber-800/70 bg-amber-950/40 p-3 text-xs text-amber-200"
        >
          Proposal cooldown active: please wait {remainingSeconds}s before
          submitting another proposal.
        </div>
      )}

      {rejection && (
        <div
          role="alert"
          data-testid="propose-rejection-guidance"
          className="rounded-lg border border-rose-800/70 bg-rose-950/40 p-3 text-xs text-rose-200"
        >
          <p className="font-semibold text-rose-100">{rejection.title}</p>
          <p className="mt-1">{rejection.guidance}</p>
        </div>
      )}
    </div>
  );
}
