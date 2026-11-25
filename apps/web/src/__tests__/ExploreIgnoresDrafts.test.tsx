/**
 * Covers issue #532: a draft community is unreachable from anywhere a
 * stranger looks.
 *
 * The exclusion is structural rather than a filter somebody has to remember:
 * Explore lists what the community factory deployed, and a draft has been
 * deployed nowhere. These tests pin that, so a later change that starts
 * merging local state into the listing fails here.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommunityRegistryProvider } from "@/lib/community/CommunityRegistryProvider";
import type { CommunityRegistry } from "@/lib/community/types";

const mocks = vi.hoisted(() => ({ listCommunities: vi.fn() }));

vi.mock("@/lib/community/registry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/community/registry")>()),
  listCommunities: mocks.listCommunities,
}));

vi.mock("@/context/WalletProvider", () => ({
  useWallet: () => ({
    address: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    signTransaction: vi.fn(),
    isConnecting: false,
    connectionError: null,
  }),
}));

import CommunitiesPage from "@/app/(app)/communities/page";
import {
  communityWizardStorageKey,
  emptyCommunityWizardDraft,
} from "@/lib/community/wizard";
import { mintDraftPreviewToken } from "@/lib/community/draft-preview";

const DRAFT_NAME = "Unpublished Civic Fund";

const registry = {
  list: mocks.listCommunities,
  get: vi.fn(),
} satisfies CommunityRegistry;

function storeDraftAndToken() {
  const draft = emptyCommunityWizardDraft("testnet");
  localStorage.setItem(
    communityWizardStorageKey("testnet"),
    JSON.stringify({
      ...draft,
      step: 3,
      metadata: { ...draft.metadata, name: DRAFT_NAME, symbol: "CIVIC" },
    }),
  );
  // Even a live preview token grants nothing to the listing.
  mintDraftPreviewToken("testnet");
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  window.history.replaceState({}, "", "/communities");
});

describe("Explore", () => {
  it("lists no draft when the registry is empty", async () => {
    storeDraftAndToken();
    mocks.listCommunities.mockResolvedValue({
      communities: [],
      nextCursor: null,
      malformedRecords: 0,
    });

    render(
      <CommunityRegistryProvider registry={registry}>
        <CommunitiesPage />
      </CommunityRegistryProvider>,
    );

    await waitFor(() =>
      expect(screen.queryByText("Loading registered communities…")).toBeNull(),
    );
    expect(screen.queryByText(DRAFT_NAME)).toBeNull();
  });

  it("finds no draft when searching for it by name", async () => {
    storeDraftAndToken();
    mocks.listCommunities.mockResolvedValue({
      communities: [],
      nextCursor: null,
      malformedRecords: 0,
    });
    window.history.replaceState({}, "", `/communities?q=${encodeURIComponent("Civic")}`);

    render(
      <CommunityRegistryProvider registry={registry}>
        <CommunitiesPage />
      </CommunityRegistryProvider>,
    );

    await waitFor(() =>
      expect(screen.queryByText("Loading registered communities…")).toBeNull(),
    );
    expect(screen.queryByText(DRAFT_NAME)).toBeNull();
  });

  it("asks the registry for communities and nothing else", async () => {
    storeDraftAndToken();
    mocks.listCommunities.mockResolvedValue({
      communities: [],
      nextCursor: null,
      malformedRecords: 0,
    });

    render(
      <CommunityRegistryProvider registry={registry}>
        <CommunitiesPage />
      </CommunityRegistryProvider>,
    );

    await waitFor(() => expect(mocks.listCommunities).toHaveBeenCalled());
    // The listing's only source is the on-chain registry. There is no second
    // argument carrying local drafts, and nothing to merge them in with.
    for (const call of mocks.listCommunities.mock.calls) {
      expect(JSON.stringify(call)).not.toContain(DRAFT_NAME);
    }
  });
});
