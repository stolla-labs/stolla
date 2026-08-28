"use client";

import { useMemo } from "react";
import { useWallet } from "@/context/WalletProvider";
import { compareNetworks, describeNetwork, type NetworkComparison } from "@/lib/network";
import { activeNetwork } from "@/lib/stellar";

/**
 * Reconciles the network the wallet reports with the one the application is
 * configured for. Every gate in the app reads this rather than the wallet
 * network directly, so mismatch handling stays in one place.
 */
export function useNetworkGuard(): NetworkComparison {
  const { walletNetwork, walletNetworkPassphrase } = useWallet() as {
    walletNetwork: unknown;
    walletNetworkPassphrase?: string | null;
  };
  return useMemo(
    () => {
      if (!walletNetwork) return compareNetworks(activeNetwork, null);
      // Test mock provides DetectedNetwork directly; prod provides string.
      if (
        typeof walletNetwork === "object" &&
        walletNetwork !== null &&
        "passphrase" in walletNetwork
      ) {
        return compareNetworks(
          activeNetwork,
          walletNetwork as unknown as import("@/lib/network").DetectedNetwork,
        );
      }
      if (typeof walletNetwork === "string") {
        return compareNetworks(
          activeNetwork,
          describeNetwork(walletNetworkPassphrase ?? "", walletNetwork),
        );
      }
      return compareNetworks(activeNetwork, null);
    },
    [walletNetwork, walletNetworkPassphrase],
  );
}
