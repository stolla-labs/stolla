import {
  isProposalIdShape,
  normalizeSupersedes,
  parseProposalDescription,
  supersedesOf,
} from "@/lib/proposal-metadata";

/**
 * Which proposal replaces which, derived from what the proposals say.
 *
 * An amended decision leaves the old proposal sitting in the list looking
 * every bit as authoritative as the new one. The new proposal records the id
 * of the one it replaces (`supersedes` in metadata v2), and this module turns
 * those one-way links into the two answers a reader needs: *is the text I am
 * reading still the current one*, and *where is the current one*.
 *
 * Only the forward link can be stored. A Governor description is immutable
 * once the proposal exists, so the older proposal can never be amended to
 * point at its replacement — `supersededBy` is computed here by reading the
 * community's proposals, and is therefore only ever as complete as the
 * discovery that produced them. A caller holding partial history must say so
 * rather than report "not superseded", which is why `resolveSupersede` never
 * claims a proposal is canonical: it reports what the links it was given say.
 */

export type SupersedeNode = {
  proposalId: string;
  /** The proposal this one replaces, as stored. Null for v1 and legacy descriptions. */
  supersedes: string | null;
};

export type SupersedeGraph = {
  /** Every id this graph knows, in the order it was given. */
  ids: string[];
  /** id → the proposal it replaces, when it names one this graph knows or not. */
  replaces: Map<string, string>;
  /** id → every proposal claiming to replace it. More than one is a conflict, not a choice. */
  replacedBy: Map<string, string[]>;
};

/** The supersede links carried by a list of discovered proposals. */
export function supersedeNodesFrom(
  proposals: readonly { id: string; description?: string | null }[],
): SupersedeNode[] {
  return proposals.map((proposal) => {
    const parsed = parseProposalDescription(proposal.description ?? "");
    return {
      proposalId: proposal.id.toLowerCase(),
      supersedes:
        parsed.kind === "versioned" ? supersedesOf(parsed.metadata) : null,
    };
  });
}

export function buildSupersedeGraph(nodes: readonly SupersedeNode[]): SupersedeGraph {
  const ids: string[] = [];
  const replaces = new Map<string, string>();
  const replacedBy = new Map<string, string[]>();

  for (const node of nodes) {
    const id = node.proposalId.toLowerCase();
    if (!ids.includes(id)) ids.push(id);

    const target = normalizeSupersedes(node.supersedes);
    /* A link to itself is the shortest possible cycle and is never a fact
       about anything, so it is dropped at the door rather than carried into
       the walk below. */
    if (!target || target === id || !isProposalIdShape(target)) continue;

    replaces.set(id, target);
    replacedBy.set(target, [...(replacedBy.get(target) ?? []), id]);
  }

  return { ids, replaces, replacedBy };
}

export function graphFromProposals(
  proposals: readonly { id: string; description?: string | null }[],
): SupersedeGraph {
  return buildSupersedeGraph(supersedeNodesFrom(proposals));
}

/** The proposal this one says it replaces, or null. */
export function replacesOf(graph: SupersedeGraph, id: string): string | null {
  return graph.replaces.get(id.toLowerCase()) ?? null;
}

/** Every proposal claiming to replace this one. Usually none, sometimes one. */
export function replacedByOf(graph: SupersedeGraph, id: string): string[] {
  return graph.replacedBy.get(id.toLowerCase()) ?? [];
}

export function isSuperseded(graph: SupersedeGraph, id: string): boolean {
  return replacedByOf(graph, id).length > 0;
}

export type SupersedeResolution =
  /** Nothing claims to replace this proposal: its own text is the current one. */
  | { kind: "current" }
  /** One chain of replacements ends at `canonical`; `chain` runs from this proposal to it. */
  | { kind: "replaced"; canonical: string; chain: string[] }
  /** Two or more proposals claim to replace the same one. A reader is told, not guessed at. */
  | { kind: "conflicted"; claimants: string[] }
  /** The links loop. No proposal in the loop can be called canonical. */
  | { kind: "cycle"; cycle: string[] };

