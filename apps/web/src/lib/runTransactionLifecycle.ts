import {
  isCancellableProposalState,
  isPendingTransactionLifecycleStage,
  type TransactionLifecycleStage,
} from "@/lib/transactionLifecycle";
import { mapTransactionError } from "@/lib/transactionErrors";

export type LifecycleAssembledTransaction = {
  sign?: () => Promise<unknown>;
  send?: () => Promise<unknown>;
  signAndSend?: () => Promise<unknown>;
};

export type RunTransactionLifecycleOptions = {
  assemble: () => Promise<LifecycleAssembledTransaction>;
  onStage: (stage: TransactionLifecycleStage) => void;
  /** Optional guard invoked before assembling; return false to abort silently. */
  canRun?: () => boolean;
};

export type TransactionLifecycleOutcome =
  | { ok: true; transactionHash: string | null; result: unknown }
  | {
      ok: false;
      kind: "wallet_rejected" | "send_failed" | "still_pending" | "simulation_failed";
      message: string;
      transactionHash?: string | null;
    };

function extractResult(value: unknown): unknown {
  if (!value || typeof value !== "object") return undefined;
  if ("result" in value) return (value as { result?: unknown }).result;
  return undefined;
}

function extractTransactionHash(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.hash === "string") return record.hash;
  const sendResponse = record.sendTransactionResponse;
  if (sendResponse && typeof sendResponse === "object") {
    const hash = (sendResponse as { hash?: unknown }).hash;
    if (typeof hash === "string") return hash;
  }
  return null;
}

/**
 * Runs assemble → approve → submit → confirm stage transitions for a signed
 * Soroban transaction, using `sign`/`send` when available.
 */
export async function runTransactionLifecycle({
  assemble,
  onStage,
  canRun,
}: RunTransactionLifecycleOptions): Promise<TransactionLifecycleOutcome> {
  if (canRun && !canRun()) {
    return { ok: false, kind: "send_failed", message: "Action not permitted." };
  }
  try {
    onStage("simulating");
    const tx = await assemble();

    onStage("awaiting_approval");

    let sent: unknown;
    if (typeof tx.sign === "function" && typeof tx.send === "function") {
      await tx.sign();
      onStage("submitting");
      onStage("confirming");
      sent = await tx.send();
    } else if (typeof tx.signAndSend === "function") {
      const pending = tx.signAndSend();
      onStage("submitting");
      onStage("confirming");
      sent = await pending;
    } else {
      throw new Error("Transaction cannot be signed or sent.");
    }

    onStage("success");
    return {
      ok: true,
      transactionHash: extractTransactionHash(sent),
      result: extractResult(sent),
    };
  } catch (error: unknown) {
    const mapped = mapTransactionError(error);
    onStage("failure");

    if (mapped.category === "wallet_rejected") {
      return {
        ok: false,
        kind: "wallet_rejected",
        message: mapped.message,
      };
    }

    if (mapped.category === "still_pending" || mapped.category === "confirmation_timeout") {
      return {
        ok: false,
        kind: "still_pending",
        message: mapped.message,
      };
    }

    if (mapped.category === "simulation_failed") {
      return {
        ok: false,
        kind: "simulation_failed",
        message: mapped.message,
      };
    }

    return {
      ok: false,
      kind: "send_failed",
      message: mapped.message,
    };
  }
}

export function isLifecycleInFlight(
  stage: TransactionLifecycleStage,
): boolean {
  return isPendingTransactionLifecycleStage(stage);
}

/**
 * Returns true when the given proposal state permits a cancel action from the
 * proposal detail UI. Mirrors Governor `cancel` semantics for the signaling
 * model (Pending / Active proposals only).
 */
export function canCancelProposal(state: string | null | undefined): boolean {
  return isCancellableProposalState(state);
}
