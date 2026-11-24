"use client";

import { useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { AppLinkButton } from "@/components/ui/AppLinkButton";
import { LiveStatus } from "@/components/ui/LiveStatus";
import {
  buildStellarExplorerTxUrl,
  resolveStellarNetworkId,
  type StellarNetworkId,
} from "@/lib/stellarExplorer";
import {
  buildProposalShareText,
  buildWarpcastIntentUrl,
  buildXIntentUrl,
} from "@/lib/shareIntent";
import { truncateMiddle } from "@/lib/truncate";

const VOTE_TYPE_LABELS: Record<number, string> = {
  0: "Against",
  1: "For",
  2: "Abstain",
};

export type VoteReceiptProps = {
  proposalIdHex: string;
  voteType: number;
  /** Omitted for the global Governor, where there is no separate community label. */
  communityName?: string | null;
  /** Null when the confirmed submission response did not carry a hash. */
  transactionHash: string | null;
  network?: StellarNetworkId;
};

function buildReceiptSummary({
  proposalIdHex,
  voteType,
  communityName,
  transactionHash,
  network = resolveStellarNetworkId(),
}: VoteReceiptProps): string {
  const lines = [
    `Proposal: ${proposalIdHex}`,
    `Vote: ${VOTE_TYPE_LABELS[voteType] ?? "Unknown"}`,
  ];
  if (communityName) lines.push(`Community: ${communityName}`);
  lines.push(`Network: ${network}`);
  lines.push(transactionHash ? `Transaction: ${transactionHash}` : "Transaction hash: unavailable");
  const explorerUrl = buildStellarExplorerTxUrl(transactionHash, network);
  if (explorerUrl) lines.push(explorerUrl);
  return lines.join("\n");
}

/**
 * Shown once a vote is confirmed, so a member can prove or share that they
 * voted rather than only seeing a transient status line. Renders even when
 * the transaction hash is missing (the explorer link is simply omitted),
 * since the vote itself is still confirmed on-chain.
 */
export function VoteReceipt(props: VoteReceiptProps) {
  const { proposalIdHex, voteType, communityName, transactionHash } = props;
  const network = props.network ?? resolveStellarNetworkId();
  const [status, setStatus] = useState("");
  const explorerUrl = buildStellarExplorerTxUrl(transactionHash, network);
  const voteLabel = VOTE_TYPE_LABELS[voteType] ?? "Unknown";
  async function handleCopy() {
    if (typeof navigator.clipboard?.writeText !== "function") {
      setStatus("Clipboard is not available in this browser.");
      return;
    }
    try {
      await navigator.clipboard.writeText(buildReceiptSummary(props));
      setStatus("Receipt copied.");
    } catch {
      setStatus("Could not copy the receipt.");
    }
  }

  async function handleShare() {
    if (typeof navigator.share !== "function") {
      await handleCopy();
      return;
    }
    try {
      await navigator.share({
        title: "Stolla vote receipt",
        text: buildReceiptSummary(props),
      });
      setStatus("Receipt shared.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setStatus("Could not share the receipt. Try copying it instead.");
    }
  }

  return (
    <section
      aria-label="Vote receipt"
      className="mt-4 rounded-xl border border-emerald-800/60 bg-emerald-950/30 p-5"
    >
      <h2 className="font-semibold text-emerald-100">Vote recorded</h2>
      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-400">Proposal</dt>
          <dd
            className="break-all font-mono text-xs text-slate-200"
            title={proposalIdHex}
          >
            {truncateMiddle(proposalIdHex, 10, 8)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-400">Your vote</dt>
          <dd className="font-medium text-slate-200">{voteLabel}</dd>
        </div>
        {communityName && (
          <div className="flex justify-between gap-3">
            <dt className="text-slate-400">Community</dt>
            <dd className="text-slate-200">{communityName}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-slate-400">Transaction</dt>
          <dd
            className="break-all font-mono text-xs text-slate-200"
            title={transactionHash ?? undefined}
          >
            {transactionHash ? truncateMiddle(transactionHash, 10, 8) : "Unavailable"}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <AppButton tone="secondary" onClick={() => void handleCopy()}>
          Copy receipt
        </AppButton>
        <AppButton tone="secondary" onClick={() => void handleShare()}>
          Share receipt
        </AppButton>
        <AppLinkButton
          href={buildXIntentUrl(
            buildProposalShareText(communityName),
            window.location.href,
          )}
          target="_blank"
          rel="noopener noreferrer"
          tone="secondary"
        >
          Share on X
        </AppLinkButton>
        <AppLinkButton
          href={buildWarpcastIntentUrl(
            buildProposalShareText(communityName),
            window.location.href,
          )}
          target="_blank"
          rel="noopener noreferrer"
          tone="secondary"
        >
          Share on Warpcast
        </AppLinkButton>
        {explorerUrl && (
          <AppLinkButton
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            tone="secondary"
          >
            Open in explorer
          </AppLinkButton>
        )}
      </div>

      {!transactionHash && (
        <p className="mt-2 text-xs text-amber-300">
          Your vote is confirmed. Transaction hash unavailable.
        </p>
      )}

      <LiveStatus className="mt-2 text-xs text-slate-400">{status}</LiveStatus>
    </section>
  );
}
