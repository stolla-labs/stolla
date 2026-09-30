"use client";

import { useState } from "react";
import { useWallet } from "@/context/WalletProvider";
import { createNftClient } from "@/lib/contracts";
import { contractIds } from "@/lib/stellar";
import { AppButton } from "@/components/ui/AppButton";
import { TransactionLifecycleStatus } from "@/components/TransactionLifecycleStatus";
import { useOperationLifecycle } from "@/hooks/useOperationLifecycle";
import { isPendingTransactionLifecycleStage } from "@/lib/transactionLifecycle";

export type SelfDelegateCalloutProps = {
  balance: number | bigint | null;
  votes: string | number | bigint | null;
  nftContractId?: string;
  onDelegationSuccess?: () => void | Promise<void>;
  onDelegate?: () => void | Promise<void>;
  isDelegating?: boolean;
  className?: string;
};

export function isZeroVotingPower(votes: string | number | bigint | null | undefined): boolean {
  if (votes === null || votes === undefined) return true;
  if (typeof votes === "bigint") return votes === 0n;
  if (typeof votes === "number") return votes === 0;
  const trimmed = votes.trim();
  if (trimmed === "" || trimmed === "0" || trimmed === "—") return true;
  const num = Number(trimmed);
  return !isNaN(num) && num === 0;
}

export function isPositiveBalance(balance: number | bigint | null | undefined): boolean {
  if (balance === null || balance === undefined) return false;
  if (typeof balance === "bigint") return balance > 0n;
  return balance > 0;
}

export function SelfDelegateCallout({
  balance,
  votes,
  nftContractId,
  onDelegationSuccess,
  onDelegate,
  isDelegating,
  className = "",
}: SelfDelegateCalloutProps) {
  const { address, signTransaction } = useWallet();
  const internalLifecycle = useOperationLifecycle();
  const [dismissed, setDismissed] = useState(false);

  // Criteria: CTA appears only when balance > 0 and votes == 0
  const hasBalance = isPositiveBalance(balance);
  const zeroVotes = isZeroVotingPower(votes);
  const shouldDisplay = hasBalance && zeroVotes && !dismissed;

  if (!shouldDisplay) {
    return null;
  }

  const activeNftContract = nftContractId || contractIds.nft;
  const inFlight = isDelegating ?? isPendingTransactionLifecycleStage(internalLifecycle.stage);

  async function handleSelfDelegateClick() {
    if (onDelegate) {
      await onDelegate();
      return;
    }

    if (!address || !activeNftContract) {
      return;
    }

    internalLifecycle.reset();
    const result = await internalLifecycle.execute(async () => {
      const client = createNftClient({
        publicKey: address,
        signTransaction,
        contractId: activeNftContract,
      });
      return client.delegate({
        account: address,
        delegatee: address,
      });
    });

    if (result.ok) {
      if (onDelegationSuccess) {
        await onDelegationSuccess();
      }
    }
  }

  const tokenCountText = balance !== null ? `${balance} ` : "";

  return (
    <section
      role="region"
      aria-label="Self-delegation notice"
      className={`rounded-xl border border-indigo-500/50 bg-indigo-950/40 p-4 text-sm text-indigo-100 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-indigo-200">
            Activate your voting power
          </h3>
          <p className="mt-1 text-xs text-indigo-300/90 leading-relaxed">
            You hold {tokenCountText}membership token{balance && Number(balance) === 1 ? "" : "s"}, but have 0 voting power. You must delegate to yourself before you can create proposals or vote in governance.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded px-2 py-1 text-xs text-indigo-300 transition-colors hover:bg-indigo-900/60 hover:text-white"
          aria-label="Dismiss self-delegation notice"
        >
          Dismiss
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <AppButton
          tone="primary"
          onClick={() => void handleSelfDelegateClick()}
          disabled={!address || inFlight}
          aria-label="Delegate to myself"
        >
          {inFlight ? "Delegating to myself…" : "Delegate to myself"}
        </AppButton>
      </div>

      <TransactionLifecycleStatus
        stage={internalLifecycle.stage}
        operationLabel="Delegate"
        error={internalLifecycle.error}
        metadata={{
          transactionHash: internalLifecycle.transactionHash,
          details: internalLifecycle.outcomeKind
            ? [
                {
                  label: "Outcome",
                  value:
                    internalLifecycle.outcomeKind === "wallet_rejected"
                      ? "Wallet rejected"
                      : internalLifecycle.outcomeKind === "still_pending"
                        ? "Still pending"
                        : internalLifecycle.outcomeKind === "simulation_failed"
                          ? "Simulation failed"
                          : "Send failed",
                },
              ]
            : undefined,
        }}
      />
    </section>
  );
}
