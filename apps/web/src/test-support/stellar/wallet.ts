import type { SignTransaction } from "@stellar/stellar-sdk/contract";

import { MOCK_ACCOUNT_ALICE } from "./fixtures";

export type WalletMock = {
  address: string | null;
  walletNetwork: string | null;
  walletNetworkPassphrase: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTransaction: SignTransaction;
  isConnecting: boolean;
  connectionError: null;
};

export type WalletMockOptions = Partial<WalletMock> & {
  signedXdr?: string;
};

/** Creates a browser-wallet context value without loading a wallet extension. */
export function createWalletMock(options: WalletMockOptions = {}): WalletMock {
  const address = options.address === undefined ? null : options.address;
  const signTransaction: SignTransaction =
    options.signTransaction ??
    (async (xdr) => ({
      signedTxXdr: options.signedXdr ?? xdr,
      signerAddress: address ?? MOCK_ACCOUNT_ALICE,
    }));

  return {
    address,
    walletNetwork:
      options.walletNetwork === undefined ? "testnet" : options.walletNetwork,
    walletNetworkPassphrase:
      options.walletNetworkPassphrase === undefined
        ? "Test SDF Network ; September 2015"
        : options.walletNetworkPassphrase,
    connect: options.connect ?? (async () => undefined),
    disconnect: options.disconnect ?? (() => undefined),
    signTransaction,
    isConnecting: options.isConnecting ?? false,
    connectionError: null,
  };
}
