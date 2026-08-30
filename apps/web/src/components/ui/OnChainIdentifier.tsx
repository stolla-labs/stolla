"use client";

import { useEffect, useRef, useState } from "react";
import { truncateMiddle } from "@/lib/truncate";
import {
  buildStellarExplorerAccountUrl,
  buildStellarExplorerContractUrl,
  buildStellarExplorerTxUrl,
  resolveStellarNetworkId,
  type StellarNetworkId,
} from "@/lib/stellarExplorer";
import { LiveStatus } from "@/components/ui/LiveStatus";

export type OnChainIdentifierKind = "contract" | "tx" | "account" | "opaque";

export type OnChainIdentifierProps = {
  /** Human-readable label used in aria-labels and copy/explorer feedback, e.g. "Governor contract". */
  label: string;
  /** Full, untruncated identifier value. */
  value: string;
  /** Which explorer lookup (if any) applies to this value. "opaque" never links out. */
  kind: OnChainIdentifierKind;
  /** Defaults to the app's configured network. */
  network?: StellarNetworkId;
  truncateStart?: number;
  truncateEnd?: number;
  className?: string;
  /** Render only the copy/explorer controls, e.g. when the value is already shown elsewhere. */
  hideValue?: boolean;
};

const EXPLORER_BUILDERS: Record<
  Exclude<OnChainIdentifierKind, "opaque">,
  (value: string, network: StellarNetworkId) => string | null
> = {
  contract: buildStellarExplorerContractUrl,
  tx: buildStellarExplorerTxUrl,
  account: buildStellarExplorerAccountUrl,
};

const COPY_FEEDBACK_MS = 2000;

/**
 * Deterministic display for a wallet address, contract id, transaction hash,
 * or proposal id: truncated text with the full value in `title`, a copy
 * button with keyboard access and a live-region announcement, and an
 * explorer link when the kind/network combination resolves to one.
 */
export function OnChainIdentifier({
  label,
  value,
  kind,
  network,
  truncateStart = 8,
  truncateEnd = 6,
  className,
  hideValue = false,
}: OnChainIdentifierProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const resolvedNetwork = network ?? resolveStellarNetworkId();
  const explorerUrl = kind === "opaque" ? null : EXPLORER_BUILDERS[kind](value, resolvedNetwork);
  const displayValue = truncateMiddle(value, truncateStart, truncateEnd);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus("success");
    } catch {
      setCopyStatus("error");
    }
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopyStatus("idle"), COPY_FEEDBACK_MS);
  };

  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className ?? ""}`}>
      {!hideValue && (
        <span title={value} className="min-w-0 truncate font-mono text-sm text-slate-300">
          {displayValue}
        </span>
      )}
      <button
        type="button"
        onClick={() => void handleCopy()}
        title={`Copy ${label}`}
        aria-label={`Copy ${label}`}
        className="shrink-0 text-xs font-medium text-indigo-300 hover:text-indigo-200"
      >
        Copy
      </button>
      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open ${label} in explorer`}
          aria-label={`Open ${label} in explorer`}
          className="shrink-0 text-xs font-medium text-indigo-300 hover:text-indigo-200"
        >
          Explorer
        </a>
      )}
      <LiveStatus tone={copyStatus === "error" ? "error" : "routine"} className="sr-only">
        {copyStatus === "success"
          ? `${label} copied to clipboard`
          : copyStatus === "error"
            ? `Failed to copy ${label}`
            : ""}
      </LiveStatus>
    </span>
  );
}
