import Link from "next/link";
import { truncateMiddle } from "@/lib/truncate";
import {
  replacesOf,
  resolveSupersede,
  type SupersedeGraph,
} from "@/lib/proposals/supersede";

/**
 * Which text of a decision a reader is looking at.
 *
 * An amended decision leaves the old proposal in the list looking as
 * authoritative as the new one, which is how voters end up reading the wrong
 * text. Two notices answer that, and the proposal in the middle of a chain
 * shows both: what this proposal replaces, and what has replaced it.
 *
 * A fork and a loop are reported as what they are rather than resolved into a
 * single pointer. Picking one of two competing replacements would be inventing
 * a governance decision nobody made, and naming a member of a loop canonical
 * would send a reader to a proposal that points back.
 */
export function SupersedeNotice({
  graph,
  proposalId,
  hrefFor,
  /** Set when the proposal list this graph came from is known to be incomplete. */
  historyIncomplete = false,
}: {
  graph: SupersedeGraph;
  proposalId: string;
  hrefFor: (proposalId: string) => string;
  historyIncomplete?: boolean;
}) {
  const id = proposalId.toLowerCase();
  const replaces = replacesOf(graph, id);
  const resolution = resolveSupersede(graph, id);

  /* Nothing to say only when there is no link either way *and* the history
     behind that silence is complete. With partial history, "nothing replaces
     this" is a claim worth qualifying rather than one worth making quietly. */
  if (!replaces && resolution.kind === "current" && !historyIncomplete) return null;

  return (
    <div className="mt-4 space-y-2" data-testid="supersede-notice">
      {resolution.kind === "replaced" && (
        <Notice tone="warning" testId="supersede-replaced">
          <strong className="font-semibold">This is not the current text.</strong>{" "}
          It was replaced by{" "}
          <ProposalLink id={resolution.canonical} hrefFor={hrefFor} />
          {resolution.chain.length > 2
            ? `, after ${resolution.chain.length - 2} earlier revision${
                resolution.chain.length === 3 ? "" : "s"
              }.`
            : "."}
        </Notice>
      )}

      {resolution.kind === "conflicted" && (
        <Notice tone="warning" testId="supersede-conflicted">
          <strong className="font-semibold">
            {resolution.claimants.length} later proposals each claim to replace this
            one.
          </strong>{" "}
          Until the community settles which one stands, there is no single current
          text:{" "}
          {resolution.claimants.map((claimant, index) => (
            <span key={claimant}>
              {index > 0 && ", "}
              <ProposalLink id={claimant} hrefFor={hrefFor} />
            </span>
          ))}
          .
        </Notice>
      )}

      {resolution.kind === "cycle" && (
        <Notice tone="warning" testId="supersede-cycle">
          <strong className="font-semibold">
            These proposals replace each other in a loop.
          </strong>{" "}
          No proposal in the loop can be the current text, so this link is shown
          but not followed.
        </Notice>
      )}

      {replaces && (
        <Notice tone="info" testId="supersede-replaces">
          This proposal replaces <ProposalLink id={replaces} hrefFor={hrefFor} />
          {graph.ids.includes(replaces)
            ? "."
            : " — a proposal this history does not include, so it cannot be shown here."}
        </Notice>
      )}

      {historyIncomplete && resolution.kind === "current" && (
        <p className="text-xs text-slate-500" data-testid="supersede-partial">
          Proposal history is incomplete, so a newer proposal replacing this one
          may not have been loaded.
        </p>
      )}
    </div>
  );
}

function Notice({
  tone,
  testId,
  children,
}: {
  tone: "warning" | "info";
  testId: string;
  children: React.ReactNode;
}) {
  const className =
    tone === "warning"
      ? "border-amber-700/70 bg-amber-950/40 text-amber-100"
      : "border-slate-700 bg-slate-900/60 text-slate-300";

  return (
    <p
      /* A warning is announced because it changes whether the text below is
         worth reading; the "replaces" line is context and is not. */
      role={tone === "warning" ? "alert" : undefined}
      data-testid={testId}
      className={`rounded-lg border px-3 py-2 text-sm ${className}`}
    >
      {children}
    </p>
  );
}

function ProposalLink({
  id,
  hrefFor,
}: {
  id: string;
  hrefFor: (proposalId: string) => string;
}) {
  return (
    <Link
      href={hrefFor(id)}
      title={id}
      className="font-mono underline decoration-dotted underline-offset-2 hover:no-underline"
    >
      {truncateMiddle(id)}
    </Link>
  );
}
