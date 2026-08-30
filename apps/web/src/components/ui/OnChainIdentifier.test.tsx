import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OnChainIdentifier } from "./OnChainIdentifier";

const CONTRACT_ID = "C".padEnd(56, "A");
const ACCOUNT_ID = "G".padEnd(56, "A");
const TX_HASH = "a".repeat(64);
const PROPOSAL_ID = "b".repeat(40);

describe("OnChainIdentifier", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_NETWORK", "testnet");
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("truncates the value deterministically and exposes the full value via title", () => {
    render(<OnChainIdentifier label="Governor contract" value={CONTRACT_ID} kind="contract" />);

    const text = screen.getByTitle(CONTRACT_ID);
    expect(text).toHaveTextContent(`${CONTRACT_ID.slice(0, 8)}…${CONTRACT_ID.slice(-6)}`);
  });

  it("does not change the copy button's accessible name after a successful copy", async () => {
    render(<OnChainIdentifier label="Governor contract" value={CONTRACT_ID} kind="contract" />);

    const button = screen.getByRole("button", { name: "Copy Governor contract" });
    fireEvent.click(button);

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(CONTRACT_ID));
    expect(screen.getByRole("button", { name: "Copy Governor contract" })).toBe(button);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Governor contract copied to clipboard"),
    );
  });

  it("announces a failure without changing the accessible name", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });

    render(<OnChainIdentifier label="Proposer" value={ACCOUNT_ID} kind="account" />);
    const button = screen.getByRole("button", { name: "Copy Proposer" });
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Failed to copy Proposer"));
    expect(screen.getByRole("button", { name: "Copy Proposer" })).toBe(button);
  });

  it("links contract ids to the contract explorer entity for the active network", () => {
    render(<OnChainIdentifier label="Governor contract" value={CONTRACT_ID} kind="contract" network="mainnet" />);

    expect(screen.getByRole("link", { name: "Open Governor contract in explorer" })).toHaveAttribute(
      "href",
      `https://stellar.expert/explorer/public/contract/${CONTRACT_ID}`,
    );
  });

  it("links account addresses to the account explorer entity", () => {
    render(<OnChainIdentifier label="Proposer" value={ACCOUNT_ID} kind="account" network="testnet" />);

    expect(screen.getByRole("link", { name: "Open Proposer in explorer" })).toHaveAttribute(
      "href",
      `https://stellar.expert/explorer/testnet/account/${ACCOUNT_ID}`,
    );
  });

  it("links transaction hashes to the tx explorer entity", () => {
    render(<OnChainIdentifier label="Transaction" value={TX_HASH} kind="tx" network="testnet" />);

    expect(screen.getByRole("link", { name: "Open Transaction in explorer" })).toHaveAttribute(
      "href",
      `https://stellar.expert/explorer/testnet/tx/${TX_HASH}`,
    );
  });

  it("never renders an explorer link for opaque values like proposal ids", () => {
    render(<OnChainIdentifier label="Proposal" value={PROPOSAL_ID} kind="opaque" />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("never renders an explorer link when the value fails validation for its kind", () => {
    render(<OnChainIdentifier label="Governor contract" value="not-a-real-contract-id" kind="contract" />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
