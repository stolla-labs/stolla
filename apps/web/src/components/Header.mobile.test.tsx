import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Header } from "./Header";
import { WalletContext } from "@/context/WalletProvider";

let currentPathname = "/communities";

vi.mock("@creit.tech/stellar-wallets-kit/modules/freighter", () => ({
  FreighterModule: class FreighterModule {},
}));

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
}));

vi.mock("@/components/CommunitySwitcher", () => ({
  CommunitySwitcher: () => (
    <button type="button" aria-label="Choose community">
      Choose community
    </button>
  ),
}));

function renderHeaderWithWallet(overrides: {
  address?: string | null;
  connect?: () => Promise<void>;
  disconnect?: () => void;
}) {
  const connect = overrides.connect ?? vi.fn(async () => undefined);
  const disconnect = overrides.disconnect ?? vi.fn();
  return render(
    <WalletContext.Provider
      value={{
        address: overrides.address ?? null,
        walletNetwork: "testnet",
        walletNetworkPassphrase: "Test SDF Network ; September 2015",
        connect,
        disconnect,
        signTransaction: vi.fn(),
        isConnecting: false,
        connectionError: null,
      }}
    >
      <Header />
    </WalletContext.Provider>,
  );
}

describe("Header mobile chrome and wallet connect affordance", () => {
  afterEach(() => {
    cleanup();
    currentPathname = "/communities";
  });

  it("renders wallet connect affordance on /communities and /proposals with scrollable nav container", () => {
    currentPathname = "/communities";
    const { rerender } = renderHeaderWithWallet({ address: null });
    const connectBtn = screen.getByRole("button", { name: "Connect Wallet" });
    expect(connectBtn).toBeInTheDocument();
    expect(document.querySelector(".app-header-scroll")).not.toBeNull();

    currentPathname = "/proposals";
    rerender(
      <WalletContext.Provider
        value={{
          address: null,
          walletNetwork: "testnet",
          walletNetworkPassphrase: "Test SDF Network ; September 2015",
          connect: vi.fn(async () => undefined),
          disconnect: vi.fn(),
          signTransaction: vi.fn(),
          isConnecting: false,
          connectionError: null,
        }}
      >
        <Header />
      </WalletContext.Provider>,
    );
    expect(screen.getByRole("button", { name: "Connect Wallet" })).toBeInTheDocument();
  });

  it("opens and closes the mobile account menu and disconnects cleanly", () => {
    const disconnect = vi.fn();
    renderHeaderWithWallet({
      address: "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
      disconnect,
    });

    const mobileAccountTrigger = screen.getByRole("button", {
      name: /^Account /,
    });
    expect(mobileAccountTrigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(mobileAccountTrigger);
    expect(mobileAccountTrigger).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("menu", { name: "Account menu" });
    expect(menu.className).toContain("max-w-[calc(100vw-2rem)]");

    fireEvent.click(screen.getByRole("menuitem", { name: "Disconnect" }));
    expect(disconnect).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu", { name: "Account menu" })).toBeNull();
  });
});
