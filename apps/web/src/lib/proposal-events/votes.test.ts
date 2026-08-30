import { describe, it, expect, vi, beforeEach } from "vitest";
import { Address, xdr } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";
import { fetchVoteTotals } from "./votes";

const GOVERNOR =
  "CDJZ4QTYXZ5YKHRXRBCOXQDZI5TUE5QLODC5IJFYDXQMQJFP5PFRMPHY";
const DEFAULT_PROPOSAL =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const VOTER = "GAZSOBEW6H374SOMTQIRC432JXTA4VPSG6P3ADA35TRQIYT3WTVQWFE5";

// vi.mock is hoisted – use vi.hoisted() so factory closures can reference them
const { mockScValToNative, mockGetEvents } = vi.hoisted(() => ({
  mockScValToNative: vi.fn(),
  mockGetEvents: vi.fn(),
}));

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();
  return {
    ...actual,
    scValToNative: mockScValToNative,
    rpc: {
      ...actual.rpc,
      Server: vi.fn(function (this: Record<string, unknown>) {
        this.getEvents = mockGetEvents;
      }),
    },
  };
});

vi.mock("../stellar", () => ({
  config: { rpcUrl: "https://soroban-testnet.stellar.org" },
  contractIds: {
    governor:
      "CDJZ4QTYXZ5YKHRXRBCOXQDZI5TUE5QLODC5IJFYDXQMQJFP5PFRMPHY",
  },
  requireGovernorStartLedger: () => 1000,
}));

