import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { CommunityView } from "@/lib/community/types";
import { membershipFromBalance, membershipLabel } from "@/lib/community/membership";

const mocks = vi.hoisted(() => ({
  useWallet: vi.fn(),
  createReadOnlyNftClient: vi.fn(),
}));

vi.mock("@/context/WalletProvider", () => ({
  useWallet: mocks.useWallet,
}));

vi.mock("@/lib/contracts", () => ({
  createReadOnlyNftClient: mocks.createReadOnlyNftClient,
}));

import { CommunityCard } from "./CommunityCard";

const community: CommunityView = {
  record: {
    id: "aa".repeat(32),
    nftContract: "CNFT_COMMUNITY",
    governorContract: "CGOV_COMMUNITY",
    creator: "GCREATOR",
    communityOwner: "GOWNER",
    createdAtLedger: 100,
    creationIndex: 1,
    metadataUri: "ipfs://bafy/community.json",
    metadataHash: "bb".repeat(32),
    metadataSchemaVersion: 1,
  },
  metadata: {
    schemaVersion: 1,
    name: "Builders DAO",
    description: "A fixture community for membership badges.",
    externalLinks: [],
  },
  metadataError: null,
  governance: {
    votingDelay: 10,
    votingPeriod: 100,
    proposalThreshold: "1",
    quorum: "2",
    unavailableFields: [],
  },
};

describe("membership helpers", () => {
  it("maps balance to member / non-member", () => {
    expect(membershipFromBalance(0)).toBe("non_member");
    expect(membershipFromBalance(1)).toBe("member");
    expect(membershipLabel("disconnected")).toBeNull();
    expect(membershipLabel("member")).toBe("Member");
    expect(membershipLabel("non_member")).toBe("Not a member");
    expect(membershipLabel("unknown")).toBe("Membership unavailable");
  });
});

describe("CommunityCard membership indicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not claim membership when the wallet is disconnected", () => {
    mocks.useWallet.mockReturnValue({
      address: null,
      signTransaction: vi.fn(),
      isConnecting: false,
    });

    render(<CommunityCard community={community} />);

    expect(screen.getByText("Builders DAO")).toBeInTheDocument();
    expect(screen.queryByTestId("community-membership")).not.toBeInTheDocument();
    expect(screen.queryByText("Member")).not.toBeInTheDocument();
    expect(screen.queryByText("Not a member")).not.toBeInTheDocument();
    expect(mocks.createReadOnlyNftClient).not.toHaveBeenCalled();
  });

  it("shows member when the connected wallet balance is greater than zero", async () => {
    mocks.useWallet.mockReturnValue({
      address: "GWALLET",
      signTransaction: vi.fn(),
      isConnecting: false,
    });
    mocks.createReadOnlyNftClient.mockReturnValue({
      balance: vi.fn().mockResolvedValue({ result: 2 }),
    });

    render(<CommunityCard community={community} />);

    const badge = await screen.findByTestId("community-membership");
    expect(badge).toHaveAttribute("data-membership", "member");
    expect(badge).toHaveTextContent("Member");
    expect(mocks.createReadOnlyNftClient).toHaveBeenCalledWith("CNFT_COMMUNITY");
  });

  it("shows not a member when the connected wallet balance is zero", async () => {
    mocks.useWallet.mockReturnValue({
      address: "GWALLET",
      signTransaction: vi.fn(),
      isConnecting: false,
    });
    mocks.createReadOnlyNftClient.mockReturnValue({
      balance: vi.fn().mockResolvedValue({ result: 0 }),
    });

    render(<CommunityCard community={community} />);

    const badge = await screen.findByTestId("community-membership");
    expect(badge).toHaveAttribute("data-membership", "non_member");
    expect(badge).toHaveTextContent("Not a member");
  });

  it("degrades to membership unavailable when the NFT read fails", async () => {
    mocks.useWallet.mockReturnValue({
      address: "GWALLET",
      signTransaction: vi.fn(),
      isConnecting: false,
    });
    mocks.createReadOnlyNftClient.mockReturnValue({
      balance: vi.fn().mockRejectedValue(new Error("RPC down")),
    });

    render(<CommunityCard community={community} />);

    const badge = await screen.findByTestId("community-membership");
    expect(badge).toHaveAttribute("data-membership", "unknown");
    expect(badge).toHaveTextContent("Membership unavailable");
    // Card remains usable.
    expect(
      screen.getByRole("link", { name: /View Builders DAO community details/i }),
    ).toBeInTheDocument();
  });

  it("keeps the card usable if client construction throws", async () => {
    mocks.useWallet.mockReturnValue({
      address: "GWALLET",
      signTransaction: vi.fn(),
      isConnecting: false,
    });
    mocks.createReadOnlyNftClient.mockImplementation(() => {
      throw new Error("missing RPC config");
    });

    render(<CommunityCard community={community} />);

    await waitFor(() => {
      expect(screen.getByTestId("community-membership")).toHaveAttribute(
        "data-membership",
        "unknown",
      );
    });
    expect(screen.getByText("Builders DAO")).toBeInTheDocument();
  });

  it("renders a Paused badge when the community record status is paused", () => {
    mocks.useWallet.mockReturnValue({
      address: null,
      signTransaction: vi.fn(),
      isConnecting: false,
    });

    const pausedCommunity: CommunityView = {
      ...community,
      record: {
        ...community.record,
        status: "paused",
      },
    };

    render(<CommunityCard community={pausedCommunity} />);

    const badge = screen.getByTestId("community-status-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("Paused");
  });

  it("renders an Archived badge when the community record status is archived", () => {
    mocks.useWallet.mockReturnValue({
      address: null,
      signTransaction: vi.fn(),
      isConnecting: false,
    });

    const archivedCommunity: CommunityView = {
      ...community,
      record: {
        ...community.record,
        status: "archived",
      },
    };

    render(<CommunityCard community={archivedCommunity} />);

    const badge = screen.getByTestId("community-status-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("Archived");
  });
});
