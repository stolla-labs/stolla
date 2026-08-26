import type { NetworkComparison } from "./network";

export const CREATION_STEPS = [
  "metadata",
  "governance",
  "review",
  "deploy",
] as const;

export type CreationStep = (typeof CREATION_STEPS)[number];

export type CommunityDraft = {
  name: string;
  symbol: string;
  metadataUri: string;
  votingDelay: string;
  votingPeriod: string;
  proposalThreshold: string;
  quorum: string;
};

/**
 * A simulation is only valid for the network it was produced on, so it carries
 * that network with it rather than relying on whatever is active at use time.
 */
export type CommunitySimulation = {
  networkPassphrase: string;
  factoryAddress: string;
  transactionXdr: string;
  minResourceFee: string;
};

export type SubmissionStatus = "pending" | "confirmed" | "failed";

export type CommunityRegistryEntry = {
  nftContractId: string;
  governorContractId: string;
};

export type CommunitySubmission = {
  networkPassphrase: string;
  transactionHash: string;
  status: SubmissionStatus;
  message?: string;
  registry?: CommunityRegistryEntry | null;
};

export type DeploymentStage =
  | "draft"
  | "simulated"
  | "awaiting-approval"
  | "submitted"
  | "confirmed"
  | "verified"
  | "failed";

export type CreationState = {
  step: CreationStep;
  draft: CommunityDraft;
  simulation: CommunitySimulation | null;
  submission: CommunitySubmission | null;
  detectedPassphrase: string | null;
  signing: boolean;
};

/** Governance defaults match the testnet parameters documented in the PRD. */
export const DEFAULT_DRAFT: CommunityDraft = {
  name: "",
  symbol: "",
  metadataUri: "",
  votingDelay: "1",
  votingPeriod: "10000",
  proposalThreshold: "1",
  quorum: "1",
};

export const INITIAL_CREATION_STATE: CreationState = {
  step: "metadata",
  draft: DEFAULT_DRAFT,
  simulation: null,
  submission: null,
  detectedPassphrase: null,
  signing: false,
};

export type CreationAction =
  | { type: "step-changed"; step: CreationStep }
  | { type: "draft-changed"; changes: Partial<CommunityDraft> }
  | {
      type: "state-restored";
      draftState: PersistedCreationDraft | null;
      submission: CommunitySubmission | null;
    }
  | { type: "draft-discarded" }
  | { type: "network-detected"; networkPassphrase: string | null }
  | { type: "simulation-succeeded"; simulation: CommunitySimulation }
  | { type: "signing-started" }
  | { type: "signing-ended" }
  | { type: "submission-recorded"; submission: CommunitySubmission }
  | { type: "submission-settled"; status: SubmissionStatus; message?: string }
  | { type: "registry-verified"; registry: CommunityRegistryEntry };

export function creationReducer(
  state: CreationState,
  action: CreationAction,
): CreationState {
  switch (action.type) {
    case "step-changed":
      return { ...state, step: action.step };

    case "draft-changed":
      return { ...state, draft: { ...state.draft, ...action.changes } };

    case "state-restored":
      return {
        ...state,
        step: action.draftState?.step ?? state.step,
        draft: action.draftState?.draft ?? state.draft,
        submission: action.submission ?? state.submission,
      };

    case "draft-discarded":
      return {
        ...INITIAL_CREATION_STATE,
        detectedPassphrase: state.detectedPassphrase,
        submission: state.submission,
      };

    /**
     * Any change to the wallet network drops network-specific work. Draft values
     * and an already-submitted transaction survive: the draft is network
     * independent and the submission belongs to the network it was sent to.
     * Switching back does not restore the old simulation, so recovery always
     * requires a fresh one.
     */
    case "network-detected": {
      if (state.detectedPassphrase === action.networkPassphrase) return state;
      return {
        ...state,
        detectedPassphrase: action.networkPassphrase,
        simulation: null,
        signing: false,
      };
    }

    /**
     * A simulation that finished after the wallet moved belongs to a network the
     * user is no longer on, so it is discarded instead of stored.
     */
    case "simulation-succeeded":
      return state.detectedPassphrase === action.simulation.networkPassphrase
        ? { ...state, simulation: action.simulation }
        : state;

    case "signing-started":
      return { ...state, signing: true };

    case "signing-ended":
      return { ...state, signing: false };

    case "submission-recorded":
      return { ...state, submission: action.submission, signing: false };

    case "submission-settled":
      return state.submission
        ? {
            ...state,
            submission: {
              ...state.submission,
              status: action.status,
              message: action.message,
            },
          }
        : state;

    case "registry-verified":
      return state.submission
        ? {
            ...state,
            submission: {
              ...state.submission,
              registry: action.registry,
            },
          }
        : state;
  }
}

