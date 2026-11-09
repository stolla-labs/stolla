import { StrKey } from "@stellar/stellar-sdk";

export const RECENT_DELEGATES_STORAGE_KEY = "stolla:recent-delegates:v1";
export const MAX_RECENT_DELEGATES = 5;

export type ThirdPartyValidationErrorCode =
  | "required"
  | "invalid-address"
  | "same-as-self"
  | "unchanged";

export type ThirdPartyDelegateValidationResult =
  | {
      valid: true;
      normalizedAddress: string;
      summary: {
        currentLabel: string;
        nextDelegatee: string;
      };
    }
  | {
      valid: false;
      code: ThirdPartyValidationErrorCode;
      message: string;
    };

export function isValidStellarAccountAddress(value: string): boolean {
  const trimmed = value.trim();
  if (!/^G[A-Z2-7]{55}$/.test(trimmed)) {
    return false;
  }
  try {
    return StrKey.isValidEd25519PublicKey(trimmed);
  } catch {
    return false;
  }
}

export function describeCurrentDelegatee(
  connectedAccount: string | null | undefined,
  currentDelegatee: string | null | undefined,
): string {
  const current = currentDelegatee?.trim() ?? "";
  if (!current) {
    return "None (undelegated)";
  }
  if (connectedAccount && current === connectedAccount.trim()) {
    return `Self (${current})`;
  }
  return current;
}

export function validateThirdPartyDelegatee(params: {
  input: string;
  connectedAccount: string | null | undefined;
  currentDelegatee?: string | null;
}): ThirdPartyDelegateValidationResult {
  const trimmed = params.input.trim();
  if (!trimmed) {
    return {
      valid: false,
      code: "required",
      message: "Enter a Stellar public key (G…) to delegate voting power.",
    };
  }

  if (!isValidStellarAccountAddress(trimmed)) {
    return {
      valid: false,
      code: "invalid-address",
      message:
        "Invalid Stellar address. Enter a valid 56-character Ed25519 public key starting with G.",
    };
  }

  if (
    params.connectedAccount &&
    trimmed === params.connectedAccount.trim()
  ) {
    return {
      valid: false,
      code: "same-as-self",
      message:
        "This matches your connected wallet. Use “Delegate to self” above instead.",
    };
  }

  if (
    params.currentDelegatee &&
    trimmed === params.currentDelegatee.trim()
  ) {
    return {
      valid: false,
      code: "unchanged",
      message: "Your voting power is already delegated to this address.",
    };
  }

  return {
    valid: true,
    normalizedAddress: trimmed,
    summary: {
      currentLabel: describeCurrentDelegatee(
        params.connectedAccount,
        params.currentDelegatee,
      ),
      nextDelegatee: trimmed,
    },
  };
}

function defaultStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  return window.localStorage;
}

export function readRecentDelegates(
  storage: Pick<Storage, "getItem"> | null = defaultStorage(),
): string[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(RECENT_DELEGATES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is string =>
          typeof item === "string" && isValidStellarAccountAddress(item),
      )
      .slice(0, MAX_RECENT_DELEGATES);
  } catch {
    return [];
  }
}

export function rememberRecentDelegate(
  address: string,
  storage: Pick<Storage, "getItem" | "setItem"> | null = defaultStorage(),
): string[] {
  const trimmed = address.trim();
  const existing = readRecentDelegates(storage);
  if (!isValidStellarAccountAddress(trimmed)) {
    return existing;
  }
  const updated = [
    trimmed,
    ...existing.filter((entry) => entry !== trimmed),
  ].slice(0, MAX_RECENT_DELEGATES);

  if (storage) {
    try {
      storage.setItem(RECENT_DELEGATES_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore quota errors in private browsing modes.
    }
  }
  return updated;
}

export function clearRecentDelegates(
  storage: Pick<Storage, "removeItem"> | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(RECENT_DELEGATES_STORAGE_KEY);
  } catch {
    // Ignore storage removal errors.
  }
}

export async function executeThirdPartyDelegation(params: {
  input: string;
  connectedAccount: string;
  currentDelegatee?: string | null;
  rememberLocally?: boolean;
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  submitDelegation: (delegatee: string) => Promise<void>;
  onRefresh: () => Promise<unknown>;
}): Promise<
  | { ok: true; delegatee: string; recentDelegates: string[] }
  | { ok: false; error: string; code: ThirdPartyValidationErrorCode }
> {
  const validation = validateThirdPartyDelegatee({
    input: params.input,
    connectedAccount: params.connectedAccount,
    currentDelegatee: params.currentDelegatee,
  });

  if (!validation.valid) {
    return {
      ok: false,
      error: validation.message,
      code: validation.code,
    };
  }

  await params.submitDelegation(validation.normalizedAddress);
  const recentDelegates =
    params.rememberLocally !== false
      ? rememberRecentDelegate(validation.normalizedAddress, params.storage)
      : readRecentDelegates(params.storage);
  await params.onRefresh();

  return {
    ok: true,
    delegatee: validation.normalizedAddress,
    recentDelegates,
  };
}
