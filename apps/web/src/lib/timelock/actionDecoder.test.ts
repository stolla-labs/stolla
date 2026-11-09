import { describe, expect, it } from "vitest";
import { decodeProposalActionPolicy } from "./actionDecoder";

describe("decodeProposalActionPolicy", () => {
  it("clearly marks empty and noop proposals as signaling only / no custody move", () => {
    const emptyBatch = decodeProposalActionPolicy();
    expect(emptyBatch.mode).toBe("signaling");
    expect(emptyBatch.hasWarning).toBe(false);
    expect(emptyBatch.label).toMatch(/signaling only \/ no custody move/i);
    expect(emptyBatch.actions).toHaveLength(1);
    expect(emptyBatch.actions[0].kind).toBe("signaling");

    const noopBatch = decodeProposalActionPolicy({
      targets: ["GPROPOSER123"],
      functions: ["noop"],
      args: [[]],
    });
    expect(noopBatch.mode).toBe("signaling");
    expect(noopBatch.hasWarning).toBe(false);
    expect(noopBatch.actions[0].title).toBe("Signaling only — no custody move");
  });

  it("decodes treasury spend actions with asset, amount, recipient, target, ETA, and expiry", () => {
    const decoded = decodeProposalActionPolicy({
      targets: ["CTREASURY_CONTRACT"],
      functions: ["spend"],
      args: [["CASSET_USDC", "GRECIPIENT_ALICE", "250000000", "milestone-1"]],
      etaLedger: 1534560,
      expiresAtLedger: 1655520,
    });

    expect(decoded.mode).toBe("treasury");
    expect(decoded.hasWarning).toBe(false);
    expect(decoded.etaLedger).toBe(1534560);
    expect(decoded.expiresAtLedger).toBe(1655520);
    expect(decoded.actions).toHaveLength(1);

    const action = decoded.actions[0];
    expect(action.kind).toBe("treasury_spend");
    if (action.kind === "treasury_spend") {
      expect(action.target).toBe("CTREASURY_CONTRACT");
      expect(action.asset).toBe("CASSET_USDC");
      expect(action.recipient).toBe("GRECIPIENT_ALICE");
      expect(action.amount).toBe("250000000");
      expect(action.reference).toBe("milestone-1");
    }
  });

  it("flags unknown functions, malformed spend args, and mismatched vectors as unrecognized with warnings", () => {
    const unknownCall = decodeProposalActionPolicy({
      targets: ["CCUSTOM_CONTRACT"],
      functions: ["upgrade"],
      args: [["deadbeef"]],
    });
    expect(unknownCall.mode).toBe("unrecognized");
    expect(unknownCall.hasWarning).toBe(true);
    expect(unknownCall.actions[0].kind).toBe("unrecognized");
    expect(unknownCall.actions[0].warning).toMatch(/Unrecognized contract action/);

    // Malformed treasury spend (zero amount) cannot masquerade as a valid transfer
    const zeroSpend = decodeProposalActionPolicy({
      targets: ["CTREASURY_CONTRACT"],
      functions: ["spend"],
      args: [["CASSET_USDC", "GRECIPIENT_ALICE", "0"]],
    });
    expect(zeroSpend.mode).toBe("unrecognized");
    expect(zeroSpend.hasWarning).toBe(true);
    expect(zeroSpend.actions[0].kind).toBe("unrecognized");

    // Mismatched vector lengths
    const mismatched = decodeProposalActionPolicy({
      targets: ["CTREASURY_CONTRACT"],
      functions: ["spend", "extra_fn"],
      args: [["CASSET_USDC", "GRECIPIENT_ALICE", "100"]],
    });
    expect(mismatched.mode).toBe("unrecognized");
    expect(mismatched.hasWarning).toBe(true);
  });
});
