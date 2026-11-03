"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { LiveStatus } from "@/components/ui/LiveStatus";
import { Skeleton } from "@/components/ui/Skeleton";
import { MAINNET_RUNBOOK_PATH, type HealthGate } from "@/lib/network";

const RUNBOOK_BASE_URL = `https://github.com/stolla-labs/stolla/blob/main/${MAINNET_RUNBOOK_PATH}`;

interface HealthPayload {
  healthy?: boolean;
  status: "ok" | "healthy" | "degraded" | "unhealthy";
  gates: HealthGate[];
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; payload: HealthPayload };

async function fetchHealth(): Promise<HealthPayload> {
  const response = await fetch("/api/health", { cache: "no-store" });
  const payload = (await response.json()) as HealthPayload;
  if (!response.ok && !Array.isArray(payload?.gates)) {
    throw new Error(`Health check returned HTTP ${response.status} with no readable gates.`);
  }
  return payload;
}

function GateRow({ gate }: { gate: HealthGate }) {
  return (
    <li
      className={`rounded-lg border p-4 ${
        gate.available ? "border-slate-800 bg-[#151b2b]" : "border-amber-800/70 bg-amber-950/20"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-medium text-slate-100">
          <span
            aria-hidden="true"
            className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              gate.available ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
            }`}
          >
            {gate.available ? "✓" : "!"}
          </span>
          {gate.label}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
            gate.available ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"
          }`}
        >
          {gate.available ? "Pass" : "Fail"}
        </span>
      </div>
      {!gate.available && gate.reason ? (
        <p role="alert" className="mt-2 text-sm text-amber-200">
          {gate.reason}
          {gate.requiredEnvironment.length > 0 ? (
            <span className="mt-1 block font-mono text-xs text-amber-300">
              Set: {gate.requiredEnvironment.join(", ")}
            </span>
          ) : null}
        </p>
      ) : null}
      <a
        className="mt-2 inline-block text-sm text-indigo-300 underline hover:text-indigo-200"
        href={`${RUNBOOK_BASE_URL}#${gate.runbookAnchor}`}
      >
        Open runbook section
      </a>
    </li>
  );
}

export default function MainnetReadinessPage() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const enabled = process.env.NEXT_PUBLIC_SHOW_READINESS === "1";

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    // Deferred a microtask so this reset never lands synchronously within
    // the effect itself (react-hooks/set-state-in-effect).
    queueMicrotask(() => {
      if (active) setState({ status: "loading" });
    });

    fetchHealth()
      .then((payload) => {
        if (active) setState({ status: "loaded", payload });
      })
      .catch((cause: unknown) => {
        if (active) {
          setState({
            status: "error",
            message: cause instanceof Error ? cause.message : "The health endpoint could not be reached.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [enabled]);

  if (!enabled) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-100">Mainnet readiness</h1>
      <p className="mt-2 text-sm text-slate-400">
        Live pass/fail per capability, read from <code className="font-mono">/api/health</code> and the current
        environment. Mirrors the gates in{" "}
        <a className="text-indigo-300 underline hover:text-indigo-200" href={RUNBOOK_BASE_URL}>
          the testnet-to-mainnet runbook
        </a>
        .
      </p>
      <p className="mt-2 text-sm text-slate-500">
        This page is read-only. Mainnet writes stay gated independently by{" "}
        <code className="font-mono">NEXT_PUBLIC_ALLOW_MAINNET_WRITES</code> — nothing on this page changes that.
      </p>

      <LiveStatus className="sr-only">
        {state.status === "loading"
          ? "Loading readiness gates…"
          : state.status === "error"
            ? `Readiness check failed: ${state.message}`
            : `Readiness gates loaded. Overall status ${state.payload.status}.`}
      </LiveStatus>

      {state.status === "loading" ? (
        <div className="mt-6 space-y-2" aria-hidden="true">
          <Skeleton variant="shimmer" className="h-16 w-full rounded-lg" />
          <Skeleton variant="shimmer" className="h-16 w-full rounded-lg" />
          <Skeleton variant="shimmer" className="h-16 w-full rounded-lg" />
        </div>
      ) : state.status === "error" ? (
        <div role="alert" className="mt-6 rounded-xl border border-rose-800/70 bg-rose-950/40 p-5">
          <p className="text-sm text-rose-200">{state.message}</p>
          <AppButton type="button" tone="danger" className="mt-3" onClick={() => setState({ status: "loading" })}>
            Retry health check
          </AppButton>
        </div>
      ) : (
        <>
          <div
            className={`mt-6 rounded-lg border p-3 text-sm ${
              state.payload.status === "healthy" || state.payload.status === "ok"
                ? "border-emerald-800/70 bg-emerald-950/30 text-emerald-200"
                : state.payload.status === "unhealthy"
                  ? "border-rose-800/70 bg-rose-950/30 text-rose-200"
                  : "border-amber-800/70 bg-amber-950/30 text-amber-200"
            }`}
          >
            Overall:{" "}
            {state.payload.status === "healthy" || state.payload.status === "ok"
              ? "Ready"
              : state.payload.status === "unhealthy"
                ? "Unhealthy — core readiness gates failing"
                : "Degraded — one or more gates failing"}
          </div>
          <ul className="mt-4 space-y-3">
            {state.payload.gates.map((gate) => (
              <GateRow key={gate.name} gate={gate} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
