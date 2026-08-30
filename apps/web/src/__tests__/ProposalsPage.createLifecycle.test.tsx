import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  useWallet: vi.fn(),
  createGovernorClient: vi.fn(),
  storeProposalId: vi.fn(),
  useProposalDiscovery: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/context/WalletProvider", () => ({
  useWallet: mocks.useWallet,
}));

vi.mock("@/lib/contracts", () => ({
  createGovernorClient: mocks.createGovernorClient,
  storeProposalId: mocks.storeProposalId,
}));

vi.mock("@/lib/stellar", () => ({
  config: {
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  },
  contractIds: { governor: "CGOVERNOR" },
  requireContractIds: () => ({ governor: "CGOVERNOR" }),
}));

vi.mock("@/hooks/useProposalDiscovery", () => ({
  useProposalDiscovery: mocks.useProposalDiscovery,
}));

import ProposalsPage from "@/app/(app)/proposals/page";
import { serializeProposalMetadata } from "@/lib/proposal-metadata";

const PROPOSAL_ID = "ab".repeat(32);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function fillDescription(value = "  Fund the grants program  ") {
  fireEvent.change(screen.getByRole("textbox", { name: "Title (required)" }), {
    target: { value },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "Summary (required)" }), {
    target: { value: "Approve the community grants program." },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "Body (required)" }), {
    target: { value: "Fund reviewed grants from the community treasury." },
  });
}

describe("ProposalsPage create lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.refresh.mockResolvedValue(true);
    mocks.useWallet.mockReturnValue({
      address: "GWALLET",
      signTransaction: vi.fn(),
      isConnecting: false,
    });
    mocks.useProposalDiscovery.mockReturnValue({
      proposals: [],
      proposalIds: [],
      loading: false,
      error: null,
      empty: true,
      refresh: mocks.refresh,
    });
    mocks.createGovernorClient.mockReturnValue({
      propose: vi.fn(),
      proposal_state: vi.fn(),
    });
  });

  it("does not call propose when disconnected or description is blank", async () => {
    const propose = vi.fn();
    mocks.createGovernorClient.mockReturnValue({
      propose,
      proposal_state: vi.fn(),
    });
    mocks.useWallet.mockReturnValue({
      address: null,
      signTransaction: vi.fn(),
      isConnecting: false,
    });

    const { unmount } = render(<ProposalsPage />);
    expect(
      screen.getByRole("button", { name: "Create proposal" }),
    ).toBeDisabled();
    expect(propose).not.toHaveBeenCalled();
    unmount();

    mocks.useWallet.mockReturnValue({
      address: "GWALLET",
      signTransaction: vi.fn(),
      isConnecting: false,
    });
    render(<ProposalsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    expect(
      await screen.findByText("Title is required."),
    ).toBeInTheDocument();
    expect(propose).not.toHaveBeenCalled();

    fillDescription("   ");
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    expect(
      await screen.findByText("Title is required."),
    ).toBeInTheDocument();
    expect(propose).not.toHaveBeenCalled();
  });

  it("shows lifecycle stages, clears form on success, and refreshes discovery", async () => {
    const signGate = deferred<void>();
    const sendGate = deferred<{ result: Uint8Array; hash: string }>();
    const propose = vi.fn().mockResolvedValue({
      sign: () => signGate.promise,
      send: () => sendGate.promise,
    });
    mocks.createGovernorClient.mockReturnValue({
      propose,
      proposal_state: vi.fn(),
    });

    render(<ProposalsPage />);
    fillDescription();
    const button = screen.getByRole("button", { name: "Create proposal" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(
      await screen.findByText("Waiting for wallet approval…"),
    ).toBeInTheDocument();
    expect(propose).toHaveBeenCalledTimes(1);
    expect(propose).toHaveBeenCalledWith({
      targets: ["GWALLET"],
      functions: ["noop"],
      args: [[]],
      description: serializeProposalMetadata({
        title: "Fund the grants program",
        summary: "Approve the community grants program.",
        body: "Fund reviewed grants from the community treasury.",
        discussionUrl: null,
      }),
      proposer: "GWALLET",
    });
    expect(button).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Title (required)" })).toHaveValue(
      "  Fund the grants program  ",
    );

    await act(async () => {
      signGate.resolve();
    });
    expect(
      await screen.findByText("Confirming on ledger…"),
    ).toBeInTheDocument();

    await act(async () => {
      sendGate.resolve({
        result: Uint8Array.from(Buffer.from(PROPOSAL_ID, "hex")),
        hash: "a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0",
      });
    });

    expect(
      await screen.findByText(/Proposal created/i, {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Propose confirmed")).toBeInTheDocument();
    expect(mocks.storeProposalId).toHaveBeenCalledWith(PROPOSAL_ID);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Title (required)" })).toHaveValue("");
    });
  });

  it("preserves description after wallet rejection", async () => {
    const propose = vi.fn().mockResolvedValue({
      sign: async () => {
        throw new Error("User rejected the request");
      },
      send: vi.fn(),
    });
    mocks.createGovernorClient.mockReturnValue({
      propose,
      proposal_state: vi.fn(),
    });

    render(<ProposalsPage />);
    fillDescription("Keep this draft");
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));

    expect(
      (await screen.findAllByText(/rejected the wallet request/i)).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("textbox", { name: "Title (required)" })).toHaveValue(
      "Keep this draft",
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("preserves description after simulation failure", async () => {
    const propose = vi
      .fn()
      .mockRejectedValue(new Error("simulation failed: insufficient balance"));
    mocks.createGovernorClient.mockReturnValue({
      propose,
      proposal_state: vi.fn(),
    });

    render(<ProposalsPage />);
    fillDescription("Sim failure draft");
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));

    expect(
      (await screen.findAllByText(/could not be simulated/i)).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("textbox", { name: "Title (required)" })).toHaveValue(
      "Sim failure draft",
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("preserves description after confirmation failure", async () => {
    const propose = vi.fn().mockResolvedValue({
      sign: async () => undefined,
      send: async () => {
        throw new Error("Confirmation timed out waiting for inclusion");
      },
    });
    mocks.createGovernorClient.mockReturnValue({
      propose,
      proposal_state: vi.fn(),
    });

    render(<ProposalsPage />);
    fillDescription("Confirm failure draft");
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));

    expect(
      (await screen.findAllByText(/Confirmation timed out/i)).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("textbox", { name: "Title (required)" })).toHaveValue(
      "Confirm failure draft",
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("treats discovery delay as indexing lag after confirmed success", async () => {
    mocks.refresh.mockResolvedValue(false);
    const propose = vi.fn().mockResolvedValue({
      sign: async () => undefined,
      send: async () => ({
        result: Uint8Array.from(Buffer.from(PROPOSAL_ID, "hex")),
        hash: "deadbeef",
      }),
    });
    mocks.createGovernorClient.mockReturnValue({
      propose,
      proposal_state: vi.fn(),
    });

    render(<ProposalsPage />);
    fillDescription("Indexed later");
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));

    expect(
      await screen.findByText(/Public history is still indexing/i, {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Propose confirmed")).toBeInTheDocument();
    expect(screen.queryByText(/Propose failed/i)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Title (required)" })).toHaveValue("");
  });
});
