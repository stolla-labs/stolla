"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useWallet } from "@/context/WalletProvider";
import {
  createCommunityFactoryClient,
  getStoredCommunityDeploymentHash,
  storeCommunityDeploymentHash,
} from "@/lib/contracts";
import { config } from "@/lib/stellar";
import {
  deployCommunityFromWizard,
  type DeploymentStage,
  type DeployCommunityOutcome,
} from "./deployment";
import { toCommunityDeploymentError } from "./errors";
import type { CommunityWizardState } from "./types";

const stageLabels: Record<DeploymentStage, string> = {
  idle: "Ready to deploy.",
  serializing: "Preparing CommunityFactory arguments.",
  simulating: "Simulating CommunityFactory deployment.",
  awaiting_wallet: "Waiting for wallet authorization.",
  submitting: "Submitting signed transaction.",
  success: "Community deployment submitted.",
  error: "Community deployment failed.",
};

export function useCommunityDeployment() {
  const { address, walletNetworkPassphrase, signTransaction } = useWallet();
  const activeSubmissionRef = useRef(false);
  const [stage, setStage] = useState<DeploymentStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<DeployCommunityOutcome | null>(null);
  const [storedHash, setStoredHash] = useState<string | null>(() =>
    getStoredCommunityDeploymentHash(),
  );

  const isSubmitting = !["idle", "success", "error"].includes(stage);

  const status = useMemo(() => {
    if (error) return error;
    if (outcome?.hash) return `Transaction hash: ${outcome.hash}`;
    return stageLabels[stage];
  }, [error, outcome, stage]);

  const deploy = useCallback(
    async (state: CommunityWizardState) => {
      if (activeSubmissionRef.current || isSubmitting) return null;

      activeSubmissionRef.current = true;
      setError(null);
      setOutcome(null);
      try {
        const nextOutcome = await deployCommunityFromWizard(state, {
          address,
          expectedNetworkPassphrase: config.networkPassphrase,
          walletNetworkPassphrase,
          createClient: () =>
            createCommunityFactoryClient({
              publicKey: address ?? "",
              signTransaction,
            }),
          storeHash: (hash) => {
            storeCommunityDeploymentHash(hash);
            setStoredHash(hash);
          },
          onStage: setStage,
        });
        setOutcome(nextOutcome);
        return nextOutcome;
      } catch (caught) {
        const deploymentError = toCommunityDeploymentError(caught, "unknown");
        setStage("error");
        setError(deploymentError.message);
        return null;
      } finally {
        activeSubmissionRef.current = false;
      }
    },
    [address, isSubmitting, walletNetworkPassphrase, signTransaction],
  );

  return {
    deploy,
    error,
    isSubmitting,
    stage,
    status,
    transactionHash: outcome?.hash ?? storedHash,
  };
}
