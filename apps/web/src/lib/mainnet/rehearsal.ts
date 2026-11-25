import {
  MAINNET_RUNBOOK_PATH,
  type ActiveNetworkId,
  type NetworkCapabilities,
  type NetworkComparison,
} from "@/lib/network";

/**
 * The rehearsal a creator walks before their first Mainnet write.
 *
 * Testnet success does not transfer. The launches that go wrong go wrong on
 * things the wizard never asked about: an account with no XLM for fees and
 * reserves, a treasury with no USDC trustline, sponsorship nobody arranged,
 * and nobody watching when it breaks. This is that list, in the words a
 * creator would use, rather than the operator-facing capability names in
 * `buildHealthGates` — the two read the same signals and are deliberately
 * separate, because an operator fixes an environment variable and a creator
 * funds an account.
 *
 * Each item carries two independent facts, and conflating them is what makes
 * checklists lie:
 *
 * - **`gate`** is policy: a `hard` gate stops the deployment, a `soft` one
 *   warns. The rule for which is which: hard means the write will fail, or
 *   will succeed into something nobody can use.
 * - **`verification`** is epistemology: `measured` items are read from the
 *   deployment's own configuration and the wallet, and `declared` items are
 *   ones this app cannot see — a Horizon balance, a trustline, an alerting
 *   rota. A declared item is never shown as passing until the creator says so,
 *   and the row says out loud that Stolla did not check it.
 *
 * A hard, declared item (fees) therefore blocks until it is confirmed. That is
 * an acknowledgement gate, not a box-ticking trap: the alternative is either
 * blocking on a fact nobody can establish, or reporting an unchecked item as
 * green.
 */

export type RehearsalGate = "hard" | "soft";
export type RehearsalVerification = "measured" | "declared";

export type RehearsalCheckId =
  | "wallet-network"
  | "rpc"
  | "factory"
  | "writes-enabled"
  | "fees-and-reserves"
  | "usdc-trustline"
  | "sponsorship"
  | "alerts"
  | "testnet-rehearsal";

export type RehearsalStatus =
  | "pass"
  /** Measured, and the signal says no. */
  | "fail"
  /** Declared, and the creator has not confirmed it yet. Never a pass. */
  | "unconfirmed";

export type RehearsalCheck = {
  id: RehearsalCheckId;
  gate: RehearsalGate;
  verification: RehearsalVerification;
  /** Plain language, addressed to the person deploying. */
  title: string;
  /** What is wrong and what to do about it. Present unless the check passes. */
  detail: string | null;
  status: RehearsalStatus;
  /** Meaningless on Testnet, and hidden there rather than shown as passing. */
  mainnetOnly: boolean;
  /**
   * Anchor inside `MAINNET_RUNBOOK_PATH`. These are checked against the
   * runbook's own headings rather than invented, so a "Runbook" link lands on
   * the section that explains the item instead of the top of a long document.
   */
  runbookAnchor: string;
};

export type RehearsalSignals = {
  networkId: ActiveNetworkId;
  capabilities: NetworkCapabilities;
  /** How the connected wallet's network compares, or null when none is connected. */
  walletNetwork: NetworkComparison | null;
  /** Declared items the creator has confirmed. */
  confirmed: readonly RehearsalCheckId[];
};

export const RUNBOOK_URL = `https://github.com/stolla-labs/stolla/blob/main/${MAINNET_RUNBOOK_PATH}`;

export function runbookUrl(anchor: string): string {
  return `${RUNBOOK_URL}#${anchor}`;
}

type Definition = Omit<RehearsalCheck, "status" | "detail"> & {
  /** Null when the check passes; otherwise what to do, in one sentence. */
  problem: (signals: RehearsalSignals) => string | null;
};

