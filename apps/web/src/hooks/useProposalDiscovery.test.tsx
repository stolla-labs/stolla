import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useProposalDiscovery } from "./useProposalDiscovery";

const { getEvents, getLatestLedger, mockFetch, requireStartLedger } = vi.hoisted(() => ({
  getEvents: vi.fn(),
  getLatestLedger: vi.fn(),
  mockFetch: vi.fn(),
  requireStartLedger: vi.fn(),
}));

vi.mock("@stellar/stellar-sdk/rpc", () => ({
  Server: vi.fn(function MockServer() {
    return { getEvents, getLatestLedger, serverURL: "https://test.rpc.url" };
  }),
}));

vi.mock("@/lib/stellar", () => ({
  config: { rpcUrl: "https://test.rpc.url" },
  requireContractIds: () => ({ governor: "CGOVERNOR" }),
  requireGovernorStartLedger: requireStartLedger,
}));

vi.mock("@/lib/e2eMock", () => ({ getE2EBridge: () => undefined }));

describe("useProposalDiscovery retention handling", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireStartLedger.mockReturnValue(1);
    getLatestLedger.mockResolvedValue({ sequence: 200 });
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ result: { oldestLedger: 100 } }) });
    vi.stubGlobal("fetch", mockFetch);
    getEvents.mockResolvedValue({ events: [], latestLedger: 200, cursor: "" });
  });

  it("labels a clamped scan as stale even when no events remain", async () => {
    const { result } = renderHook(() => useProposalDiscovery());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getEvents).toHaveBeenCalledWith(expect.objectContaining({ startLedger: 100 }));
    expect(result.current.error).toBeNull();
    expect(result.current.empty).toBe(false);
    expect(result.current.freshness.state).toBe("stale");
    expect(result.current.freshness.explanation).toMatch(/RPC retention window/);
  });

  it("shows actionable copy for a JSON-RPC retention error", async () => {
    getEvents.mockRejectedValue({ code: -32600, message: "startLedger must be within the ledger range: 101 - 200" });
    const { result } = renderHook(() => useProposalDiscovery());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toMatch(/NEXT_PUBLIC_GOVERNOR_START_LEDGER/);
    expect(result.current.error).toMatch(/RPC retention window/);
    expect(result.current.empty).toBe(false);
  });

  it("distinguishes a complete empty scan from a general RPC failure", async () => {
    requireStartLedger.mockReturnValue(100);
    const { result, rerender } = renderHook(() => useProposalDiscovery());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.empty).toBe(true);
    expect(result.current.error).toBeNull();

    getEvents.mockRejectedValue(new Error("RPC unavailable"));
    await result.current.refresh();
    rerender();
    expect(result.current.empty).toBe(false);
    expect(result.current.error).toBe("RPC unavailable");
  });

  it("reports missing configuration before any RPC request", async () => {
    requireStartLedger.mockImplementation(() => { throw new Error("Set NEXT_PUBLIC_GOVERNOR_START_LEDGER."); });
    const { result } = renderHook(() => useProposalDiscovery());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toMatch(/NEXT_PUBLIC_GOVERNOR_START_LEDGER/);
    expect(getLatestLedger).not.toHaveBeenCalled();
    expect(getEvents).not.toHaveBeenCalled();
  });
});
