"use client";

import type { PartialHistoryState } from "@/lib/proposal-index/hydrate";

export type PartialHistoryNoticeProps = {
  state: PartialHistoryState;
  onRetry?: () => void;
  isRetrying?: boolean;
};

/**
 * Actionable notice when proposal history is only partly available.
 * The surrounding page keeps any proposals it already has.
 */
export function PartialHistoryNotice({
  state,
  onRetry,
  isRetrying = false,
}: PartialHistoryNoticeProps) {
  return (
    <section
      role="status"
      aria-live="polite"
      className="mt-3 rounded-lg border border-amber-800/70 bg-amber-950/40 p-4 text-sm text-amber-100"
    >
      <h2 className="text-base font-semibold text-amber-50">{state.title}</h2>
      <p className="mt-1 break-words text-amber-100/90">{state.message}</p>
      <p className="mt-2 break-words text-amber-100/80">{state.action}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="shell-disabled-action inline-flex min-h-11 items-center justify-center rounded-lg border border-amber-600 px-4 py-2 text-sm font-medium text-amber-50 hover:bg-amber-900/40"
          >
            {isRetrying ? "Retrying…" : "Retry proposal index"}
          </button>
        )}
        <a
          href="https://github.com/stolla-labs/stolla/blob/main/docs/community-proposal-indexing.md#implementation-boundary-issue-344"
          className="inline-flex min-h-11 items-center text-sm font-medium text-amber-200 underline underline-offset-2 hover:text-amber-50"
        >
          Read the indexer boundary
        </a>
      </div>
    </section>
  );
}
