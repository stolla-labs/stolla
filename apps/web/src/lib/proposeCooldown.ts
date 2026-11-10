export const PROPOSE_COOLDOWN_MS = 15_000;

const STORAGE_PREFIX = "stolla:propose-cooldown:v1";

function storageKey(governorId: string, address: string): string {
  return `${STORAGE_PREFIX}:${governorId.trim()}:${address.trim()}`;
}

export function recordProposeTimestamp(
  governorId: string,
  address: string,
  now: number = Date.now(),
): void {
  if (typeof window === "undefined" || !governorId || !address) return;
  try {
    window.localStorage.setItem(storageKey(governorId, address), String(now));
  } catch {
    // Ignore storage quota errors
  }
}

export function getRemainingProposeCooldownMs(
  governorId: string,
  address: string,
  now: number = Date.now(),
  cooldownMs: number = PROPOSE_COOLDOWN_MS,
): number {
  if (typeof window === "undefined" || !governorId || !address) return 0;
  try {
    const raw = window.localStorage.getItem(storageKey(governorId, address));
    if (!raw) return 0;
    const timestamp = Number(raw);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return 0;
    const elapsed = now - timestamp;
    return elapsed < cooldownMs ? Math.max(0, cooldownMs - elapsed) : 0;
  } catch {
    return 0;
  }
}

export function clearProposeCooldown(
  governorId: string,
  address: string,
): void {
  if (typeof window === "undefined" || !governorId || !address) return;
  try {
    window.localStorage.removeItem(storageKey(governorId, address));
  } catch {
    // Ignore storage errors
  }
}

export type ProposeRejectionGuidance = {
  kind: "cooldown" | "threshold" | "duplicate_active";
  title: string;
  guidance: string;
};

export function describeProposeRejection(
  error: unknown,
): ProposeRejectionGuidance | null {
  const raw =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === "string"
        ? error
        : "";
  const text = raw.toLowerCase();
  if (!text) return null;

  if (
    text.includes("proposecooldown") ||
    text.includes("propose cooldown") ||
    text.includes("cooldown") ||
    text.includes("#5018") ||
    text.includes("error 5018")
  ) {
    return {
      kind: "cooldown",
      title: "Proposal cooldown active",
      guidance:
        "This wallet recently submitted a proposal. Wait for the Governor cooldown window to elapse before submitting another proposal.",
    };
  }

  if (
    text.includes("proposalthreshold") ||
    text.includes("proposal threshold") ||
    text.includes("insufficient voting power") ||
    text.includes("insufficientvotes") ||
    text.includes("#5012") ||
    text.includes("error 5012")
  ) {
    return {
      kind: "threshold",
      title: "Proposal threshold not met",
      guidance:
        "Creating a proposal requires delegated NFT voting power at or above the community proposal threshold. Mint or delegate membership NFTs first.",
    };
  }

  if (
    text.includes("already active proposal") ||
    text.includes("activeproposalexists") ||
    text.includes("duplicate proposal")
  ) {
    return {
      kind: "duplicate_active",
      title: "Active proposal limit reached",
      guidance:
        "An active proposal from this proposer is already open. Wait for the current proposal to finish voting or cancel it before creating a new one.",
    };
  }

  return null;
}
