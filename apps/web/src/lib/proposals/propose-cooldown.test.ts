import { describe, expect, it } from "vitest";
import {
  createProposeAttemptLock,
  DEFAULT_PROPOSE_COOLDOWN_MS,
  formatProposeCooldownAnnouncement,
  getProposeCooldownRemainingSeconds,
  mapProposeRejectionGuidance,
} from "./propose-cooldown";

describe("propose cooldown & double-submit lock", () => {
  it("prevents rapid double-clicks from acquiring two wallet prompts and enforces post-attempt cooldown", () => {
    const lock = createProposeAttemptLock(5_000);
    const t0 = 1_700_000_000_000;

    // First click acquires the lock
    expect(lock.tryAcquire(t0)).toBe(true);
    // Immediate second click while in-flight is rejected
    expect(lock.tryAcquire(t0 + 10)).toBe(false);

    // Attempt completes at t0 + 500ms and starts a 5s cooldown
    const cooldownUntil = lock.release(t0 + 500);
    expect(cooldownUntil).toBe(t0 + 500 + DEFAULT_PROPOSE_COOLDOWN_MS);

    // Retrying during cooldown is rejected
    expect(lock.tryAcquire(t0 + 2_000)).toBe(false);
    expect(getProposeCooldownRemainingSeconds(cooldownUntil, t0 + 2_000)).toBe(4);

    // After cooldown expires, a new attempt is allowed
    expect(getProposeCooldownRemainingSeconds(cooldownUntil, t0 + 5_500)).toBe(0);
    expect(lock.tryAcquire(t0 + 5_500)).toBe(true);
  });

  it("formats assistive tech announcements for active cooldowns", () => {
    expect(formatProposeCooldownAnnouncement(0)).toBe("");
    expect(formatProposeCooldownAnnouncement(4)).toBe(
      "Cooldown active: please wait 4s before submitting another proposal.",
    );
  });
});

describe("mapProposeRejectionGuidance", () => {
  it("explains voting power and delegation when Governor threshold fails", () => {
    const guidance = mapProposeRejectionGuidance(
      new Error("HostError: Error(Contract, #5012) InsufficientVotingPower for ProposalThreshold"),
    );
    expect(guidance.code).toBe("threshold");
    expect(guidance.message).toMatch(/voting power/i);
    expect(guidance.message).toMatch(/delegated/i);
  });

  it("explains duplicate proposal rejections and simulation auth failures", () => {
    const duplicate = mapProposeRejectionGuidance(
      new Error("HostError: Error(Contract, #5011) ProposalAlreadyExists"),
    );
    expect(duplicate.code).toBe("duplicate_proposal");
    expect(duplicate.message).toMatch(/identical actions and description already exists/i);

    const simAuth = mapProposeRejectionGuidance(
      new Error("Simulation auth error: require_auth failed for proposer"),
    );
    expect(simAuth.code).toBe("simulation_auth");
    expect(simAuth.message).toMatch(/authorization checks/i);
  });
});
