/**
 * Community Governor scoping regression (#256 / H10).
 *
 * Proves the shared proposal-events pipeline never mixes Governors:
 * - getEvents / query filters by the selected Governor only
 * - decode rejects events from another Governor
 * - dedupe identities remain distinct across Governors for the same proposal id
 * - fetchVoteTotals for G_A does not attribute G_B votes
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Address, xdr } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";
import { getProposalEvents } from "./query";
import { decodeProposalEvent } from "./decode";
import {
  dedupeProposalSummaries,
  proposalRowIdentity,
} from "./dedupe";
import type { ProposalSummary } from "./types";
import { fetchVoteTotals } from "./votes";

const G_A = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";
const G_B = "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBRTR4";
const PROPOSAL_HEX =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const VOTER = "GAZSOBEW6H374SOMTQIRC432JXTA4VPSG6P3ADA35TRQIYT3WTVQWFE5";

const { mockGetEvents, mockServerConstructor, mockScValToNative } = vi.hoisted(
  () => {
    const getEvents = vi.fn();
    const scValToNative = vi.fn();
    const serverConstructor = vi.fn(function MockServer() {
      return { getEvents };
    });
    return {
      mockGetEvents: getEvents,
      mockServerConstructor: serverConstructor,
      mockScValToNative: scValToNative,
    };
  },
);

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();
  return {
    ...actual,
    scValToNative: mockScValToNative,
    rpc: {
      ...actual.rpc,
      Server: mockServerConstructor,
    },
  };
});

vi.mock("../stellar", () => ({
  config: { rpcUrl: "https://test.rpc.url" },
  contractIds: {
    // Env global — must never be used when an explicit Community Governor is passed.
    governor: "CENVGLOBALGOVERNORXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  },
  requireGovernorStartLedger: () => 1000,
}));

vi.mock("../e2eMock", () => ({
  getE2EBridge: () => undefined,
}));

function summary(
  governorContractId: string,
  proposalId = PROPOSAL_HEX,
): ProposalSummary {
  return {
    proposalId,
    governorContractId,
    proposer: "GPROPOSER",
    creationLedger: 100,
    txHash: "tx",
    cursor: "c1",
    voteSnapshot: 10,
    voteEnd: 20,
    description: "Scoped",
  };
}

function voteCastEvent(contractId: string, proposalHex = PROPOSAL_HEX) {
  return {
    id: `${contractId}-vote`,
    type: "contract",
    ledger: 100,
    ledgerClosedAt: "2024-01-01T00:00:00Z",
    contractId,
    topic: [
      xdr.ScVal.scvSymbol("vote_cast"),
      Address.fromString(VOTER).toScVal(),
      xdr.ScVal.scvBytes(Buffer.from(proposalHex, "hex")),
    ],
    value: xdr.ScVal.scvVoid(),
    inSuccessfulContractCall: true,
  };
}

describe("Community Governor scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getProposalEvents filters getEvents by the selected Governor only", async () => {
    mockGetEvents.mockResolvedValue({
      events: [],
      latestLedger: 200,
      cursor: "c",
    });

    await getProposalEvents(G_A);

    expect(mockGetEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [
          expect.objectContaining({
            type: "contract",
            contractIds: [G_A],
          }),
        ],
      }),
    );
    const call = mockGetEvents.mock.calls[0][0] as {
      filters: Array<{ contractIds: string[] }>;
    };
    expect(call.filters[0].contractIds).not.toContain(G_B);
    expect(call.filters[0].contractIds).not.toContain(
      "CENVGLOBALGOVERNORXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    );
  });

  it("decodeProposalEvent rejects events from another Governor", () => {
    const foreign = decodeProposalEvent(
      {
        type: "contract",
        contractId: G_B,
        topic: [
          xdr.ScVal.scvSymbol("proposal_created"),
          xdr.ScVal.scvBytes(Buffer.from(PROPOSAL_HEX, "hex")),
          Address.fromString(VOTER).toScVal(),
        ],
        value: xdr.ScVal.scvVec([
          xdr.ScVal.scvVec([]),
          xdr.ScVal.scvVec([]),
          xdr.ScVal.scvVec([]),
          xdr.ScVal.scvU32(1),
          xdr.ScVal.scvU32(2),
          xdr.ScVal.scvString("foreign"),
        ]),
      },
      { expectedContractId: G_A },
    );

    expect(foreign.ok).toBe(false);
    if (!foreign.ok) {
      expect(foreign.reason).toBe("contract-id-mismatch");
    }

    const own = decodeProposalEvent(
      {
        type: "contract",
        contractId: G_A,
        topic: [
          xdr.ScVal.scvSymbol("proposal_created"),
          xdr.ScVal.scvBytes(Buffer.from(PROPOSAL_HEX, "hex")),
          Address.fromString(VOTER).toScVal(),
        ],
        value: xdr.ScVal.scvVec([
          xdr.ScVal.scvVec([]),
          xdr.ScVal.scvVec([]),
          xdr.ScVal.scvVec([]),
          xdr.ScVal.scvU32(1),
          xdr.ScVal.scvU32(2),
          xdr.ScVal.scvString("own"),
        ]),
      },
      { expectedContractId: G_A },
    );
    expect(own.ok).toBe(true);
  });

  it("dedupe identities G_A|id and G_B|id remain distinct", () => {
    const a = summary(G_A);
    const b = summary(G_B);

    expect(proposalRowIdentity(a)).toBe(`${G_A}|${PROPOSAL_HEX}`);
    expect(proposalRowIdentity(b)).toBe(`${G_B}|${PROPOSAL_HEX}`);
    expect(proposalRowIdentity(a)).not.toBe(proposalRowIdentity(b));

    const deduped = dedupeProposalSummaries([a, b]);
    expect(deduped).toHaveLength(2);
    expect(deduped.map((row) => row.governorContractId).sort()).toEqual(
      [G_A, G_B].sort(),
    );
  });

  it("fetchVoteTotals with G_A does not attribute G_B votes", async () => {
    mockScValToNative.mockReturnValue([1, BigInt(999), "from B"]);
    mockGetEvents.mockResolvedValueOnce({
      // Even if a buggy RPC returned a foreign event in the page, filtering
      // by contractIds: [G_A] is what we assert on the request; foreign
      // contract events must not be requested for G_A.
      events: [voteCastEvent(G_A)],
      latestLedger: 200,
    });

    const result = await fetchVoteTotals(PROPOSAL_HEX, G_A);

    expect(mockGetEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [
          {
            type: "contract",
            contractIds: [G_A],
          },
        ],
      }),
    );
    const call = mockGetEvents.mock.calls[0][0] as {
      filters: Array<{ contractIds: string[] }>;
    };
    expect(call.filters[0].contractIds).toEqual([G_A]);
    expect(call.filters[0].contractIds).not.toContain(G_B);

    expect(result.totals.for).toBe(BigInt(999));

    // Second call scoped to G_B must query G_B only and not reuse G_A totals.
    mockScValToNative.mockReturnValue([1, BigInt(42), "from B"]);
    mockGetEvents.mockResolvedValueOnce({
      events: [voteCastEvent(G_B)],
      latestLedger: 200,
    });

    const resultB = await fetchVoteTotals(PROPOSAL_HEX, G_B);
    expect(mockGetEvents).toHaveBeenLastCalledWith(
      expect.objectContaining({
        filters: [
          {
            type: "contract",
            contractIds: [G_B],
          },
        ],
      }),
    );
    expect(resultB.totals.for).toBe(BigInt(42));
    expect(resultB.totals.for).not.toBe(result.totals.for);
  });
});
