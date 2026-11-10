export type PrivilegedEventTopic =
  | "action_queued"
  | "action_executed"
  | "action_cancelled"
  | "treasury_payment";

export type PrivilegedContractEvent = {
  topic: PrivilegedEventTopic | string;
  contractId: string;
  ledger: number;
  txHash?: string;
  actionId?: string;
  proposalId?: string;
  actor?: string;
  etaLedger?: number;
  expiresAtLedger?: number;
  reasonHash?: string;
  asset?: string;
  recipient?: string;
  amount?: string;
  reference?: string;
};

export type PrivilegedAlertPayload = {
  schemaVersion: 1;
  eventType: PrivilegedEventTopic;
  severity: "warning" | "critical";
  contractId: string;
  ledger: number;
  txHash: string | null;
  actionId: string | null;
  proposalId: string | null;
  summary: string;
  details: Record<string, unknown>;
};

const PRIVILEGED_TOPICS = new Set<PrivilegedEventTopic>([
  "action_queued",
  "action_executed",
  "action_cancelled",
  "treasury_payment",
]);

export function isPrivilegedEventTopic(
  topic: string,
): topic is PrivilegedEventTopic {
  return PRIVILEGED_TOPICS.has(topic as PrivilegedEventTopic);
}

/**
 * Converts a raw Timelock or Treasury event into a structured alert payload (#404).
 * Returns `null` for non-privileged events.
 */
export function buildPrivilegedAlertPayload(
  event: PrivilegedContractEvent,
): PrivilegedAlertPayload | null {
  if (!isPrivilegedEventTopic(event.topic)) {
    return null;
  }

  const base = {
    schemaVersion: 1 as const,
    eventType: event.topic,
    contractId: event.contractId,
    ledger: event.ledger,
    txHash: event.txHash ?? null,
    actionId: event.actionId ?? null,
    proposalId: event.proposalId ?? null,
  };

  switch (event.topic) {
    case "action_queued":
      return {
        ...base,
        severity: "warning",
        summary: `Timelock queued action ${event.actionId ?? "unknown"} for proposal ${event.proposalId ?? "unknown"} at ledger ${event.ledger}`,
        details: {
          etaLedger: event.etaLedger ?? null,
          expiresAtLedger: event.expiresAtLedger ?? null,
          actor: event.actor ?? null,
        },
      };
    case "action_executed":
      return {
        ...base,
        severity: "critical",
        summary: `Timelock executed action ${event.actionId ?? "unknown"} for proposal ${event.proposalId ?? "unknown"} at ledger ${event.ledger}`,
        details: {
          executor: event.actor ?? null,
        },
      };
    case "action_cancelled":
      return {
        ...base,
        severity: "warning",
        summary: `Timelock cancelled action ${event.actionId ?? "unknown"} at ledger ${event.ledger}`,
        details: {
          cancelledBy: event.actor ?? null,
          reasonHash: event.reasonHash ?? null,
        },
      };
    case "treasury_payment":
      return {
        ...base,
        severity: "critical",
        summary: `Treasury paid ${event.amount ?? "0"} ${event.asset ?? "unknown"} to ${event.recipient ?? "unknown"} at ledger ${event.ledger}`,
        details: {
          asset: event.asset ?? null,
          recipient: event.recipient ?? null,
          amount: event.amount ?? null,
          reference: event.reference ?? null,
        },
      };
  }
}

export type AlertSinkOptions = {
  webhookUrl?: string | null;
  log?: (line: string) => void;
  fetchImpl?: typeof fetch;
};

export type AlertDispatchResult = {
  mode: "webhook" | "log_only";
  delivered: number;
  alerts: PrivilegedAlertPayload[];
};

/**
 * Processes a batch of contract events, emitting structured alerts.
 * Missing `webhookUrl` fails soft in `log_only` mode (#404).
 */
export async function dispatchPrivilegedAlerts(
  events: PrivilegedContractEvent[],
  options: AlertSinkOptions = {},
): Promise<AlertDispatchResult> {
  const log = options.log ?? console.log;
  const fetchImpl = options.fetchImpl ?? fetch;
  const webhookUrl = options.webhookUrl?.trim() || "";

  const alerts = events
    .map(buildPrivilegedAlertPayload)
    .filter((item): item is PrivilegedAlertPayload => item !== null);

  if (!webhookUrl) {
    for (const alert of alerts) {
      log(`[privileged-alert][log-only] ${JSON.stringify(alert)}`);
    }
    return {
      mode: "log_only",
      delivered: alerts.length,
      alerts,
    };
  }

  let delivered = 0;
  for (const alert of alerts) {
    log(`[privileged-alert][webhook] ${JSON.stringify(alert)}`);
    try {
      const response = await fetchImpl(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(alert),
      });
      if (response.ok) {
        delivered += 1;
      } else {
        log(
          `[privileged-alert][webhook-warn] HTTP ${response.status} delivering ${alert.eventType}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`[privileged-alert][webhook-warn] ${message}`);
    }
  }

  return {
    mode: "webhook",
    delivered,
    alerts,
  };
}