vi.mock("../e2eMock", () => ({
  getE2EBridge: () => undefined,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal mock vote_cast event matching the shape the code expects. */
function makeEvent(
  id: string,
  options: { contractId?: string; proposalHex?: string } = {},
): Record<string, unknown> {
  const proposalHex = options.proposalHex ?? DEFAULT_PROPOSAL;
  return {
    id,
    type: "contract",
    ledger: 100,
    ledgerClosedAt: "2024-01-01T00:00:00Z",
    contractId: options.contractId ?? GOVERNOR,
    topic: [
      xdr.ScVal.scvSymbol("vote_cast"),
      Address.fromString(VOTER).toScVal(),
      xdr.ScVal.scvBytes(Buffer.from(proposalHex, "hex")),
    ],
    value: xdr.ScVal.scvVoid(),
    inSuccessfulContractCall: true,
  };
}

/** Set up a page of getEvents returning the given events with their native values. */
function setupPage(
  events: Array<{ id: string; native: [number, bigint, string] }>,
  cursor?: string,
) {
  for (const e of events) {
    mockScValToNative.mockReturnValueOnce(e.native);
  }
  mockGetEvents.mockResolvedValueOnce({
    events: events.map((e) => makeEvent(e.id)),
    latestLedger: 200,
    cursor,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("fetchVoteTotals", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("mixed weighted votes", () => {
    it("aggregates For, Against, and Abstain weights correctly", async () => {
      const proposalHex = DEFAULT_PROPOSAL;

      setupPage([
        { id: "1-0", native: [1, BigInt(100), "I support this"] },
        { id: "1-1", native: [0, BigInt(50), "Disagree"] },
        { id: "1-2", native: [2, BigInt(25), "Neutral"] },
        { id: "1-3", native: [1, BigInt(200), "Strongly support"] },
      ]);

      const result = await fetchVoteTotals(proposalHex);

      expect(result.totals).toEqual({
        for: BigInt(300),
        against: BigInt(50),
        abstain: BigInt(25),
        total: BigInt(375),
      });
      expect(result.incomplete).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it("uses bigint without precision loss for large weights", async () => {
      const proposalHex = DEFAULT_PROPOSAL;
      const hugeWeight = BigInt(340282366920938463463374607431768211455);

      setupPage([{ id: "1-0", native: [1, hugeWeight, ""] }]);

      const result = await fetchVoteTotals(proposalHex);

      expect(result.totals.for).toBe(hugeWeight);
      expect(typeof result.totals.for).toBe("bigint");
    });
  });

  describe("no votes", () => {
    it("returns zero totals when there are no events", async () => {
      mockGetEvents.mockResolvedValueOnce({
        events: [],
        latestLedger: 200,
      });

      const result = await fetchVoteTotals(DEFAULT_PROPOSAL);

      expect(result.totals).toEqual({
        for: BigInt(0),
        against: BigInt(0),
        abstain: BigInt(0),
        total: BigInt(0),
      });
      expect(result.incomplete).toBe(false);
    });
  });

  describe("unrelated events", () => {
    it("correctly aggregates only the events the RPC returns for the filtered proposal", async () => {
      setupPage([
        { id: "1-0", native: [1, BigInt(10), ""] },
        { id: "1-1", native: [1, BigInt(20), ""] },
      ]);

      const result = await fetchVoteTotals(DEFAULT_PROPOSAL);

      expect(result.totals.for).toBe(BigInt(30));
    });
  });

  describe("malformed events", () => {
    it("handles events where scValToNative throws by marking incomplete", async () => {
      const proposalHex = DEFAULT_PROPOSAL;

      mockScValToNative.mockImplementationOnce(() => {
        throw new Error("XDR decode failed");
      });
      mockScValToNative.mockReturnValueOnce([1, BigInt(200), ""]);

      mockGetEvents.mockResolvedValueOnce({
        events: [makeEvent("1-0"), makeEvent("1-1")],
        latestLedger: 200,
      });

      const result = await fetchVoteTotals(proposalHex);

      expect(result.totals.for).toBe(BigInt(200));
      expect(result.incomplete).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("handles unexpected vote types gracefully", async () => {
      setupPage([
        { id: "1-0", native: [1, BigInt(100), ""] },
        { id: "1-1", native: [3, BigInt(50), ""] },
        { id: "1-2", native: [99, BigInt(25), ""] },
      ]);

      const result = await fetchVoteTotals(DEFAULT_PROPOSAL);

      expect(result.totals.for).toBe(BigInt(100));
      expect(result.totals.against).toBe(BigInt(0));
      expect(result.totals.abstain).toBe(BigInt(0));
      expect(result.totals.total).toBe(BigInt(100));
    });
  });

  describe("deduplication", () => {
    it("deduplicates events by event ID", async () => {
      const proposalHex = DEFAULT_PROPOSAL;

      // Events: "1-0" appears twice (only first counted), "1-1" is new
      mockScValToNative.mockReturnValueOnce([1, BigInt(100), ""]);
      mockScValToNative.mockReturnValueOnce([0, BigInt(50), ""]);

      mockGetEvents.mockResolvedValueOnce({
        events: [
          makeEvent("1-0"),
          makeEvent("1-0"), // deduplicated — scValToNative NOT called
          makeEvent("1-1"),
        ],
        latestLedger: 200,
      });

      const result = await fetchVoteTotals(proposalHex);

      expect(mockScValToNative).toHaveBeenCalledTimes(2);
      expect(result.totals.for).toBe(BigInt(100));
      expect(result.totals.against).toBe(BigInt(50));
      expect(result.totals.total).toBe(BigInt(150));
    });
  });

  describe("RPC errors", () => {
    it("returns incomplete with error message when getEvents throws", async () => {
      mockGetEvents.mockRejectedValueOnce(new Error("Network timeout"));

      const result = await fetchVoteTotals(DEFAULT_PROPOSAL);

      expect(result.totals).toEqual({
        for: BigInt(0),
        against: BigInt(0),
        abstain: BigInt(0),
        total: BigInt(0),
      });
      expect(result.incomplete).toBe(true);
      expect(result.error).toBe("Network timeout");
    });

    it("handles non-Error thrown objects", async () => {
      mockGetEvents.mockRejectedValueOnce("string error");

      const result = await fetchVoteTotals(DEFAULT_PROPOSAL);

      expect(result.incomplete).toBe(true);
      expect(result.error).toBe("Failed to fetch vote events");
    });
  });

  describe("pagination", () => {
    it("aggregates votes across multiple pages", async () => {
      const proposalHex = DEFAULT_PROPOSAL;

      // Page 1: 100 For votes
      for (let i = 0; i < 100; i++) {
        mockScValToNative.mockReturnValueOnce([1, BigInt(1), ""]);
      }
      const page1Events = Array.from({ length: 100 }, (_, i) =>
        makeEvent(`1-${i}`),
      );
      mockGetEvents.mockResolvedValueOnce({
        events: page1Events,
        latestLedger: 200,
        cursor: "cursor-2",
      });

      // Page 2: 50 Against votes
      for (let i = 0; i < 50; i++) {
        mockScValToNative.mockReturnValueOnce([0, BigInt(1), ""]);
      }
      const page2Events = Array.from({ length: 50 }, (_, i) =>
        makeEvent(`2-${i}`),
      );
      mockGetEvents.mockResolvedValueOnce({
        events: page2Events,
        latestLedger: 200,
      });

      const result = await fetchVoteTotals(proposalHex);

      expect(result.totals.for).toBe(BigInt(100));
      expect(result.totals.against).toBe(BigInt(50));
      expect(result.totals.total).toBe(BigInt(150));
      expect(result.incomplete).toBe(false);
    });

    it("stops pagination when fewer than limit events returned", async () => {
      const proposalHex = DEFAULT_PROPOSAL;

      // 30 Abstain votes, weight 2 each
      for (let i = 0; i < 30; i++) {
        mockScValToNative.mockReturnValueOnce([2, BigInt(2), ""]);
      }
      const page1Events = Array.from({ length: 30 }, (_, i) =>
        makeEvent(`1-${i}`),
      );
      mockGetEvents.mockResolvedValueOnce({
        events: page1Events,
        latestLedger: 200,
      });

      const result = await fetchVoteTotals(proposalHex);

      expect(result.totals.abstain).toBe(BigInt(60));
      expect(mockGetEvents).toHaveBeenCalledTimes(1);
    });
  });
});
