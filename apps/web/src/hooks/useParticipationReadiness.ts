"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@/context/WalletProvider";
import { useNetworkGuard } from "@/hooks/useNetworkGuard";
import { useOperationLifecycle } from "@/hooks/useOperationLifecycle";
import { createNftClient, createReadOnlyNftClient } from "@/lib/contracts";
import type { Option } from "@stellar/stellar-sdk/contract";
import type { TransactionLifecycleStage } from "@/lib/transactionLifecycle";

const DEFAULT_MEMBERSHIP_TOKEN_URI = "ipfs://stolla/membership.json";

export type ReadinessReadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; balance: number; delegate: Option<string>; votes: bigint }
  | { status: "error"; message: string };

export type ReadinessStatus =
  | "disconnected"
  | "wrong_network"
  | "loading"
  | "read_error"
  | "non_member"
  | "undelegated"
  | "zero_power"
  | "ready";

export type ParticipationReadiness = {
  status: ReadinessStatus;
  /** Human-readable summary of the current readiness state. */
  summary: string;
  /** Whether a wallet transaction action is currently in flight. */
  isActionInFlight: boolean;
  /** Error from the most recent wallet/transaction action, if any. */
  actionError: string | null;
  /** Contract read error, if status is "read_error". */
  readError: string | null;
  /** Balance when known, otherwise null. */
  balance: number | null;
  /** Voting power when known, otherwise null. */
  votes: bigint | null;
  /** True when the connected account has delegated to itself. */
  isSelfDelegated: boolean;
  /** Current mint transaction lifecycle stage. */
  mintStage: TransactionLifecycleStage;
  /** Current delegate transaction lifecycle stage. */
  delegateStage: TransactionLifecycleStage;
  /** Connect the wallet. Only defined when disconnected. */
  connect?: () => Promise<void>;
  /** Refresh on-chain data. */
  refresh: () => void;
  /** Mint a membership NFT to the connected account. */
  mint: (tokenUri?: string) => Promise<void>;
  /** Delegate voting power to the connected account. */
  delegate: () => Promise<void>;
};

/**
 * Loads the participation readiness state for a single Community.
 *
 * Reads wallet connection, network match, NFT balance, delegation, and voting
 * power from the Community's NFT contract. Exposes mint/delegate actions that
 * refresh the affected rows on success.
 */
