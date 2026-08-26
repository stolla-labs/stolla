"use client";

import { useCallback, useEffect, useState } from "react";
import { Server as RpcServer } from "@stellar/stellar-sdk/rpc";
import type { Api } from "@stellar/stellar-sdk/rpc";
import { config, requireContractIds, requireGovernorStartLedger } from "@/lib/stellar";
import { decodeProposalEvent } from "@/lib/proposalEvents";
import { getE2EBridge } from "@/lib/e2eMock";

export type DiscoveredProposal = {
  id: string;
  /** Proposal description from the created event, or null when unavailable. */
  description: string | null;
};

function extractDescription(event: Api.EventResponse): string | null {
  const decoded = decodeProposalEvent({
    type: event.type,
    contractId: event.contractId,
    topic: event.topic,
    value: event.value,
  });
  if (decoded.ok && decoded.event.kind === "proposal_created") {
    return decoded.event.description;
  }

  try {
    if (event.value.switch().name !== "scvVec") return null;
    const fields = event.value.vec();
    const descriptionVal = fields?.[5];
    if (!descriptionVal || descriptionVal.switch().name !== "scvString") {
      return null;
    }
    return descriptionVal.str() as string;
  } catch {
    return null;
  }
}

export function useProposalDiscovery(governorContractId?: string) {
  const [proposals, setProposals] = useState<DiscoveredProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);
  const [freshness, setFreshness] = useState<"Current" | "Delayed" | "Stale" | "Unavailable">("Current");

  const discover = useCallback(async () => {
    const governor = governorContractId ?? requireContractIds().governor;
    const server = new RpcServer(config.rpcUrl);
    const startLedger = requireGovernorStartLedger();

    setLoading(true);
    setError(null);
    setEmpty(false);

    try {
      const mocked = getE2EBridge()?.proposals?.[governor];
      if (mocked) {
        setProposals(mocked);
        setEmpty(mocked.length === 0);
        setFreshness("Current");
        return true;
      }
      const discovered: DiscoveredProposal[] = [];
      let cursor: string | undefined = undefined;
      let hasMalformedMetadata = false;

      for (;;) {
        const request:
          | {
              filters: { contractIds: string[] }[];
              startLedger: number;
              limit?: number;
              cursor?: never;
            }
          | {
              filters: { contractIds: string[] }[];
              cursor: string;
              startLedger?: never;
              limit?: number;
            } = cursor
          ? {
              filters: [{ contractIds: [governor] }],
              cursor,
              limit: 100,
            }
          : {
              filters: [{ contractIds: [governor] }],
              startLedger,
              limit: 100,
            };

        const response = await server.getEvents(request);
        
        if (response.latestLedger === undefined || response.latestLedger === null) {
          hasMalformedMetadata = true;
        }

        for (const event of response.events) {
          if (event.topic.length < 2) continue;
          const kind = event.topic[0];
          const kindName =
            kind.switch().name === "scvSymbol"
              ? kind.sym().toString()
              : kind.switch().name === "scvString"
                ? kind.str().toString()
                : "";
          if (kindName !== "proposal_created") continue;
          const proposalIdScVal = event.topic[1];
          if (proposalIdScVal.switch().name !== "scvBytes") continue;
          const proposalIdBytes = proposalIdScVal.bytes();
          if (!proposalIdBytes) continue;
          discovered.push({
            id: Buffer.from(proposalIdBytes).toString("hex"),
            description: extractDescription(event),
          });
        }

        if (!response.events.length || !response.cursor) break;
        cursor = response.cursor;
      }

      discovered.reverse();
      setProposals(discovered);
      setEmpty(discovered.length === 0);
      setFreshness(hasMalformedMetadata ? "Delayed" : "Current");
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Discovery failed");
      setFreshness(proposals.length > 0 ? "Stale" : "Unavailable");
      return false;
    } finally {
      setLoading(false);
    }
  }, [governorContractId, proposals.length]);

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
    freshness,
    refresh: discover,
  };
}
