"use client";

import { useMemo } from "react";
import { useWallet } from "@/context/WalletProvider";
import { compareNetworks, type NetworkComparison } from "@/lib/network";
import { activeNetwork } from "@/lib/stellar";

/**
 * Reconciles the network the wallet reports with the one the application is
 * configured for. Every gate in the app reads this rather than the wallet
 * network directly, so mismatch handling stays in one place.
 */
export function useNetworkGuard(): NetworkComparison {
  const { walletNetwork } = useWallet();
  return useMemo(
    () => compareNetworks(activeNetwork, (walletNetwork as any) || null),
    [walletNetwork],
  );
}
