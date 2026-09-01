import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ParticipationReadinessChecklist } from "@/components/community/ParticipationReadinessChecklist";
import {
  createNftClientMock,
  createWalletMock,
  MOCK_ACCOUNT_ALICE,
  MOCK_NFT_CONTRACT_ID,
  resolved,
} from "@/test-support/stellar";
import type { NetworkComparison } from "@/lib/network";

const mocks = vi.hoisted(() => ({
  useWallet: vi.fn(),
  useNetworkGuard: vi.fn(),
  createNftClient: vi.fn(),
  createReadOnlyNftClient: vi.fn(),
}));

vi.mock("@/context/WalletProvider", () => ({
  useWallet: mocks.useWallet,
}));

vi.mock("@/hooks/useNetworkGuard", () => ({
  useNetworkGuard: mocks.useNetworkGuard,
}));

vi.mock("@/lib/contracts", () => ({
  createNftClient: mocks.createNftClient,
  createReadOnlyNftClient: mocks.createReadOnlyNftClient,
}));

function networkMatch(): NetworkComparison {
  return {
    status: "match",
    expected: {
      id: "testnet",
      label: "Testnet",
      networkPassphrase: "Test SDF Network ; September 2015",
      explorerSegment: "testnet",
    },
    detected: {
      id: "testnet",
      label: "Testnet",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
  };
}

function networkMismatch(): NetworkComparison {
  return {
    status: "mismatch",
    expected: {
      id: "testnet",
      label: "Testnet",
      networkPassphrase: "Test SDF Network ; September 2015",
      explorerSegment: "testnet",
    },
    detected: {
      id: "mainnet",
      label: "Mainnet",
      networkPassphrase: "Public Global Stellar Network ; September 2015",
    },
  };
}

describe("ParticipationReadinessChecklist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a connect action when the wallet is disconnected", () => {
    mocks.useWallet.mockReturnValue(createWalletMock({ address: null }));
    mocks.useNetworkGuard.mockReturnValue(networkMatch());
    mocks.createReadOnlyNftClient.mockReturnValue(createNftClientMock());

    render(<ParticipationReadinessChecklist nftContractId={MOCK_NFT_CONTRACT_ID} />);

    expect(screen.getByText("Connect wallet")).toBeInTheDocument();
    expect(screen.getByText("Participation readiness")).toBeInTheDocument();
  });

  it("prompts to switch network when the wallet is on the wrong network", () => {
    mocks.useWallet.mockReturnValue(createWalletMock({ address: MOCK_ACCOUNT_ALICE }));
    mocks.useNetworkGuard.mockReturnValue(networkMismatch());
    mocks.createReadOnlyNftClient.mockReturnValue(createNftClientMock());

    render(<ParticipationReadinessChecklist nftContractId={MOCK_NFT_CONTRACT_ID} />);

    expect(screen.getByText(/switch network in wallet/i)).toBeInTheDocument();
    expect(screen.queryByText("Connect wallet")).not.toBeInTheDocument();
  });

  it("shows a mint action when the connected account has no membership NFT", async () => {
    const client = createNftClientMock({
      balance: resolved(0),
    });
    mocks.useWallet.mockReturnValue(createWalletMock({ address: MOCK_ACCOUNT_ALICE }));
    mocks.useNetworkGuard.mockReturnValue(networkMatch());
    mocks.createReadOnlyNftClient.mockReturnValue(client);

    render(<ParticipationReadinessChecklist nftContractId={MOCK_NFT_CONTRACT_ID} />);

    expect(await screen.findByText("Mint NFT")).toBeInTheDocument();
  });

  it("shows a delegate action when the account owns an NFT but has not self-delegated", async () => {
    const client = createNftClientMock({
      balance: resolved(1),
      get_delegate: resolved(null) as never,
      get_votes: resolved(BigInt(0)),
    });
    mocks.useWallet.mockReturnValue(createWalletMock({ address: MOCK_ACCOUNT_ALICE }));
    mocks.useNetworkGuard.mockReturnValue(networkMatch());
    mocks.createReadOnlyNftClient.mockReturnValue(client);

    render(<ParticipationReadinessChecklist nftContractId={MOCK_NFT_CONTRACT_ID} />);

    expect(await screen.findByText("Delegate")).toBeInTheDocument();
  });

  it("shows the ready state when wallet, network, membership, delegation, and power are all set", async () => {
    const client = createNftClientMock({
      balance: resolved(1),
      get_delegate: resolved(MOCK_ACCOUNT_ALICE),
      get_votes: resolved(BigInt(10)),
    });
    mocks.useWallet.mockReturnValue(createWalletMock({ address: MOCK_ACCOUNT_ALICE }));
    mocks.useNetworkGuard.mockReturnValue(networkMatch());
    mocks.createReadOnlyNftClient.mockReturnValue(client);

    render(<ParticipationReadinessChecklist nftContractId={MOCK_NFT_CONTRACT_ID} />);

    expect(
      await screen.findByText(
        /wallet, network, membership, delegation, and voting power are ready/i,
      ),
    ).toBeInTheDocument();
  });

  it("shows zero-power state when delegated but voting power is zero", async () => {
    const client = createNftClientMock({
      balance: resolved(1),
      get_delegate: resolved(MOCK_ACCOUNT_ALICE),
      get_votes: resolved(BigInt(0)),
    });
    mocks.useWallet.mockReturnValue(createWalletMock({ address: MOCK_ACCOUNT_ALICE }));
    mocks.useNetworkGuard.mockReturnValue(networkMatch());
    mocks.createReadOnlyNftClient.mockReturnValue(client);

    render(<ParticipationReadinessChecklist nftContractId={MOCK_NFT_CONTRACT_ID} />);

    expect(await screen.findByText(/no action available/i)).toBeInTheDocument();
  });

  it("shows a retry control when contract reads fail", async () => {
    const client = createNftClientMock({
      balance: () => Promise.reject(new Error("rpc unreachable")),
    });
    mocks.useWallet.mockReturnValue(createWalletMock({ address: MOCK_ACCOUNT_ALICE }));
    mocks.useNetworkGuard.mockReturnValue(networkMatch());
    mocks.createReadOnlyNftClient.mockReturnValue(client);

    render(<ParticipationReadinessChecklist nftContractId={MOCK_NFT_CONTRACT_ID} />);

    expect(await screen.findByText("Retry")).toBeInTheDocument();
    expect(screen.getByText(/rpc unreachable/i)).toBeInTheDocument();
  });

  it("refreshes affected rows after a successful mint", async () => {
    const user = userEvent.setup();
    const readClient = createNftClientMock({
      balance: resolved(0),
    });
    const writeClient = createNftClientMock();
    mocks.useWallet.mockReturnValue(createWalletMock({ address: MOCK_ACCOUNT_ALICE }));
    mocks.useNetworkGuard.mockReturnValue(networkMatch());
    mocks.createReadOnlyNftClient.mockReturnValue(readClient);
    mocks.createNftClient.mockReturnValue(writeClient);

    render(<ParticipationReadinessChecklist nftContractId={MOCK_NFT_CONTRACT_ID} />);

    const mintButton = await screen.findByText("Mint NFT");
    await user.click(mintButton);

    await waitFor(() => {
      expect(writeClient.mint.lastArgs()).toEqual({
        to: MOCK_ACCOUNT_ALICE,
        token_uri: "ipfs://stolla/membership.json",
      });
    });
  });

  it("refreshes affected rows after a successful delegation", async () => {
    const user = userEvent.setup();
    const readClient = createNftClientMock({
      balance: resolved(1),
      get_delegate: resolved(null) as never,
      get_votes: resolved(BigInt(0)),
    });
    const writeClient = createNftClientMock();
    mocks.useWallet.mockReturnValue(createWalletMock({ address: MOCK_ACCOUNT_ALICE }));
    mocks.useNetworkGuard.mockReturnValue(networkMatch());
    mocks.createReadOnlyNftClient.mockReturnValue(readClient);
    mocks.createNftClient.mockReturnValue(writeClient);

    render(<ParticipationReadinessChecklist nftContractId={MOCK_NFT_CONTRACT_ID} />);

    const delegateButton = await screen.findByText("Delegate");
    await user.click(delegateButton);

    await waitFor(() => {
      expect(writeClient.delegate.lastArgs()).toEqual({
        account: MOCK_ACCOUNT_ALICE,
        delegatee: MOCK_ACCOUNT_ALICE,
      });
    });
  });
});
