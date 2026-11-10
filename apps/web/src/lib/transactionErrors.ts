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
  "wallet_rejected",
  "wallet_unavailable",
  "insufficient_voting_power",
  "already_voted",
  "proposal_not_active",
  "propose_cooldown",
  "unauthorized_owner",
  "storage_footprint_restore",
  "resource_limit_exceeded",
  "simulation_failed",
  "rpc_unavailable",
  "send_failed",
  "confirmation_timeout",
  "still_pending",
  "contract_error",
  "unknown",
] as const;

export type TransactionErrorCatalogCode =
  (typeof TRANSACTION_ERROR_CATALOG_CODES)[number];

export type TransactionErrorCatalogEntry = {
  code: TransactionErrorCatalogCode;
  category: TransactionErrorCategory;
  title: string;
  body: string;
  cta: string;
  retryable: boolean;
};

export type MappedTransactionError = {
  category: TransactionErrorCategory;
  /** Specific catalog code for support and targeted UI recovery. */
  code: TransactionErrorCatalogCode;
  /** Short plain-language heading. */
  title: string;
  /** Detailed user-facing explanation. */
  body: string;
  /** Suggested next step or call to action. */
  cta: string;
  /** Concise user-facing message. */
  message: string;
  /** Whether the user should retry the same action. */
  retryable: boolean;
  /** Technical detail for diagnostics (never render directly). */
  diagnostic: string | null;
};

export const TRANSACTION_ERROR_CATALOG: Record<
  TransactionErrorCatalogCode,
  TransactionErrorCatalogEntry
> = {
  wallet_rejected: {
    code: "wallet_rejected",
    category: "wallet_rejected",
    title: "Wallet request declined",
    body: "You rejected the wallet request. Approve the next prompt to continue.",
    cta: "Retry and approve in wallet",
    retryable: true,
  },
  wallet_unavailable: {
    code: "wallet_unavailable",
    category: "wallet_unavailable",
    title: "Wallet not connected",
    body: "No wallet is available. Connect or unlock your Stellar wallet, then try again.",
    cta: "Connect or unlock wallet",
    retryable: true,
  },
  insufficient_voting_power: {
    code: "insufficient_voting_power",
    category: "contract_error",
    title: "Insufficient voting power",
    body: "The contract rejected this operation because your delegated voting power is below the required threshold.",
    cta: "Mint or self-delegate membership NFTs before retrying",
    retryable: false,
  },
  already_voted: {
    code: "already_voted",
    category: "contract_error",
    title: "Vote already recorded",
    body: "The contract rejected this operation because this wallet has already cast a vote on this proposal.",
    cta: "Review your recorded vote on the proposal page",
    retryable: false,
  },
  proposal_not_active: {
    code: "proposal_not_active",
    category: "contract_error",
    title: "Proposal voting window is not active",
    body: "The contract rejected this operation because the proposal is not currently open for voting.",
    cta: "Check the proposal state and ledger window",
    retryable: false,
  },
  propose_cooldown: {
    code: "propose_cooldown",
    category: "contract_error",
    title: "Proposal cooldown active",
    body: "The contract rejected this operation because a recent proposal from this account is still within the cooldown window.",
    cta: "Wait for the cooldown window to elapse before proposing again",
    retryable: false,
  },
  unauthorized_owner: {
    code: "unauthorized_owner",
    category: "contract_error",
    title: "Owner permission required",
    body: "The contract rejected this operation because only the community owner account is authorized to perform it.",
    cta: "Switch to the community owner wallet",
    retryable: false,
  },
  storage_footprint_restore: {
    code: "storage_footprint_restore",
    category: "simulation_failed",
    title: "Contract state requires restoration",
    body: "The transaction could not be simulated because required Soroban storage entries have expired and must be restored first.",
    cta: "Restore archived contract storage and retry",
    retryable: true,
  },
  resource_limit_exceeded: {
    code: "resource_limit_exceeded",
    category: "simulation_failed",
    title: "Simulation resource limit exceeded",
    body: "The transaction could not be simulated within the network resource or fee limits. Check your inputs and account state, then retry.",
    cta: "Reduce batch size or check XLM fee balance",
    retryable: true,
  },
  simulation_failed: {
    code: "simulation_failed",
    category: "simulation_failed",
    title: "Transaction simulation failed",
    body: "The transaction could not be simulated. Check your inputs and account state, then retry.",
    cta: "Verify inputs and retry",
    retryable: true,
  },
  rpc_unavailable: {
    code: "rpc_unavailable",
    category: "rpc_unavailable",
    title: "Stellar RPC unreachable",
    body: "The Stellar network is temporarily unreachable. Wait a moment and try again.",
    cta: "Wait a moment and retry",
    retryable: true,
  },
  send_failed: {
    code: "send_failed",
    category: "send_failed",
    title: "Transaction submission failed",
    body: "The transaction could not be submitted. Check your connection and retry.",
    cta: "Retry submission",
    retryable: true,
  },
  confirmation_timeout: {
    code: "confirmation_timeout",
    category: "confirmation_timeout",
    title: "Confirmation timed out",
    body: "Confirmation timed out. The transaction may still be pending—check an explorer before retrying.",
    cta: "Check Stellar explorer before retrying",
    retryable: false,
  },
  still_pending: {
    code: "still_pending",
    category: "still_pending",
    title: "Transaction still pending",
    body: "The transaction is still pending on the network. Check your wallet or explorer before submitting again.",
    cta: "View transaction status in explorer",
    retryable: false,
  },
  contract_error: {
    code: "contract_error",
    category: "contract_error",
    title: "Contract rejected operation",
    body: "The contract rejected this operation. Review the requirements and try a different action.",
    cta: "Review community governance requirements",
    retryable: false,
  },
  unknown: {
    code: "unknown",
    category: "unknown",
    title: "Unexpected transaction error",
    body: "Something went wrong while processing the transaction. Please try again.",
    cta: "Try again",
    retryable: true,
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
    return `${error.name} ${error.message}`.toLowerCase();
  }
  if (typeof error === "string") return error.toLowerCase();
  return "";
}