/**
 * Where the current text of a decision lives, starting from any proposal in
 * its history.
 *
 * Walks forward through "who replaces me" one step at a time. Three endings
 * are reported rather than resolved, because each one means something
 * different to a voter and picking a winner would be inventing a fact:
 *
 * - a fork (two proposals claiming the same predecessor) is a governance
 *   problem the community has to settle, not a tie this function breaks;
 * - a loop is data that cannot be true, and calling any member of it
 *   canonical would point a voter at a text that points back;
 * - and a proposal nothing replaces is simply current.
 */
export function resolveSupersede(graph: SupersedeGraph, id: string): SupersedeResolution {
  const start = id.toLowerCase();
  const chain = [start];
  const seen = new Set([start]);
  let cursor = start;

  for (;;) {
    const claimants = replacedByOf(graph, cursor);
    if (claimants.length === 0) {
      return chain.length === 1
        ? { kind: "current" }
        : { kind: "replaced", canonical: cursor, chain };
    }
    if (claimants.length > 1) {
      return { kind: "conflicted", claimants };
    }

    const next = claimants[0];
    if (seen.has(next)) {
      return { kind: "cycle", cycle: [...chain.slice(chain.indexOf(next)), next] };
    }

    seen.add(next);
    chain.push(next);
    cursor = next;
  }
}

/** The loop a proposal sits in, oldest link first, or null when there is none. */
export function supersedeCycle(graph: SupersedeGraph, id: string): string[] | null {
  const seen = new Set<string>();
  let cursor = id.toLowerCase();

  while (!seen.has(cursor)) {
    seen.add(cursor);
    const next = replacesOf(graph, cursor);
    if (!next) return null;
    cursor = next;
  }

  const cycle = [cursor];
  for (let step = replacesOf(graph, cursor); step && step !== cursor; step = replacesOf(graph, step)) {
    cycle.push(step);
  }
  return cycle;
}

export type SupersedeTargetProblem =
  | "self"
  | "malformed"
  | "cycle"
  | "unknown-proposal";

/**
 * Whether a proposal about to be created may name `target` as the proposal it
 * replaces.
 *
 * `unknown-proposal` is deliberately separate from the other three: proposal
 * discovery can be partial (a short RPC retention window, a failed page), so
 * an id this browser has not seen is a reason to warn and not a reason to
 * refuse. The caller decides which problems block submission; the create form
 * treats the other three as errors and this one as a caution.
 */
export function supersedeTargetProblem(
  graph: SupersedeGraph,
  target: string,
  options: { selfId?: string | null } = {},
): SupersedeTargetProblem | null {
  const wanted = normalizeSupersedes(target);
  if (!wanted) return null;
  if (!isProposalIdShape(wanted)) return "malformed";

  const self = normalizeSupersedes(options.selfId ?? null);
  if (self && self === wanted) return "self";

  /* Following the chain the target already belongs to: if this proposal is
     already somewhere behind the target, replacing the target would close a
     loop. Ids are content hashes, so this cannot happen by accident — but it
     can be written by hand, and a loop renders as two proposals each pointing
     at the other as canonical. */
  if (self) {
    const seen = new Set<string>([self]);
    for (let step: string | null = wanted; step; step = replacesOf(graph, step)) {
      if (seen.has(step)) return "cycle";
      seen.add(step);
    }
  } else if (supersedeCycle(graph, wanted)) {
    return "cycle";
  }

  return graph.ids.includes(wanted) ? null : "unknown-proposal";
}

/**
 * Why a supersede link cannot be used, as a sentence, or null when it can.
 *
 * Only the two problems that can never be true are errors. A malformed id is
 * already reported by metadata validation, and an id this browser has not
 * discovered gets `supersedeLinkCaution` instead — see
 * `supersedeTargetProblem`.
 */
export function supersedeLinkError(problem: SupersedeTargetProblem | null): string | null {
  if (problem === "self") return "A proposal cannot replace itself.";
  if (problem === "cycle") {
    return "That link would make two proposals replace each other in a loop.";
  }
  return null;
}

/** What to warn a creator about without stopping them, or null. */
export function supersedeLinkCaution(problem: SupersedeTargetProblem | null): string | null {
  if (problem !== "unknown-proposal") return null;
  return "No loaded proposal has that id. Check it before submitting — proposal history here may be incomplete.";
}
