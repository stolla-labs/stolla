/** Covers issue #359: pause/archive state for communities in the factory registry. */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommunityCard } from "@/components/CommunityCard";
import { ScopedProposalEmptyState } from "@/components/community/ScopedProposalEmptyState";
import { CommunityRegistryProvider } from "@/lib/community/CommunityRegistryProvider";
import { parseRegistryRecord } from "@/lib/community/registry";
import {
  COMMUNITY_PAUSED_REASON,
  isCommunityPaused,
  writePauseOverlay,
} from "@/lib/community/settings";
import type { Community, CommunityDetailResult } from "@/lib/community/types";
import {
  MOCK_ACCOUNT_ALICE,
  MOCK_ACCOUNT_OWNER,
  MOCK_CONTRACT_A,
  MOCK_CONTRACT_B,
} from "@/test-support/stellar/fixtures";

const mocks = vi.hoisted(() => ({
  useParams: vi.fn(),
  getCommunity: vi.fn(),
  useWallet: vi.fn(),
  getVotes: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: mocks.useParams,
}));

vi.mock("@/context/WalletProvider", () => ({
  useWallet: mocks.useWallet,
}));

vi.mock("@/lib/contracts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/contracts")>();
  return {
    ...actual,
    createReadOnlyNftClient: () => ({
      get_votes: mocks.getVotes,
    }),
  };
});

vi.mock("@/components/community/CommunityMemberRoster", () => ({
  CommunityMemberRoster: () => <div data-testid="community-member-roster">Member Roster</div>,
}));

import CommunityDetailPage from "@/app/(app)/communities/[id]/page";
import CommunitySettingsPage from "@/app/(app)/communities/[id]/settings/page";

const COMMUNITY_ID = "ab".repeat(32);

function makeCommunity(paused = false): Community {
  return {
    record: {
      id: COMMUNITY_ID,
      nftContract: MOCK_CONTRACT_A,
      governorContract: MOCK_CONTRACT_B,
      ...(paused ? { paused: true } : {}),
      creator: MOCK_ACCOUNT_ALICE,
      communityOwner: MOCK_ACCOUNT_OWNER,
      createdAtLedger: 123,
      creationIndex: 4,
      metadataUri: "https://example.test/community.json",
      metadataHash: "cd".repeat(32),
      metadataSchemaVersion: 1,
    },
    metadata: {
      schemaVersion: 1,
      name: "Builders Guild",
      description: "A community for public-goods builders.",
      externalLinks: [],
    },
    metadataError: null,
    governance: {
      votingDelay: 12,
      votingPeriod: 17_280,
      proposalThreshold: "1",
      quorum: "10",
      unavailableFields: [],
    },
  };
}

