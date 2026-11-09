import type { CommunityRegistryRecord } from "./types";

export const ONBOARDING_CHECKLIST_STORAGE_PREFIX =
  "stolla:community-onboarding:";

export type OnboardingStepId =
  | "mint_members"
  | "share_link"
  | "create_first_proposal"
  | "verify_delegation";

export type OnboardingPersistedState = {
  dismissed: boolean;
  completedStepIds: OnboardingStepId[];
  updatedAt: string;
};

export type OnboardingDetectionSignals = {
  hasMintedMembers?: boolean;
  hasSharedInvite?: boolean;
  proposalCount?: number;
  hasDelegatedVotingPower?: boolean;
};

export type OnboardingChecklistStep = {
  id: OnboardingStepId;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  completed: boolean;
  autoCompleted: boolean;
};

const VALID_STEP_IDS: readonly OnboardingStepId[] = [
  "mint_members",
  "share_link",
  "create_first_proposal",
  "verify_delegation",
];

function isValidStepId(value: unknown): value is OnboardingStepId {
  return (
    typeof value === "string" &&
    (VALID_STEP_IDS as readonly string[]).includes(value)
  );
}

export function isCommunityCreatorOrOwner(
  record: Pick<CommunityRegistryRecord, "creator" | "communityOwner">,
  walletAddress: string | null | undefined,
): boolean {
  if (typeof walletAddress !== "string") return false;
  const normalizedWallet = walletAddress.trim();
  if (!normalizedWallet) return false;
  return (
    normalizedWallet === record.communityOwner.trim() ||
    normalizedWallet === record.creator.trim()
  );
}

export function buildOnboardingStorageKey(
  communityId: string,
  walletAddress: string,
): string {
  return `${ONBOARDING_CHECKLIST_STORAGE_PREFIX}${communityId.trim()}:${walletAddress.trim()}`;
}

function defaultState(): OnboardingPersistedState {
  return {
    dismissed: false,
    completedStepIds: [],
    updatedAt: new Date(0).toISOString(),
  };
}

function resolveStorage(
  storage?: Pick<Storage, "getItem"> | null,
): Pick<Storage, "getItem"> | null {
  if (storage !== undefined) return storage;
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

export function readOnboardingChecklistState(
  communityId: string,
  walletAddress: string | null | undefined,
  storage?: Pick<Storage, "getItem"> | null,
): OnboardingPersistedState {
  if (!walletAddress || !walletAddress.trim() || !communityId.trim()) {
    return defaultState();
  }
  const targetStorage = resolveStorage(storage);
  if (!targetStorage) return defaultState();

  try {
    const raw = targetStorage.getItem(
      buildOnboardingStorageKey(communityId, walletAddress),
    );
    if (!raw) return defaultState();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return defaultState();
    }
    const record = parsed as Record<string, unknown>;
    const completedStepIds = Array.isArray(record.completedStepIds)
      ? Array.from(new Set(record.completedStepIds.filter(isValidStepId)))
      : [];
    return {
      dismissed: Boolean(record.dismissed),
      completedStepIds,
      updatedAt:
        typeof record.updatedAt === "string"
          ? record.updatedAt
          : defaultState().updatedAt,
    };
  } catch {
    return defaultState();
  }
}

export function writeOnboardingChecklistState(
  communityId: string,
  walletAddress: string,
  state: OnboardingPersistedState,
  storage?: Pick<Storage, "setItem"> | null,
): void {
  if (!walletAddress.trim() || !communityId.trim()) return;
  const targetStorage =
    storage !== undefined
      ? storage
      : typeof window !== "undefined" && window.localStorage
        ? window.localStorage
        : null;
  if (!targetStorage) return;

  try {
    targetStorage.setItem(
      buildOnboardingStorageKey(communityId, walletAddress),
      JSON.stringify(state),
    );
  } catch {
    // Ignore storage quota errors in restricted browsing modes.
  }
}

