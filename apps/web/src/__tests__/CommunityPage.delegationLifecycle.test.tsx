import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  useWallet: vi.fn(),
  createNftClient: vi.fn(),
  createReadOnlyNftClient: vi.fn(),
  loadCommunityData: vi.fn(),
  runCommunityRefresh: vi.fn(),
}));

vi.mock("@/context/WalletProvider", () => ({
  useWallet: mocks.useWallet,
}));

vi.mock("@/lib/contracts", () => ({
  createNftClient: mocks.createNftClient,
  createReadOnlyNftClient: mocks.createReadOnlyNftClient,
}));

vi.mock("@/lib/stellar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/stellar")>()),
  contractIds: { nft: "CNFT", governor: "CGOV" },
}));

vi.mock("@/app/(app)/community/community-data.mjs", () => ({
  loadCommunityData: mocks.loadCommunityData,
  runCommunityRefresh: mocks.runCommunityRefresh,
}));

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

describe("CommunityPage delegation lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/community");
    mocks.useWallet.mockReturnValue({
      address: "GWALLET",
      signTransaction: vi.fn(),
      isConnecting: false,
    });
    mocks.createReadOnlyNftClient.mockReturnValue({
      get_owner: vi.fn().mockResolvedValue({ result: null }),
    });
    mocks.runCommunityRefresh.mockImplementation(
      async (
        _load: unknown,
        callbacks: {
          onStart: () => void;
          onSuccess: (data: {
            name: string;
            symbol: string;
            balance: number;
            votes: string;
          }) => void;
          onError: (message: string) => void;
        },
      ) => {
        callbacks.onStart();
        callbacks.onSuccess({
          name: "Stolla",
          symbol: "STL",
          balance: 1,
          votes: "0",
        });
        return true;
      },
    );
  });

  it("walks delegation through approval, submission, confirmation, then refreshes votes", async () => {
    const signGate = deferred<void>();
    const sendGate = deferred<{ status: string; hash: string }>();
    const sign = vi.fn().mockReturnValue(signGate.promise);
    const send = vi.fn().mockReturnValue(sendGate.promise);

    mocks.createNftClient.mockReturnValue({
      delegate: vi.fn().mockResolvedValue({ sign, send }),
    });

    render(<CommunityPage />);

    const button = await screen.findByRole("button", {
      name: "Delegate to self",
    });
    fireEvent.click(button);

    expect(
      await screen.findByText("Waiting for wallet approval…"),
    ).toBeInTheDocument();
    expect(button).toBeDisabled();

    await act(async () => {
      signGate.resolve();
    });
    expect(
      await screen.findByText("Confirming on ledger…"),
    ).toBeInTheDocument();

    const refreshCallsBeforeConfirm = mocks.runCommunityRefresh.mock.calls.length;

    await act(async () => {
      sendGate.resolve({
        status: "SUCCESS",
        hash: "a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0",
      });
    });

    expect(await screen.findByText("Delegate confirmed")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /View on Stellar Expert/i }),
    ).toHaveAttribute(
      "href",
      "https://stellar.expert/explorer/testnet/tx/a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0",
    );
    await waitFor(() => {
      expect(mocks.runCommunityRefresh.mock.calls.length).toBeGreaterThan(
        refreshCallsBeforeConfirm,
      );
    });
  });

  it("shows a distinct still-pending outcome and blocks double submit", async () => {
    const signGate = deferred<void>();
    mocks.createNftClient.mockReturnValue({
      delegate: vi.fn().mockResolvedValue({
        sign: () => signGate.promise,
        send: vi.fn(),
      }),
    });

    render(<CommunityPage />);
    const button = await screen.findByRole("button", {
      name: "Delegate to self",
    });
    fireEvent.click(button);
    expect(
      await screen.findByText("Waiting for wallet approval…"),
    ).toBeInTheDocument();

    fireEvent.click(button);
    expect(mocks.createNftClient).toHaveBeenCalledTimes(1);

    await act(async () => {
      signGate.reject(new Error("Transaction timed out while still pending"));
    });

    expect(await screen.findByText("Still pending")).toBeInTheDocument();
    expect(
      screen.getAllByText(/still pending on the network/i).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Transaction timed out while still pending/i)).not.toBeInTheDocument();
  });

  it("disables delegation while disconnected", async () => {
    mocks.useWallet.mockReturnValue({
      address: null,
      signTransaction: vi.fn(),
      isConnecting: false,
    });
    const delegate = vi.fn();
    mocks.createNftClient.mockReturnValue({ delegate });

    render(<CommunityPage />);
    expect(
      await screen.findByRole("button", { name: "Delegate to self" }),
    ).toBeDisabled();
    expect(delegate).not.toHaveBeenCalled();
  });

  it("passes the connected address as account and delegatee", async () => {
    const delegate = vi.fn().mockResolvedValue({
      sign: async () => undefined,
      send: async () => ({ status: "SUCCESS", hash: "abc" }),
    });
    mocks.createNftClient.mockReturnValue({ delegate });

    render(<CommunityPage />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Delegate to self" }),
    );

    await waitFor(() => {
      expect(delegate).toHaveBeenCalledWith({
        account: "GWALLET",
        delegatee: "GWALLET",
      });
    });
  });

  it("does not report success after wallet rejection", async () => {
    mocks.createNftClient.mockReturnValue({
      delegate: vi.fn().mockResolvedValue({
        sign: async () => {
          throw new Error("User rejected the request");
        },
        send: vi.fn(),
      }),
    });

    render(<CommunityPage />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Delegate to self" }),
    );

    expect(
      (await screen.findAllByText(/rejected the wallet request/i)).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Delegate confirmed")).not.toBeInTheDocument();
  });

  it("exposes a terminal state after RPC send failure", async () => {
    mocks.createNftClient.mockReturnValue({
      delegate: vi.fn().mockResolvedValue({
        sign: async () => undefined,
        send: async () => {
          throw new Error("send failed: rpc unavailable");
        },
      }),
    });

    render(<CommunityPage />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Delegate to self" }),
    );

    expect(
      (await screen.findAllByText(/could not be submitted|temporarily unreachable/i))
        .length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Delegate confirmed")).not.toBeInTheDocument();
  });

  describe("delegating to another address", () => {
    const DELEGATEE = "GAWDU43EJGJQY6JTUJVLENDMEAFWCCKWJFC4562RVWH6ZH2YM6ZYUUIB";

    function reviewDelegatee(value: string) {
      fireEvent.change(screen.getByLabelText("Delegate address"), {
        target: { value },
      });
      fireEvent.click(screen.getByRole("button", { name: "Review delegation" }));
    }

    it("does not open the wallet for an invalid address", async () => {
      mocks.createNftClient.mockReturnValue({ delegate: vi.fn() });

      render(<CommunityPage />);
      await screen.findByLabelText("Delegate address");
      reviewDelegatee("GNOTVALID");

      expect(await screen.findByRole("alert")).toHaveTextContent(
        /valid Stellar G address/,
      );
      expect(mocks.createNftClient).not.toHaveBeenCalled();
    });

    it("rejects an address that fails validation before the wallet opens", async () => {
      mocks.createNftClient.mockReturnValue({ delegate: vi.fn() });

      render(<CommunityPage />);
      await screen.findByLabelText("Delegate address");
      reviewDelegatee("");

      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(mocks.createNftClient).not.toHaveBeenCalled();
    });

    it("delegates to the confirmed address and refreshes community data", async () => {
      const delegate = vi.fn().mockResolvedValue({
        sign: async () => undefined,
        send: async () => ({ status: "SUCCESS", hash: "abc" }),
      });
      mocks.createNftClient.mockReturnValue({ delegate });

      render(<CommunityPage />);
      await screen.findByLabelText("Delegate address");
      reviewDelegatee(DELEGATEE);

      expect(mocks.createNftClient).not.toHaveBeenCalled();
      const refreshCallsBefore = mocks.runCommunityRefresh.mock.calls.length;
      fireEvent.click(
        screen.getByRole("button", { name: "Confirm delegation" }),
      );

      await waitFor(() => {
        expect(delegate).toHaveBeenCalledWith({
          account: "GWALLET",
          delegatee: DELEGATEE,
        });
      });
      await waitFor(() => {
        expect(mocks.runCommunityRefresh.mock.calls.length).toBeGreaterThan(
          refreshCallsBefore,
        );
      });
    });
  });
});
