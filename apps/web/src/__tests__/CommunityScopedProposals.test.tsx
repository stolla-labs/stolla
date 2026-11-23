import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommunityDetailResult } from "@/lib/community/types";
import { CommunityRegistryProvider } from "@/lib/community/CommunityRegistryProvider";

const mocks = vi.hoisted(() => ({
  useParams: vi.fn(),
  replace: vi.fn(),
  getCommunity: vi.fn(),
  useProposalDiscovery: vi.fn(),
  createReadOnlyGovernorClient: vi.fn(),
  refresh: vi.fn(),
  useWallet: vi.fn(),
  createReadOnlyNftClient: vi.fn(),
  createNftClient: vi.fn(),
  createGovernorClient: vi.fn(),
  storeProposalIdFor: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: mocks.useParams,
  usePathname: () => `/communities/${mocks.useParams().id}/proposals`,
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("@/hooks/useProposalDiscovery", () => ({
  useProposalDiscovery: mocks.useProposalDiscovery,
}));

vi.mock("@/lib/community/registry", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/community/registry")>(),
  getCommunity: mocks.getCommunity,
}));

vi.mock("@/lib/contracts", () => ({
  createReadOnlyGovernorClient: mocks.createReadOnlyGovernorClient,
  createReadOnlyNftClient: mocks.createReadOnlyNftClient,
  createNftClient: mocks.createNftClient,
  createGovernorClient: mocks.createGovernorClient,
  storeProposalIdFor: mocks.storeProposalIdFor,
}));

vi.mock("@/context/WalletProvider", () => ({ useWallet: mocks.useWallet }));

import { ProposalState } from "@/lib/proposalState";
import { serializeProposalMetadata } from "@/lib/proposal-metadata";
import CommunityProposalHistoryPage from "@/app/(app)/communities/[id]/proposals/page";
import {
  MOCK_ACCOUNT_CAROL,
  MOCK_ACCOUNT_OWNER,
  MOCK_CONTRACT_A,
  MOCK_CONTRACT_B,
  MOCK_NFT_CONTRACT_ID,
} from "@/test-support/stellar/fixtures";

const registry = { list: vi.fn(), get: mocks.getCommunity };

function renderPage() {
  return render(
    <CommunityRegistryProvider registry={registry}>
      <CommunityProposalHistoryPage />
    </CommunityRegistryProvider>,
  );
}

const FIRST_ID = "11".repeat(32);
const SECOND_ID = "22".repeat(32);
const PROPOSAL_ID = "aa".repeat(32);
const FIRST_GOVERNOR = MOCK_CONTRACT_A;
const SECOND_GOVERNOR = MOCK_CONTRACT_B;
const SECOND_PROPOSAL_ID = "bb".repeat(32);

function proposal(id: string, title: string, summary: string) {
  return {
    id,
    description: serializeProposalMetadata({
      title,
      summary,
      body: "Proposal details.",
      discussionUrl: null,
    }),
  };
}

function communityResult(
  id: string,
  governor: string,
  name: string,
): CommunityDetailResult {
  return {
    status: "found",
    community: {
      record: {
        id,
        nftContract: MOCK_NFT_CONTRACT_ID,
        governorContract: governor,
        creator: MOCK_ACCOUNT_CAROL,
        communityOwner: MOCK_ACCOUNT_OWNER,
        createdAtLedger: 100,
        creationIndex: 1,
        metadataUri: "https://example.test/community.json",
        metadataHash: "ab".repeat(32),
        metadataSchemaVersion: 1,
      },
      metadata: {
        schemaVersion: 1,
        name,
        description: `${name} description`,
        externalLinks: [],
      },
      metadataError: null,
      governance: {
        votingDelay: 1,
        votingPeriod: 100,
        proposalThreshold: "1",
        quorum: "1",
        unavailableFields: [],
      },
    },
  };
}

describe("community-scoped proposal history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, "", `/communities/${FIRST_ID}/proposals`);
    mocks.replace.mockImplementation((url: string) => {
      window.history.replaceState(null, "", url);
    });
    mocks.useParams.mockReturnValue({ id: FIRST_ID });
    mocks.getCommunity.mockImplementation(async (id: string) =>
      id === FIRST_ID
        ? communityResult(FIRST_ID, FIRST_GOVERNOR, "First DAO")
        : communityResult(SECOND_ID, SECOND_GOVERNOR, "Second DAO"),
    );
    mocks.useProposalDiscovery.mockReturnValue({
      proposals: [{ id: PROPOSAL_ID, description: "Shared numeric ID", metadata: null }],
      loading: false,
      error: null,
      empty: false,
      refresh: mocks.refresh,
    });
    mocks.createReadOnlyGovernorClient.mockReturnValue({
      proposal_state: vi.fn().mockResolvedValue({
        result: ProposalState.Active,
      }),
    });
    mocks.refresh.mockResolvedValue(true);
    mocks.useWallet.mockReturnValue({
      address: "GWALLET",
      connect: vi.fn(),
      isConnecting: false,
      signTransaction: vi.fn(),
    });
    mocks.createReadOnlyNftClient.mockReturnValue({
      get_votes: vi.fn().mockResolvedValue({ result: 1n }),
    });
  });

  it("offers a scoped create action only after successful empty discovery and sufficient voting power", async () => {
    mocks.useProposalDiscovery.mockReturnValue({
      proposals: [], loading: false, error: null, empty: true, refresh: mocks.refresh,
    });
    renderPage();

    const action = await screen.findByRole("button", { name: "Create first proposal" });
    expect(screen.getByText("No proposals yet")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mocks.createReadOnlyNftClient).toHaveBeenCalledWith(MOCK_NFT_CONTRACT_ID);
    fireEvent.click(action);
    expect(screen.getByRole("heading", { name: "Create proposal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create proposal" })).toBeInTheDocument();
  });

  it("submits the first proposal to this community's Governor", async () => {
    const propose = vi.fn().mockResolvedValue({
      sign: async () => undefined,
      send: async () => ({ result: Uint8Array.from(Array(32).fill(0xaa)), hash: "ab".repeat(32) }),
    });
    mocks.createGovernorClient.mockReturnValue({ propose });
    mocks.useProposalDiscovery.mockReturnValue({
      proposals: [], loading: false, error: null, empty: true, refresh: mocks.refresh,
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Create first proposal" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Title (required)" }), { target: { value: "First decision" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Summary (required)" }), { target: { value: "Approve the first decision." } });
    fireEvent.change(screen.getByRole("textbox", { name: "Body (required)" }), { target: { value: "The community will vote on this decision." } });
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));

    await waitFor(() => expect(propose).toHaveBeenCalledOnce());
    expect(mocks.createGovernorClient).toHaveBeenCalledWith(expect.objectContaining({
      contractId: FIRST_GOVERNOR,
      publicKey: "GWALLET",
    }));
    expect(propose).toHaveBeenCalledWith(expect.objectContaining({ proposer: "GWALLET" }));
    await waitFor(() => expect(mocks.storeProposalIdFor).toHaveBeenCalledWith(FIRST_GOVERNOR, PROPOSAL_ID));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("offers wallet connection when empty discovery succeeds but the wallet is disconnected", async () => {
    const connect = vi.fn();
    mocks.useWallet.mockReturnValue({ address: null, connect, isConnecting: false, signTransaction: vi.fn() });
    mocks.useProposalDiscovery.mockReturnValue({
      proposals: [], loading: false, error: null, empty: true, refresh: mocks.refresh,
    });
    renderPage();

    const action = await screen.findByRole("button", { name: "Connect wallet to propose" });
    expect(screen.queryByRole("button", { name: "Create first proposal" })).not.toBeInTheDocument();
    fireEvent.click(action);
    expect(connect).toHaveBeenCalledOnce();
  });

  it("offers scoped delegation when voting power is below the threshold", async () => {
    const delegate = vi.fn().mockResolvedValue({
      sign: async () => undefined,
      send: async () => ({ result: null, hash: "ab".repeat(32) }),
    });
    mocks.createNftClient.mockReturnValue({ delegate });
    mocks.createReadOnlyNftClient.mockReturnValue({ get_votes: vi.fn().mockResolvedValue({ result: 0n }) });
    mocks.useProposalDiscovery.mockReturnValue({
      proposals: [], loading: false, error: null, empty: true, refresh: mocks.refresh,
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Delegate voting power" }));
    await waitFor(() => expect(delegate).toHaveBeenCalledWith({ account: "GWALLET", delegatee: "GWALLET" }));
    expect(mocks.createNftClient).toHaveBeenCalledWith(expect.objectContaining({
      contractId: MOCK_NFT_CONTRACT_ID,
      publicKey: "GWALLET",
    }));
    expect(await screen.findByText("Delegate confirmed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create first proposal" })).not.toBeInTheDocument();
  });

  it("keeps discovery failure in the error and retry state", async () => {
    mocks.useProposalDiscovery.mockReturnValue({
      proposals: [], loading: false, error: "RPC unavailable", empty: false, refresh: mocks.refresh,
    });
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("RPC unavailable");
    expect(screen.getByRole("button", { name: "Retry proposal history" })).toBeInTheDocument();
    expect(screen.queryByText("No proposals yet")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create first proposal" })).not.toBeInTheDocument();
  });

  it("searches parsed titles and summaries case-insensitively and clears to restore the list", async () => {
    mocks.useProposalDiscovery.mockReturnValue({
      proposals: [
        proposal(PROPOSAL_ID, "Treasury Budget", "Allocate grants"),
        proposal(SECOND_PROPOSAL_ID, "Membership", "Improve VOTING access"),
        { id: "cc".repeat(32), description: "Legacy voting proposal" },
      ],
      loading: false, error: null, empty: false, refresh: mocks.refresh,
    });
    renderPage();
    const search = await screen.findByRole("searchbox", { name: "Search community proposals" });

    fireEvent.change(search, { target: { value: "bUdGeT" } });
    expect(await screen.findByRole("link", { name: new RegExp(PROPOSAL_ID) })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: new RegExp(SECOND_PROPOSAL_ID) })).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "voting" } });
    expect(screen.queryByRole("link", { name: new RegExp(PROPOSAL_ID) })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: new RegExp(SECOND_PROPOSAL_ID) })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /View proposal/ })).toHaveLength(1);

    fireEvent.change(search, { target: { value: "missing" } });
    expect(screen.getByText("No proposals match your search.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getAllByRole("link", { name: /View proposal/ })).toHaveLength(3);
    expect(screen.queryByText("No proposals match your search.")).not.toBeInTheDocument();
    expect(window.location.search).toBe("");
  });

  it("loads q from the URL and preserves state and other params when updating or clearing it", async () => {
    window.history.replaceState(null, "", `/communities/${FIRST_ID}/proposals?state=active&tab=history&q=budget`);
    mocks.useProposalDiscovery.mockReturnValue({
      proposals: [proposal(PROPOSAL_ID, "Budget", "Allocate grants")],
      loading: false, error: null, empty: false, refresh: mocks.refresh,
    });
    const view = renderPage();
    const search = await screen.findByRole("searchbox", { name: "Search community proposals" });
    expect(search).toHaveValue("budget");
    expect(await screen.findByRole("link", { name: new RegExp(PROPOSAL_ID) })).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "grants" } });
    expect(mocks.replace).toHaveBeenCalledWith(
      `/communities/${FIRST_ID}/proposals?state=active&tab=history&q=grants`,
      { scroll: false },
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(mocks.replace).toHaveBeenLastCalledWith(
      `/communities/${FIRST_ID}/proposals?state=active&tab=history`,
      { scroll: false },
    );

    window.history.replaceState(null, "", `/communities/${FIRST_ID}/proposals?state=active&q=Budget`);
    view.rerender(
      <CommunityRegistryProvider registry={registry}>
        <CommunityProposalHistoryPage />
      </CommunityRegistryProvider>,
    );
    await waitFor(() => expect(search).toHaveValue("Budget"));
  });

  it("keeps discovery errors visible when a search has no matches", async () => {
    window.history.replaceState(null, "", `/communities/${FIRST_ID}/proposals?q=missing`);
    mocks.useProposalDiscovery.mockReturnValue({
      proposals: [proposal(PROPOSAL_ID, "Budget", "Allocate grants")],
      loading: false, error: "RPC unavailable", empty: false, refresh: mocks.refresh,
    });
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("RPC unavailable");
    expect(screen.getByText("No proposals match your search.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry proposal history" })).toBeInTheDocument();
  });

  it("combines text search with the state filter", async () => {
    window.history.replaceState(null, "", `/communities/${FIRST_ID}/proposals?q=budget`);
    mocks.useProposalDiscovery.mockReturnValue({
      proposals: [
        proposal(PROPOSAL_ID, "Budget for grants", "Allocate grants"),
        proposal(SECOND_PROPOSAL_ID, "Budget for events", "Allocate events"),
      ],
      loading: false, error: null, empty: false, refresh: mocks.refresh,
    });
    mocks.createReadOnlyGovernorClient.mockReturnValue({
      proposal_state: vi.fn().mockImplementation(async ({ proposal_id }: { proposal_id: Uint8Array }) => ({
        result: Buffer.from(proposal_id).toString("hex") === PROPOSAL_ID
          ? ProposalState.Active
          : ProposalState.Defeated,
      })),
    });
    const view = renderPage();
    const state = await screen.findByRole("combobox", { name: "Filter community proposals by state" });
    await waitFor(() => expect(screen.getByRole("option", { name: "Active" })).toBeInTheDocument());
    expect(screen.getAllByRole("link", { name: /View proposal/ })).toHaveLength(2);

    fireEvent.change(state, { target: { value: String(ProposalState.Active) } });
    view.rerender(
      <CommunityRegistryProvider registry={registry}>
        <CommunityProposalHistoryPage />
      </CommunityRegistryProvider>,
    );
    await waitFor(() => expect(screen.getAllByRole("link", { name: /View proposal/ })).toHaveLength(1));
    expect(screen.getByRole("link", { name: new RegExp(PROPOSAL_ID) })).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get("q")).toBe("budget");
  });

  it("keeps the empty community state distinct from a search with no matches", async () => {
    window.history.replaceState(null, "", `/communities/${FIRST_ID}/proposals?q=missing`);
    mocks.useProposalDiscovery.mockReturnValue({
      proposals: [], loading: false, error: null, empty: true, refresh: mocks.refresh,
    });
    renderPage();

    expect(await screen.findByText("No proposals yet")).toBeInTheDocument();
    expect(screen.queryByText("No proposals match your search.")).not.toBeInTheDocument();
  });

  it("shows loading without an empty action", async () => {
    mocks.useProposalDiscovery.mockReturnValue({
      proposals: [], loading: true, error: null, empty: false, refresh: mocks.refresh,
    });
    renderPage();

    await screen.findByRole("heading", { name: "First DAO proposals" });
    expect(screen.getByText("Loading community proposal history…")).toBeInTheDocument();
    expect(screen.queryByText("No proposals yet")).not.toBeInTheDocument();
  });

  it("labels incomplete retained history without an empty action", async () => {
    mocks.useProposalDiscovery.mockReturnValue({
      proposals: [], loading: false, error: null, empty: false, refresh: mocks.refresh,
    });
    renderPage();

    expect(await screen.findByText(/Proposal history is incomplete/)).toBeInTheDocument();
    expect(screen.queryByText("No proposals yet")).not.toBeInTheDocument();
  });

  it("uses the route community Governor and keeps colliding IDs scoped", async () => {
    const { rerender } = renderPage();

    expect(
      await screen.findByRole("link", {
        name: new RegExp(`View proposal ${PROPOSAL_ID}, state Active`),
      }),
    ).toHaveAttribute(
      "href",
      `/communities/${FIRST_ID}/proposals/${PROPOSAL_ID}`,
    );
    expect(mocks.useProposalDiscovery).toHaveBeenCalledWith(FIRST_GOVERNOR);
    expect(mocks.createReadOnlyGovernorClient).toHaveBeenCalledWith(
      FIRST_GOVERNOR,
    );

    mocks.useParams.mockReturnValue({ id: SECOND_ID });
    rerender(
      <CommunityRegistryProvider registry={registry}>
        <CommunityProposalHistoryPage />
      </CommunityRegistryProvider>,
    );

    await waitFor(() =>
      expect(
        screen.getByRole("link", {
          name: new RegExp(`View proposal ${PROPOSAL_ID}, state Active`),
        }),
      ).toHaveAttribute(
        "href",
        `/communities/${SECOND_ID}/proposals/${PROPOSAL_ID}`,
      ),
    );
    expect(mocks.useProposalDiscovery).toHaveBeenCalledWith(SECOND_GOVERNOR);
  });

  it("shows an unknown community independently of proposal history", async () => {
    mocks.getCommunity.mockResolvedValue({ status: "not-found" });

    renderPage();

    expect(await screen.findByText("Community not found")).toBeInTheDocument();
    expect(mocks.useProposalDiscovery).not.toHaveBeenCalled();
  });
});
