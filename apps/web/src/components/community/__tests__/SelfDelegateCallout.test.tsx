import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  SelfDelegateCallout,
  isPositiveBalance,
  isZeroVotingPower,
} from "../SelfDelegateCallout";

const mockWallet = vi.hoisted(() => ({
  address: "GWALLET",
  signTransaction: vi.fn(),
  isConnecting: false,
}));

const mockContracts = vi.hoisted(() => ({
  createNftClient: vi.fn(),
}));

vi.mock("@/context/WalletProvider", () => ({
  useWallet: () => mockWallet,
}));

vi.mock("@/lib/contracts", () => ({
  createNftClient: mockContracts.createNftClient,
}));

describe("SelfDelegateCallout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("helper functions", () => {
    it("isPositiveBalance accurately evaluates various balance types", () => {
      expect(isPositiveBalance(null)).toBe(false);
      expect(isPositiveBalance(undefined)).toBe(false);
      expect(isPositiveBalance(0)).toBe(false);
      expect(isPositiveBalance(0n)).toBe(false);
      expect(isPositiveBalance(1)).toBe(true);
      expect(isPositiveBalance(5n)).toBe(true);
    });

    it("isZeroVotingPower accurately checks zero or empty votes", () => {
      expect(isZeroVotingPower(null)).toBe(true);
      expect(isZeroVotingPower(undefined)).toBe(true);
      expect(isZeroVotingPower(0)).toBe(true);
      expect(isZeroVotingPower(0n)).toBe(true);
      expect(isZeroVotingPower("0")).toBe(true);
      expect(isZeroVotingPower(" 0 ")).toBe(true);
      expect(isZeroVotingPower("—")).toBe(true);
      expect(isZeroVotingPower("")).toBe(true);
      expect(isZeroVotingPower(1)).toBe(false);
      expect(isZeroVotingPower(10n)).toBe(false);
      expect(isZeroVotingPower("1")).toBe(false);
    });
  });

  describe("visibility criteria", () => {
    it("does not render when balance is 0 or null", () => {
      const { container, rerender } = render(
        <SelfDelegateCallout balance={0} votes="0" />,
      );
      expect(container.firstChild).toBeNull();

      rerender(<SelfDelegateCallout balance={null} votes="0" />);
      expect(container.firstChild).toBeNull();
    });

    it("does not render when user already has voting power (votes > 0)", () => {
      const { container, rerender } = render(
        <SelfDelegateCallout balance={2} votes="1" />,
      );
      expect(container.firstChild).toBeNull();

      rerender(<SelfDelegateCallout balance={2} votes={10n} />);
      expect(container.firstChild).toBeNull();
    });

    it("renders CTA prominently when balance > 0 and votes == 0", () => {
      render(<SelfDelegateCallout balance={2} votes="0" />);

      expect(
        screen.getByRole("region", { name: "Self-delegation notice" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Delegate to myself" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/You hold 2 membership tokens, but have 0 voting power/i),
      ).toBeInTheDocument();
    });

    it("hides when user clicks the dismiss button", () => {
      render(<SelfDelegateCallout balance={1} votes="0" />);

      const dismissBtn = screen.getByRole("button", {
        name: "Dismiss self-delegation notice",
      });
      fireEvent.click(dismissBtn);

      expect(
        screen.queryByRole("region", { name: "Self-delegation notice" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("delegation execution and lifecycle", () => {
    it("calls onDelegate callback when provided", async () => {
      const onDelegate = vi.fn().mockResolvedValue(undefined);
      render(
        <SelfDelegateCallout
          balance={1}
          votes="0"
          onDelegate={onDelegate}
        />,
      );

      const delegateBtn = screen.getByRole("button", {
        name: "Delegate to myself",
      });
      fireEvent.click(delegateBtn);

      expect(onDelegate).toHaveBeenCalledTimes(1);
    });

    it("executes NFT client delegate and calls onDelegationSuccess on success", async () => {
      const sign = vi.fn().mockResolvedValue(undefined);
      const send = vi.fn().mockResolvedValue({ status: "SUCCESS", hash: "0x123" });
      const delegateMock = vi.fn().mockResolvedValue({ sign, send });
      mockContracts.createNftClient.mockReturnValue({ delegate: delegateMock });

      const onDelegationSuccess = vi.fn();

      render(
        <SelfDelegateCallout
          balance={1}
          votes="0"
          nftContractId="CNFT12345"
          onDelegationSuccess={onDelegationSuccess}
        />,
      );

      const delegateBtn = screen.getByRole("button", {
        name: "Delegate to myself",
      });
      fireEvent.click(delegateBtn);

      await waitFor(() => {
        expect(delegateMock).toHaveBeenCalledWith({
          account: "GWALLET",
          delegatee: "GWALLET",
        });
        expect(onDelegationSuccess).toHaveBeenCalledTimes(1);
      });
    });

    it("keeps the CTA button available if wallet rejection occurs", async () => {
      const sign = vi.fn().mockRejectedValue(new Error("User rejected"));
      const delegateMock = vi.fn().mockResolvedValue({ sign });
      mockContracts.createNftClient.mockReturnValue({ delegate: delegateMock });

      render(
        <SelfDelegateCallout
          balance={1}
          votes="0"
          nftContractId="CNFT12345"
        />,
      );

      const delegateBtn = screen.getByRole("button", {
        name: "Delegate to myself",
      });
      fireEvent.click(delegateBtn);

      await waitFor(() => {
        expect(delegateBtn).not.toBeDisabled();
      });
    });
  });
});
