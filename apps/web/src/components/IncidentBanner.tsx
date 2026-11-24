"use client";

import { useState } from "react";
import {
  parseIncidentBanner,
  resolveIncidentBanner,
  type IncidentBannerPayload,
  type IncidentSeverity,
} from "@/lib/incidentBanner";

const SESSION_KEY = "stolla:incident-banner:dismissed";

const SEVERITY_STYLES: Record<IncidentSeverity, string> = {
  info: "border-sky-700/60 bg-sky-950/40 text-sky-100",
  warn: "border-amber-600/60 bg-amber-950/40 text-amber-100",
  critical: "border-rose-600/60 bg-rose-950/50 text-rose-100",
};

const SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  info: "Notice",
  warn: "Degraded",
  critical: "Outage",
};

function hasDismissedSession(payload: IncidentBannerPayload): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === payload.message;
  } catch {
    return false;
  }
}

/**
 * Global incident banner rendered in the app shell. The payload is statically
 * configured via `NEXT_PUBLIC_INCIDENT_BANNER` and can be dismissed for the
 * current session. Critical notices are only dismissible for the session, so a
 * fresh visit shows them again.
 */
export function IncidentBanner() {
  const payload = resolveIncidentBanner();
  const [dismissed, setDismissed] = useState(() =>
    payload ? hasDismissedSession(payload) : false,
  );

  if (!payload || dismissed) return null;

  function handleDismiss() {
    try {
      window.sessionStorage.setItem(SESSION_KEY, payload!.message);
    } catch {
      // Session storage may be unavailable; a transient dismissal is fine.
    }
    setDismissed(true);
  }

  return (
    <div
      role="status"
      aria-label={`${SEVERITY_LABEL[payload.severity]} notice`}
      className={`flex items-start justify-between gap-3 border-b px-4 py-2.5 text-sm ${SEVERITY_STYLES[payload.severity]}`}
    >
      <div className="min-w-0">
        <span className="mr-2 font-semibold">
          {SEVERITY_LABEL[payload.severity]}
        </span>
        <span>{payload.message}</span>
        {payload.statusUrl && (
          <a
            href={payload.statusUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 underline underline-offset-2 hover:opacity-80"
          >
            Status notes
          </a>
        )}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss notice"
        className="shrink-0 rounded px-1.5 text-current opacity-70 transition hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}
