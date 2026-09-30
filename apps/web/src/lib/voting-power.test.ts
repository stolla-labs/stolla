import { describe, expect, it } from "vitest";
import {
  calculateVotingPowerComposition,
  parseBigIntSafe,
} from "./voting-power";

describe("voting-power composition helpers", () => {
  describe("parseBigIntSafe", () => {
    it("handles null, undefined, empty, and dashes safely", () => {
      expect(parseBigIntSafe(null)).toBe(0n);
      expect(parseBigIntSafe(undefined)).toBe(0n);
      expect(parseBigIntSafe("")).toBe(0n);
      expect(parseBigIntSafe("—")).toBe(0n);
      expect(parseBigIntSafe("   ")).toBe(0n);
    });

    it("parses numbers, strings, and bigints correctly", () => {
      expect(parseBigIntSafe(5)).toBe(5n);
      expect(parseBigIntSafe(12.8)).toBe(12n);
      expect(parseBigIntSafe("42")).toBe(42n);
      expect(parseBigIntSafe(100n)).toBe(100n);
    });
  });

  describe("calculateVotingPowerComposition", () => {
    const account = "GACCOUNT123";

    it("handles zero case when member has no tokens and no votes", () => {
      const comp = calculateVotingPowerComposition({
        account,
        balance: 0,
        totalVotes: 0,
        delegate: null,
      });

      expect(comp.totalVotes).toBe(0n);
      expect(comp.selfVotes).toBe(0n);
      expect(comp.delegatedIn).toBe(0n);
      expect(comp.delegatedOut).toBe(0n);
      expect(comp.undelegated).toBe(0n);
      expect(comp.isSelfDelegated).toBe(false);
    });

    it("calculates self-only voting power when self-delegated", () => {
      const comp = calculateVotingPowerComposition({
        account,
        balance: 3,
        totalVotes: 3,
        delegate: account,
      });

      expect(comp.totalVotes).toBe(3n);
      expect(comp.selfVotes).toBe(3n);
      expect(comp.delegatedIn).toBe(0n);
      expect(comp.delegatedOut).toBe(0n);
      expect(comp.undelegated).toBe(0n);
      expect(comp.isSelfDelegated).toBe(true);
    });

    it("calculates received delegation (delegated-in)", () => {
      const comp = calculateVotingPowerComposition({
        account,
        balance: 0,
        totalVotes: 10,
        delegate: null,
      });

      expect(comp.totalVotes).toBe(10n);
      expect(comp.selfVotes).toBe(0n);
      expect(comp.delegatedIn).toBe(10n);
      expect(comp.undelegated).toBe(0n);
    });

    it("calculates mixed composition (self-owned + received delegation)", () => {
      const comp = calculateVotingPowerComposition({
        account,
        balance: 2,
        totalVotes: 7,
        delegate: account,
      });

      expect(comp.totalVotes).toBe(7n);
      expect(comp.selfVotes).toBe(2n);
      expect(comp.delegatedIn).toBe(5n);
      expect(comp.delegatedOut).toBe(0n);
      expect(comp.undelegated).toBe(0n);
    });

    it("identifies undelegated tokens that do not count toward voting power", () => {
      const comp = calculateVotingPowerComposition({
        account,
        balance: 4,
        totalVotes: 0,
        delegate: null,
      });

      expect(comp.totalVotes).toBe(0n);
      expect(comp.selfVotes).toBe(0n);
      expect(comp.delegatedIn).toBe(0n);
      expect(comp.undelegated).toBe(4n);
      expect(comp.isSelfDelegated).toBe(false);
    });

    it("identifies tokens delegated out to a third party", () => {
      const comp = calculateVotingPowerComposition({
        account,
        balance: 5,
        totalVotes: 0,
        delegate: "GOTHER456",
      });

      expect(comp.totalVotes).toBe(0n);
      expect(comp.selfVotes).toBe(0n);
      expect(comp.delegatedIn).toBe(0n);
      expect(comp.delegatedOut).toBe(5n);
      expect(comp.delegateAddress).toBe("GOTHER456");
      expect(comp.isSelfDelegated).toBe(false);
    });
  });
});
