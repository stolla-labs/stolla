import { describe, expect, it } from "vitest";
import {
  lookupTransactionErrorCatalog,
  mapTransactionError,
  TRANSACTION_ERROR_CATALOG,
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
    expect(mapped.code).toBe("unknown");
    expect(mapped.message).toMatch(/try again/i);
    expect(mapped.diagnostic).toBeNull();
    expect(JSON.stringify(mapped)).not.toContain("do-not-leak");
    expect(JSON.stringify(mapped)).not.toContain("AAAA");
  });

  it("maps specific Soroban simulation and contract codes to plain-language catalog entries (#401)", () => {
    expect(TRANSACTION_ERROR_CATALOG_CODES.length).toBeGreaterThanOrEqual(16);
    for (const code of TRANSACTION_ERROR_CATALOG_CODES) {
      const entry = TRANSACTION_ERROR_CATALOG[code];
      expect(entry.code).toBe(code);
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.body.length).toBeGreaterThan(0);
      expect(entry.cta.length).toBeGreaterThan(0);
    }

    const votingPower = mapTransactionError(
      new Error("HostError: Error(Contract, #5012) InsufficientVotingPower"),
    );
    expect(votingPower.code).toBe("insufficient_voting_power");
    expect(votingPower.category).toBe("contract_error");
    expect(votingPower.title).toBe("Insufficient voting power");
    expect(votingPower.cta).toMatch(/delegate/i);

    const alreadyVoted = lookupTransactionErrorCatalog(
      new Error("HostError: Error(Contract, #5016) AlreadyVoted"),
    );
    expect(alreadyVoted.code).toBe("already_voted");
    expect(alreadyVoted.title).toBe("Vote already recorded");

    const inactive = mapTransactionError(
      new Error("HostError: Error(Contract, #5014) ProposalNotActive"),
    );
    expect(inactive.code).toBe("proposal_not_active");
    expect(inactive.category).toBe("contract_error");

    const cooldown = mapTransactionError(
      new Error("HostError: Error(Contract, #5018) ProposeCooldown"),
    );
    expect(cooldown.code).toBe("propose_cooldown");
    expect(cooldown.category).toBe("contract_error");

    const unauthorized = mapTransactionError(
      new Error("HostError: Error(Contract, #2000) OwnableUnauthorizedAccount"),
    );
    expect(unauthorized.code).toBe("unauthorized_owner");
    expect(unauthorized.category).toBe("contract_error");

    const restore = mapTransactionError(
      new Error("Restore preamble required for archived footprint entry"),
    );
    expect(restore.code).toBe("storage_footprint_restore");
    expect(restore.category).toBe("simulation_failed");

    const resourceLimit = mapTransactionError(
      new Error("Host budget exceeded: resource limit CPU instructions"),
    );
    expect(resourceLimit.code).toBe("resource_limit_exceeded");
    expect(resourceLimit.category).toBe("simulation_failed");
  });
});
