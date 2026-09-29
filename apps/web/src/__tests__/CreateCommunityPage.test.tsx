import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IpfsPinError, type IpfsPinClient } from "@/lib/ipfs/pin";

const wallet = vi.hoisted(() => ({
  useWallet: vi.fn(),
}));
const bridge = vi.hoisted(() => ({
  getE2EBridge: vi.fn(),
}));

vi.mock("@/context/WalletProvider", () => ({
  useWallet: wallet.useWallet,
}));
vi.mock("@/lib/e2eMock", () => ({
  getE2EBridge: bridge.getE2EBridge,
}));

import CreateCommunityPage from "@/app/(app)/communities/create/page";
import {
  MOCK_ACCOUNT_ALICE,
  MOCK_CONTRACT_B,
  MOCK_GOVERNOR_CONTRACT_ID,
} from "@/test-support/stellar/fixtures";

const STORAGE_KEY = "stolla:community-wizard:testnet:v2";
const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

function connectedWallet(address = MOCK_ACCOUNT_ALICE) {
  return {
    address,
    walletNetwork: "testnet",
    walletNetworkPassphrase: TESTNET_PASSPHRASE,
    connect: vi.fn(),
    signTransaction: vi.fn(),
    isConnecting: false,
  };
}

function fakePin(): IpfsPinClient & { pinFile: ReturnType<typeof vi.fn>; pinJson: ReturnType<typeof vi.fn> } {
  return {
    pinFile: vi.fn(async (file: File) => ({
      cid: "bafylogo",
      uri: "ipfs://bafylogo",
      size: file.size,
    })),
    pinJson: vi.fn(async (bytes: Uint8Array, name: string) => ({
      cid: `bafy-${name}`,
      uri: `ipfs://bafy-${name}`,
      size: bytes.length,
    })),
  };
}

function deploymentAdapter() {
  return {
    simulate: vi.fn(async (input: { payload: unknown; factoryId: string; creator: string; networkPassphrase: string }) => ({
      invocation: {
        contractId: input.factoryId,
        method: "create_community" as const,
        sourceAccount: input.creator,
        networkPassphrase: input.networkPassphrase,
        metadataHash: "12".repeat(32),
        externalKey: "12".repeat(32),
        args: [],
      },
      feeStroops: "12345678",
      expectedRecord: {
        id: "ab".repeat(32),
        nftContract: MOCK_CONTRACT_B,
        governorContract: MOCK_GOVERNOR_CONTRACT_ID,
        creator: MOCK_ACCOUNT_ALICE,
        communityOwner: MOCK_ACCOUNT_ALICE,
        createdAtLedger: 10,
        creationIndex: 1,
        metadataUri: "ipfs://bafy-community.json",
        metadataHash: "12".repeat(32),
        metadataSchemaVersion: 1 as const,
      },
      sequence: "2",
      expiresAt: 999,
      prepared: {},
    })),
    signAndSubmit: vi.fn(),
    transactionStatus: vi.fn(),
    verifyRegistry: vi.fn(),
    readFactoryOwner: vi.fn(async () => MOCK_ACCOUNT_ALICE),
  };
}

function enterValidMetadata() {
  fireEvent.change(screen.getByLabelText(/Community name/), {
    target: { value: "Builders Guild" },
  });
  fireEvent.change(screen.getByLabelText(/NFT symbol/), {
    target: { value: "BUILD" },
  });
  fireEvent.change(screen.getByLabelText(/^Description/), {
    target: { value: "A community for public-goods builders." },
  });
}

function selectLogo(file: File) {
  const input = screen.getByLabelText("Logo image") as HTMLInputElement;
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
}

function goToReview() {
  fireEvent.click(screen.getByRole("button", { name: "Continue to governance" }));
  fireEvent.click(screen.getByRole("button", { name: "Review community" }));
}

const simulateButton = () =>
  screen.getByRole("button", { name: /Simulate deployment|Rebuild simulation/ });

