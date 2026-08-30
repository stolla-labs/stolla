import { rpc, scValToNative } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";
import { config, contractIds, requireGovernorStartLedger } from "../stellar";
import { getE2EBridge } from "../e2eMock";

export interface VoteTotals {
  for: bigint;
  against: bigint;
  abstain: bigint;
  total: bigint;
}

export interface VoteAggregationResult {
  totals: VoteTotals;
  /** Whether event history was incomplete or errored */
  incomplete: boolean;
  /** Human-readable error if the query failed entirely */
  error?: string;
}

/**
 * Fetches all `vote_cast` events for a given proposal from the Soroban RPC
 * and aggregates vote weights by type.
 *
 * Vote types: 0 = Against, 1 = For, 2 = Abstain
 *
 * Handles pagination, deduplication by event ID, and partial read failures.
 */
export async function fetchVoteTotals(
  proposalIdHex: string,
  governorContractId = contractIds.governor,
): Promise<VoteAggregationResult> {
  if (getE2EBridge()?.proposals?.[governorContractId]) {
    return {
      totals: {
        for: BigInt(0),
        against: BigInt(0),
        abstain: BigInt(0),
        total: BigInt(0),
      },
      incomplete: false,
    };
  }
  if (!governorContractId) {
    return {
      totals: { for: BigInt(0), against: BigInt(0), abstain: BigInt(0), total: BigInt(0) },
      incomplete: true,
      error: "Governor contract ID not configured",
    };
  }

  const server = new rpc.Server(config.rpcUrl);
  const proposalIdBuffer = Buffer.from(proposalIdHex, "hex");
  const startLedger = requireGovernorStartLedger();

  const totals: VoteTotals = { for: BigInt(0), against: BigInt(0), abstain: BigInt(0), total: BigInt(0) };
  const seenEventIds = new Set<string>();
  let incomplete = false;
  let cursor: string | undefined;

  // Testnet RPC rejects startLedger=1 and OZ topic filters currently return
  // empty sets; scan by contract and match vote_cast + proposal id locally.
  const filters: rpc.Api.EventFilter[] = [
    {
      type: "contract",
      contractIds: [governorContractId],
    },
  ];

  try {
    for (let page = 0; page < 50; page++) {
      const response = cursor
        ? await server.getEvents({ filters, cursor, limit: 100 })
        : await server.getEvents({ filters, startLedger, limit: 100 });

      if (!response.events || response.events.length === 0) {
        break;
      }

      for (const event of response.events) {
        if (seenEventIds.has(event.id)) continue;
        seenEventIds.add(event.id);

        try {
          if (event.topic.length < 3) continue;
          const kind = event.topic[0];
          const kindName =
            kind.switch().name === "scvSymbol"
              ? kind.sym().toString()
              : kind.switch().name === "scvString"
                ? kind.str().toString()
                : "";
          if (kindName !== "vote_cast") continue;
          const proposalTopic = event.topic[2];
          if (proposalTopic.switch().name !== "scvBytes") continue;
          const topicProposal = Buffer.from(proposalTopic.bytes());
          if (!topicProposal.equals(proposalIdBuffer)) continue;

          // event.value is xdr.ScVal of type Vec[u32, u128, String]
          const native = scValToNative(event.value) as [
            number,
            bigint,
            string,
          ];
          const voteType = native[0];
          const weight = native[1];

          switch (voteType) {
            case 0: // Against
              totals.against += weight;
              break;
            case 1: // For
              totals.for += weight;
              break;
            case 2: // Abstain
              totals.abstain += weight;
              break;
          }
        } catch {
          // Skip malformed events - mark incomplete but continue
          incomplete = true;
        }
      }

      // Check for more pages
      if (response.events.length < 100) {
        break;
      }
      cursor = response.cursor;
    }
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch vote events";
    return { totals, incomplete: true, error: message };
  }

  totals.total = totals.for + totals.against + totals.abstain;
  return { totals, incomplete };
}
