import { describe, expect, it } from "vitest";
import { serializeProposalMetadata } from "@/lib/proposal-metadata";
import {
  buildSupersedeGraph,
  graphFromProposals,
  isSuperseded,
  replacedByOf,
  replacesOf,
  resolveSupersede,
  supersedeCycle,
  supersedeNodesFrom,
  supersedeLinkCaution,
  supersedeLinkError,
  supersedeTargetProblem,
} from "./supersede";

const A = "a".repeat(64);
const B = "b".repeat(64);
const C = "c".repeat(64);
const D = "d".repeat(64);

function node(proposalId: string, supersedes: string | null = null) {
  return { proposalId, supersedes };
}

function described(id: string, supersedes: string | null = null) {
  return {
    id,
    description: serializeProposalMetadata({
      title: `Proposal ${id.slice(0, 4)}`,
      summary: "A decision.",
      body: "The details.",
      discussionUrl: null,
      supersedes,
    }),
  };
}

describe("supersedeNodesFrom", () => {
  it("reads the link out of a v2 description", () => {
    expect(supersedeNodesFrom([described(B, A), described(A)])).toEqual([
      { proposalId: B, supersedes: A },
      { proposalId: A, supersedes: null },
    ]);
  });

  it("reads no link from a v1 or a legacy description", () => {
    expect(
      supersedeNodesFrom([described(A), { id: B, description: "Just some text" }, { id: C }]),
    ).toEqual([
      { proposalId: A, supersedes: null },
      { proposalId: B, supersedes: null },
      { proposalId: C, supersedes: null },
    ]);
  });

  it("matches ids written in upper case", () => {
    // A creator pasting an id from a display that shortens and upper-cases it
    // still links the same proposal.
    const [replacement] = supersedeNodesFrom([{ id: B.toUpperCase(), description: described(B, A.toUpperCase()).description }]);

    expect(replacement).toEqual({ proposalId: B, supersedes: A });
  });
});

describe("buildSupersedeGraph", () => {
  it("records the link in both directions", () => {
    const graph = buildSupersedeGraph([node(B, A), node(A)]);

    expect(replacesOf(graph, B)).toBe(A);
    expect(replacedByOf(graph, A)).toEqual([B]);
    expect(isSuperseded(graph, A)).toBe(true);
    expect(isSuperseded(graph, B)).toBe(false);
  });

  it("drops a proposal pointing at itself", () => {
    // The shortest possible cycle, and never a fact about anything.
    const graph = buildSupersedeGraph([node(A, A)]);

    expect(replacesOf(graph, A)).toBeNull();
    expect(isSuperseded(graph, A)).toBe(false);
  });

  it("drops a link that is not a proposal id", () => {
    expect(replacesOf(buildSupersedeGraph([node(B, "not-an-id")]), B)).toBeNull();
  });

  it("keeps a link to a proposal it has never seen", () => {
    // Discovery can be partial; forgetting the link would report the
    // replacement as unrelated rather than as pointing somewhere unloaded.
    expect(replacesOf(buildSupersedeGraph([node(B, A)]), B)).toBe(A);
  });
});

