"use client";

import { useEffect, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { truncateMiddle } from "@/lib/truncate";
import {
  clearRecentDelegates,
  loadRecentDelegates,
  saveRecentDelegate,
  validateDelegateeAddress,
} from "@/lib/community/delegationUx";

export type ThirdPartyDelegationPanelProps = {
  account: string | null | undefined;
  currentDelegate: string | null | undefined;
  nftContractId: string;
  disabled?: boolean;
  isDelegating?: boolean;
  onDelegateToAddress: (delegatee: string) => Promise<boolean>;
};

export function ThirdPartyDelegationPanel({
  account,
  currentDelegate,
  nftContractId,
  disabled = false,
  isDelegating = false,
  onDelegateToAddress,
}: ThirdPartyDelegationPanelProps) {
  const [delegateeInput, setDelegateeInput] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [recentDelegates, setRecentDelegates] = useState<string[]>([]);

  useEffect(() => {
    setRecentDelegates(loadRecentDelegates(nftContractId));
  }, [nftContractId]);

  const currentDelegateLabel = !currentDelegate
    ? "None (undelegated)"
    : account && currentDelegate === account
      ? `Self (${truncateMiddle(currentDelegate, 6, 4)})`
      : truncateMiddle(currentDelegate, 6, 4);

  const livePreviewValidation = delegateeInput.trim()
    ? validateDelegateeAddress(delegateeInput, account, currentDelegate)
    : null;

  async function handleSubmit() {
    const validation = validateDelegateeAddress(
      delegateeInput,
      account,
      currentDelegate,
    );
    if (!validation.ok) {
      setValidationError(validation.message);
      return;
    }

    setValidationError(null);
    const ok = await onDelegateToAddress(validation.address);
    if (ok) {
      const updated = saveRecentDelegate(nftContractId, validation.address);
      setRecentDelegates(updated);
      setDelegateeInput("");
    }
  }

  function handleClearRecent() {
    clearRecentDelegates(nftContractId);
    setRecentDelegates([]);
  }

  return (
    <div
      className="mt-4 rounded-lg border border-slate-800 bg-[#0d1322] p-4 text-sm"
      data-testid="third-party-delegation-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-200">
          Delegate to another address
        </h3>
        <span
          className="text-xs text-slate-400"
          data-testid="current-delegate-status"
        >
          Current delegate:{" "}
          <strong className="font-mono text-slate-200">
            {currentDelegateLabel}
          </strong>
        </span>
      </div>

      <p className="mt-1 text-xs text-slate-400">
        Transfer your voting power to a trusted representative without
        transferring NFT ownership.
      </p>

      <div className="mt-3">
        <label
          htmlFor="third-party-delegatee-input"
          className="block text-xs font-medium text-slate-300"
        >
          Delegatee Stellar address (G…)
        </label>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
          <input
            id="third-party-delegatee-input"
            type="text"
            value={delegateeInput}
            onChange={(event) => {
              setDelegateeInput(event.target.value);
              if (validationError) setValidationError(null);
            }}
            placeholder="G..."
            spellCheck={false}
            aria-invalid={Boolean(validationError)}
            aria-describedby={
              validationError ? "third-party-delegatee-error" : undefined
            }
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
          />
          <AppButton
            type="button"
            tone="secondary"
            disabled={!account || disabled || isDelegating}
            onClick={() => void handleSubmit()}
          >
            {isDelegating ? "Delegating…" : "Delegate to address"}
          </AppButton>
        </div>

        {validationError && (
          <p
            id="third-party-delegatee-error"
            role="alert"
            className="mt-2 text-xs text-rose-300"
          >
            {validationError}
          </p>
        )}

        {livePreviewValidation?.ok && (
          <div
            className="mt-2 rounded border border-indigo-800/60 bg-indigo-950/30 p-2.5 text-xs text-indigo-200"
            data-testid="delegation-confirm-summary"
          >
            <p className="font-medium text-indigo-100">
              Confirm delegation change
            </p>
            <p className="mt-1 font-mono text-[11px] text-indigo-200/90">
              {currentDelegateLabel} →{" "}
              {truncateMiddle(livePreviewValidation.address, 6, 4)}
            </p>
          </div>
        )}
      </div>

      {recentDelegates.length > 0 && (
        <div
          className="mt-3 border-t border-slate-800/80 pt-3"
          data-testid="recent-delegates-section"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-400">
              Recent delegates (this device only)
            </span>
            <button
              type="button"
              onClick={handleClearRecent}
              className="text-xs text-slate-400 underline hover:text-slate-200"
            >
              Clear recent
            </button>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {recentDelegates.map((addr) => (
              <button
                key={addr}
                type="button"
                onClick={() => {
                  setDelegateeInput(addr);
                  setValidationError(null);
                }}
                className="rounded border border-slate-700 bg-slate-900/80 px-2 py-1 font-mono text-xs text-slate-200 hover:border-indigo-500/60 hover:text-indigo-200"
              >
                {truncateMiddle(addr, 6, 4)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
