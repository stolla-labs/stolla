"use client";

import Link from "next/link";
import { useState } from "react";
import { useOptionalWallet } from "@/context/WalletProvider";
import { getStoredProposalIdsFor } from "@/lib/contracts";
import {
  buildOnboardingChecklistSteps,
  dismissOnboardingChecklist,
  isCommunityCreatorOrOwner,
  readOnboardingChecklistState,
  restoreOnboardingChecklist,
  toggleOnboardingStep,
  type OnboardingDetectionSignals,
  type OnboardingStepId,
} from "@/lib/community/onboardingChecklist";
import type { Community } from "@/lib/community/types";

export type CommunityOnboardingChecklistProps = {
  community: Community;
  walletAddress?: string | null;
  signals?: OnboardingDetectionSignals;
};

export function CommunityOnboardingChecklist({
  community,
  walletAddress: walletAddressOverride,
  signals,
}: CommunityOnboardingChecklistProps) {
  const wallet = useOptionalWallet();
  const activeWalletAddress =
    walletAddressOverride !== undefined
      ? walletAddressOverride
      : (wallet?.address ?? null);

  const isOwner = isCommunityCreatorOrOwner(
    community.record,
    activeWalletAddress,
  );

  const [, setRevision] = useState(0);

  if (!isOwner || !activeWalletAddress) {
    return null;
  }

  const persisted = readOnboardingChecklistState(
    community.record.id,
    activeWalletAddress,
  );

  const storedProposalCount = getStoredProposalIdsFor(
    community.record.governorContract,
  ).length;

  const steps = buildOnboardingChecklistSteps(community.record.id, persisted, {
    ...signals,
    proposalCount: signals?.proposalCount ?? storedProposalCount,
  });

  const completedCount = steps.filter((step) => step.completed).length;

  const handleDismiss = () => {
    dismissOnboardingChecklist(community.record.id, activeWalletAddress);
    setRevision((value) => value + 1);
  };

  const handleRestore = () => {
    restoreOnboardingChecklist(community.record.id, activeWalletAddress);
    setRevision((value) => value + 1);
  };

  const handleToggleStep = (stepId: OnboardingStepId, nextChecked: boolean) => {
    toggleOnboardingStep(
      community.record.id,
      activeWalletAddress,
      stepId,
      nextChecked,
    );
    setRevision((value) => value + 1);
  };

  if (persisted.dismissed) {
    return (
      <section
        aria-label="Creator onboarding checklist"
        className="mt-6 flex items-center justify-between rounded-xl border border-slate-800 bg-[#151b2b]/60 px-4 py-3 text-xs text-slate-400"
      >
        <span>
          Creator onboarding checklist hidden ({completedCount}/{steps.length}{" "}
          completed)
        </span>
        <button
          type="button"
          onClick={handleRestore}
          className="font-medium text-indigo-400 hover:text-indigo-300"
        >
          Show checklist
        </button>
      </section>
    );
  }

  return (
    <section
      aria-label="Creator onboarding checklist"
      className="mt-6 rounded-xl border border-indigo-500/30 bg-[#151b2b] p-5"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            Creator onboarding checklist
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Complete these steps to launch governance for your community (
            {completedCount} of {steps.length} complete).
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="self-start rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 sm:self-auto"
        >
          Dismiss checklist
        </button>
      </div>

      <ul className="mt-4 space-y-2.5">
        {steps.map((step) => (
          <li
            key={step.id}
            className="flex flex-col justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 sm:flex-row sm:items-center"
          >
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={step.completed}
                disabled={step.autoCompleted}
                onChange={(event) =>
                  handleToggleStep(step.id, event.target.checked)
                }
                className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-950 text-indigo-500"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-medium ${step.completed ? "line-through text-slate-400" : "text-slate-100"}`}
                  >
                    {step.title}
                  </span>
                  {step.autoCompleted && (
                    <span className="rounded bg-emerald-950/80 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                      Auto-detected
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  {step.description}
                </p>
              </div>
            </label>
            <Link
              href={step.href}
              className="shrink-0 self-end rounded-lg border border-indigo-500/40 bg-indigo-950/50 px-3 py-1.5 text-xs font-medium text-indigo-200 hover:bg-indigo-900/60 sm:self-center"
            >
              {step.actionLabel}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
