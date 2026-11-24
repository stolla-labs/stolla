import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ProposalState } from "@/lib/bindings/community-governor/src";
import { CommunityProposalDetailView } from "@/components/community/CommunityProposalDetailView";
import { SIGNALING_ONLY_MESSAGE } from "@/lib/timelock/proposalExecution";
import {
  atlasCommunity,
  beaconCommunity,
  multiCommunityRegistry,
} from "@/test/fixtures/communities";
import { createGovernorReaderFactory } from "@/test-support/stellar";
import { MOCK_CONTRACT_OTHER } from "@/test-support/stellar/fixtures";
import { SIGNALING_NO_CUSTODY_MESSAGE } from "@/components/proposal/ProposalActionsPanel";

import { fetchVoteTotals } from "@/lib/proposal-events/votes";
vi.mock("@/lib/proposal-events/votes", () => ({ fetchVoteTotals: vi.fn() }));
vi.mock("@/lib/proposal-actions/fetch", () => ({
  fetchProposalActionRecord: vi.fn().mockResolvedValue(null),
}));

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

  it("keeps signaling copy on a succeeded proposal when Timelock is not configured", async () => {
    const getReader = createGovernorReaderFactory([
      {
        contractId: atlasCommunity.record.governorContract,
        proposals: { "01": ProposalState.Succeeded },
      },
    ]);

    render(
      <CommunityProposalDetailView
        communityId={atlasCommunity.record.id}
        proposalId="01"
        registry={multiCommunityRegistry}
        getReader={getReader}
        timelockContractId={null}
      />,
    );

    expect(await screen.findByText("Succeeded")).toBeInTheDocument();
    expect(screen.getByText(SIGNALING_ONLY_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Queue" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Execute" })).not.toBeInTheDocument();
  });

  it("shows a queue action for a succeeded proposal when Timelock is configured", async () => {
    const getReader = createGovernorReaderFactory([
      {
        contractId: atlasCommunity.record.governorContract,
        proposals: { "01": ProposalState.Succeeded },
      },
    ]);

    render(
      <CommunityProposalDetailView
        communityId={atlasCommunity.record.id}
        proposalId="01"
        registry={multiCommunityRegistry}
        getReader={getReader}
        timelockContractId="CTIMELOCK0000000000000000000000000000000000000000000000001"
        executionWindow={{ etaLedger: null, expiresAtLedger: null, currentLedger: 10 }}
        walletConnected
        correctNetwork
        onTimelockAction={vi.fn()}
      />,
    );

    expect(await screen.findByRole("button", { name: "Queue" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Execute" })).not.toBeInTheDocument();
  });

  it("reads snapshot quorum and vote totals from the routed Governor", async () => {
    vi.mocked(fetchVoteTotals).mockResolvedValueOnce({
      totals: { for: BigInt(2), against: BigInt(100), abstain: BigInt(1), total: BigInt(103) },
      incomplete: false,
    });
    const quorum = vi.fn().mockResolvedValue({ result: BigInt(4) });
    const getReader = vi.fn().mockReturnValue({
      proposal_state: vi.fn().mockResolvedValue({ result: ProposalState.Active }),
      proposal_snapshot: vi.fn().mockResolvedValue({ result: 1500 }),
      quorum,
    });
    render(<CommunityProposalDetailView
      communityId={atlasCommunity.record.id} proposalId="01"
      registry={multiCommunityRegistry} getReader={getReader}
    />);
    const progress = await screen.findByRole("progressbar", { name: "Quorum progress" });
    expect(progress).toHaveAttribute("aria-valuenow", "75");
    expect(quorum).toHaveBeenCalledWith({ ledger: 1500 });
    expect(fetchVoteTotals).toHaveBeenCalledWith("01", atlasCommunity.record.governorContract);
    expect(getReader).toHaveBeenCalledWith(atlasCommunity.record.governorContract);
  });

  it("keeps proposal state visible when quorum and vote history are unavailable", async () => {
    vi.mocked(fetchVoteTotals).mockRejectedValueOnce(new Error("RPC unavailable"));
    const getReader = vi.fn().mockReturnValue({
      proposal_state: vi.fn().mockResolvedValue({ result: ProposalState.Active }),
      proposal_snapshot: vi.fn().mockRejectedValue(new Error("Snapshot unavailable")),
      quorum: vi.fn(),
    });
    render(<CommunityProposalDetailView
      communityId={atlasCommunity.record.id} proposalId="01"
      registry={multiCommunityRegistry} getReader={getReader}
    />);
    expect(await screen.findByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Quorum progress unavailable.")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });


  it("shows the signaling-only action summary on the proposal detail page", async () => {
    const getReader = createGovernorReaderFactory([
      { contractId: atlasCommunity.record.governorContract, proposals: { "01": ProposalState.Active } },
    ]);
    render(<CommunityProposalDetailView
      communityId={atlasCommunity.record.id} proposalId="01"
      registry={multiCommunityRegistry} getReader={getReader}
      getActionRecord={vi.fn().mockResolvedValue({ targets: [], functions: [], args: [] })}
    />);

    expect(await screen.findByText(SIGNALING_NO_CUSTODY_MESSAGE)).toBeInTheDocument();
  });

  it("decodes the proposal's action record for the routed Governor", async () => {
    const getReader = createGovernorReaderFactory([
      { contractId: atlasCommunity.record.governorContract, proposals: { "01": ProposalState.Active } },
    ]);
    const getActionRecord = vi.fn().mockResolvedValue({
      targets: [MOCK_CONTRACT_OTHER],
      functions: ["upgrade"],
      args: [[]],
    });
    render(<CommunityProposalDetailView
      communityId={atlasCommunity.record.id} proposalId="01"
      registry={multiCommunityRegistry} getReader={getReader}
      getActionRecord={getActionRecord}
    />);

    expect(await screen.findByText("Unrecognized action")).toBeInTheDocument();
    expect(getActionRecord).toHaveBeenCalledWith(atlasCommunity.record.governorContract, "01");
  });

  it("keeps the proposal usable when the action record fails to load", async () => {
    const getReader = createGovernorReaderFactory([
      { contractId: atlasCommunity.record.governorContract, proposals: { "01": ProposalState.Active } },
    ]);
    render(<CommunityProposalDetailView
      communityId={atlasCommunity.record.id} proposalId="01"
      registry={multiCommunityRegistry} getReader={getReader}
      getActionRecord={vi.fn().mockRejectedValue(new Error("Events unavailable"))}
    />);

    expect(await screen.findByText("Active")).toBeInTheDocument();
    expect(await screen.findByText(/Events unavailable/)).toBeInTheDocument();
    expect(screen.queryByText(SIGNALING_NO_CUSTODY_MESSAGE)).not.toBeInTheDocument();
  });

});
