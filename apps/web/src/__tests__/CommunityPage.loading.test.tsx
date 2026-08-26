import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  useWallet: vi.fn(),
  createNftClient: vi.fn(),
  createReadOnlyNftClient: vi.fn(),
  loadCommunityData: vi.fn(),
}));

vi.mock("@/context/WalletProvider", () => ({
  useWallet: mocks.useWallet,
}));

vi.mock("@/lib/contracts", () => ({
  createNftClient: mocks.createNftClient,
  createReadOnlyNftClient: mocks.createReadOnlyNftClient,
}));

vi.mock("@/lib/stellar", () => ({
  capabilities: { legacyContracts: { available: true, nft: "CNFT", governor: "CGOV" }, activeNetwork: { explorerSegment: "testnet" } },
}));

vi.mock("@/app/(app)/community/community-data.mjs", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/app/(app)/community/community-data.mjs")
  >();
  return {
    ...actual,
    loadCommunityData: mocks.loadCommunityData,
  };
});

import CommunityPage from "@/app/(app)/community/page";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("CommunityPage loading and RPC failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/community");
    mocks.createNftClient.mockReturnValue({});
    mocks.createReadOnlyNftClient.mockReturnValue({});
    mocks.useWallet.mockReturnValue({
      address: null,
      signTransaction: vi.fn(),
      isConnecting: false,
    });
  });

  it("loads collection without a wallet and hides balance/votes numbers", async () => {
    mocks.loadCommunityData.mockResolvedValue({
      name: "Stolla",
      symbol: "STL",
      balance: null,
      votes: null,
    });

    render(<CommunityPage />);

    expect(await screen.findByText("Stolla")).toBeInTheDocument();
    expect(screen.getByText("STL")).toBeInTheDocument();

    const balance = screen.getByText("Your balance").closest("div");
    const votes = screen.getByText("Your votes").closest("div");
    expect(balance).toHaveTextContent("—");
    expect(votes).toHaveTextContent("—");
    expect(balance).not.toHaveTextContent("0");
    expect(votes).not.toHaveTextContent("0");
  });

  it("shows loading UI instead of zero placeholders while pending", async () => {
    const gate = deferred<{
      name: string;
      symbol: string;
      balance: number | null;
      votes: string | null;
    }>();
    mocks.loadCommunityData.mockReturnValue(gate.promise);

    render(<CommunityPage />);

    expect(screen.getByText("Loading community data…")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();

    await act(async () => {
      gate.resolve({
        name: "Stolla",
        symbol: "STL",
        balance: null,
        votes: null,
      });
    });

    expect(await screen.findByText("Stolla")).toBeInTheDocument();
  });

  it("renders balance and votes only when a wallet is connected", async () => {
    mocks.useWallet.mockReturnValue({
      address: "GWALLET",
      signTransaction: vi.fn(),
      isConnecting: false,
    });
    mocks.loadCommunityData.mockResolvedValue({
      name: "Stolla",
      symbol: "STL",
      balance: 2,
      votes: "5",
    });

    render(<CommunityPage />);

    expect(await screen.findByText("Stolla")).toBeInTheDocument();
    expect(screen.getByText("Your balance").closest("div")).toHaveTextContent(
      "2",
    );
    expect(screen.getByText("Your votes").closest("div")).toHaveTextContent(
      "5",
    );
  });

  it("shows RPC failure and replaces it after a successful retry", async () => {
    mocks.loadCommunityData
      .mockRejectedValueOnce(new Error("RPC down"))
      .mockResolvedValueOnce({
        name: "Stolla",
        symbol: "STL",
        balance: null,
        votes: null,
      });

    render(<CommunityPage />);

    expect(
      await screen.findByText("Community data could not be loaded"),
    ).toBeInTheDocument();
    expect(screen.getByText("RPC down")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Retry loading community data" }),
    );

    expect(await screen.findByText("Stolla")).toBeInTheDocument();
    expect(
      screen.queryByText("Community data could not be loaded"),
    ).not.toBeInTheDocument();
  });

  it("ignores a stale response after the wallet changes", async () => {
    const first = deferred<{
      name: string;
      symbol: string;
      balance: number | null;
      votes: string | null;
    }>();
    const second = deferred<{
      name: string;
      symbol: string;
      balance: number | null;
      votes: string | null;
    }>();

    mocks.useWallet.mockReturnValue({
      address: "GOLD",
      signTransaction: vi.fn(),
      isConnecting: false,
    });
    mocks.loadCommunityData
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { rerender } = render(<CommunityPage />);
    expect(screen.getByText("Loading community data…")).toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.loadCommunityData).toHaveBeenCalledTimes(1),
    );

    mocks.useWallet.mockReturnValue({
      address: "GNEW",
      signTransaction: vi.fn(),
      isConnecting: false,
    });
    rerender(<CommunityPage />);
    await waitFor(() =>
      expect(mocks.loadCommunityData).toHaveBeenCalledTimes(2),
    );

    await act(async () => {
      second.resolve({
        name: "New DAO",
        symbol: "NEW",
        balance: 9,
        votes: "3",
      });
    });
    expect(await screen.findByText("New DAO")).toBeInTheDocument();
    expect(screen.getByText("Your balance").closest("div")).toHaveTextContent(
      "9",
    );

    await act(async () => {
      first.resolve({
        name: "Stale DAO",
        symbol: "OLD",
        balance: 1,
        votes: "1",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("New DAO")).toBeInTheDocument();
    });
    expect(screen.queryByText("Stale DAO")).not.toBeInTheDocument();
    expect(screen.getByText("Your balance").closest("div")).toHaveTextContent(
      "9",
    );
  });
});
