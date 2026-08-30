"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { CommunityDeploymentPanel } from "@/components/CommunityDeploymentPanel";
import { LiveStatus } from "@/components/ui/LiveStatus";
import { useWallet } from "@/context/WalletProvider";
import {
  COMMUNITY_LIMITS,
  DEFAULT_GOVERNANCE_DRAFT,
  type CommunityMetadataDraft,
  type CommunityMetadataDraftErrors,
  type GovernanceDraft,
  type GovernanceDraftErrors,
  validateCommunityMetadataDraft,
  validateGovernanceDraft,
} from "@/lib/community/schema";
import {
  communityWizardStorageKey,
  EMPTY_METADATA_DRAFT,
  isCommunityWizardDirty,
  parseCommunityWizardDraft,
  type CommunityWizardStep,
} from "@/lib/community/wizard";
import { communityDeploymentRecoveryKey } from "@/lib/community/deployment";
import { contractIds } from "@/lib/stellar";
import { resolveStellarNetworkId } from "@/lib/stellarExplorer";

const FIELD_ORDER: (keyof CommunityMetadataDraft)[] = [
  "name",
  "symbol",
  "description",
  "collectionUri",
  "metadataUri",
  "logo",
  "externalLinkLabel",
  "externalLinkUrl",
];

function ErrorMessage({
  field,
  errors,
}: {
  field: keyof CommunityMetadataDraft;
  errors: CommunityMetadataDraftErrors;
}) {
  const error = errors[field];
  return error ? (
    <p id={`${field}-error`} role="alert" className="mt-1 text-xs text-rose-300">
      {error}
    </p>
  ) : null;
}

const inputClassName =
  "mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600";