describe("CreateCommunityPage", () => {
  let pin: ReturnType<typeof fakePin>;
  let deployment: ReturnType<typeof deploymentAdapter>;

  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    pin = fakePin();
    deployment = deploymentAdapter();
    bridge.getE2EBridge.mockReturnValue({ pin, deployment });
    wallet.useWallet.mockReturnValue({
      address: null,
      walletNetwork: null,
      walletNetworkPassphrase: null,
      connect: vi.fn(),
      signTransaction: vi.fn(),
      isConnecting: false,
    });
  });

  it("has no URI inputs and announces inline errors only for authoring fields", () => {
    render(<CreateCommunityPage />);

    expect(screen.queryByLabelText(/collection URI/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/metadata URI/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Logo URI/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Logo image")).toHaveAttribute("type", "file");

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
    expect(screen.queryByText(/Enter the NFT collection URI/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Community name/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("rejects a disallowed logo file and incomplete optional links before pinning", () => {
    render(<CreateCommunityPage />);
    enterValidMetadata();
    selectLogo(new File(["x"], "logo.bmp", { type: "image/bmp" }));
    fireEvent.change(screen.getByLabelText("Link label"), {
      target: { value: "Chat" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Continue to governance" }),
    );

    expect(screen.getByText("Use a PNG, JPEG, WebP, GIF, or SVG image.")).toHaveAttribute(
      "role",
      "alert",
    );
    expect(screen.getByText("Enter the HTTPS link URL.")).toBeInTheDocument();
    expect(
      screen.queryByText("Metadata validated and saved for this wizard session."),
    ).not.toBeInTheDocument();
    expect(pin.pinFile).not.toHaveBeenCalled();
  });

  it("advances valid metadata without any URI strings and preserves it on back", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Back to identity" }));
    expect(screen.getByLabelText(/Community name/)).toHaveValue(
      "Builders Guild",
    );
    expect(screen.getByLabelText(/NFT symbol/)).toHaveValue("BUILD");
  });

  it("restores metadata for the current wizard session after remount", async () => {
    const { unmount } = render(<CreateCommunityPage />);
    enterValidMetadata();
    await waitFor(() =>
      expect(sessionStorage.getItem(STORAGE_KEY)).toContain("Builders Guild"),
    );
    expect(sessionStorage.getItem(STORAGE_KEY)).not.toContain("collectionUri");
    unmount();

    render(<CreateCommunityPage />);

    await waitFor(() =>
      expect(screen.getByLabelText(/Community name/)).toHaveValue(
        "Builders Guild",
      ),
    );
    expect(screen.getByLabelText(/NFT symbol/)).toHaveValue("BUILD");
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
    expect(screen.queryByText("Deployment target")).not.toBeInTheDocument();
  });

  it("keeps simulation locked until the documents are pinned, then passes the generated payload", async () => {
    wallet.useWallet.mockReturnValue(connectedWallet());
    render(<CreateCommunityPage />);
    enterValidMetadata();
    fireEvent.click(screen.getByRole("button", { name: "Continue to governance" }));
    fireEvent.change(screen.getByLabelText(/Quorum/), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "Review community" }));

    expect(screen.getByText("Deployment target")).toBeInTheDocument();
    expect(screen.getByText("25 NFT votes")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByLabelText("Community metadata JSON preview"),
      ).toHaveTextContent('"name":"Builders Guild"'),
    );
    fireEvent.click(screen.getByLabelText(/I confirm that these metadata/));
    await waitFor(() => expect(deployment.readFactoryOwner).toHaveBeenCalled());
    expect(simulateButton()).toBeDisabled();
    expect(
      screen.getByText(/Pin the metadata documents above to unlock simulation/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Prepare metadata" }));

    expect(
      await screen.findByText(/Metadata pinned to IPFS/),
    ).toBeInTheDocument();
    expect(pin.pinFile).not.toHaveBeenCalled();
    expect(pin.pinJson).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/metadata_uri: ipfs:\/\/bafy-community\.json/)).toBeInTheDocument();
    expect(screen.getByText(/collection_uri: ipfs:\/\/bafy-collection\.json/)).toBeInTheDocument();
    const hash = screen.getByTestId("metadata-hash").textContent ?? "";
    expect(hash).toMatch(/^[0-9a-f]{64}$/);

    await waitFor(() => expect(simulateButton()).toBeEnabled());
    fireEvent.click(simulateButton());
    await waitFor(() => expect(deployment.simulate).toHaveBeenCalledTimes(1));
    expect(deployment.simulate.mock.calls[0][0].payload).toEqual({
      collectionUri: "ipfs://bafy-collection.json",
      metadataUri: "ipfs://bafy-community.json",
      metadataHash: hash,
    });
  });

  it("pins the logo first and threads its URI through both documents", async () => {
    wallet.useWallet.mockReturnValue(connectedWallet());
    render(<CreateCommunityPage />);
    enterValidMetadata();
    selectLogo(new File(["png-bytes"], "logo.png", { type: "image/png" }));
    expect(screen.getByText(/Selected logo\.png/)).toBeInTheDocument();
    goToReview();

    fireEvent.click(screen.getByRole("button", { name: "Prepare metadata" }));
    expect(await screen.findByText(/Metadata pinned to IPFS/)).toBeInTheDocument();

    expect(pin.pinFile).toHaveBeenCalledTimes(1);
    expect(pin.pinFile.mock.invocationCallOrder[0]).toBeLessThan(
      pin.pinJson.mock.invocationCallOrder[0],
    );
    expect(
      screen.getByLabelText("Community metadata JSON preview"),
    ).toHaveTextContent('"logo":"ipfs://bafylogo"');
    expect(
      screen.getByLabelText("Collection metadata JSON preview"),
    ).toHaveTextContent('"image":"ipfs://bafylogo"');
    expect(screen.getByText(/logo: ipfs:\/\/bafylogo/)).toBeInTheDocument();
  });

  it("keeps deployment locked and offers retry when pinning fails, preserving the draft", async () => {
    wallet.useWallet.mockReturnValue(connectedWallet());
    pin.pinJson.mockRejectedValueOnce(
      new IpfsPinError("provider", "Pinata is unavailable."),
    );
    render(<CreateCommunityPage />);
    enterValidMetadata();
    goToReview();
    fireEvent.click(screen.getByLabelText(/I confirm that these metadata/));

    fireEvent.click(screen.getByRole("button", { name: "Prepare metadata" }));

    expect(
      await screen.findByText(/Pinning failed: Pinata is unavailable\./),
    ).toHaveAttribute("role", "alert");
    expect(simulateButton()).toBeDisabled();
    expect(screen.getByText("Builders Guild")).toBeInTheDocument();
    expect(screen.getByText("BUILD")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry pinning" }));
    expect(await screen.findByText(/Metadata pinned to IPFS/)).toBeInTheDocument();
    await waitFor(() => expect(simulateButton()).toBeEnabled());
  });

  it("reports a missing PINATA_JWT as a configuration error and never simulates", async () => {
    wallet.useWallet.mockReturnValue(connectedWallet());
    pin.pinJson.mockRejectedValue(
      new IpfsPinError(
        "config",
        "IPFS pinning is not configured on this server. Set PINATA_JWT before creating communities or minting.",
      ),
    );
    render(<CreateCommunityPage />);
    enterValidMetadata();
    goToReview();
    fireEvent.click(screen.getByLabelText(/I confirm that these metadata/));

    fireEvent.click(screen.getByRole("button", { name: "Prepare metadata" }));

    expect(await screen.findByText(/Set PINATA_JWT/)).toBeInTheDocument();
    expect(screen.getByText(/Retrying will not help/)).toBeInTheDocument();
    expect(simulateButton()).toBeDisabled();
    expect(deployment.simulate).not.toHaveBeenCalled();
  });

  it("invalidates pinned documents when the draft changes afterwards", async () => {
    wallet.useWallet.mockReturnValue(connectedWallet());
    render(<CreateCommunityPage />);
    enterValidMetadata();
    goToReview();
    fireEvent.click(screen.getByRole("button", { name: "Prepare metadata" }));
    expect(await screen.findByText(/Metadata pinned to IPFS/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit metadata" }));
    fireEvent.change(screen.getByLabelText(/Community name/), {
      target: { value: "Renamed Guild" },
    });
    goToReview();

    await waitFor(() =>
      expect(
        screen.queryByText(/Metadata pinned to IPFS/),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Prepare metadata" })).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByLabelText("Community metadata JSON preview"),
      ).toHaveTextContent('"name":"Renamed Guild"'),
    );
    fireEvent.click(screen.getByLabelText(/I confirm that these metadata/));
    await waitFor(() => expect(deployment.readFactoryOwner).toHaveBeenCalled());
    expect(simulateButton()).toBeDisabled();
  });

  it("invalidates review confirmation when the connected account changes", async () => {
    wallet.useWallet.mockReturnValue(connectedWallet("GOLDACCOUNT"));
    const { rerender } = render(<CreateCommunityPage />);
    enterValidMetadata();
    goToReview();
    fireEvent.click(
      screen.getByLabelText(/I confirm that these metadata/),
    );
    expect(screen.getByLabelText(/I confirm that these metadata/)).toBeChecked();

    wallet.useWallet.mockReturnValue(connectedWallet("GNEWACCOUNT"));
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
      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull(),
    );
    expect(screen.getByRole("heading", { name: "Name your community" })).toHaveFocus();
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
          nftContract: MOCK_CONTRACT_B,
          governorContract: MOCK_GOVERNOR_CONTRACT_ID,
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
      expect(sessionStorage.getItem(STORAGE_KEY)).toContain("Dirty DAO"),
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
