import { describe, expect, it, vi } from "vitest";
import { clampEventStartLedger, resolveEventStartLedge, retentionErrorMessage } from "./retention";
import type { rpc } from "@stellar/stellar-sdk";

describe("event retention boundary", () => {
  it("keeps a configured ledger inside the window and clamps an older one", () => {
    expect(clampEventStartLedger(120, 100)).toEqual({ startLedger: 120, clamped: false });
    expect(clampEventStartLedger(100, 100)).toEqual({ startLedger: 100, clamped: false });
    expect(clampEventStartLedger(1, 100)).toEqual({ startLedger: 100, clamped: true });
  });

  it("uses a recent ledger query to read the RPC boundary", async () => {
    const server = {
      getLatestLedger: vi.fn().mockResolvedValue({ sequence: 200 }),
      serverURL: "https://test.rpc.url",
    } as unknown as rpc.Server;
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: { oldestLedger: 100 } }) });
    vi.stubGlobal("fetch", mockFetch);

    await expect(resolveEventStartLedger(server, 1)).resolves.toEqual({ startLedger: 100, clamped: true });
    expect(mockFetch).toHaveBeenCalledWith("https://test.rpc.url", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getLedgers", params: { startLedger: 200, pagination: { limit: 1 } } }),
    }));
  });

  it("maps a JSON-RPC retention error to actionable copy", () => {
    expect(retentionErrorMessage({
      code: -32600,
      message: "startLedger must be within the ledger range: 100 - 200",
    })).toMatch(/NEXT_PUBLIC_GOVERNOR_START_LEDGER.*RPC retention window|RPC retention window.*NEXT_PUBLIC_GOVERNOR_START_LEDGER/);
    expect(retentionErrorMessage({ code: -32600, message: "another invalid request" })).toBeNull();
  });
});
