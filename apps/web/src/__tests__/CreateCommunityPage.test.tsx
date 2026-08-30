import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const wallet = vi.hoisted(() => ({
  useWallet: vi.fn(),
}));

vi.mock("@/context/WalletProvider", () => ({
  useWallet: wallet.useWallet,
}));

import CreateCommunityPage from "@/app/(app)/communities/create/page";

function enterValidMetadata() {
  fireEvent.change(screen.getByLabelText(/Community name/), {
    target: { value: "Builders Guild" },
  });
  fireEvent.change(screen.getByLabelText(/NFT symbol/), {
    target: { value: "BUILD" },
  });
  fireEvent.change(screen.getByLabelText(/Description/), {
    target: { value: "A community for public-goods builders." },
  });
  fireEvent.change(screen.getByLabelText(/NFT collection URI/), {
    target: { value: "ipfs://bafy/collection.json" },
  });
  fireEvent.change(screen.getByLabelText(/Community metadata URI/), {
    target: { value: "https://builders.example/community.json" },
  });
}

describe("CreateCommunityPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    wallet.useWallet.mockReturnValue({
      address: null,
      walletNetwork: null,
      walletNetworkPassphrase: null,
      connect: vi.fn(),
      signTransaction: vi.fn(),
      isConnecting: false,
    });
  });

  it("announces inline errors for every missing required metadata field", async () => {
    render(<CreateCommunityPage />);
    fireEvent.click(
      screen.getByRole("button", { name: "Continue to governance" }),
    );

    expect(screen.getByText("Enter a community name.")).toHaveAttribute(
      "role",
      "alert",
    );
    expect(screen.getByText("Enter a collection symbol.")).toBeInTheDocument();
    expect(
      screen.getByText("Enter a public community description."),
    ).toBeInTheDocument();
    expect(screen.getByText("Enter the NFT collection URI.")).toBeInTheDocument();
    expect(
      screen.getByText("Enter the community metadata URI."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Community name/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("rejects invalid public URLs and incomplete optional links", () => {
    render(<CreateCommunityPage />);
    enterValidMetadata();
    fireEvent.change(screen.getByLabelText(/Logo URI/), {
      target: { value: "http://insecure.example/logo.png" },
    });
    fireEvent.change(screen.getByLabelText("Link label"), {
      target: { value: "Chat" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Continue to governance" }),
    );

    expect(
      screen.getByText(
        "Use a valid ipfs:// or https:// URI of at most 256 bytes.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Enter the HTTPS link URL.")).toBeInTheDocument();
    expect(
      screen.queryByText("Metadata validated and saved for this wizard session."),
    ).not.toBeInTheDocument();
  });

  it("advances valid metadata without a transaction and preserves it on back", () => {
    render(<CreateCommunityPage />);
    enterValidMetadata();

    fireEvent.click(
      screen.getByRole("button", { name: "Continue to governance" }),
    );

    expect(
      screen.getByText("Metadata validated and saved for this wizard session."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Proposal threshold/)).toHaveValue("1");
    expect(screen.getByLabelText(/Voting period/)).toHaveValue("10000");

    fireEvent.click(screen.getByRole("button", { name: "Back to metadata" }));
    expect(screen.getByLabelText(/Community name/)).toHaveValue(
      "Builders Guild",
    );
    expect(screen.getByLabelText(/Community metadata URI/)).toHaveValue(
      "https://builders.example/community.json",
    );
  });

  it("restores metadata for the current wizard session after remount", async () => {
    const { unmount } = render(<CreateCommunityPage />);
    enterValidMetadata();
    await waitFor(() =>
      expect(
        sessionStorage.getItem("stolla:community-wizard:testnet:v1"),
      ).toContain("Builders Guild"),
    );
    unmount();

    render(<CreateCommunityPage />);

    await waitFor(() =>
      expect(screen.getByLabelText(/Community name/)).toHaveValue(
        "Builders Guild",
      ),
    );
    expect(screen.getByLabelText(/NFT collection URI/)).toHaveValue(
      "ipfs://bafy/collection.json",
    );
  });

  it("rejects governance boundaries and contradictory ledger periods", () => {
    render(<CreateCommunityPage />);
    enterValidMetadata();
    fireEvent.click(
      screen.getByRole("button", { name: "Continue to governance" }),
    );

    fireEvent.change(screen.getByLabelText(/Proposal threshold/), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByLabelText(/Quorum/), {
      target: { value: "-1" },
    });
    fireEvent.change(screen.getByLabelText(/Voting delay/), {
      target: { value: "20" },
    });
    fireEvent.change(screen.getByLabelText(/Voting period/), {
      target: { value: "20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review community" }));

    expect(screen.getAllByText(/maximum u128 value/)).toHaveLength(2);
    expect(
      screen.getByText("Voting period must be greater than the voting delay."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Deployment target"),
    ).not.toBeInTheDocument();
  });

  it("preserves governance values through review edit navigation", () => {
    render(<CreateCommunityPage />);
    enterValidMetadata();
    fireEvent.click(
      screen.getByRole("button", { name: "Continue to governance" }),
    );
    fireEvent.change(screen.getByLabelText(/Quorum/), {
      target: { value: "25" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review community" }));

    expect(screen.getByText("Deployment target")).toBeInTheDocument();
    expect(screen.getByText("25 NFT votes")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Simulate deployment" }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Edit governance" }));
    expect(screen.getByLabelText(/Quorum/)).toHaveValue("25");
  });

  it("invalidates review confirmation when the connected account changes", async () => {
    wallet.useWallet.mockReturnValue({
      address: "GOLDACCOUNT",
      walletNetwork: "testnet",
      walletNetworkPassphrase: "Test SDF Network ; September 2015",
      connect: vi.fn(),
      signTransaction: vi.fn(),
      isConnecting: false,
    });
    const { rerender } = render(<CreateCommunityPage />);
    enterValidMetadata();
    fireEvent.click(
      screen.getByRole("button", { name: "Continue to governance" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Review community" }));
    fireEvent.click(
      screen.getByLabelText(/I confirm that these metadata/),
    );
    expect(screen.getByLabelText(/I confirm that these metadata/)).toBeChecked();

    wallet.useWallet.mockReturnValue({
      address: "GNEWACCOUNT",
      walletNetwork: "testnet",
      walletNetworkPassphrase: "Test SDF Network ; September 2015",
      connect: vi.fn(),
      signTransaction: vi.fn(),
      isConnecting: false,
    });
    rerender(<CreateCommunityPage />);

    await waitFor(() =>
      expect(
        screen.getByLabelText(/I confirm that these metadata/),
      ).not.toBeChecked(),
    );
    expect(
      screen.getByText(/Connected account changed. Review and confirm/),
    ).toBeInTheDocument();
    expect(screen.getByText("Builders Guild")).toBeInTheDocument();
  });

  it("discards a dirty session draft explicitly", async () => {
    render(<CreateCommunityPage />);
    fireEvent.change(screen.getByLabelText(/Community name/), {
      target: { value: "Temporary DAO" },
    });
    const discard = await screen.findByRole("button", { name: "Discard draft" });
    fireEvent.click(discard);

    expect(screen.getByLabelText(/Community name/)).toHaveValue("");
    await waitFor(() =>
      expect(
        sessionStorage.getItem("stolla:community-wizard:testnet:v1"),
      ).toBeNull(),
    );
    expect(screen.getByRole("heading", { name: "Describe your community" })).toHaveFocus();
  });

  it("cancels destructive discard without changing dirty values", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    render(<CreateCommunityPage />);
    fireEvent.change(screen.getByLabelText(/Community name/), {
      target: { value: "Keep this DAO" },
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Discard draft" }),
    );
    expect(screen.getByLabelText(/Community name/)).toHaveValue("Keep this DAO");
  });

  it("restarts an empty wizard without destructive confirmation", () => {
    render(<CreateCommunityPage />);
    fireEvent.click(screen.getByRole("button", { name: "Restart wizard" }));
    expect(window.confirm).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Community name/)).toHaveValue("");
  });

  it("hides discard while submitted deployment recovery is present", async () => {
    sessionStorage.setItem(
      "stolla:community-deployment:testnet:v1",
      JSON.stringify({
        version: 1,
        network: "testnet",
        transactionHash: "ab".repeat(32),
        expectedRecord: {
          id: "cd".repeat(32),
          nftContract: `C${"B".repeat(55)}`,
          governorContract: `C${"C".repeat(55)}`,
          creator: "GADMIN",
          communityOwner: "GADMIN",
          createdAtLedger: 1,
          creationIndex: 1,
          metadataUri: "https://example.test/community.json",
          metadataHash: "12".repeat(32),
          metadataSchemaVersion: 1,
        },
        submittedAt: 1,
      }),
    );
    render(<CreateCommunityPage />);
    enterValidMetadata();
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /Discard draft|Restart wizard/ }),
      ).not.toBeInTheDocument(),
    );
  });

  it("warns beforeunload while the session draft is dirty", async () => {
    render(<CreateCommunityPage />);
    fireEvent.change(screen.getByLabelText(/Community name/), {
      target: { value: "Dirty DAO" },
    });
    await waitFor(() =>
      expect(
        sessionStorage.getItem("stolla:community-wizard:testnet:v1"),
      ).toContain("Dirty DAO"),
    );

    const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
    Object.defineProperty(event, "returnValue", {
      writable: true,
      value: undefined,
    });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
