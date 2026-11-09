/**
 * Typed frontend taxonomy for transaction failures.
 */
export const TRANSACTION_ERROR_CATEGORIES = [
  "wallet_rejected",
  "wallet_unavailable",
  "simulation_failed",
  "rpc_unavailable",
  "send_failed",
  "confirmation_timeout",
  "still_pending",
  "contract_error",
  "unknown",
] as const;

export type TransactionErrorCategory =
  (typeof TRANSACTION_ERROR_CATEGORIES)[number];

export const TRANSACTION_ERROR_CATALOG_CODES = [
  ...TRANSACTION_ERROR_CATEGORIES,
  "pin_failed",
  "config_missing",
  "network_mismatch",
  "insufficient_voting_power",
  "duplicate_vote",
  "unauthorized",
] as const;

export type TransactionErrorCatalogCode =
  (typeof TRANSACTION_ERROR_CATALOG_CODES)[number];

export type TransactionErrorFlow =
  | "mint"
  | "propose"
  | "vote"
  | "deploy"
  | "pin"
  | "timelock"
  | "ownership";

export type TransactionErrorCatalogEntry = {
  code: TransactionErrorCatalogCode;
  category: TransactionErrorCategory;
  title: string;
  body: string;
  cta: string;
  retryable: boolean;
  /** Collapsible technical detail (never rendered directly in title/body). */
  diagnostic: string | null;
};

export type MappedTransactionError = {
  category: TransactionErrorCategory;
  /** Concise user-facing message. */
  message: string;
  /** Whether the user should retry the same action. */
  retryable: boolean;
  /** Technical detail for diagnostics (never render directly). */
  diagnostic: string | null;
};

export const TRANSACTION_ERROR_CATALOG: Record<
  TransactionErrorCatalogCode,
  Omit<TransactionErrorCatalogEntry, "code" | "diagnostic">
> = {
  wallet_rejected: {
    category: "wallet_rejected",
    title: "Wallet request declined",
    body: "You rejected the wallet request. Approve the next prompt to continue.",
    cta: "Review and approve in wallet",
    retryable: true,
  },
  wallet_unavailable: {
    category: "wallet_unavailable",
    title: "Wallet unavailable",
    body: "No wallet is available. Connect or unlock your Stellar wallet, then try again.",
    cta: "Connect wallet",
    retryable: true,
  },
  simulation_failed: {
    category: "simulation_failed",
    title: "Simulation failed",
    body: "The transaction could not be simulated. Check your inputs and account state, then retry.",
    cta: "Review inputs and retry",
    retryable: true,
  },
  rpc_unavailable: {
    category: "rpc_unavailable",
    title: "Network unreachable",
    body: "The Stellar network is temporarily unreachable. Wait a moment and try again.",
    cta: "Retry request",
    retryable: true,
  },
  send_failed: {
    category: "send_failed",
    title: "Submission failed",
    body: "The transaction could not be submitted. Check your connection and retry.",
    cta: "Retry submission",
    retryable: true,
  },
  confirmation_timeout: {
    category: "confirmation_timeout",
    title: "Confirmation timed out",
    body: "Confirmation timed out. The transaction may still be pending—check an explorer before retrying.",
    cta: "Check Stellar Expert",
    retryable: false,
  },
  still_pending: {
    category: "still_pending",
    title: "Transaction still pending",
    body: "The transaction is still pending on the network. Check your wallet or explorer before submitting again.",
    cta: "View transaction status",
    retryable: false,
  },
  contract_error: {
    category: "contract_error",
    title: "Contract rejected operation",
    body: "The contract rejected this operation. Review the requirements and try a different action.",
    cta: "Review contract requirements",
    retryable: false,
  },
  unknown: {
    category: "unknown",
    title: "Unexpected transaction error",
    body: "Something went wrong while processing the transaction. Please try again.",
    cta: "Try again",
    retryable: true,
  },
  pin_failed: {
    category: "send_failed",
    title: "Metadata pinning failed",
    body: "Could not pin metadata to IPFS. Your draft is preserved; wait a moment and retry.",
    cta: "Retry IPFS pin",
    retryable: true,
  },
  config_missing: {
    category: "simulation_failed",
    title: "Configuration missing",
    body: "Required server or contract configuration is missing. Retrying will not succeed until configuration is updated.",
    cta: "Check deployment configuration",
    retryable: false,
  },
  network_mismatch: {
    category: "simulation_failed",
    title: "Wrong wallet network",
    body: "Your wallet is connected to a different Stellar network. Switch to the configured network and try again.",
    cta: "Switch wallet network",
    retryable: true,
  },
  insufficient_voting_power: {
    category: "contract_error",
    title: "Insufficient voting power",
    body: "Your account does not meet the delegated voting power required for this action. Mint a membership NFT and delegate voting power first.",
    cta: "Check membership & delegation",
    retryable: false,
  },
  duplicate_vote: {
    category: "contract_error",
    title: "Already voted",
    body: "You have already voted on this proposal.",
    cta: "View vote receipt",
    retryable: false,
  },
  unauthorized: {
    category: "contract_error",
    title: "Wallet not authorized",
    body: "This wallet is not authorized to perform this action on the contract.",
    cta: "Switch to authorized wallet",
    retryable: false,
  },
};

