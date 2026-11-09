import { isHttpsUrl, isResourceUri } from "@/lib/community/schema";

export const DEFAULT_IPFS_FALLBACK_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://dweb.link/ipfs/",
] as const;

type GatewayEnv = Record<string, string | undefined>;

export function normalizeIpfsGatewayUrl(rawGateway: string): string | null {
  const trimmed = rawGateway.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" || !parsed.hostname) {
      return null;
    }
    const normalized = parsed.toString();
    return normalized.endsWith("/") ? normalized : `${normalized}/`;
  } catch {
    return null;
  }
}

export function resolveConfiguredIpfsGateways(
  environment: GatewayEnv = process.env,
): string[] {
  const primaryRaw =
    environment.NEXT_PUBLIC_IPFS_GATEWAY_URL?.trim() ||
    DEFAULT_IPFS_FALLBACK_GATEWAYS[0];
  const fallbackRaw = environment.NEXT_PUBLIC_IPFS_FALLBACK_GATEWAY_URLS?.trim();

  const rawList = [
    primaryRaw,
    ...(fallbackRaw
      ? fallbackRaw.split(",").map((entry) => entry.trim())
      : DEFAULT_IPFS_FALLBACK_GATEWAYS),
  ];

  const seen = new Set<string>();
  const gateways: string[] = [];

  for (const item of rawList) {
    const normalized = normalizeIpfsGatewayUrl(item);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      gateways.push(normalized);
    }
  }

  if (gateways.length === 0) {
    return [...DEFAULT_IPFS_FALLBACK_GATEWAYS];
  }

  return gateways;
}

export function resolveCommunityResourceCandidates(
  uri: string | null | undefined,
  environment: GatewayEnv = process.env,
): string[] {
  if (!uri || typeof uri !== "string") {
    return [];
  }
  const trimmed = uri.trim();
  if (!isResourceUri(trimmed)) {
    return [];
  }

  if (trimmed.startsWith("https://")) {
    return isHttpsUrl(trimmed) ? [trimmed] : [];
  }

  if (trimmed.startsWith("ipfs://")) {
    const cidPath = trimmed.slice("ipfs://".length).replace(/^\/+/, "");
    if (!cidPath) {
      return [];
    }
    return resolveConfiguredIpfsGateways(environment).map(
      (gateway) => `${gateway}${cidPath}`,
    );
  }

  return [];
}

export function selectActiveGatewayCandidate(
  candidates: readonly string[],
  failedCount: number,
): string | null {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }
  if (!Number.isInteger(failedCount) || failedCount < 0) {
    return candidates[0] ?? null;
  }
  if (failedCount >= candidates.length) {
    return null;
  }
  return candidates[failedCount] ?? null;
}
