export type AnalyticsEventName =
  | "page_view"
  | "landing_cta"
  | "create_start"
  | "create_finish"
  | "claim_start"
  | "claim_finish"
  | "first_vote";

export type AnalyticsProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

export type AnalyticsEvent = {
  name: AnalyticsEventName;
  timestamp: string;
  properties: AnalyticsProperties;
};

export type AnalyticsSink = (event: AnalyticsEvent) => void | Promise<void>;

let sink: AnalyticsSink = (event) => console.info("[analytics]", event);
const emittedOnce = new Set<string>();
const SENSITIVE_KEY = /(private|secret|seed|mnemonic|passphrase|raw.?wallet|address)$/i;

export function analyticsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "true";
}

export function setAnalyticsSink(nextSink: AnalyticsSink): () => void {
  const previous = sink;
  sink = nextSink;
  return () => { sink = previous; };
}

export function emitAnalytics(
  name: AnalyticsEventName,
  properties: AnalyticsProperties = {},
  options: { onceKey?: string } = {},
): boolean {
  if (!analyticsEnabled()) return false;
  if (Object.keys(properties).some((key) => SENSITIVE_KEY.test(key))) {
    throw new Error("Sensitive identifiers are not accepted by product analytics");
  }
  const key = options.onceKey ? `${name}:${options.onceKey}` : null;
  if (key && emittedOnce.has(key)) return false;
  if (key) emittedOnce.add(key);
  void sink({ name, timestamp: new Date().toISOString(), properties });
  return true;
}

export async function anonymizeWalletAddress(address: string): Promise<string> {
  const normalized = address.trim().toUpperCase();
  const bytes = new TextEncoder().encode(`stolla-analytics-v1:${normalized}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function resetAnalyticsForTests(): void {
  emittedOnce.clear();
}

