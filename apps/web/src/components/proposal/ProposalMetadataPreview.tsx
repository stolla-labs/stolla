import type { ProposalMetadataDraft } from "@/lib/proposal-metadata";

export function ProposalMetadataPreview({
  metadata,
}: {
  metadata: ProposalMetadataDraft;
}) {
  return (
    <aside
      aria-label="Proposal preview"
      className="mt-5 rounded-lg border border-slate-700 bg-slate-950/60 p-4"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Preview
      </p>
      <h3 className="mt-2 break-words font-semibold text-slate-100">
        {metadata.title.trim() || "Untitled proposal"}
      </h3>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-400">
        {metadata.summary.trim() || "Your summary will appear here."}
      </p>
      {metadata.discussionUrl?.trim() && (
        <p className="mt-3 break-all text-xs text-indigo-300">
          Discussion: {metadata.discussionUrl.trim()}
        </p>
      )}
    </aside>
  );
}
