import type { ReactNode } from "react";

export type FreshnessNoticeProps = {
  children: ReactNode;
  title?: ReactNode;
  onRefresh?: () => void;
  refreshLabel?: string;
  refreshing?: boolean;
  className?: string;
};

/** Keeps partial or delayed data visible while clearly qualifying freshness. */
export function FreshnessNotice({
  children,
  title,
  onRefresh,
  refreshLabel = "Refresh",
  refreshing = false,
  className = "",
}: FreshnessNoticeProps) {
  return (
    <section
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`rounded-lg border border-amber-800/70 bg-amber-950/40 p-4 text-sm text-amber-200 ${className}`}
    >
      {title && <h2 className="font-semibold text-amber-100">{title}</h2>}
      <div className={title ? "mt-1" : undefined}>{children}</div>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="mt-3 min-h-11 rounded-lg border border-amber-700 px-4 py-2 font-medium text-amber-100 hover:bg-amber-900/50 disabled:opacity-50"
        >
          {refreshing ? "Refreshing…" : refreshLabel}
        </button>
      )}
    </section>
  );
}
