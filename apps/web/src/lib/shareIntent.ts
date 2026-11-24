/**
 * Share-intent URL builders for X (Twitter) and Warpcast (Farcaster).
 *
 * Both platforms open a pre-filled compose screen from a plain link, so users
 * never post without an explicit click and no OAuth token is involved. Each
 * builder truncates the suggested text to the platform's limit so the shared
 * post always keeps the canonical URL intact.
 */

/** X reserves this many characters for a shared URL (t.co wrapping). */
const X_URL_CHARS = 23;
/** X's hard limit on composed text, URLs included. */
const X_MAX_CHARS = 280;
/** Warpcast's hard limit on composed text, URLs included. */
const WARPCAST_MAX_CHARS = 320;

/**
 * Truncate suggested text so that `text + url` fits the platform limit.
 * The URL is always preserved; only the prose is shortened.
 */
export function truncateShareText(
  text: string,
  url: string,
  maxChars: number,
  urlChars: number,
): string {
  const budget = maxChars - urlChars - 1; // reserve one char for the space
  if (text.length <= budget) return text;
  const trimmed = text.slice(0, Math.max(0, budget - 1));
  return `${trimmed}\u2026`;
}

/** Suggested post text for a Stolla proposal. */
export function buildProposalShareText(title: string | null | undefined): string {
  const label = title?.trim() || "this proposal";
  return `View ${label} on Stolla`;
}

/**
 * Build an X (Twitter) compose intent URL.
 *
 * https://twitter.com/intent/tweet?text=...&url=...
 */
export function buildXIntentUrl(text: string, url: string): string {
  const safe = truncateShareText(text, url, X_MAX_CHARS, X_URL_CHARS);
  const params = new URLSearchParams({ text: safe, url });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

/**
 * Build a Warpcast (Farcaster) compose intent URL.
 *
 * https://warpcast.com/~/compose?text=...&embeds[]=...
 */
export function buildWarpcastIntentUrl(text: string, url: string): string {
  const safe = truncateShareText(text, url, WARPCAST_MAX_CHARS, 0);
  const params = new URLSearchParams({ text: safe });
  params.append("embeds[]", url);
  return `https://warpcast.com/~/compose?${params.toString()}`;
}
