import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  useWallet: vi.fn(),
  createNftClient: vi.fn(),
  createReadOnlyNftClient: vi.fn(),
  runCommunityRefresh: vi.fn(),
}));

vi.mock("@/context/WalletProvider", () => ({
  useWallet: mocks.useWallet,
}));

vi.mock("@/lib/contracts", () => ({
  createNftClient: mocks.createNftClient,
  createReadOnlyNftClient: mocks.createReadOnlyNftClient,
}));

vi.mock("@/lib/stellar", () => ({
  contractIds: { nft: "CNFT", governor: "CGOV" },
}));

vi.mock("@/app/(app)/community/community-data.mjs", () => ({
  loadCommunityData: vi.fn(),
  runCommunityRefresh: mocks.runCommunityRefresh,
}));

import CommunityPage from "@/app/(app)/community/page";
import { metadataSha256 } from "@/lib/metadata/publish";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("CommunityPage mint lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/community");
    mocks.useWallet.mockReturnValue({
      address: "GWALLET",
      signTransaction: vi.fn(),
      isConnecting: false,
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

  it("pins member metadata and mints with the returned URI", async () => {
    const mint = vi.fn().mockResolvedValue({ sign: async () => undefined, send: async () => ({ result: 12 }) });
    mocks.createNftClient.mockReturnValue({ mint });
    const upload = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const document = JSON.parse(init?.body as string) as { json: string };
      return new Response(JSON.stringify({ uri: `ipfs://b${"a".repeat(53)}`, sha256: await metadataSha256(document.json) }), { status: 200 });
    });
    render(<CommunityPage />);
    fireEvent.change(await screen.findByLabelText(/Recipient address/i), { target: { value: "GRECIPIENT" } });
    fireEvent.change(screen.getByLabelText("Member token name"), { target: { value: "Member #12" } });
    fireEvent.change(screen.getByLabelText("Member description"), { target: { value: "A voting member" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview metadata" }));
    expect(await screen.findByText(/SHA-256:/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pin preview to IPFS" }));
    await waitFor(() => expect(screen.getByLabelText(/IPFS metadata URI/i)).toHaveValue(`ipfs://b${"a".repeat(53)}`));
    fireEvent.click(screen.getByRole("button", { name: "Mint NFT" }));
    await waitFor(() => expect(mint).toHaveBeenCalledWith({ to: "GRECIPIENT", token_uri: `ipfs://b${"a".repeat(53)}` }));
    expect(upload).toHaveBeenCalledTimes(1);
    upload.mockRestore();
  });

  it("shows simulating then approval then confirmation for mint", async () => {
    const signGate = deferred<void>();
    const sendGate = deferred<{ result: number; hash: string }>();
    const mint = vi.fn().mockResolvedValue({
      sign: () => signGate.promise,
      send: () => sendGate.promise,
    });
    mocks.createNftClient.mockReturnValue({ mint });

    render(<CommunityPage />);
    fireEvent.change(await screen.findByLabelText(/Recipient address/i), {
      target: { value: "GRECIPIENT" },
    });
    fireEvent.change(screen.getByLabelText(/IPFS metadata URI/i), {
      target: { value: "ipfs://meta" },
    });

    const button = screen.getByRole("button", { name: "Mint NFT" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(
      await screen.findByText("Waiting for wallet approval…"),
    ).toBeInTheDocument();
    expect(mint).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();

    await act(async () => {
      signGate.resolve();
    });
    expect(
      await screen.findByText("Confirming on ledger…"),
    ).toBeInTheDocument();

    await act(async () => {
      sendGate.resolve({
        result: 7,
        hash: "a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0",
      });
    });

    expect(
      await screen.findByText("Minted token #7 successfully."),
    ).toBeInTheDocument();
    expect(await screen.findByText("Mint confirmed")).toBeInTheDocument();
  });

  it("re-enables mint after wallet rejection", async () => {
    const mint = vi
      .fn()
      .mockResolvedValueOnce({
        sign: async () => {
          throw new Error("User rejected the request");
        },
        send: vi.fn(),
      })
      .mockResolvedValueOnce({
        sign: async () => undefined,
        send: async () => ({ result: 9 }),
      });
    mocks.createNftClient.mockReturnValue({ mint });

    render(<CommunityPage />);
    fireEvent.change(await screen.findByLabelText(/Recipient address/i), {
      target: { value: "GRECIPIENT" },
    });
    fireEvent.change(screen.getByLabelText(/IPFS metadata URI/i), {
      target: { value: "ipfs://meta" },
    });

    const button = screen.getByRole("button", { name: "Mint NFT" });
    fireEvent.click(button);
    expect(
      (await screen.findAllByText(/rejected the wallet request/i)).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText(/Recipient address/i)).toHaveValue(
      "GRECIPIENT",
    );
    expect(screen.getByLabelText(/IPFS metadata URI/i)).toHaveValue(
      "ipfs://meta",
    );
    await waitFor(() => expect(button).not.toBeDisabled());

    fireEvent.click(button);
    expect(
      await screen.findByText("Minted token #9 successfully."),
    ).toBeInTheDocument();
    expect(mint).toHaveBeenCalledTimes(2);
  });

  it("does not call mint when wallet is disconnected", async () => {
    const mint = vi.fn();
    mocks.createNftClient.mockReturnValue({ mint });
    mocks.useWallet.mockReturnValue({
      address: null,
      signTransaction: vi.fn(),
      isConnecting: false,
    });

    render(<CommunityPage />);
    expect(
      await screen.findByRole("button", { name: "Mint NFT" }),
    ).toBeDisabled();
    expect(mint).not.toHaveBeenCalled();
  });

  it("shows validation errors for missing recipient and token URI", async () => {
    const mint = vi.fn();
    mocks.createNftClient.mockReturnValue({ mint });

    render(<CommunityPage />);
    fireEvent.change(await screen.findByLabelText(/Recipient address/i), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText(/IPFS metadata URI/i), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Mint NFT" }));

    expect(
      await screen.findByText("Recipient address is required."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("IPFS metadata URI is required."),
    ).toBeInTheDocument();
    expect(mint).not.toHaveBeenCalled();
  });

  it("does not mint with an incomplete IPFS URI", async () => {
    const mint = vi.fn();
    mocks.createNftClient.mockReturnValue({ mint });
    render(<CommunityPage />);
    fireEvent.change(await screen.findByLabelText(/Recipient address/i), { target: { value: "GRECIPIENT" } });
    fireEvent.change(screen.getByLabelText(/IPFS metadata URI/i), { target: { value: "ipfs://" } });
    fireEvent.click(screen.getByRole("button", { name: "Mint NFT" }));
    expect(screen.getByText("Use a valid ipfs:// or https:// URI of at most 256 bytes.")).toBeInTheDocument();
    expect(mint).not.toHaveBeenCalled();
  });

  it("calls mint with the exact recipient and token URI", async () => {
    const mint = vi.fn().mockResolvedValue({
      sign: async () => undefined,
      send: async () => ({ result: 3 }),
    });
    mocks.createNftClient.mockReturnValue({ mint });

    render(<CommunityPage />);
    fireEvent.change(await screen.findByLabelText(/Recipient address/i), {
      target: { value: "GRECIPIENT" },
    });
    fireEvent.change(screen.getByLabelText(/IPFS metadata URI/i), {
      target: { value: "ipfs://collection/member.json" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Mint NFT" }));

    await waitFor(() => {
      expect(mint).toHaveBeenCalledWith({
        to: "GRECIPIENT",
        token_uri: "ipfs://collection/member.json",
      });
    });
  });

  it("shows simulation failure and preserves form input", async () => {
    const mint = vi
      .fn()
      .mockRejectedValue(new Error("simulation failed: not the owner"));
    mocks.createNftClient.mockReturnValue({ mint });

    render(<CommunityPage />);
    fireEvent.change(await screen.findByLabelText(/Recipient address/i), {
      target: { value: "GRECIPIENT" },
    });
    fireEvent.change(screen.getByLabelText(/IPFS metadata URI/i), {
      target: { value: "ipfs://meta" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Mint NFT" }));

    expect(
      (await screen.findAllByText(/could not be simulated/i)).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText(/Recipient address/i)).toHaveValue(
      "GRECIPIENT",
    );
    expect(screen.getByLabelText(/IPFS metadata URI/i)).toHaveValue(
      "ipfs://meta",
    );
  });

  it("shows submission failure and preserves form input", async () => {
    const mint = vi.fn().mockResolvedValue({
      sign: async () => undefined,
      send: async () => {
        throw new Error("send failed: rpc unavailable");
      },
    });
    mocks.createNftClient.mockReturnValue({ mint });

    render(<CommunityPage />);
    fireEvent.change(await screen.findByLabelText(/Recipient address/i), {
      target: { value: "GKEEP" },
    });
    fireEvent.change(screen.getByLabelText(/IPFS metadata URI/i), {
      target: { value: "ipfs://keep" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Mint NFT" }));

    expect(
      (await screen.findAllByText(/could not be submitted|temporarily unreachable/i))
        .length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText(/Recipient address/i)).toHaveValue("GKEEP");
    expect(screen.getByLabelText(/IPFS metadata URI/i)).toHaveValue(
      "ipfs://keep",
    );
  });
});
