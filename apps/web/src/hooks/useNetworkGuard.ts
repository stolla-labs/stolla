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
 *
 * WalletProvider exposes `walletNetwork` as a short id string ("testnet") and
 * the passphrase separately. Comparison must use the passphrase via
 * `describeNetwork` — passing the id string into `compareNetworks` treats it as
 * a DetectedNetwork object and always reports a false mismatch.
 */
export function useNetworkGuard(): NetworkComparison {
  const { walletNetwork, walletNetworkPassphrase } = useWallet();
  return useMemo(() => {
    const detected = walletNetworkPassphrase
      ? describeNetwork(
          walletNetworkPassphrase,
          walletNetwork ?? undefined,
        )
      : null;
    return compareNetworks(activeNetwork, detected);
  }, [walletNetwork, walletNetworkPassphrase]);
}
