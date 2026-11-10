import { StrKey } from "@stellar/stellar-sdk";

export const RECENT_DELEGATES_CAP = 5;
const STORAGE_PREFIX = "stolla:recent-delegates:v1";

export type DelegateeValidationResult =
  | { ok: true; address: string }
  | {
      ok: false;
      reason:
        | "empty"
        | "invalid_address"
        | "same_as_self"
        | "already_delegated";
      message: string;
    };

export function getRecentDelegatesStorageKey(nftContractId: string): string {
  const scope = nftContractId.trim() || "default";
  return `${STORAGE_PREFIX}:${scope}`;
}

/**
 * Validates a third-party delegatee address before opening any wallet prompt (#388).
 */
export function validateDelegateeAddress(
  raw: string,
  currentAccount?: string | null,
  currentDelegate?: string | null,
): DelegateeValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      ok: false,
      reason: "empty",
      message: "Enter a Stellar G… address to delegate voting power.",
    };
  }

  if (!StrKey.isValidEd25519PublicKey(trimmed)) {
    return {
      ok: false,
      reason: "invalid_address",
      message:
        "Invalid Stellar address. Enter a valid 56-character G… public key.",
    };
  }

  if (currentAccount && trimmed === currentAccount.trim()) {
    return {
      ok: false,
      reason: "same_as_self",
      message:
        "That is your own wallet address. Use “Delegate to self” to self-delegate.",
    };
  }

  if (currentDelegate && trimmed === currentDelegate.trim()) {
    return {
      ok: false,
      reason: "already_delegated",
      message: "Your voting power is already delegated to this address.",
    };
  }

  return { ok: true, address: trimmed };
}

export function loadRecentDelegates(nftContractId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(
      getRecentDelegatesStorageKey(nftContractId),
    );
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is string =>
          typeof item === "string" && StrKey.isValidEd25519PublicKey(item),
      )
      .slice(0, RECENT_DELEGATES_CAP);
  } catch {
    return [];
  }
}

export function saveRecentDelegate(
  nftContractId: string,
  delegatee: string,
): string[] {
  const trimmed = delegatee.trim();
  if (!StrKey.isValidEd25519PublicKey(trimmed)) {
    return loadRecentDelegates(nftContractId);
  }
  const existing = loadRecentDelegates(nftContractId).filter(
    (addr) => addr !== trimmed,
  );
  const next = [trimmed, ...existing].slice(0, RECENT_DELEGATES_CAP);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        getRecentDelegatesStorageKey(nftContractId),
        JSON.stringify(next),
      );
    } catch {
      // Ignore storage quota errors
    }
  }
  return next;
}

export function clearRecentDelegates(nftContractId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(getRecentDelegatesStorageKey(nftContractId));
  } catch {
    // Ignore storage removal errors
  }
}
