"use client";

import Link from "next/link";
import type { ReactNode } from "react";
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
  | "config-missing"
  | "retention"
  | "rpc"
  | "decode"
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
    lower.includes("startledger must be within the ledger range") ||
    lower.includes("ledger range") ||
    lower.includes("retention") ||
    lower.includes("clamp")
  ) {
    return {
      kind: "retention",
      message:
        message ||
        `Start ledger is outside the RPC retention window. Check ${START_LEDGER_ENV}.`,
    };
  }

  if (
    lower.includes("start ledger") ||
    lower.includes("startledger") ||
    lower.includes("start_ledger") ||
    lower.includes("governor_start_ledger")
  ) {
    return {
      kind: "config-missing",
      message:
        message ||
        `Missing start-ledger configuration. Set ${START_LEDGER_ENV}.`,
    };
  }

  if (
    lower.includes("fetch") ||
    lower.includes("network") ||
    lower.includes("rpc") ||
    lower.includes("timeout") ||
    lower.includes("econn") ||
    lower.includes("socket")
  ) {
    return {
      kind: "rpc",
      message: message || "RPC request failed while discovering proposals.",
    };
  }

  if (
    lower.includes("decode") ||
    lower.includes("deserialize") ||
    lower.includes("parse") ||
    lower.includes("invalid")
  ) {
    return {
      kind: "decode",
      message:
        message || "Failed to decode proposal events returned by the RPC.",
    };
  }

  return {
    kind: "unknown",
    message: message || "Discovery failed.",
  };
}

function describeDiscoveryFailure(failure: DiscoveryFailure): ReactNode {
  switch (failure.kind) {
    case "config-missing":
      return (
        <>
          Missing start-ledger configuration. Set{" "}
          <code className="font-mono">{START_LEDGER_ENV}</code>.
        </>
      );
    case "retention":
      return (
        <>
          Start ledger is outside the RPC retention window. Adjust{" "}
          <code className="font-mono">{START_LEDGER_ENV}</code> or use an RPC
          that retains the required ledger range.
        </>
      );
    case "rpc":
      return "RPC request failed while discovering proposals. Retry or check the RPC endpoint.";
    case "decode":
      return "Failed to decode proposal events returned by the RPC.";
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

  const discoveryFailure =
    resolution.status === "error"
      ? mapDiscoveryFailure(resolution.error)
      : null;

  const partialFailure =
    resolution.status === "ready" &&
    resolution.entries.some((entry) => entry.status === "error")
      ? mapDiscoveryFailure(
          resolution.entries.find((entry) => entry.status === "error")?.error,
        )
      : null;

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

      {resolution.status === "error" && discoveryFailure && (
        <FreshnessNotice role="alert" className="mt-6 text-rose-300">
          <span className="font-medium">Discovery failed.</span>{" "}
          {describeDiscoveryFailure(discoveryFailure)}
        </FreshnessNotice>
      )}

      {resolution.status === "ready" && proposalIds.length === 0 && (
        <EmptyState className="mt-6">No proposals yet.</EmptyState>
      )}

      {resolution.status === "ready" && proposalIds.length > 0 && (
        <>
          {partialFailure && (
            <FreshnessNotice role="alert" className="mt-6 text-rose-300">
              <span className="font-medium">
                Some proposal states are unavailable.
              </span>{" "}
              {describeDiscoveryFailure(partialFailure)} Successful proposals
              remain visible.
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
