import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { Networks } from "@stellar/stellar-sdk";
import {
  CreateCommunityWizard,
  type CommunityDeploymentPort,
} from "./CreateCommunityWizard";
import { describeNetwork } from "@/lib/network";

const wallet = vi.hoisted(() => ({
  address: "GADMIN" as string | null,
  walletNetwork: null as string | null,
  walletNetworkPassphrase: null as string | null,
}));

vi.mock("@/context/WalletProvider", () => ({
  useWallet: () => ({
    address: wallet.address,
    walletNetwork: wallet.walletNetwork,
    walletNetworkPassphrase: wallet.walletNetworkPassphrase,
    signTransaction: vi.fn(),
  }),
}));

const TRANSACTION_HASH = "b7f1c0";
const REGISTRY = { nftContractId: "CNFT", governorContractId: "CGOV" };

function createPort(): CommunityDeploymentPort {
  return {
    simulate: vi.fn(async () => ({
      networkPassphrase: Networks.TESTNET,
      factoryAddress: "CFACTORY",
      transactionXdr: "AAAA",
      minResourceFee: "12345",
    })),
    submit: vi.fn(async () => TRANSACTION_HASH),
    confirm: vi.fn(async () => {}),
    verify: vi.fn(async () => REGISTRY),
  };
}

function connectOn(networkPassphrase: string) {
  wallet.address = "GADMIN";
  wallet.walletNetworkPassphrase = networkPassphrase;
  wallet.walletNetwork = networkPassphrase === Networks.PUBLIC ? "mainnet" : "testnet";
}

function renderWizard(port: CommunityDeploymentPort) {
  const view = render(<CreateCommunityWizard deployment={port} />);
  return {
    ...view,
    sync: () => view.rerender(<CreateCommunityWizard deployment={port} />),
  };
}

function goToStep(label: string) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(label, "i") }));
}

function fillMetadata() {
  goToStep("Metadata");
  fireEvent.change(screen.getByLabelText("Community name"), {
    target: { value: "Stolla Builders" },
  });
  fireEvent.change(screen.getByLabelText("Token symbol"), {
    target: { value: "STBL" },
  });
  fireEvent.change(screen.getByLabelText("IPFS metadata URI"), {
    target: { value: "ipfs://QmCollection" },
  });
}

const simulateButton = () =>
  screen.getByRole("button", { name: /simulate deployment/i });
const deployButton = () =>
  screen.getByRole("button", { name: /sign and deploy|awaiting wallet/i });

async function simulate() {
  fireEvent.click(simulateButton());
  await waitFor(() => expect(screen.getByText("Simulated on")).toBeVisible());
}

beforeEach(() => {
  sessionStorage.clear();
  connectOn(Networks.TESTNET);
});

describe("discard and restart", () => {
  it("restarts an empty draft immediately without confirmation", async () => {
    renderWizard(createPort());
    goToStep("Governance");

    fireEvent.click(screen.getByRole("button", { name: /discard draft/i }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText("Community name")).toHaveFocus(),
    );
    expect(sessionStorage.getItem("stolla.community-creation.draft.v1")).toBeNull();
  });

  it("leaves a dirty draft unchanged when confirmation is canceled", () => {
    renderWizard(createPort());
    fillMetadata();
    goToStep("Review");

    fireEvent.click(screen.getByRole("button", { name: /discard draft/i }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /keep editing/i }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByText("Stolla Builders")).toBeInTheDocument();
  });

  it("clears dirty metadata, governance values and persisted state after confirmation", async () => {
    renderWizard(createPort());
    fillMetadata();
    goToStep("Governance");
    fireEvent.change(screen.getByLabelText(/Quorum/), {
      target: { value: "42" },
    });

    await waitFor(() =>
      expect(
        sessionStorage.getItem("stolla.community-creation.draft.v1"),
      ).toContain("Stolla Builders"),
    );
    fireEvent.click(screen.getByRole("button", { name: /discard draft/i }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: /discard draft/i,
      }),
    );

    expect(screen.getByLabelText("Community name")).toHaveValue("");
    await waitFor(() =>
      expect(screen.getByLabelText("Community name")).toHaveFocus(),
    );
    expect(sessionStorage.getItem("stolla.community-creation.draft.v1")).toBeNull();

    goToStep("Governance");
    expect(screen.getByLabelText(/Quorum/)).toHaveValue("1");
  });

  it("restores a persisted dirty draft and its step", async () => {
    sessionStorage.setItem(
      "stolla.community-creation.draft.v1",
      JSON.stringify({
        step: "review",
        draft: {
          name: "Recovered",
          symbol: "RCV",
          metadataUri: "ipfs://recovered",
          votingDelay: "2",
          votingPeriod: "200",
          proposalThreshold: "3",
          quorum: "4",
        },
      }),
    );

    renderWizard(createPort());

    expect(await screen.findByText("Recovered")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /3\. Review/i })).toHaveAttribute(
      "aria-current",
      "step",
    );
  });
});

describe("initial mismatch", () => {
  it("shows both networks and locks a draft that is otherwise ready", () => {
    connectOn(Networks.PUBLIC);
    const port = createPort();
    renderWizard(port);

    fillMetadata();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Testnet");
    expect(alert).toHaveTextContent("Mainnet");

    goToStep("Deploy");
    expect(screen.getByText(/wallet is on Mainnet/i)).toBeInTheDocument();
    expect(simulateButton()).toBeDisabled();
    expect(deployButton()).toBeDisabled();
    expect(port.simulate).not.toHaveBeenCalled();
    expect(port.submit).not.toHaveBeenCalled();
  });

  it("locks deployment while the wallet network is still unreadable", () => {
    wallet.walletNetwork = null;
    wallet.walletNetworkPassphrase = null;
    renderWizard(createPort());

    fillMetadata();
    goToStep("Deploy");
    expect(simulateButton()).toBeDisabled();
    expect(screen.getByText(/Reading the wallet network/i)).toBeInTheDocument();
  });
});

