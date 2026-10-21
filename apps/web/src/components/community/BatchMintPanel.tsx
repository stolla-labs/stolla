"use client";

import { useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import {
  parseRecipientList,
  runSequentialMints,
  type BatchMintProgress,
} from "@/lib/community/batch-mint";

export function BatchMintPanel({
  disabled,
  onMintOne,
}: {
  disabled: boolean;
  onMintOne: (address: string) => Promise<void>;
}) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<BatchMintProgress | null>(null);
  const [running, setRunning] = useState(false);

  async function submit() {
    const parsed = parseRecipientList(raw);
    if (!parsed.ok) {
      setError(parsed.message);
      setProgress(null);
      return;
    }

    setError(null);
    setRunning(true);
    try {
      const next = await runSequentialMints(parsed.addresses, onMintOne);
      setProgress(next);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-800 p-3">
      <label htmlFor="batch-recipients" className="block text-sm text-slate-300">
        Batch recipients
      </label>
      <p className="mt-1 text-xs text-slate-500">
        Paste up to 25 G… addresses, separated by commas or new lines. Metadata is pinned once and reused. Mints run one at a time and stop on the first hard failure.
      </p>
      <textarea
        id="batch-recipients"
        value={raw}
        onChange={(event) => setRaw(event.target.value)}
        rows={4}
        spellCheck={false}
        className="mt-2 w-full min-w-0 rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 font-mono text-sm text-slate-100"
        placeholder={"G...\nG..."}
      />
      {error ? (
        <p role="alert" className="mt-2 text-xs text-rose-300">
          {error}
        </p>
      ) : null}
      <AppButton
        type="button"
        tone="secondary"
        className="mt-3 w-full sm:w-auto"
        disabled={disabled || running}
        onClick={() => void submit()}
      >
        {running ? "Minting batch…" : "Mint batch"}
      </AppButton>
      {progress ? (
        <div className="mt-3 space-y-1 text-xs text-slate-300" data-testid="batch-mint-progress">
          <p>Succeeded: {progress.succeeded.length}</p>
          <p>Pending: {progress.pending.length}</p>
          {progress.failed ? <p>Stopped on {progress.failed}. Retry the pending list.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