/** Derived deployment progress for UI; never stored separately from state. */
export function deploymentStage(state: CreationState): DeploymentStage {
  if (state.submission?.status === "failed") return "failed";
  if (state.submission?.registry) return "verified";
  if (state.submission?.status === "confirmed") return "confirmed";
  if (state.submission) return "submitted";
  if (state.signing) return "awaiting-approval";
  if (state.simulation) return "simulated";
  return "draft";
}

export const CREATION_DRAFT_STORAGE_KEY = "stolla.community-creation.draft.v1";
export const CREATION_SUBMISSION_STORAGE_KEY =
  "stolla.community-creation.submission.v1";

export type PersistedCreationDraft = {
  step: CreationStep;
  draft: CommunityDraft;
};

export function isDraftDirty(draft: CommunityDraft): boolean {
  return (Object.keys(DEFAULT_DRAFT) as (keyof CommunityDraft)[]).some(
    (key) => draft[key] !== DEFAULT_DRAFT[key],
  );
}

function isCommunityDraft(value: unknown): value is CommunityDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;
  return (Object.keys(DEFAULT_DRAFT) as (keyof CommunityDraft)[]).every(
    (key) => typeof draft[key] === "string",
  );
}

export function readPersistedDraft(
  storage: Pick<Storage, "getItem">,
): PersistedCreationDraft | null {
  try {
    const raw = storage.getItem(CREATION_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PersistedCreationDraft>;
    return (
      CREATION_STEPS.includes(value.step as CreationStep) &&
        isCommunityDraft(value.draft)
        ? { step: value.step as CreationStep, draft: value.draft }
        : null
    );
  } catch {
    return null;
  }
}

export function readPersistedSubmission(
  storage: Pick<Storage, "getItem">,
): CommunitySubmission | null {
  try {
    const raw = storage.getItem(CREATION_SUBMISSION_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<CommunitySubmission>;
    return typeof value.networkPassphrase === "string" &&
      typeof value.transactionHash === "string" &&
      ["pending", "confirmed", "failed"].includes(value.status ?? "")
      ? (value as CommunitySubmission)
      : null;
  } catch {
    return null;
  }
}

export type CreationBlocker =
  | "wallet-disconnected"
  | "network-unknown"
  | "network-mismatch"
  | "submission-in-progress"
  | "already-submitted"
  | "factory-unconfigured"
  | "draft-incomplete"
  | "simulation-required"
  | "simulation-stale";

export type CreationContext = {
  walletConnected: boolean;
  comparison: NetworkComparison;
  factoryConfigured: boolean;
};

const POSITIVE_INTEGER = /^\d+$/;

export function isDraftComplete(draft: CommunityDraft): boolean {
  const text = [draft.name, draft.symbol, draft.metadataUri];
  const numbers = [
    draft.votingDelay,
    draft.votingPeriod,
    draft.proposalThreshold,
    draft.quorum,
  ];
  return (
    text.every((value) => value.trim().length > 0) &&
    numbers.every((value) => POSITIVE_INTEGER.test(value.trim()))
  );
}

function isSimulationStale(
  state: CreationState,
  context: CreationContext,
): boolean {
  return (
    state.simulation !== null &&
    state.simulation.networkPassphrase !== context.comparison.expected.networkPassphrase
  );
}

function sharedBlocker(
  state: CreationState,
  context: CreationContext,
): CreationBlocker | null {
  if (!context.walletConnected) return "wallet-disconnected";
  if (context.comparison.status === "unknown") return "network-unknown";
  if (context.comparison.status === "mismatch") return "network-mismatch";
  if (state.submission) return "already-submitted";
  if (state.signing) return "submission-in-progress";
  return null;
}

export function simulationBlocker(
  state: CreationState,
  context: CreationContext,
): CreationBlocker | null {
  const shared = sharedBlocker(state, context);
  if (shared) return shared;
  if (!context.factoryConfigured) return "factory-unconfigured";
  if (!isDraftComplete(state.draft)) return "draft-incomplete";
  return null;
}

/** Gates signing and submission, which the wizard performs as one action. */
export function deploymentBlocker(
  state: CreationState,
  context: CreationContext,
): CreationBlocker | null {
  const prerequisite = simulationBlocker(state, context);
  if (prerequisite) return prerequisite;
  if (!state.simulation) return "simulation-required";
  if (isSimulationStale(state, context)) return "simulation-stale";
  return null;
}
