"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CommunityAvatar } from "@/components/CommunityAvatar";
import { AsyncState } from "@/components/ui/AsyncState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FreshnessNotice } from "@/components/ui/FreshnessNotice";
import { LiveStatus } from "@/components/ui/LiveStatus";
import { OnChainIdentifier } from "@/components/ui/OnChainIdentifier";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCommunityRegistry } from "@/lib/community/CommunityRegistryProvider";
import type {
  CommunityDetailResult,
  CommunityRegistryRecord,
} from "@/lib/community/types";
import { truncateMiddle } from "@/lib/truncate";

function ContractAddress({
  label,
  record,
  contractId,
}: {
  label: string;
  record: CommunityRegistryRecord;
  contractId: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-800 bg-[#0b0f19] p-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-2 min-w-0">
        <OnChainIdentifier
          label={label}
          value={contractId}
          kind="contract"
          truncateStart={12}
          truncateEnd={10}
        />
      </dd>
      <span className="sr-only">Community {record.id}</span>
    </div>
  );
}

export default function CommunityDetailPage() {
  const params = useParams<{ id: string }>();
  const communityId = params.id;
  const registry = useCommunityRegistry();
  const [result, setResult] = useState<CommunityDetailResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copyStatus, setCopyStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await registry.get(communityId));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The community registry could not be reached.",
      );
    } finally {
      setLoading(false);
    }
  }, [communityId, registry]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  async function copyValue(label: string, value: string) {
    setCopyStatus("");
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus(`${label} copied.`);
    } catch {
      setCopyStatus(`Could not copy ${label.toLowerCase()}.`);
    }
  }

  async function shareCommunity(name: string, id: string) {
    setCopyStatus("");
    const canonicalUrl = `${window.location.origin}/communities/${id}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `${name} on Stolla`,
          text: `View ${name} on Stolla.`,
          url: canonicalUrl,
        });
        setCopyStatus("Community page shared.");
      } catch {
        setCopyStatus("Could not share the community page.");
      }
      return;
    }
    await copyValue("Community page link", canonicalUrl);
  }

  if (loading && !result) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-4xl px-4 py-10">
        <AsyncState className="sr-only">Loading community details…</AsyncState>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-3 h-5 w-full max-w-xl" />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-4xl px-4 py-10">
        <ErrorState
          title="Community could not be loaded"
          onRetry={() => void load()}
          retryLabel="Retry community request"
          action={
            <Link
              href="/communities"
              className="inline-flex min-h-11 items-center rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Back to communities
            </Link>
          }
        >
          {error}
        </ErrorState>
      </div>
    );
  }

  if (!result || result.status === "not-found") {
    return (
      <div className="mx-auto w-full min-w-0 max-w-4xl px-4 py-10">
        <section className="rounded-xl border border-slate-800 bg-[#151b2b] p-6">
          <h1 className="text-xl font-semibold text-slate-100">
            Community not found
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            This ID is malformed or is not present in the canonical registry.
          </p>
          <Link
            href="/communities"
            className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
          >
            Browse communities
          </Link>
        </section>
      </div>
    );
  }

  if (result.status === "malformed") {
    return (
      <div className="mx-auto w-full min-w-0 max-w-4xl px-4 py-10">
        <section
          role="alert"
          className="rounded-xl border border-amber-800/70 bg-amber-950/40 p-6"
        >
          <h1 className="text-xl font-semibold text-amber-100">
            Community record is malformed
          </h1>
          <p className="mt-2 text-sm text-amber-200">{result.message}</p>
          <Link
            href="/communities"
            className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-amber-700 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-900/50"
          >
            Back to communities
          </Link>
        </section>
      </div>
    );
  }

  const { community } = result;
  const { metadata, metadataError, record, governance } = community;
  const name = metadata?.name ?? `Community ${truncateMiddle(record.id, 8, 6)}`;

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl px-4 py-10">
      <Link
        href="/communities"
        className="text-sm text-indigo-300 hover:text-indigo-200"
      >
        ← All communities
      </Link>

      <header className="mt-5 flex min-w-0 items-start gap-4">
        <CommunityAvatar
          communityId={record.id}
          name={name}
          logo={metadata?.logo}
          size="detail"
        />
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-bold text-slate-100 [overflow-wrap:anywhere] sm:text-3xl">
            {name}
          </h1>
          <p className="mt-2 break-all font-mono text-xs text-slate-500">
            {record.id}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyValue("Community ID", record.id)}
              className="min-h-11 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              aria-label="Copy full community ID"
            >
              Copy ID
            </button>
            <button
              type="button"
              onClick={() => void shareCommunity(name, record.id)}
              className="min-h-11 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              aria-label={`Share ${name} community page`}
            >
              Share page
            </button>
          </div>
        </div>
      </header>

      <LiveStatus className="mt-3 text-sm text-slate-400">
        {copyStatus}
      </LiveStatus>

      {metadata ? (
        <p className="mt-6 break-words leading-7 text-slate-300 [overflow-wrap:anywhere]">
          {metadata.description}
        </p>
      ) : (
        <FreshnessNotice
          title="Community metadata is unavailable"
          className="mt-6"
        >
          <p className="break-words [overflow-wrap:anywhere]">
            {metadataError} The verified on-chain registry details remain
            available below.
          </p>
        </FreshnessNotice>
      )}

      {metadata && metadata.externalLinks.length > 0 && (
        <nav aria-label="Community links" className="mt-5 flex flex-wrap gap-2">
          {metadata.externalLinks.map((link) => (
            <a
              key={`${link.label}:${link.url}`}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              {link.label}
            </a>
          ))}
        </nav>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/communities/${record.id}/proposals`}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
        >
          View community proposals
        </Link>
        <Link
          href={`/community?community=${record.id}`}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
        >
          Membership actions
        </Link>
      </div>

      <section
        aria-labelledby="contracts-title"
        className="mt-8 rounded-xl border border-slate-800 bg-[#151b2b] p-4 sm:p-6"
      >
        <h2 id="contracts-title" className="font-semibold text-slate-100">
          Deployed contracts
        </h2>
        <dl className="mt-4 grid min-w-0 gap-3 md:grid-cols-2">
          <ContractAddress
            label="NFT contract"
            record={record}
            contractId={record.nftContract}
          />
          <ContractAddress
            label="Governor contract"
            record={record}
            contractId={record.governorContract}
          />
        </dl>
      </section>

      <section
        aria-labelledby="governance-title"
        className="mt-6 rounded-xl border border-slate-800 bg-[#151b2b] p-4 sm:p-6"
      >
        <h2 id="governance-title" className="font-semibold text-slate-100">
          Governance configuration
        </h2>
        {governance.unavailableFields.length > 0 && (
          <FreshnessNotice className="mt-3 p-3">
            Some Governor reads failed:{" "}
            {governance.unavailableFields.join(", ")}. Available values remain
            visible.
          </FreshnessNotice>
        )}
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-slate-500">
              Proposal threshold (NFT votes)
            </dt>
            <dd className="mt-1 text-slate-100">
              {governance.proposalThreshold ?? "Unavailable"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Quorum (NFT votes)</dt>
            <dd className="mt-1 text-slate-100">
              {governance.quorum ?? "Unavailable"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">
              Voting delay (Stellar ledgers)
            </dt>
            <dd className="mt-1 text-slate-100">
              {governance.votingDelay ?? "Unavailable"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">
              Voting period (Stellar ledgers)
            </dt>
            <dd className="mt-1 text-slate-100">
              {governance.votingPeriod ?? "Unavailable"}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-slate-500">
          Ledger durations are authoritative. Wall-clock conversions are only
          estimates.
        </p>
      </section>

      <section
        aria-labelledby="registry-title"
        className="mt-6 rounded-xl border border-slate-800 bg-[#151b2b] p-4 sm:p-6"
      >
        <h2 id="registry-title" className="font-semibold text-slate-100">
          Registry provenance
        </h2>
        <dl className="mt-4 grid min-w-0 gap-4 text-sm sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-slate-500">Created at ledger</dt>
            <dd className="mt-1 text-slate-200">{record.createdAtLedger}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-slate-500">Creation index</dt>
            <dd className="mt-1 text-slate-200">{record.creationIndex}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-slate-500">Community owner</dt>
            <dd className="mt-1 min-w-0 text-slate-200">
              <OnChainIdentifier
                label="Community owner"
                value={record.communityOwner}
                kind="account"
                truncateStart={10}
                truncateEnd={8}
              />
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-slate-500">Metadata URI</dt>
            <dd
              title={record.metadataUri}
              className="mt-1 break-all font-mono text-slate-200"
            >
              {record.metadataUri}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
