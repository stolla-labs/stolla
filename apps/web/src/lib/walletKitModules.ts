/**
 * Wallet-kit module matrix for Stolla's connect → NFT balance smoke path.
 *
 * Production still initializes Freighter only. Lobstr is smoke-verified via kit
 * mocks so an alternate hot-wallet module can be selected without crashing
 * WalletProvider. Hardware and mobile deep-link modules stay out of scope.
 */

export const DEFAULT_WALLET_MODULE_ID = "freighter" as const;

/** Modules exercised by the connect → read-balance smoke matrix. */
export type SmokeVerifiedWalletModuleId = "freighter" | "lobstr";

export const SMOKE_VERIFIED_WALLET_MODULES = [
  "freighter",
  "lobstr",
] as const satisfies readonly SmokeVerifiedWalletModuleId[];

export type WalletModuleSupport =
  | "verified"
  | "unverified"
  | "unsupported";

export type WalletModuleMatrixRow = {
  id: string;
  name: string;
  kitPath: string;
  support: WalletModuleSupport;
  notes: string;
};

/**
 * Documented kit modules relevant to Stolla. Rows marked `unsupported` must
 * not be enabled in the browser entry path (see vulnerability plan for Trezor).
 */
export const WALLET_MODULE_MATRIX: readonly WalletModuleMatrixRow[] = [
  {
    id: "freighter",
    name: "Freighter",
    kitPath: "@creit.tech/stellar-wallets-kit/modules/freighter",
    support: "verified",
    notes:
      "Default production module. UI copy and unavailable-wallet errors stay Freighter-shaped.",
  },
  {
    id: "lobstr",
    name: "LOBSTR",
    kitPath: "@creit.tech/stellar-wallets-kit/modules/lobstr",
    support: "verified",
    notes:
      "Additional hot-wallet module covered by kit mocks in the smoke matrix. Not the default UI copy.",
  },
  {
    id: "xbull",
    name: "xBull",
    kitPath: "@creit.tech/stellar-wallets-kit/modules/xbull",
    support: "unverified",
    notes:
      "Installed with the wallet kit but not smoke-verified. Do not enable until the Freighter/Lobstr path is extended.",
  },
  {
    id: "albedo",
    name: "Albedo",
    kitPath: "@creit.tech/stellar-wallets-kit/modules/albedo",
    support: "unverified",
    notes: "Kit module present; no connect → balance smoke coverage.",
  },
  {
    id: "rabet",
    name: "Rabet",
    kitPath: "@creit.tech/stellar-wallets-kit/modules/rabet",
    support: "unverified",
    notes: "Kit module present; no connect → balance smoke coverage.",
  },
  {
    id: "hana",
    name: "Hana",
    kitPath: "@creit.tech/stellar-wallets-kit/modules/hana",
    support: "unverified",
    notes: "Kit module present; no connect → balance smoke coverage.",
  },
  {
    id: "trezor",
    name: "Trezor",
    kitPath: "@creit.tech/stellar-wallets-kit/modules/trezor",
    support: "unsupported",
    notes:
      "Hardware wallet. Out of scope; pulls vulnerable protobufjs via @trezor/connect. Never import in the app entry.",
  },
  {
    id: "ledger",
    name: "Ledger",
    kitPath: "@creit.tech/stellar-wallets-kit/modules/ledger",
    support: "unsupported",
    notes: "Hardware wallet browser path. Out of scope for this smoke matrix.",
  },
  {
    id: "wallet-connect",
    name: "WalletConnect",
    kitPath: "@creit.tech/stellar-wallets-kit/modules/wallet-connect",
    support: "unsupported",
    notes: "Mobile deep-link / WalletConnect path. Out of scope.",
  },
] as const;

export function isSmokeVerifiedWalletModule(
  id: string,
): id is SmokeVerifiedWalletModuleId {
  return (SMOKE_VERIFIED_WALLET_MODULES as readonly string[]).includes(id);
}

export function walletModulesBySupport(
  support: WalletModuleSupport,
): readonly WalletModuleMatrixRow[] {
  return WALLET_MODULE_MATRIX.filter((row) => row.support === support);
}

/**
 * Minimal post-connect membership balance read used by the smoke matrix.
 * Callers supply a mocked or real NFT `balance` reader; this helper only
 * normalizes the numeric result.
 */
export async function readMembershipBalance(
  address: string,
  balanceReader: (account: string) => Promise<number | bigint>,
): Promise<number> {
  const raw = await balanceReader(address);
  return typeof raw === "bigint" ? Number(raw) : raw;
}
