import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildPrivilegedAlert,
  indexPrivilegedAlerts,
} from "./timelock-treasury-alerts.mjs";

const scriptPath = fileURLToPath(
  new URL("./timelock-treasury-alerts.mjs", import.meta.url),
);

const FIXTURE_EVENTS = [
  {
    contractId: "CTIMELOCK111",
    ledger: 1500100,
    txHash: "1111111111111111111111111111111111111111111111111111111111111111",
    topics: ["action_queued", "act-001", "prop-001"],
    data: {
      governor: "CGOV111",
      queued_ledger: 1500100,
      earliest_ledger: 1534660,
      expiry_ledger: 1655620,
      batch_hash: "batch-hash-001",
    },
  },
  {
    contractId: "CTIMELOCK111",
    ledger: 1534700,
    txHash: "2222222222222222222222222222222222222222222222222222222222222222",
    topics: ["action_executed", "act-001", "prop-001"],
    data: {
      executor: "GEXECUTOR111",
      execution_ledger: 1534700,
      batch_hash: "batch-hash-001",
    },
  },
  {
    contractId: "CTIMELOCK111",
    ledger: 1500200,
    txHash: "3333333333333333333333333333333333333333333333333333333333333333",
    topics: ["action_cancelled", "act-002", "prop-002"],
    data: {
      guardian: "GGUARDIAN111",
      cancellation_ledger: 1500200,
      reason_hash: "reason-002",
    },
  },
  {
    contractId: "CTREASURY222",
    ledger: 1534700,
    txHash: "4444444444444444444444444444444444444444444444444444444444444444",
    topics: ["TreasuryPayment", "CASSET_USDC", "GRECIPIENT999"],
    data: {
      amount: "250000000",
      reference: "grant-milestone-1",
    },
  },
  {
    contractId: "CNFT333",
    ledger: 1500001,
    topics: ["mint", "GMEMBER1"],
    data: { token_id: 1 },
  },
];

function runAlertWorker(args = [], env = {}) {
  const childEnv = { ...process.env };
  delete childEnv.ALERT_WEBHOOK_URL;
  delete childEnv.ALERT_OUT_FILE;
  delete childEnv.ALERT_EVENTS_FILE;
  Object.assign(childEnv, env);

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      env: childEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test("indexPrivilegedAlerts normalizes Timelock queue/execute/cancel and Treasury spend events", () => {
  const alerts = indexPrivilegedAlerts(FIXTURE_EVENTS);
  assert.equal(alerts.length, 4);

  assert.equal(alerts[0].alertType, "TIMELOCK_QUEUED");
  assert.equal(alerts[0].details.action_id, "act-001");
  assert.equal(alerts[0].details.earliest_ledger, 1534660);

  assert.equal(alerts[1].alertType, "TIMELOCK_EXECUTED");
  assert.equal(alerts[1].details.executor, "GEXECUTOR111");

  assert.equal(alerts[2].alertType, "TIMELOCK_CANCELLED");
  assert.equal(alerts[2].severity, "critical");
  assert.equal(alerts[2].details.guardian, "GGUARDIAN111");

  assert.equal(alerts[3].alertType, "TREASURY_SPEND");
  assert.equal(alerts[3].details.asset, "CASSET_USDC");
  assert.equal(alerts[3].details.recipient, "GRECIPIENT999");
  assert.equal(alerts[3].details.amount, "250000000");

  assert.equal(buildPrivilegedAlert(FIXTURE_EVENTS[4]), null);
});

test("missing webhook config fails soft in log-only mode and writes optional file sink", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stolla-alerts-test-"));
  const eventsFile = path.join(tempDir, "events.json");
  const outFile = path.join(tempDir, "alerts.jsonl");

  try {
    fs.writeFileSync(eventsFile, JSON.stringify(FIXTURE_EVENTS), "utf8");

    const res = await runAlertWorker([
      "--events-file",
      eventsFile,
      "--out-file",
      outFile,
    ]);

    assert.equal(res.code, 0, `stderr: ${res.stderr}`);
    assert.match(
      res.stdout,
      /\[privileged-alert\] LOG_ONLY: ALERT_WEBHOOK_URL not configured/,
    );
    assert.match(res.stdout, /"alertType":"TIMELOCK_QUEUED"/);
    assert.match(res.stdout, /"alertType":"TIMELOCK_EXECUTED"/);
    assert.match(res.stdout, /"alertType":"TIMELOCK_CANCELLED"/);
    assert.match(res.stdout, /"alertType":"TREASURY_SPEND"/);

    const writtenLines = fs
      .readFileSync(outFile, "utf8")
      .trim()
      .split(/\r?\n/);
    assert.equal(writtenLines.length, 4);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("delivers alert payloads to configured webhook URL", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stolla-webhook-"));
  const eventsFile = path.join(tempDir, "events.json");
  const received = [];

  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      received.push(JSON.parse(body));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  try {
    fs.writeFileSync(
      eventsFile,
      JSON.stringify([FIXTURE_EVENTS[0], FIXTURE_EVENTS[3]]),
      "utf8",
    );

    const res = await runAlertWorker([
      "--events-file",
      eventsFile,
      "--webhook-url",
      `http://127.0.0.1:${port}/webhook`,
    ]);

    assert.equal(res.code, 0, `stderr: ${res.stderr}`);
    assert.equal(received.length, 2);
    assert.equal(received[0].alertType, "TIMELOCK_QUEUED");
    assert.equal(received[1].alertType, "TREASURY_SPEND");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
