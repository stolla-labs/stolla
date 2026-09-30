import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/context/WalletProvider", () => ({
  useWallet: vi.fn(() => ({ address: null })),
  useOptionalWallet: vi.fn(() => ({ address: null })),
}));

import { CommunityMemberRoster } from "../CommunityMemberRoster";

describe("CommunityMemberRoster", () => {
  it("renders empty roster without wallet connect", async () => {
    const mockClient = {
      get_total_supply: vi.fn().mockResolvedValue({ result: 0n }),
    };

    render(
      <CommunityMemberRoster
        nftContractId="CNFT_TEST"
        client={mockClient}
      />,
    );

    expect(
      await screen.findByText(/No members yet\. Once membership NFTs are minted, holders appear here\./i),
    ).toBeInTheDocument();
    expect(screen.getByText("Member roster")).toBeInTheDocument();
  });

  it("renders single holder with tokens and identifies connected wallet with You badge", async () => {
    const userAddress = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
    const mockClient = {
      get_total_supply: vi.fn().mockResolvedValue({ result: 2n }),
      owner_of: vi.fn().mockImplementation(({ token_id }: { token_id: number }) => {
        return Promise.resolve({ result: userAddress });
      }),
    };

    render(
      <CommunityMemberRoster
        nftContractId="CNFT_TEST"
        client={mockClient}
        connectedAddress={userAddress}
      />,
    );

    expect(await screen.findByTestId("roster-you-badge")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("1 member (2 tokens minted)")).toBeInTheDocument();
    expect(screen.getByText("#0, #1")).toBeInTheDocument();
  });

  it("renders without You badge when viewing as disconnected or non-member", async () => {
    const mockClient = {
      get_total_supply: vi.fn().mockResolvedValue({ result: 1n }),
      owner_of: vi.fn().mockResolvedValue({ result: "GALICE1234567890123456789012345678901234567890123456789012" }),
    };

    render(
      <CommunityMemberRoster
        nftContractId="CNFT_TEST"
        client={mockClient}
        connectedAddress="GBOB1234567890123456789012345678901234567890123456789012"
      />,
    );

    expect(await screen.findByText("1 member (1 token minted)")).toBeInTheDocument();
    expect(screen.queryByTestId("roster-you-badge")).not.toBeInTheDocument();
  });

  it("displays actionable error state when RPC fails, allowing retry", async () => {
    const mockClient = {
      get_total_supply: vi
        .fn()
        .mockRejectedValueOnce(new Error("RPC node unreachable"))
        .mockResolvedValueOnce({ result: 0n }),
    };

    render(
      <CommunityMemberRoster
        nftContractId="CNFT_TEST"
        client={mockClient}
      />,
    );

    expect(
      await screen.findByText(/RPC node unreachable/i),
    ).toBeInTheDocument();

    const retryBtn = screen.getByRole("button", { name: /retry roster/i });
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);

    expect(
      await screen.findByText(/No members yet/i),
    ).toBeInTheDocument();
  });

  it("paginates when member count exceeds pageSize", async () => {
    const mockClient = {
      get_total_supply: vi.fn().mockResolvedValue({ result: 3n }),
      owner_of: vi.fn().mockImplementation(({ token_id }: { token_id: number }) => {
        return Promise.resolve({ result: `GHOLDER_${token_id}` });
      }),
    };

    render(
      <CommunityMemberRoster
        nftContractId="CNFT_TEST"
        client={mockClient}
        pageSize={2}
      />,
    );

    expect(await screen.findByText("Page 1 of 2")).toBeInTheDocument();

    const nextBtn = screen.getByRole("button", { name: /next page/i });
    fireEvent.click(nextBtn);

    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();

    const prevBtn = screen.getByRole("button", { name: /previous page/i });
    fireEvent.click(prevBtn);

    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  });
});
