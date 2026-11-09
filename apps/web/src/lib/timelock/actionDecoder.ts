export type ProposalActionBatchInput = {
  targets?: readonly string[] | null;
  functions?: readonly string[] | null;
  args?: readonly (readonly unknown[])[] | null;
  etaLedger?: number | null;
  expiresAtLedger?: number | null;
};

export type DecodedSignalingAction = {
  kind: "signaling";
  title: string;
  summary: string;
  warning: null;
};

export type DecodedTreasurySpendAction = {
  kind: "treasury_spend";
  target: string;
  functionName: string;
  asset: string;
  recipient: string;
  amount: string;
  reference: string | null;
  title: string;
  summary: string;
  warning: null;
};

export type DecodedUnrecognizedAction = {
  kind: "unrecognized";
  target: string;
  functionName: string;
  rawArgsPreview: string;
  title: string;
  summary: string;
  warning: string;
};

export type DecodedProposalActionItem =
  | DecodedSignalingAction
  | DecodedTreasurySpendAction
  | DecodedUnrecognizedAction;

export type DecodedProposalActionPolicy = {
  mode: "signaling" | "treasury" | "unrecognized";
  label: string;
  hasWarning: boolean;
  etaLedger: number | null;
  expiresAtLedger: number | null;
  actions: DecodedProposalActionItem[];
};

const TREASURY_SPEND_FUNCTIONS = new Set([
  "spend",
  "pay",
  "transfer_from_treasury",
]);

function normalizePositiveIntegerString(value: unknown): string | null {
  if (typeof value === "bigint") {
    return value > 0n ? value.toString() : null;
  }
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    try {
      const parsed = BigInt(trimmed);
      return parsed > 0n ? parsed.toString() : null;
    } catch {
      return null;
    }
  }
  return null;
}

function safeJsonPreview(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? item.toString() : item,
    ).slice(0, 240);
  } catch {
    return "[unserializable arguments]";
  }
}

function makeSignalingAction(): DecodedSignalingAction {
  return {
    kind: "signaling",
    title: "Signaling only — no custody move",
    summary:
      "This proposal records a community governance decision only and does not move treasury funds or invoke privileged contract methods.",
    warning: null,
  };
}

function makeUnrecognizedAction(
  target: string,
  functionName: string,
  callArgs: unknown,
): DecodedUnrecognizedAction {
  return {
    kind: "unrecognized",
    target: target || "(missing target)",
    functionName: functionName || "(missing function)",
    rawArgsPreview: safeJsonPreview(callArgs ?? []),
    title: "Unrecognized action — review carefully",
    summary: `Calls ${functionName || "unknown"} on ${target || "unknown target"} with unrecognized or custom parameters.`,
    warning:
      "Unrecognized contract action. This payload cannot be verified as a standard signaling vote or treasury transfer — verify the target contract and raw calldata before voting.",
  };
}

export function decodeProposalActionPolicy(
  input?: ProposalActionBatchInput | null,
): DecodedProposalActionPolicy {
  const targets = input?.targets ?? [];
  const functions = input?.functions ?? [];
  const args = input?.args ?? [];
  const etaLedger =
    typeof input?.etaLedger === "number" && Number.isFinite(input.etaLedger)
      ? input.etaLedger
      : null;
  const expiresAtLedger =
    typeof input?.expiresAtLedger === "number" &&
    Number.isFinite(input.expiresAtLedger)
      ? input.expiresAtLedger
      : null;

  if (targets.length === 0 && functions.length === 0 && args.length === 0) {
    return {
      mode: "signaling",
      label: "Signaling only / no custody move",
      hasWarning: false,
      etaLedger,
      expiresAtLedger,
      actions: [makeSignalingAction()],
    };
  }

  if (
    targets.length !== functions.length ||
    targets.length !== args.length
  ) {
    return {
      mode: "unrecognized",
      label: "Unrecognized action payload",
      hasWarning: true,
      etaLedger,
      expiresAtLedger,
      actions: [
        makeUnrecognizedAction(
          targets[0] ?? "(mismatched batch)",
          functions[0] ?? "(mismatched batch)",
          { targets, functions, args },
        ),
      ],
    };
  }

  // Standard Stolla signaling proposal: single target + "noop" + empty args
  if (
    targets.length === 1 &&
    functions[0]?.trim() === "noop" &&
    Array.isArray(args[0]) &&
    args[0].length === 0
  ) {
    return {
      mode: "signaling",
      label: "Signaling only / no custody move",
      hasWarning: false,
      etaLedger,
      expiresAtLedger,
      actions: [makeSignalingAction()],
    };
  }

  const decodedItems: DecodedProposalActionItem[] = [];

  for (let i = 0; i < targets.length; i += 1) {
    const target = String(targets[i] ?? "").trim();
    const fnName = String(functions[i] ?? "").trim();
    const callArgs = args[i];

    if (!target || !fnName || !Array.isArray(callArgs)) {
      decodedItems.push(makeUnrecognizedAction(target, fnName, callArgs));
      continue;
    }

    if (TREASURY_SPEND_FUNCTIONS.has(fnName)) {
      const rawFirst = callArgs[0];
      let asset = "";
      let recipient = "";
      let amount: string | null = null;
      let reference: string | null = null;

      if (
        rawFirst &&
        typeof rawFirst === "object" &&
        !Array.isArray(rawFirst) &&
        callArgs.length === 1
      ) {
        const obj = rawFirst as Record<string, unknown>;
        asset = typeof obj.asset === "string" ? obj.asset.trim() : "";
        recipient =
          typeof obj.recipient === "string" ? obj.recipient.trim() : "";
        amount = normalizePositiveIntegerString(obj.amount);
        reference =
          typeof obj.reference === "string" && obj.reference.trim()
            ? obj.reference.trim()
            : null;
      } else if (callArgs.length >= 3 && callArgs.length <= 4) {
        asset = typeof callArgs[0] === "string" ? callArgs[0].trim() : "";
        recipient = typeof callArgs[1] === "string" ? callArgs[1].trim() : "";
        amount = normalizePositiveIntegerString(callArgs[2]);
        reference =
          typeof callArgs[3] === "string" && callArgs[3].trim()
            ? callArgs[3].trim()
            : null;
      }

      if (asset && recipient && amount) {
        decodedItems.push({
          kind: "treasury_spend",
          target,
          functionName: fnName,
          asset,
          recipient,
          amount,
          reference,
          title: "Treasury asset spend",
          summary: `Transfers ${amount} of ${asset} to ${recipient} from ${target}.`,
          warning: null,
        });
        continue;
      }
    }

    decodedItems.push(makeUnrecognizedAction(target, fnName, callArgs));
  }

  const hasWarning = decodedItems.some((item) => item.kind === "unrecognized");
  const mode = hasWarning ? "unrecognized" : "treasury";

  return {
    mode,
    label: hasWarning
      ? "Unrecognized action — review carefully"
      : "Treasury execution policy",
    hasWarning,
    etaLedger,
    expiresAtLedger,
    actions: decodedItems,
  };
}
