import { afterEach, describe, expect, it, vi } from "vitest";
import { parseGovernorStartLedger } from "./stellar";

const ENV_KEY = "NEXT_PUBLIC_GOVERNOR_START_LEDGER";

describe("parseGovernorStartLedger", () => {
  const previous = process.env[ENV_KEY];

  afterEach(() => {
    if (previous === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = previous;
    }
  });

  it("parses a valid positive integer", () => {
    expect(parseGovernorStartLedger("12345")).toBe(12345);
  });

  it("trims surrounding whitespace", () => {
    expect(parseGovernorStartLedger("  42  ")).toBe(42);
  });

  it("reads from the environment when no argument is passed", () => {
    process.env[ENV_KEY] = "9001";
    expect(parseGovernorStartLedger()).toBe(9001);
  });

  it("rejects a missing value", () => {
    vi.stubEnv(ENV_KEY, "");
    expect(() => parseGovernorStartLedger()).toThrow(
      /Governor start ledger is not configured/,
    );
  });

  it("rejects a blank value", () => {
    expect(() => parseGovernorStartLedger("   ")).toThrow(
      /Governor start ledger is not configured/,
    );
  });

  it("rejects zero", () => {
    expect(() => parseGovernorStartLedger("0")).toThrow(
      /expected a positive integer/,
    );
  });

  it("rejects a negative value", () => {
    expect(() => parseGovernorStartLedger("-1")).toThrow(
      /expected a positive integer/,
    );
  });

  it("rejects a non-integer value", () => {
    expect(() => parseGovernorStartLedger("12.5")).toThrow(
      /expected a positive integer/,
    );
  });

  it("rejects a non-numeric value", () => {
    expect(() => parseGovernorStartLedger("latest")).toThrow(
      /expected a positive integer/,
    );
  });
});
