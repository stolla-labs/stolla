export type FreshnessState = "Current" | "Delayed" | "Stale" | "Unavailable";

export function determineFreshness(
  hasError: boolean,
  hasData: boolean,
  hasMalformedMetadata?: boolean
): FreshnessState {
  if (hasError) {
    return hasData ? "Stale" : "Unavailable";
  }
  if (hasMalformedMetadata) {
    return "Delayed";
  }
  return "Current";
}
