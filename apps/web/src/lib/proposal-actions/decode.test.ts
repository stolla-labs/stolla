import { Buffer } from "buffer";
import { Address, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import {
  MOCK_ACCOUNT_ALICE,
  MOCK_CONTRACT_A,
  MOCK_CONTRACT_B,
  MOCK_CONTRACT_OTHER,
} from "@/test-support/stellar/fixtures";
import { decodeProposalActions, type ProposalActionRecord } from "./decode";

const TREASURY = MOCK_CONTRACT_A;
const ASSET = MOCK_CONTRACT_B;

const address = (value: string) => new Address(value).toScVal();
const i128 = (value: bigint) => nativeToScVal(value, { type: "i128" });
const bytes = (hex: string) => xdr.ScVal.scvBytes(Buffer.from(hex, "hex"));

function payRecord(args: xdr.ScVal[], target = TREASURY): ProposalActionRecord {
  return { targets: [target], functions: ["pay"], args: [args] };
}

const validPayArgs = () => [
  address(ASSET),
  address(MOCK_ACCOUNT_ALICE),
  i128(BigInt(25_000_000)),
  bytes("abcd"),
];

describe("decodeProposalActions", () => {
  it("treats an empty record as signaling only", () => {
    expect(decodeProposalActions({ targets: [], functions: [], args: [] })).toEqual({
      kind: "signaling",
    });
  });

  it("decodes a Treasury payment into asset, amount, and recipient", () => {
    const decoded = decodeProposalActions(payRecord(validPayArgs()), {
      treasuryContractId: TREASURY,
    });

    expect(decoded).toEqual({
      kind: "actions",
      actions: [
        {
          kind: "treasury_payment",
          target: TREASURY,
          asset: ASSET,
          recipient: MOCK_ACCOUNT_ALICE,
          amount: BigInt(25_000_000),
          reference: "abcd",
          targetVerified: true,
        },
      ],
    });
  });

  it("marks the target unverified when the Treasury id is unknown", () => {
    const decoded = decodeProposalActions(payRecord(validPayArgs()));

    expect(decoded).toMatchObject({
      kind: "actions",
      actions: [{ kind: "treasury_payment", targetVerified: false }],
    });
  });

  it("reports an empty reference as null", () => {
    const args = validPayArgs();
    args[3] = bytes("");

    expect(decodeProposalActions(payRecord(args))).toMatchObject({
      actions: [{ kind: "treasury_payment", reference: null }],
    });
  });

  it("keeps batch order and mixes known and unknown actions", () => {
    const decoded = decodeProposalActions({
      targets: [TREASURY, MOCK_CONTRACT_OTHER],
      functions: ["pay", "upgrade"],
      args: [validPayArgs(), [bytes("00")]],
    });

    expect(decoded).toMatchObject({
      kind: "actions",
      actions: [
        { kind: "treasury_payment" },
        { kind: "unrecognized", target: MOCK_CONTRACT_OTHER, functionName: "upgrade", argCount: 1 },
      ],
    });
  });

  it("never decodes an unknown function as a payment", () => {
    const decoded = decodeProposalActions({
      targets: [TREASURY],
      functions: ["transfer"],
      args: [validPayArgs()],
    });

    expect(decoded).toMatchObject({
      actions: [{ kind: "unrecognized", functionName: "transfer" }],
    });
  });

  it("rejects a payment aimed at a target other than the known Treasury", () => {
    const decoded = decodeProposalActions(payRecord(validPayArgs(), MOCK_CONTRACT_OTHER), {
      treasuryContractId: TREASURY,
    });

    expect(decoded).toMatchObject({
      actions: [{ kind: "unrecognized", reason: "Target is not this community's Treasury." }],
    });
  });

  it.each([
    ["wrong argument count", (args: xdr.ScVal[]) => args.slice(0, 3)],
    ["account asset", (args: xdr.ScVal[]) => [address(MOCK_ACCOUNT_ALICE), ...args.slice(1)]],
    ["non-address recipient", (args: xdr.ScVal[]) => [args[0], bytes("01"), args[2], args[3]]],
    ["zero amount", (args: xdr.ScVal[]) => [args[0], args[1], i128(BigInt(0)), args[3]]],
    ["negative amount", (args: xdr.ScVal[]) => [args[0], args[1], i128(BigInt(-5)), args[3]]],
    ["non-i128 amount", (args: xdr.ScVal[]) => [args[0], args[1], nativeToScVal(5, { type: "u32" }), args[3]]],
    ["non-bytes reference", (args: xdr.ScVal[]) => [args[0], args[1], args[2], nativeToScVal("ref")]],
    ["Treasury as recipient", (args: xdr.ScVal[]) => [args[0], address(TREASURY), args[2], args[3]]],
  ])("treats a pay call with %s as unrecognized", (_label, mutate) => {
    const decoded = decodeProposalActions(payRecord(mutate(validPayArgs())));

    expect(decoded).toMatchObject({ actions: [{ kind: "unrecognized", functionName: "pay" }] });
  });

  it("flags records whose parallel arrays disagree", () => {
    const decoded = decodeProposalActions({
      targets: [TREASURY],
      functions: [],
      args: [validPayArgs()],
    });

    expect(decoded).toMatchObject({ kind: "malformed" });
  });
});
