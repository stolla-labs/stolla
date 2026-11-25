/**
 * Covers issue #534: an unresolved hard gate in the launch rehearsal holds the
 * deployment, and a soft one does not.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const wallet = vi.hoisted(() => ({ useWallet: vi.fn() }));
const bridge = vi.hoisted(() => ({ getE2EBridge: vi.fn() }));

vi.mock("@/context/WalletProvider", () => ({ useWallet: wallet.useWallet }));
vi.mock("@/lib/e2eMock", () => ({ getE2EBridge: bridge.getE2EBridge }));

import { CommunityDeploymentPanel } from "@/components/CommunityDeploymentPanel";
import { MOCK_ACCOUNT_ALICE } from "@/test-support/stellar/fixtures";

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
const FACTORY = "C".padEnd(56, "A");

const METADATA = {
  name: "Civic Fund",
  symbol: "CIVIC",
  description: "Funds public goods.",
  externalLinkLabel: "",
  externalLinkUrl: "",
};

const GOVERNANCE = {
  proposalThreshold: "1",
  quorum: "10",
  votingDelay: "12",
  votingPeriod: "17280",
};

const PAYLOAD = {
  collectionUri: "ipfs://collection",
  metadataUri: "ipfs://metadata",
  metadataHash: "ab".repeat(32),
};

function renderPanel(rehearsalBlocked: boolean) {
  return render(
    <CommunityDeploymentPanel
      metadata={METADATA}
      payload={PAYLOAD}
      governance={GOVERNANCE}
      network="testnet"
      factoryId={FACTORY}
      confirmed
      permissionlessCreate
      rehearsalBlocked={rehearsalBlocked}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  wallet.useWallet.mockReturnValue({
    address: MOCK_ACCOUNT_ALICE,
    walletNetwork: "testnet",
    walletNetworkPassphrase: TESTNET_PASSPHRASE,
    connect: vi.fn(),
    signTransaction: vi.fn(),
    isConnecting: false,
  });
  bridge.getE2EBridge.mockReturnValue({
    deployment: {
      simulate: vi.fn(),
      signAndSubmit: vi.fn(),
      transactionStatus: vi.fn(),
      verifyRegistry: vi.fn(),
      readFactoryOwner: vi.fn(async () => MOCK_ACCOUNT_ALICE),
    },
  });
});

describe("the deployment panel", () => {
  it("holds simulation while a hard rehearsal gate is unresolved", async () => {
    renderPanel(true);

    // Held before anything is simulated: the point of the gate is that no
    // signature is ever requested while a critical item is open.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Simulate deployment" })).toBeDisabled(),
    );
  });

  it("allows simulation once nothing hard is outstanding", async () => {
    renderPanel(false);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Simulate deployment" })).toBeEnabled(),
    );
  });
});
