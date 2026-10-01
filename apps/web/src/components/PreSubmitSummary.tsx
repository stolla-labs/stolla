"use client";

export interface PreSubmitSimulation {
  ok: boolean;
  message: string;
  fee?: string;
  signers?: string[];
}

export function canConfirmPreSubmit(simulation: PreSubmitSimulation | null): boolean {
  return simulation?.ok === true;
}

/**
 * Shared confirm step for mint, propose, and community deploy.
 * Vote and delegate can pass the same simulation result into this panel.
 * Confirm stays disabled when simulation failed, so this panel never opens a wallet.
 */
export function PreSubmitSummary({
  simulation,
  onConfirm,
}: {
  simulation: PreSubmitSimulation | null;
  onConfirm: () => void;
}) {
  const enabled = canConfirmPreSubmit(simulation);
  return (
    <section aria-label="Pre-submit summary" className="mt-3 max-w-full rounded-lg border border-zinc-800 p-3 text-sm">
      <p>{simulation?.message ?? "Run a simulation before confirming."}</p>
      {simulation?.fee ? <p>Estimated fee {simulation.fee}</p> : null}
      {simulation?.signers?.length ? <p>Required signers: {simulation.signers.join(", ")}</p> : null}
      <button
        type="button"
        disabled={!enabled}
        onClick={() => {
          if (!enabled) return;
          onConfirm();
        }}
      >
        Confirm
      </button>
    </section>
  );
}
