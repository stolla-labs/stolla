import { describe, expect, it } from "vitest";
import {
  evaluateDiscoveryFreshness,
  CURRENT_THRESHOLD,
  STALE_THRESHOLD,
} from "./freshness";
import type { FreshnessMetadata } from "./freshness";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

function meta(overrides: Partial<FreshnessMetadata> = {}): FreshnessMetadata {
  return {
    latestLedger: 1_000_100,
    lastEventLedger: 1_000_095,
    discoveredCount: 3,
    hadError: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Current state
// ---------------------------------------------------------------------------

describe("evaluateDiscoveryFreshness", () => {
  describe("current", () => {
    it("returns current when gap is zero", () => {
      const result = evaluateDiscoveryFreshness(
        meta({ latestLedger: 1_000_100, lastEventLedger: 1_000_100 }),
      );
      expect(result.state).toBe("current");
      expect(result.ledgerGap).toBe(0);
    });

    it("returns current when gap is within CURRENT_THRESHOLD", () => {
      const result = evaluateDiscoveryFreshness(
        meta({
          latestLedger: 1_000_100,
          lastEventLedger: 1_000_100 - CURRENT_THRESHOLD,
        }),
      );
      expect(result.state).toBe("current");
      expect(result.ledgerGap).toBe(CURRENT_THRESHOLD);
    });

    it("returns current when lastEventLedger exceeds latestLedger (negative gap)", () => {
      const result = evaluateDiscoveryFreshness(
        meta({ latestLedger: 1_000_090, lastEventLedger: 1_000_100 }),
      );
      expect(result.state).toBe("current");
      expect(result.ledgerGap).toBe(-10);
    });
  });

  // -------------------------------------------------------------------------
  // Delayed state
  // -------------------------------------------------------------------------

  describe("delayed", () => {
    it("returns delayed when gap exceeds CURRENT_THRESHOLD but is within STALE_THRESHOLD", () => {
      const result = evaluateDiscoveryFreshness(
        meta({
          latestLedger: 1_000_200,
          lastEventLedger: 1_000_100,
        }),
      );
      expect(result.state).toBe("delayed");
      expect(result.ledgerGap).toBe(100);
    });

    it("returns delayed when gap equals STALE_THRESHOLD", () => {
      const result = evaluateDiscoveryFreshness(
        meta({
          latestLedger: 1_000_100 + STALE_THRESHOLD,
          lastEventLedger: 1_000_100,
        }),
      );
      expect(result.state).toBe("delayed");
      expect(result.ledgerGap).toBe(STALE_THRESHOLD);
    });

    it("returns delayed when latestLedger is null (unknown head)", () => {
      const result = evaluateDiscoveryFreshness(
        meta({ latestLedger: null }),
      );
      expect(result.state).toBe("delayed");
      expect(result.ledgerGap).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Stale state
  // -------------------------------------------------------------------------

  describe("stale", () => {
    it("returns stale when gap exceeds STALE_THRESHOLD", () => {
      const result = evaluateDiscoveryFreshness(
        meta({
          latestLedger: 1_000_100 + STALE_THRESHOLD + 1,
          lastEventLedger: 1_000_100,
        }),
      );
      expect(result.state).toBe("stale");
      expect(result.ledgerGap).toBe(STALE_THRESHOLD + 1);
    });

    it("returns stale when hadError is true and data exists", () => {
      const result = evaluateDiscoveryFreshness(
        meta({ hadError: true, discoveredCount: 2 }),
      );
      expect(result.state).toBe("stale");
    });

    it("stale result includes explanatory message about network errors", () => {
      const result = evaluateDiscoveryFreshness(
        meta({ hadError: true, discoveredCount: 5 }),
      );
      expect(result.explanation).toContain("network errors");
    });
  });

  // -------------------------------------------------------------------------
  // Unavailable state
  // -------------------------------------------------------------------------

  describe("unavailable", () => {
    it("returns unavailable when no events and RPC failed", () => {
      const result = evaluateDiscoveryFreshness(
        meta({
          latestLedger: null,
          lastEventLedger: null,
          discoveredCount: 0,
          hadError: true,
        }),
      );
      expect(result.state).toBe("unavailable");
      expect(result.ledgerGap).toBeNull();
    });

    it("returns unavailable when no events and no RPC head", () => {
      const result = evaluateDiscoveryFreshness(
        meta({
          latestLedger: null,
          lastEventLedger: null,
          discoveredCount: 0,
          hadError: false,
        }),
      );
      expect(result.state).toBe("unavailable");
    });

    it("returns unavailable when no events found in scanned range", () => {
      const result = evaluateDiscoveryFreshness(
        meta({
          latestLedger: 1_000_100,
          lastEventLedger: null,
          discoveredCount: 0,
          hadError: false,
        }),
      );
      expect(result.state).toBe("unavailable");
    });
  });

  // -------------------------------------------------------------------------
  // Malformed / edge-case RPC metadata
  // -------------------------------------------------------------------------

  describe("malformed RPC metadata", () => {
    it("handles zero latestLedger gracefully", () => {
      const result = evaluateDiscoveryFreshness(
        meta({ latestLedger: 0, lastEventLedger: 0, discoveredCount: 1 }),
      );
      expect(result.state).toBe("current");
      expect(result.ledgerGap).toBe(0);
    });

    it("handles lastEventLedger greater than latestLedger", () => {
      const result = evaluateDiscoveryFreshness(
        meta({ latestLedger: 100, lastEventLedger: 200, discoveredCount: 1 }),
      );
      expect(result.state).toBe("current");
      expect(result.ledgerGap).toBe(-100);
    });

    it("handles both ledger fields as null with no data", () => {
      const result = evaluateDiscoveryFreshness(
        meta({
          latestLedger: null,
          lastEventLedger: null,
          discoveredCount: 0,
          hadError: false,
        }),
      );
      expect(result.state).toBe("unavailable");
    });

    it("handles both ledger fields as null but data exists", () => {
      const result = evaluateDiscoveryFreshness(
        meta({
          latestLedger: null,
          lastEventLedger: null,
          discoveredCount: 2,
          hadError: false,
        }),
      );
      // Has data but no way to compute gap → delayed (unknown head)
      expect(result.state).toBe("delayed");
    });

    it("handles negative latestLedger from malformed RPC", () => {
      const result = evaluateDiscoveryFreshness(
        meta({
          latestLedger: -1,
          lastEventLedger: 100,
          discoveredCount: 1,
        }),
      );
      // Negative head means gap = -1 - 100 = -101 → current (negative gap)
      expect(result.state).toBe("current");
    });

    it("handles discoveredCount as zero with lastEventLedger present (defensive)", () => {
      const result = evaluateDiscoveryFreshness(
        meta({
          latestLedger: 1_000_100,
          lastEventLedger: 1_000_095,
          discoveredCount: 0,
        }),
      );
      // Edge case: lastEventLedger set but no proposals counted.
      // This shouldn't happen in practice but the function handles it.
      expect(result.state).toBe("current");
    });

    it("handles very large gap (RPC retention overflow)", () => {
      const result = evaluateDiscoveryFreshness(
        meta({
          latestLedger: 10_000_000,
          lastEventLedger: 1_000_000,
          discoveredCount: 5,
        }),
      );
      expect(result.state).toBe("stale");
      expect(result.ledgerGap).toBe(9_000_000);
    });
  });

  // -------------------------------------------------------------------------
  // Explanation strings
  // -------------------------------------------------------------------------

  describe("explanations", () => {
    it("current explanation is actionable", () => {
      const result = evaluateDiscoveryFreshness(meta());
      expect(result.explanation).toBeTruthy();
      expect(typeof result.explanation).toBe("string");
    });

    it("delayed explanation mentions proposals may not appear", () => {
      const result = evaluateDiscoveryFreshness(
        meta({
          latestLedger: 1_000_200,
          lastEventLedger: 1_000_100,
        }),
      );
      expect(result.explanation).toContain("behind");
    });

    it("stale explanation mentions incompleteness", () => {
      const result = evaluateDiscoveryFreshness(
        meta({
          latestLedger: 1_000_300,
          lastEventLedger: 1_000_100,
        }),
      );
      expect(result.explanation).toContain("incomplete");
    });

    it("unavailable explanation is non-empty", () => {
      const result = evaluateDiscoveryFreshness(
        meta({ discoveredCount: 0, lastEventLedger: null, hadError: true }),
      );
      expect(result.explanation.length).toBeGreaterThan(0);
    });
  });
});
