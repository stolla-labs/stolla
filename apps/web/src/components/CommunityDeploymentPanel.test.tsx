import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getE2EBridge: vi.fn(),
  useWallet: vi.fn(),
}));

vi.mock("@/lib/e2eMock", () => ({
  getE2EBridge: mocks.getE2EBridge,
}));
vi.mock("@/context/WalletProvider", () => ({
  useWallet: mocks.useWallet,
}));

import { CommunityDeploymentPanel } from "./CommunityDeploymentPanel";

const address = `G${"A".repeat(55)}`;
const expectedRecord = {
  id: "ab".repeat(32),
  nftContract: `C${"B".repeat(55)}`,
  governorContract: `C${"C".repeat(55)}`,
  creator: address,
  communityOwner: address,
  createdAtLedger: 10,
  creationIndex: 1,
  metadataUri: "https://example.test/community.json",
  metadataHash: "12".repeat(32),
  metadataSchemaVersion: 1 as const,
};
const props = {
  metadata: {
    name: "Builders",
    symbol: "BUILD",
    description: "Builders",
    collectionUri: "ipfs://collection",
    metadataUri: "https://example.test/community.json",
    logo: "",
    externalLinkLabel: "",
    externalLinkUrl: "",
  },
  governance: {
    proposalThreshold: "1",
    quorum: "1",
    votingDelay: "1",
    votingPeriod: "100",
  },
  network: "testnet" as const,
  factoryId: `C${"D".repeat(55)}`,
  confirmed: true,
};

function adapter() {
  return {
    simulate: vi.fn().mockResolvedValue({
      invocation: {
        contractId: props.factoryId,
        method: "create_community",
        sourceAccount: address,
        networkPassphrase: "Test SDF Network ; September 2015",
        metadataHash: "12".repeat(32),
        externalKey: "12".repeat(32),
        args: [],
      },
      feeStroops: "12345678",
      expectedRecord,
      sequence: "2",
      expiresAt: 999,
      prepared: {},
    }),
    signAndSubmit: vi.fn().mockResolvedValue({
      transactionHash: "cd".repeat(32),
    }),
    transactionStatus: vi.fn().mockResolvedValue("success"),
    verifyRegistry: vi.fn().mockResolvedValue("verified"),
    readFactoryOwner: vi.fn().mockResolvedValue(address),
  };
}

const simulateButtons = () =>
  screen.queryAllByRole("button", { name: "Simulate deployment" });
const approveButton = () =>
  screen.queryByRole("button", { name: "Approve and deploy" });

/** The owner preflight resolves asynchronously to "ready" before any action. */
async function awaitReady() {
  await waitFor(async () => {
    expect(
      simulateButtons().some((button) => !(button as HTMLButtonElement).disabled),
    ).toBe(true);
  });
}

