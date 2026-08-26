"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Ref,
  type ReactNode,
} from "react";
import { useWallet } from "@/context/WalletProvider";
import { useNetworkGuard } from "@/hooks/useNetworkGuard";
import { NetworkMismatchNotice } from "@/components/NetworkMismatchNotice";
import {
  CREATION_STEPS,
  CREATION_DRAFT_STORAGE_KEY,
  CREATION_SUBMISSION_STORAGE_KEY,
  INITIAL_CREATION_STATE,
  creationReducer,
  deploymentBlocker,
  deploymentStage,
  isDraftComplete,
  isDraftDirty,
  readPersistedDraft,
  readPersistedSubmission,
  simulationBlocker,
  type CommunityDraft,
  type CommunityRegistryEntry,
  type CommunitySimulation,
  type CreationBlocker,
  type CreationContext,
  type CreationStep,
  type DeploymentStage,
} from "@/lib/community-creation";
import {
  confirmCommunityDeployment,
  simulateCommunityDeployment,
  submitCommunityDeployment,
  verifyCommunityRegistry,
} from "@/lib/community-factory";
import {
  contractUrl,
  findNetworkByPassphrase,
  transactionUrl,
  type NetworkComparison,
} from "@/lib/network";
import { activeNetwork, config, contractIds } from "@/lib/stellar";

export type CommunityDeploymentPort = {
  simulate: (admin: string, draft: CommunityDraft) => Promise<CommunitySimulation>;
  submit: (simulation: CommunitySimulation) => Promise<string>;
  confirm: (transactionHash: string) => Promise<void>;
  verify: (admin: string) => Promise<CommunityRegistryEntry>;
};

const PROGRESS_STAGES: { stage: DeploymentStage; label: string }[] = [
  { stage: "simulated", label: "Simulated" },
  { stage: "awaiting-approval", label: "Approved in wallet" },
  { stage: "submitted", label: "Submitted" },
  { stage: "confirmed", label: "Confirmed on chain" },
  { stage: "verified", label: "Verified in registry" },
];

const STEP_LABELS: Record<CreationStep, string> = {
  metadata: "Metadata",
  governance: "Governance",
  review: "Review",
  deploy: "Deploy",
};

const METADATA_FIELDS = [
  { key: "name", label: "Community name", placeholder: "Stolla Builders" },
  { key: "symbol", label: "Token symbol", placeholder: "STBL" },
  { key: "metadataUri", label: "IPFS metadata URI", placeholder: "ipfs://Qm..." },
] as const;

const GOVERNANCE_FIELDS = [
  { key: "votingDelay", label: "Voting delay", unit: "ledgers" },
  { key: "votingPeriod", label: "Voting period", unit: "ledgers" },
  { key: "proposalThreshold", label: "Proposal threshold", unit: "votes" },
  { key: "quorum", label: "Quorum", unit: "votes" },
] as const;

