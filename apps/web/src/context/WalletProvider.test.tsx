import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "@/components/Header";
import { membershipFromBalance } from "@/lib/community/membership";
import { readMembershipBalance } from "@/lib/walletKitModules";
import {
  WalletProvider,
  getDefaultWalletModuleIdForUi,
  resetWalletKitForTests,
  setWalletKitModuleFactoryForTests,
  useWallet,
} from "./WalletProvider";

const walletKit = vi.hoisted(() => ({
  authModal: vi.fn(),
  disconnect: vi.fn(),
  getNetwork: vi.fn(),
  init: vi.fn(),
  on: vi.fn((type?: unknown, handler?: unknown) => {
    void type;
    void handler;
    return vi.fn();
  }),
}));

vi.mock("@creit.tech/stellar-wallets-kit/sdk", () => ({
  StellarWalletsKit: walletKit,
}));

vi.mock("@creit.tech/stellar-wallets-kit/types", () => ({
  KitEventType: { STATE_UPDATED: "state_updated" },
  Networks: { TESTNET: "Test SDF Network ; September 2015" },
}));

vi.mock("@creit.tech/stellar-wallets-kit/modules/freighter", () => ({
  FreighterModule: class FreighterModule {
    productId = "freighter";
    productName = "Freighter";
  },
}));

vi.mock("@creit.tech/stellar-wallets-kit/modules/lobstr", () => ({
  LobstrModule: class LobstrModule {
    productId = "lobstr";
    productName = "LOBSTR";
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/community",
}));

function renderWalletHeader() {
  return render(
    <WalletProvider>
      <Header />
    </WalletProvider>,
  );
}

function ConnectedAddressProbe() {
  const { address } = useWallet();
  return <span data-testid="connected-address">{address ?? ""}</span>;
}

function renderWalletWithProbe() {
  return render(
    <WalletProvider>
      <Header />
      <ConnectedAddressProbe />
    </WalletProvider>,
  );
}

describe("wallet connection feedback", () => {
  beforeEach(() => {
    resetWalletKitForTests();
    walletKit.authModal.mockReset();
    walletKit.disconnect.mockReset();
    walletKit.getNetwork.mockReset();
    walletKit.getNetwork.mockResolvedValue({
      network: "testnet",
      networkPassphrase: "Test SDF Network ; September 2015",
    });
    walletKit.init.mockReset();
    walletKit.on.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    resetWalletKitForTests();
    vi.restoreAllMocks();
  });

  it("keeps deliberate modal dismissal silent", async () => {
    walletKit.authModal.mockRejectedValue({
      code: -1,
      message: "The user closed the modal.",
    });
    renderWalletHeader();

    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));

    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Connect Wallet" })
          .hasAttribute("disabled"),
      ).toBe(false),
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(console.error).not.toHaveBeenCalledWith(
      "Wallet connect failed:",
      expect.anything(),
    );
  });

  it("shows actionable feedback when Freighter is unavailable", async () => {
    walletKit.authModal.mockRejectedValue(
      new Error("Freighter is not connected"),
    );
    renderWalletHeader();

    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "Freighter is unavailable. Install or unlock the wallet, then try again.",
    );
    expect(
      screen
        .getByRole("button", { name: "Connect Wallet" })
        .getAttribute("aria-describedby"),
    ).toBe(alert.id);
  });

  it("distinguishes a rejected connection request", async () => {
    walletKit.authModal.mockRejectedValue({
      code: -4,
      message: "The user rejected this request.",
    });
    renderWalletHeader();

    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Connection request declined. Approve the request in your wallet to connect.",
    );
  });

  it("hides provider details for an unexpected failure", async () => {
    walletKit.authModal.mockRejectedValue(
      new Error("RPC failed for account SECRET_ACCOUNT"),
    );
    renderWalletHeader();

    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));

    const alertText = (await screen.findByRole("alert")).textContent;
    expect(alertText).toBe(
      "We couldn't connect to your wallet. Please try again.",
    );
    expect(alertText).not.toContain("SECRET_ACCOUNT");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      "SECRET_ACCOUNT",
    );
  });

  it("clears a stale error during retry and after a successful connection", async () => {
    let finishRetry: (value: { address: string }) => void = () => undefined;
    const pendingRetry = new Promise<{ address: string }>((resolve) => {
      finishRetry = resolve;
    });
    walletKit.authModal
      .mockRejectedValueOnce(new Error("Unexpected provider failure"))
      .mockReturnValueOnce(pendingRetry);
    renderWalletHeader();

    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));

    expect(
      screen
        .getByRole("button", { name: "Connecting..." })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Connecting to wallet…",
    );
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("alert")).toBeNull();

    finishRetry({ address: "GCONNECTED" });

    expect(
      await screen.findByRole("button", { name: "Disconnect" }),
    ).not.toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Wallet connected.");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("preserves disconnect behavior after a successful connection", async () => {
    walletKit.authModal.mockResolvedValue({ address: "GCONNECTED" });
    renderWalletHeader();

    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Disconnect" }),
    );

    expect(walletKit.disconnect).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("button", { name: "Connect Wallet" }),
    ).not.toBeNull();
  });

  it("stores the address returned by a successful connection", async () => {
    walletKit.authModal.mockResolvedValue({ address: "GSUCCESS" });
    renderWalletHeader();

    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));
    expect(
      await screen.findByRole("button", { name: "Disconnect" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Wallet connected.");
  });

  it("updates the address from STATE_UPDATED events", async () => {
    let emitState: ((event: { payload: { address?: string | null } }) => void) |
      undefined;
    const unsubscribe = vi.fn();
    walletKit.on.mockImplementation((_type, handler) => {
      emitState = handler as typeof emitState;
      return unsubscribe;
    });
    walletKit.authModal.mockResolvedValue({ address: "GINITIAL" });
    renderWalletHeader();

    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));
    await screen.findByRole("button", { name: "Disconnect" });

    emitState?.({ payload: { address: "GUPDATED" } });
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Wallet connected."),
    );

    emitState?.({ payload: { address: null } });
    expect(
      await screen.findByRole("button", { name: "Connect Wallet" }),
    ).toBeInTheDocument();
  });

  it("removes event subscriptions on unmount", () => {
    const unsubscribe = vi.fn();
    walletKit.on.mockReturnValue(unsubscribe);
    const { unmount } = renderWalletHeader();
    // Trigger ensureKit + subscription via connect attempt
    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("ignores overlapping connection attempts", async () => {
    let finishFirst: (value: { address: string }) => void = () => undefined;
    const first = new Promise<{ address: string }>((resolve) => {
      finishFirst = resolve;
    });
    walletKit.authModal.mockReturnValueOnce(first);
    renderWalletHeader();

    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));
    fireEvent.click(screen.getByRole("button", { name: "Connecting..." }));

    expect(walletKit.authModal).toHaveBeenCalledTimes(1);
    finishFirst({ address: "GONCE" });
    expect(
      await screen.findByRole("button", { name: "Disconnect" }),
    ).toBeInTheDocument();
  });
});

