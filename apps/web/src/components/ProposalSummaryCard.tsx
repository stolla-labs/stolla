"use client";

import Link from "next/link";
import type { ProposalSummary } from "@/lib/proposal-events";
import { truncateMiddle } from "@/lib/truncate";
import { parseProposalDescription } from "@/lib/proposal-metadata";

export type ProposalSummaryCardStateStatus =
  | "loading"
  | "ready"
  | "unavailable";

export type ProposalSummaryCardProps = {
  /**
   * Shared proposal summary model. Only `proposalId` is required; optional
   * metadata uses explicit placeholders when missing.
   */
  summary: Pick<ProposalSummary, "proposalId"> &
    Partial<
      Pick<ProposalSummary, "proposer" | "voteSnapshot" | "voteEnd">
    > & {
      /** Null means discovery could not provide a description. */
      description?: string | null;
    };
  stateStatus: ProposalSummaryCardStateStatus;
  /** Human-readable state label when `stateStatus` is `ready`. */
  stateLabel?: string;
  /**
   * When true, render the proposal description (or an explicit unavailable
   * fallback). Description text is plain — never nested interactive controls.
   */
  showDescription?: boolean;
  onRetryState?: () => void;
  isRetryingState?: boolean;
  onCopyId?: () => void;
  href?: string;
};

function OptionalMeta({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  const display =
    value === null || value === undefined || value === ""
      ? "Unavailable"
      : String(value);

  return (
    <p className="mt-1 min-w-0 truncate text-xs text-slate-500">
      <span className="text-slate-600">{label}: </span>
      <span title={display === "Unavailable" ? undefined : display}>
        {display}
      </span>
    </p>
  );
}

function DescriptionText({
  description,
}: {
  description: string | null | undefined;
}) {
  const trimmed = description?.trim() ?? "";
  const hasDescription = trimmed.length > 0;
  const parsed = parseProposalDescription(trimmed);
  if (parsed.kind === "legacy") {
    return (
      <p
        className={`mt-1 min-w-0 text-xs [overflow-wrap:anywhere] ${
          hasDescription
            ? "line-clamp-2 break-words text-slate-400"
            : "text-slate-600"
        }`}
        title={hasDescription ? trimmed : undefined}
      >
        {hasDescription ? trimmed : "Description unavailable"}
      </p>
    );
  }
  const title = parsed.kind === "versioned" ? parsed.metadata.title : null;
  const display =
    parsed.kind === "versioned" ? parsed.metadata.summary : trimmed;

  return (
    <span className="mt-1 min-w-0">
      {title && <span className="block truncate text-sm font-medium text-slate-200">{title}</span>}
      <span
        className={`block text-xs [overflow-wrap:anywhere] ${hasDescription ? "line-clamp-2 break-words text-slate-400" : "text-slate-600"}`}
        title={hasDescription ? display : undefined}
      >
        {hasDescription ? display : "Description unavailable"}
      </span>
    </span>
  );
}

/**
 * Reusable proposal list card backed by {@link ProposalSummary}.
 */
export function ProposalSummaryCard({
  summary,
  stateStatus,
  stateLabel,
  showDescription = false,
  onRetryState,
  isRetryingState = false,
  onCopyId,
  href,
}: ProposalSummaryCardProps) {
  const { proposalId } = summary;
  const stateText =
    stateStatus === "loading"
      ? "…"
      : stateStatus === "unavailable"
        ? "Unavailable"
        : (stateLabel ?? "Unknown");

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-[#151b2b] px-4 py-3 text-sm text-slate-200 hover:bg-slate-800/80">
      <Link
        href={href ?? `/proposals/${proposalId}`}
        className="flex min-w-0 flex-1 flex-col gap-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
        aria-label={`View proposal ${proposalId}, state ${stateText}`}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="truncate font-mono" title={proposalId}>
            {truncateMiddle(proposalId)}
          </span>
          <span
            className={
              stateStatus === "unavailable"
                ? "shrink-0 text-amber-300"
                : "shrink-0 text-slate-500"
            }
          >
            {stateText}
          </span>
        </span>
        {showDescription && (
          <DescriptionText description={summary.description} />
        )}
        {"proposer" in summary && (
          <OptionalMeta label="Proposer" value={summary.proposer} />
        )}
      </Link>
      <div className="flex shrink-0 items-center gap-1">
        {stateStatus === "unavailable" && onRetryState && (
          <button
            type="button"
            onClick={onRetryState}
            disabled={isRetryingState}
            className="rounded px-2 py-1 text-xs font-medium text-amber-200 transition hover:bg-amber-900/50 disabled:opacity-50"
            aria-label={`Retry loading state for proposal ${proposalId}`}
          >
            {isRetryingState ? "Retrying…" : "Retry state"}
          </button>
        )}
        {onCopyId && (
          <button
            type="button"
            onClick={onCopyId}
            className="rounded px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-700 hover:text-slate-200"
            title="Copy proposal ID"
            aria-label={`Copy proposal ID ${proposalId}`}
          >
            Copy
          </button>
        )}
      </div>
    </div>
  );
}
