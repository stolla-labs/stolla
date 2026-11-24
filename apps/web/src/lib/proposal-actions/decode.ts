import { Buffer } from "buffer";
import { Address, scValToNative, xdr } from "@stellar/stellar-sdk";

/**
 * Frontend decoding of a Governor proposal's action record (ADR-006
 * follow-up #9). The record mirrors the `propose` arguments carried by the
 * `proposal_created` event: parallel `targets`, `functions`, and `args`.
 */
export type ProposalActionRecord = {
  targets: string[];
  functions: string[];
  args: xdr.ScVal[][];
};

export type ProposalActionContext = {
  /**
   * The community's Treasury contract, when known. A payment aimed at any
   * other target is never presented as a Treasury payment.
   */
  treasuryContractId?: string | null;
};

export type TreasuryPaymentAction = {
  kind: "treasury_payment";
  target: string;
  asset: string;
  recipient: string;
  /** Raw amount in the asset's smallest unit. Decimals are not on-chain here. */
  amount: bigint;
  /** Opaque caller-supplied reference bytes as hex, or null when empty. */
  reference: string | null;
  /** False when no Treasury id was available to confirm the target. */
  targetVerified: boolean;
};

export type UnrecognizedAction = {
  kind: "unrecognized";
  target: string;
  functionName: string;
  argCount: number;
  /** Why the call could not be treated as a known Stolla action. */
  reason: string;
};

export type DecodedProposalAction = TreasuryPaymentAction | UnrecognizedAction;

export type DecodedProposalActions =
  | { kind: "signaling" }
  | { kind: "actions"; actions: DecodedProposalAction[] }
  | { kind: "malformed"; reason: string };

/** `CommunityTreasury.pay(asset, recipient, amount, reference)` */
export const TREASURY_PAY_FUNCTION = "pay";

const TREASURY_PAY_ARG_COUNT = 4;

function readAddress(value: xdr.ScVal | undefined): string | null {
  if (!value || value.switch() !== xdr.ScValType.scvAddress()) return null;
  try {
    return Address.fromScVal(value).toString();
  } catch {
    return null;
  }
}

function isContractAddress(address: string): boolean {
  return address.startsWith("C");
}

function readPositiveI128(value: xdr.ScVal | undefined): bigint | null {
  if (!value || value.switch() !== xdr.ScValType.scvI128()) return null;
  const amount = scValToNative(value);
  return typeof amount === "bigint" && amount > BigInt(0) ? amount : null;
}

function readReference(value: xdr.ScVal | undefined): string | null | undefined {
  if (!value || value.switch() !== xdr.ScValType.scvBytes()) return undefined;
  const hex = Buffer.from(value.bytes()).toString("hex");
  return hex.length > 0 ? hex : null;
}

function unrecognized(
  target: string,
  functionName: string,
  args: xdr.ScVal[],
  reason: string,
): UnrecognizedAction {
  return {
    kind: "unrecognized",
    target,
    functionName,
    argCount: args.length,
    reason,
  };
}

function decodeAction(
  target: string,
  functionName: string,
  args: xdr.ScVal[],
  context: ProposalActionContext,
): DecodedProposalAction {
  if (functionName !== TREASURY_PAY_FUNCTION) {
    return unrecognized(target, functionName, args, "Unknown function.");
  }
  if (args.length !== TREASURY_PAY_ARG_COUNT) {
    return unrecognized(
      target,
      functionName,
      args,
      "Arguments do not match the Treasury payment shape.",
    );
  }

  const asset = readAddress(args[0]);
  const recipient = readAddress(args[1]);
  const amount = readPositiveI128(args[2]);
  const reference = readReference(args[3]);
  if (!asset || !isContractAddress(asset)) {
    return unrecognized(target, functionName, args, "Asset is not a contract address.");
  }
  if (!recipient) {
    return unrecognized(target, functionName, args, "Recipient is not an address.");
  }
  if (amount === null) {
    return unrecognized(target, functionName, args, "Amount is not a positive i128.");
  }
  if (reference === undefined) {
    return unrecognized(target, functionName, args, "Reference is not bytes.");
  }
  if (recipient === target) {
    return unrecognized(target, functionName, args, "Recipient is the Treasury itself.");
  }

  const treasury = context.treasuryContractId?.trim() || null;
  if (treasury && treasury !== target) {
    return unrecognized(
      target,
      functionName,
      args,
      "Target is not this community's Treasury.",
    );
  }

  return {
    kind: "treasury_payment",
    target,
    asset,
    recipient,
    amount,
    reference,
    targetVerified: treasury !== null,
  };
}

/**
 * Decodes an action record into display-ready actions. Anything that does not
 * match a known Stolla action exactly is returned as `unrecognized` or
 * `malformed`; it is never coerced into a payment.
 */
export function decodeProposalActions(
  record: ProposalActionRecord,
  context: ProposalActionContext = {},
): DecodedProposalActions {
  const { targets, functions, args } = record;
  if (targets.length !== functions.length || targets.length !== args.length) {
    return {
      kind: "malformed",
      reason: "Targets, functions, and arguments have different lengths.",
    };
  }
  if (targets.length === 0) return { kind: "signaling" };

  return {
    kind: "actions",
    actions: targets.map((target, index) =>
      decodeAction(target, functions[index], args[index], context),
    ),
  };
}
