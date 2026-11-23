/**
 * Public IPFS gateways for community logos.
 *
 * `NEXT_PUBLIC_IPFS_GATEWAY_URLS` is a comma-separated list, tried in order.
 * `NEXT_PUBLIC_IPFS_GATEWAY_URL` is appended when it is not already listed.
 * https://ipfs.io/ipfs/ is the last resort so a single dead gateway does not
 * leave a broken image. Stored `ipfs://` URIs are never rewritten.
 */

const DEFAULT_GATEWAY = "https://ipfs.io/ipfs/";

function normalizeGateway(value: string): string {
  return `${value.trim().replace(/\/+$/, "")}/`;
}

export function ipfsGatewayList(
  env: Record<string, string | undefined> = process.env,
): string[] {
  const fromList = (env.NEXT_PUBLIC_IPFS_GATEWAY_URLS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map(normalizeGateway);
  const ordered = [...fromList];
  const primary = env.NEXT_PUBLIC_IPFS_GATEWAY_URL?.trim();
  if (primary) {
    const normalized = normalizeGateway(primary);
    if (!ordered.includes(normalized)) ordered.push(normalized);
  }
  const fallback = normalizeGateway(DEFAULT_GATEWAY);
  if (!ordered.includes(fallback)) ordered.push(fallback);
  return ordered;
}

/** HTTP URLs to try, in gateway order. An empty list means "use the placeholder". */
export function communityLogoUrls(
  uri: string | undefined,
  env?: Record<string, string | undefined>,
): string[] {
  if (!uri) return [];
  if (uri.startsWith("https://")) return [uri];
  if (uri.startsWith("ipfs://") && uri.length > "ipfs://".length) {
    const path = uri.slice("ipfs://".length);
    return ipfsGatewayList(env).map((gateway) => `${gateway}${path}`);
  }
  return [];
}