describe("matching network", () => {
  it("simulates and then allows deployment", async () => {
    const port = createPort();
    renderWizard(port);

    fillMetadata();
    goToStep("Deploy");
    await simulate();

    expect(port.simulate).toHaveBeenCalledWith(
      "GADMIN",
      expect.objectContaining({ name: "Stolla Builders", quorum: "1" }),
    );
    expect(screen.getByText("12345 stroops")).toBeInTheDocument();
    expect(deployButton()).toBeEnabled();
  });
});

describe("mid-flow network switch", () => {
  it("discards the simulation, keeps the draft and blocks deployment", async () => {
    const port = createPort();
    const { sync } = renderWizard(port);

    fillMetadata();
    goToStep("Deploy");
    await simulate();

    connectOn(Networks.PUBLIC);
    sync();

    await waitFor(() => expect(screen.queryByText("Simulated on")).toBeNull());
    expect(deployButton()).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Mainnet");
    expect(screen.getByText(/wallet is on Mainnet/i)).toBeInTheDocument();
    expect(port.submit).not.toHaveBeenCalled();

    goToStep("Review");
    expect(screen.getByText("Stolla Builders")).toBeInTheDocument();
    expect(screen.getByText("ipfs://QmCollection")).toBeInTheDocument();
    expect(screen.getByText("10000")).toBeInTheDocument();
  });
});

describe("recovery", () => {
  it("requires a fresh simulation after returning to the expected network", async () => {
    const port = createPort();
    const { sync } = renderWizard(port);

    fillMetadata();
    goToStep("Deploy");
    await simulate();

    connectOn(Networks.PUBLIC);
    sync();
    connectOn(Networks.TESTNET);
    sync();

    await waitFor(() =>
      expect(
        screen.getByText(/Run a simulation before deploying/i),
      ).toBeInTheDocument(),
    );
    expect(deployButton()).toBeDisabled();

    await simulate();
    expect(port.simulate).toHaveBeenCalledTimes(2);
    expect(deployButton()).toBeEnabled();
  });
});

describe("stale simulation", () => {
  it("drops a simulation that resolves after the wallet moved", async () => {
    const port = createPort();
    let resolveSimulation: (() => void) | undefined;
    port.simulate = vi.fn(async () => {
      await new Promise<void>((resolve) => {
        resolveSimulation = resolve;
      });
      return {
        networkPassphrase: Networks.TESTNET,
        factoryAddress: "CFACTORY",
        transactionXdr: "AAAA",
        minResourceFee: "12345",
      };
    });

    const { sync } = renderWizard(port);
    fillMetadata();
    goToStep("Deploy");
    fireEvent.click(simulateButton());

    connectOn(Networks.PUBLIC);
    sync();
    resolveSimulation?.();

    await waitFor(() => expect(deployButton()).toBeDisabled());
    expect(screen.queryByText("Simulated on")).toBeNull();
  });
});

describe("post-submission network change", () => {
  async function submitDeployment(port: CommunityDeploymentPort) {
    const view = renderWizard(port);
    fillMetadata();
    goToStep("Deploy");
    await simulate();
    fireEvent.click(deployButton());
    await waitFor(() =>
      expect(screen.getByRole("link", { name: TRANSACTION_HASH })).toBeVisible(),
    );
    return view;
  }

  it("keeps the transaction on the network it was submitted to", async () => {
    const port = createPort();
    const { sync } = await submitDeployment(port);

    connectOn(Networks.PUBLIC);
    sync();

    const link = await screen.findByRole("link", { name: TRANSACTION_HASH });
    expect(link).toHaveAttribute(
      "href",
      `https://stellar.expert/explorer/testnet/tx/${TRANSACTION_HASH}`,
    );
    expect(screen.getByText("Submitted to").nextSibling).toHaveTextContent(
      "Testnet",
    );
  });

  it("does not allow a second submission after switching back", async () => {
    const port = createPort();
    const { sync } = await submitDeployment(port);

    connectOn(Networks.PUBLIC);
    sync();
    connectOn(Networks.TESTNET);
    sync();

    await waitFor(() =>
      expect(
        screen.getByText(/already been submitted/i),
      ).toBeInTheDocument(),
    );
    expect(deployButton()).toBeDisabled();
    expect(simulateButton()).toBeDisabled();
    expect(port.submit).toHaveBeenCalledTimes(1);
  });

  it("keeps submitted transaction recovery data when the draft is discarded", async () => {
    const port = createPort();
    await submitDeployment(port);

    await waitFor(() =>
      expect(
        sessionStorage.getItem("stolla.community-creation.submission.v1"),
      ).toContain(TRANSACTION_HASH),
    );
    fireEvent.click(screen.getByRole("button", { name: /discard draft/i }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: /discard draft/i,
      }),
    );

    goToStep("Deploy");
    expect(screen.getByRole("link", { name: TRANSACTION_HASH })).toBeVisible();
    expect(
      sessionStorage.getItem("stolla.community-creation.submission.v1"),
    ).toContain(TRANSACTION_HASH);
    expect(sessionStorage.getItem("stolla.community-creation.draft.v1")).toBeNull();
  });
});
