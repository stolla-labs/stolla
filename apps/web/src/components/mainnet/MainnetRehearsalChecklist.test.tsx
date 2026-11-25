import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  buildNetworkCapabilities,
  compareNetworks,
  NETWORKS,
  type ActiveNetworkId,
  type NetworkComparison,
} from "@/lib/network";
import {
  buildRehearsalChecklist,
  rehearsalVerdict,
  type RehearsalCheckId,
} from "@/lib/mainnet/rehearsal";
import { MainnetRehearsalChecklist } from "./MainnetRehearsalChecklist";

const MAINNET_READY = {
  NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL: "https://soroban.example.test",
  NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID: "C".padEnd(56, "A"),
  NEXT_PUBLIC_ALLOW_MAINNET_WRITES: "true",
};

const ALL_DECLARED: RehearsalCheckId[] = [
  "fees-and-reserves",
  "usdc-trustline",
  "sponsorship",
  "alerts",
  "testnet-rehearsal",
];

function walletOn(networkId: ActiveNetworkId): NetworkComparison {
  return compareNetworks(NETWORKS.mainnet as never, {
    id: networkId,
    label: NETWORKS[networkId].label,
    networkPassphrase: NETWORKS[networkId].networkPassphrase,
  });
}

function renderChecklist({
  networkId = "mainnet" as ActiveNetworkId,
  confirmed = [] as RehearsalCheckId[],
  environment = MAINNET_READY as Record<string, string | undefined>,
  walletNetwork = walletOn("mainnet") as NetworkComparison | null,
  onToggle = vi.fn(),
} = {}) {
  const checks = buildRehearsalChecklist({
    networkId,
    capabilities: buildNetworkCapabilities(networkId, environment),
    walletNetwork,
    confirmed,
  });
  render(
    <MainnetRehearsalChecklist
      checks={checks}
      verdict={rehearsalVerdict(checks)}
      onToggle={onToggle}
      networkLabel={NETWORKS[networkId].label}
    />,
  );
  return { checks, onToggle };
}

describe("MainnetRehearsalChecklist", () => {
  it("says how many items are holding the deployment", () => {
    renderChecklist();

    expect(screen.getByTestId("rehearsal-verdict").textContent).toBe(
      "Deployment is held until 1 item below is resolved.",
    );
  });

  it("names a critical failure in plain language, not as a capability", () => {
    renderChecklist({ environment: {}, confirmed: ALL_DECLARED });

    // Creator-facing copy: an operator reads "privilegedWrites unavailable",
    // a creator reads what to do about it.
    expect(screen.getByTestId("rehearsal-writes-enabled").textContent).toContain(
      "Mainnet writes are off for this deployment",
    );
    expect(screen.getByTestId("rehearsal-rpc").textContent).toContain(
      "No RPC endpoint is configured",
    );
    expect(screen.getByTestId("rehearsal-rpc").textContent).not.toContain("NEXT_PUBLIC");
  });

  it("stops holding the deployment once the hard items are resolved", () => {
    renderChecklist({ confirmed: ["fees-and-reserves"] });

    expect(screen.getByTestId("rehearsal-verdict").textContent).toBe(
      "Nothing is blocking the deployment. 4 cautions left, which you can accept knowingly.",
    );
  });

  it("says when the list is finished", () => {
    renderChecklist({ confirmed: ALL_DECLARED });

    expect(screen.getByTestId("rehearsal-verdict").textContent).toBe(
      "Every item on this list is resolved.",
    );
  });

  it("separates what blocks from what only warns", () => {
    renderChecklist();

    expect(screen.getByText("Must be true before deploying")).toBeInTheDocument();
    expect(screen.getByText(/do not block the deployment/)).toBeInTheDocument();
  });

  it("offers a confirmation only for the items it could not check", () => {
    renderChecklist();

    // A measured signal must not be tickable: the signal is the answer.
    expect(
      screen.getByTestId("rehearsal-fees-and-reserves").querySelector("input[type=checkbox]"),
    ).not.toBeNull();
    expect(
      screen.getByTestId("rehearsal-writes-enabled").querySelector("input[type=checkbox]"),
    ).toBeNull();
  });

  it("says out loud which ticks it did not verify", () => {
    renderChecklist();

    expect(screen.getByTestId("rehearsal-fees-and-reserves").textContent).toContain(
      "Stolla cannot read your balance",
    );
    expect(screen.getByTestId("rehearsal-usdc-trustline").textContent).toContain(
      "Stolla cannot read trustlines",
    );
  });

  it("reports a confirmation back to the caller", () => {
    const { onToggle } = renderChecklist();

    fireEvent.click(
      screen
        .getByTestId("rehearsal-fees-and-reserves")
        .querySelector("input[type=checkbox]") as HTMLInputElement,
    );

    expect(onToggle).toHaveBeenCalledWith("fees-and-reserves");
  });

  it("shows a confirmed item as ticked and drops its instruction", () => {
    renderChecklist({ confirmed: ["alerts"] });

    const alerts = screen.getByTestId("rehearsal-alerts");
    expect(alerts.getAttribute("data-status")).toBe("pass");
    expect(alerts.querySelector("input[type=checkbox]")).toBeChecked();
    expect(alerts.textContent).not.toContain("gets told when RPC");
  });

  it("hides Mainnet-only items on Testnet", () => {
    renderChecklist({
      networkId: "testnet",
      environment: {},
      walletNetwork: null,
    });

    expect(screen.queryByTestId("rehearsal-wallet-network")).toBeNull();
    expect(screen.queryByTestId("rehearsal-writes-enabled")).toBeNull();
    expect(screen.queryByTestId("rehearsal-usdc-trustline")).toBeNull();
    expect(screen.getByTestId("rehearsal-rpc")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Testnet launch rehearsal" })).toBeInTheDocument();
  });

  it("points each unresolved item at the runbook", () => {
    renderChecklist();

    const link = screen
      .getByTestId("rehearsal-fees-and-reserves")
      .querySelector("a") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toContain(
      "docs/testnet-to-mainnet-runbook.md#gate-4-mainnet-pre-deployment",
    );
  });

  it("tells a reader a wallet on the wrong network is the problem", () => {
    renderChecklist({ walletNetwork: walletOn("testnet") });

    expect(screen.getByTestId("rehearsal-wallet-network").textContent).toContain(
      "The wallet is on Testnet",
    );
  });
});
