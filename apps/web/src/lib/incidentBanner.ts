export type IncidentSeverity = "info" | "warn" | "critical";

export type IncidentBannerPayload = {
  /** When false or absent, the banner is hidden. */
  active: boolean;
  severity: IncidentSeverity;
  /** Short, user-facing message. */
  message: string;
  /** Optional link to detailed status notes. */
  statusUrl?: string;
};

const SEVERITIES: readonly IncidentSeverity[] = ["info", "warn", "critical"];

/**
 * Parse a raw banner payload (for example from an environment variable or an
 * API response) into a validated, typed value. Returns null when the payload
 * is absent, inactive, or malformed so callers can simply hide the banner.
 */
export function parseIncidentBanner(
  raw: unknown,
): IncidentBannerPayload | null {
  if (raw == null || typeof raw !== "object") return null;

  const candidate = raw as Record<string, unknown>;
  if (candidate.active !== true) return null;

  const severity = candidate.severity;
  if (typeof severity !== "string" || !SEVERITIES.includes(severity as IncidentSeverity)) {
    return null;
  }

  const message = candidate.message;
  if (typeof message !== "string" || message.trim() === "") return null;

  const statusUrl =
    typeof candidate.statusUrl === "string" && candidate.statusUrl.trim() !== ""
      ? candidate.statusUrl.trim()
      : undefined;

  return {
    active: true,
    severity: severity as IncidentSeverity,
    message,
    statusUrl,
  };
}

/**
 * Read the statically configured incident banner. The payload lives in a
 * `NEXT_PUBLIC_INCIDENT_BANNER` JSON string so operators can publish an
 * outage notice without a code change.
 */
export function resolveIncidentBanner(): IncidentBannerPayload | null {
  const raw = process.env.NEXT_PUBLIC_INCIDENT_BANNER;
  if (!raw) return null;
  try {
    return parseIncidentBanner(JSON.parse(raw));
  } catch {
    return null;
  }
}
