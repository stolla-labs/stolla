import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ProposalState } from "@/lib/bindings/community-governor/src";
import { CommunityProposalsView } from "@/components/community/CommunityProposalsView";
import {
  atlasCommunity,
  beaconCommunity,
  multiCommunityRegistry,
  createGovernorReaderFactory,
} from "@/test-support/stellar";

describe("CommunityProposalsView", () => {
  it("resolves the correct registry and Governor for the routed community", async () => {
    const getReader = createGovernorReaderFactory([
      { contractId: atlasCommunity.record.governorContract, proposals: { "01": ProposalState.Active } },
      { contractId: beaconCommunity.record.governorContract, proposals: { "01": ProposalState.Defeated } },
    ]);

    render(
      <CommunityProposalsView
        communityId={atlasCommunity.record.id}
        registry={multiCommunityRegistry}
        proposalIds={["01"]}
        getReader={getReader}
      />,
    );

    const link = await screen.findByRole("link", { name: /#01/ });
    expect(link).toHaveAttribute(
      "href",
      `/community/${atlasCommunity.record.id}/proposals/01`,
    );
    expect(within(link).getByText("Active")).toBeInTheDocument();
    expect(getReader.calls).toEqual([
      { contractId: atlasCommunity.record.governorContract, proposalId: "01" },
    ]);
  });

  it("resolves identical numeric proposal ids under different Governors to different scoped URLs and different data", async () => {
    const getReader = createGovernorReaderFactory([
      { contractId: atlasCommunity.record.governorContract, proposals: { "01": ProposalState.Active } },
      { contractId: beaconCommunity.record.governorContract, proposals: { "01": ProposalState.Defeated } },
    ]);

    const { unmount } = render(
      <CommunityProposalsView
        communityId={atlasCommunity.record.id}
        registry={multiCommunityRegistry}
        proposalIds={["01"]}
        getReader={getReader}
      />,
    );
    const atlasLink = await screen.findByRole("link", { name: /#01/ });
    expect(atlasLink).toHaveAttribute(
      "href",
      `/community/${atlasCommunity.record.id}/proposals/01`,
    );
    expect(within(atlasLink).getByText("Active")).toBeInTheDocument();
    unmount();

    render(
      <CommunityProposalsView
        communityId={beaconCommunity.record.id}
        registry={multiCommunityRegistry}
        proposalIds={["01"]}
        getReader={getReader}
      />,
    );
    const beaconLink = await screen.findByRole("link", { name: /#01/ });
    expect(beaconLink).toHaveAttribute(
      "href",
      `/community/${beaconCommunity.record.id}/proposals/01`,
    );
    expect(within(beaconLink).getByText("Defeated")).toBeInTheDocument();

    // Same textual id, but each call was scoped to its own governor contract.
    expect(getReader.calls).toEqual([
      { contractId: atlasCommunity.record.governorContract, proposalId: "01" },
      { contractId: beaconCommunity.record.governorContract, proposalId: "01" },
    ]);
  });

  it("clears stale proposal results when switching communities", async () => {
    const getReader = createGovernorReaderFactory([
      {
        contractId: atlasCommunity.record.governorContract,
        proposals: { "01": ProposalState.Active, "02": ProposalState.Queued },
      },
      {
        contractId: beaconCommunity.record.governorContract,
        proposals: { "09": ProposalState.Succeeded },
      },
    ]);

    const { rerender } = render(
      <CommunityProposalsView
        communityId={atlasCommunity.record.id}
        registry={multiCommunityRegistry}
        proposalIds={["01", "02"]}
        getReader={getReader}
      />,
    );

    await screen.findByRole("link", { name: /#01/ });
    expect(screen.getByRole("link", { name: /#02/ })).toBeInTheDocument();

    rerender(
      <CommunityProposalsView
        communityId={beaconCommunity.record.id}
        registry={multiCommunityRegistry}
        proposalIds={["09"]}
        getReader={getReader}
      />,
    );

    const beaconLink = await screen.findByRole("link", { name: /#09/ });
    expect(beaconLink).toHaveAttribute(
      "href",
      `/community/${beaconCommunity.record.id}/proposals/09`,
    );
    // Atlas's proposals must not leak into the Beacon Guild view.
    expect(screen.queryByRole("link", { name: /#01/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /#02/ })).not.toBeInTheDocument();
  });

  it("shows partial failures without hiding proposals that resolved successfully", async () => {
    const getReader = createGovernorReaderFactory([
      {
        contractId: atlasCommunity.record.governorContract,
        proposals: {
          "01": ProposalState.Active,
          "02": new Error("simulation failed"),
        },
      },
    ]);

    render(
      <CommunityProposalsView
        communityId={atlasCommunity.record.id}
        registry={multiCommunityRegistry}
        proposalIds={["01", "02"]}
        getReader={getReader}
      />,
    );

    const okLink = await screen.findByRole("link", { name: /#01/ });
    expect(within(okLink).getByText("Active")).toBeInTheDocument();

    const failedLink = screen.getByRole("link", { name: /#02/ });
    expect(within(failedLink).getByText("Unavailable")).toBeInTheDocument();
  });

  it("produces not-found behavior for an unknown community id", async () => {
    const getReader = createGovernorReaderFactory([]);
    render(
      <CommunityProposalsView
        communityId="does-not-exist"
        registry={multiCommunityRegistry}
        proposalIds={["01"]}
        getReader={getReader}
      />,
    );

    expect(await screen.findByText("Community not found")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /#01/ })).not.toBeInTheDocument();
  });
});