function classifyCatalogCode(error: unknown): TransactionErrorCatalogCode {
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
    text.includes("restore") &&
    (text.includes("footprint") ||
      text.includes("archived") ||
      text.includes("expired") ||
      text.includes("preamble"))
  ) {
    return "storage_footprint_restore";
  }

  if (
    text.includes("resource limit") ||
    text.includes("cpu instructions") ||
    text.includes("txinsufficientfee") ||
    text.includes("insufficient fee")
  ) {
    return "resource_limit_exceeded";
  }

  if (text.includes("simulation") || text.includes("simulate")) {
    return "simulation_failed";
  }

  if (
    text.includes("alreadyvoted") ||
    text.includes("already voted") ||
    text.includes("#5016") ||
    text.includes("error 5016")
  ) {
    return "already_voted";
  }

  if (
    text.includes("insufficient voting power") ||
    text.includes("insufficientvotes") ||
    text.includes("proposalthreshold") ||
    text.includes("below proposal threshold") ||
    text.includes("#5012") ||
    text.includes("error 5012")
  ) {
    return "insufficient_voting_power";
  }

  if (
    text.includes("proposalnotactive") ||
    text.includes("proposal not active") ||
    text.includes("voting closed") ||
    text.includes("#5014") ||
    text.includes("error 5014")
  ) {
    return "proposal_not_active";
  }

  if (
    text.includes("proposecooldown") ||
    text.includes("propose cooldown") ||
    text.includes("cooldown active") ||
    text.includes("#5018") ||
    text.includes("error 5018")
  ) {
    return "propose_cooldown";
  }

  if (
    text.includes("ownableunauthorizedaccount") ||
    text.includes("unauthorized owner") ||
    text.includes("caller is not the owner") ||
    text.includes("#2000") ||
    text.includes("error 2000")
  ) {
    return "unauthorized_owner";
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
 * Look up the plain-language catalog entry for an unknown error.
 */
export function lookupTransactionErrorCatalog(
  error: unknown,
): TransactionErrorCatalogEntry {
  const code = classifyCatalogCode(error);
  return TRANSACTION_ERROR_CATALOG[code];
}

/**
 * Map an unknown transaction failure into a safe, actionable user message.
 */
export function mapTransactionError(error: unknown): MappedTransactionError {
  const entry = lookupTransactionErrorCatalog(error);
  return {
    category: entry.category,
    code: entry.code,
    title: entry.title,
    body: entry.body,
    cta: entry.cta,
    message: entry.body,
    retryable: entry.retryable,
    diagnostic: asDiagnostic(error),
  };
}
