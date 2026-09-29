import type { rpc } from "@stellar/stellar-sdk";
import { mapDiscoveryError } from "./discovery-errors";

/** Resolve the first event page against the RPC's current retention boundary. */
export function clampEventStartLedger(configured: number, oldest: number | undefined) {
  if (typeof oldest !== "number" || !Number.isSafeInteger(oldest) || oldest < 1) {
    throw new Error("RPC did not report a valid oldest retained ledger.");
  }
  return {
    startLedger: Math.max(configured, oldest),
    clamped: configured < oldest,
  };
}

export async function resolveEventStartLedger(
  server: Pick<rpc.Server, "getLatestLedger" | "serverURL">,
  configured: number,
) {
  // getEvents omits oldestLedger, and this SDK does not wrap getLedgers.
  // Request the current ledger so the metadata query is within retention.
  const { sequence } = await server.getLatestLedger();
  const response = await fetch(server.serverURL.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getLedgers",
      params: { startLedger: sequence, pagination: { limit: 1 } },
    }),
  });
  if (!response.ok) throw new Error("RPC could not report its event retention window.");
  const payload = await response.json() as {
    result?: { oldestLedger?: number };
    error?: { code?: number; message?: string };
  };
  if (payload.error) throw payload.error;
  const oldestLedger = payload.result?.oldestLedger;
  return clampEventStartLedger(configured, oldestLedger);
}

/**
 * Return a stable, actionable message when the error is a JSON-RPC
 * retention-window failure. Other errors return null so callers can fall
 * back to their own mapping.
 */
export function retentionErrorMessage(error: unknown): string | null {
  const mapped = mapDiscoveryError(error);
  return mapped.kind === "retention_error" ? mapped.message : null;
}
