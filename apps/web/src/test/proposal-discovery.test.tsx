import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProposalState } from "@/lib/bindings/community-governor/src";
import { useProposalDiscovery } from "@/hooks/useProposalDiscovery";

const mockSignTransaction = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useProposalDiscovery", () => ({
  useProposalDiscovery: vi.fn(() => ({
    proposals: [{ id: "a".repeat(64), description: "Public proposal", metadata: null }],
    proposalIds: ["a".repeat(64)],
    loading: false,
    error: null,
    empty: false,
    freshness: {
      state: "current",
      explanation: "Proposal history is up to date.",
      ledgerGap: 0,
    },
    refresh: vi.fn(),
  })),
}));

vi.mock("@/lib/stellar", () => ({
  config: {
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  },
  contractIds: { governor: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5J3JQIAKV3" },
  requireContractIds: () => ({
    governor: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5J3JQIAKV3",
  }),
}));

vi.mock("@/lib/contracts", async () => {
  const actual = await vi.importActual("@/lib/contracts");
  return {
    ...actual,
    createGovernorClient: vi.fn(() => ({
      proposal_state: vi.fn().mockResolvedValue({
        result: ProposalState.Pending,
      }),
    })),
  };
});

vi.mock("@/context/WalletProvider", () => ({
  useWallet: () => ({
    address: null,
    signTransaction: mockSignTransaction,
    isConnecting: false,
  }),
}));

describe("ProposalsPage - localStorage not required for proposals", () => {
  let getItemSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getItemSpy = vi.spyOn(Storage.prototype, "getItem");
    vi.restoreAllMocks();
    getItemSpy = vi.spyOn(Storage.prototype, "getItem");
  });

  it("populates proposal list from public discovery without reading localStorage", async () => {
    const ProposalsPage = (await import(
      "@/app/(app)/proposals/page"
    )).default;

    render(<ProposalsPage />);

    const proposalId = "a".repeat(64);
    expect(screen.getByTitle(proposalId)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /aaaaaa/i })).toHaveAttribute(
      "href",
      `/proposals/${proposalId}`,
    );
    expect(getItemSpy).not.toHaveBeenCalled();
  });

  it("labels retained-only history as stale on the proposals page", async () => {
    vi.mocked(useProposalDiscovery).mockReturnValue({
      proposals: [],
      proposalIds: [],
      loading: false,
      error: null,
      empty: true,
      freshness: {
        state: "stale",
        explanation: "Proposal history is partial: earlier events are outside the RPC retention window.",
        ledgerGap: null,
      },
      refresh: vi.fn(),
    });
    const ProposalsPage = (await import("@/app/(app)/proposals/page")).default;

    render(<ProposalsPage />);

    expect(screen.getByText(/earlier events are outside the RPC retention window/)).toBeInTheDocument();
    expect(screen.getByText(/No public proposals were found in the scanned range/)).toBeInTheDocument();
  });
});