describe("multi-wallet connect → balance smoke matrix", () => {
  beforeEach(() => {
    resetWalletKitForTests();
    walletKit.authModal.mockReset();
    walletKit.disconnect.mockReset();
    walletKit.getNetwork.mockReset();
    walletKit.getNetwork.mockResolvedValue({
      network: "testnet",
      networkPassphrase: "Test SDF Network ; September 2015",
    });
    walletKit.init.mockReset();
    walletKit.on.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    resetWalletKitForTests();
    vi.restoreAllMocks();
  });

  it("keeps Freighter as the default UI module id", () => {
    expect(getDefaultWalletModuleIdForUi()).toBe("freighter");
  });

  it("runs connect → NFT balance for Freighter then Lobstr without crashing", async () => {
    const { FreighterModule } = await import(
      "@creit.tech/stellar-wallets-kit/modules/freighter"
    );
    const { LobstrModule } = await import(
      "@creit.tech/stellar-wallets-kit/modules/lobstr"
    );

    const balanceByAccount: Record<string, number> = {
      GFREIGHTER: 1,
      GLOBSTR: 3,
    };

    setWalletKitModuleFactoryForTests(() => [new FreighterModule()]);
    walletKit.authModal.mockResolvedValue({ address: "GFREIGHTER" });
    renderWalletWithProbe();

    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));
    expect(
      await screen.findByRole("button", { name: "Disconnect" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("connected-address").textContent).toBe(
      "GFREIGHTER",
    );

    const freighterInit = walletKit.init.mock.calls.at(-1)?.[0] as {
      modules: Array<{ productId: string }>;
    };
    expect(freighterInit.modules.map((module) => module.productId)).toEqual([
      "freighter",
    ]);

    const freighterBalance = await readMembershipBalance(
      "GFREIGHTER",
      async (account) => balanceByAccount[account] ?? 0,
    );
    expect(membershipFromBalance(freighterBalance)).toBe("member");

    cleanup();
    walletKit.init.mockClear();
    walletKit.authModal.mockReset();
    walletKit.authModal.mockResolvedValue({ address: "GLOBSTR" });
    setWalletKitModuleFactoryForTests(() => [new LobstrModule()]);

    expect(() => renderWalletWithProbe()).not.toThrow();
    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));
    expect(
      await screen.findByRole("button", { name: "Disconnect" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("connected-address").textContent).toBe("GLOBSTR");

    const lobstrInit = walletKit.init.mock.calls.at(-1)?.[0] as {
      modules: Array<{ productId: string }>;
    };
    expect(lobstrInit.modules.map((module) => module.productId)).toEqual([
      "lobstr",
    ]);

    const lobstrBalance = await readMembershipBalance(
      "GLOBSTR",
      async (account) => balanceByAccount[account] ?? 0,
    );
    expect(membershipFromBalance(lobstrBalance)).toBe("member");
  });

  it("keeps Freighter unavailable copy after a Lobstr module smoke switch", async () => {
    const { LobstrModule } = await import(
      "@creit.tech/stellar-wallets-kit/modules/lobstr"
    );
    setWalletKitModuleFactoryForTests(() => [new LobstrModule()]);
    walletKit.authModal.mockRejectedValue(new Error("Freighter is not connected"));
    renderWalletHeader();

    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Freighter is unavailable. Install or unlock the wallet, then try again.",
    );
  });
});
