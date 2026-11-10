import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StrKey } from "@stellar/stellar-sdk";
import { decodeProposalActionPolicy } from "./actionPolicy";
import { ProposalActionPolicySummary } from "@/components/community/ProposalActionPolicySummary";

const RECIPIENT_ADDR = StrKey.encodeEd25519PublicKey(
  new Uint8Array(32).fill(7),
);
const TREASURY_CONTRACT = StrKey.encodeContract(new Uint8Array(32).fill(9));

describe("decodeProposalActionPolicy & ProposalActionPolicySummary (#380)", () => {
  it("clearly identifies signaling-only proposals with no custody move", () => {
    const decoded = decodeProposalActionPolicy(null);
    expect(decoded.kind).toBe("signaling");
    expect(decoded.summary).toMatch(/Signaling only \/ no custody move/i);

    render(<ProposalActionPolicySummary actionPayload={undefined} />);
    expect(
      screen.getByTestId("proposal-action-policy-badge"),
    ).toHaveTextContent("Signaling only");
    expect(
      screen.getByText(/Signaling only \/ no custody move/i),
    ).toBeInTheDocument();
  });

  it("decodes valid treasury spend actions showing asset, amount, recipient, and execution window", () => {
    const payload = {
      kind: "treasury_spend",
      target: TREASURY_CONTRACT,
      fn: "spend",
      asset: "USDC",
      amount: "1250",
      recipient: RECIPIENT_ADDR,
      etaLedger: 45000,
      expiresAtLedger: 165960,
    };
    const decoded = decodeProposalActionPolicy(payload);
    expect(decoded.kind).toBe("treasury_spend");
    expect(decoded.fields).toMatchObject({
      asset: "USDC",
      amount: "1250",
      recipient: RECIPIENT_ADDR,
      target: TREASURY_CONTRACT,
      etaLedger: 45000,
      expiresAtLedger: 165960,
    });

    render(<ProposalActionPolicySummary actionPayload={payload} />);
    expect(
      screen.getByTestId("proposal-action-policy-badge"),
    ).toHaveTextContent("Treasury spend");
    expect(screen.getByText("USDC")).toBeInTheDocument();
    expect(screen.getByText("1250")).toBeInTheDocument();
    expect(screen.getByText(RECIPIENT_ADDR)).toBeInTheDocument();
  });

  it("decodes custom contract calls with an explicit verification warning", () => {
    const payload = {
      kind: "custom_call",
      target: TREASURY_CONTRACT,
      fn: "update_quorum",
    };
    const decoded = decodeProposalActionPolicy(payload);
    expect(decoded.kind).toBe("custom_call");
    expect(decoded.warning).toMatch(/verify the target contract address/i);
  });

  it("never renders malformed or unrecognized payloads as a safe transfer", () => {
    const spoofedTransfer = {
      kind: "treasury_spend",
      asset: "XLM",
      amount: "5000",
      recipient: "NOT_A_VALID_STELLAR_KEY",
    };
    const decodedSpoof = decodeProposalActionPolicy(spoofedTransfer);
    expect(decodedSpoof.kind).toBe("unrecognized");
    expect(decodedSpoof.warning).toMatch(
      /cannot be verified as a safe treasury spend/i,
    );

    const opaquePayload = {
      arbitraryBytes: "0xdeadbeef",
    };
    render(<ProposalActionPolicySummary actionPayload={opaquePayload} />);
    expect(
      screen.getByTestId("proposal-action-policy-badge"),
    ).toHaveTextContent("Unrecognized action");
    expect(
      screen.getByTestId("proposal-action-policy-warning"),
    ).toHaveTextContent(/Do not treat this proposal as a verified transfer/i);
  });
});
