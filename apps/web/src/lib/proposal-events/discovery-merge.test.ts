import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  discoverProposals,
  getLegacyLocalProposalIds,
  type DiscoveredProposal,
  type PublicProposalSummary,
} from "./discovery-merge";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** A factory for well-formed hex IDs to keep test data readable. */
const hexId = (n: number): string =>
  n.toString(16).padStart(64, "0");

/** Build a minimal public proposal summary. */
const pub = (n: number, state?: string): PublicProposalSummary => ({
  id: hexId(n),
  state,
});

/** Expected local-only entry shape. */
const localOnly = (n: number): DiscoveredProposal => ({
  id: hexId(n).toLowerCase(),
  source: "local-only",
  state: undefined,
});

/** Expected public entry shape. */
const publicEntry = (n: number, state?: string): DiscoveredProposal => ({
  id: hexId(n).toLowerCase(),
  source: "public",
  state,
});

// ---------------------------------------------------------------------------
// discoverProposals
// ---------------------------------------------------------------------------

describe("discoverProposals", () => {
  // -- Public-only ----------------------------------------------------------

  it("returns public proposals when no local IDs exist", () => {
    const result = discoverProposals([pub(1, "Active"), pub(2, "Pending")], []);
    expect(result).toEqual([publicEntry(1, "Active"), publicEntry(2, "Pending")]);
  });

  it("returns empty array when both sources are empty", () => {
    expect(discoverProposals([], [])).toEqual([]);
  });

  // -- Local-only -----------------------------------------------------------

  it("returns local-only entries when no public proposals exist", () => {
    const result = discoverProposals([], [hexId(10), hexId(20)]);
    expect(result).toEqual([localOnly(10), localOnly(20)]);
  });

  it("marks local-only entries without state", () => {
    const result = discoverProposals([], [hexId(42)]);
    expect(result[0].source).toBe("local-only");
    expect(result[0].state).toBeUndefined();
  });

  // -- Overlapping / deduplication -----------------------------------------

  it("deduplicates IDs present in both sources (public wins)", () => {
    const result = discoverProposals(
      [pub(1, "Active")],
      [hexId(1)], // same ID, local-only
    );
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("public");
    expect(result[0].state).toBe("Active");
  });

  it("deduplication is case-insensitive", () => {
    const upperId = hexId(7).toUpperCase();
    const result = discoverProposals(
      [{ id: hexId(7), state: "Executed" }],
      [upperId],
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(hexId(7).toLowerCase());
    expect(result[0].source).toBe("public");
  });

  it("returns mixed public and local-only entries together", () => {
    const result = discoverProposals(
      [pub(1, "Active"), pub(2, "Succeeded")],
      [hexId(1), hexId(3), hexId(4)], // 1 overlaps, 3 & 4 are local-only
    );
    expect(result).toEqual([
      publicEntry(1, "Active"),
      publicEntry(2, "Succeeded"),
      localOnly(3),
      localOnly(4),
    ]);
  });

  // -- Malformed stored values ---------------------------------------------

  it("ignores empty string IDs", () => {
    const result = discoverProposals([], ["", hexId(5)]);
    expect(result).toEqual([localOnly(5)]);
  });

  it("ignores non-hex characters", () => {
    const result = discoverProposals([], ["xyzg!"]);
    expect(result).toEqual([]);
  });

  it("ignores excessively long IDs", () => {
    const result = discoverProposals([], ["a".repeat(129)]);
    expect(result).toEqual([]);
  });

  it("ignores non-string values from malformed JSON (simulated)", () => {
    // getLegacyLocalProposalIds filters via isValidHexId which rejects
    // non-strings.  discoverProposals itself also filters.
    const result = discoverProposals([], [42 as unknown as string, null as unknown as string]);
    expect(result).toEqual([]);
  });

  // -- Delayed-publication scenario ----------------------------------------

  it("a local-only entry is replaced when public discovery later includes it", () => {
    // Step 1: Initially only local
    const first = discoverProposals([], [hexId(99)]);
    expect(first).toEqual([localOnly(99)]);

    // Step 2: Later, public discovery catches up
    const second = discoverProposals([pub(99, "Active")], [hexId(99)]);
    expect(second).toEqual([publicEntry(99, "Active")]);
  });

  // -- Edge cases ----------------------------------------------------------

  it("handles duplicate IDs within public proposals gracefully", () => {
    const result = discoverProposals(
      [pub(1, "Active"), pub(1, "Executed")],
      [],
    );
    expect(result).toHaveLength(1);
    expect(result[0].state).toBe("Active"); // first wins
  });

  it("handles duplicate IDs within local IDs gracefully", () => {
    const result = discoverProposals([], [hexId(5), hexId(5)]);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("local-only");
  });
});

// ---------------------------------------------------------------------------
// getLegacyLocalProposalIds
// ---------------------------------------------------------------------------

describe("getLegacyLocalProposalIds", () => {
  const STORAGE_KEY = "stolla:proposal-ids";

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns an empty array when localStorage is empty", () => {
    expect(getLegacyLocalProposalIds()).toEqual([]);
  });

  it("returns valid hex IDs from localStorage", () => {
    const ids = [hexId(1), hexId(2)];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    expect(getLegacyLocalProposalIds()).toEqual([
      hexId(1).toLowerCase(),
      hexId(2).toLowerCase(),
    ]);
  });

  it("normalises IDs to lowercase", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["0A1B2C"]));
    expect(getLegacyLocalProposalIds()).toEqual(["0a1b2c"]);
  });

  it("filters out malformed values", () => {
    const raw = [hexId(10), "not-hex!", "", "!!", hexId(20)];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
    const result = getLegacyLocalProposalIds();
    expect(result).toHaveLength(2);
    expect(result).toEqual([hexId(10).toLowerCase(), hexId(20).toLowerCase()]);
  });

  it("returns empty array when stored JSON is not an array", () => {
    localStorage.setItem(STORAGE_KEY, "{}");
    // getStoredProposalIds returns [] on catch, so this returns []
    expect(getLegacyLocalProposalIds()).toEqual([]);
  });

  it("returns empty array when stored JSON is null", () => {
    localStorage.setItem(STORAGE_KEY, "null");
    expect(getLegacyLocalProposalIds()).toEqual([]);
  });
});
