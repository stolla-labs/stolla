"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mapTransactionError } from "@/lib/transactionErrors";

/**
 * Transaction lifecycle stages for vote submission.
 */
export type TransactionStage =
  | "idle"
  | "simulating"
  | "wallet_approval"
  | "submitting"
  | "confirming"
  | "confirmed"
  | "wallet_rejected"
  | "simulation_failed"
  | "submission_failed"
  | "duplicate_vote";

export type TransactionLifecycleState = {
  stage: TransactionStage;
  /** The vote type the user selected (1=For, 0=Against, 2=Abstain) */
  voteType: number | null;
  /** The reason text the user entered */
  reason: string;
  /** Error message if the transaction failed */
  error: string | null;
  /** Whether the transaction is terminal (confirmed or permanently failed) */
  isTerminal: boolean;
};

const PENDING_STAGES: TransactionStage[] = [
  "simulating",
  "wallet_approval",
  "submitting",
  "confirming",
];

export function isVoteLifecyclePending(stage: TransactionStage): boolean {
  return PENDING_STAGES.includes(stage);
}

export type VoteTransactionFn = () => Promise<void>;

type UseTransactionLifecycleOptions = {
  /** Called when the transaction completes successfully */
  onConfirmed?: () => void | Promise<void>;
};

/**
 * Manages the full lifecycle of a vote transaction.
 *
 * Tracks stages from simulation through wallet approval, submission,
 * and confirmation. Handles wallet rejections, RPC failures, and
 * duplicate vote errors as distinct terminal states.
 */
export function useTransactionLifecycle(options?: UseTransactionLifecycleOptions) {
  const [state, setState] = useState<TransactionLifecycleState>({
    stage: "idle",
    voteType: null,
    reason: "",
    error: null,
    isTerminal: false,
  });
  const inFlightRef = useRef(false);
  const onConfirmedRef = useRef(options?.onConfirmed);

  useEffect(() => {
    onConfirmedRef.current = options?.onConfirmed;
  }, [options?.onConfirmed]);

  const reset = useCallback(() => {
    if (inFlightRef.current) return;
    setState({
      stage: "idle",
      voteType: null,
      reason: "",
      error: null,
      isTerminal: false,
    });
  }, []);

  const execute = useCallback(
    async (voteType: number, reason: string, fn: VoteTransactionFn) => {
      if (inFlightRef.current) {
        return { started: false as const };
      }
      inFlightRef.current = true;

      setState({
        stage: "simulating",
        voteType,
        reason,
        error: null,
        isTerminal: false,
      });

      try {
        // Stage: Wallet approval + submission + confirmation
        // signAndSend() handles wallet approval, network submission,
        // and waiting for ledger confirmation
        setState((prev) => ({
          ...prev,
          stage: "wallet_approval",
        }));

        await fn();

        setState((prev) => ({
          ...prev,
          stage: "confirmed",
          isTerminal: true,
        }));

        await onConfirmedRef.current?.();
        return { started: true as const };
      } catch (error: unknown) {
        const mapped = mapTransactionError(error);

        if (mapped.category === "wallet_rejected") {
          setState((prev) => ({
            ...prev,
            stage: "wallet_rejected",
            error: mapped.message,
            isTerminal: true,
          }));
          return { started: true as const };
        }

        if (
          mapped.diagnostic?.includes("AlreadyVoted") ||
          mapped.diagnostic?.includes("already voted") ||
          mapped.diagnostic?.includes("5016")
        ) {
          setState((prev) => ({
            ...prev,
            stage: "duplicate_vote",
            error: "You have already voted on this proposal.",
            isTerminal: true,
          }));
          return { started: true as const };
        }

        if (mapped.category === "simulation_failed") {
          setState((prev) => ({
            ...prev,
            stage: "simulation_failed",
            error: mapped.message,
            isTerminal: true,
          }));
          return { started: true as const };
        }

        setState((prev) => ({
          ...prev,
          stage: "submission_failed",
          error: mapped.message,
          isTerminal: true,
        }));
        return { started: true as const };
      } finally {
        inFlightRef.current = false;
      }
    },
    [],
  );

  return {
    state,
    execute,
    reset,
    isInFlight: isVoteLifecyclePending(state.stage),
  };
}
