import type { rpc } from  @stellar/stellar-sdk";

export type DiscoveryFailureKind =
  | "configuration"
  | "retention"
  | "rpc"
  | "decode";

export type DiscoveryFailure = {
  kind: DiscoveryFailureKind;
  /** Stable, actionable sentence safe to render in the UI. */
  message: string;
  /** Raw underlying message for debugging/logging. */
  cause?: unknown;
};

const RETENTION_COPY =
  "Proposal history could not be scanned because the start ledger is outside the RPC retention window. Check NEXT_PUBLIC_GOVERNOR_START_LEDGER, or use an indexer for older history.";

const CONFIGURATION_COPY =
  "Proposal discovery is not configured: set NEXT_PUBLIC_GOVERNOR_START_LEDGER to a recent ledger within the RPC retention window.";

const DROPPING_CONFIG_PATTERN =
  /NEXT_PUBLIC_GOVERNOR_START_LEDGER|GOVERNOR_START_LEDGER|start ledger/i;

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
)
{
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

/** The SDK throws JSON-RPC errors as plain { code, message } objects. */
export function retentionErrorMessage(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const rpcError = error as { code?: unknown; message?: unknown };
  if (
    rpcError.code !== -32600 ||
    typeof rpcError.message !== "string" ||
    !/startLedger.*(?:ledger range|oldest|latest|retention)/i.test(rpcError.message)
  ) {
    return null;
  }
  return RETENTION_COPY;
}

/** Map any discovery failure to a typed, actionable error. */
export function mapDiscoveryError(error: unknown): DiscoveryFailure {
  const retention = retentionErrorMessage(error);
  if (retention) {
    return { kind: "retention", message: retention, cause: error };
  }

  if (error instanceof Error) {
    if (DROPPING_CONFIG_PATTERN.test(error.message)) {
      return { kind: "configuration", message: CONFIGURATION_COPY, cause: error };
    }
    return { kind: "rpc", message: error.message, cause: error };
  }

  if (typeof error === "object" && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) {
      if (DROPPING_CONFIG_PATTERN.test(message)) {
        return { kind: "configuration", message: CONFIGURATION_COPY, cause: error };
      }
      return { kind: "rpc", message, cause: error };
    }
  }

  return {
    kind: "rpc",
    message: "Proposal history could not be loaded from the RPC. Retry in a moment.",
    cause: error,
  };
}
