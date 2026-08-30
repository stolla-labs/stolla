import { Buffer } from "buffer";
import { nativeToScVal, rpc, xdr } from "@stellar/stellar-sdk";

import { createRecorder, type CallRecorder } from "./callRecorder";
import {
  MOCK_ACCOUNT_ALICE,
  MOCK_PROPOSAL_ID,
} from "./fixtures";
import { registerMock } from "./registry";

export type VoteEventOptions = {
  id?: string;
  proposalId?: Buffer | string;
  voteType?: number;
  weight?: bigint;
  reason?: string;
  voter?: string;
  ledger?: number;
  value?: xdr.ScVal;
};

/** Builds a decoded RPC `vote_cast` event with the production topic layout. */
export function createVoteEvent(
  options: VoteEventOptions = {},
): rpc.Api.EventResponse {
  const proposalId =
    typeof options.proposalId === "string"
      ? Buffer.from(options.proposalId, "hex")
      : (options.proposalId ?? MOCK_PROPOSAL_ID);
  const ledger = options.ledger ?? 100;
  const id = options.id ?? `${ledger}-0`;
  const value =
    options.value ??
    xdr.ScVal.scvVec([
      xdr.ScVal.scvU32(options.voteType ?? 1),
      nativeToScVal(options.weight ?? BigInt(1), { type: "u128" }),
      xdr.ScVal.scvString(options.reason ?? ""),
    ]);

  return {
    id,
    type: "contract",
    ledger,
    ledgerClosedAt: "2026-01-01T00:00:00Z",
    transactionIndex: 0,
    operationIndex: 0,
    inSuccessfulContractCall: true,
    txHash: "22".repeat(32),
    topic: [
      xdr.ScVal.scvSymbol("vote_cast"),
      xdr.ScVal.scvString(options.voter ?? MOCK_ACCOUNT_ALICE),
      xdr.ScVal.scvBytes(proposalId),
    ],
    value,
  };
}

export function createEventPage(
  events: rpc.Api.EventResponse[],
  options: { latestLedger?: number; cursor?: string } = {},
): rpc.Api.GetEventsResponse {
  return {
    events,
    latestLedger: options.latestLedger ?? 200,
    oldestLedger: 1,
    latestLedgerCloseTime: "2026-01-01T00:00:00Z",
    oldestLedgerCloseTime: "2025-01-01T00:00:00Z",
    cursor: options.cursor ?? "",
  };
}

export type EventPageOutcome = rpc.Api.GetEventsResponse | Error | string;

export type EventsRpcMock = {
  getEvents: CallRecorder<
    rpc.Api.GetEventsRequest,
    Promise<rpc.Api.GetEventsResponse>
  >;
  setOutcomes(...outcomes: EventPageOutcome[]): void;
  reset(): void;
};

/** Queue-backed RPC event reader. It never constructs an SDK server. */
export function createEventsRpcMock(
  ...initialOutcomes: EventPageOutcome[]
): EventsRpcMock {
  const original = [...initialOutcomes];
  let outcomes = [...original];

  const getEvents = createRecorder<
    rpc.Api.GetEventsRequest,
    Promise<rpc.Api.GetEventsResponse>
  >(async () => {
    const outcome = outcomes.shift() ?? createEventPage([]);
    if (outcome instanceof Error) throw outcome;
    if (typeof outcome === "string") throw outcome;
    return outcome;
  });

  const mock: EventsRpcMock = {
    getEvents,
    setOutcomes(...nextOutcomes) {
      outcomes = [...nextOutcomes];
    },
    reset() {
      outcomes = [...original];
      getEvents.reset();
    },
  };

  return registerMock(mock);
}