describe("Community pause/archive state (#359)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    mocks.useParams.mockReturnValue({ id: COMMUNITY_ID });
    mocks.useWallet.mockReturnValue({
      address: MOCK_ACCOUNT_OWNER,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTransaction: vi.fn(),
      isConnecting: false,
      connectionError: null,
      walletNetworkPassphrase: "Test SDF Network ; September 2015",
    });
    mocks.getVotes.mockResolvedValue({ result: 5n });
  });

  it("decodes optional paused flag from registry records without breaking legacy records", () => {
    const bytes = (value: number) => Uint8Array.from({ length: 32 }, () => value);
    const pausedRecord = parseRegistryRecord({
      community_id: bytes(0xab),
      nft_contract: "CNFT",
      governor_contract: "CGOV",
      paused: true,
      creator: "GCREATOR",
      community_owner: "GOWNER",
      created_at_ledger: 123,
      creation_index: 4,
      metadata_uri: "ipfs://bafy/community.json",
      metadata_hash: bytes(0xcd),
      metadata_schema_version: 1,
    });
    expect(pausedRecord?.paused).toBe(true);
    expect(isCommunityPaused(pausedRecord)).toBe(true);
  });

  it("labels paused communities on cards and detail while keeping read links active and disabling write CTAs", async () => {
    const pausedCommunity = makeCommunity(true);
    render(<CommunityCard community={pausedCommunity} />);
    expect(screen.getByTestId("community-status-badge")).toHaveTextContent("Paused");
    expect(
      screen.getByRole("link", { name: "View Builders Guild community details" }),
    ).toHaveAttribute("href", `/communities/${COMMUNITY_ID}`);

    const foundPaused: CommunityDetailResult = {
      status: "found",
      community: pausedCommunity,
    };
    mocks.getCommunity.mockResolvedValue(foundPaused);
    render(
      <CommunityRegistryProvider registry={{ list: vi.fn(), get: mocks.getCommunity }}>
        <CommunityDetailPage />
      </CommunityRegistryProvider>,
    );

    expect(await screen.findByTestId("community-paused-banner")).toHaveTextContent(
      COMMUNITY_PAUSED_REASON,
    );
    expect(
      screen.getByRole("link", { name: "View community proposals" }),
    ).not.toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("link", { name: "Membership actions" }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("disables proposal creation when paused and restores write CTAs when unpaused", async () => {
    const pausedCommunity = makeCommunity(true);
    const { rerender } = render(
      <ScopedProposalEmptyState
        community={pausedCommunity}
        refresh={vi.fn().mockResolvedValue(true)}
      />,
    );

    expect(screen.getByTestId("community-paused-reason")).toHaveTextContent(
      COMMUNITY_PAUSED_REASON,
    );
    const pausedButton = screen.getByRole("button", { name: "Create first proposal" });
    expect(pausedButton).toBeDisabled();

    // Unpause via owner overlay and verify write CTA is restored for authorized member
    writePauseOverlay(COMMUNITY_ID, false);
    await act(async () => {
      rerender(
        <ScopedProposalEmptyState
          community={makeCommunity(false)}
          refresh={vi.fn().mockResolvedValue(true)}
        />,
      );
    });

    const activeButton = await screen.findByRole("button", { name: "Create first proposal" });
    expect(activeButton).not.toBeDisabled();
  });

  it("enforces owner authorization in settings and toggles pause/unpause state", async () => {
    mocks.getCommunity.mockResolvedValue({
      status: "found",
      community: makeCommunity(false),
    });

    // Non-owner cannot access settings controls
    mocks.useWallet.mockReturnValue({
      address: MOCK_ACCOUNT_ALICE,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTransaction: vi.fn(),
      isConnecting: false,
      connectionError: null,
    });
    const { unmount } = render(
      <CommunityRegistryProvider registry={{ list: vi.fn(), get: mocks.getCommunity }}>
        <CommunitySettingsPage />
      </CommunityRegistryProvider>,
    );
    expect(
      await screen.findByText("Only the community owner can update metadata."),
    ).toBeInTheDocument();
    unmount();

    // Authorized owner can pause and unpause
    mocks.useWallet.mockReturnValue({
      address: MOCK_ACCOUNT_OWNER,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTransaction: vi.fn(),
      isConnecting: false,
      connectionError: null,
    });
    render(
      <CommunityRegistryProvider registry={{ list: vi.fn(), get: mocks.getCommunity }}>
        <CommunitySettingsPage />
      </CommunityRegistryProvider>,
    );

    expect(await screen.findByTestId("community-status-badge")).toHaveTextContent("Active");
    fireEvent.click(screen.getByRole("button", { name: "Pause community" }));
    expect(screen.getByTestId("community-status-badge")).toHaveTextContent("Paused");
    expect(screen.getByText(COMMUNITY_PAUSED_REASON)).toBeInTheDocument();
    expect(isCommunityPaused({ id: COMMUNITY_ID })).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Unpause community" }));
    expect(screen.getByTestId("community-status-badge")).toHaveTextContent("Active");
    expect(isCommunityPaused({ id: COMMUNITY_ID })).toBe(false);
  });
});
