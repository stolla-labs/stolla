#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PRIVILEGED_EVENT_KINDS = Object.freeze({
  action_queued: {
    source: "CommunityTimelock",
    alertType: "TIMELOCK_QUEUED",
    severity: "warning",
  },
  action_executed: {
    source: "CommunityTimelock",
    alertType: "TIMELOCK_EXECUTED",
    severity: "high",
  },
  action_cancelled: {
    source: "CommunityTimelock",
    alertType: "TIMELOCK_CANCELLED",
    severity: "critical",
  },
  action_expired: {
    source: "CommunityTimelock",
    alertType: "TIMELOCK_EXPIRED",
    severity: "info",
  },
  treasury_payment: {
    source: "CommunityTreasury",
    alertType: "TREASURY_SPEND",
    severity: "high",
  },
  policy_changed: {
    source: "CommunityTreasury",
    alertType: "TREASURY_POLICY_CHANGED",
    severity: "critical",
  },
  recipient_changed: {
    source: "CommunityTreasury",
    alertType: "TREASURY_RECIPIENT_CHANGED",
    severity: "warning",
  },
});

function printHelp() {
  console.log(`Usage: timelock-treasury-alerts.mjs [OPTIONS]

Index and emit alerts for privileged CommunityTimelock and CommunityTreasury events.

Options:
  --events-file PATH      Read JSON array of Soroban/indexed events from file
  --rpc-url URL           Poll Soroban RPC getEvents endpoint
  --contracts IDS         Comma-separated Timelock/Treasury contract IDs for RPC polling
  --start-ledger NUM      Start ledger sequence for RPC getEvents (default: 1)
  --webhook-url URL       Alert webhook URL (or ALERT_WEBHOOK_URL env; soft log-only if unset)
  --out-file PATH         Optional JSONL file sink to append normalized alert payloads
  -h, --help              Show this help message`);
}

function normalizeEventKey(rawName) {
  return String(rawName ?? "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
}

export function buildPrivilegedAlert(rawEvent) {
  if (!rawEvent || typeof rawEvent !== "object") {
    return null;
  }

  const topics = Array.isArray(rawEvent.topics)
    ? rawEvent.topics
    : Array.isArray(rawEvent.topic)
      ? rawEvent.topic
      : [];
  const rawType =
    rawEvent.eventType ?? rawEvent.name ?? rawEvent.type ?? topics[0] ?? "";
  const normalizedKey = normalizeEventKey(rawType);
  const spec = PRIVILEGED_EVENT_KINDS[normalizedKey];

  if (!spec) {
    return null;
  }

  const data =
    rawEvent.data && typeof rawEvent.data === "object"
      ? rawEvent.data
      : rawEvent.value && typeof rawEvent.value === "object"
        ? rawEvent.value
        : {};
  const contractId = String(rawEvent.contractId ?? rawEvent.contract ?? "unknown");
  const ledger = Number(rawEvent.ledger ?? rawEvent.ledgerSequence ?? 0);
  const txHash = String(rawEvent.txHash ?? rawEvent.transactionHash ?? "");

  let details = { ...data };
  let summary = `${spec.alertType} on ${contractId} at ledger ${ledger}`;

  if (normalizedKey === "action_queued") {
    const actionId = data.action_id ?? topics[1] ?? "unknown";
    const proposalId = data.proposal_id ?? topics[2] ?? "unknown";
    details = {
      action_id: actionId,
      proposal_id: proposalId,
      governor: data.governor ?? null,
      queued_ledger: data.queued_ledger ?? ledger,
      earliest_ledger: data.earliest_ledger ?? null,
      expiry_ledger: data.expiry_ledger ?? null,
      batch_hash: data.batch_hash ?? null,
    };
    summary = `Timelock queued action ${actionId} (proposal ${proposalId}, ETA ledger ${details.earliest_ledger})`;
  } else if (normalizedKey === "action_executed") {
    const actionId = data.action_id ?? topics[1] ?? "unknown";
    const proposalId = data.proposal_id ?? topics[2] ?? "unknown";
    details = {
      action_id: actionId,
      proposal_id: proposalId,
      executor: data.executor ?? null,
      execution_ledger: data.execution_ledger ?? ledger,
      batch_hash: data.batch_hash ?? null,
    };
    summary = `Timelock executed action ${actionId} by ${details.executor ?? "unknown"}`;
  } else if (normalizedKey === "action_cancelled") {
    const actionId = data.action_id ?? topics[1] ?? "unknown";
    const proposalId = data.proposal_id ?? topics[2] ?? "unknown";
    details = {
      action_id: actionId,
      proposal_id: proposalId,
      guardian: data.guardian ?? null,
      cancellation_ledger: data.cancellation_ledger ?? ledger,
      reason_hash: data.reason_hash ?? null,
    };
    summary = `Timelock cancelled action ${actionId} by guardian ${details.guardian ?? "unknown"}`;
  } else if (normalizedKey === "treasury_payment") {
    const asset = data.asset ?? topics[1] ?? "unknown";
    const recipient = data.recipient ?? topics[2] ?? "unknown";
    const amount = String(data.amount ?? "0");
    details = {
      asset,
      recipient,
      amount,
      reference: data.reference ?? null,
    };
    summary = `Treasury spent ${amount} of ${asset} to ${recipient}`;
  }

  return {
    schemaVersion: 1,
    source: spec.source,
    eventKind: normalizedKey,
    alertType: spec.alertType,
    severity: spec.severity,
    contractId,
    ledger,
    txHash,
    summary,
    details,
  };
}

export function indexPrivilegedAlerts(events) {
  if (!Array.isArray(events)) {
    return [];
  }
  return events.map((event) => buildPrivilegedAlert(event)).filter(Boolean);
}

async function fetchEventsFromRpc({ rpcUrl, contractIds, startLedger }) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getEvents",
      params: {
        startLedger,
        filters:
          contractIds.length > 0
            ? [{ type: "contract", contractIds }]
            : [{ type: "contract" }],
        pagination: { limit: 100 },
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`RPC getEvents returned HTTP ${response.status}`);
  }
  const body = await response.json();
  return Array.isArray(body?.result?.events) ? body.result.events : [];
}

