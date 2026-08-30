import { rpc } from "@stellar/stellar-sdk";

export interface EventPage {
  events: rpc.Api.EventResponse[];
  cursor: string;
}

export interface FetchGovernorEventsOptions {
  server: rpc.Server;
  contractId: string;
  startLedger: number;
  /** Stop after this many pages. Omit for no limit. */
  maxPages?: number;
}

/**
 * Async generator that yields one EventPage per RPC call.
 *
 * The first request uses `startLedger`. Each subsequent request uses the
 * cursor from the previous response. An empty page or a non-advancing cursor
 * terminates the sequence. Callers can `break` early at any time.
 *
 * RPC failures are re-thrown — the caller keeps whatever pages were yielded
 * before the error.
 */
export async function* fetchGovernorEvents(
  opts: FetchGovernorEventsOptions,
): AsyncGenerator<EventPage> {
  const { server, contractId, startLedger, maxPages } = opts;
  const filters: rpc.Api.EventFilter[] = [
    { type: "contract", contractIds: [contractId] },
  ];

  let cursor: string | undefined;
  let pages = 0;
  const seenCursors = new Set<string>();

  while (maxPages === undefined || pages < maxPages) {
    const request: rpc.Api.GetEventsRequest = cursor
      ? { filters, cursor }
      : { filters, startLedger };

    const response = await server.getEvents(request);
    const nextCursor = response.cursor;

    yield { events: response.events, cursor: nextCursor };
    pages++;

    if (response.events.length === 0) break;
    if (!nextCursor) break;
    // Repeated cursor means the server isn't advancing — stop to prevent loops.
    if (seenCursors.has(nextCursor)) break;

    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }
}
