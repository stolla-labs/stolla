import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommunityDetailResult } from "@/lib/community/types";
import { CommunityRegistryProvider } from "@/lib/community/CommunityRegistryProvider";

const mocks = vi.hoisted(() => ({
  useParams: vi.fn(),
  getCommunity: vi.fn(),
  useProposalDiscovery: vi.fn(),
  createReadOnlyGovernorClient: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: mocks.useParams,
}));

vi.mock("@/hooks/useProposalDiscovery", () => ({
  useProposalDiscovery: mocks.useProposalDiscovery,
}));

vi.mock("@/lib/contracts", () => ({
  createReadOnlyGovernorClient: mocks.createReadOnlyGovernorClient,
}));

import { ProposalState } from "@/lib/proposalState";
import CommunityProposalHistoryPage from "@/app/(app)/communities/[id]/proposals/page";

const registry = { list: vi.fn(), get: mocks.getCommunity };

function renderPage() {
  return render(
    <CommunityRegistryProvider registry={registry}>
      <CommunityProposalHistoryPage />
    </CommunityRegistryProvider>,
  );
}

const FIRST_ID = "11".repeat(32);
const SECOND_ID = "22".repeat(32);
const PROPOSAL_ID = "aa".repeat(32);
const FIRST_GOVERNOR = `C${"A".repeat(55)}`;
const SECOND_GOVERNOR = `C${"B".repeat(55)}`;

function communityResult(
  id: string,
  governor: string,
  name: string,
): CommunityDetailResult {
  return {
    status: "found",
    community: {
      record: {
        id,
        nftContract: `C${"N".repeat(55)}`,
        governorContract: governor,
        creator: `G${"C".repeat(55)}`,
        communityOwner: `G${"O".repeat(55)}`,
        createdAtLedger: 100,
        creationIndex: 1,
        metadataUri: "https://example.test/community.json",
        metadataHash: "ab".repeat(32),
        metadataSchemaVersion: 1,
      },
      metadata: {
        schemaVersion: 1,
        name,
        description: `${name} description`,
        externalLinks: [],
      },
      metadataError: null,
      governance: {
        votingDelay: 1,
        votingPeriod: 100,
        proposalThreshold: "1",
        quorum: "1",
        unavailableFields: [],
      },
    },
  };
}

describe("community-scoped proposal history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useParams.mockReturnValue({ id: FIRST_ID });
    mocks.getCommunity.mockImplementation(async (id: string) =>
      id === FIRST_ID
        ? communityResult(FIRST_ID, FIRST_GOVERNOR, "First DAO")
        : communityResult(SECOND_ID, SECOND_GOVERNOR, "Second DAO"),
    );
    mocks.useProposalDiscovery.mockReturnValue({
      proposals: [{ id: PROPOSAL_ID, description: "Shared numeric ID", metadata: null }],
      loading: false,
      error: null,
      empty: false,
      refresh: mocks.refresh,
    });
    mocks.createReadOnlyGovernorClient.mockReturnValue({
      proposal_state: vi.fn().mockResolvedValue({
        result: ProposalState.Active,
      }),
    });
  });

  it("uses the route community Governor and keeps colliding IDs scoped", async () => {
    const { rerender } = renderPage();

    expect(
      await screen.findByRole("link", {
        name: new RegExp(`View proposal ${PROPOSAL_ID}, state Active`),
      }),
    ).toHaveAttribute(
      "href",
      `/communities/${FIRST_ID}/proposals/${PROPOSAL_ID}`,
    );
    expect(mocks.useProposalDiscovery).toHaveBeenCalledWith(FIRST_GOVERNOR);
    expect(mocks.createReadOnlyGovernorClient).toHaveBeenCalledWith(
      FIRST_GOVERNOR,
    );

    mocks.useParams.mockReturnValue({ id: SECOND_ID });
    rerender(
      <CommunityRegistryProvider registry={registry}>
        <CommunityProposalHistoryPage />
      </CommunityRegistryProvider>,
    );

    await waitFor(() =>
      expect(
        screen.getByRole("link", {
          name: new RegExp(`View proposal ${PROPOSAL_ID}, state Active`),
        }),
      ).toHaveAttribute(
        "href",
        `/communities/${SECOND_ID}/proposals/${PROPOSAL_ID}`,
      ),
    );
    expect(mocks.useProposalDiscovery).toHaveBeenCalledWith(SECOND_GOVERNOR);
  });

  it("shows an unknown community independently of proposal history", async () => {
    mocks.getCommunity.mockResolvedValue({ status: "not-found" });

    renderPage();

    expect(await screen.findByText("Community not found")).toBeInTheDocument();
    expect(mocks.useProposalDiscovery).not.toHaveBeenCalled();
  });
});