export function dismissOnboardingChecklist(
  communityId: string,
  walletAddress: string,
  storage?: Pick<Storage, "getItem" | "setItem"> | null,
): OnboardingPersistedState {
  const current = readOnboardingChecklistState(
    communityId,
    walletAddress,
    storage,
  );
  const next: OnboardingPersistedState = {
    ...current,
    dismissed: true,
    updatedAt: new Date().toISOString(),
  };
  writeOnboardingChecklistState(communityId, walletAddress, next, storage);
  return next;
}

export function restoreOnboardingChecklist(
  communityId: string,
  walletAddress: string,
  storage?: Pick<Storage, "getItem" | "setItem"> | null,
): OnboardingPersistedState {
  const current = readOnboardingChecklistState(
    communityId,
    walletAddress,
    storage,
  );
  const next: OnboardingPersistedState = {
    ...current,
    dismissed: false,
    updatedAt: new Date().toISOString(),
  };
  writeOnboardingChecklistState(communityId, walletAddress, next, storage);
  return next;
}

export function toggleOnboardingStep(
  communityId: string,
  walletAddress: string,
  stepId: OnboardingStepId,
  completed?: boolean,
  storage?: Pick<Storage, "getItem" | "setItem"> | null,
): OnboardingPersistedState {
  const current = readOnboardingChecklistState(
    communityId,
    walletAddress,
    storage,
  );
  const exists = current.completedStepIds.includes(stepId);
  const shouldComplete = completed ?? !exists;
  const completedStepIds = shouldComplete
    ? exists
      ? current.completedStepIds
      : [...current.completedStepIds, stepId]
    : current.completedStepIds.filter((id) => id !== stepId);

  const next: OnboardingPersistedState = {
    ...current,
    completedStepIds,
    updatedAt: new Date().toISOString(),
  };
  writeOnboardingChecklistState(communityId, walletAddress, next, storage);
  return next;
}

export function buildOnboardingChecklistSteps(
  communityId: string,
  persisted: OnboardingPersistedState,
  signals: OnboardingDetectionSignals = {},
): OnboardingChecklistStep[] {
  const encodedId = encodeURIComponent(communityId.trim());
  const autoMap: Record<OnboardingStepId, boolean> = {
    mint_members: Boolean(signals.hasMintedMembers),
    share_link: Boolean(signals.hasSharedInvite),
    create_first_proposal: (signals.proposalCount ?? 0) > 0,
    verify_delegation: Boolean(signals.hasDelegatedVotingPower),
  };

  const definitions: Array<{
    id: OnboardingStepId;
    title: string;
    description: string;
    href: string;
    actionLabel: string;
  }> = [
    {
      id: "mint_members",
      title: "Mint founding member NFTs",
      description:
        "Issue governance membership NFTs to initial community voters.",
      href: `/nft?communityId=${encodedId}#mint`,
      actionLabel: "Mint members",
    },
    {
      id: "share_link",
      title: "Share community invite link",
      description:
        "Invite members to inspect the community contracts and governance parameters.",
      href: `/community/${encodedId}?share=1`,
      actionLabel: "Share link",
    },
    {
      id: "create_first_proposal",
      title: "Create your first proposal",
      description:
        "Publish an initial governance proposal to kick off community voting.",
      href: `/proposals?communityId=${encodedId}#create`,
      actionLabel: "Create proposal",
    },
    {
      id: "verify_delegation",
      title: "Verify voting power delegation",
      description:
        "Confirm that NFT holders have delegated voting power before the snapshot ledger.",
      href: `/nft?communityId=${encodedId}#delegate`,
      actionLabel: "Verify delegation",
    },
  ];

  return definitions.map((def) => {
    const autoCompleted = autoMap[def.id];
    const completed =
      autoCompleted || persisted.completedStepIds.includes(def.id);
    return {
      ...def,
      completed,
      autoCompleted,
    };
  });
}
