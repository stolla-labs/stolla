import { describe, expect, it, vi } from "vitest";
import {
  buildPrivilegedAlertPayload,
  dispatchPrivilegedAlerts,
  type PrivilegedContractEvent,
} from "./privilegedActions";

const FIXTURE_EVENTS: PrivilegedContractEvent[] = [
  {
    topic: "action_queued",
    contractId: "CTIMELOCK123",
    ledger: 1200,
    actionId: "0xact1",
    proposalId: "0xprop1",
    etaLedger: 35760,
    expiresAtLedger: 156720,
  },
  {
    topic: "action_executed",
    contractId: "CTIMELOCK123",
    ledger: 36000,
    actionId: "0xact1",
    proposalId: "0xprop1",
    actor: "GEXECUTOR123",
  },
  {
    topic: "action_cancelled",
    contractId: "CTIMELOCK123",
    ledger: 2000,
    actionId: "0xact2",
    proposalId: "0xprop2",
    actor: "GGUARDIAN123",
    reasonHash: "0xreason",
  },
  {
    topic: "treasury_payment",
    contractId: "CTREASURY123",
    ledger: 36000,
    actionId: "0xact1",
    asset: "USDC",
    recipient: "GRECIPIENT123",
    amount: "500000000",
    reference: "grant-milestone-1",
  },
  {
    topic: "deposited",
    contractId: "CTREASURY123",
    ledger: 1000,
  },
];

describe("Privileged Timelock & Treasury alerts (#404)", () => {
  it("produces structured alert payloads for queue, execute, cancel, and treasury_payment fixtures", () => {
    const payloads = FIXTURE_EVENTS.map(buildPrivilegedAlertPayload).filter(
      Boolean,
    );
    expect(payloads).toHaveLength(4);
    expect(payloads.map((p) => p!.eventType)).toEqual([
      "action_queued",
      "action_executed",
      "action_cancelled",
      "treasury_payment",
    ]);
    expect(payloads[3]).toMatchObject({
      schemaVersion: 1,
      eventType: "treasury_payment",
      severity: "critical",
      details: {
        asset: "USDC",
        recipient: "GRECIPIENT123",
        amount: "500000000",
      },
    });
  });

  it("fails soft in log-only mode when webhook config is missing", async () => {
    const logs: string[] = [];
    const fetchSpy = vi.fn();

    const result = await dispatchPrivilegedAlerts(FIXTURE_EVENTS, {
      webhookUrl: "",
      log: (line) => logs.push(line),
      fetchImpl: fetchSpy as unknown as typeof fetch,
    });

    expect(result.mode).toBe("log_only");
    expect(result.delivered).toBe(4);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(logs).toHaveLength(4);
    expect(logs[0]).toContain("[privileged-alert][log-only]");
  });

  it("delivers alert payloads to a configured webhook sink", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    const result = await dispatchPrivilegedAlerts(FIXTURE_EVENTS.slice(0, 2), {
      webhookUrl: "https://hooks.example.com/alerts",
      log: () => {},
      fetchImpl: fetchSpy as unknown as typeof fetch,
    });

    expect(result.mode).toBe("webhook");
    expect(result.delivered).toBe(2);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
