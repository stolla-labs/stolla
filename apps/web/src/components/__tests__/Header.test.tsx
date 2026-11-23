import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Header } from "../Header";
import { useWallet } from "@/context/WalletProvider";

vi.mock("@/context/WalletProvider", () => ({
  useWallet: vi.fn(),
}));

const pathname = vi.hoisted(() => ({ value: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.value,
}));

vi.mock("@/components/CommunitySwitcher", () => ({
  CommunitySwitcher: () => (
    <button type="button" aria-label="Choose community">
      Choose community
    </button>
  ),
}));

const mockedUseWallet = vi.mocked(useWallet);

describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathname.value = "/";
  });

  it("shows a compact wallet trigger on small screens and supports keyboard disconnect", async () => {
    const disconnect = vi.fn();
    const address = "GBZ5Q6A3X7W9Q2A4B6C8D1E2F3G4H5I6J7K8L9M0N";
    mockedUseWallet.mockReturnValue({
      address,
      connect: vi.fn(),
      disconnect,
      signTransaction: vi.fn(),
      isConnecting: false,
      connectionError: null,
    } as ReturnType<typeof useWallet>);

    render(<Header />);

    const trigger = screen.getByRole("button", { name: /account/i });
    expect(trigger).toBeInTheDocument();

    fireEvent.click(trigger);

    const menu = await screen.findByRole("menu");
    expect(menu).toBeInTheDocument();
    expect(screen.getByText(/connected account/i)).toBeInTheDocument();
    expect(screen.getByText(address)).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    const disconnectButton = await screen.findByRole("menuitem", {
      name: /disconnect/i,
    });
    fireEvent.keyDown(disconnectButton, { key: "Enter" });
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("labels legacy collection distinctly and demotes Connect Wallet on communities routes", () => {
    mockedUseWallet.mockReturnValue({
      address: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTransaction: vi.fn(),
      isConnecting: false,
      connectionError: null,
    } as ReturnType<typeof useWallet>);

    pathname.value = "/communities";
    const { rerender } = render(<Header />);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(
      within(nav).getByRole("link", { name: "Communities" }),
    ).toBeInTheDocument();
    expect(
      within(nav).getByRole("link", { name: "Legacy collection" }),
    ).toHaveAttribute("href", "/community");
    expect(
      within(nav).queryByRole("link", { name: "Community" }),
    ).not.toBeInTheDocument();

    const wallet = screen.getByRole("button", { name: "Connect Wallet" });
    expect(wallet.className).toContain("border-shell-border");
    expect(wallet.className).not.toContain("bg-indigo-500");

    pathname.value = "/proposals";
    rerender(<Header />);
    const primaryWallet = screen.getByRole("button", { name: "Connect Wallet" });
    expect(primaryWallet.className).toContain("bg-shell-primary");
  });

  it("keeps focus order logo → nav → switcher → wallet", () => {
    mockedUseWallet.mockReturnValue({
      address: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTransaction: vi.fn(),
      isConnecting: false,
      connectionError: null,
    } as ReturnType<typeof useWallet>);

    render(<Header />);
    const logo = screen.getByRole("link", { name: "Stolla" });
    const communities = screen.getByRole("link", { name: "Communities" });
    const switcher = screen.getByRole("button", { name: "Choose community" });
    const wallet = screen.getByRole("button", { name: "Connect Wallet" });

    expect(logo.compareDocumentPosition(communities) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(communities.compareDocumentPosition(switcher) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(switcher.compareDocumentPosition(wallet) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
