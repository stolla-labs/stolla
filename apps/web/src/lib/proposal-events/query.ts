import { rpc, xdr } from "@stellar/stellar-sdk";
import { config, requireGovernorStartLedger } from "../stellar";
import { PROPOSAL_EVENT_NAMES } from "./kinds";

const PROPOSAL_EVENT_TOPIC_FILTERS = PROPOSAL_EVENT_NAMES.map((name) => [
  xdr.ScVal.scvSymbol(name).toXDR("base64"),
]);

export type ProposalEventsPage = {
  events: rpc.Api.EventResponse[];
  latestLedger: number;
  cursor: string;
};

/**
 * Queries the Soroban RPC for proposal events for an explicit Governor.
 *
 * Uses `NEXT_PUBLIC_GOVERNOR_START_LEDGER` as the lower ledger boundary.
 * Callers must pass the selected Governor contract id — never rely on a
 * silent env fallback when Community scoping is in effect.
 *
 * @param governorContractId - Governor contract to filter events by.
 * @param cursor - Optional cursor for pagination.
 * @returns A page of proposal events, the latest ledger, and a response cursor.
 */
export async function getProposalEvents(
  governorContractId: string,
  cursor?: string,
): Promise<ProposalEventsPage> {
  const startLedger = requireGovernorStartLedger();

  if (!governorContractId) {
    throw new Error(
      "Governor contract ID is not configured. Set NEXT_PUBLIC_GOVERNOR_CONTRACT_ID.",
    );
  }

  const server = new rpc.Server(config.rpcUrl, {
    allowHttp: config.rpcUrl.startsWith("http://"),
  });
  const filters = [
    {
      type: "contract" as const,
      contractIds: [governorContractId],
      topics: PROPOSAL_EVENT_TOPIC_FILTERS,
    },
  ];

  try {
    const response = await server.getEvents(
      cursor
        ? ({
            startLedger,
            filters,
            cursor,
            limit: 10,
          } as unknown as Parameters<rpc.Server["getEvents"]>[0])
        : ({
            startLedger,
            filters,
            limit: 10,
          } as unknown as Parameters<rpc.Server["getEvents"]>[0]),
    );

    return {
      events: response.events ?? [],
      latestLedger: response.latestLedger,
      cursor: response.cursor,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown RPC query failure.";

    throw new Error(
      `Failed to query governor proposal events: ${message}`,
    );
  }
}