const DEFINITIONS: Definition[] = [
  {
    id: "wallet-network",
    gate: "hard",
    verification: "measured",
    title: "Your wallet is on Mainnet",
    mainnetOnly: true,
    runbookAnchor: "network-safety-shell",
    problem: ({ walletNetwork }) => {
      if (!walletNetwork) {
        return "Connect the wallet you will deploy with, so its network can be read.";
      }
      if (walletNetwork.status === "unknown") {
        return "The wallet did not report a network. Reconnect it before deploying.";
      }
      if (walletNetwork.status === "mismatch") {
        return `The wallet is on ${walletNetwork.detected.label}. Switch it to ${walletNetwork.expected.label} — a deployment signed on the wrong network is a real transaction on that network.`;
      }
      return null;
    },
  },
  {
    id: "rpc",
    gate: "hard",
    verification: "measured",
    title: "This deployment can reach the network",
    mainnetOnly: false,
    runbookAnchor: "network-safety-shell",
    problem: ({ capabilities }) =>
      capabilities.rpc.available
        ? null
        : "No RPC endpoint is configured for this network, so nothing can be simulated or submitted. Ask whoever runs this deployment to set one.",
  },
  {
    id: "factory",
    gate: "hard",
    verification: "measured",
    title: "The community factory address is set",
    mainnetOnly: false,
    runbookAnchor: "3-deploy-in-dependency-order",
    problem: ({ capabilities }) =>
      capabilities.communityFactory.available
        ? null
        : "This deployment has no CommunityFactory address, so there is nothing to create a community through.",
  },
  {
    id: "writes-enabled",
    gate: "hard",
    verification: "measured",
    title: "Mainnet writes are switched on",
    mainnetOnly: true,
    runbookAnchor: "final-activation-gate",
    problem: ({ capabilities }) =>
      capabilities.privilegedWrites.available
        ? null
        : "Mainnet writes are off for this deployment. Until they are on you can browse but not deploy — this is the final activation gate in the runbook.",
  },
  {
    id: "fees-and-reserves",
    gate: "hard",
    verification: "declared",
    title: "The deploying account holds XLM for fees and reserves",
    mainnetOnly: true,
    runbookAnchor: "gate-4-mainnet-pre-deployment",
    problem: () =>
      "Stolla cannot read your balance. Confirm the account has XLM for the transaction fees and for the base reserve of every account and trustline this creates — a deployment that runs out halfway leaves contracts nobody owns.",
  },
  {
    id: "usdc-trustline",
    gate: "soft",
    verification: "declared",
    title: "The treasury trusts the asset you will pay in",
    mainnetOnly: true,
    runbookAnchor: "gate-4-mainnet-pre-deployment",
    problem: () =>
      "Stolla cannot read trustlines. A community deploys without one; a payment to an account that does not trust USDC fails at the moment it matters.",
  },
  {
    id: "sponsorship",
    gate: "soft",
    verification: "declared",
    title: "Sponsorship is arranged for the accounts you create",
    mainnetOnly: true,
    runbookAnchor: "gate-4-mainnet-pre-deployment",
    problem: () =>
      "Members whose accounts you create need their reserves sponsored, or they cannot hold what you mint them. Confirm who is sponsoring.",
  },
  {
    id: "alerts",
    gate: "soft",
    verification: "declared",
    title: "Somebody is told when it breaks",
    mainnetOnly: true,
    runbookAnchor: "monitoring-specification",
    problem: () =>
      "A Mainnet community keeps running after launch day. Confirm that a person, not a dashboard nobody opens, gets told when RPC or the registry stops answering.",
  },
  {
    id: "testnet-rehearsal",
    gate: "soft",
    verification: "declared",
    title: "You have done this once on Testnet",
    mainnetOnly: true,
    runbookAnchor: "gate-3-testnet-pilot",
    problem: () =>
      "Rehearsing the same metadata and governance values on Testnet is the cheapest way to find a mistake. It is not proof — a Testnet success does not transfer — which is why this warns rather than blocks.",
  },
];

/**
 * The checklist for one deployment.
 *
 * Mainnet-only items are **absent** on Testnet rather than listed as passing:
 * a row saying "wallet is on Mainnet ✓" while a creator is on Testnet is a
 * false statement, and a greyed-out row is noise in a list meant to be read
 * once, carefully.
 */
export function buildRehearsalChecklist(signals: RehearsalSignals): RehearsalCheck[] {
  const confirmed = new Set(signals.confirmed);

  return DEFINITIONS.filter(
    (definition) => signals.networkId === "mainnet" || !definition.mainnetOnly,
  ).map(({ problem, ...definition }) => {
    if (definition.verification === "declared") {
      return {
        ...definition,
        status: confirmed.has(definition.id) ? "pass" : "unconfirmed",
        detail: confirmed.has(definition.id) ? null : problem(signals),
      };
    }

    const wrong = problem(signals);
    return {
      ...definition,
      status: wrong === null ? "pass" : "fail",
      detail: wrong,
    };
  });
}

export type RehearsalVerdict = {
  /** True when a hard gate is not passing. Soft items never set this. */
  blocked: boolean;
  blocking: RehearsalCheck[];
  warnings: RehearsalCheck[];
  /** Everything that is not passing, hard or soft, for a one-line summary. */
  outstanding: RehearsalCheck[];
};

export function rehearsalVerdict(checks: readonly RehearsalCheck[]): RehearsalVerdict {
  const outstanding = checks.filter((check) => check.status !== "pass");
  const blocking = outstanding.filter((check) => check.gate === "hard");
  const warnings = outstanding.filter((check) => check.gate === "soft");

  return { blocked: blocking.length > 0, blocking, warnings, outstanding };
}

export const REHEARSAL_STORAGE_VERSION = 1 as const;

export function rehearsalStorageKey(networkId: ActiveNetworkId): string {
  return `stolla:mainnet-rehearsal:v${REHEARSAL_STORAGE_VERSION}:${networkId}`;
}

const DECLARED_IDS: readonly RehearsalCheckId[] = DEFINITIONS.filter(
  (definition) => definition.verification === "declared",
).map((definition) => definition.id);

/**
 * The confirmations this device has recorded.
 *
 * Only declared items are ever read back: a stored "confirmation" for a
 * measured item would be an attempt to tick away a signal, so an unknown or
 * measured id is dropped rather than honoured.
 */
export function readRehearsalConfirmations(
  networkId: ActiveNetworkId,
): RehearsalCheckId[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(rehearsalStorageKey(networkId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is RehearsalCheckId =>
      DECLARED_IDS.includes(value as RehearsalCheckId),
    );
  } catch {
    // An unreadable store confirms nothing, which leaves the hard declared
    // gate blocking — the safe direction.
    return [];
  }
}

export function writeRehearsalConfirmations(
  networkId: ActiveNetworkId,
  confirmed: readonly RehearsalCheckId[],
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      rehearsalStorageKey(networkId),
      JSON.stringify(confirmed.filter((id) => DECLARED_IDS.includes(id))),
    );
  } catch {
    // Nothing to do: the checklist still works for this visit.
  }
}

export function toggleRehearsalConfirmation(
  confirmed: readonly RehearsalCheckId[],
  id: RehearsalCheckId,
): RehearsalCheckId[] {
  if (!DECLARED_IDS.includes(id)) return [...confirmed];
  return confirmed.includes(id)
    ? confirmed.filter((held) => held !== id)
    : [...confirmed, id];
}
