"use client";

import { useMemo } from "react";
import { useWallet } from "@/context/WalletProvider";
import {
  compareNetworks,
  describeNetwork,
  type NetworkComparison,
} from "@/lib/network";
import { activeNetwork } from "@/lib/stellar";

/**
 * Reconciles the network the wallet reports with the one the application is
 * configured for. Every gate in the app reads this rather than the wallet
 * network directly, so mismatch handling stays in one place.
 */
export function useNetworkGuard(): NetworkComparison {
  const { walletNetwork, walletNetworkPassphrase } = useWallet();
  return useMemo(() => {
    const detected = walletNetworkPassphrase
      ? describeNetwork(walletNetworkPassphrase, walletNetwork ?? undefined)
      : null;
    return compareNetworks(activeNetwork, detected);
  }, [walletNetwork, walletNetworkPassphrase]);
}
