"use client";

import { AppLinkButton } from "@/components/ui/AppLinkButton";
import { draftPreviewName } from "@/lib/community/draft-preview";
import type { CommunityWizardDraft } from "@/lib/community/wizard";
import { DraftPreviewBanner, DraftWatermark } from "./DraftWatermark";

/**
 * A community page as it would read, built from the wizard's draft.
 *
 * Every value shown is one the creator typed. Where a deployed community shows
 * its contract addresses, this shows that there are none — a plausible-looking
 * id would be the one lie a preview must not tell, because a creator checking
 * the page would have no way to know it was invented.
 */
export function DraftCommunityPreview({ draft }: { draft: CommunityWizardDraft }) {
  const { metadata, governance } = draft;
  const name = draftPreviewName(draft);
  const externalLink = metadata.externalLinkUrl.trim();

  return (
    <div className="relative mx-auto max-w-3xl px-4 py-10">
      <DraftWatermark />

      <div className="relative z-50 space-y-6">
        <DraftPreviewBanner>
          <p className="mt-2">
            Deploying it from the wizard is what makes it real and public.
          </p>
        </DraftPreviewBanner>

        <div>
          <h1 className="text-2xl font-bold text-slate-100">{name}</h1>
          {metadata.symbol.trim() && (
            <p className="mt-1 font-mono text-sm text-slate-400">
              {metadata.symbol.trim()}
            </p>
          )}
          {metadata.description.trim() ? (
            <p className="mt-3 whitespace-pre-wrap break-words text-slate-400">
              {metadata.description.trim()}
            </p>
          ) : (
            <p className="mt-3 text-slate-500">No description yet.</p>
          )}
        </div>

        {externalLink && (
          <a
            href={externalLink}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            className="inline-flex min-h-10 items-center rounded-lg border border-indigo-500/50 px-3 py-2 text-sm font-medium text-indigo-300 hover:bg-indigo-950/50"
          >
            {metadata.externalLinkLabel.trim() || externalLink}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}

        <dl className="grid gap-3 rounded-xl border border-slate-800 bg-[#151b2b] p-5 text-sm sm:grid-cols-2">
          <Row label="Proposal threshold" value={governance.proposalThreshold} />
          <Row label="Quorum" value={governance.quorum} />
          <Row label="Voting delay (ledgers)" value={governance.votingDelay} />
          <Row label="Voting period (ledgers)" value={governance.votingPeriod} />
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Contracts</dt>
            <dd className="mt-1 text-slate-300" data-testid="draft-preview-contracts">
              Not deployed. A deployed community shows its Governor and NFT
              addresses here.
            </dd>
          </div>
        </dl>

        <p className="text-sm text-slate-500">
          Proposals, members and voting appear once the community is deployed —
          there is nothing on chain to read them from yet.
        </p>

        <AppLinkButton href="/communities/create" tone="primary">
          Back to the wizard
        </AppLinkButton>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-1 break-all font-mono text-slate-100">
        {value.trim() || "—"}
      </dd>
    </div>
  );
}
