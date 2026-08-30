"use client";

import {
  type SimulationResult,
  type SimulationStatus,
  formatFeeBreakdown,
} from "@/lib/fee-utils";

export interface SimulatedFeeDisplayProps {
  /** Current simulation state. */
  status: SimulationStatus;
  /** Called when the user wants to re-simulate (inputs changed). */
  onResimulate?: () => void;
  /** Extra class for the container. */
  className?: string;
}

/**
 * Displays the simulated transaction fee from a Soroban simulation.
 *
 * States handled:
 * - idle: nothing to show
 * - loading: skeleton / spinner
 * - success: fee in stroops + XLM + resource breakdown
 * - stale: inputs changed, re-simulate needed
 * - error: failed (with distinction between app errors and insufficient resources)
 */
export default function SimulatedFeeDisplay({
  status,
  onResimulate,
  className = "",
}: SimulatedFeeDisplayProps) {
  if (status.kind === "idle") return null;

  return (
    <div className={`rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 ${className}`}>
      <h4 className="mb-3 text-sm font-semibold text-zinc-400">
        Simulated transaction fee
      </h4>

      {status.kind === "loading" && (
        <FeeSkeleton />
      )}

      {status.kind === "success" && (
        <FeeSuccess result={status.result} />
      )}

      {status.kind === "stale" && (
        <FeeStale onResimulate={onResimulate} />
      )}

      {status.kind === "error" && (
        <FeeError message={status.message} insufficientResources={status.insufficientResources} />
      )}
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function FeeSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-4 w-32 rounded bg-zinc-800" />
      <div className="h-3 w-48 rounded bg-zinc-800" />
      <div className="h-3 w-40 rounded bg-zinc-800" />
    </div>
  );
}

function FeeSuccess({ result }: { result: SimulationResult }) {
  const breakdown = formatFeeBreakdown(result);

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-lg tabular-nums text-zinc-100">
          {breakdown.stroops}
        </span>
        <span className="text-zinc-500">stroops</span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="font-mono text-lg tabular-nums text-emerald-400">
          {breakdown.xlm}
        </span>
        <span className="text-zinc-500">XLM</span>
      </div>

      <p className="text-xs text-zinc-600">
        Simulated — final fee may differ at submission
      </p>

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-400">
          Resource breakdown
        </summary>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-zinc-400">
          <div>
            <div className="text-zinc-500">CPU</div>
            <div className="font-mono tabular-nums">{breakdown.cpu}</div>
          </div>
          <div>
            <div className="text-zinc-500">Read</div>
            <div className="font-mono tabular-nums">{breakdown.readBytes} B</div>
          </div>
          <div>
            <div className="text-zinc-500">Write</div>
            <div className="font-mono tabular-nums">{breakdown.writeBytes} B</div>
          </div>
        </div>
      </details>
    </div>
  );
}

function FeeStale({ onResimulate }: { onResimulate?: () => void }) {
  return (
    <div className="space-y-2 text-sm">
      <p className="text-amber-400">Simulation results are stale</p>
      <p className="text-xs text-zinc-500">
        Inputs have changed since the last simulation.
      </p>
      {onResimulate && (
        <button
          type="button"
          onClick={onResimulate}
          className="rounded-lg bg-amber-600/20 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-600/30 transition-colors"
        >
          Re-simulate
        </button>
      )}
    </div>
  );
}

function FeeError({
  message,
  insufficientResources,
}: {
  message: string;
  insufficientResources: boolean;
}) {
  return (
    <div className="space-y-2 text-sm">
      <p className={insufficientResources ? "text-amber-400" : "text-red-400"}>
        {insufficientResources ? "Insufficient resources" : "Simulation failed"}
      </p>
      {!insufficientResources && (
        <p className="text-xs text-zinc-500">{message}</p>
      )}
      {insufficientResources && (
        <p className="text-xs text-zinc-500">
          The transaction requires more resources than available. Fund the
          source account or reduce the transaction complexity.
        </p>
      )}
    </div>
  );
}
