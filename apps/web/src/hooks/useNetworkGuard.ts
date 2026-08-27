"use client";

import { useMemo } from "react";
import { useWallet } from "@/context/WalletProvider";
import { compareNetworks, describeNetwork, type NetworkComparison } from "@/lib/network";
import { activeNetwork } from "@/lib/stellar";

export function useNetworkGuard(): NetworkComparison {
  const { walletNetworkPassphrase, walletNetwork } = useWallet();
  return useMemo(() => {
    const detected = walletNetworkPassphrase 
      ? describeNetwork(walletNetworkPassphrase, walletNetwork ?? undefined) 
      : null;
    return compareNetworks(activeNetwork, detected);
  }, [walletNetworkPassphrase, walletNetwork]);
}
