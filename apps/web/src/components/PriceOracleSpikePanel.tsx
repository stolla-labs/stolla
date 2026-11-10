"use client";

import { useEffect, useState } from "react";
import {
  formatOracleSample,
  resolveConfiguredPriceOracleId,
  type FormattedOracleQuote,
  type PriceOracleReader,
} from "@/lib/priceOracle";

type Props = {
  assetSymbol?: string;
  oracleContractId?: string | null;
  readQuote: PriceOracleReader;
  nowMs?: number;
};

/**
 * Read-only SEP-40 / Reflector price-oracle consumer spike (#394).
 *
 * Hidden unless `NEXT_PUBLIC_PRICE_ORACLE_CONTRACT_ID` (or an explicit
 * `oracleContractId` prop) is configured with a valid Soroban contract ID.
 */
export function PriceOracleSpikePanel({
  assetSymbol = "XLM",
  oracleContractId,
  readQuote,
  nowMs,
}: Props) {
  const resolvedContractId =
    oracleContractId !== undefined
      ? oracleContractId
      : resolveConfiguredPriceOracleId();

  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "empty" }
    | { status: "error"; message: string }
    | { status: "ready"; quote: FormattedOracleQuote }
  >({ status: "loading" });

  useEffect(() => {
    if (!resolvedContractId) return;
    let cancelled = false;
    setState({ status: "loading" });
    void readQuote({
      oracleContractId: resolvedContractId,
      assetSymbol,
    })
      .then((sample) => {
        if (cancelled) return;
        if (!sample) {
          setState({ status: "empty" });
          return;
        }
        setState({
          status: "ready",
          quote: formatOracleSample(sample, nowMs),
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          message:
            err instanceof Error
              ? err.message
              : "Could not read price oracle sample.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [assetSymbol, nowMs, readQuote, resolvedContractId]);

  if (!resolvedContractId) {
    return null;
  }

  return (
    <aside
      aria-label="Experimental price oracle reference"
      className="rounded-xl border border-amber-800/60 bg-amber-950/20 p-4 text-sm text-slate-200"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-amber-200">
          Oracle reference quote ({assetSymbol})
        </h3>
        <span className="rounded-full border border-amber-700/70 bg-amber-900/40 px-2.5 py-0.5 text-xs font-medium text-amber-200">
          Experimental — not used for governance calculations
        </span>
      </div>

      <p className="mt-1 text-xs text-slate-400">
        Read-only SEP-40 oracle consumer spike. Governance voting power remains
        strictly 1 NFT = 1 vote.
      </p>

      {state.status === "loading" && (
        <p className="mt-3 text-xs text-slate-400" role="status">
          Reading latest oracle sample…
        </p>
      )}

      {state.status === "empty" && (
        <p className="mt-3 text-xs text-slate-400" role="status">
          No recent sample published for {assetSymbol}.
        </p>
      )}

      {state.status === "error" && (
        <p className="mt-3 text-xs text-rose-300" role="alert">
          {state.message}
        </p>
      )}

      {state.status === "ready" && (
        <dl className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-950/50 p-3 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-slate-400">{state.quote.pairLabel}</dt>
            <dd className="mt-0.5 font-mono text-sm font-semibold text-slate-100">
              {state.quote.formattedPrice}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">Published</dt>
            <dd className="mt-0.5 font-mono text-slate-300">
              {state.quote.publishedIso}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">Freshness</dt>
            <dd className="mt-0.5 font-medium text-slate-200">
              {state.quote.stale ? "Stale sample" : "Fresh sample"}
            </dd>
          </div>
        </dl>
      )}
    </aside>
  );
}
