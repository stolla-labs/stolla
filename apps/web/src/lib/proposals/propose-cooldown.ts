export const DEFAULT_PROPOSE_COOLDOWN_MS = 5_000;

export type ProposeRejectionCode =
  | "threshold"
  | "duplicate_proposal"
  | "simulation_auth"
  | "generic";

export type ProposeRejectionGuidance = {
  code: ProposeRejectionCode;
  message: string;
};

export function getProposeCooldownRemainingSeconds(
  cooldownUntilMs: number | null,
  nowMs: number = Date.now(),
): number {
  if (cooldownUntilMs === null || !Number.isFinite(cooldownUntilMs)) {
    return 0;
  }
  const diffMs = cooldownUntilMs - nowMs;
  if (diffMs <= 0) {
    return 0;
  }
  return Math.ceil(diffMs / 1000);
}

export function formatProposeCooldownAnnouncement(
  remainingSeconds: number,
): string {
  if (remainingSeconds <= 0) {
    return "";
  }
  return `Cooldown active: please wait ${remainingSeconds}s before submitting another proposal.`;
}

export function createProposeAttemptLock(
  cooldownMs: number = DEFAULT_PROPOSE_COOLDOWN_MS,
) {
  let inFlight = false;
  let cooldownUntilMs: number | null = null;

  return {
    tryAcquire(nowMs: number = Date.now()): boolean {
      if (inFlight) {
        return false;
      }
      if (
        cooldownUntilMs !== null &&
        getProposeCooldownRemainingSeconds(cooldownUntilMs, nowMs) > 0
      ) {
        return false;
      }
      inFlight = true;
      return true;
    },
    release(nowMs: number = Date.now()): number {
      inFlight = false;
      cooldownUntilMs = nowMs + cooldownMs;
      return cooldownUntilMs;
    },
    getCooldownUntil(): number | null {
      return cooldownUntilMs;
    },
  };
}

export function mapProposeRejectionGuidance(
  errorOrMessage: unknown,
): ProposeRejectionGuidance {
  const raw =
    errorOrMessage instanceof Error
      ? `${errorOrMessage.name} ${errorOrMessage.message}`
      : typeof errorOrMessage === "string"
        ? errorOrMessage
        : "";
  const lower = raw.toLowerCase();

  if (
    lower.includes("proposalthreshold") ||
    lower.includes("proposal threshold") ||
    lower.includes("insufficientvotingpower") ||
    lower.includes("insufficient voting") ||
    lower.includes("insufficientvotes") ||
    lower.includes("#5012")
  ) {
    return {
      code: "threshold",
      message:
        "Proposal rejected: your account does not meet the Governor proposal threshold. Ensure you hold a Community NFT and have delegated voting power to yourself before proposing.",
    };
  }

  if (
    lower.includes("proposalalreadyexists") ||
    lower.includes("duplicateproposal") ||
    lower.includes("duplicate proposal") ||
    lower.includes("already exists") ||
    lower.includes("#5011")
  ) {
    return {
      code: "duplicate_proposal",
      message:
        "A proposal with identical actions and description already exists on this Governor. Edit the title or summary before submitting a new proposal.",
    };
  }

  if (
    lower.includes("unauthorized") ||
    lower.includes("require_auth") ||
    lower.includes("simulation auth") ||
    (lower.includes("auth") && lower.includes("simulation"))
  ) {
    return {
      code: "simulation_auth",
      message:
        "Proposal simulation failed authorization checks. Verify the connected wallet matches the proposer account and expected network.",
    };
  }

  return {
    code: "generic",
    message:
      raw.trim() ||
      "The proposal could not be submitted. Review your inputs and try again.",
  };
}
