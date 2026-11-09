export type WalletSupportTier = "verified-default" | "verified-secondary" | "unsupported";

export type WalletConnectionError = {
  code: "request-rejected" | "wallet-unavailable" | "connection-failed";
  message: string;
};

const MODAL_DISMISSED_MESSAGE = "The user closed the modal.";

function walletErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return {
      code: undefined,
      message: typeof error === "string" ? error : "",
    };
  }

  const errorLike = error as {
    code?: unknown;
    message?: unknown;
    error?: { code?: unknown; message?: unknown };
  };
  const nestedError =
    errorLike.error && typeof errorLike.error === "object"
      ? errorLike.error
      : undefined;

  return {
    code:
      typeof nestedError?.code === "number"
        ? nestedError.code
        : typeof errorLike.code === "number"
          ? errorLike.code
          : undefined,
    message:
      typeof nestedError?.message === "string"
        ? nestedError.message
        : typeof errorLike.message === "string"
          ? errorLike.message
          : "",
  };
}

export function toWalletConnectionError(
  error: unknown,
): WalletConnectionError | null {
  const { code, message } = walletErrorDetails(error);

  if (message === MODAL_DISMISSED_MESSAGE) {
    return null;
  }

  if (code === -4 || /reject|declin|denied/i.test(message)) {
    return {
      code: "request-rejected",
      message:
        "Connection request declined. Approve the request in your wallet to connect.",
    };
  }

  if (
    /not (?:installed|connected|available)|unavailable|unsupported|no wallet/i.test(
      message,
    )
  ) {
    return {
      code: "wallet-unavailable",
      message:
        "Freighter is unavailable. Install or unlock the wallet, then try again.",
    };
  }

  return {
    code: "connection-failed",
    message: "We couldn't connect to your wallet. Please try again.",
  };
}

export type WalletModuleMatrixEntry = {
  productId: string;
  productName: string;
  supportTier: WalletSupportTier;
  isDefault: boolean;
  supportsConnect: boolean;
  supportsReadBalance: boolean;
  supportsSorobanSignTransaction: boolean;
  notes: string;
};

export const DEFAULT_WALLET_PRODUCT_ID = "freighter";
export const SECONDARY_VERIFIED_WALLET_PRODUCT_ID = "xbull";

export const WALLET_COMPATIBILITY_MATRIX: readonly WalletModuleMatrixEntry[] = [
  {
    productId: "freighter",
    productName: "Freighter",
    supportTier: "verified-default",
    isDefault: true,
    supportsConnect: true,
    supportsReadBalance: true,
    supportsSorobanSignTransaction: true,
    notes: "Primary browser extension wallet; default in UI copy and Playwright smoke flows.",
  },
  {
    productId: "xbull",
    productName: "xBull",
    supportTier: "verified-secondary",
    isDefault: false,
    supportsConnect: true,
    supportsReadBalance: true,
    supportsSorobanSignTransaction: true,
    notes: "Verified secondary Stellar Wallets Kit hot-wallet module via smoke matrix.",
  },
  {
    productId: "lobstr",
    productName: "LOBSTR",
    supportTier: "unsupported",
    isDefault: false,
    supportsConnect: false,
    supportsReadBalance: false,
    supportsSorobanSignTransaction: false,
    notes: "Unverified for multi-step Soroban governance simulation/signing in v1.",
  },
  {
    productId: "trezor",
    productName: "Trezor Hardware Wallet",
    supportTier: "unsupported",
    isDefault: false,
    supportsConnect: false,
    supportsReadBalance: false,
    supportsSorobanSignTransaction: false,
    notes: "Out of scope: browser hardware bridge dependencies and Soroban host function signing are unsupported.",
  },
  {
    productId: "walletconnect",
    productName: "Mobile Deep-Link / WalletConnect",
    supportTier: "unsupported",
    isDefault: false,
    supportsConnect: false,
    supportsReadBalance: false,
    supportsSorobanSignTransaction: false,
    notes: "Out of scope: mobile deep-link session resumption is not enabled in v1.",
  },
] as const;

export type KitLikeWalletModule = {
  productId: string;
  productName: string;
  isAvailable: () => Promise<boolean>;
  getAddress: () => Promise<{ address: string }>;
  getNetwork: () => Promise<{ network: string; networkPassphrase: string }>;
  signTransaction: (
    xdr: string,
    opts?: { networkPassphrase?: string; address?: string },
  ) => Promise<{ signedTxXdr: string; signerAddress?: string }>;
};

export type WalletSmokeSessionResult = {
  productId: string;
  productName: string;
  address: string;
  network: string;
  networkPassphrase: string;
  votingPowerBalance: bigint;
};

export function getVerifiedWalletEntries(): WalletModuleMatrixEntry[] {
  return WALLET_COMPATIBILITY_MATRIX.filter(
    (entry) =>
      entry.supportTier === "verified-default" ||
      entry.supportTier === "verified-secondary",
  );
}

export function getUnsupportedWalletEntries(): WalletModuleMatrixEntry[] {
  return WALLET_COMPATIBILITY_MATRIX.filter(
    (entry) => entry.supportTier === "unsupported",
  );
}

export function isVerifiedWalletProductId(productId: string): boolean {
  const normalized = productId.trim().toLowerCase();
  return getVerifiedWalletEntries().some(
    (entry) => entry.productId.toLowerCase() === normalized,
  );
}

export async function runWalletModuleSmokePath(
  module: KitLikeWalletModule,
  readBalance: (address: string) => Promise<bigint>,
): Promise<WalletSmokeSessionResult> {
  if (!isVerifiedWalletProductId(module.productId)) {
    throw new Error(
      `Wallet module "${module.productId}" is not in the verified smoke matrix. Use Freighter (default) or xBull.`,
    );
  }

  const available = await module.isAvailable();
  if (!available) {
    throw new Error(
      `${module.productName} is unavailable. Install or unlock Freighter (or another supported wallet), then try again.`,
    );
  }

  const [{ address }, { network, networkPassphrase }] = await Promise.all([
    module.getAddress(),
    module.getNetwork(),
  ]);

  if (!address || !address.startsWith("G") || address.length !== 56) {
    throw new Error(
      `${module.productName} returned an invalid Stellar public key.`,
    );
  }

  const votingPowerBalance = await readBalance(address);

  return {
    productId: module.productId,
    productName: module.productName,
    address,
    network,
    networkPassphrase,
    votingPowerBalance,
  };
}
