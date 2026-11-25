"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@/context/WalletProvider";
import {
  compareNetworks,
  describeNetwork,
  NETWORKS,
  type ActiveNetworkId,
  type NetworkCapabilities,
} from "@/lib/network";
import {
  buildRehearsalChecklist,
  readRehearsalConfirmations,
  rehearsalVerdict,
  toggleRehearsalConfirmation,
  writeRehearsalConfirmations,
  type RehearsalCheckId,
} from "@/lib/mainnet/rehearsal";

/**
 * The launch rehearsal for one deployment, and whether it blocks.
 *
 * The confirmations are device-local on purpose: they are a statement by the
 * person at the keyboard about things only they can see — an account balance,
 * a trustline, who carries the pager. Storing them per network means a Testnet
 * rehearsal never confirms anything for Mainnet.
 */
export function useMainnetRehearsal({
  networkId,
  capabilities,
}: {
  networkId: ActiveNetworkId;
  capabilities: NetworkCapabilities;
}) {
  const { address, walletNetwork: walletNetworkName, walletNetworkPassphrase } =
    useWallet();
  const [confirmed, setConfirmed] = useState<RehearsalCheckId[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConfirmed(readRehearsalConfirmations(networkId));
  }, [networkId]);

  const walletComparison = useMemo(() => {
    /* No wallet at all is a different answer from a wallet that would not say:
       the first asks the creator to connect, the second to reconnect. */
    if (!address) return null;
    return compareNetworks(
      NETWORKS[networkId],
      walletNetworkPassphrase
        ? describeNetwork(walletNetworkPassphrase, walletNetworkName ?? undefined)
        : null,
    );
  }, [address, networkId, walletNetworkName, walletNetworkPassphrase]);

  const checks = useMemo(
    () =>
      buildRehearsalChecklist({
        networkId,
        capabilities,
        walletNetwork: walletComparison,
        confirmed,
      }),
    [capabilities, confirmed, networkId, walletComparison],
  );

  const verdict = useMemo(() => rehearsalVerdict(checks), [checks]);

  const toggle = useCallback(
    (id: RehearsalCheckId) => {
      setConfirmed((current) => {
        const next = toggleRehearsalConfirmation(current, id);
        writeRehearsalConfirmations(networkId, next);
        return next;
      });
    },
    [networkId],
  );

  return { checks, verdict, confirmed, toggle };
}
