"use client";

import { useMemo } from "react";
import { useWallet } from "@/context/WalletProvider";
import {
  compareNetworks,
  describeNetwork,
  type DetectedNetwork,
  type NetworkComparison,
} from "@/lib/network";
import { activeCapabilities } from "@/lib/stellar";

/**
 * Reconciles the network the wallet reports with the one the application is
 * configured for. Every gate in the app reads this rather than the wallet
 * network directly, so mismatch handling stays in one place.
 */
export function useNetworkGuard(): NetworkComparison {
  const { walletNetwork, walletNetworkPassphrase } = useWallet();
  return useMemo(
    () => {
      // Older test/E2E adapters supplied the already-detected object. Keep the
      // transition safe while production wallet state uses the passphrase.
      const legacyDetected =
        typeof walletNetwork === "object" && walletNetwork !== null
          ? (walletNetwork as DetectedNetwork)
          : null;
      const detected = walletNetworkPassphrase
        ? describeNetwork(
            walletNetworkPassphrase,
            typeof walletNetwork === "string" ? walletNetwork : undefined,
          )
        : legacyDetected;
      return compareNetworks(activeCapabilities.network, detected);
    },
    [walletNetwork, walletNetworkPassphrase],
  );
}
