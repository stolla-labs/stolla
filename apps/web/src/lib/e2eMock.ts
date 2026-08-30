import type { CommunityDeploymentAdapter } from "@/lib/community/deployment";
import type { CommunityDetailResult, CommunityRegistryPage } from "@/lib/community/types";

export type E2EProposal = {
  id: string;
  description: string | null;
  state?: number;
};

export type StollaE2EBridge = {
  wallet?: {
    address: string;
    networkPassphrase: string;
    rejected?: boolean;
    /** Test-only signing material used by the real-transaction browser suite. */
    secretKey?: string;
    signedNetworkPassphrases?: string[];
  };
  communities?: CommunityRegistryPage["communities"];
  proposals?: Record<string, E2EProposal[]>;
  deployment?: CommunityDeploymentAdapter;
  diagnostics?: {
    submissions: number;
    invocations: unknown[];
  };
};

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