function blockerMessage(
  blocker: CreationBlocker,
  comparison: NetworkComparison,
): string {
  switch (blocker) {
    case "wallet-disconnected":
      return "Connect your wallet to continue.";
    case "network-unknown":
      return "Reading the wallet network. Deployment stays locked until it is confirmed.";
    case "network-mismatch":
      return `Your wallet is on ${comparison.detected?.label ?? "another network"}. Switch it back to ${comparison.expected.label} to continue.`;
    case "already-submitted":
      return "This community has already been submitted.";
    case "submission-in-progress":
      return "A deployment is already awaiting wallet approval.";
    case "factory-unconfigured":
      return "Set NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID before deploying.";
    case "draft-incomplete":
      return "Complete the metadata and governance steps first.";
    case "simulation-required":
      return "Run a simulation before deploying.";
    case "simulation-stale":
      return "The simulation was built on a different network. Simulate again.";
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function CreateCommunityWizard({
  deployment,
}: {
  deployment?: CommunityDeploymentPort;
}) {
  const { address, signTransaction } = useWallet();
  const comparison = useNetworkGuard();
  const [state, dispatch] = useReducer(creationReducer, INITIAL_CREATION_STATE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const hydratedRef = useRef(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const detectedPassphrase = comparison.detected?.passphrase ?? null;

  useEffect(() => {
    dispatch({ type: "network-detected", passphrase: detectedPassphrase });
  }, [detectedPassphrase]);

  useEffect(() => {
    dispatch({
      type: "state-restored",
      draftState: readPersistedDraft(sessionStorage),
      submission: readPersistedSubmission(sessionStorage),
    });
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    if (isDraftDirty(state.draft)) {
      sessionStorage.setItem(
        CREATION_DRAFT_STORAGE_KEY,
        JSON.stringify({ step: state.step, draft: state.draft }),
      );
    } else {
      sessionStorage.removeItem(CREATION_DRAFT_STORAGE_KEY);
    }
  }, [state.draft, state.step]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    if (state.submission) {
      sessionStorage.setItem(
        CREATION_SUBMISSION_STORAGE_KEY,
        JSON.stringify(state.submission),
      );
    }
  }, [state.submission]);

  const port = useMemo<CommunityDeploymentPort>(
    () =>
      deployment ?? {
        simulate: (admin, draft) =>
          simulateCommunityDeployment({
            network: activeNetwork,
            rpcUrl: config.rpcUrl,
            factoryAddress: contractIds.factory,
            admin,
            draft,
          }),
        submit: (simulation) =>
          submitCommunityDeployment({
            simulation,
            network: activeNetwork,
            rpcUrl: config.rpcUrl,
            signTransaction,
          }),
        confirm: (transactionHash) =>
          confirmCommunityDeployment(config.rpcUrl, transactionHash),
        verify: (admin) =>
          verifyCommunityRegistry({
            network: activeNetwork,
            rpcUrl: config.rpcUrl,
            factoryAddress: contractIds.factory,
            admin,
          }),
      },
    [deployment, signTransaction],
  );

  const context: CreationContext = {
    walletConnected: Boolean(address),
    comparison,
    factoryConfigured: Boolean(contractIds.factory),
  };

  const simulateBlocker = simulationBlocker(state, context);
  const deployBlocker = deploymentBlocker(state, context);

  const updateDraft = useCallback(
    (changes: Partial<CommunityDraft>) =>
      dispatch({ type: "draft-changed", changes }),
    [],
  );

  async function handleSimulate() {
    if (simulateBlocker || !address) return;
    setBusy(true);
    setError(null);
    try {
      const simulation = await port.simulate(address, state.draft);
      dispatch({ type: "simulation-succeeded", simulation });
    } catch (caught) {
      setError(errorMessage(caught, "Simulation failed."));
    } finally {
      setBusy(false);
    }
  }

  /**
   * State updates are batched, so two clicks in the same tick would both pass
   * the blocker check. The ref closes that window before any signature request.
   */
  const deployingRef = useRef(false);

  async function handleDeploy() {
    const simulation = state.simulation;
    if (deployBlocker || !simulation || !address || deployingRef.current) return;

    deployingRef.current = true;
    dispatch({ type: "signing-started" });
    setError(null);

    try {
      const transactionHash = await port.submit(simulation);
      dispatch({
        type: "submission-recorded",
        submission: {
          networkPassphrase: simulation.networkPassphrase,
          transactionHash,
          status: "pending",
          registry: null,
        },
      });

      try {
        await port.confirm(transactionHash);
        dispatch({ type: "submission-settled", status: "confirmed" });
        const registry = await port.verify(address);
        dispatch({ type: "registry-verified", registry });
      } catch (caught) {
        const message = errorMessage(caught, "Confirmation failed.");
        dispatch({ type: "submission-settled", status: "failed", message });
        setError(message);
      }
    } catch (caught) {
      dispatch({ type: "signing-ended" });
      setError(errorMessage(caught, "Deployment failed."));
    } finally {
      deployingRef.current = false;
    }
  }

  const stage = deploymentStage(state);
  const stepIndex = CREATION_STEPS.indexOf(state.step);
  const goToStep = (step: CreationStep) => dispatch({ type: "step-changed", step });

  function restartWizard() {
    sessionStorage.removeItem(CREATION_DRAFT_STORAGE_KEY);
    dispatch({ type: "draft-discarded" });
    setError(null);
    setConfirmingDiscard(false);
    requestAnimationFrame(() => firstFieldRef.current?.focus());
  }

  function handleDiscard() {
    if (isDraftDirty(state.draft)) {
      setConfirmingDiscard(true);
      return;
    }
    restartWizard();
  }

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2 text-sm">
        {CREATION_STEPS.map((step, index) => (
          <li key={step}>
            <button
              type="button"
              onClick={() => goToStep(step)}
              aria-current={step === state.step ? "step" : undefined}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                step === state.step
                  ? "bg-indigo-950 font-medium text-indigo-300"
                  : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-100"
              }`}
            >
              {index + 1}. {STEP_LABELS[step]}
            </button>
          </li>
        ))}
      </ol>

      <NetworkMismatchNotice
        comparison={comparison}
        consequence="Your draft is kept, but the simulation was discarded and must be run again."
      />

      {state.step === "metadata" && (
        <Panel title="Community metadata">
          {METADATA_FIELDS.map((field, index) => (
            <TextField
              key={field.key}
              inputRef={index === 0 ? firstFieldRef : undefined}
              label={field.label}
              placeholder={field.placeholder}
              value={state.draft[field.key]}
              onChange={(value) => updateDraft({ [field.key]: value })}
            />
          ))}
        </Panel>
      )}

      {state.step === "governance" && (
        <Panel title="Governance parameters">
          {GOVERNANCE_FIELDS.map((field) => (
            <TextField
              key={field.key}
              label={`${field.label} (${field.unit})`}
              inputMode="numeric"
              value={state.draft[field.key]}
              onChange={(value) => updateDraft({ [field.key]: value })}
            />
          ))}
        </Panel>
      )}

      {state.step === "review" && (
        <Panel title="Review">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {[...METADATA_FIELDS, ...GOVERNANCE_FIELDS].map((field) => (
              <div key={field.key}>
                <dt className="text-slate-500">
                  {field.label}
                  {"unit" in field ? ` (${field.unit})` : ""}
                </dt>
                <dd className="break-all font-medium text-slate-100">
                  {state.draft[field.key] || "—"}
                </dd>
              </div>
            ))}
          </dl>
          <NetworkFacts comparison={comparison} address={address} />
        </Panel>
      )}

      {state.step === "deploy" && (
        <Panel title="Simulate and deploy">
          <NetworkFacts comparison={comparison} address={address} />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSimulate}
              disabled={Boolean(simulateBlocker) || busy}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
            >
              {busy ? "Simulating..." : "Simulate deployment"}
            </button>
            <button
              type="button"
              onClick={handleDeploy}
              disabled={Boolean(deployBlocker)}
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
            >
              {state.signing ? "Awaiting wallet..." : "Sign and deploy"}
            </button>
          </div>

          {deployBlocker && (
            <p className="text-sm text-amber-200">
              {blockerMessage(deployBlocker, comparison)}
            </p>
          )}

          {state.simulation && (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Simulated on</dt>
                <dd className="font-medium text-slate-100">
                  {findNetworkByPassphrase(state.simulation.networkPassphrase)
                    ?.label ?? "Unrecognized network"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Minimum resource fee</dt>
                <dd className="font-medium text-slate-100">
                  {state.simulation.minResourceFee} stroops
                </dd>
              </div>
            </dl>
          )}

          {state.submission && (
            <>
              <DeploymentProgress stage={stage} />
              <SubmissionSummary
                transactionHash={state.submission.transactionHash}
                networkPassphrase={state.submission.networkPassphrase}
              />
            </>
          )}

          {state.submission?.registry && (
            <CommunityCreated registry={state.submission.registry} />
          )}
        </Panel>
      )}

      {error && (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      )}

      {confirmingDiscard && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="discard-draft-title"
          aria-describedby="discard-draft-description"
          className="rounded-xl border border-rose-900/70 bg-rose-950/30 p-5"
        >
          <h2 id="discard-draft-title" className="font-semibold text-slate-100">
            Discard this draft?
          </h2>
          <p id="discard-draft-description" className="mt-2 text-sm text-slate-300">
            Your unsent community details and validation errors will be removed.
            Submitted transaction recovery information is kept separately.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              autoFocus
              onClick={() => setConfirmingDiscard(false)}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200"
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={restartWizard}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white"
            >
              Discard draft
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => goToStep(CREATION_STEPS[stepIndex - 1])}
          disabled={stepIndex === 0}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
        >
          Back
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleDiscard}
            className="rounded-lg border border-rose-900 px-4 py-2 text-sm text-rose-300 transition hover:bg-rose-950/40"
          >
            Discard draft
          </button>
          <button
            type="button"
            onClick={() => goToStep(CREATION_STEPS[stepIndex + 1])}
            disabled={
              stepIndex === CREATION_STEPS.length - 1 ||
              (state.step === "governance" && !isDraftComplete(state.draft))
            }
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-[#151b2b] p-5">
      <h2 className="font-semibold text-slate-100">{title}</h2>
      {children}
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  inputRef,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: "numeric";
  inputRef?: Ref<HTMLInputElement>;
}) {
  return (
    <label className="block text-sm">
      <span className="text-slate-400">{label}</span>
      <input
        ref={inputRef}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 font-mono text-sm text-slate-100 placeholder:text-slate-600"
      />
    </label>
  );
}

/**
 * Wallet, network and factory address, with the factory link built from the
 * application network so it can never point at whatever the wallet moved to.
 */
function NetworkFacts({
  comparison,
  address,
}: {
  comparison: NetworkComparison;
  address: string | null;
}) {
  const factoryLink = contractUrl(activeNetwork, contractIds.factory);

  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-slate-500">Wallet</dt>
        <dd className="break-all font-mono text-slate-100">{address ?? "—"}</dd>
      </div>
      <div>
        <dt className="text-slate-500">Application network</dt>
        <dd className="font-medium text-slate-100">
          {comparison.expected.label}
        </dd>
      </div>
      <div>
        <dt className="text-slate-500">Wallet network</dt>
        <dd
          className={`font-medium ${
            comparison.status === "mismatch" ? "text-amber-300" : "text-slate-100"
          }`}
        >
          {comparison.detected?.label ?? "Unknown"}
        </dd>
      </div>
      <div>
        <dt className="text-slate-500">CommunityFactory</dt>
        <dd className="break-all font-mono text-slate-100">
          {factoryLink ? (
            <a
              href={factoryLink}
              target="_blank"
              rel="noreferrer"
              className="text-indigo-300 hover:underline"
            >
              {contractIds.factory}
            </a>
          ) : (
            contractIds.factory || "Not configured"
          )}
        </dd>
      </div>
    </dl>
  );
}

function DeploymentProgress({ stage }: { stage: DeploymentStage }) {
  const reached = PROGRESS_STAGES.findIndex((entry) => entry.stage === stage);

  return (
    <ol aria-label="Deployment progress" className="space-y-2 text-sm">
      {PROGRESS_STAGES.map((entry, index) => {
        const done = stage === "failed" ? index < reached : index <= reached;

        return (
          <li
            key={entry.stage}
            data-stage={entry.stage}
            data-state={done ? "done" : "pending"}
            className={done ? "text-emerald-300" : "text-slate-500"}
          >
            {done ? "✓" : "○"} {entry.label}
          </li>
        );
      })}
    </ol>
  );
}

function CommunityCreated({ registry }: { registry: CommunityRegistryEntry }) {
  const contracts = [
    { label: "Community NFT", id: registry.nftContractId },
    { label: "Governor", id: registry.governorContractId },
  ];
  
  const [copyState, setCopyState] = useState("");
  const communityUrl = typeof window !== "undefined" ? `${window.location.origin}/communities/${registry.id}` : "";

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Join our Community",
          url: communityUrl,
        });
        setCopyState("Shared");
        setTimeout(() => setCopyState(""), 2000);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          fallbackCopy();
        }
      }
    } else {
      fallbackCopy();
    }
  };

  const fallbackCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(communityUrl)
        .then(() => {
          setCopyState("Copied");
          setTimeout(() => setCopyState(""), 2000);
        })
        .catch(() => setCopyState("Failed to copy"));
    }
  };

  return (
    <div data-testid="community-created" className="space-y-6">
      <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/40 p-5">
        <h3 className="font-semibold text-emerald-200">Deployment successful</h3>
        <p className="mt-1 text-sm text-emerald-100/80">
          Your community is now registered on chain. Share the link below to invite members.
        </p>

        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <a
            href={`/communities/${registry.id}`}
            className="inline-flex flex-1 items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
          >
            Go to community
          </a>
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex flex-1 items-center justify-center rounded-lg border border-emerald-700/50 bg-emerald-900/30 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-800/50"
          >
            {copyState || "Copy invite link"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#0b0f19] p-5">
        <h4 className="font-medium text-slate-200">Onboarding checklist</h4>
        <ul className="mt-4 space-y-3 text-sm text-slate-400">
          <li className="flex items-start gap-3">
            <span className="mt-0.5 text-slate-600">○</span>
            <span>Verify your community metadata on the detail page</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 text-slate-600">○</span>
            <span>Invite early members by sharing the community URL</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 text-slate-600">○</span>
            <span>Mint NFT memberships for your members</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 text-slate-600">○</span>
            <span>Have members delegate their voting power</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 text-slate-600">○</span>
            <span>Create the first governance proposal</span>
          </li>
        </ul>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#0b0f19] p-5">
        <h4 className="font-medium text-slate-200">Contract details</h4>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          {contracts.map((contract) => {
            const link = contractUrl(activeNetwork, contract.id);

            return (
              <div key={contract.label}>
                <dt className="text-slate-500">{contract.label}</dt>
                <dd className="mt-1 break-all font-mono text-slate-300">
                  {link ? (
                    <a href={link} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">
                      {contract.id}
                    </a>
                  ) : (
                    contract.id
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </div>
  );
}

/**
 * A submitted transaction belongs to the network it was sent to, so its explorer
 * link is built from that network rather than the one currently active.
 */
function SubmissionSummary({
  transactionHash,
  networkPassphrase,
}: {
  transactionHash: string;
  networkPassphrase: string;
}) {
  const network = findNetworkByPassphrase(networkPassphrase);
  const link = network ? transactionUrl(network, transactionHash) : null;

  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-slate-500">Transaction</dt>
        <dd className="break-all font-mono text-slate-100">
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="text-indigo-300 hover:underline"
            >
              {transactionHash}
            </a>
          ) : (
            transactionHash
          )}
        </dd>
      </div>
      <div>
        <dt className="text-slate-500">Submitted to</dt>
        <dd className="font-medium text-slate-100">
          {network?.label ?? "Unrecognized network"}
        </dd>
      </div>
    </dl>
  );
}
