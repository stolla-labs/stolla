"use client";

import { useCallback, useEffect, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import {
  isPriceOracleConfigured,
  readOraclePrice,
  readPriceOracleContractId,
  readPriceOracleDefaultFeed,
  type PriceOracleReadResult,
  type PriceOracleRpc,
} from "@/lib/price-oracle/client";

const SCOPE_ADR_HREF =
  "https://github.com/stolla-labs/stolla/blob/main/docs/adr/007-price-oracle-spike-scope.md";
const ISSUE_266_HREF = "https://github.com/stolla-labs/stolla/issues/266";

export type PriceOracleDebugPanelProps = {
  /** Injected for tests; production uses the default env + RPC. */
  contractId?: string | null;
  defaultFeed?: string;
  configured?: boolean;
  rpc?: PriceOracleRpc;
};

export function PriceOracleDebugPanel({
  contractId,
  defaultFeed,
  configured,
  rpc,
}: PriceOracleDebugPanelProps = {}) {
  const resolvedContractId =
    contractId !== undefined ? contractId : readPriceOracleContractId();
  const isConfigured =
    configured !== undefined
      ? configured
      : resolvedContractId !== null && isPriceOracleConfigured();

  const [feed, setFeed] = useState(
    () => defaultFeed ?? readPriceOracleDefaultFeed(),
  );
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PriceOracleReadResult | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const next = await readOraclePrice({
        contractId: resolvedContractId,
        feed,
        rpc,
      });
      setResult(next);
    } finally {
      setBusy(false);
    }
  }, [feed, resolvedContractId, rpc]);

  useEffect(() => {
    if (!isConfigured) return;
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [isConfigured, load]);

  if (!isConfigured) {
    return null;
  }

  return (
    <section
      aria-labelledby="price-oracle-debug-title"
      className="mt-6 rounded-xl border border-amber-800/60 bg-amber-950/20 p-4 sm:p-6"
      data-testid="price-oracle-debug-panel"
    >
      <h2
        id="price-oracle-debug-title"
        className="font-semibold text-amber-100"
      >
        Experimental price oracle (debug)
      </h2>
      <p className="mt-2 text-sm text-amber-100/90">
        Experimental / not for custody. Read-only spike only — values must not
        drive Governor execution, treasury policy, or mainnet feeds. See{" "}
        <a
          href={ISSUE_266_HREF}
          className="underline hover:text-amber-50"
          target="_blank"
          rel="noreferrer"
        >
          #266 decision notes
        </a>{" "}
        and the{" "}
        <a
          href={SCOPE_ADR_HREF}
          className="underline hover:text-amber-50"
          target="_blank"
          rel="noreferrer"
        >
          spike scope ADR
        </a>
        .
      </p>

      <p className="mt-3 break-all font-mono text-xs text-slate-300">
        Contract: {resolvedContractId}
      </p>

      <div className="mt-4 space-y-3">
        <label
          htmlFor="price-oracle-feed"
          className="block text-sm text-slate-200"
        >
          Feed symbol
        </label>
        <input
          id="price-oracle-feed"
          value={feed}
          onChange={(event) => {
            setFeed(event.target.value);
            setResult(null);
          }}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 font-mono text-sm text-slate-100"
          placeholder="XLM_USDC"
        />
        <AppButton
          tone="secondary"
          disabled={busy}
          onClick={() => void load()}
        >
          {busy ? "Reading oracle…" : "Refresh oracle reading"}
        </AppButton>
      </div>

      {result?.ok === false && (
        <p role="alert" className="mt-3 break-words text-sm text-rose-300">
          {result.message}
        </p>
      )}

      {result?.ok === true && (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Feed</dt>
            <dd className="font-mono text-slate-100">{result.reading.feed}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Price</dt>
            <dd className="font-mono text-slate-100">
              {result.reading.price.toString()}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Last update ledger</dt>
            <dd className="font-mono text-slate-100">
              {result.reading.priceTimestamp}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
