import { parseProposalDescription } from "@/lib/proposal-metadata/parse";

export type SearchableProposal = {
  id: string;
  description?: string | null;
};

export function normalizeProposalSearchQuery(
  raw: string | null | undefined,
): string {
  if (!raw) return "";
  return raw.trim().toLowerCase();
}

export function matchesProposalSearch(
  proposal: SearchableProposal,
  rawQuery: string | null | undefined,
): boolean {
  const query = normalizeProposalSearchQuery(rawQuery);
  if (!query) return true;

  const strippedIdQuery = query.startsWith("#") ? query.slice(1) : query;
  if (
    proposal.id.toLowerCase().includes(query) ||
    (strippedIdQuery.length > 0 &&
      proposal.id.toLowerCase().includes(strippedIdQuery))
  ) {
    return true;
  }

  const rawDescription = proposal.description ?? "";
  if (!rawDescription) return false;

  const parsed = parseProposalDescription(rawDescription);
  if (parsed.kind === "versioned" && parsed.metadata) {
    const haystack = [
      parsed.metadata.title,
      parsed.metadata.summary,
      parsed.metadata.body,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  }

  return rawDescription.toLowerCase().includes(query);
}

export function filterProposalsBySearch<T extends SearchableProposal>(
  proposals: readonly T[],
  rawQuery: string | null | undefined,
): T[] {
  const query = normalizeProposalSearchQuery(rawQuery);
  if (!query) return [...proposals];
  return proposals.filter((proposal) => matchesProposalSearch(proposal, query));
}
