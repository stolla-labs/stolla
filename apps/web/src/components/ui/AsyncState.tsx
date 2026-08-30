import type { ReactNode } from "react";

export type AsyncStateProps = {
  children: ReactNode;
  className?: string;
  busy?: boolean;
};

/** A non-interruptive live region for loading and refresh progress. */
export function AsyncState({
  children,
  className = "text-sm text-slate-400",
  busy = true,
}: AsyncStateProps) {
  return (
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy={busy}
      className={className}
    >
      {children}
    </p>
  );
}
