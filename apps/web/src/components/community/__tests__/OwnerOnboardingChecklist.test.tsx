import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/context/WalletProvider", async () => {
  const React = await import("react");
  const WalletContext = React.createContext<unknown>(null);
  return {
    WalletContext,
    useOptionalWallet: () => React.useContext(WalletContext),
  };
});

import { atlasCommunity } from "@/test/fixtures/communities";
import { OwnerOnboardingChecklist } from "../OwnerOnboardingChecklist";

describe("OwnerOnboardingChecklist (#400)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("hides the checklist for non-owners and disconnected wallets", () => {
    const { rerender } = render(
      <OwnerOnboardingChecklist community={atlasCommunity} walletAddress={null} />,
    );
    expect(
      screen.queryByTestId("owner-onboarding-checklist"),
    ).not.toBeInTheDocument();

    rerender(
      <OwnerOnboardingChecklist
        community={atlasCommunity}
        walletAddress="GNON_OWNER_WALLET"
      />,
    );
    expect(
      screen.queryByTestId("owner-onboarding-checklist"),
    ).not.toBeInTheDocument();
  });

  it("renders for the community owner, persists step completion, and supports reversible dismissal", () => {
    const owner = atlasCommunity.record.communityOwner;
    const { unmount } = render(
      <OwnerOnboardingChecklist
        community={atlasCommunity}
        walletAddress={owner}
      />,
    );

    expect(
      screen.getByTestId("owner-onboarding-checklist"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go to minting" }),
    ).toHaveAttribute("href", `/community?community=${atlasCommunity.record.id}`);

    const mintCheckbox = screen.getByRole("checkbox", {
      name: /Mint initial membership NFTs/i,
    });
    expect(mintCheckbox).not.toBeChecked();
    fireEvent.click(mintCheckbox);
    expect(mintCheckbox).toBeChecked();

    // Dismiss checklist -> reversible
    fireEvent.click(screen.getByRole("button", { name: "Dismiss checklist" }));
    expect(
      screen.queryByTestId("owner-onboarding-checklist"),
    ).not.toBeInTheDocument();

    // Remount -> stays dismissed and restores checked step when re-opened
    unmount();
    render(
      <OwnerOnboardingChecklist
        community={atlasCommunity}
        walletAddress={owner}
      />,
    );
    const restoreButton = screen.getByRole("button", {
      name: "Show creator onboarding checklist",
    });
    fireEvent.click(restoreButton);
    expect(
      screen.getByRole("checkbox", { name: /Mint initial membership NFTs/i }),
    ).toBeChecked();
  });
});
