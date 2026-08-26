import React from 'react';
export type FreshnessState = "Current" | "Delayed" | "Stale" | "Unavailable";

export function FreshnessNotice({ state, onRetry }: { state: FreshnessState; onRetry?: () => void }) {
  if (state === "Current") return null;

  return (
    <div className="mt-4 p-4 border border-slate-700 bg-[#151b2b] rounded-lg text-sm text-slate-300">
      <p>
        <strong>Status: {state}</strong>
      </p>
      <p className="mt-1">
        Discovery may be delayed or partially incomplete due to RPC ledger retention.
        <a href="/docs/indexing" className="ml-2 underline text-indigo-400">Learn more</a>.
      </p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 text-indigo-400 hover:underline">
          Retry discovery
        </button>
      )}
    </div>
  );
}