describe("CommunityDeploymentPanel", () => {
  beforeEach(() => {
    sessionStorage.clear();
    mocks.useWallet.mockReturnValue({
      address,
      signTransaction: vi.fn(),
      walletNetwork: "testnet",
      walletNetworkPassphrase: "Test SDF Network ; September 2015",
    });
  });

  it("shows the exact simulated fee and declares success only after registry verification", async () => {
    const deployment = adapter();
    mocks.getE2EBridge.mockReturnValue({ deployment });
    render(<CommunityDeploymentPanel {...props} />);

    await awaitReady();
    fireEvent.click(screen.getByRole("button", { name: "Simulate deployment" }));
    expect(await screen.findByText(/12345678 stroops/)).toHaveTextContent(
      "1.2345678 XLM",
    );
    fireEvent.click(screen.getByRole("button", { name: "Approve and deploy" }));

    expect(
      await screen.findByRole("heading", {
        name: "Community verified in the registry",
      }),
    ).toBeInTheDocument();
    expect(deployment.signAndSubmit).toHaveBeenCalledTimes(1);
    expect(deployment.verifyRegistry).toHaveBeenCalledWith(expectedRecord);
    expect(sessionStorage.getItem("stolla:community-deployment:testnet:v1")).toBeNull();
  });

  it("blocks a mismatched wallet network and preserves draft inputs", () => {
    const deployment = adapter();
    mocks.getE2EBridge.mockReturnValue({ deployment });
    mocks.useWallet.mockReturnValue({
      address,
      signTransaction: vi.fn(),
      walletNetwork: "mainnet",
      walletNetworkPassphrase: "Public Global Stellar Network ; September 2015",
    });
    render(<CommunityDeploymentPanel {...props} />);

    expect(screen.getByText(/Expected testnet/)).toHaveTextContent(
      "Detected mainnet",
    );
    expect(
      screen.getByRole("button", { name: "Simulate deployment" }),
    ).toBeDisabled();
    expect(screen.getByText("Simulate and deploy")).toBeInTheDocument();
  });

  it("rebuilds an expired unsigned transaction with a fresh simulation and signature", async () => {
    const deployment = adapter();
    deployment.signAndSubmit.mockRejectedValueOnce(new Error("tx_bad_seq"));
    mocks.getE2EBridge.mockReturnValue({ deployment });
    render(<CommunityDeploymentPanel {...props} />);

    await awaitReady();
    fireEvent.click(screen.getByRole("button", { name: "Simulate deployment" }));
    await screen.findByText(/12345678 stroops/);
    fireEvent.click(screen.getByRole("button", { name: "Approve and deploy" }));
    expect(
      (await screen.findAllByText(/fresh sequence, timeout/))[0],
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Simulate deployment" }));
    await waitFor(() => expect(deployment.simulate).toHaveBeenCalledTimes(2));
    expect(deployment.signAndSubmit).toHaveBeenCalledTimes(1);
  });

  it("resumes an ambiguous submitted transaction without signing or redeploying", async () => {
    const deployment = adapter();
    deployment.transactionStatus.mockResolvedValue("ambiguous");
    mocks.getE2EBridge.mockReturnValue({ deployment });
    sessionStorage.setItem(
      "stolla:community-deployment:testnet:v1",
      JSON.stringify({
        version: 1,
        network: "testnet",
        transactionHash: "cd".repeat(32),
        expectedRecord,
        submittedAt: 1,
      }),
    );
    render(<CommunityDeploymentPanel {...props} />);

    expect(
      (await screen.findAllByText(/RPC status is ambiguous/))[0],
    ).toBeInTheDocument();
    expect(deployment.transactionStatus).toHaveBeenCalledWith("cd".repeat(32));
    expect(deployment.signAndSubmit).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Acknowledge failure and rebuild" }),
    ).not.toBeInTheDocument();
  });

  it("allows an explicit rebuild only after a known terminal failure", async () => {
    const deployment = adapter();
    deployment.transactionStatus.mockResolvedValue("failed");
    mocks.getE2EBridge.mockReturnValue({ deployment });
    sessionStorage.setItem(
      "stolla:community-deployment:testnet:v1",
      JSON.stringify({
        version: 1,
        network: "testnet",
        transactionHash: "cd".repeat(32),
        expectedRecord,
        submittedAt: 1,
      }),
    );
    render(<CommunityDeploymentPanel {...props} />);
    const acknowledge = await screen.findByRole("button", {
      name: "Acknowledge failure and rebuild",
    });
    fireEvent.click(acknowledge);
    expect(
      screen.getByRole("button", { name: "Simulate deployment" }),
    ).toBeEnabled();
    expect(deployment.signAndSubmit).not.toHaveBeenCalled();
  });

  it("blocks the deploy approval action for a non-owner wallet", async () => {
    const deployment = adapter();
    const other = `G${"B".repeat(55)}`;
    mocks.useWallet.mockReturnValue({
      address: other,
      signTransaction: vi.fn(),
      walletNetwork: "testnet",
      walletNetworkPassphrase: "Test SDF Network ; September 2015",
    });
    mocks.getE2EBridge.mockReturnValue({ deployment });
    render(<CommunityDeploymentPanel {...props} />);

    await screen.findByText(/Only the CommunityFactory owner can create communities/);
    expect(
      screen.getByRole("button", { name: "Simulate deployment" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Simulate deployment" }));
    expect(deployment.simulate).not.toHaveBeenCalled();
    expect(approveButton()).not.toBeInTheDocument();
  });

  it("reports a disconnected wallet as disconnected and holds actions", async () => {
    mocks.useWallet.mockReturnValue({
      address: null,
      signTransaction: vi.fn(),
      walletNetwork: null,
      walletNetworkPassphrase: null,
    });
    render(<CommunityDeploymentPanel {...props} />);

    expect(
      await screen.findByText(/Connect your wallet to check whether this account can create a community/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Simulate deployment" }),
    ).toBeDisabled();
  });

  it("is network-aware and never reports a mismatched wallet as unauthorized", async () => {
    const deployment = adapter();
    mocks.useWallet.mockReturnValue({
      address,
      signTransaction: vi.fn(),
      walletNetwork: "mainnet",
      walletNetworkPassphrase: "Public Global Stellar Network ; September 2015",
    });
    mocks.getE2EBridge.mockReturnValue({ deployment });
    render(<CommunityDeploymentPanel {...props} />);

    expect(await screen.findByText(/Expected testnet/)).toHaveTextContent(
      "Detected mainnet",
    );
    expect(deployment.readFactoryOwner).not.toHaveBeenCalled();
    expect(
      screen.queryByText(/cannot create/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/only the communityfactory owner/i),
    ).not.toBeInTheDocument();
  });

  it("treats a factory owner read failure as retryable, not unauthorized", async () => {
    const deployment = adapter();
    deployment.readFactoryOwner.mockRejectedValueOnce(new Error("RPC unavailable"));
    mocks.getE2EBridge.mockReturnValue({ deployment });
    render(<CommunityDeploymentPanel {...props} />);

    const retry = await screen.findByRole("button", { name: "Retry owner check" });
    expect(
      screen.queryByText(/only the communityfactory owner|cannot create/i),
    ).not.toBeInTheDocument();

    deployment.readFactoryOwner.mockResolvedValueOnce(address);
    fireEvent.click(retry);
    await awaitReady();
    expect(deployment.readFactoryOwner).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Retry owner check")).not.toBeInTheDocument();
  });
});
