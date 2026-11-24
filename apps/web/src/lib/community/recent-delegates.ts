import { StrKey } from "@stellar/stellar-sdk";

export const RECENT_DELEGATES_STORAGE_KEY = "stolla:recent-delegates:v1";
export const MAX_RECENT_DELEGATES = 5;

/**
 * Validates a third-party delegatee. Returns a user-facing error message,
 * or null when the address may be submitted to the wallet.
 */
export function validateDelegatee(
  value: string,
  account: string | null | undefined,
  currentDelegate?: string | null,
): string | null {
  const candidate = value.trim();
  if (!candidate) return "Enter the Stellar G address to delegate to.";
  if (!StrKey.isValidEd25519PublicKey(candidate)) {
    return "Enter a valid Stellar G address with its full checksum.";
  }
  if (account && candidate === account) {
    return "This is your own address. Use \"Delegate to self\" instead.";
  }
  if (currentDelegate && candidate === currentDelegate) {
    return "Your voting power is already delegated to this address.";
  }
  return null;
}

function getStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Reads the device-local recent delegates, newest first. */
export function loadRecentDelegates(): string[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(
      storage.getItem(RECENT_DELEGATES_STORAGE_KEY) ?? "[]",
    );
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is string =>
          typeof entry === "string" && StrKey.isValidEd25519PublicKey(entry),
      )
      .slice(0, MAX_RECENT_DELEGATES);
  } catch {
    return [];
  }
}

/** Records a delegate as most recent and returns the updated list. */
export function rememberRecentDelegate(address: string): string[] {
  const next = [
    address,
    ...loadRecentDelegates().filter((entry) => entry !== address),
  ].slice(0, MAX_RECENT_DELEGATES);
  try {
    getStorage()?.setItem(RECENT_DELEGATES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage may be full or blocked; the list is optional.
  }
  return next;
}

/** Removes every remembered delegate from this device. */
export function clearRecentDelegates(): void {
  try {
    getStorage()?.removeItem(RECENT_DELEGATES_STORAGE_KEY);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