function asDiagnostic(error: unknown): string | null {
  if (error instanceof Error) {
    const text = error.message?.trim();
    return text ? text.slice(0, 500) : error.name || null;
  }
  if (typeof error === "string") {
    const text = error.trim();
    return text ? text.slice(0, 500) : null;
  }
  return null;
}

function lowerText(error: unknown): string {
  if (error instanceof Error) {
    const kind =
      "kind" in error && typeof (error as { kind?: unknown }).kind === "string"
        ? (error as { kind: string }).kind
        : "";
    return `${error.name} ${kind} ${error.message}`.toLowerCase();
  }
  if (typeof error === "string") return error.toLowerCase();
  return "";
}

function classifyCatalogCode(
  error: unknown,
  flow?: TransactionErrorFlow,
): TransactionErrorCatalogCode {
  const text = lowerText(error);

  if (
    text.includes("user rejected") ||
    text.includes("user declined") ||
    text.includes("rejected the request") ||
    text.includes("user cancelled") ||
    text.includes("user canceled") ||
    (text.includes("denied") && text.includes("user"))
  ) {
    return "wallet_rejected";
  }

  if (
    text.includes("no wallet") ||
    text.includes("wallet not found") ||
    text.includes("wallet unavailable") ||
    text.includes("wallet is not connected") ||
    (text.includes("freighter") && text.includes("not installed"))
  ) {
    return "wallet_unavailable";
  }

  if (
    text.includes("pinata_jwt") ||
    text.includes("not configured") ||
    (text.includes("ipfspinerror") && text.includes("config")) ||
    text.includes("missing environment")
  ) {
    return "config_missing";
  }

  if (
    flow === "pin" ||
    text.includes("ipfspinerror") ||
    text.includes("pinning failed") ||
    text.includes("/api/ipfs/pin")
  ) {
    return "pin_failed";
  }

  if (
    text.includes("networkmismatcherror") ||
    (text.includes("wallet network") && text.includes("does not match")) ||
    (text.includes("switch it to") && text.includes("network"))
  ) {
    return "network_mismatch";
  }

  if (
    text.includes("still pending") ||
    text.includes("transactionstillpending") ||
    (text.includes("pending") && text.includes("waited"))
  ) {
    return "still_pending";
  }

  if (
    text.includes("timed out") ||
    text.includes("timeout") ||
    text.includes("confirmation timeout")
  ) {
    return "confirmation_timeout";
  }

  if (
    text.includes("failed to fetch") ||
    text.includes("networkerror") ||
    text.includes("network request failed") ||
    text.includes("econnrefused") ||
    text.includes("enotfound") ||
    (text.includes("rpc") &&
      (text.includes("unavailable") || text.includes("unreachable")))
  ) {
    return "rpc_unavailable";
  }

  if (
    text.includes("alreadyvoted") ||
    text.includes("already voted") ||
    text.includes("#5016") ||
    text.includes("error 5016")
  ) {
    return "duplicate_vote";
  }

  if (
    text.includes("proposalthreshold") ||
    text.includes("proposal threshold") ||
    text.includes("insufficient voting") ||
    text.includes("insufficientvotes")
  ) {
    return "insufficient_voting_power";
  }

  if (
    text.includes("unauthorized") ||
    text.includes("only the current") ||
    text.includes("not authorized")
  ) {
    return "unauthorized";
  }

  if (text.includes("simulation") || text.includes("simulate")) {
    return "simulation_failed";
  }

  if (
    text.includes("hosterror") ||
    text.includes("traphost") ||
    (text.includes("contract") && text.includes("error")) ||
    text.includes("insufficient")
  ) {
    return "contract_error";
  }

  if (
    text.includes("send failed") ||
    text.includes("sendtransaction") ||
    text.includes("submission failed") ||
    text.includes("failed to send")
  ) {
    return "send_failed";
  }

  if (
    text.includes("rejected") ||
    text.includes("cancelled") ||
    text.includes("canceled")
  ) {
    return "wallet_rejected";
  }

  return "unknown";
}

/**
 * Look up the full plain-language catalog entry (code, title, body, CTA,
 * retryable, and collapsible diagnostic) for mint, propose, vote, deploy,
 * pin, timelock, or ownership flows.
 */
export function lookupTransactionErrorCatalog(
  error: unknown,
  flow?: TransactionErrorFlow,
): TransactionErrorCatalogEntry {
  const code = classifyCatalogCode(error, flow);
  const entry = TRANSACTION_ERROR_CATALOG[code];
  return {
    code,
    category: entry.category,
    title: entry.title,
    body: entry.body,
    cta: entry.cta,
    retryable: entry.retryable,
    diagnostic: asDiagnostic(error),
  };
}

/**
 * Map an unknown transaction failure into a safe, actionable user message.
 */
export function mapTransactionError(error: unknown): MappedTransactionError {
  const catalogEntry = lookupTransactionErrorCatalog(error);
  const category = catalogEntry.category;
  const baseEntry = TRANSACTION_ERROR_CATALOG[category];
  return {
    category,
    message: baseEntry.body,
    retryable: baseEntry.retryable,
    diagnostic: catalogEntry.diagnostic,
  };
}
