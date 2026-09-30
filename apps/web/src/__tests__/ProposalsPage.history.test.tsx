import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useProposalDiscovery: vi.fn(),
  createGovernorClient: vi.fn(),
  refresh: vi.fn(),
  signTransaction: vi.fn(),
}));

vi.mock("@/hooks/useProposalDiscovery", () => ({
  useProposalDiscovery: mocks.useProposalDiscovery,
}));

vi.mock("@/lib/contracts", () => ({
  createGovernorClient: mocks.createGovernorClient,
  storeProposalId: vi.fn(),
}));

vi.mock("@/lib/stellar", () => ({
  contractIds: { governor: "CGOVERNOR" },
}));

vi.mock("@/context/WalletProvider", () => ({
  useWallet: () => ({
    address: null,
    signTransaction: mocks.signTransaction,
    isConnecting: false,
  }),
}));

import { ProposalState } from "@/lib/proposalState";
import ProposalsPage from "@/app/(app)/proposals/page";

const proposal = (byte: number) => ({
  id: byte.toString(16).padStart(2, "0").repeat(32),
  description: `Proposal ${byte}`,
});

function discoveryState(
  overrides: Partial<{
    proposals: ReturnType<typeof proposal>[];
    loading: boolean;
    error: string | null;
    empty: boolean;
  }> = {},
) {
  return {
    proposals: [],
    loading: false,
    error: null,
    empty: false,
    refresh: mocks.refresh,
    ...overrides,
  };
}

describe("ProposalsPage public history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.refresh.mockResolvedValue(true);
    mocks.createGovernorClient.mockReturnValue({
      proposal_state: vi.fn().mockResolvedValue({
        result: ProposalState.Active,
      }),
    });
  });

  it("keeps initial loading distinct from genuine empty history", () => {
    mocks.useProposalDiscovery.mockReturnValue(
      discoveryState({ loading: true }),
    );
    const { rerender } = render(<ProposalsPage />);

    expect(screen.getByText("Loading proposal history...")).toBeInTheDocument();
    expect(
      screen.queryByText("No public proposals were found in the scanned range."),
    ).not.toBeInTheDocument();

    mocks.useProposalDiscovery.mockReturnValue(
      discoveryState({ empty: true }),
    );
    rerender(<ProposalsPage />);

    expect(
      screen.getByText("No public proposals were found in the scanned range."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Loading proposal history..."),
    ).not.toBeInTheDocument();
  });

  it("renders stable links and isolates one failed state read", async () => {
    const first = proposal(1);
    const failed = proposal(2);
    mocks.useProposalDiscovery.mockReturnValue(
      discoveryState({ proposals: [first, failed] }),
    );
    mocks.createGovernorClient.mockReturnValue({
      proposal_state: vi.fn(
        async ({ proposal_id }: { proposal_id: Uint8Array }) => {
          const id = Buffer.from(proposal_id).toString("hex");
          if (id === failed.id) throw new Error("state unavailable");
          return { result: ProposalState.Succeeded };
        },
      ),
    });

    render(<ProposalsPage />);

    expect(
      await screen.findByRole("link", {
        name: new RegExp(`View proposal ${first.id}, state Succeeded`),
      }),
    ).toHaveAttribute("href", `/proposals/${first.id}`);
    expect(
      screen.getByRole("link", {
        name: new RegExp(`View proposal ${failed.id}, state Unavailable`),
      }),
    ).toHaveAttribute("href", `/proposals/${failed.id}`);
    expect(
      screen.getByRole("button", {
        name: `Retry loading state for proposal ${failed.id}`,
      }),
    ).toBeInTheDocument();
  });

  it("appends the next visible page without duplicate cards", async () => {
    const proposals = Array.from({ length: 12 }, (_, index) =>
      proposal(index + 1),
    );
    mocks.useProposalDiscovery.mockReturnValue(
      discoveryState({
        proposals: [...proposals.slice(0, 6), proposals[2], ...proposals.slice(6)],
      }),
    );

    render(<ProposalsPage />);

    await waitFor(() =>
      expect(
        screen.getAllByRole("link", { name: /View proposal/ }),
      ).toHaveLength(10),
    );
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));

    expect(screen.getAllByRole("link", { name: /View proposal/ })).toHaveLength(
      12,
    );
    expect(
      screen.getAllByRole("link", {
        name: new RegExp(`View proposal ${proposals[2].id},`),
      }),
    ).toHaveLength(1);
  });

  it("preserves discovered cards when a later page fails", async () => {
    const firstPage = [proposal(1), proposal(2)];
    mocks.useProposalDiscovery.mockReturnValue(
      discoveryState({ proposals: firstPage }),
    );
    const { rerender } = render(<ProposalsPage />);

    await screen.findByRole("link", {
      name: new RegExp(`View proposal ${firstPage[0].id}, state Active`),
    });

    mocks.useProposalDiscovery.mockReturnValue(
      discoveryState({
        proposals: firstPage,
        error: "Next page RPC timeout",
      }),
    );
    rerender(<ProposalsPage />);

    expect(
      screen.getByText("More proposal history could not be loaded."),
    ).toBeInTheDocument();
    expect(screen.getByText("Next page RPC timeout")).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: new RegExp(`View proposal ${firstPage[0].id}, state Active`),
      }),
    ).toHaveAttribute("href", `/proposals/${firstPage[0].id}`);
  });
});
