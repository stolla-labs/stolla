import { Buffer } from "buffer";
import { Address, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  MOCK_ACCOUNT_ALICE,
  MOCK_CONTRACT_A,
  MOCK_CONTRACT_B,
  MOCK_CONTRACT_OTHER,
} from "@/test-support/stellar/fixtures";
import type { ProposalActionRecord } from "@/lib/proposal-actions/decode";
import { ProposalActionsPanel, SIGNALING_NO_CUSTODY_MESSAGE } from "./ProposalActionsPanel";

const address = (value: string) => new Address(value).toScVal();
const payArgs = () => [
  address(MOCK_CONTRACT_B),
  address(MOCK_ACCOUNT_ALICE),
  nativeToScVal(BigInt(1_250_000), { type: "i128" }),
  xdr.ScVal.scvBytes(Buffer.from("beef", "hex")),
];

const ready = (record: ProposalActionRecord | null) =>
  ({ status: "ready", record }) as const;

describe("ProposalActionsPanel", () => {
  it("states that a signaling proposal moves no custody", () => {
    render(<ProposalActionsPanel resolution={ready({ targets: [], functions: [], args: [] })} />);

    const panel = screen.getByRole("region", { name: "Proposal actions" });
    expect(within(panel).getByText(SIGNALING_NO_CUSTODY_MESSAGE)).toBeInTheDocument();
    expect(within(panel).getByText(/signaling only \/ no custody move/i)).toBeInTheDocument();
  });

  it("shows asset, amount, and recipient for a Treasury payment", () => {
    render(
      <ProposalActionsPanel
        resolution={ready({ targets: [MOCK_CONTRACT_A], functions: ["pay"], args: [payArgs()] })}
        context={{ treasuryContractId: MOCK_CONTRACT_A }}
      />,
    );

    expect(screen.getByText("Treasury payment")).toBeInTheDocument();
    expect(screen.getByText("1,250,000")).toBeInTheDocument();
    expect(screen.getByLabelText("Copy Asset contract")).toBeInTheDocument();
    expect(screen.getByLabelText("Copy Recipient")).toBeInTheDocument();
    expect(screen.getByText("beef")).toBeInTheDocument();
    expect(screen.queryByText(/could not be verified/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("warns when the payment target is not verified as the Treasury", () => {
    render(
      <ProposalActionsPanel
        resolution={ready({ targets: [MOCK_CONTRACT_A], functions: ["pay"], args: [payArgs()] })}
      />,
    );

    expect(screen.getByText(/could not be verified as this community/i)).toBeInTheDocument();
  });

  it("shows an unrecognized action as a warning, never as a transfer", () => {
    render(
      <ProposalActionsPanel
        resolution={ready({
          targets: [MOCK_CONTRACT_OTHER],
          functions: ["set_admin"],
          args: [[address(MOCK_ACCOUNT_ALICE)]],
        })}
      />,
    );

    expect(screen.getByText("Unrecognized action")).toBeInTheDocument();
    expect(screen.getByText("set_admin")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/unrecognized actions/i);
    expect(screen.queryByText("Treasury payment")).not.toBeInTheDocument();
    expect(screen.queryByText(SIGNALING_NO_CUSTODY_MESSAGE)).not.toBeInTheDocument();
  });

  it("downgrades a mismatched payment shape to an unrecognized warning", () => {
    render(
      <ProposalActionsPanel
        resolution={ready({ targets: [MOCK_CONTRACT_OTHER], functions: ["pay"], args: [payArgs()] })}
        context={{ treasuryContractId: MOCK_CONTRACT_A }}
      />,
    );

    expect(screen.getByText("Unrecognized action")).toBeInTheDocument();
    expect(screen.queryByText("Treasury payment")).not.toBeInTheDocument();
  });

  it("warns on a malformed record", () => {
    render(
      <ProposalActionsPanel
        resolution={ready({ targets: [MOCK_CONTRACT_A], functions: [], args: [] })}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/unrecognized action record/i);
  });

  it("does not claim signaling when the record is missing", () => {
    render(<ProposalActionsPanel resolution={ready(null)} />);

    expect(screen.getByRole("alert")).toHaveTextContent(/do not assume/i);
    expect(screen.queryByText(SIGNALING_NO_CUSTODY_MESSAGE)).not.toBeInTheDocument();
  });

  it("does not claim signaling when loading failed", () => {
    render(<ProposalActionsPanel resolution={{ status: "error", error: "RPC down" }} />);

    expect(screen.getByRole("alert")).toHaveTextContent("RPC down");
    expect(screen.queryByText(SIGNALING_NO_CUSTODY_MESSAGE)).not.toBeInTheDocument();
  });

  it("shows a loading status", () => {
    render(<ProposalActionsPanel resolution={{ status: "loading" }} />);

    expect(screen.getByRole("status")).toHaveTextContent(/loading proposal actions/i);
  });
});
