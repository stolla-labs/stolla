import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_RECENT_DELEGATES,
  RECENT_DELEGATES_STORAGE_KEY,
  clearRecentDelegates,
  loadRecentDelegates,
  rememberRecentDelegate,
  validateDelegatee,
} from "./recent-delegates";

const SELF = "GDXYOPJQBJZD67ZREH2ALO55L4DTY6XXPZLSZI72V4CJQM5LRRS3D2M3";
const OTHER = "GAWDU43EJGJQY6JTUJVLENDMEAFWCCKWJFC4562RVWH6ZH2YM6ZYUUIB";
const THIRD = "GCAT6V5EPSVLRV2SRWW6XR4FMVYGNP57ZNGVWOTQUZKASW6QQ6QW62FR";

describe("validateDelegatee", () => {
  it("rejects empty and malformed addresses", () => {
    expect(validateDelegatee("  ", SELF)).toMatch(/Enter the Stellar G address/);
    expect(validateDelegatee("GABC", SELF)).toMatch(/valid Stellar G address/);
    expect(validateDelegatee(`${OTHER.slice(0, -1)}A`, SELF)).toMatch(
      /valid Stellar G address/,
    );
  });

  it("rejects the connected account", () => {
    expect(validateDelegatee(SELF, SELF)).toMatch(/Delegate to self/);
  });

  it("rejects the current delegate", () => {
    expect(validateDelegatee(OTHER, SELF, OTHER)).toMatch(/already delegated/);
  });

  it("accepts a valid third-party address", () => {
    expect(validateDelegatee(` ${OTHER} `, SELF, null)).toBeNull();
  });
});

describe("recent delegates storage", () => {
  beforeEach(() => window.localStorage.clear());

  it("remembers newest first without duplicates and caps the list", () => {
    rememberRecentDelegate(OTHER);
    rememberRecentDelegate(THIRD);
    expect(rememberRecentDelegate(OTHER)).toEqual([OTHER, THIRD]);
    expect(loadRecentDelegates()).toEqual([OTHER, THIRD]);
    expect(MAX_RECENT_DELEGATES).toBeGreaterThan(1);
  });

  it("ignores corrupted or invalid stored data", () => {
    window.localStorage.setItem(RECENT_DELEGATES_STORAGE_KEY, "{not json");
    expect(loadRecentDelegates()).toEqual([]);
    window.localStorage.setItem(
      RECENT_DELEGATES_STORAGE_KEY,
      JSON.stringify([OTHER, "junk", 5]),
    );
    expect(loadRecentDelegates()).toEqual([OTHER]);
  });

  it("clears the stored list", () => {
    rememberRecentDelegate(OTHER);
    clearRecentDelegates();
    expect(loadRecentDelegates()).toEqual([]);
    expect(window.localStorage.getItem(RECENT_DELEGATES_STORAGE_KEY)).toBeNull();
  });
});
