"use client";

import { isVerifiedCommunity } from "@/lib/verified";

/** Public review bar for the verified mark. */
const CRITERIA_URL =
  "https://github.com/stolla-labs/stolla/blob/main/docs/verification-criteria.md";

/**
 * Operator-granted "Verified" mark for reviewed flagship communities. The
 * badge links to the public criteria so the mark stays a trust signal, never
 * an endorsement or investment advice.
 */
export function VerifiedBadge({ communityId }: { communityId: string }) {
  if (!isVerifiedCommunity(communityId)) return null;

  return (
    <a
      href={CRITERIA_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="verified-badge"
      aria-label="Verified community — see review criteria"
      title="Verified community. The mark signals a manual review, not investment advice."
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-sky-600/60 bg-sky-950/40 px-1.5 py-0.5 text-[11px] font-medium leading-4 text-sky-200 transition hover:border-sky-400 hover:text-sky-100"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="size-3.5"
      >
        <path
          fillRule="evenodd"
          d="M16.403 12.652a3 3 0 0 0 0-5.304 3 3 0 0 0-3.75-3.751 3 3 0 0 0-5.305 0 3 3 0 0 0-3.751 3.75 3 3 0 0 0 0 5.305 3 3 0 0 0 3.75 3.751 3 3 0 0 0 5.305 0 3 3 0 0 0 3.751-3.75Zm-2.546-4.46a.75.75 0 0 0-1.214-.883l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
          clipRule="evenodd"
        />
      </svg>
      Verified
    </a>
  );
}