export function useParticipationReadiness(
  nftContractId: string,
): ParticipationReadiness {
  const wallet = useWallet();
  const network = useNetworkGuard();
  const mintLifecycle = useOperationLifecycle();
  const delegateLifecycle = useOperationLifecycle();

  const [readState, setReadState] = useState<ReadinessReadState>({
    status: "idle",
  });
  const [refreshNonce, setRefreshNonce] = useState(0);

  const refresh = useCallback(() => {
    setRefreshNonce((n) => n + 1);
  }, []);

  const canRead =
    Boolean(wallet.address) && network.status === "match" && nftContractId;

  useEffect(() => {
    if (!canRead) {
      return;
    }

    let active = true;

    const run = async () => {
      setReadState({ status: "loading" });
      const client = createReadOnlyNftClient(nftContractId);

      try {
        const [balanceTx, delegateTx, votesTx] = await Promise.all([
          client.balance({ account: wallet.address! }),
          client.get_delegate({ account: wallet.address! }),
          client.get_votes({ account: wallet.address! }),
        ]);
        if (!active) return;
        setReadState({
          status: "ready",
          balance: Number(balanceTx.result ?? 0),
          delegate: delegateTx.result,
          votes: BigInt(votesTx.result ?? 0),
        });
      } catch (error: unknown) {
        if (!active) return;
        setReadState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Could not load participation data.",
        });
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [canRead, nftContractId, wallet.address, refreshNonce]);

  const mint = useCallback(
    async (tokenUri?: string) => {
      if (!wallet.address || !wallet.signTransaction) return;

      const result = await mintLifecycle.execute(async () => {
        const client = createNftClient({
          publicKey: wallet.address!,
          signTransaction: wallet.signTransaction,
          contractId: nftContractId,
        });
        return client.mint({
          to: wallet.address!,
          token_uri: tokenUri ?? DEFAULT_MEMBERSHIP_TOKEN_URI,
        });
      });

      if (result.ok) {
        refresh();
      }
    },
    [wallet.address, wallet.signTransaction, nftContractId, mintLifecycle, refresh],
  );

  const delegate = useCallback(async () => {
    if (!wallet.address || !wallet.signTransaction) return;

    const result = await delegateLifecycle.execute(async () => {
      const client = createNftClient({
        publicKey: wallet.address!,
        signTransaction: wallet.signTransaction,
        contractId: nftContractId,
      });
      return client.delegate({
        account: wallet.address!,
        delegatee: wallet.address!,
      });
    });

    if (result.ok) {
      refresh();
    }
  }, [
    wallet.address,
    wallet.signTransaction,
    nftContractId,
    delegateLifecycle,
    refresh,
  ]);

  const isActionInFlight =
    mintLifecycle.isInFlight || delegateLifecycle.isInFlight;
  const actionError = mintLifecycle.error ?? delegateLifecycle.error;

  const base = {
    isActionInFlight,
    actionError,
    mintStage: mintLifecycle.stage,
    delegateStage: delegateLifecycle.stage,
    refresh,
    mint,
    delegate,
  };

  if (!wallet.address) {
    return {
      ...base,
      status: "disconnected" as const,
      summary: "Connect your wallet to check voting readiness.",
      readError: null,
      balance: null,
      votes: null,
      isSelfDelegated: false,
      connect: wallet.connect,
    };
  }

  if (network.status !== "match") {
    return {
      ...base,
      status: "wrong_network" as const,
      summary: `Switch your wallet to ${network.expected.label} to continue.`,
      readError: null,
      balance: null,
      votes: null,
      isSelfDelegated: false,
    };
  }

  if (readState.status === "loading") {
    return {
      ...base,
      status: "loading" as const,
      summary: "Loading participation data…",
      readError: null,
      balance: null,
      votes: null,
      isSelfDelegated: false,
    };
  }

  if (readState.status === "error") {
    return {
      ...base,
      status: "read_error" as const,
      summary: readState.message,
      readError: readState.message,
      balance: null,
      votes: null,
      isSelfDelegated: false,
    };
  }

  if (readState.status === "idle") {
    return {
      ...base,
      status: "disconnected" as const,
      summary: "Connect your wallet to check voting readiness.",
      readError: null,
      balance: null,
      votes: null,
      isSelfDelegated: false,
      connect: wallet.connect,
    };
  }

  const isSelfDelegated = readState.delegate === wallet.address;

  if (readState.balance === 0) {
    return {
      ...base,
      status: "non_member" as const,
      summary: "You need a membership NFT to vote in this community.",
      readError: null,
      balance: 0,
      votes: readState.votes,
      isSelfDelegated: false,
    };
  }

  if (!isSelfDelegated) {
    return {
      ...base,
      status: "undelegated" as const,
      summary: "Delegate voting power to yourself to activate it.",
      readError: null,
      balance: readState.balance,
      votes: readState.votes,
      isSelfDelegated: false,
    };
  }

  if (readState.votes === BigInt(0)) {
    return {
      ...base,
      status: "zero_power" as const,
      summary:
        "Your voting power is currently zero. It becomes active after delegation is recorded on-chain.",
      readError: null,
      balance: readState.balance,
      votes: BigInt(0),
      isSelfDelegated: true,
    };
  }

  return {
    ...base,
    status: "ready" as const,
    summary:
      "Wallet, network, membership, delegation, and voting power are ready.",
    readError: null,
    balance: readState.balance,
    votes: readState.votes,
    isSelfDelegated: true,
  };
}
