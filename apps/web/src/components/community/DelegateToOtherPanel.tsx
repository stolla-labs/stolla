"use client";

import { useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import {
  clearRecentDelegates,
  loadRecentDelegates,
  rememberRecentDelegate,
  validateDelegatee,
} from "@/lib/community/recent-delegates";

export type DelegateToOtherPanelProps = {
  account: string | null | undefined;
  currentDelegate: string | null | undefined;
  balance: number | bigint | null | undefined;
  /** Resolves true when the delegation was confirmed on-chain. */
  onDelegate: (delegatee: string) => Promise<boolean>;
  disabled?: boolean;
  className?: string;
};

export function DelegateToOtherPanel({
  account,
  currentDelegate,
  balance,
  onDelegate,
  disabled = false,
  className = "",
}: DelegateToOtherPanelProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recent, setRecent] = useState<string[]>(() => loadRecentDelegates());

  const visibleRecent = recent.filter(
    (entry) => entry !== account && entry !== currentDelegate,
  );

  function handleReview() {
    const candidate = input.trim();
    const validationError = validateDelegatee(candidate, account, currentDelegate);
    setError(validationError);
    setPending(validationError ? null : candidate);
  }

  async function handleConfirm() {
    if (!pending || submitting) return;
    // Re-validate so a stale summary can never reach the wallet.
    const validationError = validateDelegatee(pending, account, currentDelegate);
    if (validationError) {
      setError(validationError);
      setPending(null);
      return;
    }
    setSubmitting(true);
    try {
      const ok = await onDelegate(pending);
      if (ok) {
        setRecent(rememberRecentDelegate(pending));
        setInput("");
        setPending(null);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleClearRecent() {
    clearRecentDelegates();
    setRecent([]);
  }

  const busy = disabled || submitting;

  return (
    <section
      aria-label="Delegate to another address"
      className={`mt-4 min-w-0 rounded-lg border border-slate-800 bg-[#0d1322] p-3 sm:p-4 ${className}`}
    >
      <h3 className="text-sm font-semibold text-slate-100">
        Delegate to another address
      </h3>
      <p className="mt-1 text-xs text-slate-400">
        Current delegate:{" "}
        <span
          data-testid="current-delegate"
          className="break-all font-mono text-slate-200"
        >
          {currentDelegate
            ? currentDelegate === account
              ? "You (self)"
              : currentDelegate
            : "None"}
        </span>
      </p>

      <label
        htmlFor="delegatee-address"
        className="mt-3 block text-sm text-slate-400"
      >
        Delegate address
      </label>
      <input
        id="delegatee-address"
        type="text"
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          setError(null);
          setPending(null);
        }}
        disabled={busy}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "delegatee-address-error" : undefined}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="G..."
        className="mt-1 block min-h-11 w-full min-w-0 max-w-full overflow-x-auto rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 font-mono text-sm text-slate-100 placeholder:text-slate-600"
      />
      {error && (
        <p
          id="delegatee-address-error"
          role="alert"
          className="mt-1 text-xs text-rose-300"
        >
          {error}
        </p>
      )}

      {visibleRecent.length > 0 && (
        <div className="mt-3" aria-label="Recent delegates">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              Recent delegates (stored on this device only)
            </p>
            <button
              type="button"
              onClick={handleClearRecent}
              disabled={submitting}
              className="text-xs text-indigo-300 underline hover:text-white"
            >
              Clear recent delegates
            </button>
          </div>
          <ul className="mt-2 space-y-1">
            {visibleRecent.map((entry) => (
              <li key={entry}>
                <button
                  type="button"
                  onClick={() => {
                    setInput(entry);
                    setError(null);
                    setPending(null);
                  }}
                  disabled={busy}
                  className="block w-full break-all rounded border border-slate-800 px-2 py-1 text-left font-mono text-xs text-slate-300 hover:bg-slate-800"
                >
                  {entry}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pending ? (
        <div
          role="group"
          aria-label="Delegation summary"
          className="mt-4 rounded-lg border border-amber-900/50 bg-amber-950/20 p-3 text-xs text-slate-300"
        >
          <p className="font-medium text-amber-200">Confirm delegation</p>
          <dl className="mt-2 space-y-1">
            <div>
              <dt className="text-slate-500">Tokens delegated</dt>
              <dd>{balance !== null && balance !== undefined ? String(balance) : "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">From</dt>
              <dd className="break-all font-mono">
                {currentDelegate ?? "No current delegate"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">To</dt>
              <dd className="break-all font-mono text-slate-100">{pending}</dd>
            </div>
          </dl>
          <p className="mt-2 text-amber-300/90">
            You will no longer vote with these tokens until you delegate back.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <AppButton
              tone="primary"
              onClick={() => void handleConfirm()}
              disabled={busy || !account}
            >
              {submitting ? "Delegating…" : "Confirm delegation"}
            </AppButton>
            <AppButton
              tone="secondary"
              onClick={() => setPending(null)}
              disabled={submitting}
            >
              Cancel
            </AppButton>
          </div>
        </div>
      ) : (
        <AppButton
          tone="secondary"
          onClick={handleReview}
          disabled={busy || !account}
          className="mt-3"
        >
          Review delegation
        </AppButton>
      )}
    </section>
  );
}
