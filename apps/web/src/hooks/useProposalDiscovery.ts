"use client";

import { useCallback, useEffect, useState } from "react";
import { Server as RpcServer } from "@stellar/stellar-sdk/rpc";
import {
  config,
  requireContractIds,
  requireGovernorStartLedger,
} from "@/lib/stellar";
import {
  decodeProposalEvent,
  fetchGovernorEvents,
} from "@/lib/proposal-events";
import { getE2EBridge } from "@/lib/e2eMock";
import { parseProposalDescription, type ProposalMetadataV1 } from "@/lib/proposal-metadata";

export type DiscoveredProposal = {
  id: string;
  /** Proposal description from the created event, or null when unavailable. */
  description: string | null;
  /** Parsed v1 metadata, or null for legacy / unavailable descriptions. */
  metadata: ProposalMetadataV1 | null;
};

/**
 * Discover proposals for a Governor via the shared event pipeline.
 *
 * - Omit `governorContractId` for the legacy global surface (env Governor).
 * - When Community (or any caller) passes an explicit id, that contract is
 *   used exclusively — never silently fall back to the env global Governor.
 */
export function useProposalDiscovery(governorContractId?: string) {
  const [proposals, setProposals] = useState<DiscoveredProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);

  const discover = useCallback(async () => {
    const governor =
      governorContractId !== undefined
        ? governorContractId
        : requireContractIds().governor;

    if (!governor) {
      setError(
        "Governor contract ID is not configured. Set NEXT_PUBLIC_GOVERNOR_CONTRACT_ID.",
      );
      setLoading(false);
      return false;
    }

    const server = new RpcServer(config.rpcUrl);
    const startLedger = requireGovernorStartLedger();

    setLoading(true);
    setError(null);
    setEmpty(false);

    try {
      const mocked = getE2EBridge()?.proposals?.[governor];
      if (mocked) {
        setProposals(mocked.map((proposal) => ({
          ...proposal,
          metadata: proposal.description
            ? (() => {
                const parsed = parseProposalDescription(proposal.description);
                return parsed.kind === "versioned" ? parsed.metadata : null;
              })()
            : null,
        })));
        setEmpty(mocked.length === 0);
        return true;
      }

      const discovered: DiscoveredProposal[] = [];

      for await (const page of fetchGovernorEvents({
        server,
        contractId: governor,
        startLedger,
      })) {
        for (const event of page.events) {
          const decoded = decodeProposalEvent(
            {
              type: event.type,
              contractId: event.contractId,
              topic: event.topic,
              value: event.value,
            },
            { expectedContractId: governor },
          );
          if (!decoded.ok || decoded.event.kind !== "proposal_created") {
            continue;
          }
          const parsed = parseProposalDescription(decoded.event.description);
          discovered.push({
            id: decoded.event.proposalId,
            description: decoded.event.description,
            metadata: parsed.kind === "versioned" ? parsed.metadata : null,
          });
        }
      }

      discovered.reverse();
      setProposals(discovered);
      setEmpty(discovered.length === 0);
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Discovery failed");
      return false;
    } finally {
      setLoading(false);
    }
  }, [governorContractId]);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => void discover().catch(() => undefined),
      0,
    );
    return () => window.clearTimeout(timeout);
  }, [discover]);

  const proposalIds = proposals.map((proposal) => proposal.id);

  return {
    proposals,
    proposalIds,
    loading,
    error,
    empty,
    refresh: discover,
  };
}
