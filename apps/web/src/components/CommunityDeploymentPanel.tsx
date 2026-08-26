"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TransactionLifecycleStatus } from "@/components/TransactionLifecycleStatus";
import { AppButton } from "@/components/ui/AppButton";
import { AppLinkButton } from "@/components/ui/AppLinkButton";
import { LiveStatus } from "@/components/ui/LiveStatus";
import { useWallet } from "@/context/WalletProvider";
import {
  communityDeploymentRecoveryKey,
  defaultCommunityDeploymentAdapter,
  formatStroopsAsXlm,
  isExpiredOrStaleDeploymentError,
  parseCommunityDeploymentRecovery,
  type CommunityDeploymentRecovery,
  type CommunityDeploymentSimulation,
  type DeploymentTransactionStatus,
} from "@/lib/community/deployment";
import type {
  CommunityMetadataDraft,
  GovernanceDraft,
} from "@/lib/community/schema";
import { getE2EBridge } from "@/lib/e2eMock";
import { config } from "@/lib/stellar";
import {
  buildStellarExplorerContractUrl,
  buildStellarExplorerTxUrl,
} from "@/lib/stellarExplorer";
import type { TransactionLifecycleStage } from "@/lib/transactionLifecycle";

type Props = {
  metadata: CommunityMetadataDraft;
  governance: GovernanceDraft;
  network: "testnet" | "mainnet";
  factoryId: string;
  confirmed: boolean;
};

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/reject|declin|denied/i.test(message)) {
    return "Wallet approval was declined. Your draft and simulation are preserved so you can review and try again.";
  }
  if (/insufficient|resource/i.test(message)) {
    return "Simulation found insufficient transaction resources. No wallet signature was requested.";
  }
  return message || "Community deployment failed.";
}

