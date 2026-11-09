import { describe, expect, it } from "vitest";
import {
  buildOnboardingChecklistSteps,
  buildOnboardingStorageKey,
  dismissOnboardingChecklist,
  isCommunityCreatorOrOwner,
  readOnboardingChecklistState,
  restoreOnboardingChecklist,
  toggleOnboardingStep,
} from "./onboardingChecklist";

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

describe("community creator onboarding checklist (#400)", () => {
  const record = {
    creator: "GCREATOR111111111111111111111111111111111111111111111111",
    communityOwner: "GOWNER22222222222222222222222222222222222222222222222222",
  };

  it("restricts checklist visibility strictly to community creator or owner", () => {
    expect(isCommunityCreatorOrOwner(record, record.creator)).toBe(true);
    expect(isCommunityCreatorOrOwner(record, record.communityOwner)).toBe(true);
    expect(
      isCommunityCreatorOrOwner(
        record,
        "GNONOWNER33333333333333333333333333333333333333333333333",
      ),
    ).toBe(false);
    expect(isCommunityCreatorOrOwner(record, null)).toBe(false);
    expect(isCommunityCreatorOrOwner(record, "   ")).toBe(false);
  });

  it("persists dismissal scoped per community and wallet and supports reversible restore", () => {
    const storage = createMemoryStorage();
    const walletA = record.creator;
    const walletB = record.communityOwner;

    expect(buildOnboardingStorageKey("comm-1", walletA)).not.toBe(
      buildOnboardingStorageKey("comm-2", walletA),
    );
    expect(buildOnboardingStorageKey("comm-1", walletA)).not.toBe(
      buildOnboardingStorageKey("comm-1", walletB),
    );

    dismissOnboardingChecklist("comm-1", walletA, storage);
    expect(readOnboardingChecklistState("comm-1", walletA, storage).dismissed).toBe(
      true,
    );
    expect(readOnboardingChecklistState("comm-2", walletA, storage).dismissed).toBe(
      false,
    );
    expect(readOnboardingChecklistState("comm-1", walletB, storage).dismissed).toBe(
      false,
    );

    restoreOnboardingChecklist("comm-1", walletA, storage);
    expect(readOnboardingChecklistState("comm-1", walletA, storage).dismissed).toBe(
      false,
    );
  });

  it("combines manual step toggles, auto-detection signals, and deep action links", () => {
    const storage = createMemoryStorage();
    const wallet = record.creator;

    const afterManualToggle = toggleOnboardingStep(
      "comm-42",
      wallet,
      "share_link",
      undefined,
      storage,
    );
    expect(afterManualToggle.completedStepIds).toEqual(["share_link"]);

    const steps = buildOnboardingChecklistSteps("comm-42", afterManualToggle, {
      proposalCount: 2,
      hasMintedMembers: true,
    });

    const byId = Object.fromEntries(steps.map((step) => [step.id, step]));
    expect(byId.mint_members.completed).toBe(true);
    expect(byId.mint_members.autoCompleted).toBe(true);
    expect(byId.mint_members.href).toBe("/nft?communityId=comm-42#mint");

    expect(byId.share_link.completed).toBe(true);
    expect(byId.share_link.autoCompleted).toBe(false);
    expect(byId.share_link.href).toBe("/community/comm-42?share=1");

    expect(byId.create_first_proposal.completed).toBe(true);
    expect(byId.create_first_proposal.autoCompleted).toBe(true);
    expect(byId.create_first_proposal.href).toBe(
      "/proposals?communityId=comm-42#create",
    );

    expect(byId.verify_delegation.completed).toBe(false);
    expect(byId.verify_delegation.href).toBe("/nft?communityId=comm-42#delegate");
  });
});
