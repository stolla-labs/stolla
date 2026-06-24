"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit/sdk";
import { Networks, KitEventType } from "@creit.tech/stellar-wallets-kit/types";
import { FreighterModule } from "@creit.tech/stellar-wallets-kit/modules/freighter";

type WalletContextValue = {
  address: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTransaction: (xdr: string) => Promise<{ signedTxXdr: string }>;
  isConnecting: boolean;
};

const WalletContext = createContext<WalletContextValue | null>(null);

let kitInitialized = false;

function ensureKit() {
  if (!kitInitialized && typeof window !== "undefined") {
    StellarWalletsKit.init({
      modules: [new FreighterModule()],
      network: Networks.TESTNET,
    });
    kitInitialized = true;
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    ensureKit();
    const unsubscribe = StellarWalletsKit.on(
      KitEventType.STATE_UPDATED,
      (event) => {
        setAddress(event.payload.address ?? null);
      },
    );
    return () => unsubscribe();
  }, []);

  const connect = useCallback(async () => {
    ensureKit();
    setIsConnecting(true);
    try {
      const { address: walletAddress } = await StellarWalletsKit.authModal();
      setAddress(walletAddress);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    ensureKit();
    void StellarWalletsKit.disconnect();
    setAddress(null);
  }, []);

  const signTransaction = useCallback(async (xdr: string) => {
    ensureKit();
    return StellarWalletsKit.signTransaction(xdr, {
      networkPassphrase: Networks.TESTNET,
    });
  }, []);

  const value = useMemo(
    () => ({ address, connect, disconnect, signTransaction, isConnecting }),
    [address, connect, disconnect, signTransaction, isConnecting],
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
