import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ProposalState } from "@/lib/bindings/community-governor/src";
import { CommunityProposalDetailView } from "@/components/community/CommunityProposalDetailView";
import {
  atlasCommunity,
  beaconCommunity,
  multiCommunityRegistry,
  createGovernorReaderFactory,
} from "@/test-support/stellar";

describe("CommunityProposalDetailView", () => {
  it("scopes an identical proposal id to the routed community's own Governor", async () => {
    const getReader = createGovernorReaderFactory([
      { contractId: atlasCommunity.record.governorContract, proposals: { "2a": ProposalState.Active } },
      { contractId: beaconCommunity.record.governorContract, proposals: { "2a": ProposalState.Executed } },
    ]);

    const { unmount } = render(
      <CommunityProposalDetailView
        communityId={atlasCommunity.record.id}
        proposalId="2a"
        registry={multiCommunityRegistry}
        getReader={getReader}
      />,
    );
    expect(await screen.findByText("Active")).toBeInTheDocument();
    unmount();

    render(
      <CommunityProposalDetailView
        communityId={beaconCommunity.record.id}
        proposalId="2a"
        registry={multiCommunityRegistry}
        getReader={getReader}
      />,
    );
    expect(await screen.findByText("Executed")).toBeInTheDocument();
  });

  it("renders the canonical breadcrumb chain through to the proposal", async () => {
    const getReader = createGovernorReaderFactory([
      { contractId: atlasCommunity.record.governorContract, proposals: { "01": ProposalState.Pending } },
    ]);

    render(
      <CommunityProposalDetailView
        communityId={atlasCommunity.record.id}
        proposalId="01"
        registry={multiCommunityRegistry}
        getReader={getReader}
      />,
    );

    const nav = await screen.findByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getByRole("link", { name: atlasCommunity.metadata!.name })).toHaveAttribute(
      "href",
      `/community/${atlasCommunity.record.id}`,
    );
    expect(within(nav).getByText("Proposal #01")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("surfaces a proposal load failure without crashing the page", async () => {
    const getReader = createGovernorReaderFactory([
      {
        contractId: atlasCommunity.record.governorContract,
        proposals: { "01": new Error("RPC simulation failed") },
      },
    ]);

    render(
      <CommunityProposalDetailView
        communityId={atlasCommunity.record.id}
        proposalId="01"
        registry={multiCommunityRegistry}
        getReader={getReader}
      />,
    );

    expect(await screen.findByText("RPC simulation failed")).toBeInTheDocument();
    // Breadcrumb navigation must still be present even though the proposal failed.
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
  });

  it("produces not-found behavior for an unknown community id", async () => {
    const getReader = createGovernorReaderFactory([]);
    render(
      <CommunityProposalDetailView
        communityId="does-not-exist"
        proposalId="01"
        registry={multiCommunityRegistry}
        getReader={getReader}
      />,
    );

    expect(await screen.findByText("Community not found")).toBeInTheDocument();
  });
});
