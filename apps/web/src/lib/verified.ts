/**
 * Operator-granted verification for reviewed flagship communities.
 *
 * A community is "verified" when its registry id appears in the allowlist.
 * The mark is a lightweight trust signal for newcomers — it never implies
 * investment advice or a guarantee of returns. See docs/verification-criteria.md
 * for the review bar.
 */

/**
 * Hard-coded allowlist for communities reviewed before verification was
 * configurable. Extend via NEXT_PUBLIC_VERIFIED_COMMUNITY_IDS (comma-separated)
 * so operators can grant the mark without a code change.
 */
export const BUILTIN_VERIFIED_COMMUNITY_IDS: readonly string[] = [];

function parseConfiguredIds(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

/** The full allowlist, combining built-in and configured ids. */
export function verifiedCommunityIds(): ReadonlySet<string> {
  return new Set([
    ...BUILTIN_VERIFIED_COMMUNITY_IDS,
    ...parseConfiguredIds(process.env.NEXT_PUBLIC_VERIFIED_COMMUNITY_IDS),
  ]);
}

/** Whether a community carries the verified mark. */
export function isVerifiedCommunity(communityId: string): boolean {
  return verifiedCommunityIds().has(communityId);
}