async function main() {
  const argv = process.argv.slice(2);
  let eventsFile = process.env.ALERT_EVENTS_FILE?.trim() || "";
  let rpcUrl =
    process.env.NEXT_PUBLIC_STELLAR_RPC_URL?.trim() ||
    "https://soroban-testnet.stellar.org";
  let contractsRaw = process.env.ALERT_CONTRACT_IDS?.trim() || "";
  let startLedger = Number(process.env.ALERT_START_LEDGER || 1);
  let webhookUrl = process.env.ALERT_WEBHOOK_URL?.trim() || "";
  let outFile = process.env.ALERT_OUT_FILE?.trim() || "";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      printHelp();
      return;
    } else if (arg === "--events-file") {
      eventsFile = argv[i + 1] ?? "";
      i += 1;
    } else if (arg === "--rpc-url") {
      rpcUrl = argv[i + 1] ?? "";
      i += 1;
    } else if (arg === "--contracts") {
      contractsRaw = argv[i + 1] ?? "";
      i += 1;
    } else if (arg === "--start-ledger") {
      startLedger = Number(argv[i + 1] ?? 1);
      i += 1;
    } else if (arg === "--webhook-url") {
      webhookUrl = argv[i + 1] ?? "";
      i += 1;
    } else if (arg === "--out-file") {
      outFile = argv[i + 1] ?? "";
      i += 1;
    } else {
      console.error(`[privileged-alert] ARGUMENT_ERROR: unknown option "${arg}"`);
      process.exitCode = 1;
      return;
    }
  }

  let rawEvents = [];
  if (eventsFile) {
    const content = fs.readFileSync(eventsFile, "utf8");
    const parsed = JSON.parse(content);
    rawEvents = Array.isArray(parsed) ? parsed : (parsed.events ?? []);
  } else {
    const contractIds = contractsRaw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    rawEvents = await fetchEventsFromRpc({
      rpcUrl,
      contractIds,
      startLedger,
    });
  }

  const alerts = indexPrivilegedAlerts(rawEvents);

  if (!webhookUrl) {
    console.log(
      "[privileged-alert] LOG_ONLY: ALERT_WEBHOOK_URL not configured; emitting alerts to stdout",
    );
  }

  for (const alert of alerts) {
    const line = JSON.stringify(alert);
    console.log(`[privileged-alert] ALERT ${line}`);

    if (outFile) {
      fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
      fs.appendFileSync(outFile, `${line}\n`, "utf8");
    }

    if (webhookUrl) {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: line,
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        console.error(
          `[privileged-alert] WEBHOOK_ERROR: received HTTP ${response.status}`,
        );
        process.exitCode = 1;
        return;
      }
    }
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  await main();
}
