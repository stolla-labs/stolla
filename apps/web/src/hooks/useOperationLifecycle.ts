"use client";

import { useCallback, useRef, useState } from "react";
import {
  isPendingTransactionLifecycleStage,
  type TransactionLifecycleStage,
} from "@/lib/transactionLifecycle";
import {
  runTransactionLifecycle,
  type LifecycleAssembledTransaction,
} from "@/lib/runTransactionLifecycle";

export type OperationOutcomeKind =
  | "wallet_rejected"
  | "send_failed"
  | "still_pending"
  | "simulation_failed";

/**
 * Shared operation lifecycle for non-vote flows (delegation, mint, propose, cancel, execute).
 */
export function useOperationLifecycle() {
  const [stage, setStage] = useState<TransactionLifecycleStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [outcomeKind, setOutcomeKind] = useState<OperationOutcomeKind | null>(
    null,
  );
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const reset = useCallback(() => {
    inFlightRef.current = false;
    setStage("idle");
    setError(null);
    setOutcomeKind(null);
    setTransactionHash(null);
  }, []);

  const execute = useCallback(
    async (assemble: () => Promise<LifecycleAssembledTransaction>) => {
      if (inFlightRef.current) {
        return {
          ok: false as const,
          kind: "send_failed" as const,
          message: "Another transaction is already in progress.",
        };
      }

      inFlightRef.current = true;
      setError(null);
      setOutcomeKind(null);
      setTransactionHash(null);

      try {
        const result = await runTransactionLifecycle({
          assemble,
          onStage: (next) => {
            setStage(next);
            if (!isPendingTransactionLifecycleStage(next)) {
              inFlightRef.current = false;
            }
          },
        });

        if (!result.ok) {
          setOutcomeKind(result.kind);
          setError(result.message);
          setTransactionHash(result.transactionHash ?? null);
        } else {
          setOutcomeKind(null);
          setError(null);
          setTransactionHash(result.transactionHash);
        }

        return result;
      } finally {
        inFlightRef.current = false;
      }
    },
    [],
  );

  return {
    stage,
    error,
    outcomeKind,
    transactionHash,
    isInFlight: isPendingTransactionLifecycleStage(stage),
    execute,
    reset,
  };
}
