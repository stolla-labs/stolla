"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DraftCommunityPreview } from "@/components/community/DraftCommunityPreview";
import { LiveStatus } from "@/components/ui/LiveStatus";
import {
  resolveDraftPreview,
  type DraftPreviewResolution,
} from "@/lib/community/draft-preview";
import { resolveStellarNetworkId } from "@/lib/stellarExplorer";

const REFUSALS = {
  "no-token": {
    heading: "This preview link cannot be opened here",
    detail:
      "A draft community lives in the browser that created it, so a preview can only be opened from that wizard. Open the wizard and use its preview button.",
  },
  "token-mismatch": {
    heading: "This preview link is not for this browser",
    detail:
      "The link was issued by a different device, or the wizard has issued a newer one since. Open the wizard on this device and preview again.",
  },
  expired: {
    heading: "This preview link has expired",
    detail:
      "Preview links stop working after a while so a shared link cannot keep opening somebody's draft. Open the wizard and preview again.",
  },
  "no-draft": {
    heading: "There is no draft in this browser",
    detail:
      "Drafts are stored locally and were either discarded or never started here.",
  },
  "empty-draft": {
    heading: "There is nothing to preview yet",
    detail: "Add a name, symbol and description in the wizard first.",
  },
} as const;

/**
 * The preview route.
 *
 * The draft is read in an effect rather than during render: it comes from
 * `localStorage`, which does not exist while the page is being prerendered,
 * and a server-rendered "no draft" that then flips would be worse than one
 * honest loading line.
 */
export function DraftPreviewRoute() {
  const params = useSearchParams();
  const token = params.get("token");
  const [resolution, setResolution] = useState<DraftPreviewResolution | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResolution(
      resolveDraftPreview({ network: resolveStellarNetworkId(), token }),
    );
  }, [token]);

  if (resolution === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <LiveStatus>Opening draft preview…</LiveStatus>
      </div>
    );
  }

  if (resolution.status === "granted") {
    return <DraftCommunityPreview draft={resolution.draft} />;
  }

  const refusal = REFUSALS[resolution.status];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <section
        role="alert"
        data-testid={`draft-preview-${resolution.status}`}
        className="rounded-xl border border-slate-800 bg-[#151b2b] p-6"
      >
        <h1 className="text-xl font-semibold text-slate-100">{refusal.heading}</h1>
        <p className="mt-2 text-sm text-slate-400">{refusal.detail}</p>
        <Link
          href="/communities/create"
          className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-shell-primary px-4 py-2 text-sm font-medium text-white hover:bg-shell-primary-hover"
        >
          Open the wizard
        </Link>
      </section>
    </div>
  );
}
