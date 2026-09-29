import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProposalState } from "@/lib/bindings/community-governor/src";

const discovery = vi.hoisted(() => ({
  useProposalDiscovery: vi.fn(),
}));

const contracts = vi.hoisted(() => ({
  createGovernorClient: vi.fn(),
  storeProposalId: vi.fn(),
}));

vi.mock("@/hooks/useProposalDiscovery", () => ({
  useProposalDiscovery: discovery.useProposalDiscovery,
}));

vi.mock("@/lib/stellar", () => ({
  config: {
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  },
  contractIds: {
    governor: "CGOVERNOR",
  },
  requireContractIds: () => ({ governor: "CGOVERNOR" }),
}));

vi.mock("@/lib/contracts", () => ({
  createGovernorClient: contracts.createGovernorClient,
  storeProposalId: contracts.storeProposalId,
}));

vi.mock("@/context/WalletProvider", () => ({
  useWallet: () => ({
    address: null,
    signTransaction: vi.fn(),
    isConnecting: false,
  }),
}));

const SUCCESS_ID = "ab".repeat(32);
const FAILED_ID = "cd".repeat(32);

describe("ProposalsPage partial state failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    discovery.useProposalDiscovery.mockReturnValue({
      proposals: [
        { id: SUCCESS_ID, description: "Success proposal" },
        { id: FAILED_ID, description: null },
      ],
      proposalIds: [SUCCESS_ID, FAILED_ID],
      loading: false,
      error: null,
      empty: false,
      refresh: vi.fn(),
    });
  });

  it("keeps successful proposals and isolates a failed state with per-entry retry", async () => {
    const proposalState = vi
      .fn()
      .mockImplementation(async ({ proposal_id }: { proposal_id: Uint8Array }) => {
        const idHex = Buffer.from(proposal_id).toString("hex");
        if (idHex === FAILED_ID) {
          throw new Error("state boom");
        }
        return { result: ProposalState.Active };
      });

    contracts.createGovernorClient.mockReturnValue({
      proposal_state: proposalState,
    });

    const ProposalsPage = (await import("@/app/(app)/proposals/page")).default;
    render(<ProposalsPage />);

    expect(
      await screen.findByRole("link", { name: /Active/i }),
    ).toHaveAttribute("href", `/proposals/${SUCCESS_ID}`);

    const failedLink = await screen.findByRole("link", {
      name: /Unavailable/i,
    });
    expect(failedLink).toHaveAttribute("href", `/proposals/${FAILED_ID}`);
    expect(screen.queryByText("Pending")).not.toBeInTheDocument();

    proposalState.mockImplementation(
      async ({ proposal_id }: { proposal_id: Uint8Array }) => {
        const idHex = Buffer.from(proposal_id).toString("hex");
        if (idHex === FAILED_ID) {
          return { result: ProposalState.Succeeded };
        }
        return { result: ProposalState.Active };
      },
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: `Retry loading state for proposal ${FAILED_ID}`,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Succeeded/i }),
      ).toHaveAttribute("href", `/proposals/${FAILED_ID}`);
    });
    expect(
      screen.queryByRole("link", { name: /Unavailable/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Active/i }),
    ).toBeInTheDocument();
  });

  it("keeps a repeated per-entry failure isolated", async () => {
    const proposalState = vi
      .fn()
      .mockImplementation(async ({ proposal_id }: { proposal_id: Uint8Array }) => {
        const idHex = Buffer.from(proposal_id).toString("hex");
        if (idHex === FAILED_ID) {
          throw new Error("still down");
        }
        return { result: ProposalState.Active };
      });

    contracts.createGovernorClient.mockReturnValue({
      proposal_state: proposalState,
    });

    const ProposalsPage = (await import("@/app/(app)/proposals/page")).default;
    render(<ProposalsPage />);

    expect(
      await screen.findByRole("link", { name: /Unavailable/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Active/i }),
    ).toHaveAttribute("href", `/proposals/${SUCCESS_ID}`);

    const callsBeforeRetry = proposalState.mock.calls.length;
    fireEvent.click(
      screen.getByRole("button", {
        name: `Retry loading state for proposal ${FAILED_ID}`,
      }),
    );

    await waitFor(() => {
      expect(proposalState.mock.calls.length).toBeGreaterThan(callsBeforeRetry);
    });
    expect(
      screen.getByRole("link", { name: /Unavailable/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Active/i }),
    ).toHaveAttribute("href", `/proposals/${SUCCESS_ID}`);
  });
});