export function CommunityDeploymentPanel({
  metadata,
  governance,
  network,
  factoryId,
  confirmed,
}: Props) {
  const {
    address,
    signTransaction,
    walletNetwork,
    walletNetworkPassphrase,
  } = useWallet();
  const adapter = getE2EBridge()?.deployment ?? defaultCommunityDeploymentAdapter;
  const recoveryKey = communityDeploymentRecoveryKey(network);
  const [simulation, setSimulation] =
    useState<CommunityDeploymentSimulation | null>(null);
  const [stage, setStage] = useState<TransactionLifecycleStage>("idle");
  const [message, setMessage] = useState("");
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [recovery, setRecovery] =
    useState<CommunityDeploymentRecovery | null>(null);
  const [registryState, setRegistryState] = useState<
    "idle" | "checking" | "delayed" | "mismatch" | "verified"
  >("idle");
  const [knownTransactionStatus, setKnownTransactionStatus] =
    useState<DeploymentTransactionStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const previousInput = useRef("");

  const inputSignature = useMemo(
    () =>
      JSON.stringify({
        address,
        factoryId,
        metadata,
        governance,
        network,
        walletNetworkPassphrase,
      }),
    [
      address,
      factoryId,
      governance,
      metadata,
      network,
      walletNetworkPassphrase,
    ],
  );
  const networkMismatch =
    Boolean(address) &&
    walletNetworkPassphrase !== null &&
    walletNetworkPassphrase !== config.networkPassphrase;
  const walletNetworkUnknown = Boolean(address) && !walletNetworkPassphrase;

  useEffect(() => {
    if (!previousInput.current) {
      previousInput.current = inputSignature;
      return;
    }
    if (previousInput.current === inputSignature) return;
    previousInput.current = inputSignature;
    if (!transactionHash) {
      const timeout = window.setTimeout(() => {
        setSimulation(null);
        setStage("idle");
        setMessage(
          networkMismatch
            ? "Network changed. The previous simulation was invalidated; restore the expected network to continue."
            : "Deployment inputs changed. Run a fresh simulation before wallet approval.",
        );
      }, 0);
      return () => window.clearTimeout(timeout);
    }
  }, [inputSignature, networkMismatch, transactionHash]);

  const verifyExpectedRecord = useCallback(
    async (expected: CommunityDeploymentRecovery["expectedRecord"]) => {
      setRegistryState("checking");
      const result = await adapter.verifyRegistry(expected);
      if (result === "verified") {
        setRegistryState("verified");
        setStage("success");
        setMessage("The canonical registry record matches the deployed NFT and Governor contracts.");
        sessionStorage.removeItem(recoveryKey);
        window.dispatchEvent(new CustomEvent("stolla:deployment-recovery"));
        return;
      }
      if (result === "mismatch") {
        setRegistryState("mismatch");
        setStage("failure");
        setMessage(
          "The registry record does not match the simulated NFT and Governor addresses. Keep the transaction hash for diagnosis.",
        );
        return;
      }
      if (result === "rpc-error") {
        setRegistryState("delayed");
        setStage("failure");
        setMessage(
          "Registry verification could not reach RPC. The confirmed transaction hash is preserved; retry verification when RPC is available.",
        );
        return;
      }
      setRegistryState("delayed");
      setStage("confirming");
      setMessage(
        "The transaction is confirmed, but the canonical registry record is not visible yet. Retry verification without reconnecting your wallet.",
      );
    },
    [adapter, recoveryKey],
  );

  const observeTransaction = useCallback(
    async (saved: CommunityDeploymentRecovery) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setStage("confirming");
      setMessage("Checking the submitted transaction without requesting another signature.");
      try {
        const status = await adapter.transactionStatus(saved.transactionHash);
        setKnownTransactionStatus(status);
        if (status === "success") {
          await verifyExpectedRecord(saved.expectedRecord);
        } else if (status === "failed") {
          setStage("failure");
          setMessage(
            "The submitted transaction failed on-chain. Inspect the original transaction before starting a new deployment.",
          );
        } else if (status === "ambiguous") {
          setStage("failure");
          setMessage(
            "RPC status is ambiguous. No new deployment will be offered until the original transaction can be resolved.",
          );
        } else {
          setStage("confirming");
          setMessage(
            status === "not-found"
              ? "The transaction is not visible to this RPC yet. Retry status lookup; do not redeploy automatically."
              : "The transaction is still pending confirmation.",
          );
        }
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [adapter, verifyExpectedRecord],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const stored = parseCommunityDeploymentRecovery(
        sessionStorage.getItem(recoveryKey),
        network,
      );
      if (!stored) return;
      setRecovery(stored);
      setTransactionHash(stored.transactionHash);
      void observeTransaction(stored);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [network, observeTransaction, recoveryKey]);

  async function simulate() {
    if (
      inFlight.current ||
      !address ||
      !factoryId ||
      networkMismatch ||
      walletNetworkUnknown ||
      transactionHash
    ) {
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setStage("simulating");
    setMessage("Loading a fresh source sequence and Soroban resource footprint.");
    setSimulation(null);
    try {
      const result = await adapter.simulate({
        creator: address,
        communityOwner: address,
        factoryId,
        network,
        networkPassphrase: config.networkPassphrase,
        metadata,
        governance,
      });
      setSimulation(result);
      setStage("idle");
      setMessage(
        "Simulation succeeded. Review the estimated resource fee before requesting wallet approval.",
      );
    } catch (error) {
      setStage("failure");
      setMessage(friendlyError(error));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function submit() {
    if (
      inFlight.current ||
      !simulation ||
      !confirmed ||
      networkMismatch ||
      walletNetworkUnknown ||
      transactionHash
    ) {
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setStage("awaiting_approval");
    setMessage("Approve the simulated CommunityFactory invocation in your wallet.");
    try {
      const pendingSubmission = adapter.signAndSubmit(simulation, signTransaction);
      setStage("submitting");
      setMessage(
        "Wallet approval requested. The transaction will be submitted once signing succeeds.",
      );
      const submitted = await pendingSubmission;
      const saved: CommunityDeploymentRecovery = {
        version: 1,
        network,
        transactionHash: submitted.transactionHash,
        expectedRecord: simulation.expectedRecord,
        submittedAt: Date.now(),
      };
      setTransactionHash(submitted.transactionHash);
      setRecovery(saved);
      sessionStorage.setItem(recoveryKey, JSON.stringify(saved));
      window.dispatchEvent(new CustomEvent("stolla:deployment-recovery"));
      setStage("confirming");
      setMessage("Transaction submitted. Confirming it on the configured network.");
      inFlight.current = false;
      setBusy(false);
      await observeTransaction(saved);
    } catch (error) {
      setStage("failure");
      if (isExpiredOrStaleDeploymentError(error)) {
        setSimulation(null);
        setMessage(
          "The unsigned or rejected transaction expired or used a stale sequence. Rebuild it from the current draft to load a fresh sequence, timeout, and resource footprint; a new signature will be required.",
        );
      } else {
        setMessage(friendlyError(error));
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function clearFailedRecovery() {
    if (knownTransactionStatus !== "failed") return;
    sessionStorage.removeItem(recoveryKey);
    window.dispatchEvent(new CustomEvent("stolla:deployment-recovery"));
    setRecovery(null);
    setTransactionHash(null);
    setSimulation(null);
    setKnownTransactionStatus(null);
    setRegistryState("idle");
    setStage("idle");
    setMessage("Previous failed transaction acknowledged. Build a fresh deployment transaction.");
  }

  const expected = recovery?.expectedRecord ?? simulation?.expectedRecord;
  const txExplorer = buildStellarExplorerTxUrl(transactionHash, network);

  return (
    <section
      aria-labelledby="deployment-action-title"
      className="border-t border-slate-800 pt-5"
    >
      <h2 id="deployment-action-title" className="font-semibold text-slate-100">
        Simulate and deploy
      </h2>

      {(networkMismatch || walletNetworkUnknown) && (
        <LiveStatus
          tone="error"
          className="mt-3 rounded-lg border border-rose-800/70 bg-rose-950/30 p-4 text-sm text-rose-200"
        >
          Expected {network} ({config.networkPassphrase}). Detected{" "}
          {walletNetwork ?? "an unknown wallet network"} (
          {walletNetworkPassphrase ?? "passphrase unavailable"}). Simulation,
          signing, and submission are blocked. Your draft is preserved.
        </LiveStatus>
      )}

      {simulation && !transactionHash && (
        <dl className="mt-4 rounded-lg border border-emerald-800/70 bg-emerald-950/20 p-4 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-slate-400">Simulated resource fee</dt>
            <dd className="font-mono text-emerald-200">
              {simulation.feeStroops} stroops ({formatStroopsAsXlm(simulation.feeStroops)})
            </dd>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            This is a simulation estimate and can change before submission.
          </p>
        </dl>
      )}

      {message && (
        <LiveStatus
          tone={stage === "failure" ? "error" : "routine"}
          className="mt-4 rounded-lg border border-slate-700 bg-[#0b0f19] p-4 text-sm text-slate-300"
        >
          {message}
        </LiveStatus>
      )}

      <TransactionLifecycleStatus
        stage={stage}
        operationLabel="Community deployment"
        error={stage === "failure" ? message : null}
        metadata={{
          transactionHash,
          details: expected
            ? [
                { label: "Community ID", value: expected.id },
                { label: "NFT contract", value: expected.nftContract },
                { label: "Governor contract", value: expected.governorContract },
              ]
            : undefined,
        }}
        showIdle={Boolean(simulation)}
      />

      {!transactionHash && (
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void simulate()}
            disabled={
              busy ||
              !confirmed ||
              !address ||
              !factoryId ||
              networkMismatch ||
              walletNetworkUnknown ||
              stage === "simulating"
            }
            className="min-h-11 rounded-lg border border-indigo-500 px-4 py-2 text-sm font-medium text-indigo-200 hover:bg-indigo-950/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {simulation ? "Rebuild simulation" : "Simulate deployment"}
          </button>
          {simulation && (
            <AppButton
              tone="primary"
              onClick={() => void submit()}
              disabled={
                busy ||
                !confirmed ||
                networkMismatch ||
                walletNetworkUnknown ||
                stage === "awaiting_approval"
              }
            >
              Approve and deploy
            </AppButton>
          )}
        </div>
      )}

      {transactionHash && registryState !== "verified" && (
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => recovery && void observeTransaction(recovery)}
            disabled={busy}
            className="min-h-11 rounded-lg border border-indigo-500 px-4 py-2 text-sm text-indigo-200 disabled:opacity-50"
          >
            Retry transaction and registry status
          </button>
          {knownTransactionStatus === "failed" && (
            <AppButton
              tone="danger"
              onClick={clearFailedRecovery}
            >
              Acknowledge failure and rebuild
            </AppButton>
          )}
          {txExplorer && (
            <a
              href={txExplorer}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center text-sm text-indigo-300"
            >
              Inspect original transaction
            </a>
          )}
        </div>
      )}

      {registryState === "verified" && expected && (
        <section className="mt-5 rounded-xl border border-emerald-700 bg-emerald-950/30 p-5">
          <h3 className="text-lg font-semibold text-emerald-100">
            Community verified in the registry
          </h3>
          <p className="mt-2 text-sm text-emerald-200">
            The canonical ID and deployed contract pair match the
            CommunityFactory simulation.
          </p>
          <div className="mt-4 grid gap-3">
            {(
              [
                ["NFT", expected.nftContract],
                ["Governor", expected.governorContract],
              ] as const
            ).map(([label, contractId]) => (
              <div key={label} className="rounded-lg bg-slate-950/50 p-3">
                <p className="text-xs text-slate-400">{label} contract</p>
                <p className="mt-1 break-all font-mono text-xs text-slate-100">
                  {contractId}
                </p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(contractId)}
                    className="min-h-11 text-sm text-indigo-300"
                    aria-label={`Copy full ${label} contract address`}
                  >
                    Copy address
                  </button>
                  <a
                    href={buildStellarExplorerContractUrl(contractId, network) ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center text-sm text-indigo-300"
                  >
                    Open explorer
                  </a>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <AppLinkButton
              href={`/communities/${expected.id}`}
              tone="success"
            >
              View community
            </AppLinkButton>
            <AppLinkButton
              href={`/communities/${expected.id}/proposals`}
              tone="secondary"
            >
              Browse community proposals
            </AppLinkButton>
          </div>
        </section>
      )}
    </section>
  );
}
