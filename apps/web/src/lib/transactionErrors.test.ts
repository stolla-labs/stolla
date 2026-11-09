import { describe, expect, it } from "vitest";
import {
  lookupTransactionErrorCatalog,
  mapTransactionError,
  TRANSACTION_ERROR_CATALOG_CODES,
  TRANSACTION_ERROR_CATEGORIES,
} from "@/lib/transactionErrors";

describe("mapTransactionError", () => {
  it("exposes a finite category set", () => {
    expect(TRANSACTION_ERROR_CATEGORIES).toEqual([
      "wallet_rejected",
      "wallet_unavailable",
      "simulation_failed",
      "rpc_unavailable",
      "send_failed",
      "confirmation_timeout",
      "still_pending",
      "contract_error",
      "unknown",
    ]);
  });

  it.each([
    [
      "wallet_rejected",
      new Error("User rejected the request"),
      "You rejected the wallet request",
    ],
    [
      "wallet_unavailable",
      new Error("Freighter is not installed"),
      "No wallet is available",
    ],
    [
      "simulation_failed",
      new Error("Simulation failed: insufficient resources"),
      "could not be simulated",
    ],
    [
      "rpc_unavailable",
      new Error("Failed to fetch"),
      "temporarily unreachable",
    ],
    [
      "send_failed",
      new Error("SendTransaction failed with status ERROR"),
      "could not be submitted",
    ],
    [
      "confirmation_timeout",
      new Error("Confirmation timeout after 30s"),
      "Confirmation timed out",
    ],
    [
      "still_pending",
      new Error("TransactionStillPending: Waited 30 seconds"),
      "still pending on the network",
    ],
    [
      "contract_error",
      new Error("HostError: Error(Contract, #5016) AlreadyVoted"),
      "contract rejected",
    ],
    [
      "unknown",
      new Error("weird opaque blob"),
      "Something went wrong",
    ],
  ] as const)(
    "maps %s to stable user-facing copy",
    (category, error, messagePart) => {
      const mapped = mapTransactionError(error);
      expect(mapped.category).toBe(category);
      expect(mapped.message).toMatch(new RegExp(messagePart, "i"));
      expect(mapped.diagnostic).toBe(error.message);
      expect(mapped.message).not.toContain("XDR");
      expect(mapped.message).not.toContain(error.message);
    },
  );

  it("does not describe wallet rejection as RPC or contract failure", () => {
    const mapped = mapTransactionError(
      new Error("User declined to sign the transaction"),
    );
    expect(mapped.category).toBe("wallet_rejected");
    expect(mapped.message.toLowerCase()).not.toContain("rpc");
    expect(mapped.message.toLowerCase()).not.toContain("contract");
    expect(mapped.message.toLowerCase()).not.toContain("network");
  });

  it("does not describe a still-pending transaction as failed", () => {
    const mapped = mapTransactionError(
      new Error("Waited 20 seconds for transaction to complete, but it is still pending"),
    );
    expect(mapped.category).toBe("still_pending");
    expect(mapped.message.toLowerCase()).toContain("pending");
    expect(mapped.message.toLowerCase()).not.toMatch(/\bfailed\b/);
    expect(mapped.retryable).toBe(false);
  });

  it("uses a safe fallback for non-error values", () => {
    const mapped = mapTransactionError({ secret: "do-not-leak", xdr: "AAAA" });
    expect(mapped.category).toBe("unknown");
    expect(mapped.message).toMatch(/try again/i);
    expect(mapped.diagnostic).toBeNull();
    expect(JSON.stringify(mapped)).not.toContain("do-not-leak");
    expect(JSON.stringify(mapped)).not.toContain("AAAA");
  });
});

describe("lookupTransactionErrorCatalog", () => {
  it("exposes title, body, CTA, and collapsible diagnostic for unknown errors without leaking raw strings into body", () => {
    const entry = lookupTransactionErrorCatalog(
      new Error("raw-soroban-xdr-blob-AAAA0001"),
      "deploy",
    );
    expect(TRANSACTION_ERROR_CATALOG_CODES).toContain(entry.code);
    expect(entry.code).toBe("unknown");
    expect(entry.title).toBe("Unexpected transaction error");
    expect(entry.body).not.toContain("raw-soroban-xdr-blob-AAAA0001");
    expect(entry.cta).toBe("Try again");
    expect(entry.diagnostic).toBe("raw-soroban-xdr-blob-AAAA0001");
  });

  it("keeps pin and configuration errors distinct from wallet rejection", () => {
    const configErr = Object.assign(
      new Error("PINATA_JWT is not configured on the server"),
      { name: "IpfsPinError", kind: "config" },
    );
    const pinErr = Object.assign(
      new Error("Upstream IPFS gateway 502 during /api/ipfs/pin"),
      { name: "IpfsPinError", kind: "upstream" },
    );
    const walletReject = new Error("User declined the signing request");

    const mappedConfig = lookupTransactionErrorCatalog(configErr, "pin");
    const mappedPin = lookupTransactionErrorCatalog(pinErr, "pin");
    const mappedWallet = lookupTransactionErrorCatalog(walletReject, "mint");

    expect(mappedConfig.code).toBe("config_missing");
    expect(mappedConfig.retryable).toBe(false);
    expect(mappedPin.code).toBe("pin_failed");
    expect(mappedPin.retryable).toBe(true);
    expect(mappedWallet.code).toBe("wallet_rejected");

    expect(mappedConfig.code).not.toBe(mappedWallet.code);
    expect(mappedPin.code).not.toBe(mappedWallet.code);
  });

  it("maps propose threshold, duplicate vote, and unauthorized errors across flows", () => {
    const threshold = lookupTransactionErrorCatalog(
      new Error("HostError: InsufficientVotingPower for ProposalThreshold"),
      "propose",
    );
    expect(threshold.code).toBe("insufficient_voting_power");
    expect(threshold.body).toMatch(/delegated voting power/i);

    const duplicateVote = lookupTransactionErrorCatalog(
      new Error("HostError: Error(Contract, #5016) AlreadyVoted"),
      "vote",
    );
    expect(duplicateVote.code).toBe("duplicate_vote");
    expect(duplicateVote.body).toBe("You have already voted on this proposal.");

    const unauthorized = lookupTransactionErrorCatalog(
      new Error("Unauthorized: caller is not owner"),
      "deploy",
    );
    expect(unauthorized.code).toBe("unauthorized");
    expect(unauthorized.retryable).toBe(false);
  });
});