describe("resolveSupersede", () => {
  it("says a proposal nothing replaces is the current one", () => {
    expect(resolveSupersede(graphFromProposals([described(A)]), A)).toEqual({ kind: "current" });
  });

  it("points a reader at the end of the chain, not at the next link", () => {
    // C replaces B replaces A. A reader opening A needs C, which is the text
    // that is actually in force.
    const graph = buildSupersedeGraph([node(A), node(B, A), node(C, B)]);

    expect(resolveSupersede(graph, A)).toEqual({ kind: "replaced", canonical: C, chain: [A, B, C] });
    expect(resolveSupersede(graph, B)).toEqual({ kind: "replaced", canonical: C, chain: [B, C] });
    expect(resolveSupersede(graph, C)).toEqual({ kind: "current" });
  });

  it("reports a fork instead of choosing a winner", () => {
    // Two proposals claiming the same predecessor is a disagreement the
    // community has to settle; naming one canonical would hide it.
    const graph = buildSupersedeGraph([node(A), node(B, A), node(C, A)]);

    expect(resolveSupersede(graph, A)).toEqual({ kind: "conflicted", claimants: [B, C] });
  });

  it("reports a loop rather than walking it forever", () => {
    const graph = buildSupersedeGraph([node(A, B), node(B, A)]);

    expect(resolveSupersede(graph, A)).toEqual({ kind: "cycle", cycle: [A, B, A] });
  });

  it("reports a longer loop the same way", () => {
    const graph = buildSupersedeGraph([node(A, C), node(B, A), node(C, B)]);
    const resolved = resolveSupersede(graph, A);

    expect(resolved.kind).toBe("cycle");
    if (resolved.kind !== "cycle") return;
    expect(resolved.cycle.at(0)).toBe(resolved.cycle.at(-1));
    expect(new Set(resolved.cycle)).toEqual(new Set([A, B, C]));
  });

  it("does not loop on a chain that leads into a loop", () => {
    // D replaces C, and A and B replace each other: walking from D must stop.
    const graph = buildSupersedeGraph([node(A, B), node(B, A), node(D, C), node(C)]);

    expect(resolveSupersede(graph, C)).toEqual({ kind: "replaced", canonical: D, chain: [C, D] });
    expect(resolveSupersede(graph, A).kind).toBe("cycle");
  });
});

describe("supersedeCycle", () => {
  it("finds the loop a proposal sits in", () => {
    const graph = buildSupersedeGraph([node(A, B), node(B, A)]);

    expect(new Set(supersedeCycle(graph, A) ?? [])).toEqual(new Set([A, B]));
  });

  it("is null for a chain that ends", () => {
    expect(supersedeCycle(buildSupersedeGraph([node(B, A), node(A)]), B)).toBeNull();
  });

  it("is null for a proposal with no link at all", () => {
    expect(supersedeCycle(buildSupersedeGraph([node(A)]), A)).toBeNull();
  });
});

describe("supersedeTargetProblem", () => {
  const graph = buildSupersedeGraph([node(A), node(B, A), node(C)]);

  it("accepts a proposal this community has", () => {
    expect(supersedeTargetProblem(graph, C)).toBeNull();
  });

  it("accepts nothing at all", () => {
    expect(supersedeTargetProblem(graph, "")).toBeNull();
  });

  it("refuses an id that is not one", () => {
    expect(supersedeTargetProblem(graph, "12345")).toBe("malformed");
  });

  it("refuses a proposal replacing itself", () => {
    expect(supersedeTargetProblem(graph, C, { selfId: C })).toBe("self");
  });

  it("refuses a link that would close a loop", () => {
    // D is already behind B: B says it replaces A, so a new D replacing B
    // while A replaces D would loop. Walking the target's chain is what
    // catches it before the proposal is written.
    const looping = buildSupersedeGraph([node(A, D), node(B, A), node(D)]);

    expect(supersedeTargetProblem(looping, B, { selfId: D })).toBe("cycle");
  });

  it("warns, rather than refuses, for an id it has not seen", () => {
    // Discovery can be partial, so "not in this list" is not "does not exist".
    expect(supersedeTargetProblem(graph, D)).toBe("unknown-proposal");
  });
});

describe("what a creator is told", () => {
  it("blocks only the two links that can never be true", () => {
    expect(supersedeLinkError("self")).toContain("cannot replace itself");
    expect(supersedeLinkError("cycle")).toContain("loop");
    // Metadata validation already reports a malformed id; saying it twice in
    // two different wordings is worse than saying it once.
    expect(supersedeLinkError("malformed")).toBeNull();
    expect(supersedeLinkError("unknown-proposal")).toBeNull();
    expect(supersedeLinkError(null)).toBeNull();
  });

  it("warns about an id it has not loaded without blocking it", () => {
    expect(supersedeLinkCaution("unknown-proposal")).toContain("may be incomplete");
    expect(supersedeLinkCaution("cycle")).toBeNull();
    expect(supersedeLinkCaution(null)).toBeNull();
  });
});
