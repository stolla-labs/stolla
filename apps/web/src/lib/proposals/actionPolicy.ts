import { StrKey } from "@stellar/stellar-sdk";

export type ProposalActionPolicyKind =
  | "signaling"
  | "treasury_spend"
  | "custom_call"
  | "unrecognized";

export type DecodedProposalActionPolicy = {
  kind: ProposalActionPolicyKind;
  badge: string;
  summary: string;
  warning: string | null;
  fields: {
    target?: string;
    functionName?: string;
    asset?: string;
    amount?: string;
    recipient?: string;
    etaLedger?: number | null;
    expiresAtLedger?: number | null;
  };
};

export type DecodeActionPolicyOptions = {
  timelockConfigured?: boolean;
  etaLedger?: number | null;
  expiresAtLedger?: number | null;
};

function isValidStellarRecipient(value: string): boolean {
  const trimmed = value.trim();
  return (
    StrKey.isValidEd25519PublicKey(trimmed) ||
    StrKey.isValidContract(trimmed)
  );
}

function normalizeAmount(value: unknown): string | null {
  if (typeof value === "bigint") {
    return value > 0n ? value.toString() : null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? String(value) : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
    return Number(trimmed) > 0 ? trimmed : null;
  }
  return null;
}

/**
 * Decodes a proposal's action record into a human-readable policy summary (#380).
 * Ensures unrecognized or malformed payloads never appear as safe transfers.
 */
export function decodeProposalActionPolicy(
  rawAction: unknown,
  options: DecodeActionPolicyOptions = {},
): DecodedProposalActionPolicy {
  const etaLedger = options.etaLedger ?? null;
  const expiresAtLedger = options.expiresAtLedger ?? null;

  if (
    rawAction === null ||
    rawAction === undefined ||
    (Array.isArray(rawAction) && rawAction.length === 0)
  ) {
    return {
      kind: "signaling",
      badge: "Signaling only",
      summary:
        "Signaling only / no custody move — this proposal records community direction without moving treasury funds or invoking an external contract.",
      warning: null,
      fields: { etaLedger, expiresAtLedger },
    };
  }

  const candidate =
    Array.isArray(rawAction) && rawAction.length === 1
      ? rawAction[0]
      : rawAction;

  if (
    !candidate ||
    typeof candidate !== "object" ||
    Array.isArray(candidate)
  ) {
    return {
      kind: "unrecognized",
      badge: "Unrecognized action",
      summary:
        "Unrecognized action payload — cannot verify target, asset, or recipient before voting.",
      warning:
        "Unrecognized action schema. Do not treat this proposal as a verified transfer.",
      fields: { etaLedger, expiresAtLedger },
    };
  }

  const record = candidate as Record<string, unknown>;
  const rawKind = typeof record.kind === "string" ? record.kind.trim() : "";
  const rawFn =
    typeof record.fn === "string"
      ? record.fn.trim()
      : typeof record.function === "string"
        ? record.function.trim()
        : "";
  const rawTarget =
    typeof record.target === "string" ? record.target.trim() : "";

  if (rawKind === "signaling" && !rawFn && !rawTarget && !record.amount) {
    return {
      kind: "signaling",
      badge: "Signaling only",
      summary:
        "Signaling only / no custody move — this proposal records community direction without moving treasury funds or invoking an external contract.",
      warning: null,
      fields: { etaLedger, expiresAtLedger },
    };
  }

  const isTreasuryCandidate =
    rawKind === "treasury_spend" ||
    rawFn === "spend" ||
    rawFn === "transfer" ||
    "recipient" in record ||
    "asset" in record ||
    "amount" in record;

  if (isTreasuryCandidate) {
    const asset =
      typeof record.asset === "string" ? record.asset.trim() : "";
    const recipient =
      typeof record.recipient === "string"
        ? record.recipient.trim()
        : typeof record.to === "string"
          ? record.to.trim()
          : "";
    const amount = normalizeAmount(record.amount);

    if (!asset || !amount || !recipient || !isValidStellarRecipient(recipient)) {
      return {
        kind: "unrecognized",
        badge: "Unrecognized action",
        summary:
          "Unrecognized action payload — missing or invalid treasury transfer fields (asset, amount, or recipient).",
        warning:
          "Malformed or unrecognized transfer fields. This payload cannot be verified as a safe treasury spend.",
        fields: { etaLedger, expiresAtLedger },
      };
    }

    return {
      kind: "treasury_spend",
      badge: "Treasury spend",
      summary: `Treasury spend of ${amount} ${asset} to ${recipient}${
        rawTarget ? ` via ${rawTarget}` : ""
      }.`,
      warning: null,
      fields: {
        target: rawTarget || undefined,
        functionName: rawFn || "spend",
        asset,
        amount,
        recipient,
        etaLedger:
          typeof record.etaLedger === "number" ? record.etaLedger : etaLedger,
        expiresAtLedger:
          typeof record.expiresAtLedger === "number"
            ? record.expiresAtLedger
            : expiresAtLedger,
      },
    };
  }

  if (
    (rawKind === "custom_call" || Boolean(rawFn)) &&
    rawTarget &&
    StrKey.isValidContract(rawTarget) &&
    /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(rawFn)
  ) {
    return {
      kind: "custom_call",
      badge: "Custom contract call",
      summary: `Invokes ${rawFn} on target contract ${rawTarget}.`,
      warning:
        "Custom contract call — verify the target contract address and arguments before casting your vote.",
      fields: {
        target: rawTarget,
        functionName: rawFn,
        etaLedger,
        expiresAtLedger,
      },
    };
  }

  return {
    kind: "unrecognized",
    badge: "Unrecognized action",
    summary:
      "Unrecognized action payload — cannot verify target, asset, or recipient before voting.",
    warning:
      "Unrecognized action schema. Do not treat this proposal as a verified transfer.",
    fields: { etaLedger, expiresAtLedger },
  };
}
