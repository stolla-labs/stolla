export type OraclePriceSample = {
  assetSymbol: string;
  quoteSymbol: string;
  /** Raw integer price returned by the SEP-40 / Reflector-style oracle contract. */
  rawPrice: bigint;
  /** Number of decimal places declared by the oracle contract (typically 14 on Reflector). */
  decimals: number;
  /** Unix timestamp (seconds) when the sample was published on-chain. */
  timestampSeconds: number;
};

export type FormattedOracleQuote = {
  pairLabel: string;
  formattedPrice: string;
  publishedIso: string;
  stale: boolean;
};

export type PriceOracleReader = (params: {
  oracleContractId: string;
  assetSymbol: string;
}) => Promise<OraclePriceSample | null>;

/** Default staleness threshold (1 hour). */
export const DEFAULT_ORACLE_STALE_THRESHOLD_SECONDS = 3_600;

export function resolveConfiguredPriceOracleId(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const value = env.NEXT_PUBLIC_PRICE_ORACLE_CONTRACT_ID?.trim();
  return value && /^C[A-Z2-7]{55}$/.test(value) ? value : null;
}

export function formatOracleSample(
  sample: OraclePriceSample,
  nowMs: number = Date.now(),
  staleThresholdSeconds: number = DEFAULT_ORACLE_STALE_THRESHOLD_SECONDS,
): FormattedOracleQuote {
  const decimals = Math.max(0, Math.min(18, Math.trunc(sample.decimals)));
  const scale = 10n ** BigInt(decimals);
  const whole = sample.rawPrice / scale;
  const fractionRaw = (sample.rawPrice < 0n ? -sample.rawPrice : sample.rawPrice) % scale;
  const fractionPadded = fractionRaw.toString().padStart(decimals, "0").slice(0, 4);
  const formattedPrice =
    decimals === 0 ? whole.toString() : `${whole.toString()}.${fractionPadded}`;

  const ageSeconds = Math.floor(nowMs / 1000) - sample.timestampSeconds;
  return {
    pairLabel: `${sample.assetSymbol}/${sample.quoteSymbol}`,
    formattedPrice,
    publishedIso: new Date(sample.timestampSeconds * 1000).toISOString(),
    stale: ageSeconds > staleThresholdSeconds,
  };
}
