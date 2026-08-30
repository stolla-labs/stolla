import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommunityDetailResult } from "@/lib/community/types";
import { CommunityRegistryProvider } from "@/lib/community/CommunityRegistryProvider";

const mocks = vi.hoisted(() => ({
  useParams: vi.fn(),
  getCommunity: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: mocks.useParams,
}));

vi.mock("@/app/(app)/proposals/[id]/page", () => ({
  default: ({
    proposalId,
    community,
  }: {
    proposalId: string;
    community: { record: { governorContract: string } };
  }) => (
    <div>
      Scoped detail {proposalId} via {community.record.governorContract}
    </div>
  ),
}));

import CommunityProposalDetailPage from "@/app/(app)/communities/[id]/proposals/[proposalId]/page";

const registry = { list: vi.fn(), get: mocks.getCommunity };

function renderPage() {
  return render(
    <CommunityRegistryProvider registry={registry}>
      <CommunityProposalDetailPage />
    </CommunityRegistryProvider>,
  );
}

const COMMUNITY_ID = "ab".repeat(32);
const PROPOSAL_ID = "cd".repeat(32);
const GOVERNOR = `C${"A".repeat(55)}`;
const NFT = `C${"B".repeat(55)}`;

const found: CommunityDetailResult = {
  status: "found",
  community: {
    record: {
      id: COMMUNITY_ID,
      nftContract: NFT,
      governorContract: GOVERNOR,
      creator: `G${"C".repeat(55)}`,
      communityOwner: `G${"D".repeat(55)}`,
      createdAtLedger: 100,
      creationIndex: 1,
      metadataUri: "https://example.test/community.json",
      metadataHash: "ef".repeat(32),
      metadataSchemaVersion: 1,
    },
    metadata: null,
    metadataError: "Unavailable",
    governance: {
      votingDelay: null,
      votingPeriod: null,
      proposalThreshold: null,
      quorum: null,
      unavailableFields: [],
    },
  },
};

describe("community-scoped proposal detail route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useParams.mockReturnValue({
      id: COMMUNITY_ID,
      proposalId: PROPOSAL_ID,
    });
    mocks.getCommunity.mockResolvedValue(found);
  });

  it("passes the route proposal and registered Governor to proposal detail", async () => {
    renderPage();

    expect(
      await screen.findByText(
        `Scoped detail ${PROPOSAL_ID} via ${GOVERNOR}`,
      ),
    ).toBeInTheDocument();
    expect(mocks.getCommunity).toHaveBeenCalledWith(COMMUNITY_ID);
  });

  it("reports an unknown community before loading proposal data", async () => {
    mocks.getCommunity.mockResolvedValue({ status: "not-found" });

    renderPage();

    expect(await screen.findByText("Community not found")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Browse communities" }),
    ).toHaveAttribute("href", "/communities");
  });

  it("blocks malformed registered contract addresses", async () => {
    const malformed = structuredClone(found);
    if (malformed.status !== "found") throw new Error("invalid fixture");
    malformed.community.record.governorContract = "not-a-contract";
    mocks.getCommunity.mockResolvedValue(malformed);

    renderPage();

    expect(
      await screen.findByText("Community contracts are invalid"),
    ).toBeInTheDocument();
  });
});
