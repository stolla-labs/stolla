import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emitAnalytics, resetAnalyticsForTests, setAnalyticsSink } from "./analytics";

describe("product analytics", () => {
  const events = vi.fn();
  let restore: () => void;

  beforeEach(() => {
    events.mockReset();
    resetAnalyticsForTests();
    restore = setAnalyticsSink(events);
  });
  afterEach(() => { restore(); vi.unstubAllEnvs(); });

  it("is disabled by default", () => {
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENABLED", "");
    expect(emitAnalytics("landing_cta", { destination: "create" })).toBe(false);
    expect(events).not.toHaveBeenCalled();
  });

  it("emits an action once when a once key is supplied", () => {
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENABLED", "true");
    expect(emitAnalytics("first_vote", { outcome: "confirmed" }, { onceKey: "browser" })).toBe(true);
    expect(emitAnalytics("first_vote", { outcome: "confirmed" }, { onceKey: "browser" })).toBe(false);
    expect(events).toHaveBeenCalledTimes(1);
  });

  it("rejects sensitive identifier fields", () => {
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENABLED", "true");
    expect(() => emitAnalytics("page_view", { walletAddress: "GRAW" })).toThrow(/Sensitive identifiers/);
  });
});

