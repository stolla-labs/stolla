"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { Community, CommunityRegistry } from "@/lib/community/types";
import { useRegistryCommunity } from "@/lib/community/useRegistryCommunity";
import { getStoredProposalIdsFor } from "@/lib/contracts";
import {
  useCommunityProposals,
  type ProposalReaderFactory,
} from "@/lib/communities/proposals";
import { ProposalState } from "@/lib/bindings/community-governor/src";
import { CommunityBreadcrumbs } from "./CommunityBreadcrumbs";
import { CommunityNotFound } from "./CommunityNotFound";
import { AsyncState } from "@/components/ui/AsyncState";
import { EmptyState } from "@/components/ui/EmptyState";
import { FreshnessNotice } from "@/components/ui/FreshnessNotice";

const stateLabels: Record<ProposalState, string> = {
  [ProposalState.Pending]: "Pending",
  [ProposalState.Active]: "Active",
  [ProposalState.Defeated]: "Defeated",
  [ProposalState.Canceled]: "Canceled",
  [ProposalState.Succeeded]: "Succeeded",
  [ProposalState.Queued]: "Queued",
  [ProposalState.Expired]: "Expired",
  [ProposalState.Executed]: "Executed",
};

type DiscoveryFailureKind =
  | "config"
  | "retention"
  | "rpc"
  | "decode"
  | "partial"
  | "unknown";

type DiscoveryFailure = {
  kind: DiscoveryFailureKind;
  message: string;
};

const START_LEDGER_ENV = "NEXT_PUBLIC_GOVERNOR_START_LEDGER";

function mapDiscoveryFailure(error: unknown): DiscoveryFailure {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const message = raw.trim();
  const lower = message.toLowerCase();

  if (
    lower.includes("startledger") ||
    lower.includes("start ledger") ||
    lower.includes("ledger range") ||
    lower.includes("retention")
  ) {
    return {
      kind: "retention",
      message:
        message ||
        "The configured start ledger is outside the RPC retention window.",
    };
  }
  if (
    lower.includes("next_public_governor_start_ledger") ||
    lower.includes("start ledger is not configured") ||
    lower.includes("missing start ledger")
  ) {
    return {
      kind: "config",
      message:
        message ||
        `Missing ${START_LEDGER_ENV}. Configure it to enable proposal discovery.`,
    };
  }
  if (
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("timeout") ||
    lower.includes("rpc")
  ) {
    return {
      kind: "rpc",
      message: message || "The RPC endpoint could not be reached.",
    };
  }
  if (lower.includes("decode") || lower.includes("deserialize")) {
    return {
      kind: "decode",
      message: message || "A proposal event could not be decoded.",
    };
  }
  return {
    kind: "unknown",
    message: message || "Discovery failed.",
  };
}

function describeDiscoveryFailure(failure: DiscoveryFailure): string {
  switch (failure.kind) {
    case "config":
      return `Discovery is not configured: ${failure.message}`;
    case "retention":
      return `Discovery is outside the RPC retention window: ${failure.message}`;
    case "rpc":
      return `Discovery RPC error: ${failure.message}`;
    case "decode":
      return `Discovery decode error: ${failure.message}`;
    case "partial":
      return `Discovery partially failed: ${failure.message}`;
    default:
      return failure.message;
  }
}

export type CommunityProposalsViewProps = {
  communityId: string;
  registry?: CommunityRegistry;
  proposalIds?: string[];
  getReader?: ProposalReaderFactory;
};

export function CommunityProposalsView({
  communityId,
  registry,
  proposalIds,
  getReader,
}: CommunityProposalsViewProps) {
  const resolution = useRegistryCommunity(communityId, registry);

  if (resolution.status === "loading") {
    return <p className="p-6 text-sm text-slate-400">Loading community…</p>;
  }
  if (resolution.status === "error") {
    return (
      <p role="alert" className="p-6 text-sm text-rose-300">
        {resolution.error}
      </p>
    );
  }
  if (resolution.result.status !== "found") {
    return <CommunityNotFound communityId={communityId} />;
  }

  const community = resolution.result.community;

  return (
    <CommunityProposalsPanel
      community={community}
      proposalIds={
        proposalIds ??
        getStoredProposalIdsFor(community.record.governorContract)
      }
      getReader={getReader}
    />
  );
}

function CommunityProposalsPanel({
  community,
  proposalIds,
  getReader,
}: {
  community: Community;
  proposalIds: string[];
  getReader?: ProposalReaderFactory;
}) {
  const resolution = useCommunityProposals(
    community.record.governorContract,
    proposalIds,
    getReader,
  );

  const discoveryFailure = useMemo<DiscoveryFailure | null>(() => {
    if (resolution.status !== "ready") {
      return null;
    }
    const errored = resolution.entries.find(
      (entry) => entry.status === "error",
    );
    if (!errored || errored.status !== "error") {
      return null;
    }
    return mapDiscoveryFailure(errored.error);
  }, [resolution]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <CommunityBreadcrumbs
        communityId={community.record.id}
        communityName={community.metadata?.name ?? community.record.id}
      />
      <h1 className="mt-4 text-2xl font-bold text-slate-100">
        {community.metadata?.name ??
          `Community ${community.record.id.slice(0, 8)}`} proposals
      </h1>

      {resolution.status === "loading" && (
        <AsyncState className="mt-6 text-sm text-slate-500">
          Loading proposals…
        </AsyncState>
      )}

      {resolution.status === "ready" && proposalIds.length === 0 && (
        <EmptyState className="mt-6">No proposals yet.</EmptyState>
      )}

      {resolution.status === "ready" && proposalIds.length > 0 && (
        <>
          {discoveryFailure && (
            <FreshnessNotice className="mt-6">
              <span role="alert">
                {describeDiscoveryFailure(discoveryFailure)}
              </span>
              {resolution.entries.some(
                (entry) => entry.status === "ready",
              ) && (
                <span className="block text-slate-400">
                  Successful proposals remain visible.
                </span>
              )}
            </FreshnessNotice>
          )}
          <ul className="mt-6 space-y-2">
            {resolution.entries.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={`/community/${community.record.id}/proposals/${entry.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#151b2b] px-4 py-3 text-sm text-slate-200 hover:bg-slate-800/80"
                >
                  <span className="truncate font-mono">#{entry.id}</span>
                  <span
                    className={`ml-3 ${entry.status === "error" ? "text-rose-400" : "text-slate-500"}`}
                  >
                    {entry.status === "ready"
                      ? stateLabels[entry.state]
                      : entry.status === "error"
                        ? describeDiscoveryFailure(
                            mapDiscoveryFailure(entry.error),
                          )
                        : "Unavailable"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export { mapDiscoveryFailure, describeDiscoveryFailure };
