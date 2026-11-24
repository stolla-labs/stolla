import { describe, expect, it } from "vitest";
import { parseIncidentBanner } from "@/lib/incidentBanner";

describe("parseIncidentBanner", () => {
  it("returns null for absent or inactive payloads", () => {
    expect(parseIncidentBanner(null)).toBeNull();
    expect(parseIncidentBanner(undefined)).toBeNull();
    expect(parseIncidentBanner({ active: false, severity: "info", message: "x" })).toBeNull();
    expect(parseIncidentBanner("not-an-object")).toBeNull();
  });

  it("returns null for malformed payloads", () => {
    expect(parseIncidentBanner({ active: true, severity: "unknown", message: "x" })).toBeNull();
    expect(parseIncidentBanner({ active: true, severity: "info", message: "" })).toBeNull();
    expect(parseIncidentBanner({ active: true, severity: "info" })).toBeNull();
  });

  it("parses a valid info payload without a status URL", () => {
    expect(parseIncidentBanner({ active: true, severity: "info", message: "Scheduled maintenance" }))
      .toEqual({ active: true, severity: "info", message: "Scheduled maintenance", statusUrl: undefined });
  });

  it("parses a valid critical payload with a status URL", () => {
    expect(parseIncidentBanner({
      active: true,
      severity: "critical",
      message: "RPC is unreachable",
      statusUrl: "https://status.example.com",
    })).toEqual({
      active: true,
      severity: "critical",
      message: "RPC is unreachable",
      statusUrl: "https://status.example.com",
    });
  });

  it("accepts all three severities", () => {
    for (const severity of ["info", "warn", "critical"] as const) {
      expect(parseIncidentBanner({ active: true, severity, message: "m" })?.severity).toBe(severity);
    }
  });
});
