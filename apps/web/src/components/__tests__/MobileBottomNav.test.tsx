import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileBottomNav } from "../MobileBottomNav";
import { useWallet } from "@/context/WalletProvider";

vi.mock("@/context/WalletProvider", () => ({ useWallet: vi.fn() }));
const pathname = vi.hoisted(() => ({ value: "/communities" }));
const view = vi.hoisted(() => ({ value: null as string | null }));
vi.mock("next/navigation", () => ({
  usePathname: () => pathname.value,
  useSearchParams: () => new URLSearchParams(view.value ? { view: view.value } : {}),
}));
const mockedWallet = vi.mocked(useWallet);
const wallet = (address: string | null, connect = vi.fn()) => ({
  address,
  connect,
  disconnect: vi.fn(),
  signTransaction: vi.fn(),
  isConnecting: false,
  connectionError: null,
}) as ReturnType<typeof useWallet>;

describe("MobileBottomNav", () => {
  beforeEach(() => {
    pathname.value = "/communities";
    view.value = null;
    mockedWallet.mockReturnValue(wallet("GWALLET"));
  });

  it("highlights nested routes for the active member loop", () => {
    const { rerender } = render(<MobileBottomNav />);
    expect(screen.getByRole("link", { name: "Explore" })).toHaveAttribute("aria-current", "page");

    pathname.value = "/activity";
    rerender(<MobileBottomNav />);
    expect(screen.getByRole("link", { name: "Activity" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Explore" })).not.toHaveAttribute("aria-current");

    view.value = "inbox";
    rerender(<MobileBottomNav />);
    expect(screen.getByRole("link", { name: "Inbox" })).toHaveAttribute("aria-current", "page");
  });

  it("shows an actionable Connect label when the wallet is disconnected", () => {
    const connect = vi.fn();
    mockedWallet.mockReturnValue(wallet(null, connect));
    render(<MobileBottomNav />);

    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(connect).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Account")).not.toBeInTheDocument();
  });
});

