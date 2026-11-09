import type { CommunityDeploymentAdapter } from "@/lib/community/deployment";
import type {
  CommunityDetailResult,
  CommunityRegistry,
  CommunityRegistryPage,
} from "@/lib/community/types";
import type { IpfsPinClient } from "@/lib/ipfs/pin";

export type E2EProposal = {
  id: string;
  description: string | null;
  state?: number;
};

export type E2EWalletConfig = {
  address: string;
  networkPassphrase: string;
  rejected?: boolean;
  /** When false, WalletProvider starts disconnected until the user clicks Connect Wallet. */
  autoConnect?: boolean;
  /** Tracks explicit user disconnect in E2E sessions so polling does not re-connect. */
  disconnected?: boolean;
  /** Test-only signing material used by the real-transaction browser suite. */
  secretKey?: string;
  signedNetworkPassphrases?: string[];
};

export type StollaE2EBridge = {
  wallet?: E2EWalletConfig;
  communities?: CommunityRegistryPage["communities"];
  proposals?: Record<string, E2EProposal[]>;
  deployment?: CommunityDeploymentAdapter;
  /** Replaces the `/api/ipfs/pin` client so browser tests never upload. */
  pin?: IpfsPinClient;
  diagnostics?: {
    submissions: number;
    invocations: unknown[];
  };
};

export type HeaderOverflowMetrics = {
  viewportWidth: number;
  clientWidth: number;
  documentWidth: number;
  bodyWidth: number;
  headerRightEdge: number;
};

export function evaluateHeaderOverflowBounds(metrics: HeaderOverflowMetrics): {
  withinViewport: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (metrics.documentWidth > metrics.clientWidth) {
    reasons.push(
      `documentElement.scrollWidth (${metrics.documentWidth}) exceeds clientWidth (${metrics.clientWidth})`,
    );
  }
  if (metrics.bodyWidth > metrics.clientWidth) {
    reasons.push(
      `body.scrollWidth (${metrics.bodyWidth}) exceeds clientWidth (${metrics.clientWidth})`,
    );
  }
  if (metrics.headerRightEdge > metrics.viewportWidth + 1) {
    reasons.push(
      `header right edge (${metrics.headerRightEdge}) exceeds viewportWidth (${metrics.viewportWidth})`,
    );
  }
  return {
    withinViewport: reasons.length === 0,
    reasons,
  };
}

declare global {
  interface Window {
    __STOLLA_E2E__?: StollaE2EBridge;
  }
}

export function e2eMocksEnabled(): boolean {
  // next.config.ts rejects this public flag for production builds. Keeping the
  // client check to one compile-time flag also makes development E2E behavior
  // deterministic across Next.js runtimes that rewrite NODE_ENV internally.
  return process.env.NEXT_PUBLIC_E2E_MOCKS === "true";
}

export function getE2EBridge(): StollaE2EBridge | null {
  if (typeof window === "undefined" || !e2eMocksEnabled()) return null;
  return window.__STOLLA_E2E__ ?? null;
}

export function shouldAutoConnectE2EWallet(
  wallet: E2EWalletConfig | undefined | null,
): boolean {
  if (!wallet) return false;
  if (wallet.disconnected) return false;
  return wallet.autoConnect !== false;
}

export function connectE2EWallet(
  wallet: E2EWalletConfig | undefined | null,
): E2EWalletConfig | null {
  if (!wallet) return null;
  wallet.disconnected = false;
  wallet.autoConnect = true;
  return wallet;
}

export function disconnectE2EWallet(
  wallet: E2EWalletConfig | undefined | null,
): boolean {
  if (!wallet) return false;
  wallet.disconnected = true;
  return true;
}

export function e2eListCommunities(
  cursor: number | null,
  limit: number,
): CommunityRegistryPage | null {
  const communities = getE2EBridge()?.communities;
  if (!communities) return null;
  const start = cursor ?? 0;
  const page = communities.slice(start, start + limit);
  const nextCursor = start + page.length < communities.length ? start + page.length : null;
  return { communities: page, nextCursor, malformedRecords: 0 };
}

export function e2eGetCommunity(id: string): CommunityDetailResult | null {
  const communities = getE2EBridge()?.communities;
  if (!communities) return null;
  const community = communities.find(
    (candidate) => candidate.record.id.toLowerCase() === id.toLowerCase(),
  );
  return community ? { status: "found", community } : { status: "not-found" };
}

/** Registry adapter for E2E fixtures; returns null when mocks are off. */
export function getE2ECommunityRegistry(): CommunityRegistry | null {
  if (!getE2EBridge()?.communities) return null;
  return {
    list: async (cursor, limit) =>
      e2eListCommunities(cursor, limit) ?? {
        communities: [],
        nextCursor: null,
        malformedRecords: 0,
      },
    get: async (id) =>
      e2eGetCommunity(id) ?? { status: "not-found" },
  };
}
