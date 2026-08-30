"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TransactionLifecycleStatus } from "@/components/TransactionLifecycleStatus";
import { LiveStatus } from "@/components/ui/LiveStatus";
import { OnChainIdentifier } from "@/components/ui/OnChainIdentifier";
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
import { buildStellarExplorerTxUrl } from "@/lib/stellarExplorer";
import type { TransactionLifecycleStage } from "@/lib/transactionLifecycle";

type Props = {
  metadata: CommunityMetadataDraft;
  governance: GovernanceDraft;
  network: "testnet" | "mainnet";
  factoryId: string;
  confirmed: boolean;
};

export type FactoryAuthorizationStatus =
  | "checking"
  | "ready"
  | "disconnected"
  | "network-unknown"
  | "wrong-network"
  | "unauthorized"
  | "read-failed";

function authorizationMessage(status: FactoryAuthorizationStatus): string | null {
  switch (status) {
    case "ready":
      return null;
    case "checking":
      return "Checking CommunityFactory owner authorization.";
    case "disconnected":
      return "Connect your wallet to check whether this account can create a community.";
    case "network-unknown":
      return "Reading the wallet network. Deploy stays locked until it is confirmed.";
    case "wrong-network":
      return "Your wallet is on a different Stellar network. Switch it to the configured network to check creation rights.";
    case "unauthorized":
      return "Only the CommunityFactory owner can create communities during this pilot. This wallet cannot deploy one.";
    case "read-failed":
      return "Could not read the CommunityFactory owner. Retry to re-check before simulating.";
    default:
      return null;
  }
}

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
  const [ownerRead, setOwnerRead] = useState<
    | { status: "ok"; owner: string }
    | { status: "error" }
    | null
  >(null);
  const [authorizationCheck, setAuthorizationCheck] = useState(0);
  const preflightInFlight = useRef(false);
  const inFlight = useRef(false);
  const previousInput = useRef("");
  const simulationGeneration = useRef(0);

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
      simulationGeneration.current += 1;
      inFlight.current = false;
      const timeout = window.setTimeout(() => {
        setSimulation(null);
        setBusy(false);
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

  /**
   * Authorization preflight: resolve the authorization state before any
   * simulation or signature. The deterministic states (disconnected,
   * network-unknown, wrong-network, unconfigured factory) are derived during
   * render. Only when the wallet and the network are in a comparable state do
   * we read the factory owner from chain and compare it with the connected
   * address. The read is network-aware - it only runs when the wallet network
   * matches the application network, so a wrong-network wallet is reported as
   * such rather than as unauthorized. A failed read surfaces a retryable
   * "read-failed" state, never an authorization verdict.
   */
  const staticAuthorization: FactoryAuthorizationStatus | null = useMemo(() => {
    if (transactionHash) return null;
    if (!address) return "disconnected";
    if (walletNetworkUnknown) return "network-unknown";
    if (networkMismatch) return "wrong-network";
    if (!factoryId) return "read-failed";
    return null;
  }, [address, factoryId, networkMismatch, transactionHash, walletNetworkUnknown]);

  const authorization: FactoryAuthorizationStatus = useMemo(() => {
    if (staticAuthorization !== null) return staticAuthorization;
    if (ownerRead === null) return "checking";
    if (ownerRead.status === "ok") {
      return ownerRead.owner === address ? "ready" : "unauthorized";
    }
    return "read-failed";
  }, [address, ownerRead, staticAuthorization]);

  useEffect(() => {
    if (transactionHash || staticAuthorization !== null) return;
    let cancelled = false;
    if (preflightInFlight.current) return;
    preflightInFlight.current = true;
    void adapter
      .readFactoryOwner(factoryId, address ?? "")
      .then((owner) => {
        if (cancelled) return;
        setOwnerRead({ status: "ok", owner });
      })
      .catch(() => {
        if (cancelled) return;
        setOwnerRead({ status: "error" });
      })
      .finally(() => {
        preflightInFlight.current = false;
      });
    return () => {
      cancelled = true;
    };
  }, [
    adapter,
    address,
    authorizationCheck,
    factoryId,
    staticAuthorization,
    transactionHash,
  ]);

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
      authorization !== "ready" ||
      transactionHash
    ) {
      return;
    }
    const generation = ++simulationGeneration.current;
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
      if (generation !== simulationGeneration.current) {
        return;
      }
      setSimulation(result);
      setStage("idle");
      setMessage(
        "Simulation succeeded. Review the estimated resource fee before requesting wallet approval.",
      );
    } catch (error) {
      if (generation !== simulationGeneration.current) {
        return;
      }
      setStage("failure");
      setMessage(friendlyError(error));
    } finally {
      if (generation === simulationGeneration.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }

  async function submit() {
    if (
      inFlight.current ||
      !simulation ||
      !confirmed ||
      networkMismatch ||
      walletNetworkUnknown ||
      authorization !== "ready" ||
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

      {(authorization === "disconnected" ||
        authorization === "network-unknown" ||
        authorization === "unauthorized" ||
        authorization === "read-failed") && (
        <LiveStatus
          tone={authorization === "unauthorized" ? "error" : "routine"}
          className="mt-3 rounded-lg border border-amber-800/70 bg-amber-950/30 p-4 text-sm text-amber-200"
        >
          {authorizationMessage(authorization)}
          {authorization === "read-failed" && (
            <button
              type="button"
              onClick={() => {
                setOwnerRead(null);
                setAuthorizationCheck((count) => count + 1);
              }}
              className="mt-3 block min-h-11 rounded-lg border border-amber-600 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-900/50"
            >
              Retry owner check
            </button>
          )}
        </LiveStatus>
      )}

      {authorization === "checking" && (
        <LiveStatus
          tone="routine"
          className="mt-3 rounded-lg border border-slate-700 bg-[#0b0f19] p-4 text-sm text-slate-300"
        >
          {authorizationMessage("checking")}
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
              authorization !== "ready" ||
              stage === "simulating"
            }
            className="min-h-11 rounded-lg border border-indigo-500 px-4 py-2 text-sm font-medium text-indigo-200 hover:bg-indigo-950/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {simulation ? "Rebuild simulation" : "Simulate deployment"}
          </button>
          {simulation && (
            <button
              type="button"
              onClick={() => void submit()}
              disabled={
                busy ||
                !confirmed ||
                networkMismatch ||
                walletNetworkUnknown ||
                authorization !== "ready" ||
                stage === "awaiting_approval"
              }
              className="min-h-11 rounded-lg bg-indigo-500 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Approve and deploy
            </button>
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
            <button
              type="button"
              onClick={clearFailedRecovery}
              className="min-h-11 rounded-lg border border-rose-700 px-4 py-2 text-sm text-rose-200"
            >
              Acknowledge failure and rebuild
            </button>
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
              <div key={label} className="min-w-0 rounded-lg bg-slate-950/50 p-3">
                <p className="text-xs text-slate-400">{label} contract</p>
                <div className="mt-1">
                  <OnChainIdentifier
                    label={`${label} contract`}
                    value={contractId}
                    kind="contract"
                    network={network}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/communities/${expected.id}`}
              className="inline-flex min-h-11 items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
            >
              View community
            </Link>
            <Link
              href={`/communities/${expected.id}/proposals`}
              className="inline-flex min-h-11 items-center rounded-lg border border-emerald-700 px-4 py-2 text-sm text-emerald-100"
            >
              Browse community proposals
            </Link>
          </div>
        </section>
      )}
    </section>
  );
}
