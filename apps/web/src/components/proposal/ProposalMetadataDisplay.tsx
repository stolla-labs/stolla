import { parseProposalDescription } from "@/lib/proposal-metadata";

export function ProposalMetadataDisplay({ description }: { description: string }) {
  const parsed = parseProposalDescription(description);
  if (parsed.kind === "legacy") {
    return (
      <section aria-labelledby="proposal-description-heading">
        <h2 id="proposal-description-heading" className="font-semibold text-slate-100">
          Description
        </h2>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-300">
          {parsed.raw.trim() || "Description unavailable"}
        </p>
        <p className="mt-3 text-xs text-slate-500">Legacy proposal format</p>
      </section>
    );
  }

  const { metadata } = parsed;
  return (
    <section aria-labelledby="proposal-description-heading">
      <h2 id="proposal-description-heading" className="text-xl font-semibold text-slate-100">
        {metadata.title}
      </h2>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm font-medium text-slate-300">
        {metadata.summary}
      </p>
      <div className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-400">
        {metadata.body}
      </div>
      {metadata.discussionUrl && (
        <a
          href={metadata.discussionUrl}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
          className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-indigo-500/50 px-3 py-2 text-sm font-medium text-indigo-300 hover:bg-indigo-950/50"
        >
          Open discussion
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      )}
    </section>
  );
}
