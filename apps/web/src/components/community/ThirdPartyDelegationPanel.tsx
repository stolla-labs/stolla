"use client";

import { useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { truncateMiddle } from "@/lib/truncate";
import {
  clearRecentDelegates,
  describeCurrentDelegatee,
  readRecentDelegates,
  rememberRecentDelegate,
  validateThirdPartyDelegatee,
} from "@/lib/community/thirdPartyDelegation";

export type ThirdPartyDelegationPanelProps = {
  connectedAccount: string | null | undefined;
  currentDelegatee: string | null | undefined;
  disabled?: boolean;
  onDelegateToAddress: (delegatee: string) => Promise<boolean>;
};

export function ThirdPartyDelegationPanel({
  connectedAccount,
  currentDelegatee,
  disabled = false,
  onDelegateToAddress,
}: ThirdPartyDelegationPanelProps) {
  const [targetInput, setTargetInput] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [confirmingTarget, setConfirmingTarget] = useState<string | null>(null);
  const [rememberRecent, setRememberRecent] = useState(true);
  const [recentDelegates, setRecentDelegates] = useState<string[]>(() =>
    readRecentDelegates(),
  );

  const currentDelegateLabel = describeCurrentDelegatee(
    connectedAccount,
    currentDelegatee,
  );

  function handleReviewClick() {
    const check = validateThirdPartyDelegatee({
      input: targetInput,
      connectedAccount,
      currentDelegatee,
    });
    if (!check.valid) {
      setValidationError(check.message);
      setConfirmingTarget(null);
      return;
    }
    setValidationError(null);
    setConfirmingTarget(check.normalizedAddress);
  }

  async function handleConfirmDelegation() {
    if (!confirmingTarget) return;
    const succeeded = await onDelegateToAddress(confirmingTarget);
    if (succeeded) {
      if (rememberRecent) {
        setRecentDelegates(rememberRecentDelegate(confirmingTarget));
      }
      setConfirmingTarget(null);
      setTargetInput("");
    }
  }

  function handleClearRecent() {
    clearRecentDelegates();
    setRecentDelegates([]);
  }

  return (
    <div className="mt-5 rounded-xl border border-slate-800 bg-[#0d1322] p-4 text-sm text-slate-200">
      <h3 className="font-semibold text-slate-100">
        Delegate to another address
      </h3>
      <p className="mt-1 text-xs text-slate-400">
        Current delegate:{" "}
        <span className="font-mono text-slate-200">{currentDelegateLabel}</span>
      </p>

      <div className="mt-3 space-y-3">
        <div>
          <label
            htmlFor="third-party-delegate-input"
            className="block text-xs text-slate-300"
          >
            Delegatee Stellar address (G…)
          </label>
          <input
            id="third-party-delegate-input"
            type="text"
            value={targetInput}
            onChange={(event) => {
              setTargetInput(event.target.value);
              setValidationError(null);
              setConfirmingTarget(null);
            }}
            placeholder="G..."
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={Boolean(validationError)}
            className="input-field mt-1 block min-h-11 w-full rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 font-mono text-sm text-slate-100"
          />
          {validationError && (
            <p role="alert" className="mt-1 text-xs text-rose-300">
              {validationError}
            </p>
          )}
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={rememberRecent}
            onChange={(event) => setRememberRecent(event.target.checked)}
          />
          Remember recent delegates on this device only
        </label>

        {recentDelegates.length > 0 && (
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-300">
                Recent delegates (this device)
              </span>
              <button
                type="button"
                onClick={handleClearRecent}
                className="text-xs text-slate-400 underline hover:text-slate-200"
              >
                Clear recent
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {recentDelegates.map((recent) => (
                <button
                  key={recent}
                  type="button"
                  onClick={() => {
                    setTargetInput(recent);
                    setValidationError(null);
                    setConfirmingTarget(null);
                  }}
                  className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 font-mono text-xs text-slate-200 hover:border-slate-500"
                >
                  {truncateMiddle(recent, 6, 4)}
                </button>
              ))}
            </div>
          </div>
        )}

        {!confirmingTarget ? (
          <AppButton
            tone="secondary"
            size="sm"
            disabled={!connectedAccount || disabled}
            onClick={handleReviewClick}
          >
            Review delegation
          </AppButton>
        ) : (
          <div
            role="region"
            aria-label="Confirm delegation change"
            className="rounded-lg border border-indigo-500/50 bg-indigo-950/40 p-3 text-xs text-indigo-100"
          >
            <p className="font-semibold text-indigo-200">
              Confirm delegation change
            </p>
            <dl className="mt-2 space-y-1">
              <div className="flex justify-between gap-2">
                <dt className="text-indigo-300">Current delegate:</dt>
                <dd className="break-all font-mono">{currentDelegateLabel}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-indigo-300">New delegatee:</dt>
                <dd className="break-all font-mono">{confirmingTarget}</dd>
              </div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              <AppButton
                tone="primary"
                size="sm"
                disabled={disabled}
                onClick={() => void handleConfirmDelegation()}
              >
                Confirm &amp; open wallet
              </AppButton>
              <AppButton
                tone="secondary"
                size="sm"
                disabled={disabled}
                onClick={() => setConfirmingTarget(null)}
              >
                Cancel
              </AppButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
