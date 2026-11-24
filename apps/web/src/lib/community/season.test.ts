import { describe, expect, it } from "vitest";
import {
  archiveSeason,
  isSeasonActive,
  parseDateOnly,
  seasonProgress,
  seasonStorageKey,
  seasonVisibility,
  shouldShowSeasonBanner,
  toDateOnly,
} from "./season";

const WINDOW = { startDate: "2026-11-01", endDate: "2026-11-30" };

function at(iso: string): Date {
  return new Date(iso);
}

describe("seasonVisibility", () => {
  it("is before when today precedes the start", () => {
    expect(seasonVisibility(WINDOW, at("2026-10-31T12:00:00Z"))).toBe("before");
  });

  it("is active on the start day (inclusive)", () => {
    expect(seasonVisibility(WINDOW, at("2026-11-01T00:00:00Z"))).toBe("active");
  });

  it("is active mid-window", () => {
    expect(seasonVisibility(WINDOW, at("2026-11-15T12:00:00Z"))).toBe("active");
  });

  it("is active on the end day (inclusive)", () => {
    expect(seasonVisibility(WINDOW, at("2026-11-30T23:59:00Z"))).toBe("active");
  });

  it("is ended after the end day", () => {
    expect(seasonVisibility(WINDOW, at("2026-12-01T00:00:00Z"))).toBe("ended");
  });

  it("treats an inverted window as before", () => {
    expect(
      seasonVisibility({ startDate: "2026-12-01", endDate: "2026-11-01" }, at("2026-11-15T00:00:00Z")),
    ).toBe("before");
  });

  it("treats malformed dates as before", () => {
    expect(
      seasonVisibility({ startDate: "not-a-date", endDate: "2026-11-30" }, at("2026-11-15T00:00:00Z")),
    ).toBe("before");
  });
});

describe("seasonProgress", () => {
  it("is 0 before the window", () => {
    expect(seasonProgress(WINDOW, at("2026-10-01T00:00:00Z"))).toBe(0);
  });

  it("is 1 after the window", () => {
    expect(seasonProgress(WINDOW, at("2026-12-31T00:00:00Z"))).toBe(1);
  });

  it("is roughly halfway mid-window", () => {
    const progress = seasonProgress(WINDOW, at("2026-11-15T12:00:00Z"));
    expect(progress).toBeGreaterThan(0.45);
    expect(progress).toBeLessThan(0.55);
  });

  it("is NaN-safe for a zero-length window", () => {
    expect(seasonProgress({ startDate: "2026-11-01", endDate: "2026-11-01" }, at("2026-11-01T00:00:00Z"))).toBe(1);
  });
});

describe("isSeasonActive", () => {
  it("is true only inside the window", () => {
    expect(isSeasonActive(WINDOW, at("2026-11-15T00:00:00Z"))).toBe(true);
    expect(isSeasonActive(WINDOW, at("2026-10-15T00:00:00Z"))).toBe(false);
    expect(isSeasonActive(WINDOW, at("2026-12-15T00:00:00Z"))).toBe(false);
  });
});

describe("shouldShowSeasonBanner", () => {
  it("shows guests only inside the window", () => {
    expect(shouldShowSeasonBanner(WINDOW, false, at("2026-11-15T00:00:00Z"))).toBe(true);
    expect(shouldShowSeasonBanner(WINDOW, false, at("2026-10-15T00:00:00Z"))).toBe(false);
    expect(shouldShowSeasonBanner(WINDOW, false, at("2026-12-15T00:00:00Z"))).toBe(false);
  });

  it("previews the banner for owners before the window", () => {
    expect(shouldShowSeasonBanner(WINDOW, true, at("2026-10-15T00:00:00Z"))).toBe(true);
  });

  it("does not preview an ended season for owners", () => {
    expect(shouldShowSeasonBanner(WINDOW, true, at("2026-12-15T00:00:00Z"))).toBe(false);
  });
});

describe("archiveSeason", () => {
  it("dedupes by name+startDate and puts the newest first", () => {
    const ended = { name: "Season 2", startDate: "2026-11-01", endDate: "2026-11-30", createdAt: "t1" };
    const older = { name: "Season 1", startDate: "2026-09-01", endDate: "2026-09-30", createdAt: "t0" };
    const archived = archiveSeason([older], ended);
    expect(archived).toHaveLength(2);
    expect(archived[0].name).toBe("Season 2");
    expect(archived[0].archivedAt).toBeDefined();
  });
});

describe("date helpers", () => {
  it("parses valid dates", () => {
    expect(parseDateOnly("2026-11-01")).toBe(Date.parse("2026-11-01T00:00:00Z"));
  });

  it("rejects malformed dates", () => {
    expect(parseDateOnly("2026/11/01")).toBeNull();
    expect(parseDateOnly("")).toBeNull();
  });

  it("normalizes to UTC midnight", () => {
    expect(toDateOnly(new Date("2026-11-15T23:59:59Z"))).toBe(Date.UTC(2026, 10, 15));
  });
});

describe("seasonStorageKey", () => {
  it("is community-scoped", () => {
    expect(seasonStorageKey("abc")).toBe("stolla.community-season.abc");
  });
});
