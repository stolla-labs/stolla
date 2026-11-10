#!/usr/bin/env node
import fs from "node:fs";

const PRIVILEGED_TOPICS = new Set([
  "action_queued",
  "action_executed",
  "action_cancelled",
  "treasury_payment",
]);

function toAlertPayload(event) {
  if (!event || !PRIVILEGED_TOPICS.has(event.topic)) return null;
  const severity =
    event.topic === "action_executed" || event.topic === "treasury_payment"
      ? "critical"
      : "warning";
  return {
    schemaVersion: 1,
    eventType: event.topic,
    severity,
    contractId: event.contractId ?? "unknown",
    ledger: Number(event.ledger ?? 0),
    txHash: event.txHash ?? null,
    actionId: event.actionId ?? null,
    proposalId: event.proposalId ?? null,
    summary: `[${event.topic}] contract=${event.contractId ?? "unknown"} ledger=${event.ledger ?? 0}`,
    details: event,
  };
}

export async function runAlertWorker({
  eventsFile = process.env.PRIVILEGED_EVENTS_FILE || "",
  webhookUrl = process.env.PRIVILEGED_ALERT_WEBHOOK_URL || "",
  stdout = console.log,
} = {}) {
  const rawEvents = eventsFile
    ? JSON.parse(fs.readFileSync(eventsFile, "utf8"))
    : [];
  const alerts = (Array.isArray(rawEvents) ? rawEvents : [])
    .map(toAlertPayload)
    .filter(Boolean);

  if (!webhookUrl.trim()) {
    stdout(
      "[privileged-alert] webhook not configured; running in log-only mode",
    );
    for (const alert of alerts) {
      stdout(`[privileged-alert][log-only] ${JSON.stringify(alert)}`);
    }
    return { mode: "log_only", count: alerts.length, alerts };
  }

  for (const alert of alerts) {
    stdout(`[privileged-alert][webhook] ${JSON.stringify(alert)}`);
    await fetch(webhookUrl.trim(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(alert),
    });
  }
  return { mode: "webhook", count: alerts.length, alerts };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runAlertWorker();
}
