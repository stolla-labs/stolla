import type { ReactNode } from "react";

export type EmptyStateProps = {
  children?: ReactNode;
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
};

/** A completed, successful read with no matching records. */
export function EmptyState({
  children,
  title,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <section
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-5 text-sm text-slate-400 ${className}`}
    >
      {title && <h2 className="font-semibold text-slate-200">{title}</h2>}
      {children && <div className={title ? "mt-1" : undefined}>{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </section>
  );
}
