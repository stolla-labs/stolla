"use client";

import { truncateMiddle } from "@/lib/truncate";
import {
  calculateVotingPowerComposition,
  type CalculateVotingPowerInput,
  type VotingPowerComposition,
} from "@/lib/voting-power";

export type VotingPowerCompositionDisplayProps = {
  account: string | null | undefined;
  balance: number | bigint | null | undefined;
  totalVotes: number | bigint | string | null | undefined;
  delegate?: string | null | undefined;
  isLoading?: boolean;
  className?: string;
};

export function VotingPowerCompositionDisplay({
  account,
  balance,
  totalVotes,
  delegate,
  isLoading = false,
  className = "",
}: VotingPowerCompositionDisplayProps) {
  // Acceptance criteria: Disconnected users do not see fabricated breakdowns
  if (!account) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={`text-xs text-slate-500 animate-pulse ${className}`} role="status">
        Loading voting power composition…
      </div>
    );
  }

  const composition: VotingPowerComposition = calculateVotingPowerComposition({
    account,
    balance,
    totalVotes,
    delegate,
  });

  return (
    <div
      role="group"
      aria-label="Voting power breakdown"
      className={`mt-2 rounded-lg border border-slate-800 bg-[#0d1322] p-3 text-xs text-slate-300 ${className}`}
    >
      <div className="flex items-center justify-between font-medium text-slate-200 border-b border-slate-800/80 pb-2">
        <span>Total voting power</span>
        <span className="font-mono font-semibold text-slate-100">
          {composition.totalVotes.toString()}
        </span>
      </div>

      <div className="mt-2 space-y-1.5 pt-0.5">
        <div className="flex items-center justify-between text-slate-400">
          <span>Own tokens (self-delegated)</span>
          <span className="font-mono text-slate-200">
            {composition.selfVotes.toString()}
          </span>
        </div>

        <div className="flex items-center justify-between text-slate-400">
          <span>Received from others (delegated-in)</span>
          <span className="font-mono text-slate-200">
            {composition.delegatedIn.toString()}
          </span>
        </div>

        {composition.delegatedOut > 0n && (
          <div className="flex items-center justify-between text-amber-400/90 pt-1 border-t border-slate-800/50">
            <span>
              Delegated to{" "}
              {composition.delegateAddress
                ? truncateMiddle(composition.delegateAddress, 6, 4)
                : "another account"}
            </span>
            <span className="font-mono">{composition.delegatedOut.toString()}</span>
          </div>
        )}

        {composition.undelegated > 0n && (
          <div className="mt-2 rounded bg-amber-950/30 border border-amber-900/40 p-2 text-[11px] text-amber-300/90">
            <strong>Note:</strong> {composition.undelegated.toString()} token
            {composition.undelegated === 1n ? "" : "s"} held without delegation.
            Undelegated tokens do not count toward voting power.
          </div>
        )}
      </div>
    </div>
  );
}
