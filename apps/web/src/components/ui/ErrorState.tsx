import type { ReactNode } from "react";

export type ErrorStateProps = {
  title: ReactNode;
  children?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  retrying?: boolean;
  action?: ReactNode;
  className?: string;
};

/** A retryable or unavailable read announced as an error. */
export function ErrorState({
  title,
  children,
  onRetry,
  retryLabel = "Retry",
  retrying = false,
  action,
  className = "",
}: ErrorStateProps) {
  return (
    <section
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={`rounded-xl border border-rose-800/70 bg-rose-950/40 p-5 text-rose-200 ${className}`}
    >
      <h2 className="font-semibold text-rose-100">{title}</h2>
      {children && (
        <div className="mt-2 break-words text-sm [overflow-wrap:anywhere]">
          {children}
        </div>
      )}
      {(onRetry || action) && (
        <div className="mt-4 flex flex-wrap gap-3">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="min-h-11 rounded-lg border border-rose-700 px-4 py-2 text-sm font-medium text-rose-100 hover:bg-rose-900/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300 disabled:opacity-50"
            >
              {retrying ? "Retrying…" : retryLabel}
            </button>
          )}
          {action}
        </div>
      )}
    </section>
  );
}
