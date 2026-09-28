import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProposalEvents } from "./query";

const GOVERNOR = "C123456789";

const { mockGetEvents, mockGetLatestLedger, mockFetch, mockServerConstructor } = vi.hoisted(() => {
  const getEvents = vi.fn();
  const getLatestLedger = vi.fn();
  const fetch = vi.fn();
  const serverConstructor = vi.fn(function MockServer() {
    return { getEvents, getLatestLedger, serverURL: "https://test.rpc.url" };
  });

  return {
    mockGetEvents: getEvents,
    mockGetLatestLedger: getLatestLedger,
    mockFetch: fetch,
    mockServerConstructor: serverConstructor,
  };
});

vi.mock("@stellar/stellar-sdk", async () => {
  const actual = await vi.importActual<typeof import("@stellar/stellar-sdk")>(
    "@stellar/stellar-sdk",
  );

  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      Server: mockServerConstructor,
    },
  };
});

vi.mock("../stellar", () => ({
  config: {
    rpcUrl: "https://test.rpc.url",
  },
  requireGovernorStartLedger: () => 12345,
}));

describe("getProposalEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLatestLedger.mockResolvedValue({ sequence: 20000 });
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ result: { oldestLedger: 10000 } }) });
    vi.stubGlobal("fetch", mockFetch);
  });

  it("throws if governor contract ID is not configured", async () => {
    await expect(getProposalEvents("")).rejects.toThrow(
      "Governor contract ID is not configured. Set NEXT_PUBLIC_GOVERNOR_CONTRACT_ID.",
    );
  });

  it("calls getEvents with the explicit governor and configured start ledger", async () => {
    mockGetEvents.mockResolvedValue({
      events: [],
      latestLedger: 456,
      cursor: "nextCursor",
    });
    await getProposalEvents(GOVERNOR);

    expect(mockServerConstructor).toHaveBeenCalledWith(
      "https://test.rpc.url",
      { allowHttp: false },
    );
    expect(mockGetEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        startLedger: 12345,
        filters: [
          {
            type: "contract",
            contractIds: [GOVERNOR],
            topics: [
              ["AAAADwAAABBwcm9wb3NhbF9jcmVhdGVk"],
              ["AAAADwAAABFwcm9wb3NhbF9leGVjdXRlZAAAAA=="],
              ["AAAADwAAABJwcm9wb3NhbF9jYW5jZWxsZWQAAA=="],
              ["AAAADwAAAAl2b3RlX2Nhc3QAAAA="],
            ],
          },
        ],
        limit: 10,
      }),
    );
    expect(mockGetEvents).toHaveBeenCalledTimes(1);
  });

  it("clamps the first page to the RPC retention boundary", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ result: { oldestLedger: 15000 } }) });
    mockGetEvents.mockResolvedValue({ events: [], latestLedger: 20000, cursor: "" });

    await getProposalEvents(GOVERNOR);

    expect(mockGetEvents).toHaveBeenCalledWith(expect.objectContaining({ startLedger: 15000 }));
  });

  it("uses only the cursor for a later page", async () => {
    mockGetEvents.mockResolvedValue({ events: [], latestLedger: 20000, cursor: "next" });

    await getProposalEvents(GOVERNOR, "cursor123");

    expect(mockGetEvents).toHaveBeenCalledWith(expect.objectContaining({ cursor: "cursor123" }));
    expect(mockGetEvents.mock.calls[0][0]).not.toHaveProperty("startLedger");
    expect(mockGetLatestLedger).not.toHaveBeenCalled();
  });

  it("returns events, latestLedger, and cursor", async () => {
    const mockResponse = {
      events: [
        { topic: ["proposal_created"], data: "data1" },
        { topic: ["vote_cast"], data: "data2" },
      ],
      latestLedger: 456,
      cursor: "nextCursor",
    };
    mockGetEvents.mockResolvedValue(mockResponse);

    const result = await getProposalEvents(GOVERNOR);

    expect(result.events).toHaveLength(2);
    expect(result.events[0].topic[0]).toBe("proposal_created");
    expect(result.latestLedger).toBe(456);
    expect(result.cursor).toBe("nextCursor");
  });

  it("handles empty events array from RPC", async () => {
    const mockResponse = {
      events: [],
      latestLedger: 101,
      cursor: "cursor101",
    };
    mockGetEvents.mockResolvedValue(mockResponse);

    const result = await getProposalEvents(GOVERNOR);

    expect(result.events).toHaveLength(0);
    expect(result.latestLedger).toBe(101);
    expect(result.cursor).toBe("cursor101");
  });

  it("handles undefined events array from RPC", async () => {
    const mockResponse = {
      latestLedger: 102,
      cursor: "cursor102",
    };
    mockGetEvents.mockResolvedValue(mockResponse);

    const result = await getProposalEvents(GOVERNOR);

    expect(result.events).toHaveLength(0);
    expect(result.latestLedger).toBe(102);
    expect(result.cursor).toBe("cursor102");
  });

  it("normalizes RPC failures", async () => {
    mockGetEvents.mockRejectedValue(new Error("startLedger is invalid"));

    await expect(getProposalEvents(GOVERNOR)).rejects.toThrow(
      "Failed to query governor proposal events: startLedger is invalid",
    );
  });
});
