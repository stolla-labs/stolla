"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit/sdk";
import { Networks, KitEventType } from "@creit.tech/stellar-wallets-kit/types";
import { FreighterModule } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import type { SignTransaction } from "@stellar/stellar-sdk/contract";
import { getE2EBridge } from "@/lib/e2eMock";
import { activeNetwork } from "@/lib/stellar";
import { describeNetwork } from "@/lib/network";

export type WalletConnectionError = {
  code: "request-rejected" | "wallet-unavailable" | "connection-failed";
  message: string;
};

type WalletContextValue = {
  address: string | null;
  walletNetwork?: string | null;
  walletNetworkPassphrase?: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTransaction: SignTransaction;
  isConnecting: boolean;
  connectionError: WalletConnectionError | null;
};

const WalletContext = createContext<WalletContextValue | null>(null);

let kitInitialized = false;
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

function ensureKit() {
  if (!kitInitialized && typeof window !== "undefined") {
    StellarWalletsKit.init({
      modules: [new FreighterModule()],
      network:
        activeNetwork.id === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
    });
    kitInitialized = true;
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [walletNetwork, setWalletNetwork] = useState<string | null>(null);
  const [walletNetworkPassphrase, setWalletNetworkPassphrase] = useState<
    string | null
  >(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] =
    useState<WalletConnectionError | null>(null);
  const connectInFlightRef = useRef(false);

  useEffect(() => {
    const mockedWallet = getE2EBridge()?.wallet;
    if (mockedWallet) {
      const initialize = window.setTimeout(() => {
        setAddress(mockedWallet.address);
        setWalletNetworkPassphrase(mockedWallet.networkPassphrase);
        setWalletNetwork(describeNetwork(mockedWallet.networkPassphrase).id);
      }, 0);
      const interval = window.setInterval(() => {
        const current = getE2EBridge()?.wallet;
        if (!current) return;
        setAddress(current.address);
        setWalletNetworkPassphrase(current.networkPassphrase);
        setWalletNetwork(describeNetwork(current.networkPassphrase).id);
      }, 100);
      return () => {
        window.clearTimeout(initialize);
        window.clearInterval(interval);
      };
    }
    ensureKit();
    const unsubscribe = StellarWalletsKit.on(
      KitEventType.STATE_UPDATED,
      (event) => {
        const updatedAddress = event.payload.address ?? null;
        setAddress(updatedAddress);
        setWalletNetworkPassphrase(event.payload.networkPassphrase || null);
        setWalletNetwork(
          event.payload.networkPassphrase
            ? describeNetwork(event.payload.networkPassphrase).id ?? "custom"
            : null,
        );
        if (updatedAddress) {
          setConnectionError(null);
        }
      },
    );
    return () => unsubscribe();
  }, []);

  const connect = useCallback(async () => {
    if (connectInFlightRef.current) return;
    connectInFlightRef.current = true;
    setConnectionError(null);
    setIsConnecting(true);
    try {
      if (
        process.env.NEXT_PUBLIC_E2E_WALLET === "mock" &&
        window.__stollaMockWallet
      ) {
        const { MockWalletModule } = await import(
          "@/testing/mockWalletModule"
        );
        const wallet = new MockWalletModule();
        const [{ address: walletAddress }, selectedNetwork] = await Promise.all([
          wallet.getAddress(),
          wallet.getNetwork(),
        ]);
        setAddress(walletAddress);
        setWalletNetwork(selectedNetwork.network);
        setWalletNetworkPassphrase(selectedNetwork.networkPassphrase);
        return;
      }
      const mockedWallet = getE2EBridge()?.wallet;
      if (mockedWallet) {
        setAddress(mockedWallet.address);
        setWalletNetworkPassphrase(mockedWallet.networkPassphrase);
        setWalletNetwork(describeNetwork(mockedWallet.networkPassphrase).id);
        return;
      }
      ensureKit();
      const { address: walletAddress } = await StellarWalletsKit.authModal();
      const selectedNetwork =
        typeof StellarWalletsKit.getNetwork === "function"
          ? await StellarWalletsKit.getNetwork()
          : {
              network: activeNetwork.id,
              networkPassphrase: activeNetwork.networkPassphrase,
            };
      setAddress(walletAddress);
      setWalletNetwork(selectedNetwork.network);
      setWalletNetworkPassphrase(selectedNetwork.networkPassphrase);
      setConnectionError(null);
    } catch (error) {
      const safeError = toWalletConnectionError(error);
      setConnectionError(safeError);
      if (safeError) {
        console.error("Wallet connect failed:", safeError.code);
      }
    } finally {
      connectInFlightRef.current = false;
      setIsConnecting(false);
    }
  }, []);
  const disconnect = useCallback(() => {
    if (getE2EBridge()?.wallet) {
      setAddress(null);
      setWalletNetwork(null);
      setWalletNetworkPassphrase(null);
      return;
    }
    ensureKit();
    void StellarWalletsKit.disconnect();
    setAddress(null);
    setConnectionError(null);
  }, []);

  const signTransaction = useCallback<SignTransaction>(async (xdr, options) => {
    if (
      process.env.NEXT_PUBLIC_E2E_WALLET === "mock" &&
      window.__stollaMockWallet
    ) {
      const { MockWalletModule } = await import("@/testing/mockWalletModule");
      return new MockWalletModule().signTransaction(xdr, options);
    }
    const mockedWallet = getE2EBridge()?.wallet;
    if (mockedWallet) {
      if (mockedWallet.rejected) throw new Error("User rejected the request.");
      if (
        options?.networkPassphrase &&
        options.networkPassphrase !== mockedWallet.networkPassphrase
      ) {
        throw new Error("Wallet network does not match the transaction network.");
      }
      if (mockedWallet.secretKey) {
        const networkPassphrase =
          options?.networkPassphrase ?? mockedWallet.networkPassphrase;
        const { Keypair, TransactionBuilder } = await import(
          "@stellar/stellar-sdk"
        );
        const transaction = TransactionBuilder.fromXDR(xdr, networkPassphrase);
        transaction.sign(Keypair.fromSecret(mockedWallet.secretKey));
        (mockedWallet.signedNetworkPassphrases ??= []).push(networkPassphrase);
        return {
          signedTxXdr: transaction.toXDR(),
          signerAddress: mockedWallet.address,
        };
      }
      return { signedTxXdr: xdr, signerAddress: mockedWallet.address };
    }
    if (
      walletNetworkPassphrase &&
      walletNetworkPassphrase !== activeNetwork.networkPassphrase
    ) {
      throw new Error("Wallet network does not match the application network.");
    }
    ensureKit();
    return StellarWalletsKit.signTransaction(xdr, {
      ...options,
      networkPassphrase: activeNetwork.networkPassphrase,
    });
  }, [walletNetworkPassphrase]);

  const value = useMemo(
    () => ({
      address,
      walletNetwork,
      walletNetworkPassphrase,
      connect,
      disconnect,
      signTransaction,
      isConnecting,
      connectionError,
    }),
    [
      address,
      walletNetwork,
      walletNetworkPassphrase,
      connect,
      disconnect,
      signTransaction,
      isConnecting,
      connectionError,
    ],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return context;
}