export function CommunityCreationWizard() {
  const network = resolveStellarNetworkId();
  const storageKey = communityWizardStorageKey(network);
  const recoveryKey = communityDeploymentRecoveryKey(network);
  const { address, connect, isConnecting } = useWallet();
  const [draft, setDraft] =
    useState<CommunityMetadataDraft>(EMPTY_METADATA_DRAFT);
  const [governance, setGovernance] = useState<GovernanceDraft>(
    DEFAULT_GOVERNANCE_DRAFT,
  );
  const [errors, setErrors] = useState<CommunityMetadataDraftErrors>({});
  const [governanceErrors, setGovernanceErrors] =
    useState<GovernanceDraftErrors>({});
  const [step, setStep] = useState<CommunityWizardStep>(1);
  const [hydrated, setHydrated] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [accountStatus, setAccountStatus] = useState("");
  const [hasSubmittedRecovery, setHasSubmittedRecovery] = useState(false);
  const previousAddress = useRef<string | null | undefined>(undefined);
  const pageTitleRef = useRef<HTMLHeadingElement>(null);

  const wizardDraft = {
    version: 1 as const,
    network,
    step,
    metadata: draft,
    governance,
  };
  const dirty = hydrated && isCommunityWizardDirty(wizardDraft);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const stored = parseCommunityWizardDraft(
        sessionStorage.getItem(storageKey),
        network,
      );
      if (stored) {
        setDraft(stored.metadata);
        setGovernance(stored.governance);
        const metadataValid =
          Object.keys(validateCommunityMetadataDraft(stored.metadata)).length ===
          0;
        const governanceValid =
          Object.keys(validateGovernanceDraft(stored.governance)).length === 0;
        setStep(
          stored.step === 1 || !metadataValid
            ? 1
            : stored.step === 2 || !governanceValid
              ? 2
              : 3,
        );
      } else if (sessionStorage.getItem(storageKey)) {
        sessionStorage.removeItem(storageKey);
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [network, storageKey]);

  useEffect(() => {
    const update = () =>
      setHasSubmittedRecovery(Boolean(sessionStorage.getItem(recoveryKey)));
    const timeout = window.setTimeout(update, 0);
    window.addEventListener("stolla:deployment-recovery", update);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("stolla:deployment-recovery", update);
    };
  }, [recoveryKey]);

  useEffect(() => {
    if (hydrated) {
      const nextDraft = {
        version: 1 as const,
        network,
        step,
        metadata: draft,
        governance,
      };
      if (isCommunityWizardDirty(nextDraft)) {
        sessionStorage.setItem(storageKey, JSON.stringify(nextDraft));
      } else {
        sessionStorage.removeItem(storageKey);
      }
    }
  }, [draft, governance, hydrated, step, storageKey, network]);

  useEffect(() => {
    if (!dirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const warnBeforeNavigation = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest("a");
      if (
        !link ||
        link.target === "_blank" ||
        link.href === window.location.href ||
        !link.href.startsWith(window.location.origin)
      ) {
        return;
      }
      if (!window.confirm("Discard this community draft and leave the wizard?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    document.addEventListener("click", warnBeforeNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      document.removeEventListener("click", warnBeforeNavigation, true);
    };
  }, [dirty]);

  useEffect(() => {
    if (previousAddress.current === undefined) {
      previousAddress.current = address;
      return;
    }
    if (previousAddress.current === address) return;
    const previous = previousAddress.current;
    previousAddress.current = address;
    const nextStatus = !address
      ? "Wallet disconnected. Your draft is preserved; reconnect before deployment."
      : previous
        ? "Connected account changed. Review and confirm the deployment again."
        : "Wallet connected. Review the deployment before continuing.";
    const timeout = window.setTimeout(() => {
      setConfirmed(false);
      setAccountStatus(nextStatus);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [address]);

  function updateField(field: keyof CommunityMetadataDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateCommunityMetadataDraft(draft);
    setErrors(nextErrors);
    const firstInvalid = FIELD_ORDER.find((field) => nextErrors[field]);
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }
    setStep(2);
  }

  function updateGovernanceField(field: keyof GovernanceDraft, value: string) {
    setGovernance((current) => ({ ...current, [field]: value }));
    setGovernanceErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleGovernanceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateGovernanceDraft(governance);
    setGovernanceErrors(nextErrors);
    const firstInvalid = (
      [
        "proposalThreshold",
        "quorum",
        "votingDelay",
        "votingPeriod",
      ] as (keyof GovernanceDraft)[]
    ).find((field) => nextErrors[field]);
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }
    setConfirmed(false);
    setStep(3);
  }

  function discardDraft() {
    if (
      dirty &&
      !window.confirm(
        "Discard this draft? Metadata, governance values, and validation errors will be cleared.",
      )
    ) {
      return;
    }
    sessionStorage.removeItem(storageKey);
    setDraft({ ...EMPTY_METADATA_DRAFT });
    setGovernance({ ...DEFAULT_GOVERNANCE_DRAFT });
    setErrors({});
    setGovernanceErrors({});
    setConfirmed(false);
    setStep(1);
    window.setTimeout(() => pageTitleRef.current?.focus(), 0);
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/communities"
          className="text-sm text-indigo-300 hover:text-indigo-200"
        >
          ← Communities
        </Link>
        {!hasSubmittedRecovery && (
          <button
            type="button"
            onClick={discardDraft}
            className="min-h-11 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            {dirty ? "Discard draft" : "Restart wizard"}
          </button>
        )}
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">
          Community creation
        </p>
        <h1
          ref={pageTitleRef}
          tabIndex={-1}
          className="mt-2 text-2xl font-bold text-slate-100 outline-none"
        >
          {step === 1
            ? "Describe your community"
            : step === 2
              ? "Configure governance"
              : "Review deployment inputs"}
        </h1>
        <p className="mt-2 text-slate-400">
          {step === 1
            ? "Step 1 collects version-1 public metadata. No wallet signature or deployment occurs here."
            : step === 2
              ? "Choose the immutable parameters that initialize this community's Governor contract."
              : "Verify the public, wallet, network, and factory values before deployment."}
        </p>
      </div>

      <ol
        aria-label="Community creation progress"
        className="mt-6 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3"
      >
        <li
          aria-current={step === 1 ? "step" : undefined}
          className={`rounded-lg border p-3 ${
            step === 1
              ? "border-indigo-500 bg-indigo-950/50 text-indigo-200"
              : "border-emerald-800 bg-emerald-950/30 text-emerald-200"
          }`}
        >
          <span className="block text-xs opacity-70">Step 1</span>
          Public metadata
        </li>
        <li
          aria-current={step === 2 ? "step" : undefined}
          className={`rounded-lg border p-3 ${
            step === 2
              ? "border-indigo-500 bg-indigo-950/50 text-indigo-200"
              : step > 2
                ? "border-emerald-800 bg-emerald-950/30 text-emerald-200"
                : "border-slate-800 bg-[#151b2b] text-slate-400"
          }`}
        >
          <span className="block text-xs opacity-70">Step 2</span>
          Governance
        </li>
        <li
          aria-current={step === 3 ? "step" : undefined}
          className={`rounded-lg border p-3 ${
            step === 3
              ? "border-indigo-500 bg-indigo-950/50 text-indigo-200"
              : "border-slate-800 bg-[#151b2b] text-slate-400"
          }`}
        >
          <span className="block text-xs opacity-70">Step 3</span>
          Review
        </li>
      </ol>

      {step === 3 ? (
        <section className="mt-6 space-y-6 rounded-xl border border-slate-800 bg-[#151b2b] p-4 sm:p-6">
          {accountStatus && (
            <LiveStatus className="rounded-lg border border-amber-800/70 bg-amber-950/30 p-4 text-sm text-amber-200">
              {accountStatus}
            </LiveStatus>
          )}
          <section aria-labelledby="review-metadata-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="review-metadata-title" className="font-semibold text-slate-100">
                Public metadata
              </h2>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="min-h-11 rounded-lg px-3 py-2 text-sm text-indigo-300 hover:bg-slate-800"
              >
                Edit metadata
              </button>
            </div>
            <dl className="mt-3 grid min-w-0 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-slate-500">Name</dt>
                <dd className="mt-1 break-words text-slate-100 [overflow-wrap:anywhere]">
                  {draft.name}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">NFT symbol</dt>
                <dd className="mt-1 break-words text-slate-100">{draft.symbol}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm text-slate-500">Description</dt>
                <dd className="mt-1 break-words text-slate-100 [overflow-wrap:anywhere]">
                  {draft.description}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm text-slate-500">Metadata URI</dt>
                <dd className="mt-1 break-all font-mono text-sm text-slate-100">
                  {draft.metadataUri}
                </dd>
              </div>
            </dl>
          </section>

          <section
            aria-labelledby="review-governance-title"
            className="border-t border-slate-800 pt-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="review-governance-title" className="font-semibold text-slate-100">
                Governance
              </h2>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="min-h-11 rounded-lg px-3 py-2 text-sm text-indigo-300 hover:bg-slate-800"
              >
                Edit governance
              </button>
            </div>
            <dl className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-slate-500">Proposal threshold</dt>
                <dd className="mt-1 text-slate-100">
                  {governance.proposalThreshold} NFT votes
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Quorum</dt>
                <dd className="mt-1 text-slate-100">{governance.quorum} NFT votes</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Voting delay</dt>
                <dd className="mt-1 text-slate-100">
                  {governance.votingDelay} Stellar ledgers
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Voting period</dt>
                <dd className="mt-1 text-slate-100">
                  {governance.votingPeriod} Stellar ledgers
                </dd>
              </div>
            </dl>
          </section>

          <section
            aria-labelledby="deployment-target-title"
            className="border-t border-slate-800 pt-5"
          >
            <h2 id="deployment-target-title" className="font-semibold text-slate-100">
              Deployment target
            </h2>
            <dl className="mt-3 grid min-w-0 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-slate-500">Connected wallet</dt>
                <dd className="mt-1 break-all font-mono text-sm text-slate-100">
                  {address ?? "Not connected"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Stellar network</dt>
                <dd className="mt-1 capitalize text-slate-100">{network}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm text-slate-500">CommunityFactory contract</dt>
                <dd className="mt-1 break-all font-mono text-sm text-slate-100">
                  {contractIds.communityFactory || "Not configured"}
                </dd>
              </div>
            </dl>
          </section>

          {!address && (
            <div className="rounded-lg border border-amber-800/70 bg-amber-950/30 p-4 text-sm text-amber-200">
              Connect the wallet that will create this community.
              <button
                type="button"
                onClick={() => void connect()}
                disabled={isConnecting}
                className="mt-3 block min-h-11 rounded-lg border border-amber-700 px-4 py-2 font-medium hover:bg-amber-900/50 disabled:opacity-50"
              >
                {isConnecting ? "Connecting…" : "Connect wallet"}
              </button>
            </div>
          )}
          {!contractIds.communityFactory && (
            <LiveStatus tone="error" className="rounded-lg border border-rose-800/70 bg-rose-950/30 p-4 text-sm text-rose-200">
              CommunityFactory is not configured for {network}. Set
              NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID before deployment.
            </LiveStatus>
          )}

          <label className="flex items-start gap-3 rounded-lg border border-slate-700 bg-[#0b0f19] p-4 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0"
            />
            <span>
              I confirm that these metadata and governance values are correct
              and will become public when deployed.
            </span>
          </label>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="min-h-11 rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Back to governance
            </button>
          </div>
          <CommunityDeploymentPanel
            metadata={draft}
            governance={governance}
            network={network}
            factoryId={contractIds.communityFactory}
            confirmed={confirmed}
          />
        </section>
      ) : step === 2 ? (
        <form
          noValidate
          onSubmit={handleGovernanceSubmit}
          className="mt-6 space-y-6 rounded-xl border border-slate-800 bg-[#151b2b] p-4 sm:p-6"
        >
          <LiveStatus className="rounded-lg border border-emerald-800/70 bg-emerald-950/30 p-4 text-sm text-emerald-200">
            Metadata validated and saved for this wizard session.
          </LiveStatus>
          <div className="grid gap-5 sm:grid-cols-2">
            {(
              [
                {
                  field: "proposalThreshold",
                  label: "Proposal threshold",
                  unit: "NFT votes",
                  help: "Minimum delegated voting power required to create a proposal.",
                },
                {
                  field: "quorum",
                  label: "Quorum",
                  unit: "NFT votes",
                  help: "For and abstain votes required for a proposal to meet quorum.",
                },
                {
                  field: "votingDelay",
                  label: "Voting delay",
                  unit: "Stellar ledgers",
                  help: "Ledgers between proposal creation and the voting snapshot.",
                },
                {
                  field: "votingPeriod",
                  label: "Voting period",
                  unit: "Stellar ledgers",
                  help: "Ledgers voting remains open; this must exceed the voting delay.",
                },
              ] as const
            ).map(({ field, label, unit, help }) => (
              <div key={field} className="min-w-0">
                <label htmlFor={field} className="block text-sm text-slate-300">
                  {label} <span className="text-slate-500">(required)</span>
                </label>
                <div className="mt-1 flex min-w-0 rounded-lg border border-slate-700 bg-[#0b0f19] focus-within:border-indigo-500">
                  <input
                    id={field}
                    name={field}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={governance[field]}
                    onChange={(event) =>
                      updateGovernanceField(field, event.target.value)
                    }
                    required
                    aria-invalid={Boolean(governanceErrors[field])}
                    aria-describedby={`${field}-help${governanceErrors[field] ? ` ${field}-error` : ""}`}
                    className="min-h-11 min-w-0 flex-1 rounded-l-lg bg-transparent px-3 py-2 font-mono text-sm text-slate-100 outline-none"
                  />
                  <span className="flex shrink-0 items-center border-l border-slate-700 px-3 text-xs text-slate-500">
                    {unit}
                  </span>
                </div>
                <p id={`${field}-help`} className="mt-1 text-xs leading-5 text-slate-500">
                  {help}
                </p>
                {governanceErrors[field] && (
                  <p
                    id={`${field}-error`}
                    role="alert"
                    className="mt-1 text-xs text-rose-300"
                  >
                    {governanceErrors[field]}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="min-h-11 rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Back to metadata
            </button>
            <button
              type="submit"
              className="min-h-11 rounded-lg bg-indigo-500 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-400"
            >
              Review community
            </button>
          </div>
        </form>
      ) : (
        <form
          noValidate
          onSubmit={handleSubmit}
          className="mt-6 space-y-6 rounded-xl border border-slate-800 bg-[#151b2b] p-4 sm:p-6"
        >
          <section aria-labelledby="identity-title">
            <h2 id="identity-title" className="font-semibold text-slate-100">
              Identity
            </h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div className="min-w-0">
                <label htmlFor="name" className="block text-sm text-slate-300">
                  Community name{" "}
                  <span className="text-slate-500">(required)</span>
                </label>
                <input
                  id="name"
                  name="name"
                  value={draft.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  required
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={`name-help${errors.name ? " name-error" : ""}`}
                  className={inputClassName}
                  autoComplete="organization"
                />
                <p id="name-help" className="mt-1 text-xs text-slate-500">
                  Public and immutable after creation. Maximum{" "}
                  {COMMUNITY_LIMITS.nameBytes} UTF-8 bytes.
                </p>
                <ErrorMessage field="name" errors={errors} />
              </div>

              <div className="min-w-0">
                <label htmlFor="symbol" className="block text-sm text-slate-300">
                  NFT symbol{" "}
                  <span className="text-slate-500">(required)</span>
                </label>
                <input
                  id="symbol"
                  name="symbol"
                  value={draft.symbol}
                  onChange={(event) =>
                    updateField("symbol", event.target.value.toUpperCase())
                  }
                  required
                  aria-invalid={Boolean(errors.symbol)}
                  aria-describedby={`symbol-help${errors.symbol ? " symbol-error" : ""}`}
                  className={inputClassName}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="BUILD"
                />
                <p id="symbol-help" className="mt-1 text-xs text-slate-500">
                  1–12 uppercase letters or numbers. Public and immutable.
                </p>
                <ErrorMessage field="symbol" errors={errors} />
              </div>
            </div>

            <div className="mt-5 min-w-0">
              <label
                htmlFor="description"
                className="block text-sm text-slate-300"
              >
                Description{" "}
                <span className="text-slate-500">(required)</span>
              </label>
              <textarea
                id="description"
                name="description"
                value={draft.description}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                required
                rows={5}
                aria-invalid={Boolean(errors.description)}
                aria-describedby={`description-help${errors.description ? " description-error" : ""}`}
                className={`${inputClassName} resize-y`}
                placeholder="Explain the community and its governance purpose."
              />
              <p id="description-help" className="mt-1 text-xs text-slate-500">
                Public in the committed metadata document. Maximum{" "}
                {COMMUNITY_LIMITS.descriptionBytes.toLocaleString()} UTF-8
                bytes.
              </p>
              <ErrorMessage field="description" errors={errors} />
            </div>
          </section>

          <section
            aria-labelledby="resources-title"
            className="border-t border-slate-800 pt-6"
          >
            <h2 id="resources-title" className="font-semibold text-slate-100">
              Public resources
            </h2>
            <div className="mt-4 space-y-5">
              <div className="min-w-0">
                <label
                  htmlFor="collectionUri"
                  className="block text-sm text-slate-300"
                >
                  NFT collection URI{" "}
                  <span className="text-slate-500">(required)</span>
                </label>
                <input
                  id="collectionUri"
                  name="collectionUri"
                  type="url"
                  value={draft.collectionUri}
                  onChange={(event) =>
                    updateField("collectionUri", event.target.value)
                  }
                  required
                  aria-invalid={Boolean(errors.collectionUri)}
                  aria-describedby={`collectionUri-help${errors.collectionUri ? " collectionUri-error" : ""}`}
                  className={`${inputClassName} font-mono`}
                  placeholder="ipfs://bafy.../collection.json"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <p
                  id="collectionUri-help"
                  className="mt-1 text-xs text-slate-500"
                >
                  Stored by the NFT contract and immutable. Use ipfs:// or
                  https://.
                </p>
                <ErrorMessage field="collectionUri" errors={errors} />
              </div>

              <div className="min-w-0">
                <label
                  htmlFor="metadataUri"
                  className="block text-sm text-slate-300"
                >
                  Community metadata URI{" "}
                  <span className="text-slate-500">(required)</span>
                </label>
                <input
                  id="metadataUri"
                  name="metadataUri"
                  type="url"
                  value={draft.metadataUri}
                  onChange={(event) =>
                    updateField("metadataUri", event.target.value)
                  }
                  required
                  aria-invalid={Boolean(errors.metadataUri)}
                  aria-describedby={`metadataUri-help${errors.metadataUri ? " metadataUri-error" : ""}`}
                  className={`${inputClassName} font-mono`}
                  placeholder="https://example.org/community.json"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <p
                  id="metadataUri-help"
                  className="mt-1 text-xs text-slate-500"
                >
                  Stored in the registry with a SHA-256 commitment. The
                  commitment is generated from the final document later.
                </p>
                <ErrorMessage field="metadataUri" errors={errors} />
              </div>

              <div className="min-w-0">
                <label htmlFor="logo" className="block text-sm text-slate-300">
                  Logo URI <span className="text-slate-500">(optional)</span>
                </label>
                <input
                  id="logo"
                  name="logo"
                  type="url"
                  value={draft.logo}
                  onChange={(event) => updateField("logo", event.target.value)}
                  aria-invalid={Boolean(errors.logo)}
                  aria-describedby={`logo-help${errors.logo ? " logo-error" : ""}`}
                  className={`${inputClassName} font-mono`}
                  placeholder="ipfs://bafy.../logo.png"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <p id="logo-help" className="mt-1 text-xs text-slate-500">
                  Public in the metadata document. Use ipfs:// or https://.
                </p>
                <ErrorMessage field="logo" errors={errors} />
              </div>
            </div>
          </section>

          <section
            aria-labelledby="link-title"
            className="border-t border-slate-800 pt-6"
          >
            <h2 id="link-title" className="font-semibold text-slate-100">
              External link <span className="text-slate-500">(optional)</span>
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Both fields are required when adding a link. Additional links can
              be added in the review step.
            </p>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div className="min-w-0">
                <label
                  htmlFor="externalLinkLabel"
                  className="block text-sm text-slate-300"
                >
                  Link label
                </label>
                <input
                  id="externalLinkLabel"
                  name="externalLinkLabel"
                  value={draft.externalLinkLabel}
                  onChange={(event) =>
                    updateField("externalLinkLabel", event.target.value)
                  }
                  aria-invalid={Boolean(errors.externalLinkLabel)}
                  aria-describedby={
                    errors.externalLinkLabel
                      ? "externalLinkLabel-error"
                      : undefined
                  }
                  className={inputClassName}
                  placeholder="Website"
                />
                <ErrorMessage field="externalLinkLabel" errors={errors} />
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="externalLinkUrl"
                  className="block text-sm text-slate-300"
                >
                  HTTPS URL
                </label>
                <input
                  id="externalLinkUrl"
                  name="externalLinkUrl"
                  type="url"
                  value={draft.externalLinkUrl}
                  onChange={(event) =>
                    updateField("externalLinkUrl", event.target.value)
                  }
                  aria-invalid={Boolean(errors.externalLinkUrl)}
                  aria-describedby={
                    errors.externalLinkUrl ? "externalLinkUrl-error" : undefined
                  }
                  className={`${inputClassName} font-mono`}
                  placeholder="https://community.example"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <ErrorMessage field="externalLinkUrl" errors={errors} />
              </div>
            </div>
          </section>

          <aside className="rounded-lg border border-indigo-800/70 bg-indigo-950/30 p-4 text-sm leading-6 text-indigo-100">
            <strong className="font-semibold">Before continuing:</strong> name,
            symbol, collection URI, schema version, metadata URI, and metadata
            hash become immutable registry or contract values. Description,
            logo, and links are public and committed by the immutable hash.
          </aside>

          <button
            type="submit"
            className="min-h-11 w-full rounded-lg bg-indigo-500 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-400 sm:w-auto"
          >
            Continue to governance
          </button>
        </form>
      )}
    </div>
  );
}
