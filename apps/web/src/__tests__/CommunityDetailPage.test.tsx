/** Covers issue #149: community detail and scoped proposal navigation states. */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommunityDetailResult } from "@/lib/community/types";
import { CommunityRegistryProvider } from "@/lib/community/CommunityRegistryProvider";

const mocks = vi.hoisted(() => ({
  useParams: vi.fn(),
  getCommunity: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: mocks.useParams,
}));
import CommunityDetailPage from "@/app/(app)/communities/[id]/page";

const COMMUNITY_ID = "ab".repeat(32);
const registry = { list: vi.fn(), get: mocks.getCommunity };

function renderPage() {
  return render(
    <CommunityRegistryProvider registry={registry}>
      <CommunityDetailPage />
    </CommunityRegistryProvider>,
  );
}

const foundResult: CommunityDetailResult = {
  status: "found",
  community: {
    record: {
      id: COMMUNITY_ID,
      nftContract: `C${"A".repeat(55)}`,
      governorContract: `C${"B".repeat(55)}`,
      creator: `G${"C".repeat(55)}`,
      communityOwner: `G${"D".repeat(55)}`,
      createdAtLedger: 123,
      creationIndex: 4,
      metadataUri: "https://example.test/community.json",
      metadataHash: "cd".repeat(32),
      metadataSchemaVersion: 1,
    },
    metadata: {
      schemaVersion: 1,
      name: "Builders Guild",
      description: "A community for public-goods builders.",
      externalLinks: [
        { label: "Website", url: "https://builders.example" },
      ],
    },
    metadataError: null,
    governance: {
      votingDelay: 12,
      votingPeriod: 17_280,
      proposalThreshold: "1",
      quorum: "10",
      unavailableFields: [],
    },
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("CommunityDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useParams.mockReturnValue({ id: COMMUNITY_ID });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
  });

  it("shows loading then renders public metadata, contracts, and governance", async () => {
    const request = deferred<CommunityDetailResult>();
    mocks.getCommunity.mockReturnValue(request.promise);

    renderPage();
    expect(screen.getByText("Loading community details…")).toBeInTheDocument();

    await act(async () => {
      request.resolve(foundResult);
    });

    expect(await screen.findByText("Builders Guild")).toBeInTheDocument();
    expect(
      screen.getByText("A community for public-goods builders."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Proposal threshold (NFT votes)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Voting period (Stellar ledgers)"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View community proposals" }),
    ).toHaveAttribute(
      "href",
      `/communities/${COMMUNITY_ID}/proposals`,
    );
    expect(
      screen.getAllByRole("button", { name: /^Copy .* contract$/ }),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole("link", { name: /Open .* contract in explorer/ }),
    ).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Copy Community owner" }),
    ).toBeInTheDocument();
  });

  it("renders malformed and unknown IDs as clear not-found states", async () => {
    mocks.useParams.mockReturnValue({ id: "not-an-id" });
    mocks.getCommunity.mockResolvedValue({ status: "not-found" });

    const { rerender } = renderPage();
    expect(await screen.findByText("Community not found")).toBeInTheDocument();

    mocks.useParams.mockReturnValue({ id: COMMUNITY_ID });
    mocks.getCommunity.mockResolvedValue({
      status: "malformed",
      message: "Registry schema mismatch.",
    });
    rerender(
      <CommunityRegistryProvider registry={registry}>
        <CommunityDetailPage />
      </CommunityRegistryProvider>,
    );

    expect(
      await screen.findByText("Community record is malformed"),
    ).toBeInTheDocument();
    expect(screen.getByText("Registry schema mismatch.")).toBeInTheDocument();
  });

  it("keeps registry and governance data visible when metadata fails", async () => {
    const metadataFailure = structuredClone(foundResult);
    if (metadataFailure.status !== "found") throw new Error("invalid fixture");
    metadataFailure.community.metadata = null;
    metadataFailure.community.metadataError = "Metadata request failed.";
    mocks.getCommunity.mockResolvedValue(metadataFailure);

    renderPage();

    expect(
      await screen.findByText("Community metadata is unavailable"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Metadata request failed/)).toBeInTheDocument();
    expect(screen.getByText("Deployed contracts")).toBeInTheDocument();
    expect(screen.getByText("Governance configuration")).toBeInTheDocument();
  });

  it("shows partial Governor read failures without hiding successful values", async () => {
    const partial = structuredClone(foundResult);
    if (partial.status !== "found") throw new Error("invalid fixture");
    partial.community.governance.quorum = null;
    partial.community.governance.unavailableFields = ["Quorum"];
    mocks.getCommunity.mockResolvedValue(partial);

    renderPage();

    expect(
      await screen.findByText(/Some Governor reads failed: Quorum/),
    ).toBeInTheDocument();
    expect(screen.getByText("17280")).toBeInTheDocument();
  });

  it("shows an RPC error and retries the registry request", async () => {
    mocks.getCommunity
      .mockRejectedValueOnce(new Error("RPC down"))
      .mockResolvedValueOnce(foundResult);

    renderPage();
    expect(
      await screen.findByText("Community could not be loaded"),
    ).toBeInTheDocument();
    expect(screen.getByText("RPC down")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Retry community request" }),
    );
    expect(await screen.findByText("Builders Guild")).toBeInTheDocument();
  });

  it("copies canonical identifiers and falls back to copying the share URL", async () => {
    mocks.getCommunity.mockResolvedValue(foundResult);
    renderPage();
    await screen.findByText("Builders Guild");

    fireEvent.click(
      screen.getByRole("button", { name: "Copy full community ID" }),
    );
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(COMMUNITY_ID);
    expect(await screen.findByText("Community ID copied.")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Share Builders Guild community page" }),
    );
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      `${window.location.origin}/communities/${COMMUNITY_ID}`,
    );
    expect(
      await screen.findByText("Community page link copied."),
    ).toBeInTheDocument();
  });

  it("uses native sharing and announces permission failures", async () => {
    const share = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("denied"));
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: share,
    });
    mocks.getCommunity.mockResolvedValue(foundResult);
    renderPage();
    await screen.findByText("Builders Guild");
    const shareButton = screen.getByRole("button", {
      name: "Share Builders Guild community page",
    });

    fireEvent.click(shareButton);
    expect(await screen.findByText("Community page shared.")).toBeInTheDocument();
    fireEvent.click(shareButton);
    expect(
      await screen.findByText("Could not share the community page."),
    ).toBeInTheDocument();
  });
});
