"use client";

import type { FreshnessResult } from "@/lib/proposal/freshness";

const STATE_STYLES: Record<
  FreshnessResult["state"],
  { className: string; icon: string }
> = {
  current: {
    className: "border-emerald-800/60 bg-emerald-950/40 text-emerald-200",
    icon: "\u2713",
  },
  delayed: {
    className: "border-amber-800/60 bg-amber-950/40 text-amber-200",
    icon: "\u25B2",
  },
  stale: {
    className: "border-amber-800/70 bg-amber-950/50 text-amber-200",
    icon: "\u25B2",
  },
  unavailable: {
    className: "border-rose-800/70 bg-rose-950/40 text-rose-200",
    icon: "\u2717",
  },
};

const EXPLANATION_URL =
  "https://github.com/stolla-labs/stolla/blob/main/docs/community-proposal-indexing.md#finality-freshness-and-caching";

export type DiscoveryFreshnessBannerProps = {
  freshness: FreshnessResult;
  /** When provided, render a retry button that calls this callback. */
  onRetry?: () => void;
  isRetrying?: boolean;
};

/**
 * Banner indicating the freshness of proposal discovery results.
 *
 * Renders nothing for the `current` state — users don't need to know
 * that everything is fine.  All other states show a banner with an
 * explanation, a link to documentation, and an optional retry action.
 */
export function DiscoveryFreshnessBanner({
  freshness,
  onRetry,
  isRetrying = false,
}: DiscoveryFreshnessBannerProps) {
  if (!freshness || freshness.state === "current") return null;

  const { className, icon } = STATE_STYLES[freshness.state];

  return (
    <div
      role="status"
      className={`mt-3 rounded-lg border p-4 text-sm ${className}`}
    >
      <p>
        <span aria-hidden="true">{icon} </span>
        {freshness.explanation}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <a
          href={EXPLANATION_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:no-underline"
        >
          Learn about proposal history limits
        </a>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="min-h-9 rounded-lg border border-current px-3 py-1.5 text-xs font-medium transition hover:bg-white/10 disabled:opacity-50"
          >
            {isRetrying ? "Retrying\u2026" : "Retry discovery"}
          </button>
        )}
      </div>
    </div>
  );
}
