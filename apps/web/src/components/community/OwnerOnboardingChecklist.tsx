"use client";

import { useState } from "react";
import Link from "next/link";
import { useOptionalWallet } from "@/context/WalletProvider";
import type { Community } from "@/lib/community/types";

export const OWNER_ONBOARDING_STEPS = [
  {
    id: "verify_metadata",
    title: "Verify community metadata",
    description: "Confirm your community name, description, and IPFS metadata.",
    href: (communityId: string) => `/communities/${communityId}`,
    ctaLabel: "Review details",
  },
  {
    id: "mint_membership",
    title: "Mint initial membership NFTs",
    description: "Issue SEP-0050 membership tokens to founding community members.",
    href: (communityId: string) => `/community?community=${communityId}`,
    ctaLabel: "Go to minting",
  },
  {
    id: "delegate_votes",
    title: "Delegate voting power",
    description: "Self-delegate or assign voting power so NFTs count toward quorum.",
    href: (communityId: string) => `/community?community=${communityId}#delegate`,
    ctaLabel: "Configure delegation",
  },
  {
    id: "create_first_proposal",
    title: "Create the first proposal",
    description: "Publish an inaugural proposal to kick off community governance.",
    href: (communityId: string) => `/community/${communityId}/proposals`,
    ctaLabel: "Open proposals",
  },
] as const;

export type OwnerOnboardingStepId =
  (typeof OWNER_ONBOARDING_STEPS)[number]["id"];

export type OwnerOnboardingState = {
  dismissed: boolean;
  completedSteps: OwnerOnboardingStepId[];
};

const STORAGE_PREFIX = "stolla:owner-onboarding:v1";

function storageKey(communityId: string, walletAddress: string): string {
  return `${STORAGE_PREFIX}:${communityId.trim()}:${walletAddress.trim()}`;
}

export function readOwnerOnboardingState(
  communityId: string,
  walletAddress: string,
): OwnerOnboardingState {
  if (typeof window === "undefined" || !communityId || !walletAddress) {
    return { dismissed: false, completedSteps: [] };
  }
  try {
    const raw = window.localStorage.getItem(
      storageKey(communityId, walletAddress),
    );
    if (!raw) return { dismissed: false, completedSteps: [] };
    const parsed = JSON.parse(raw) as Partial<OwnerOnboardingState>;
    const validIds = new Set<string>(
      OWNER_ONBOARDING_STEPS.map((step) => step.id),
    );
    const completedSteps = Array.isArray(parsed.completedSteps)
      ? parsed.completedSteps.filter(
          (id): id is OwnerOnboardingStepId =>
            typeof id === "string" && validIds.has(id),
        )
      : [];
    return {
      dismissed: Boolean(parsed.dismissed),
      completedSteps,
    };
  } catch {
    return { dismissed: false, completedSteps: [] };
  }
}

export function writeOwnerOnboardingState(
  communityId: string,
  walletAddress: string,
  state: OwnerOnboardingState,
): void {
  if (typeof window === "undefined" || !communityId || !walletAddress) return;
  try {
    window.localStorage.setItem(
      storageKey(communityId, walletAddress),
      JSON.stringify(state),
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function isCommunityCreatorOrOwner(
  community: Community,
  walletAddress: string | null | undefined,
): boolean {
  if (!walletAddress) return false;
  const normalized = walletAddress.trim();
  return (
    normalized.length > 0 &&
    (normalized === community.record.communityOwner ||
      normalized === community.record.creator)
  );
}

export type OwnerOnboardingChecklistProps = {
  community: Community;
  walletAddress?: string | null;
};

export function OwnerOnboardingChecklist({
  community,
  walletAddress,
}: OwnerOnboardingChecklistProps) {
  const wallet = useOptionalWallet();
  const effectiveAddress =
    walletAddress !== undefined ? walletAddress : (wallet?.address ?? null);
  const isOwner = isCommunityCreatorOrOwner(community, effectiveAddress);

  const [state, setState] = useState<{
    key: string;
    value: OwnerOnboardingState;
  }>(() => {
    const key = `${community.record.id}:${effectiveAddress ?? ""}`;
    return {
      key,
      value: effectiveAddress
        ? readOwnerOnboardingState(community.record.id, effectiveAddress)
        : { dismissed: false, completedSteps: [] },
    };
  });

  if (!isOwner || !effectiveAddress) {
    return null;
  }

  const currentKey = `${community.record.id}:${effectiveAddress}`;
  const currentState =
    state.key === currentKey
      ? state.value
      : readOwnerOnboardingState(community.record.id, effectiveAddress);

  function updateState(next: OwnerOnboardingState) {
    if (!effectiveAddress) return;
    writeOwnerOnboardingState(community.record.id, effectiveAddress, next);
    setState({ key: currentKey, value: next });
  }

  function toggleStep(stepId: OwnerOnboardingStepId) {
    const exists = currentState.completedSteps.includes(stepId);
    const completedSteps = exists
      ? currentState.completedSteps.filter((id) => id !== stepId)
      : [...currentState.completedSteps, stepId];
    updateState({ ...currentState, completedSteps });
  }

  if (currentState.dismissed) {
    return (
      <div className="mt-6">
        <button
          type="button"
          onClick={() => updateState({ ...currentState, dismissed: false })}
          className="cursor-pointer text-xs text-indigo-300 underline hover:text-indigo-200"
        >
          Show creator onboarding checklist
        </button>
      </div>
    );
  }

  return (
    <section
      aria-label="Creator onboarding checklist"
      data-testid="owner-onboarding-checklist"
      className="mt-6 rounded-xl border border-indigo-800/60 bg-indigo-950/20 p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            Creator onboarding checklist
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Complete these steps to launch governance for your community
            members.
          </p>
        </div>
        <button
          type="button"
          onClick={() => updateState({ ...currentState, dismissed: true })}
          className="cursor-pointer rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
        >
          Dismiss checklist
        </button>
      </div>

      <ul className="mt-4 space-y-3">
        {OWNER_ONBOARDING_STEPS.map((step) => {
          const completed = currentState.completedSteps.includes(step.id);
          return (
            <li
              key={step.id}
              className="flex flex-col justify-between gap-2 rounded-lg border border-slate-800 bg-[#151b2b] p-3 sm:flex-row sm:items-center"
            >
              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={completed}
                  onChange={() => toggleStep(step.id)}
                  className="mt-1 accent-indigo-500"
                />
                <span>
                  <span
                    className={
                      completed ? "font-medium line-through text-slate-500" : "font-medium"
                    }
                  >
                    {step.title}
                  </span>
                  <span className="block text-xs text-slate-400">
                    {step.description}
                  </span>
                </span>
              </label>
              <Link
                href={step.href(community.record.id)}
                className="shrink-0 text-xs font-medium text-indigo-300 underline hover:text-indigo-200"
              >
                {step.ctaLabel}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
