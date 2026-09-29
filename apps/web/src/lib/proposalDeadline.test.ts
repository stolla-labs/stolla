import { describe, expect, it } from "vitest";
import { formatProposalDeadlineEstimate } from "./proposalDeadline";

describe("formatProposalDeadlineEstimate", () => {
  it("estimates remaining time from the latest known ledger", () => {
    expect(formatProposalDeadlineEstimate(20_000, 19_280, 10_000)).toBe(
      "Approx. ~1h remaining at last scan",
    );
    expect(formatProposalDeadlineEstimate(20_000, 20_000, 10_000)).toBe(
      "Approx. ~0s past deadline at last scan",
    );
    expect(formatProposalDeadlineEstimate(20_000, 20_720, 10_000)).toBe(
      "Approx. ~1h past deadline at last scan",
    );
  });

  it("falls back to the voting window when a current ledger is unavailable", () => {
    expect(formatProposalDeadlineEstimate(20_000, null, 19_280)).toBe(
      "Approx. voting window: ~1h",
    );
  });

  it("does not invent an estimate from missing or invalid ledger values", () => {
    expect(formatProposalDeadlineEstimate(null, 19_280, 10_000)).toBeNull();
    expect(formatProposalDeadlineEstimate(undefined, 19_280, 10_000)).toBeNull();
    expect(formatProposalDeadlineEstimate(20_000, null, null)).toBeNull();
    expect(formatProposalDeadlineEstimate(20_000, null, 20_001)).toBeNull();
    expect(formatProposalDeadlineEstimate(-1, 0, 0)).toBeNull();
  });
});
